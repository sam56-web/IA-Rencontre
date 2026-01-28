import { useNavigate } from 'react-router-dom';
import { Layout } from '../../components/layout/Layout';
import { Card, CardContent } from '../../components/ui/Card';
import { useConversations } from '../../hooks/useConversations';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { INTENTION_LABELS } from '../../types';

export function MessagesPage() {
  const navigate = useNavigate();
  const { data: conversations, isLoading } = useConversations();

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Messages</h1>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : !conversations || conversations.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">💬</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Pas encore de conversations
            </h2>
            <p className="text-gray-600 mb-6">
              Découvrez des profils et écrivez à ceux qui vous intéressent.
            </p>
            <button
              onClick={() => navigate('/discover')}
              className="text-primary-600 hover:text-primary-700 font-medium"
            >
              Découvrir des profils →
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {conversations.map((conversation) => (
              <Card
                key={conversation.id}
                hover
                onClick={() => navigate(`/messages/${conversation.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <div className="w-14 h-14 rounded-full bg-warm-100 flex-shrink-0 overflow-hidden">
                      {conversation.otherUser.mainPhotoUrl ? (
                        <img
                          src={conversation.otherUser.mainPhotoUrl}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="text-2xl text-warm-500">
                            {conversation.otherUser.username[0].toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-semibold text-gray-900">
                          {conversation.otherUser.username}
                        </h3>
                        {conversation.lastMessage && (
                          <span className="text-xs text-gray-500">
                            {formatDistanceToNow(new Date(conversation.lastMessage.createdAt), {
                              addSuffix: true,
                              locale: fr,
                            })}
                          </span>
                        )}
                      </div>

                      {conversation.lastMessage && (
                        <p
                          className={`text-sm truncate ${
                            conversation.unreadCount > 0
                              ? 'text-gray-900 font-medium'
                              : 'text-gray-600'
                          }`}
                        >
                          {conversation.lastMessage.sentByMe && 'Vous : '}
                          {conversation.lastMessage.content}
                        </p>
                      )}

                      {/* Matched intentions */}
                      {conversation.matchedIntentions.length > 0 && (
                        <div className="flex gap-1 mt-2">
                          {conversation.matchedIntentions.slice(0, 2).map((intention) => (
                            <span
                              key={intention}
                              className="text-xs px-2 py-0.5 bg-primary-50 text-primary-600 rounded-full"
                            >
                              {INTENTION_LABELS[intention]}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Unread badge */}
                    {conversation.unreadCount > 0 && (
                      <div className="w-6 h-6 bg-primary-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
                        {conversation.unreadCount > 9 ? '9+' : conversation.unreadCount}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
