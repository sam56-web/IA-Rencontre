import { query } from '../db/pool.js';
import redis from '../config/redis.js';
import type { GlobeConnection, GlobeData, GlobeStats, GlobeUser, GlobeMetrics } from '../types/globe.js';

// Couleurs par thème/intention
const THEME_COLORS: Record<string, string> = {
  // Par thème
  voyage: '#00CED1',
  travel: '#00CED1',
  art: '#9370DB',
  musique: '#FF69B4',
  music: '#FF69B4',
  litterature: '#FF8C00',
  lecture: '#FF8C00',
  sport: '#32CD32',
  nature: '#228B22',
  cuisine: '#FF6347',
  science: '#1E90FF',
  tech: '#1E90FF',
  politique: '#FFD700',
  philosophie: '#DDA0DD',
  cinema: '#E066FF',
  photo: '#87CEEB',
  ecologie: '#228B22',
  jeux: '#FF4500',
  spiritualite: '#DDA0DD',

  // Par intention
  romance: '#FF6B6B',
  romantic: '#FF6B6B',
  amitie: '#4CAF50',
  friendship: '#4CAF50',
  discussions: '#FFD700',
  projet: '#9370DB',
  project: '#9370DB',
  creative_project: '#9370DB',
  travel_experiences: '#00CED1',

  default: '#FFFFFF'
};

// Métriques
class GlobeMonitor {
  private metrics: GlobeMetrics = {
    requestCount: 0,
    averageResponseTime: 0,
    cacheHitRate: 0,
    clusteredRequests: 0,
    errors: 0
  };

  private cacheHits = 0;
  private cacheMisses = 0;
  private responseTimes: number[] = [];

  recordRequest(duration: number) {
    this.metrics.requestCount++;
    this.responseTimes.push(duration);

    if (this.responseTimes.length > 100) {
      this.responseTimes.shift();
    }

    this.metrics.averageResponseTime =
      this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length;

    const totalCache = this.cacheHits + this.cacheMisses;
    this.metrics.cacheHitRate = totalCache > 0 ?
      (this.cacheHits / totalCache) * 100 : 0;
  }

  recordCacheHit() { this.cacheHits++; }
  recordCacheMiss() { this.cacheMisses++; }
  recordClusteredRequest() { this.metrics.clusteredRequests++; }
  recordError() { this.metrics.errors++; }

  getMetrics(): GlobeMetrics { return { ...this.metrics }; }
}

export const globeMonitor = new GlobeMonitor();

// Calculer la distance entre deux points (formule Haversine)
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Obtenir la couleur du thème principal
export function getThemeColor(themes: string[], intentions: string[]): string {
  for (const theme of themes || []) {
    const normalizedTheme = theme.toLowerCase();
    if (THEME_COLORS[normalizedTheme]) {
      return THEME_COLORS[normalizedTheme];
    }
  }

  for (const intention of intentions || []) {
    const normalizedIntention = intention.toLowerCase();
    if (THEME_COLORS[normalizedIntention]) {
      return THEME_COLORS[normalizedIntention];
    }
  }

  return THEME_COLORS.default;
}

// Service principal
export async function getGlobeConnections(userId: string): Promise<GlobeData> {
  const startTime = Date.now();

  try {
    // Vérifier le cache Redis
    const cacheKey = `globe:${userId}`;
    let cached: string | null = null;

    try {
      cached = await redis.get(cacheKey);
    } catch (redisError) {
      console.warn('Redis cache read failed:', redisError);
    }

    if (cached) {
      globeMonitor.recordCacheHit();
      globeMonitor.recordRequest(Date.now() - startTime);
      return JSON.parse(cached);
    }

    globeMonitor.recordCacheMiss();

    // Récupérer les données de l'utilisateur connecté
    const userResult = await query(`
      SELECT
        u.id,
        u.email,
        u.username,
        u.approximate_latitude as lat,
        u.approximate_longitude as lon,
        u.location_city,
        u.location_country,
        u.intentions,
        p.extracted_themes as themes
      FROM users u
      LEFT JOIN profiles p ON u.id = p.user_id
      WHERE u.id = $1
    `, [userId]);

    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }

    const user = userResult.rows[0];
    const userLat = parseFloat(user.lat) || 48.8566;
    const userLon = parseFloat(user.lon) || 2.3522;
    const userThemes = user.themes || [];
    const userIntentions = user.intentions || [];

    // Récupérer tous les autres utilisateurs avec coordonnées
    const connectionsResult = await query(`
      SELECT
        u.id,
        u.email,
        u.username,
        u.approximate_latitude as latitude,
        u.approximate_longitude as longitude,
        u.intentions,
        u.location_city,
        u.is_online,
        u.last_active_at,
        p.extracted_themes as themes,
        COALESCE((
          SELECT COUNT(*)
          FROM messages m
          JOIN conversations c ON m.conversation_id = c.id
          WHERE ((c.user1_id = $1 AND c.user2_id = u.id) OR (c.user1_id = u.id AND c.user2_id = $1))
            AND m.sender_id = u.id
            AND m.read_at IS NULL
        ), 0) as unread_messages,
        COALESCE((
          SELECT COUNT(DISTINCT CASE WHEN c.user1_id = u.id THEN c.user2_id ELSE c.user1_id END)
          FROM conversations c
          WHERE (c.user1_id = u.id OR c.user2_id = u.id)
        ), 0) as total_connections
      FROM users u
      LEFT JOIN profiles p ON u.id = p.user_id
      WHERE u.id != $1
        AND u.is_paused = false
        AND u.is_active = true
        AND u.approximate_latitude IS NOT NULL
        AND u.approximate_longitude IS NOT NULL
      ORDER BY u.last_active_at DESC
      LIMIT 100
    `, [userId]);

    // Transformer les résultats
    const connections: GlobeConnection[] = connectionsResult.rows.map(row => {
      const themes = row.themes || [];
      const intentions = row.intentions || [];

      const commonThemes = userThemes.filter((t: string) => themes.includes(t));
      const commonIntentions = userIntentions.filter((i: string) => intentions.includes(i));

      const distance = calculateDistance(userLat, userLon, parseFloat(row.latitude), parseFloat(row.longitude));

      // Calculate intensity score
      const hasConversation = parseInt(row.unread_messages) > 0 || parseInt(row.total_connections) > 0;
      const hasCommon = commonThemes.length > 0 || commonIntentions.length > 0;
      const intensityScore = Math.min(100, Math.max(10,
        (hasConversation ? 40 : 0) +
        (hasCommon ? 30 : 0) +
        (commonThemes.length * 10) +
        (commonIntentions.length * 10)
      ));

      return {
        id: row.id,
        username: row.username || row.email.split('@')[0],
        displayName: row.username || row.email.split('@')[0],
        latitude: parseFloat(row.latitude),
        longitude: parseFloat(row.longitude),
        themes,
        intentions,
        themeColor: getThemeColor(themes, intentions),
        unreadMessages: parseInt(row.unread_messages) || 0,
        totalConnections: parseInt(row.total_connections) || 0,
        isOnline: row.is_online || false,
        lastActive: row.last_active_at,
        connectionIntensity: intensityScore,
        commonThemes,
        commonIntentions,
        distanceFromUser: Math.round(distance)
      };
    });

    // Calculer les stats
    const stats: GlobeStats = {
      total: connections.length,
      online: connections.filter(c => c.isOnline).length,
      withUnread: connections.filter(c => c.unreadMessages > 0).length,
      local: connections.filter(c => (c.distanceFromUser || 0) < 200).length
    };

    const globeUser: GlobeUser = {
      id: user.id,
      username: user.username || user.email.split('@')[0],
      latitude: userLat,
      longitude: userLon,
      city: user.location_city,
      country: user.location_country
    };

    const result: GlobeData = {
      user: globeUser,
      connections,
      stats
    };

    // Mettre en cache (5 minutes)
    try {
      await redis.setEx(cacheKey, 300, JSON.stringify(result));
    } catch (redisError) {
      console.warn('Redis cache write failed:', redisError);
    }

    globeMonitor.recordRequest(Date.now() - startTime);
    return result;

  } catch (error) {
    globeMonitor.recordError();
    throw error;
  }
}

// Clustering des connexions
export async function getClusteredConnections(
  userId: string,
  maxDistance: number = 500
): Promise<{ connections: GlobeConnection[]; originalCount: number; clusteredCount: number }> {
  globeMonitor.recordClusteredRequest();

  const data = await getGlobeConnections(userId);
  const connections = data.connections;

  if (connections.length <= 30) {
    return {
      connections,
      originalCount: connections.length,
      clusteredCount: connections.length
    };
  }

  // Algorithme de clustering par densité
  const clusters: GlobeConnection[][] = [];
  const visited = new Set<string>();

  for (const conn of connections) {
    if (visited.has(conn.id)) continue;

    const cluster: GlobeConnection[] = [conn];
    visited.add(conn.id);

    for (const other of connections) {
      if (visited.has(other.id)) continue;

      const distance = calculateDistance(
        conn.latitude, conn.longitude,
        other.latitude, other.longitude
      );

      if (distance <= maxDistance) {
        cluster.push(other);
        visited.add(other.id);
      }
    }

    clusters.push(cluster);
  }

  // Pour chaque cluster, prendre le plus représentatif
  const result: GlobeConnection[] = clusters.map(cluster => {
    if (cluster.length === 1) return cluster[0];

    // Prendre celui avec le plus haut score d'intensité
    return cluster.reduce((best, current) => {
      const scoreBest = best.connectionIntensity + (best.unreadMessages * 20) + (best.isOnline ? 10 : 0);
      const scoreCurrent = current.connectionIntensity + (current.unreadMessages * 20) + (current.isOnline ? 10 : 0);
      return scoreCurrent > scoreBest ? current : best;
    });
  });

  return {
    connections: result.slice(0, 50),
    originalCount: connections.length,
    clusteredCount: result.length
  };
}

// Stats de zone
export async function getZoneStats(userId: string): Promise<{
  total_nearby: number;
  within_50km: number;
  within_200km: number;
  within_500km: number;
}> {
  const result = await query(`
    WITH user_location AS (
      SELECT approximate_latitude, approximate_longitude
      FROM users WHERE id = $1
    ),
    nearby_profiles AS (
      SELECT
        u.id,
        6371 * acos(
          LEAST(1.0, GREATEST(-1.0,
            cos(radians(ul.approximate_latitude)) *
            cos(radians(u.approximate_latitude)) *
            cos(radians(u.approximate_longitude) - radians(ul.approximate_longitude)) +
            sin(radians(ul.approximate_latitude)) *
            sin(radians(u.approximate_latitude))
          ))
        ) as distance_km
      FROM users u, user_location ul
      WHERE u.id != $1
        AND u.approximate_latitude IS NOT NULL
        AND u.approximate_longitude IS NOT NULL
        AND u.is_active = true
        AND u.is_paused = false
    )
    SELECT
      COUNT(*) as total_nearby,
      COUNT(*) FILTER (WHERE distance_km < 50) as within_50km,
      COUNT(*) FILTER (WHERE distance_km < 200) as within_200km,
      COUNT(*) FILTER (WHERE distance_km < 500) as within_500km
    FROM nearby_profiles
  `, [userId]);

  return result.rows[0];
}

// Rafraîchir le cache
export async function refreshCache(userId: string): Promise<GlobeData> {
  const cacheKey = `globe:${userId}`;
  try {
    await redis.del(cacheKey);
  } catch (redisError) {
    console.warn('Redis cache delete failed:', redisError);
  }
  return getGlobeConnections(userId);
}

export default {
  getGlobeConnections,
  getClusteredConnections,
  getZoneStats,
  refreshCache,
  calculateDistance,
  getThemeColor,
  globeMonitor
};
