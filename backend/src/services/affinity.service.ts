import pool from '../db/pool.js';

export interface AffinityScore {
  userId: string;
  score: number;
  breakdown: {
    themes: number;
    intentions: number;
    keywords: number;
    location: number;
    activity: number;
  };
}

export interface UserAffinityProfile {
  id: string;
  username: string;
  avatarUrl: string | null;
  bio: string | null;
  city: string | null;
  themes: string[];
  intentions: string[];
  lastActive: Date | null;
}

// Weights for each affinity component (total = 100)
const WEIGHTS = {
  themes: 35,      // Shared themes
  intentions: 25,  // Compatible intentions
  keywords: 15,    // Bio keyword matching
  location: 15,    // Geographical proximity
  activity: 10,    // Recent activity bonus
};

export async function calculateAffinity(
  userId1: string,
  userId2: string
): Promise<AffinityScore> {
  // Get both users' profiles with their themes and intentions
  const result = await pool.query(
    `SELECT
       u.id,
       u.intentions,
       u.location_city as city,
       p.current_life as bio,
       u.last_active_at,
       ARRAY_AGG(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL) as themes
     FROM users u
     LEFT JOIN profiles p ON u.id = p.user_id
     LEFT JOIN user_themes ut ON u.id = ut.user_id
     LEFT JOIN themes t ON ut.theme_id = t.id
     WHERE u.id IN ($1, $2)
     GROUP BY u.id, u.intentions, u.location_city, p.current_life, u.last_active_at`,
    [userId1, userId2]
  );

  if (result.rows.length !== 2) {
    return {
      userId: userId2,
      score: 0,
      breakdown: { themes: 0, intentions: 0, keywords: 0, location: 0, activity: 0 },
    };
  }

  const user1 = result.rows.find((r) => r.id === userId1);
  const user2 = result.rows.find((r) => r.id === userId2);

  // Calculate each component
  const themesScore = calculateThemesScore(user1.themes || [], user2.themes || []);
  const intentionsScore = calculateIntentionsScore(user1.intentions || [], user2.intentions || []);
  const keywordsScore = calculateKeywordsScore(user1.bio || '', user2.bio || '');
  const locationScore = calculateLocationScore(
    user1.location_lat,
    user1.location_lng,
    user2.location_lat,
    user2.location_lng
  );
  const activityScore = calculateActivityScore(user2.last_active_at);

  // Calculate weighted total
  const totalScore = Math.round(
    themesScore * (WEIGHTS.themes / 100) +
    intentionsScore * (WEIGHTS.intentions / 100) +
    keywordsScore * (WEIGHTS.keywords / 100) +
    locationScore * (WEIGHTS.location / 100) +
    activityScore * (WEIGHTS.activity / 100)
  );

  return {
    userId: userId2,
    score: Math.min(100, Math.max(0, totalScore)),
    breakdown: {
      themes: Math.round(themesScore),
      intentions: Math.round(intentionsScore),
      keywords: Math.round(keywordsScore),
      location: Math.round(locationScore),
      activity: Math.round(activityScore),
    },
  };
}

function calculateThemesScore(themes1: string[], themes2: string[]): number {
  if (themes1.length === 0 || themes2.length === 0) return 0;

  const set1 = new Set(themes1.map((t) => t.toLowerCase()));
  const set2 = new Set(themes2.map((t) => t.toLowerCase()));

  let sharedCount = 0;
  set1.forEach((t) => {
    if (set2.has(t)) sharedCount++;
  });

  // Jaccard similarity * 100
  const union = new Set([...set1, ...set2]);
  return (sharedCount / union.size) * 100;
}

function calculateIntentionsScore(intentions1: string[], intentions2: string[]): number {
  if (intentions1.length === 0 || intentions2.length === 0) return 0;

  const set1 = new Set(intentions1.map((i) => i.toLowerCase()));
  const set2 = new Set(intentions2.map((i) => i.toLowerCase()));

  // Check for compatible intentions
  const compatibilityMatrix: Record<string, string[]> = {
    friendship: ['friendship', 'networking', 'activities'],
    relationship: ['relationship'],
    networking: ['networking', 'friendship', 'professional'],
    activities: ['activities', 'friendship', 'travel'],
    travel: ['travel', 'activities'],
    professional: ['professional', 'networking'],
  };

  let compatibleCount = 0;
  let totalChecks = 0;

  set1.forEach((i1) => {
    set2.forEach((i2) => {
      totalChecks++;
      const compatible = compatibilityMatrix[i1]?.includes(i2) || i1 === i2;
      if (compatible) compatibleCount++;
    });
  });

  return totalChecks > 0 ? (compatibleCount / totalChecks) * 100 : 0;
}

function calculateKeywordsScore(bio1: string, bio2: string): number {
  if (!bio1 || !bio2) return 0;

  // Extract meaningful keywords (skip common words)
  const stopWords = new Set([
    'je', 'suis', 'un', 'une', 'le', 'la', 'les', 'de', 'du', 'des', 'et', 'ou',
    'qui', 'que', 'quoi', 'avec', 'pour', 'dans', 'sur', 'par', 'est', 'sont',
    'ai', 'aime', 'adore', 'cherche', 'recherche', 'très', 'bien', 'plus',
    'i', 'am', 'a', 'the', 'and', 'or', 'with', 'for', 'in', 'on', 'is', 'are',
  ]);

  const extractKeywords = (text: string): Set<string> => {
    const words = text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 3 && !stopWords.has(w));
    return new Set(words);
  };

  const keywords1 = extractKeywords(bio1);
  const keywords2 = extractKeywords(bio2);

  if (keywords1.size === 0 || keywords2.size === 0) return 0;

  let sharedCount = 0;
  keywords1.forEach((k) => {
    if (keywords2.has(k)) sharedCount++;
  });

  const union = new Set([...keywords1, ...keywords2]);
  return (sharedCount / Math.min(keywords1.size, keywords2.size)) * 100;
}

function calculateLocationScore(
  lat1: number | null,
  lng1: number | null,
  lat2: number | null,
  lng2: number | null
): number {
  if (!lat1 || !lng1 || !lat2 || !lng2) return 50; // Default score if no location

  // Haversine formula for distance calculation
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  // Score decreases with distance
  // 0-10km: 100, 10-50km: 80-50, 50-100km: 50-20, >100km: <20
  if (distance < 10) return 100;
  if (distance < 50) return 100 - ((distance - 10) / 40) * 50;
  if (distance < 100) return 50 - ((distance - 50) / 50) * 30;
  if (distance < 200) return 20 - ((distance - 100) / 100) * 15;
  return 5;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

function calculateActivityScore(lastActive: Date | null): number {
  if (!lastActive) return 0;

  const now = new Date();
  const hoursSinceActive = (now.getTime() - new Date(lastActive).getTime()) / (1000 * 60 * 60);

  // Active in last hour: 100, last day: 80, last week: 50, last month: 20
  if (hoursSinceActive < 1) return 100;
  if (hoursSinceActive < 24) return 80;
  if (hoursSinceActive < 168) return 50; // 7 days
  if (hoursSinceActive < 720) return 20; // 30 days
  return 5;
}

export async function getTopAffinities(
  userId: string,
  limit: number = 20,
  offset: number = 0
): Promise<{ users: (UserAffinityProfile & { affinityScore: number })[]; total: number }> {
  // Get all potential matches (exclude self, blocked users, etc.)
  const candidatesResult = await pool.query(
    `SELECT u.id
     FROM users u
     LEFT JOIN profiles p ON u.id = p.user_id
     WHERE u.id != $1
       AND u.is_active = TRUE
       AND p.user_id IS NOT NULL
     ORDER BY u.last_active_at DESC NULLS LAST
     LIMIT 100`, // Limit candidates for performance
    [userId]
  );

  const candidateIds = candidatesResult.rows.map((r) => r.id);

  // Calculate affinity for each candidate
  const affinityPromises = candidateIds.map((candidateId) =>
    calculateAffinity(userId, candidateId)
  );
  const affinities = await Promise.all(affinityPromises);

  // Sort by score and paginate
  affinities.sort((a, b) => b.score - a.score);
  const paginatedAffinities = affinities.slice(offset, offset + limit);
  const topIds = paginatedAffinities.map((a) => a.userId);

  if (topIds.length === 0) {
    return { users: [], total: 0 };
  }

  // Fetch full profiles for top matches
  const profilesResult = await pool.query(
    `SELECT
       u.id,
       u.username,
       u.last_active_at,
       (SELECT url FROM photos WHERE user_id = u.id ORDER BY order_index LIMIT 1) as avatar_url,
       pr.current_life as bio,
       u.location_city as city,
       ARRAY_AGG(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL) as themes,
       u.intentions
     FROM users u
     LEFT JOIN profiles pr ON u.id = pr.user_id
     LEFT JOIN user_themes ut ON u.id = ut.user_id
     LEFT JOIN themes t ON ut.theme_id = t.id
     WHERE u.id = ANY($1)
     GROUP BY u.id, u.username, u.last_active_at, pr.current_life, u.location_city, u.intentions`,
    [topIds]
  );

  // Map profiles with affinity scores, maintaining order
  const profilesMap = new Map(profilesResult.rows.map((r) => [r.id, r]));
  const users = paginatedAffinities.map((affinity) => {
    const profile = profilesMap.get(affinity.userId);
    return {
      id: profile.id,
      username: profile.username,
      avatarUrl: profile.avatar_url,
      bio: profile.bio,
      city: profile.city,
      themes: profile.themes || [],
      intentions: profile.intentions || [],
      lastActive: profile.last_active_at,
      affinityScore: affinity.score,
    };
  });

  return { users, total: affinities.length };
}

export async function recordProfileView(
  viewerId: string,
  viewedId: string
): Promise<void> {
  if (viewerId === viewedId) return;

  await pool.query(
    `INSERT INTO profile_views (viewer_id, viewed_id)
     VALUES ($1, $2)
     ON CONFLICT (viewer_id, viewed_id)
     DO UPDATE SET created_at = NOW()`,
    [viewerId, viewedId]
  );
}

export async function getProfileViewers(
  userId: string,
  limit: number = 20,
  offset: number = 0
): Promise<{ viewers: UserAffinityProfile[]; total: number }> {
  const [viewersResult, countResult] = await Promise.all([
    pool.query(
      `SELECT
         u.id,
         u.username,
         u.last_active_at,
         (SELECT url FROM photos WHERE user_id = u.id ORDER BY order_index LIMIT 1) as avatar_url,
         pr.current_life as bio,
         u.location_city as city,
         pv.created_at as viewed_at,
         ARRAY_AGG(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL) as themes,
         u.intentions
       FROM profile_views pv
       JOIN users u ON pv.viewer_id = u.id
       LEFT JOIN profiles pr ON u.id = pr.user_id
       LEFT JOIN user_themes ut ON u.id = ut.user_id
       LEFT JOIN themes t ON ut.theme_id = t.id
       WHERE pv.viewed_id = $1
       GROUP BY u.id, u.username, u.last_active_at, pr.current_life, u.location_city, u.intentions, pv.created_at
       ORDER BY pv.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    ),
    pool.query(
      `SELECT COUNT(*) FROM profile_views WHERE viewed_id = $1`,
      [userId]
    ),
  ]);

  const viewers = viewersResult.rows.map((r) => ({
    id: r.id,
    username: r.username,
    avatarUrl: r.avatar_url,
    bio: r.bio,
    city: r.city,
    themes: r.themes || [],
    intentions: r.intentions || [],
    lastActive: r.last_active_at,
  }));

  return {
    viewers,
    total: parseInt(countResult.rows[0].count, 10),
  };
}
