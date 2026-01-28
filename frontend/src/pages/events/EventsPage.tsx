import { useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { Layout } from '../../components/layout/Layout';
import { useUpcomingEvents, useMyEvents, Event } from '../../hooks/useEvents';
import { CreateEventModal } from './components/CreateEventModal';

type Tab = 'upcoming' | 'my';

export function EventsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('upcoming');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { data: upcomingData, isLoading: loadingUpcoming } = useUpcomingEvents();
  const { data: myData, isLoading: loadingMy } = useMyEvents();

  const events = activeTab === 'upcoming' ? upcomingData?.events : myData?.events;
  const isLoading = activeTab === 'upcoming' ? loadingUpcoming : loadingMy;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Événements</h1>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2"
          >
            <PlusIcon className="w-5 h-5" />
            Créer un événement
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('upcoming')}
            className={clsx(
              'px-4 py-2 rounded-lg font-medium transition-colors',
              activeTab === 'upcoming'
                ? 'bg-primary-100 text-primary-700'
                : 'text-gray-600 hover:bg-gray-100'
            )}
          >
            À venir
          </button>
          <button
            onClick={() => setActiveTab('my')}
            className={clsx(
              'px-4 py-2 rounded-lg font-medium transition-colors',
              activeTab === 'my'
                ? 'bg-primary-100 text-primary-700'
                : 'text-gray-600 hover:bg-gray-100'
            )}
          >
            Mes événements
          </button>
        </div>

        {/* Events list */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" />
          </div>
        ) : events && events.length > 0 ? (
          <div className="space-y-4">
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <CalendarIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">
              {activeTab === 'upcoming'
                ? 'Aucun événement à venir'
                : "Vous n'êtes inscrit à aucun événement"}
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 text-primary-600 hover:text-primary-700 font-medium"
            >
              Créer votre premier événement
            </button>
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateEventModal onClose={() => setShowCreateModal(false)} />
      )}
    </Layout>
  );
}

function EventCard({ event }: { event: Event }) {
  const startsAt = new Date(event.startsAt);
  const now = new Date();
  const isToday = startsAt.toDateString() === now.toDateString();
  const isTomorrow = startsAt.toDateString() === new Date(now.getTime() + 86400000).toDateString();

  const formatDate = () => {
    if (isToday) return "Aujourd'hui";
    if (isTomorrow) return 'Demain';
    return startsAt.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  };

  const formatTime = () => {
    return startsAt.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Link
      to={`/events/${event.id}`}
      className="block bg-white rounded-lg border border-gray-200 hover:border-primary-300 hover:shadow-md transition-all overflow-hidden"
    >
      <div className="flex">
        {/* Date column */}
        <div className="w-24 bg-primary-50 flex flex-col items-center justify-center p-4">
          <span className="text-3xl font-bold text-primary-600">
            {startsAt.getDate()}
          </span>
          <span className="text-sm text-primary-700 uppercase">
            {startsAt.toLocaleDateString('fr-FR', { month: 'short' })}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 p-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">{event.title}</h3>
              {event.groupName && (
                <p className="text-sm text-gray-500">Dans {event.groupName}</p>
              )}
            </div>
            {event.userStatus && (
              <span
                className={clsx(
                  'px-2 py-1 text-xs font-medium rounded-full',
                  event.userStatus === 'going' && 'bg-green-100 text-green-700',
                  event.userStatus === 'maybe' && 'bg-yellow-100 text-yellow-700'
                )}
              >
                {event.userStatus === 'going' ? 'Inscrit' : 'Peut-être'}
              </span>
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <ClockIcon className="w-4 h-4" />
              {formatDate()} à {formatTime()}
            </span>
            {event.locationName && (
              <span className="flex items-center gap-1">
                <LocationIcon className="w-4 h-4" />
                {event.locationName}
              </span>
            )}
            <span className="flex items-center gap-1">
              <UsersIcon className="w-4 h-4" />
              {event.participantCount} participant{event.participantCount > 1 ? 's' : ''}
              {event.maxParticipants && ` / ${event.maxParticipants}`}
            </span>
          </div>

          {event.description && (
            <p className="mt-2 text-sm text-gray-600 line-clamp-2">{event.description}</p>
          )}
        </div>
      </div>
    </Link>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
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

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
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
