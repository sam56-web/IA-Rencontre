import { useAuthStore } from '../stores/auth.store';
import type { Message } from '../types';

type MessageHandler = (conversationId: string, message: Message) => void;
type TypingHandler = (conversationId: string, userId: string, isTyping: boolean) => void;
type PresenceHandler = (userId: string, isOnline: boolean, lastSeenAt?: string) => void;

interface WebSocketService {
  connect: () => void;
  disconnect: () => void;
  sendMessage: (conversationId: string, content: string, quotedProfileText?: string, tempId?: string) => void;
  sendTyping: (conversationId: string, isTyping: boolean) => void;
  onMessage: (handler: MessageHandler) => () => void;
  onMessageSent: (handler: (tempId: string, message: Message) => void) => () => void;
  onTyping: (handler: TypingHandler) => () => void;
  onPresence: (handler: PresenceHandler) => () => void;
  isConnected: () => boolean;
}

class WebSocketClient implements WebSocketService {
  private ws: WebSocket | null = null;
  private messageHandlers: Set<MessageHandler> = new Set();
  private messageSentHandlers: Set<(tempId: string, message: Message) => void> = new Set();
  private typingHandlers: Set<TypingHandler> = new Set();
  private presenceHandlers: Set<PresenceHandler> = new Set();
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private pingInterval: ReturnType<typeof setInterval> | null = null;

  connect(): void {
    const token = useAuthStore.getState().accessToken;
    if (!token) {
      console.error('No access token available');
      return;
    }

    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3000';
    this.ws = new WebSocket(`${wsUrl}/ws?token=${token}`);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      this.startPing();
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleMessage(data);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      this.stopPing();
      this.scheduleReconnect();
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.stopPing();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnect attempts reached');
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;

    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private startPing(): void {
    this.pingInterval = setInterval(() => {
      this.send({ type: 'ping', payload: {} });
    }, 25000);
  }

  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private handleMessage(data: { type: string; payload: unknown }): void {
    switch (data.type) {
      case 'connected':
        console.log('WebSocket authenticated');
        break;

      case 'message_new': {
        const { conversationId, message } = data.payload as { conversationId: string; message: Message };
        this.messageHandlers.forEach((handler) => handler(conversationId, message));
        break;
      }

      case 'message_sent': {
        const { tempId, message } = data.payload as { tempId: string; message: Message };
        this.messageSentHandlers.forEach((handler) => handler(tempId, message));
        break;
      }

      case 'typing_update': {
        const { conversationId, userId, isTyping } = data.payload as {
          conversationId: string;
          userId: string;
          isTyping: boolean;
        };
        this.typingHandlers.forEach((handler) => handler(conversationId, userId, isTyping));
        break;
      }

      case 'presence_update': {
        const { userId, isOnline, lastSeenAt } = data.payload as {
          userId: string;
          isOnline: boolean;
          lastSeenAt?: string;
        };
        this.presenceHandlers.forEach((handler) => handler(userId, isOnline, lastSeenAt));
        break;
      }

      case 'error': {
        const { code, message } = data.payload as { code: string; message: string };
        console.error('WebSocket error:', code, message);
        break;
      }

      case 'pong':
        // Heartbeat response
        break;

      default:
        console.log('Unknown message type:', data.type);
    }
  }

  private send(data: { type: string; payload: unknown }): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  sendMessage(conversationId: string, content: string, quotedProfileText?: string, tempId?: string): void {
    this.send({
      type: 'send_message',
      payload: { conversationId, content, quotedProfileText, tempId: tempId || Date.now().toString() },
    });
  }

  sendTyping(conversationId: string, isTyping: boolean): void {
    this.send({
      type: 'typing',
      payload: { conversationId, isTyping },
    });
  }

  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  onMessageSent(handler: (tempId: string, message: Message) => void): () => void {
    this.messageSentHandlers.add(handler);
    return () => this.messageSentHandlers.delete(handler);
  }

  onTyping(handler: TypingHandler): () => void {
    this.typingHandlers.add(handler);
    return () => this.typingHandlers.delete(handler);
  }

  onPresence(handler: PresenceHandler): () => void {
    this.presenceHandlers.add(handler);
    return () => this.presenceHandlers.delete(handler);
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export const websocket = new WebSocketClient();
