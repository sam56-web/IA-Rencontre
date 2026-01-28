import { Link } from 'react-router-dom';
import clsx from 'clsx';

interface AffinityMatch {
  id: string;
  username: string;
  avatarUrl: string | null;
  bio: string | null;
  city: string | null;
  themes: string[];
  intentions: string[];
  lastActive: string | null;
  affinityScore: number;
}

interface AffinityCardProps {
  match: AffinityMatch;
}

export function AffinityCard({ match }: AffinityCardProps) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-100';
    if (score >= 60) return 'text-blue-600 bg-blue-100';
    if (score >= 40) return 'text-yellow-600 bg-yellow-100';
    return 'text-gray-600 bg-gray-100';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Excellente affinité';
    if (score >= 60) return 'Bonne affinité';
    if (score >= 40) return 'Affinité modérée';
    return 'Affinité faible';
  };

  const formatLastActive = () => {
    if (!match.lastActive) return null;

    const date = new Date(match.lastActive);
    const now = new Date();
    const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

    if (diffHours < 1) return 'En ligne';
    if (diffHours < 24) return `Actif il y a ${diffHours}h`;
    if (diffHours < 168) return `Actif il y a ${Math.floor(diffHours / 24)}j`;
    return null;
  };

  const lastActiveText = formatLastActive();

  return (
    <Link
      to={`/profile/${match.id}`}
      className="block bg-white rounded-xl border border-gray-200 hover:border-primary-300 hover:shadow-md transition-all overflow-hidden"
    >
      <div className="flex p-4 gap-4">
        {/* Avatar */}
        <div className="flex-shrink-0">
          {match.avatarUrl ? (
            <img
              src={match.avatarUrl}
              alt={match.username}
              className="w-20 h-20 rounded-full object-cover"
            />
          ) : (
            <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center">
              <span className="text-2xl font-bold text-primary-600">
                {match.username.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold text-gray-900">{match.username}</h3>
              {match.city && (
                <p className="text-sm text-gray-500 flex items-center gap-1">
                  <LocationIcon className="w-4 h-4" />
                  {match.city}
                </p>
              )}
            </div>

            {/* Affinity score */}
            <div className="text-right flex-shrink-0">
              <div
                className={clsx(
                  'inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm font-semibold',
                  getScoreColor(match.affinityScore)
                )}
              >
                <HeartIcon className="w-4 h-4" />
                {match.affinityScore}%
              </div>
              <p className="text-xs text-gray-500 mt-1">{getScoreLabel(match.affinityScore)}</p>
            </div>
          </div>

          {/* Bio */}
          {match.bio && (
            <p className="text-sm text-gray-600 mt-2 line-clamp-2">{match.bio}</p>
          )}

          {/* Themes */}
          {match.themes.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {match.themes.slice(0, 4).map((theme) => (
                <span
                  key={theme}
                  className="px-2 py-0.5 bg-primary-50 text-primary-700 text-xs rounded-full"
                >
                  {theme}
                </span>
              ))}
              {match.themes.length > 4 && (
                <span className="text-xs text-gray-500">+{match.themes.length - 4}</span>
              )}
            </div>
          )}

          {/* Last active */}
          {lastActiveText && (
            <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
              <span
                className={clsx(
                  'w-2 h-2 rounded-full',
                  lastActiveText === 'En ligne' ? 'bg-green-500' : 'bg-gray-300'
                )}
              />
              {lastActiveText}
            </p>
          )}
        </div>
      </div>
    </Link>
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

function HeartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    </svg>
  );
}
