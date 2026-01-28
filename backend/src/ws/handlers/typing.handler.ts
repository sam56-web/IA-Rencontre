import { WebSocket } from 'ws';
import { getConversationById } from '../../services/conversation.service.js';
import { sendError, sendToUser } from '../server.js';

interface AuthenticatedWebSocket extends WebSocket {
  userId: string;
}

interface TypingPayload {
  conversationId: string;
  isTyping: boolean;
}

// Track typing status with timeout
const typingUsers = new Map<string, NodeJS.Timeout>();

export async function handleTyping(
  ws: AuthenticatedWebSocket,
  payload: TypingPayload
): Promise<void> {
  try {
    const { conversationId, isTyping } = payload;

    // Get conversation to find recipient
    const conversation = await getConversationById(conversationId, ws.userId);
    if (!conversation) {
      sendError(ws, 'CONVERSATION_NOT_FOUND', 'Conversation not found');
      return;
    }

    const typingKey = `${conversationId}:${ws.userId}`;

    // Clear existing timeout
    const existingTimeout = typingUsers.get(typingKey);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      typingUsers.delete(typingKey);
    }

    // If typing, set timeout to auto-stop
    if (isTyping) {
      const timeout = setTimeout(() => {
        typingUsers.delete(typingKey);
        sendToUser(conversation.otherUser.id, {
          type: 'typing_update',
          payload: {
            conversationId,
            userId: ws.userId,
            isTyping: false,
          },
          timestamp: new Date().toISOString(),
        });
      }, 5000); // Auto-stop typing after 5 seconds

      typingUsers.set(typingKey, timeout);
    }

    // Send typing update to recipient
    sendToUser(conversation.otherUser.id, {
      type: 'typing_update',
      payload: {
        conversationId,
        userId: ws.userId,
        isTyping,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error handling typing:', error);
  }
}

export function clearTypingForUser(userId: string): void {
  for (const [key, timeout] of typingUsers.entries()) {
    if (key.endsWith(`:${userId}`)) {
      clearTimeout(timeout);
      typingUsers.delete(key);
    }
  }
}
