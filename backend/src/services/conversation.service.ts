import { query, transaction } from '../db/pool.js';
import type { Conversation, ConversationView, ConversationDetail, Intention } from '../types/index.js';
import { getLastActiveCategory } from './profile.service.js';
import { useInitiative, isUserBlocked } from './user.service.js';
import type { StartConversationInput } from '../utils/validators.js';

export async function getConversations(userId: string): Promise<ConversationView[]> {
  const result = await query(
    `SELECT
      c.id, c.user1_id, c.user2_id, c.initiated_by, c.initial_quoted_text,
      c.matched_intentions, c.status, c.created_at, c.last_message_at,
      CASE WHEN c.user1_id = $1 THEN c.user2_id ELSE c.user1_id END as other_user_id,
      (
        SELECT json_build_object(
          'id', u.id,
          'username', u.username,
          'last_active_at', u.last_active_at
        )
        FROM users u
        WHERE u.id = CASE WHEN c.user1_id = $1 THEN c.user2_id ELSE c.user1_id END
      ) as other_user,
      (
        SELECT url FROM photos p
        WHERE p.user_id = CASE WHEN c.user1_id = $1 THEN c.user2_id ELSE c.user1_id END
        ORDER BY p.order_index LIMIT 1
      ) as other_user_photo,
      (
        SELECT json_build_object(
          'content', m.content,
          'sender_id', m.sender_id,
          'created_at', m.created_at
        )
        FROM messages m
        WHERE m.conversation_id = c.id
        ORDER BY m.created_at DESC LIMIT 1
      ) as last_message,
      (
        SELECT COUNT(*)::int FROM messages m
        WHERE m.conversation_id = c.id AND m.sender_id != $1 AND m.is_read = false
      ) as unread_count
    FROM conversations c
    WHERE (c.user1_id = $1 OR c.user2_id = $1)
      AND c.status = 'active'
    ORDER BY c.last_message_at DESC`,
    [userId]
  );

  return result.rows.map((row) => {
    const otherUser = row.other_user as { id: string; username: string; last_active_at: string };
    const lastMessage = row.last_message as { content: string; sender_id: string; created_at: string } | null;

    return {
      id: row.id,
      otherUser: {
        id: otherUser.id,
        username: otherUser.username,
        mainPhotoUrl: row.other_user_photo,
        lastActiveCategory: getLastActiveCategory(new Date(otherUser.last_active_at)),
      },
      matchedIntentions: row.matched_intentions as Intention[],
      lastMessage: lastMessage
        ? {
            content: lastMessage.content.slice(0, 100),
            sentByMe: lastMessage.sender_id === userId,
            createdAt: new Date(lastMessage.created_at),
          }
        : undefined,
      unreadCount: row.unread_count,
      status: row.status,
      createdAt: new Date(row.created_at),
    };
  });
}

export async function getConversationById(
  conversationId: string,
  userId: string
): Promise<ConversationDetail | null> {
  const result = await query(
    `SELECT
      c.id, c.user1_id, c.user2_id, c.initiated_by, c.initial_quoted_text,
      c.matched_intentions, c.status, c.created_at, c.last_message_at,
      (
        SELECT json_build_object(
          'id', u.id,
          'username', u.username,
          'last_active_at', u.last_active_at
        )
        FROM users u
        WHERE u.id = CASE WHEN c.user1_id = $2 THEN c.user2_id ELSE c.user1_id END
      ) as other_user,
      (
        SELECT url FROM photos p
        WHERE p.user_id = CASE WHEN c.user1_id = $2 THEN c.user2_id ELSE c.user1_id END
        ORDER BY p.order_index LIMIT 1
      ) as other_user_photo,
      (
        SELECT COUNT(*)::int FROM messages m WHERE m.conversation_id = c.id
      ) as message_count,
      (
        SELECT COUNT(*)::int FROM messages m
        WHERE m.conversation_id = c.id AND m.sender_id != $2 AND m.is_read = false
      ) as unread_count
    FROM conversations c
    WHERE c.id = $1 AND (c.user1_id = $2 OR c.user2_id = $2)`,
    [conversationId, userId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  const otherUser = row.other_user as { id: string; username: string; last_active_at: string };

  return {
    id: row.id,
    otherUser: {
      id: otherUser.id,
      username: otherUser.username,
      mainPhotoUrl: row.other_user_photo,
      lastActiveCategory: getLastActiveCategory(new Date(otherUser.last_active_at)),
    },
    matchedIntentions: row.matched_intentions as Intention[],
    lastMessage: undefined, // Could fetch if needed
    unreadCount: row.unread_count,
    status: row.status,
    createdAt: new Date(row.created_at),
    initialQuotedText: row.initial_quoted_text,
    messageCount: row.message_count,
  };
}

export async function startConversation(
  userId: string,
  input: StartConversationInput
): Promise<{ conversation: ConversationDetail; messageId: string }> {
  // Check if blocked
  const blocked = await isUserBlocked(userId, input.recipientId);
  if (blocked) {
    throw new ConversationError('BLOCKED', 'Cannot start conversation with this user');
  }

  // Check if recipient exists and is active
  const recipientResult = await query(
    'SELECT id, intentions FROM users WHERE id = $1 AND is_active = true AND is_paused = false',
    [input.recipientId]
  );
  if (recipientResult.rows.length === 0) {
    throw new ConversationError('RECIPIENT_NOT_FOUND', 'Recipient not found or not available');
  }

  // Check if conversation already exists
  const [user1Id, user2Id] = [userId, input.recipientId].sort();
  const existingResult = await query(
    'SELECT id FROM conversations WHERE user1_id = $1 AND user2_id = $2',
    [user1Id, user2Id]
  );

  if (existingResult.rows.length > 0) {
    throw new ConversationError('CONVERSATION_EXISTS', 'A conversation already exists with this user');
  }

  // Check quota (uses initiative)
  const canInitiate = await useInitiative(userId);
  if (!canInitiate) {
    throw new ConversationError('QUOTA_EXCEEDED', 'You have reached your weekly conversation limit');
  }

  // Get matched intentions
  const currentUserResult = await query('SELECT intentions FROM users WHERE id = $1', [userId]);
  const currentIntentions = currentUserResult.rows[0].intentions as string[];
  const recipientIntentions = recipientResult.rows[0].intentions as string[];
  const matchedIntentions = currentIntentions.filter((i) => recipientIntentions.includes(i));

  // Create conversation and first message in transaction
  const result = await transaction(async (client) => {
    // Create conversation
    const convResult = await client.query(
      `INSERT INTO conversations (
        user1_id, user2_id, initiated_by, initial_quoted_text, matched_intentions
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [user1Id, user2Id, userId, input.quotedProfileText || null, matchedIntentions]
    );

    const conversationId = convResult.rows[0].id;

    // Create first message
    const msgResult = await client.query(
      `INSERT INTO messages (conversation_id, sender_id, content, quoted_profile_text, moderation_status)
       VALUES ($1, $2, $3, $4, 'approved')
       RETURNING id`,
      [conversationId, userId, input.content, input.quotedProfileText || null]
    );

    return {
      conversationId,
      messageId: msgResult.rows[0].id,
    };
  });

  // Fetch the created conversation
  const conversation = await getConversationById(result.conversationId, userId);
  if (!conversation) {
    throw new Error('Failed to create conversation');
  }

  return {
    conversation,
    messageId: result.messageId,
  };
}

export async function archiveConversation(conversationId: string, userId: string): Promise<void> {
  const result = await query(
    `UPDATE conversations SET status = 'archived'
     WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)`,
    [conversationId, userId]
  );

  if (result.rowCount === 0) {
    throw new ConversationError('NOT_FOUND', 'Conversation not found');
  }
}

export async function findExistingConversation(
  userId1: string,
  userId2: string
): Promise<string | null> {
  const [user1Id, user2Id] = [userId1, userId2].sort();
  const result = await query(
    'SELECT id FROM conversations WHERE user1_id = $1 AND user2_id = $2',
    [user1Id, user2Id]
  );

  return result.rows.length > 0 ? result.rows[0].id : null;
}

export class ConversationError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'ConversationError';
  }
}
