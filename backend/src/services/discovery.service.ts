import { query } from '../db/pool.js';
import type { ProfilePreview, DiscoveryParams, DiscoveryResponse, ZoneVitality, User, Intention } from '../types/index.js';
import { getLastActiveCategory } from './profile.service.js';

export async function discoverProfiles(
  userId: string,
  params: DiscoveryParams
): Promise<DiscoveryResponse> {
  // Get current user
  const userResult = await query('SELECT * FROM users WHERE id = $1', [userId]);
  if (userResult.rows.length === 0) {
    throw new Error('User not found');
  }
  const currentUser = userResult.rows[0];

  const offset = (params.page - 1) * params.limit;
  const conditions: string[] = [
    'u.id != $1',
    'u.is_active = true',
    'u.is_paused = false',
    'p.moderation_status = $2',
  ];
  const values: unknown[] = [userId, 'approved'];
  let paramIndex = 3;

  // Exclude blocked users
  conditions.push(`NOT EXISTS (
    SELECT 1 FROM blocks b
    WHERE (b.blocker_id = $1 AND b.blocked_id = u.id)
       OR (b.blocker_id = u.id AND b.blocked_id = $1)
  )`);

  // Exclude shadow-banned users
  conditions.push(`NOT EXISTS (
    SELECT 1 FROM user_risk_scores rs
    WHERE rs.user_id = u.id AND (rs.is_shadow_banned = true OR rs.is_suspended = true)
  )`);

  // Mode-specific filters
  switch (params.mode) {
    case 'geography':
      // No mode-specific mandatory filters - location filter is optional (in searchFilters)
      break;

    case 'affinities':
      // No mode-specific mandatory filters - themes filter is optional (in searchFilters)
      break;

    case 'intentions':
      // Filter by specific intentions (mandatory if selected)
      if (params.intentions && params.intentions.length > 0) {
        conditions.push(`u.intentions && $${paramIndex}`);
        values.push(params.intentions);
        paramIndex++;
      }
      break;
  }

  // Optional filters
  if (params.languages && params.languages.length > 0) {
    conditions.push(`u.languages && $${paramIndex}`);
    values.push(params.languages);
    paramIndex++;
  }

  if (params.minAge !== undefined) {
    const maxBirthYear = new Date().getFullYear() - params.minAge;
    conditions.push(`u.birth_year <= $${paramIndex}`);
    values.push(maxBirthYear);
    paramIndex++;
  }

  if (params.maxAge !== undefined) {
    const minBirthYear = new Date().getFullYear() - params.maxAge;
    conditions.push(`u.birth_year >= $${paramIndex}`);
    values.push(minBirthYear);
    paramIndex++;
  }

  // Build optional search filters with OR logic (inclusive search)
  const searchFilters: string[] = [];

  // Location search (city or country)
  if (params.location && params.location.trim()) {
    const locationSearch = params.location.trim();
    searchFilters.push(`(
      u.location_city ILIKE $${paramIndex}
      OR u.location_country ILIKE $${paramIndex}
    )`);
    values.push(`%${locationSearch}%`);
    paramIndex++;
  }

  // Themes filter - match profiles with extracted_themes containing any of the search themes
  if (params.themes && params.themes.length > 0) {
    searchFilters.push(`(
      p.extracted_themes && $${paramIndex}::text[]
      OR EXISTS (
        SELECT 1 FROM user_themes ut
        JOIN themes t ON t.id = ut.theme_id
        WHERE ut.user_id = u.id AND t.slug = ANY($${paramIndex})
      )
    )`);
    values.push(params.themes);
    paramIndex++;
  }

  // Global text search
  if (params.search && params.search.trim()) {
    const searchTerm = params.search.trim();
    searchFilters.push(`(
      u.username ILIKE $${paramIndex}
      OR p.current_life ILIKE $${paramIndex}
      OR p.looking_for ILIKE $${paramIndex}
      OR p.whats_important ILIKE $${paramIndex}
      OR u.location_city ILIKE $${paramIndex}
      OR u.location_country ILIKE $${paramIndex}
    )`);
    values.push(`%${searchTerm}%`);
    paramIndex++;
  }

  // If there are search filters, use OR logic between them
  if (searchFilters.length > 0) {
    conditions.push(`(${searchFilters.join(' OR ')})`);
  }

  const whereClause = conditions.join(' AND ');

  // Get total count
  const countResult = await query(
    `SELECT COUNT(*) FROM users u
     JOIN profiles p ON p.user_id = u.id
     WHERE ${whereClause}`,
    values
  );
  const total = parseInt(countResult.rows[0].count, 10);

  // Get profiles with relevance scoring
  values.push(params.limit, offset);

  const profilesResult = await query(
    `SELECT
      u.id as user_id, u.username, u.birth_year, u.location_city, u.location_country,
      u.intentions, u.open_to_remote, u.last_active_at,
      p.current_life, p.looking_for, p.extracted_themes, p.completeness_score,
      (
        SELECT url FROM photos ph WHERE ph.user_id = u.id ORDER BY ph.order_index LIMIT 1
      ) as main_photo_url,
      -- Relevance scoring (not exposed to user)
      (
        COALESCE(array_length(array(SELECT unnest(u.intentions) INTERSECT SELECT unnest($${paramIndex + 2}::text[])), 1), 0) * 10
        + p.completeness_score * 0.25
        + CASE
            WHEN u.last_active_at > NOW() - INTERVAL '1 hour' THEN 20
            WHEN u.last_active_at > NOW() - INTERVAL '24 hours' THEN 16
            WHEN u.last_active_at > NOW() - INTERVAL '72 hours' THEN 12
            WHEN u.last_active_at > NOW() - INTERVAL '7 days' THEN 8
            ELSE 4
          END
        + CASE WHEN u.location_country = $${paramIndex + 3} THEN 10 ELSE 0 END
        + CASE WHEN u.location_city = $${paramIndex + 4} THEN 5 ELSE 0 END
      ) as relevance_score
    FROM users u
    JOIN profiles p ON p.user_id = u.id
    WHERE ${whereClause}
    ORDER BY relevance_score DESC, u.last_active_at DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...values, currentUser.intentions, currentUser.location_country, currentUser.location_city]
  );

  const profiles: ProfilePreview[] = profilesResult.rows.map((row) => ({
    userId: row.user_id,
    username: row.username,
    age: row.birth_year ? new Date().getFullYear() - row.birth_year : undefined,
    location: {
      city: row.location_city,
      country: row.location_country,
    },
    currentLifePreview: row.current_life.slice(0, 200) + (row.current_life.length > 200 ? '...' : ''),
    lookingFor: row.looking_for,
    intentions: row.intentions,
    matchedIntentions: (row.intentions as string[]).filter((i: string) =>
      (currentUser.intentions as string[]).includes(i)
    ) as Intention[],
    themes: row.extracted_themes,
    openToRemote: row.open_to_remote,
    mainPhotoUrl: row.main_photo_url,
    isLocal:
      row.location_city === currentUser.location_city &&
      row.location_country === currentUser.location_country,
    isSameCountry: row.location_country === currentUser.location_country,
    lastActiveCategory: getLastActiveCategory(new Date(row.last_active_at)),
  }));

  // Get zone vitality for geography mode
  let zoneVitality: ZoneVitality | undefined;
  if (params.mode === 'geography') {
    zoneVitality = await getZoneVitality(currentUser.location_country, currentUser.location_city);
  }

  return {
    profiles,
    total,
    page: params.page,
    hasMore: offset + profiles.length < total,
    zoneVitality,
  };
}

export async function getZoneVitality(country: string, city?: string): Promise<ZoneVitality> {
  // Count active users in different zones
  const localResult = await query(
    `SELECT COUNT(*) FROM users u
     JOIN profiles p ON p.user_id = u.id
     WHERE u.is_active = true AND u.is_paused = false
     AND u.location_country = $1 AND ($2::text IS NULL OR u.location_city = $2)
     AND p.moderation_status = 'approved'
     AND u.last_active_at > NOW() - INTERVAL '7 days'`,
    [country, city || null]
  );

  const nationalResult = await query(
    `SELECT COUNT(*) FROM users u
     JOIN profiles p ON p.user_id = u.id
     WHERE u.is_active = true AND u.is_paused = false
     AND u.location_country = $1
     AND p.moderation_status = 'approved'
     AND u.last_active_at > NOW() - INTERVAL '7 days'`,
    [country]
  );

  const globalResult = await query(
    `SELECT COUNT(*) FROM users u
     JOIN profiles p ON p.user_id = u.id
     WHERE u.is_active = true AND u.is_paused = false
     AND p.moderation_status = 'approved'
     AND u.last_active_at > NOW() - INTERVAL '7 days'`
  );

  const localCount = parseInt(localResult.rows[0].count, 10);
  const nationalCount = parseInt(nationalResult.rows[0].count, 10);
  const globalCount = parseInt(globalResult.rows[0].count, 10);

  let status: ZoneVitality['status'];
  let message: string;

  if (localCount < 5) {
    status = 'pioneer';
    message = `Vous êtes parmi les premiers dans votre zone ! ${nationalCount} personnes actives dans votre pays.`;
  } else if (localCount < 20) {
    status = 'growing';
    message = `Communauté en croissance : ${localCount} personnes actives près de chez vous.`;
  } else if (localCount < 100) {
    status = 'active';
    message = `Zone active : ${localCount} personnes à découvrir autour de vous.`;
  } else {
    status = 'vibrant';
    message = `Zone très active : ${localCount}+ personnes près de chez vous !`;
  }

  return {
    localCount,
    nationalCount,
    globalCount,
    status,
    message,
  };
}

export async function getSerendipityProfiles(
  userId: string,
  limit: number = 5
): Promise<ProfilePreview[]> {
  // Get profiles with different intentions/themes for diversity
  const userResult = await query('SELECT * FROM users WHERE id = $1', [userId]);
  if (userResult.rows.length === 0) {
    throw new Error('User not found');
  }
  const currentUser = userResult.rows[0];

  const result = await query(
    `SELECT
      u.id as user_id, u.username, u.birth_year, u.location_city, u.location_country,
      u.intentions, u.open_to_remote, u.last_active_at,
      p.current_life, p.looking_for, p.extracted_themes,
      (SELECT url FROM photos ph WHERE ph.user_id = u.id ORDER BY ph.order_index LIMIT 1) as main_photo_url
    FROM users u
    JOIN profiles p ON p.user_id = u.id
    WHERE u.id != $1
      AND u.is_active = true
      AND u.is_paused = false
      AND p.moderation_status = 'approved'
      AND NOT EXISTS (
        SELECT 1 FROM blocks b
        WHERE (b.blocker_id = $1 AND b.blocked_id = u.id)
           OR (b.blocker_id = u.id AND b.blocked_id = $1)
      )
      AND NOT EXISTS (
        SELECT 1 FROM user_risk_scores rs
        WHERE rs.user_id = u.id AND (rs.is_shadow_banned = true OR rs.is_suspended = true)
      )
    ORDER BY RANDOM()
    LIMIT $2`,
    [userId, limit]
  );

  return result.rows.map((row) => ({
    userId: row.user_id,
    username: row.username,
    age: row.birth_year ? new Date().getFullYear() - row.birth_year : undefined,
    location: {
      city: row.location_city,
      country: row.location_country,
    },
    currentLifePreview: row.current_life.slice(0, 200) + (row.current_life.length > 200 ? '...' : ''),
    lookingFor: row.looking_for,
    intentions: row.intentions,
    matchedIntentions: (row.intentions as string[]).filter((i: string) =>
      (currentUser.intentions as string[]).includes(i)
    ) as Intention[],
    themes: row.extracted_themes,
    openToRemote: row.open_to_remote,
    mainPhotoUrl: row.main_photo_url,
    isLocal:
      row.location_city === currentUser.location_city &&
      row.location_country === currentUser.location_country,
    isSameCountry: row.location_country === currentUser.location_country,
    lastActiveCategory: getLastActiveCategory(new Date(row.last_active_at)),
  }));
}
