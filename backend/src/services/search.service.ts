import pool from '../db/pool.js';

export interface SearchFilters {
  query: string;
  intentions?: string[];
  themeIds?: string[];
  minAge?: number;
  maxAge?: number;
  city?: string;
  country?: string;
  limit?: number;
  offset?: number;
}

export interface SearchProfileResult {
  userId: string;
  username: string;
  age?: number;
  locationCity?: string;
  locationCountry: string;
  currentLifePreview: string;
  lookingFor: string;
  intentions: string[];
  themes: string[];
  mainPhotoUrl?: string;
  lastActiveCategory: 'now' | 'today' | 'week' | 'month' | 'older';
  rank: number;
}

export interface SearchResult {
  profiles: SearchProfileResult[];
  total: number;
  query: string;
}

function getLastActiveCategory(lastActiveAt: Date): SearchProfileResult['lastActiveCategory'] {
  const now = new Date();
  const diff = now.getTime() - lastActiveAt.getTime();
  const minutes = diff / (1000 * 60);
  const hours = minutes / 60;
  const days = hours / 24;

  if (minutes < 15) return 'now';
  if (hours < 24) return 'today';
  if (days < 7) return 'week';
  if (days < 30) return 'month';
  return 'older';
}

export async function searchProfiles(
  userId: string,
  filters: SearchFilters
): Promise<SearchResult> {
  const {
    query,
    intentions,
    themeIds,
    minAge,
    maxAge,
    city,
    country,
    limit = 20,
    offset = 0,
  } = filters;

  // Build the search query
  const params: (string | number | string[])[] = [];
  let paramIndex = 1;

  // Parse search query for French full-text search
  const searchTerms = query.trim().split(/\s+/).filter(t => t.length > 1);
  const tsQuery = searchTerms.length > 0
    ? searchTerms.map(term => term.replace(/[^a-zA-ZÀ-ÿ0-9]/g, '')).filter(t => t).join(' & ')
    : '';

  let whereClause = `
    WHERE u.id != $${paramIndex++}
    AND u.is_active = true
    AND u.is_paused = false
    AND p.moderation_status = 'approved'
    AND NOT EXISTS (
      SELECT 1 FROM blocks b
      WHERE (b.blocker_id = $1 AND b.blocked_id = u.id)
         OR (b.blocker_id = u.id AND b.blocked_id = $1)
    )
  `;
  params.push(userId);

  // Full-text search condition
  let rankExpression = '1';
  if (tsQuery) {
    whereClause += ` AND p.search_vector @@ plainto_tsquery('french', $${paramIndex})`;
    rankExpression = `ts_rank(p.search_vector, plainto_tsquery('french', $${paramIndex}))`;
    params.push(query);
    paramIndex++;
  }

  // Intentions filter
  if (intentions && intentions.length > 0) {
    whereClause += ` AND u.intentions && $${paramIndex}::text[]`;
    params.push(intentions);
    paramIndex++;
  }

  // Theme filter (by theme IDs from user_themes)
  if (themeIds && themeIds.length > 0) {
    whereClause += ` AND EXISTS (
      SELECT 1 FROM user_themes ut
      WHERE ut.user_id = u.id AND ut.theme_id = ANY($${paramIndex}::uuid[])
    )`;
    params.push(themeIds);
    paramIndex++;
  }

  // Age filter
  const currentYear = new Date().getFullYear();
  if (minAge) {
    whereClause += ` AND u.birth_year <= $${paramIndex}`;
    params.push(currentYear - minAge);
    paramIndex++;
  }
  if (maxAge) {
    whereClause += ` AND u.birth_year >= $${paramIndex}`;
    params.push(currentYear - maxAge);
    paramIndex++;
  }

  // City filter
  if (city) {
    whereClause += ` AND LOWER(u.location_city) LIKE LOWER($${paramIndex})`;
    params.push(`%${city}%`);
    paramIndex++;
  }

  // Country filter
  if (country) {
    whereClause += ` AND LOWER(u.location_country) = LOWER($${paramIndex})`;
    params.push(country);
    paramIndex++;
  }

  // Count total results
  const countQuery = `
    SELECT COUNT(DISTINCT u.id) as total
    FROM users u
    JOIN profiles p ON u.id = p.user_id
    ${whereClause}
  `;

  const countResult = await pool.query(countQuery, params);
  const total = parseInt(countResult.rows[0].total, 10);

  // Get paginated results with ranking
  const searchQuery = `
    SELECT
      u.id as user_id,
      u.username,
      u.birth_year,
      u.location_city,
      u.location_country,
      u.intentions,
      u.last_active_at,
      p.current_life,
      p.looking_for,
      p.extracted_themes,
      (SELECT url FROM photos WHERE user_id = u.id ORDER BY order_index LIMIT 1) as main_photo_url,
      ${rankExpression} as rank
    FROM users u
    JOIN profiles p ON u.id = p.user_id
    ${whereClause}
    ORDER BY ${tsQuery ? 'rank DESC,' : ''} u.last_active_at DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  params.push(limit, offset);

  const result = await pool.query(searchQuery, params);

  const profiles: SearchProfileResult[] = result.rows.map(row => ({
    userId: row.user_id,
    username: row.username,
    age: row.birth_year ? currentYear - row.birth_year : undefined,
    locationCity: row.location_city,
    locationCountry: row.location_country,
    currentLifePreview: row.current_life.length > 150
      ? row.current_life.substring(0, 150) + '...'
      : row.current_life,
    lookingFor: row.looking_for,
    intentions: row.intentions,
    themes: row.extracted_themes || [],
    mainPhotoUrl: row.main_photo_url,
    lastActiveCategory: getLastActiveCategory(new Date(row.last_active_at)),
    rank: row.rank,
  }));

  return {
    profiles,
    total,
    query,
  };
}

export async function getSearchSuggestions(
  query: string,
  limit = 5
): Promise<string[]> {
  if (query.length < 2) {
    return [];
  }

  // Get suggestions from extracted themes and common terms
  const result = await pool.query(`
    SELECT DISTINCT unnest(extracted_themes) as term
    FROM profiles
    WHERE moderation_status = 'approved'
    AND EXISTS (
      SELECT 1 FROM unnest(extracted_themes) t
      WHERE LOWER(t) LIKE LOWER($1)
    )
    LIMIT $2
  `, [`%${query}%`, limit * 2]);

  // Filter and deduplicate
  const suggestions = result.rows
    .map(row => row.term as string)
    .filter(term => term.toLowerCase().includes(query.toLowerCase()))
    .slice(0, limit);

  // Also search in theme names
  const themeResult = await pool.query(`
    SELECT name FROM themes
    WHERE LOWER(name) LIKE LOWER($1)
    LIMIT $2
  `, [`%${query}%`, limit]);

  const themeSuggestions = themeResult.rows.map(row => row.name as string);

  // Combine and deduplicate
  const allSuggestions = [...new Set([...suggestions, ...themeSuggestions])];

  return allSuggestions.slice(0, limit);
}

export async function getPopularSearches(limit = 10): Promise<string[]> {
  // Return popular themes as search suggestions
  const result = await pool.query(`
    SELECT t.name, COUNT(ut.user_id) as user_count
    FROM themes t
    LEFT JOIN user_themes ut ON t.id = ut.theme_id
    GROUP BY t.id, t.name
    ORDER BY user_count DESC
    LIMIT $1
  `, [limit]);

  return result.rows.map(row => row.name);
}
