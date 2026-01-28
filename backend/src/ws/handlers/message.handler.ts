import { WebSocket } from 'ws';
import { sendMessage, getMessageById } from '../../services/message.service.js';
import { getConversationById } from '../../services/conversation.service.js';
import { analyzeContent, updateRiskScore, checkAndApplyActions } from '../../services/moderation.service.js';
import { send, sendError, sendToUser } from '../server.js';
import type { Message } from '../../types/index.js';

interface AuthenticatedWebSocket extends WebSocket {
  userId: string;
}

interface SendMessagePayload {
  conversationId: string;
  content: string;
  quotedProfileText?: string;
  tempId: string;
}

export async function handleMessage(
  ws: AuthenticatedWebSocket,
  payload: SendMessagePayload
): Promise<void> {
  try {
    const { conversationId, content, quotedProfileText, tempId } = payload;

    // Validate content
    if (!content || content.trim().length === 0) {
      sendError(ws, 'EMPTY_MESSAGE', 'Message cannot be empty');
      return;
    }

    if (content.length > 5000) {
      sendError(ws, 'MESSAGE_TOO_LONG', 'Message exceeds 5000 characters');
      return;
    }

    // Get conversation to find recipient
    const conversation = await getConversationById(conversationId, ws.userId);
    if (!conversation) {
      sendError(ws, 'CONVERSATION_NOT_FOUND', 'Conversation not found');
      return;
    }

    // Analyze content for moderation
    const analysis = analyzeContent(content);

    // If high risk score, don't send but pretend we did (shadow moderation)
    if (analysis.totalScore >= 60) {
      // Update user's risk score
      await updateRiskScore(ws.userId, analysis);
      await checkAndApplyActions(ws.userId);

      // Send fake confirmation to sender
      const fakeMessage: Message = {
        id: tempId,
        conversationId,
        senderId: ws.userId,
        content,
        quotedProfileText,
        isRead: false,
        moderationStatus: 'flagged',
        createdAt: new Date(),
      };

      send(ws, {
        type: 'message_sent',
        payload: { tempId, message: fakeMessage },
        timestamp: new Date().toISOString(),
      });

      return;
    }

    // Update risk score even for lower scores
    if (analysis.totalScore > 0) {
      await updateRiskScore(ws.userId, analysis);
    }

    // Send the message
    const message = await sendMessage(conversationId, ws.userId, {
      content,
      quotedProfileText,
    });

    // Send confirmation to sender
    send(ws, {
      type: 'message_sent',
      payload: { tempId, message },
      timestamp: new Date().toISOString(),
    });

    // Send to recipient
    const recipientId = conversation.otherUser.id;
    sendToUser(recipientId, {
      type: 'message_new',
      payload: { conversationId, message },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error handling message:', error);
    sendError(ws, 'SEND_FAILED', 'Failed to send message');
  }
}
