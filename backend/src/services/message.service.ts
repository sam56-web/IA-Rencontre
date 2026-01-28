import { query } from '../db/pool.js';
import type { Message, PaginatedResponse } from '../types/index.js';
import type { SendMessageInput } from '../utils/validators.js';
import { isUserBlocked } from './user.service.js';

export async function getMessages(
  conversationId: string,
  userId: string,
  page: number = 1,
  limit: number = 50
): Promise<PaginatedResponse<Message>> {
  // Verify user has access to conversation
  const accessResult = await query(
    'SELECT 1 FROM conversations WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)',
    [conversationId, userId]
  );

  if (accessResult.rows.length === 0) {
    throw new MessageError('ACCESS_DENIED', 'You do not have access to this conversation');
  }

  const offset = (page - 1) * limit;

  // Get total count
  const countResult = await query(
    'SELECT COUNT(*) FROM messages WHERE conversation_id = $1',
    [conversationId]
  );
  const total = parseInt(countResult.rows[0].count, 10);

  // Get messages (newest first for chat, then reverse for display)
  const result = await query(
    `SELECT * FROM messages
     WHERE conversation_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [conversationId, limit, offset]
  );

  const messages = result.rows.map(mapDbRowToMessage).reverse();

  return {
    items: messages,
    total,
    page,
    limit,
    hasMore: offset + messages.length < total,
  };
}

export async function sendMessage(
  conversationId: string,
  userId: string,
  input: SendMessageInput
): Promise<Message> {
  // Get conversation and verify access
  const convResult = await query(
    `SELECT user1_id, user2_id, status FROM conversations
     WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)`,
    [conversationId, userId]
  );

  if (convResult.rows.length === 0) {
    throw new MessageError('ACCESS_DENIED', 'You do not have access to this conversation');
  }

  const conv = convResult.rows[0];

  if (conv.status !== 'active') {
    throw new MessageError('CONVERSATION_INACTIVE', 'This conversation is no longer active');
  }

  // Check if blocked
  const otherUserId = conv.user1_id === userId ? conv.user2_id : conv.user1_id;
  const blocked = await isUserBlocked(userId, otherUserId);
  if (blocked) {
    throw new MessageError('BLOCKED', 'Cannot send messages to this user');
  }

  // Insert message
  const result = await query(
    `INSERT INTO messages (conversation_id, sender_id, content, quoted_profile_text, moderation_status)
     VALUES ($1, $2, $3, $4, 'approved')
     RETURNING *`,
    [conversationId, userId, input.content, input.quotedProfileText || null]
  );

  return mapDbRowToMessage(result.rows[0]);
}

export async function markMessagesAsRead(
  conversationId: string,
  userId: string,
  messageIds?: string[]
): Promise<number> {
  // Verify access
  const accessResult = await query(
    'SELECT 1 FROM conversations WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)',
    [conversationId, userId]
  );

  if (accessResult.rows.length === 0) {
    throw new MessageError('ACCESS_DENIED', 'You do not have access to this conversation');
  }

  let result;

  if (messageIds && messageIds.length > 0) {
    // Mark specific messages as read
    result = await query(
      `UPDATE messages
       SET is_read = true, read_at = NOW()
       WHERE conversation_id = $1
         AND sender_id != $2
         AND id = ANY($3)
         AND is_read = false`,
      [conversationId, userId, messageIds]
    );
  } else {
    // Mark all unread messages as read
    result = await query(
      `UPDATE messages
       SET is_read = true, read_at = NOW()
       WHERE conversation_id = $1
         AND sender_id != $2
         AND is_read = false`,
      [conversationId, userId]
    );
  }

  return result.rowCount || 0;
}

export async function getUnreadCount(userId: string): Promise<number> {
  const result = await query(
    `SELECT COUNT(*)::int FROM messages m
     JOIN conversations c ON c.id = m.conversation_id
     WHERE (c.user1_id = $1 OR c.user2_id = $1)
       AND m.sender_id != $1
       AND m.is_read = false
       AND c.status = 'active'`,
    [userId]
  );

  return result.rows[0].count;
}

export async function getMessageById(messageId: string): Promise<Message | null> {
  const result = await query('SELECT * FROM messages WHERE id = $1', [messageId]);

  if (result.rows.length === 0) {
    return null;
  }

  return mapDbRowToMessage(result.rows[0]);
}

function mapDbRowToMessage(row: Record<string, unknown>): Message {
  return {
    id: row.id as string,
    conversationId: row.conversation_id as string,
    senderId: row.sender_id as string,
    content: row.content as string,
    quotedProfileText: row.quoted_profile_text as string | undefined,
    isRead: row.is_read as boolean,
    readAt: row.read_at ? new Date(row.read_at as string) : undefined,
    moderationStatus: row.moderation_status as Message['moderationStatus'],
    createdAt: new Date(row.created_at as string),
  };
}

export class MessageError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'MessageError';
  }
}

export { mapDbRowToMessage };
