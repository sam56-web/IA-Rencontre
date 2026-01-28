import pool from '../db/pool.js';
import * as notificationService from './notification.service';

export interface Badge {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  criteria: Record<string, unknown>;
  createdAt: Date;
}

export interface UserBadge extends Badge {
  earnedAt: Date;
}

export async function getAllBadges(): Promise<Badge[]> {
  const result = await pool.query(
    `SELECT id, slug, name, description, icon, color, criteria, created_at
     FROM badge_definitions
     ORDER BY created_at ASC`
  );

  return result.rows.map(mapRowToBadge);
}

export async function getBadgeBySlug(slug: string): Promise<Badge | null> {
  const result = await pool.query(
    `SELECT id, slug, name, description, icon, color, criteria, created_at
     FROM badge_definitions
     WHERE slug = $1`,
    [slug]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return mapRowToBadge(result.rows[0]);
}

export async function getUserBadges(userId: string): Promise<UserBadge[]> {
  const result = await pool.query(
    `SELECT bd.id, bd.slug, bd.name, bd.description, bd.icon, bd.color, bd.criteria, bd.created_at, ub.earned_at
     FROM user_badges ub
     JOIN badge_definitions bd ON ub.badge_id = bd.id
     WHERE ub.user_id = $1
     ORDER BY ub.earned_at DESC`,
    [userId]
  );

  return result.rows.map((row) => ({
    ...mapRowToBadge(row),
    earnedAt: row.earned_at,
  }));
}

export async function awardBadge(
  userId: string,
  badgeSlug: string,
  sendNotification: boolean = true
): Promise<UserBadge | null> {
  // Get badge by slug
  const badge = await getBadgeBySlug(badgeSlug);
  if (!badge) {
    console.error(`Badge not found: ${badgeSlug}`);
    return null;
  }

  // Check if user already has this badge
  const existingResult = await pool.query(
    'SELECT 1 FROM user_badges WHERE user_id = $1 AND badge_id = $2',
    [userId, badge.id]
  );

  if (existingResult.rows.length > 0) {
    return null; // Already has badge
  }

  // Award badge
  const result = await pool.query(
    `INSERT INTO user_badges (user_id, badge_id)
     VALUES ($1, $2)
     RETURNING earned_at`,
    [userId, badge.id]
  );

  // Send notification
  if (sendNotification) {
    await notificationService.notifyBadgeEarned(userId, badge.name, badge.id);
  }

  return {
    ...badge,
    earnedAt: result.rows[0].earned_at,
  };
}

export async function revokeBadge(userId: string, badgeSlug: string): Promise<boolean> {
  const badge = await getBadgeBySlug(badgeSlug);
  if (!badge) {
    return false;
  }

  const result = await pool.query(
    'DELETE FROM user_badges WHERE user_id = $1 AND badge_id = $2 RETURNING user_id',
    [userId, badge.id]
  );

  return result.rowCount > 0;
}

// Check and award badges based on criteria
export async function checkAndAwardBadges(userId: string): Promise<UserBadge[]> {
  const awardedBadges: UserBadge[] = [];

  // Get user stats
  const stats = await getUserStats(userId);

  // Get all badges the user doesn't have
  const unownedBadgesResult = await pool.query(
    `SELECT bd.id, bd.slug, bd.name, bd.description, bd.icon, bd.color, bd.criteria
     FROM badge_definitions bd
     WHERE NOT EXISTS (
       SELECT 1 FROM user_badges ub WHERE ub.badge_id = bd.id AND ub.user_id = $1
     )`,
    [userId]
  );

  for (const row of unownedBadgesResult.rows) {
    const criteria = row.criteria as Record<string, unknown>;
    const qualified = checkBadgeCriteria(criteria, stats);

    if (qualified) {
      const badge = await awardBadge(userId, row.slug);
      if (badge) {
        awardedBadges.push(badge);
      }
    }
  }

  return awardedBadges;
}

interface UserStats {
  profileCompleteness: number;
  messagesSent: number;
  conversationsStarted: number;
  groupsJoined: number;
  groupsCreatedWith10Members: number;
  eventsCreated: number;
  activeConversations: number;
  themesSelected: number;
  userRank: number;
}

async function getUserStats(userId: string): Promise<UserStats> {
  const [
    profileResult,
    messagesResult,
    conversationsResult,
    groupsResult,
    groupsCreatedResult,
    eventsResult,
    activeConvsResult,
    themesResult,
    rankResult,
  ] = await Promise.all([
    // Profile completeness
    pool.query(
      `SELECT
         CASE WHEN p.bio IS NOT NULL AND p.bio != '' THEN 20 ELSE 0 END +
         CASE WHEN p.avatar_url IS NOT NULL THEN 20 ELSE 0 END +
         CASE WHEN p.city IS NOT NULL AND p.city != '' THEN 20 ELSE 0 END +
         CASE WHEN p.birth_date IS NOT NULL THEN 20 ELSE 0 END +
         CASE WHEN (SELECT COUNT(*) FROM user_themes WHERE user_id = $1) > 0 THEN 20 ELSE 0 END
         as completeness
       FROM profiles p WHERE p.user_id = $1`,
      [userId]
    ),
    // Messages sent
    pool.query(
      'SELECT COUNT(*) as count FROM messages WHERE sender_id = $1',
      [userId]
    ),
    // Conversations started (where user sent first message)
    pool.query(
      `SELECT COUNT(DISTINCT c.id) as count
       FROM conversations c
       JOIN messages m ON c.id = m.conversation_id
       WHERE m.sender_id = $1
       AND m.created_at = (SELECT MIN(created_at) FROM messages WHERE conversation_id = c.id)`,
      [userId]
    ),
    // Groups joined
    pool.query(
      'SELECT COUNT(*) as count FROM group_members WHERE user_id = $1',
      [userId]
    ),
    // Groups created with 10+ members
    pool.query(
      `SELECT COUNT(*) as count
       FROM groups g
       WHERE g.created_by = $1
       AND (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) >= 10`,
      [userId]
    ),
    // Events created
    pool.query(
      'SELECT COUNT(*) as count FROM events WHERE creator_id = $1',
      [userId]
    ),
    // Active conversations (messages in last 30 days)
    pool.query(
      `SELECT COUNT(DISTINCT c.id) as count
       FROM conversations c
       JOIN conversation_participants cp ON c.id = cp.conversation_id
       JOIN messages m ON c.id = m.conversation_id
       WHERE cp.user_id = $1
       AND m.created_at > NOW() - INTERVAL '30 days'`,
      [userId]
    ),
    // Themes selected
    pool.query(
      'SELECT COUNT(*) as count FROM user_themes WHERE user_id = $1',
      [userId]
    ),
    // User rank (order by creation date)
    pool.query(
      `SELECT COUNT(*) as rank
       FROM users
       WHERE created_at <= (SELECT created_at FROM users WHERE id = $1)`,
      [userId]
    ),
  ]);

  return {
    profileCompleteness: parseInt(profileResult.rows[0]?.completeness || '0', 10),
    messagesSent: parseInt(messagesResult.rows[0]?.count || '0', 10),
    conversationsStarted: parseInt(conversationsResult.rows[0]?.count || '0', 10),
    groupsJoined: parseInt(groupsResult.rows[0]?.count || '0', 10),
    groupsCreatedWith10Members: parseInt(groupsCreatedResult.rows[0]?.count || '0', 10),
    eventsCreated: parseInt(eventsResult.rows[0]?.count || '0', 10),
    activeConversations: parseInt(activeConvsResult.rows[0]?.count || '0', 10),
    themesSelected: parseInt(themesResult.rows[0]?.count || '0', 10),
    userRank: parseInt(rankResult.rows[0]?.rank || '999999', 10),
  };
}

function checkBadgeCriteria(
  criteria: Record<string, unknown>,
  stats: UserStats
): boolean {
  const type = criteria.type as string;
  const threshold = criteria.threshold as number;

  switch (type) {
    case 'profile_completeness':
      return stats.profileCompleteness >= threshold;

    case 'messages_sent':
      return stats.messagesSent >= threshold;

    case 'conversations_started':
      return stats.conversationsStarted >= threshold;

    case 'groups_joined':
      return stats.groupsJoined >= threshold;

    case 'group_members':
      return stats.groupsCreatedWith10Members >= 1;

    case 'events_created':
      return stats.eventsCreated >= threshold;

    case 'active_conversations':
      return stats.activeConversations >= threshold;

    case 'themes_selected':
      return stats.themesSelected >= threshold;

    case 'user_rank':
      return stats.userRank <= threshold;

    case 'manual_verification':
      // This badge is awarded manually by admins
      return false;

    default:
      return false;
  }
}

function mapRowToBadge(row: Record<string, unknown>): Badge {
  return {
    id: row.id as string,
    slug: row.slug as string,
    name: row.name as string,
    description: row.description as string | null,
    icon: row.icon as string | null,
    color: row.color as string | null,
    criteria: row.criteria as Record<string, unknown>,
    createdAt: row.created_at as Date,
  };
}
