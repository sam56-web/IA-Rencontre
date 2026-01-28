import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import { URL } from 'url';
import { verifyAccessToken } from '../utils/jwt.js';
import { getUserById } from '../services/auth.service.js';
import { getUserRiskScore } from '../services/moderation.service.js';
import type { WSMessage } from '../types/index.js';
import { handleMessage } from './handlers/message.handler.js';
import { handleTyping } from './handlers/typing.handler.js';
import { handlePresence, setUserOnline, setUserOffline } from './handlers/presence.handler.js';

interface AuthenticatedWebSocket extends WebSocket {
  userId: string;
  isAlive: boolean;
  groupRooms: Set<string>; // Group IDs the user has joined
}

// Store connected clients
const clients = new Map<string, Set<AuthenticatedWebSocket>>();

// Store group rooms - maps groupId to set of userIds
const groupRooms = new Map<string, Set<string>>();

export function createWebSocketServer(server: http.Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: '/ws' });

  // Heartbeat interval
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      const authWs = ws as AuthenticatedWebSocket;
      if (!authWs.isAlive) {
        authWs.terminate();
        return;
      }
      authWs.isAlive = false;
      authWs.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  wss.on('connection', async (ws: WebSocket, req: http.IncomingMessage) => {
    const authWs = ws as AuthenticatedWebSocket;
    authWs.isAlive = true;
    authWs.groupRooms = new Set();

    // Authenticate
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const token = url.searchParams.get('token');

    if (!token) {
      sendError(ws, 'UNAUTHORIZED', 'No token provided');
      ws.close(4001, 'Unauthorized');
      return;
    }

    const payload = verifyAccessToken(token);
    if (!payload) {
      sendError(ws, 'INVALID_TOKEN', 'Invalid or expired token');
      ws.close(4001, 'Invalid token');
      return;
    }

    const user = await getUserById(payload.userId);
    if (!user || !user.isActive) {
      sendError(ws, 'USER_NOT_FOUND', 'User not found or inactive');
      ws.close(4001, 'User not found');
      return;
    }

    // Check if suspended
    const riskScore = await getUserRiskScore(user.id);
    if (riskScore?.isSuspended) {
      sendError(ws, 'ACCOUNT_SUSPENDED', 'Account is suspended');
      ws.close(4003, 'Account suspended');
      return;
    }

    authWs.userId = user.id;

    // Add to clients map
    if (!clients.has(user.id)) {
      clients.set(user.id, new Set());
    }
    clients.get(user.id)!.add(authWs);

    // Set user online
    await setUserOnline(user.id);

    // Send connected message
    send(ws, {
      type: 'connected',
      payload: {
        userId: user.id,
        serverTime: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    });

    // Handle pong
    ws.on('pong', () => {
      authWs.isAlive = true;
    });

    // Handle messages
    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        await handleIncomingMessage(authWs, message);
      } catch (error) {
        console.error('WebSocket message error:', error);
        sendError(ws, 'INVALID_MESSAGE', 'Invalid message format');
      }
    });

    // Handle close
    ws.on('close', async () => {
      // Clean up group rooms
      authWs.groupRooms.forEach((groupId) => {
        const room = groupRooms.get(groupId);
        if (room) {
          room.delete(authWs.userId);
          if (room.size === 0) {
            groupRooms.delete(groupId);
          }
        }
      });

      const userClients = clients.get(authWs.userId);
      if (userClients) {
        userClients.delete(authWs);
        if (userClients.size === 0) {
          clients.delete(authWs.userId);
          await setUserOffline(authWs.userId);
        }
      }
    });

    // Handle errors
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });

  return wss;
}

async function handleIncomingMessage(
  ws: AuthenticatedWebSocket,
  message: { type: string; payload: unknown }
): Promise<void> {
  switch (message.type) {
    case 'send_message':
      await handleMessage(ws, message.payload as {
        conversationId: string;
        content: string;
        quotedProfileText?: string;
        tempId: string;
      });
      break;

    case 'typing':
      await handleTyping(ws, message.payload as {
        conversationId: string;
        isTyping: boolean;
      });
      break;

    case 'read':
      // Mark messages as read - handled via REST API for simplicity
      break;

    case 'join_group':
      handleJoinGroupRoom(ws, message.payload as { groupId: string });
      break;

    case 'leave_group':
      handleLeaveGroupRoom(ws, message.payload as { groupId: string });
      break;

    case 'group_typing':
      handleGroupTyping(ws, message.payload as { groupId: string; isTyping: boolean });
      break;

    case 'ping':
      send(ws, {
        type: 'pong',
        payload: {},
        timestamp: new Date().toISOString(),
      });
      break;

    default:
      sendError(ws, 'UNKNOWN_TYPE', `Unknown message type: ${message.type}`);
  }
}

export function send(ws: WebSocket, message: WSMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

export function sendError(ws: WebSocket, code: string, message: string): void {
  send(ws, {
    type: 'error',
    payload: { code, message },
    timestamp: new Date().toISOString(),
  });
}

export function sendToUser(userId: string, message: WSMessage): void {
  const userClients = clients.get(userId);
  if (userClients) {
    userClients.forEach((ws) => {
      send(ws, message);
    });
  }
}

export function isUserConnected(userId: string): boolean {
  return clients.has(userId) && clients.get(userId)!.size > 0;
}

// ============ GROUP ROOM FUNCTIONS ============

function handleJoinGroupRoom(ws: AuthenticatedWebSocket, payload: { groupId: string }): void {
  const { groupId } = payload;

  // Add to WebSocket's group rooms
  ws.groupRooms.add(groupId);

  // Add to global group rooms
  if (!groupRooms.has(groupId)) {
    groupRooms.set(groupId, new Set());
  }
  groupRooms.get(groupId)!.add(ws.userId);

  send(ws, {
    type: 'group_member_joined',
    payload: { groupId, userId: ws.userId },
    timestamp: new Date().toISOString(),
  });
}

function handleLeaveGroupRoom(ws: AuthenticatedWebSocket, payload: { groupId: string }): void {
  const { groupId } = payload;

  // Remove from WebSocket's group rooms
  ws.groupRooms.delete(groupId);

  // Remove from global group rooms
  const room = groupRooms.get(groupId);
  if (room) {
    room.delete(ws.userId);
    if (room.size === 0) {
      groupRooms.delete(groupId);
    }
  }
}

function handleGroupTyping(ws: AuthenticatedWebSocket, payload: { groupId: string; isTyping: boolean }): void {
  const { groupId, isTyping } = payload;

  // Broadcast to all users in the group except sender
  sendToGroupExcept(groupId, ws.userId, {
    type: 'group_typing',
    payload: { groupId, userId: ws.userId, isTyping },
    timestamp: new Date().toISOString(),
  });
}

export function sendToGroup(groupId: string, message: WSMessage): void {
  const room = groupRooms.get(groupId);
  if (!room) return;

  room.forEach((userId) => {
    sendToUser(userId, message);
  });
}

export function sendToGroupExcept(groupId: string, exceptUserId: string, message: WSMessage): void {
  const room = groupRooms.get(groupId);
  if (!room) return;

  room.forEach((userId) => {
    if (userId !== exceptUserId) {
      sendToUser(userId, message);
    }
  });
}

export function notifyGroupMembers(groupId: string, memberIds: string[], message: WSMessage): void {
  // Notify all connected members of a group, regardless of whether they're in the room
  memberIds.forEach((userId) => {
    if (isUserConnected(userId)) {
      sendToUser(userId, message);
    }
  });
}

export { clients, groupRooms };
