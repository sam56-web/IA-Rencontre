import pool from '../db/pool.js';

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown>;
  isRead: boolean;
  createdAt: Date;
}

export interface CreateNotificationData {
  userId: string;
  type: string;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
}

type NotificationType =
  | 'new_message'
  | 'new_match'
  | 'profile_view'
  | 'new_event'
  | 'event_reminder'
  | 'badge_earned'
  | 'group_invite'
  | 'group_message';

export async function createNotification(data: CreateNotificationData): Promise<Notification> {
  const result = await pool.query(
    `INSERT INTO notifications (user_id, type, title, body, data)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, user_id, type, title, body, data, is_read, created_at`,
    [data.userId, data.type, data.title, data.body || null, JSON.stringify(data.data || {})]
  );

  const row = result.rows[0];
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    body: row.body,
    data: row.data,
    isRead: row.is_read,
    createdAt: row.created_at,
  };
}

export async function getUserNotifications(
  userId: string,
  options: { limit?: number; offset?: number; unreadOnly?: boolean } = {}
): Promise<{ notifications: Notification[]; total: number; unreadCount: number }> {
  const { limit = 20, offset = 0, unreadOnly = false } = options;

  const whereClause = unreadOnly
    ? 'WHERE user_id = $1 AND is_read = FALSE'
    : 'WHERE user_id = $1';

  const [notificationsResult, countResult, unreadResult] = await Promise.all([
    pool.query(
      `SELECT id, user_id, type, title, body, data, is_read, created_at
       FROM notifications
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    ),
    pool.query(
      `SELECT COUNT(*) FROM notifications ${whereClause}`,
      [userId]
    ),
    pool.query(
      `SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = FALSE`,
      [userId]
    ),
  ]);

  const notifications = notificationsResult.rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    body: row.body,
    data: row.data,
    isRead: row.is_read,
    createdAt: row.created_at,
  }));

  return {
    notifications,
    total: parseInt(countResult.rows[0].count, 10),
    unreadCount: parseInt(unreadResult.rows[0].count, 10),
  };
}

export async function markAsRead(notificationId: string, userId: string): Promise<boolean> {
  const result = await pool.query(
    `UPDATE notifications SET is_read = TRUE
     WHERE id = $1 AND user_id = $2
     RETURNING id`,
    [notificationId, userId]
  );
  return result.rowCount > 0;
}

export async function markAllAsRead(userId: string): Promise<number> {
  const result = await pool.query(
    `UPDATE notifications SET is_read = TRUE
     WHERE user_id = $1 AND is_read = FALSE
     RETURNING id`,
    [userId]
  );
  return result.rowCount || 0;
}

export async function deleteNotification(notificationId: string, userId: string): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM notifications WHERE id = $1 AND user_id = $2 RETURNING id`,
    [notificationId, userId]
  );
  return result.rowCount > 0;
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const result = await pool.query(
    `SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = FALSE`,
    [userId]
  );
  return parseInt(result.rows[0].count, 10);
}

// Helper functions for creating specific notification types
export async function notifyNewMessage(
  userId: string,
  senderName: string,
  conversationId: string,
  messagePreview: string
): Promise<Notification> {
  return createNotification({
    userId,
    type: 'new_message',
    title: `Nouveau message de ${senderName}`,
    body: messagePreview.substring(0, 100),
    data: { conversationId, senderName },
  });
}

export async function notifyProfileView(
  userId: string,
  viewerName: string,
  viewerId: string
): Promise<Notification> {
  return createNotification({
    userId,
    type: 'profile_view',
    title: `${viewerName} a consulté votre profil`,
    data: { viewerId, viewerName },
  });
}

export async function notifyBadgeEarned(
  userId: string,
  badgeName: string,
  badgeId: string
): Promise<Notification> {
  return createNotification({
    userId,
    type: 'badge_earned',
    title: `Badge débloqué : ${badgeName}`,
    body: 'Félicitations ! Vous avez obtenu un nouveau badge.',
    data: { badgeId, badgeName },
  });
}

export async function notifyNewEvent(
  userId: string,
  eventTitle: string,
  eventId: string,
  groupName?: string
): Promise<Notification> {
  return createNotification({
    userId,
    type: 'new_event',
    title: `Nouvel événement : ${eventTitle}`,
    body: groupName ? `Dans le groupe ${groupName}` : undefined,
    data: { eventId, eventTitle, groupName },
  });
}

export async function notifyEventReminder(
  userId: string,
  eventTitle: string,
  eventId: string,
  startsAt: Date
): Promise<Notification> {
  const hoursUntil = Math.round((startsAt.getTime() - Date.now()) / (1000 * 60 * 60));
  return createNotification({
    userId,
    type: 'event_reminder',
    title: `Rappel : ${eventTitle}`,
    body: `L'événement commence dans ${hoursUntil}h`,
    data: { eventId, eventTitle, startsAt: startsAt.toISOString() },
  });
}

export async function notifyGroupInvite(
  userId: string,
  groupName: string,
  groupId: string,
  inviterName: string
): Promise<Notification> {
  return createNotification({
    userId,
    type: 'group_invite',
    title: `Invitation au groupe ${groupName}`,
    body: `${inviterName} vous invite à rejoindre le groupe`,
    data: { groupId, groupName, inviterName },
  });
}
