import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { groupsApi, conversationsApi, getUploadUrl } from '../../services/api';
import clsx from 'clsx';

interface InviteToGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
}

export function InviteToGroupModal({ isOpen, onClose, groupId }: InviteToGroupModalProps) {
  const queryClient = useQueryClient();
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  // Get conversations to show users we've talked to
  const { data: conversations, isLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: conversationsApi.getConversations,
    enabled: isOpen,
  });

  // Get current members to filter them out
  const { data: members } = useQuery({
    queryKey: ['group-members', groupId],
    queryFn: () => groupsApi.getMembers(groupId),
    enabled: isOpen,
  });

  const inviteUsers = useMutation({
    mutationFn: (userIds: string[]) => groupsApi.inviteUsers(groupId, userIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-members', groupId] });
      setSelectedUserIds(new Set());
      onClose();
    },
  });

  const memberIds = new Set(members?.map((m) => m.userId) || []);

  // Filter conversations to only show users not already in the group
  const availableUsers = conversations
    ?.filter((c) => !memberIds.has(c.otherUser.id))
    .filter((c) =>
      search ? c.otherUser.username.toLowerCase().includes(search.toLowerCase()) : true
    )
    .map((c) => c.otherUser) || [];

  const toggleUser = (userId: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const handleInvite = () => {
    if (selectedUserIds.size > 0) {
      inviteUsers.mutate(Array.from(selectedUserIds));
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Inviter des membres" size="md">
      <div className="space-y-4">
        <Input
          placeholder="Rechercher un utilisateur..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="max-h-64 overflow-y-auto space-y-2">
          {isLoading ? (
            <div className="text-center text-gray-500 py-4">Chargement...</div>
          ) : availableUsers.length > 0 ? (
            availableUsers.map((user) => (
              <button
                key={user.id}
                onClick={() => toggleUser(user.id)}
                className={clsx(
                  'w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left',
                  selectedUserIds.has(user.id)
                    ? 'bg-primary-50 border-2 border-primary-500'
                    : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                )}
              >
                {user.mainPhotoUrl ? (
                  <img
                    src={getUploadUrl(user.mainPhotoUrl)}
                    alt=""
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                    <span className="text-sm font-medium text-gray-600">
                      {user.username[0].toUpperCase()}
                    </span>
                  </div>
                )}
                <span className="font-medium text-gray-900">{user.username}</span>
                {selectedUserIds.has(user.id) && (
                  <CheckIcon className="w-5 h-5 text-primary-600 ml-auto" />
                )}
              </button>
            ))
          ) : (
            <div className="text-center text-gray-500 py-8">
              <p>Aucun utilisateur a inviter</p>
              <p className="text-sm mt-1">
                Commencez une conversation avec quelqu'un pour pouvoir l'inviter
              </p>
            </div>
          )}
        </div>

        {selectedUserIds.size > 0 && (
          <p className="text-sm text-gray-600">
            {selectedUserIds.size} utilisateur{selectedUserIds.size > 1 ? 's' : ''} selectionne
            {selectedUserIds.size > 1 ? 's' : ''}
          </p>
        )}

        <div className="flex justify-end gap-3 pt-4">
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button
            onClick={handleInvite}
            disabled={selectedUserIds.size === 0}
            isLoading={inviteUsers.isPending}
          >
            Inviter
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}
