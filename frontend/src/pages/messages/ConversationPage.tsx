import { useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Layout } from '../../components/layout/Layout';
import { Button } from '../../components/ui/Button';
import { useConversation, useMessages, useMarkAsRead } from '../../hooks/useConversations';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useAuthStore } from '../../stores/auth.store';
import { MessageBubble } from './components/MessageBubble';
import { MessageInput } from './components/MessageInput';
import type { Message } from '../../types';

export function ConversationPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user } = useAuthStore();
  const { sendMessage, sendTyping } = useWebSocket();

  const { data: conversation, isLoading: isLoadingConversation } = useConversation(
    conversationId || ''
  );
  const {
    data: messagesData,
    isLoading: isLoadingMessages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useMessages(conversationId || '');
  const markAsRead = useMarkAsRead(conversationId || '');

  // Flatten messages from pages
  const messages: Message[] = messagesData?.pages.flatMap((page) => page.items) || [];

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Mark messages as read
  useEffect(() => {
    if (conversationId && messages.length > 0) {
      const unreadIds = messages
        .filter((m) => !m.isRead && m.senderId !== user?.id)
        .map((m) => m.id);

      if (unreadIds.length > 0) {
        markAsRead.mutate(unreadIds);
      }
    }
  }, [conversationId, messages, user?.id]);

  const handleSendMessage = (content: string) => {
    if (conversationId) {
      sendMessage(conversationId, content);
    }
  };

  const handleTyping = (isTyping: boolean) => {
    if (conversationId) {
      sendTyping(conversationId, isTyping);
    }
  };

  if (isLoadingConversation) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      </Layout>
    );
  }

  if (!conversation) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-gray-600 mb-4">Conversation non trouvée</p>
          <Button variant="outline" onClick={() => navigate('/messages')}>
            Retour aux messages
          </Button>
        </div>
      </Layout>
    );
  }

  // Group messages by date
  const groupedMessages: { date: string; messages: Message[] }[] = [];
  messages.forEach((message) => {
    const date = format(new Date(message.createdAt), 'dd MMMM yyyy', { locale: fr });
    const lastGroup = groupedMessages[groupedMessages.length - 1];

    if (lastGroup && lastGroup.date === date) {
      lastGroup.messages.push(message);
    } else {
      groupedMessages.push({ date, messages: [message] });
    }
  });

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-4">
        <button
          onClick={() => navigate('/messages')}
          className="p-2 -ml-2 hover:bg-gray-100 rounded-full"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>

        <Link
          to={`/profile/${conversation.otherUser.id}`}
          className="flex items-center gap-3 flex-1"
        >
          <div className="w-10 h-10 rounded-full bg-warm-100 overflow-hidden">
            {conversation.otherUser.mainPhotoUrl ? (
              <img
                src={conversation.otherUser.mainPhotoUrl}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-lg text-warm-500">
                  {conversation.otherUser.username[0].toUpperCase()}
                </span>
              </div>
            )}
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">
              {conversation.otherUser.username}
            </h2>
            <p className="text-xs text-gray-500">
              {conversation.otherUser.lastActiveCategory === 'now'
                ? 'En ligne'
                : 'Hors ligne'}
            </p>
          </div>
        </Link>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {/* Initial quoted text */}
        {conversation.initialQuotedText && (
          <div className="max-w-sm mx-auto mb-6 bg-warm-50 rounded-lg p-4 text-center">
            <p className="text-xs text-gray-500 mb-1">Conversation initiée avec cette citation</p>
            <p className="text-sm font-serif italic text-gray-700">
              "{conversation.initialQuotedText}"
            </p>
          </div>
        )}

        {/* Load more button */}
        {hasNextPage && (
          <div className="text-center mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fetchNextPage()}
              isLoading={isFetchingNextPage}
            >
              Charger les messages précédents
            </Button>
          </div>
        )}

        {/* Messages grouped by date */}
        {isLoadingMessages ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
          </div>
        ) : (
          <div className="space-y-6">
            {groupedMessages.map((group) => (
              <div key={group.date}>
                <div className="text-center mb-4">
                  <span className="text-xs text-gray-500 bg-white px-3 py-1 rounded-full">
                    {group.date}
                  </span>
                </div>
                <div className="space-y-3">
                  {group.messages.map((message) => (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      isOwn={message.senderId === user?.id}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-200 px-4 py-3">
        <MessageInput onSend={handleSendMessage} onTyping={handleTyping} />
      </div>
    </div>
  );
}
