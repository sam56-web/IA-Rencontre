import { query } from '../../db/pool.js';
import { sendToUser, isUserConnected } from '../server.js';
import { clearTypingForUser } from './typing.handler.js';

// Track online users and their conversations for presence updates
const userConversations = new Map<string, Set<string>>();

export async function setUserOnline(userId: string): Promise<void> {
  // Update last active
  await query('UPDATE users SET last_active_at = NOW() WHERE id = $1', [userId]);

  // Get user's active conversations
  const result = await query(
    `SELECT id,
      CASE WHEN user1_id = $1 THEN user2_id ELSE user1_id END as other_user_id
     FROM conversations
     WHERE (user1_id = $1 OR user2_id = $1) AND status = 'active'`,
    [userId]
  );

  const otherUserIds = new Set<string>();
  result.rows.forEach((row) => {
    otherUserIds.add(row.other_user_id);
  });

  userConversations.set(userId, otherUserIds);

  // Notify other users about presence
  otherUserIds.forEach((otherUserId) => {
    if (isUserConnected(otherUserId)) {
      sendToUser(otherUserId, {
        type: 'presence_update',
        payload: {
          userId,
          isOnline: true,
        },
        timestamp: new Date().toISOString(),
      });
    }
  });
}

export async function setUserOffline(userId: string): Promise<void> {
  // Clear typing indicators
  clearTypingForUser(userId);

  // Update last active
  const now = new Date();
  await query('UPDATE users SET last_active_at = $1 WHERE id = $2', [now, userId]);

  // Notify other users about presence
  const otherUserIds = userConversations.get(userId);
  if (otherUserIds) {
    otherUserIds.forEach((otherUserId) => {
      if (isUserConnected(otherUserId)) {
        sendToUser(otherUserId, {
          type: 'presence_update',
          payload: {
            userId,
            isOnline: false,
            lastSeenAt: now.toISOString(),
          },
          timestamp: new Date().toISOString(),
        });
      }
    });
  }

  userConversations.delete(userId);
}

export async function handlePresence(): Promise<void> {
  // This function can be used for periodic presence updates if needed
}

export function getUserConversationPartners(userId: string): Set<string> | undefined {
  return userConversations.get(userId);
}
