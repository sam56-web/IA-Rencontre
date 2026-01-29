import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invitationsApi, getUploadUrl } from '../../services/api';
import { Button } from '../ui/Button';

export function InvitationsBadge() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: count = 0 } = useQuery({
    queryKey: ['invitations', 'count'],
    queryFn: invitationsApi.getPendingCount,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: invitations } = useQuery({
    queryKey: ['invitations', 'pending'],
    queryFn: invitationsApi.getPendingInvitations,
    enabled: isOpen,
  });

  const acceptInvitation = useMutation({
    mutationFn: (invitationId: string) => invitationsApi.acceptInvitation(invitationId),
    onSuccess: (_, invitationId) => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      // Find the group ID and navigate to it
      const invitation = invitations?.find((i) => i.id === invitationId);
      if (invitation) {
        navigate(`/groups/${invitation.groupId}`);
        setIsOpen(false);
      }
    },
  });

  const declineInvitation = useMutation({
    mutationFn: (invitationId: string) => invitationsApi.declineInvitation(invitationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
    },
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (count === 0) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 hover:bg-gray-100 rounded-lg"
      >
        <BellIcon className="w-5 h-5 text-gray-600" />
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
          {count > 9 ? '9+' : count}
        </span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">Invitations aux groupes</h3>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {invitations?.map((invitation) => (
              <div
                key={invitation.id}
                className="p-4 border-b border-gray-100 last:border-b-0"
              >
                <div className="flex gap-3">
                  {invitation.group.photoUrl ? (
                    <img
                      src={getUploadUrl(invitation.group.photoUrl)}
                      alt=""
                      className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-primary-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-lg font-bold text-primary-600">
                        {invitation.group.name[0].toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{invitation.group.name}</p>
                    <p className="text-sm text-gray-500">
                      Invite par {invitation.inviterUsername}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {invitation.group.memberCount} membre{invitation.group.memberCount > 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => acceptInvitation.mutate(invitation.id)}
                    isLoading={acceptInvitation.isPending}
                  >
                    Accepter
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => declineInvitation.mutate(invitation.id)}
                    isLoading={declineInvitation.isPending}
                  >
                    Refuser
                  </Button>
                </div>
              </div>
            ))}

            {(!invitations || invitations.length === 0) && (
              <div className="p-4 text-center text-gray-500">
                Aucune invitation en attente
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
      />
    </svg>
  );
}
