import { useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { websocket } from '../services/websocket';
import { useAuthStore } from '../stores/auth.store';
import type { Message } from '../types';

export function useWebSocket() {
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated && !websocket.isConnected()) {
      websocket.connect();
    }

    return () => {
      // Don't disconnect on cleanup - let auth handle it
    };
  }, [isAuthenticated]);

  useEffect(() => {
    const unsubMessage = websocket.onMessage((conversationId, message) => {
      // Update messages cache
      queryClient.setQueryData(['messages', conversationId], (old: unknown) => {
        if (!old) return old;
        const data = old as { pages: { items: Message[] }[] };
        return {
          ...data,
          pages: data.pages.map((page, i) =>
            i === 0 ? { ...page, items: [...page.items, message] } : page
          ),
        };
      });

      // Invalidate conversations to update last message
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['unread-count'] });
    });

    return unsubMessage;
  }, [queryClient]);

  const sendMessage = useCallback(
    (conversationId: string, content: string, quotedProfileText?: string) => {
      const tempId = Date.now().toString();
      websocket.sendMessage(conversationId, content, quotedProfileText, tempId);
      return tempId;
    },
    []
  );

  const sendTyping = useCallback((conversationId: string, isTyping: boolean) => {
    websocket.sendTyping(conversationId, isTyping);
  }, []);

  return {
    sendMessage,
    sendTyping,
    isConnected: websocket.isConnected(),
  };
}

export function useTypingIndicator(conversationId: string) {
  const typingUsers = useRef<Map<string, boolean>>(new Map());

  useEffect(() => {
    const unsubTyping = websocket.onTyping((convId, userId, isTyping) => {
      if (convId === conversationId) {
        if (isTyping) {
          typingUsers.current.set(userId, true);
        } else {
          typingUsers.current.delete(userId);
        }
      }
    });

    return unsubTyping;
  }, [conversationId]);

  return typingUsers.current;
}
