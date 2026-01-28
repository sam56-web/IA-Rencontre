import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../../components/layout/Layout';
import { Button } from '../../components/ui/Button';
import { Card, CardContent } from '../../components/ui/Card';
import { groupsApi, getUploadUrl } from '../../services/api';
import { CreateGroupModal } from '../../components/groups/CreateGroupModal';
import type { Group } from '../../types';
import clsx from 'clsx';

type Tab = 'mine' | 'discover';

export function GroupsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('mine');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { data: myGroups, isLoading: loadingMyGroups } = useQuery({
    queryKey: ['groups', 'mine'],
    queryFn: groupsApi.getMyGroups,
  });

  const { data: publicGroups, isLoading: loadingPublic } = useQuery({
    queryKey: ['groups', 'discover'],
    queryFn: () => groupsApi.getPublicGroups(),
    enabled: activeTab === 'discover',
  });

  const joinGroup = useMutation({
    mutationFn: (groupId: string) => groupsApi.joinGroup(groupId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
  });

  const isLoading = activeTab === 'mine' ? loadingMyGroups : loadingPublic;
  const groups = activeTab === 'mine' ? myGroups : publicGroups?.groups;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Groupes</h1>
          <Button onClick={() => setShowCreateModal(true)}>
            <PlusIcon className="w-5 h-5 mr-2" />
            Creer un groupe
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('mine')}
            className={clsx(
              'px-4 py-2 rounded-lg font-medium transition-colors',
              activeTab === 'mine'
                ? 'bg-primary-100 text-primary-700'
                : 'text-gray-600 hover:bg-gray-100'
            )}
          >
            Mes groupes
            {myGroups && myGroups.length > 0 && (
              <span className="ml-2 bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full text-sm">
                {myGroups.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('discover')}
            className={clsx(
              'px-4 py-2 rounded-lg font-medium transition-colors',
              activeTab === 'discover'
                ? 'bg-primary-100 text-primary-700'
                : 'text-gray-600 hover:bg-gray-100'
            )}
          >
            Decouvrir
          </button>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : groups && groups.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {groups.map((group) => (
              <GroupCard
                key={group.id}
                group={group}
                showJoinButton={activeTab === 'discover'}
                onJoin={() => joinGroup.mutate(group.id)}
                isJoining={joinGroup.isPending}
                onClick={() => navigate(`/groups/${group.id}`)}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              {activeTab === 'mine' ? (
                <>
                  <GroupIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Vous n'avez rejoint aucun groupe
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Creez votre propre groupe ou decouvrez les groupes publics
                  </p>
                  <div className="flex gap-3 justify-center">
                    <Button onClick={() => setShowCreateModal(true)}>Creer un groupe</Button>
                    <Button variant="outline" onClick={() => setActiveTab('discover')}>
                      Decouvrir
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <SearchIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Aucun groupe public disponible
                  </h3>
                  <p className="text-gray-600">Soyez le premier a creer un groupe public!</p>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <CreateGroupModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={(group) => {
          setShowCreateModal(false);
          navigate(`/groups/${group.id}`);
        }}
      />
    </Layout>
  );
}

interface GroupCardProps {
  group: Group;
  showJoinButton?: boolean;
  onJoin?: () => void;
  isJoining?: boolean;
  onClick: () => void;
}

function GroupCard({ group, showJoinButton, onJoin, isJoining, onClick }: GroupCardProps) {
  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={onClick}>
      <CardContent className="p-4">
        <div className="flex gap-4">
          {/* Photo */}
          <div className="flex-shrink-0">
            {group.photoUrl ? (
              <img
                src={getUploadUrl(group.photoUrl)}
                alt=""
                className="w-16 h-16 rounded-lg object-cover"
              />
            ) : (
              <div className="w-16 h-16 rounded-lg bg-primary-100 flex items-center justify-center">
                <span className="text-2xl font-bold text-primary-600">
                  {group.name[0].toUpperCase()}
                </span>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-gray-900 truncate">{group.name}</h3>
                <p className="text-sm text-gray-500">
                  {group.memberCount} membre{group.memberCount > 1 ? 's' : ''}
                </p>
              </div>
              {group.theme && (
                <span className="flex-shrink-0 px-2 py-1 bg-warm-100 text-warm-700 rounded text-xs">
                  {group.theme.name}
                </span>
              )}
            </div>

            {group.description && (
              <p className="text-sm text-gray-600 mt-2 line-clamp-2">{group.description}</p>
            )}

            {group.lastMessage && (
              <p className="text-xs text-gray-400 mt-2 truncate">
                Dernier message: {group.lastMessage.content}
              </p>
            )}

            {showJoinButton && (
              <Button
                size="sm"
                className="mt-3"
                onClick={(e) => {
                  e.stopPropagation();
                  onJoin?.();
                }}
                isLoading={isJoining}
              >
                Rejoindre
              </Button>
            )}

            {group.userRole && (
              <span
                className={clsx(
                  'inline-block mt-2 px-2 py-0.5 rounded text-xs font-medium',
                  group.userRole === 'admin'
                    ? 'bg-yellow-100 text-yellow-700'
                    : group.userRole === 'moderator'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600'
                )}
              >
                {group.userRole === 'admin'
                  ? 'Admin'
                  : group.userRole === 'moderator'
                  ? 'Moderateur'
                  : 'Membre'}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}

function GroupIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
      />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  );
}
