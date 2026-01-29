import { useParams, useNavigate, Link } from 'react-router-dom';
import clsx from 'clsx';
import { Layout } from '../../components/layout/Layout';
import { useEvent, useJoinEvent, useLeaveEvent, useEventParticipants } from '../../hooks/useEvents';

export function EventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();

  const { data: event, isLoading } = useEvent(eventId!);
  const { data: participantsData } = useEventParticipants(eventId!);
  const joinEvent = useJoinEvent();
  const leaveEvent = useLeaveEvent();

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      </Layout>
    );
  }

  if (!event) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-gray-500">Événement non trouvé</p>
          <button
            onClick={() => navigate('/events')}
            className="mt-4 text-primary-600 hover:text-primary-700"
          >
            Retour aux événements
          </button>
        </div>
      </Layout>
    );
  }

  const startsAt = new Date(event.startsAt);
  const endsAt = event.endsAt ? new Date(event.endsAt) : null;
  const isPast = startsAt < new Date();
  const isFull = !!(event.maxParticipants && event.participantCount >= event.maxParticipants);

  const handleJoin = async (status: 'going' | 'maybe') => {
    await joinEvent.mutateAsync({ eventId: event.id, status });
  };

  const handleLeave = async () => {
    await leaveEvent.mutateAsync(event.id);
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Back button */}
        <button
          onClick={() => navigate('/events')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeftIcon className="w-5 h-5" />
          Retour aux événements
        </button>

        {/* Event header */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {event.photoUrl && (
            <img
              src={event.photoUrl}
              alt={event.title}
              className="w-full h-48 object-cover"
            />
          )}

          <div className="p-6">
            {/* Title and status */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{event.title}</h1>
                {event.groupName && (
                  <p className="text-gray-500 mt-1">
                    Dans le groupe{' '}
                    <Link
                      to={`/groups/${event.groupId}`}
                      className="text-primary-600 hover:text-primary-700"
                    >
                      {event.groupName}
                    </Link>
                  </p>
                )}
              </div>
              {event.userStatus && (
                <span
                  className={clsx(
                    'px-3 py-1 text-sm font-medium rounded-full',
                    event.userStatus === 'going' && 'bg-green-100 text-green-700',
                    event.userStatus === 'maybe' && 'bg-yellow-100 text-yellow-700'
                  )}
                >
                  {event.userStatus === 'going' ? 'Vous y allez' : 'Peut-être'}
                </span>
              )}
            </div>

            {/* Details */}
            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-3 text-gray-700">
                <CalendarIcon className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="font-medium">
                    {startsAt.toLocaleDateString('fr-FR', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                  <p className="text-sm text-gray-500">
                    {startsAt.toLocaleTimeString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {endsAt && (
                      <>
                        {' - '}
                        {endsAt.toLocaleTimeString('fr-FR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </>
                    )}
                  </p>
                </div>
              </div>

              {event.locationName && (
                <div className="flex items-center gap-3 text-gray-700">
                  <LocationIcon className="w-5 h-5 text-gray-400" />
                  <span>{event.locationName}</span>
                </div>
              )}

              <div className="flex items-center gap-3 text-gray-700">
                <UsersIcon className="w-5 h-5 text-gray-400" />
                <span>
                  {event.participantCount} participant{event.participantCount > 1 ? 's' : ''}
                  {event.maxParticipants && (
                    <span className="text-gray-500"> / {event.maxParticipants} max</span>
                  )}
                </span>
              </div>

              {event.creatorUsername && (
                <div className="flex items-center gap-3 text-gray-700">
                  <UserIcon className="w-5 h-5 text-gray-400" />
                  <span>
                    Organisé par{' '}
                    <Link
                      to={`/profile/${event.creatorId}`}
                      className="text-primary-600 hover:text-primary-700"
                    >
                      {event.creatorUsername}
                    </Link>
                  </span>
                </div>
              )}
            </div>

            {/* Description */}
            {event.description && (
              <div className="mt-6 pt-6 border-t border-gray-100">
                <h2 className="font-semibold text-gray-900 mb-2">Description</h2>
                <p className="text-gray-600 whitespace-pre-wrap">{event.description}</p>
              </div>
            )}

            {/* Actions */}
            {!isPast && (
              <div className="mt-6 pt-6 border-t border-gray-100">
                {event.userStatus ? (
                  <div className="flex gap-3">
                    {event.userStatus !== 'going' && !isFull && (
                      <button
                        onClick={() => handleJoin('going')}
                        disabled={joinEvent.isPending}
                        className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
                      >
                        J'y vais
                      </button>
                    )}
                    {event.userStatus !== 'maybe' && (
                      <button
                        onClick={() => handleJoin('maybe')}
                        disabled={joinEvent.isPending}
                        className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                      >
                        Peut-être
                      </button>
                    )}
                    <button
                      onClick={handleLeave}
                      disabled={leaveEvent.isPending}
                      className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                    >
                      Se désinscrire
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleJoin('going')}
                      disabled={joinEvent.isPending || isFull}
                      className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
                    >
                      {isFull ? 'Complet' : "J'y vais"}
                    </button>
                    <button
                      onClick={() => handleJoin('maybe')}
                      disabled={joinEvent.isPending}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                      Peut-être
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Participants */}
        {participantsData && participantsData.participants.length > 0 && (
          <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">
              Participants ({participantsData.total})
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {participantsData.participants.map((participant: { userId: string; username: string; avatarUrl: string | null; status: string }) => (
                <Link
                  key={participant.userId}
                  to={`/profile/${participant.userId}`}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {participant.avatarUrl ? (
                    <img
                      src={participant.avatarUrl}
                      alt={participant.username}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                      <span className="text-primary-600 font-medium">
                        {participant.username.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-gray-900">{participant.username}</p>
                    <p className="text-xs text-gray-500">
                      {participant.status === 'going' ? 'Confirmé' : 'Peut-être'}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  );
}

function LocationIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
      />
    </svg>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
      />
    </svg>
  );
}
