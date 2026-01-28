import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../../components/layout/Layout';
import { Button } from '../../components/ui/Button';
import { Card, CardContent } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { groupsApi, getUploadUrl } from '../../services/api';
import { useAuthStore } from '../../stores/auth.store';
import { websocket } from '../../services/websocket';
import { InviteToGroupModal } from '../../components/groups/InviteToGroupModal';
import type { GroupMessage, GroupMember } from '../../types';
import clsx from 'clsx';

export function GroupChatPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const [message, setMessage] = useState('');
  const [showMembersPanel, setShowMembersPanel] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: group, isLoading: loadingGroup } = useQuery({
    queryKey: ['group', groupId],
    queryFn: () => groupsApi.getGroup(groupId!),
    enabled: !!groupId,
  });

  const { data: messagesData, isLoading: loadingMessages } = useQuery({
    queryKey: ['group-messages', groupId],
    queryFn: () => groupsApi.getMessages(groupId!),
    enabled: !!groupId && !!group?.isMember,
    refetchInterval: 5000, // Poll every 5 seconds for new messages
  });

  const { data: members } = useQuery({
    queryKey: ['group-members', groupId],
    queryFn: () => groupsApi.getMembers(groupId!),
    enabled: !!groupId && showMembersPanel,
  });

  const sendMessage = useMutation({
    mutationFn: (content: string) => groupsApi.sendMessage(groupId!, content),
    onSuccess: (newMessage) => {
      setMessage('');
      queryClient.setQueryData<{ messages: GroupMessage[]; hasMore: boolean }>(
        ['group-messages', groupId],
        (old) => {
          if (!old) return { messages: [newMessage], hasMore: false };
          return { ...old, messages: [...old.messages, newMessage] };
        }
      );
    },
  });

  const leaveGroup = useMutation({
    mutationFn: () => groupsApi.leaveGroup(groupId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      navigate('/groups');
    },
  });

  // Join WebSocket room on mount
  useEffect(() => {
    if (groupId && group?.isMember) {
      websocket.send({ type: 'join_group', payload: { groupId } });

      return () => {
        websocket.send({ type: 'leave_group', payload: { groupId } });
      };
    }
  }, [groupId, group?.isMember]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messagesData?.messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      sendMessage.mutate(message.trim());
    }
  };

  if (loadingGroup) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-16 bg-gray-100 rounded-xl" />
            <div className="h-96 bg-gray-100 rounded-xl" />
          </div>
        </div>
      </Layout>
    );
  }

  if (!group) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-gray-600">Groupe non trouve</p>
          <Button className="mt-4" onClick={() => navigate('/groups')}>
            Retour aux groupes
          </Button>
        </div>
      </Layout>
    );
  }

  if (!group.isMember) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardContent className="p-8 text-center">
              {group.photoUrl ? (
                <img
                  src={getUploadUrl(group.photoUrl)}
                  alt=""
                  className="w-24 h-24 rounded-xl object-cover mx-auto mb-4"
                />
              ) : (
                <div className="w-24 h-24 rounded-xl bg-primary-100 flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl font-bold text-primary-600">
                    {group.name[0].toUpperCase()}
                  </span>
                </div>
              )}
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{group.name}</h1>
              {group.description && (
                <p className="text-gray-600 mb-4">{group.description}</p>
              )}
              <p className="text-sm text-gray-500 mb-6">
                {group.memberCount} membre{group.memberCount > 1 ? 's' : ''}
                {group.theme && ` • ${group.theme.name}`}
              </p>
              {group.isPublic ? (
                <Button
                  onClick={() => groupsApi.joinGroup(group.id).then(() => {
                    queryClient.invalidateQueries({ queryKey: ['group', groupId] });
                    queryClient.invalidateQueries({ queryKey: ['groups'] });
                  })}
                >
                  Rejoindre le groupe
                </Button>
              ) : (
                <p className="text-amber-600">Ce groupe est prive. Vous devez etre invite pour le rejoindre.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout hideNav>
      <div className="h-[calc(100vh-2rem)] flex flex-col max-w-6xl mx-auto bg-white rounded-xl shadow-sm overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/groups')}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
            </button>
            {group.photoUrl ? (
              <img
                src={getUploadUrl(group.photoUrl)}
                alt=""
                className="w-10 h-10 rounded-lg object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
                <span className="text-lg font-bold text-primary-600">
                  {group.name[0].toUpperCase()}
                </span>
              </div>
            )}
            <div>
              <h1 className="font-semibold text-gray-900">{group.name}</h1>
              <p className="text-xs text-gray-500">
                {group.memberCount} membre{group.memberCount > 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowMembersPanel(!showMembersPanel)}
              className={clsx(
                'p-2 rounded-lg transition-colors',
                showMembersPanel ? 'bg-primary-100 text-primary-700' : 'hover:bg-gray-100 text-gray-600'
              )}
            >
              <UsersIcon className="w-5 h-5" />
            </button>
            {(group.userRole === 'admin' || group.userRole === 'moderator') && (
              <button
                onClick={() => setShowInviteModal(true)}
                className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"
              >
                <UserPlusIcon className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={() => setShowSettingsModal(true)}
              className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"
            >
              <SettingsIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Messages */}
          <div className="flex-1 flex flex-col">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {loadingMessages ? (
                <div className="text-center text-gray-500">Chargement des messages...</div>
              ) : messagesData?.messages && messagesData.messages.length > 0 ? (
                messagesData.messages.map((msg) => (
                  <GroupMessageBubble
                    key={msg.id}
                    message={msg}
                    isOwnMessage={msg.senderId === user?.id}
                  />
                ))
              ) : (
                <div className="text-center text-gray-500 py-12">
                  <p>Aucun message pour le moment</p>
                  <p className="text-sm mt-1">Soyez le premier a ecrire!</p>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message input */}
            <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Ecrivez un message..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
                <Button type="submit" disabled={!message.trim()} isLoading={sendMessage.isPending}>
                  <SendIcon className="w-5 h-5" />
                </Button>
              </div>
            </form>
          </div>

          {/* Members panel */}
          {showMembersPanel && (
            <div className="w-64 border-l border-gray-200 bg-gray-50 overflow-y-auto">
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 mb-4">Membres</h3>
                <div className="space-y-2">
                  {members?.map((member) => (
                    <MemberItem key={member.userId} member={member} currentUserRole={group.userRole} />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Settings Modal */}
      <Modal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        title="Parametres du groupe"
      >
        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-gray-900">Informations</h4>
            <p className="text-sm text-gray-600 mt-1">{group.description || 'Aucune description'}</p>
            {group.theme && (
              <p className="text-sm text-gray-500 mt-2">Thematique: {group.theme.name}</p>
            )}
          </div>

          <div className="border-t pt-4">
            <Button
              variant="outline"
              className="w-full text-red-600 hover:bg-red-50"
              onClick={() => {
                if (confirm('Etes-vous sur de vouloir quitter ce groupe?')) {
                  leaveGroup.mutate();
                }
              }}
              isLoading={leaveGroup.isPending}
            >
              Quitter le groupe
            </Button>
          </div>
        </div>
      </Modal>

      {/* Invite Modal */}
      <InviteToGroupModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        groupId={groupId!}
      />
    </Layout>
  );
}

interface GroupMessageBubbleProps {
  message: GroupMessage;
  isOwnMessage: boolean;
}

function GroupMessageBubble({ message, isOwnMessage }: GroupMessageBubbleProps) {
  return (
    <div className={clsx('flex gap-3', isOwnMessage && 'flex-row-reverse')}>
      {!isOwnMessage && (
        message.senderPhotoUrl ? (
          <img
            src={getUploadUrl(message.senderPhotoUrl)}
            alt=""
            className="w-8 h-8 rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-medium text-gray-600">
              {message.senderUsername[0].toUpperCase()}
            </span>
          </div>
        )
      )}
      <div className={clsx('max-w-[70%]', isOwnMessage && 'text-right')}>
        {!isOwnMessage && (
          <p className="text-xs text-gray-500 mb-1">{message.senderUsername}</p>
        )}
        <div
          className={clsx(
            'rounded-2xl px-4 py-2',
            isOwnMessage ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-900'
          )}
        >
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        </div>
        <p className="text-xs text-gray-400 mt-1">
          {new Date(message.createdAt).toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
    </div>
  );
}

interface MemberItemProps {
  member: GroupMember;
  currentUserRole: string | null;
}

function MemberItem({ member, currentUserRole }: MemberItemProps) {
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100">
      {member.photoUrl ? (
        <img
          src={getUploadUrl(member.photoUrl)}
          alt=""
          className="w-8 h-8 rounded-full object-cover"
        />
      ) : (
        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
          <span className="text-sm font-medium text-gray-600">
            {member.username[0].toUpperCase()}
          </span>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{member.username}</p>
        {member.role !== 'member' && (
          <span
            className={clsx(
              'text-xs',
              member.role === 'admin' ? 'text-yellow-600' : 'text-blue-600'
            )}
          >
            {member.role === 'admin' ? 'Admin' : 'Modo'}
          </span>
        )}
      </div>
    </div>
  );
}

// Icons
function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}

function UserPlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
    </svg>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function SendIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
  );
}
