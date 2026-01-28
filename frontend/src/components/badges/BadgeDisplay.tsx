import clsx from 'clsx';
import { Badge, UserBadge } from '../../hooks/useBadges';

interface BadgeDisplayProps {
  badge: Badge | UserBadge;
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
  earned?: boolean;
}

const colorMap: Record<string, { bg: string; text: string; border: string }> = {
  blue: { bg: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-200' },
  green: { bg: 'bg-green-100', text: 'text-green-600', border: 'border-green-200' },
  purple: { bg: 'bg-purple-100', text: 'text-purple-600', border: 'border-purple-200' },
  yellow: { bg: 'bg-yellow-100', text: 'text-yellow-600', border: 'border-yellow-200' },
  orange: { bg: 'bg-orange-100', text: 'text-orange-600', border: 'border-orange-200' },
  pink: { bg: 'bg-pink-100', text: 'text-pink-600', border: 'border-pink-200' },
  red: { bg: 'bg-red-100', text: 'text-red-600', border: 'border-red-200' },
  cyan: { bg: 'bg-cyan-100', text: 'text-cyan-600', border: 'border-cyan-200' },
  amber: { bg: 'bg-amber-100', text: 'text-amber-600', border: 'border-amber-200' },
  violet: { bg: 'bg-violet-100', text: 'text-violet-600', border: 'border-violet-200' },
};

const sizeMap = {
  sm: { container: 'w-8 h-8', icon: 'w-4 h-4' },
  md: { container: 'w-12 h-12', icon: 'w-6 h-6' },
  lg: { container: 'w-16 h-16', icon: 'w-8 h-8' },
};

export function BadgeDisplay({ badge, size = 'md', showTooltip = true, earned = true }: BadgeDisplayProps) {
  const colors = colorMap[badge.color || 'blue'] || colorMap.blue;
  const sizes = sizeMap[size];

  return (
    <div className="relative group inline-block">
      <div
        className={clsx(
          'rounded-full flex items-center justify-center border-2 transition-transform',
          sizes.container,
          earned ? [colors.bg, colors.border] : 'bg-gray-100 border-gray-200',
          !earned && 'opacity-50 grayscale',
          earned && 'hover:scale-110'
        )}
      >
        <BadgeIcon
          icon={badge.icon || 'star'}
          className={clsx(sizes.icon, earned ? colors.text : 'text-gray-400')}
        />
      </div>

      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
          <p className="font-medium">{badge.name}</p>
          {badge.description && <p className="text-gray-300 text-xs">{badge.description}</p>}
          {'earnedAt' in badge && (
            <p className="text-gray-400 text-xs mt-1">
              Obtenu le {new Date(badge.earnedAt).toLocaleDateString('fr-FR')}
            </p>
          )}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </div>
      )}
    </div>
  );
}

interface BadgesListProps {
  badges: (Badge | UserBadge)[];
  size?: 'sm' | 'md' | 'lg';
  maxDisplay?: number;
  earned?: boolean;
}

export function BadgesList({ badges, size = 'md', maxDisplay, earned = true }: BadgesListProps) {
  const displayBadges = maxDisplay ? badges.slice(0, maxDisplay) : badges;
  const remaining = maxDisplay && badges.length > maxDisplay ? badges.length - maxDisplay : 0;

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {displayBadges.map((badge) => (
        <BadgeDisplay key={badge.id} badge={badge} size={size} earned={earned} />
      ))}
      {remaining > 0 && (
        <span className="text-sm text-gray-500">+{remaining}</span>
      )}
    </div>
  );
}

interface BadgeIconProps {
  icon: string;
  className?: string;
}

function BadgeIcon({ icon, className }: BadgeIconProps) {
  switch (icon) {
    case 'badge-check':
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
        </svg>
      );
    case 'user-check':
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      );
    case 'message-circle':
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      );
    case 'sparkles':
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
        </svg>
      );
    case 'users':
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      );
    case 'calendar':
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
    case 'rocket':
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
        </svg>
      );
    case 'link':
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      );
    case 'butterfly':
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      );
    case 'star':
    default:
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
      );
  }
}

interface BadgesGridProps {
  allBadges: Badge[];
  earnedBadges: UserBadge[];
}

export function BadgesGrid({ allBadges, earnedBadges }: BadgesGridProps) {
  const earnedIds = new Set(earnedBadges.map((b) => b.id));

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      {allBadges.map((badge) => {
        const earned = earnedIds.has(badge.id);
        const userBadge = earned ? earnedBadges.find((b) => b.id === badge.id) : undefined;

        return (
          <div
            key={badge.id}
            className={clsx(
              'p-4 rounded-xl border text-center transition-all',
              earned
                ? 'bg-white border-gray-200 hover:shadow-md'
                : 'bg-gray-50 border-gray-100'
            )}
          >
            <div className="flex justify-center mb-3">
              <BadgeDisplay
                badge={userBadge || badge}
                size="lg"
                showTooltip={false}
                earned={earned}
              />
            </div>
            <h3
              className={clsx(
                'font-medium',
                earned ? 'text-gray-900' : 'text-gray-400'
              )}
            >
              {badge.name}
            </h3>
            <p className={clsx('text-sm mt-1', earned ? 'text-gray-500' : 'text-gray-400')}>
              {badge.description}
            </p>
            {userBadge && (
              <p className="text-xs text-primary-600 mt-2">
                Obtenu le {new Date(userBadge.earnedAt).toLocaleDateString('fr-FR')}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
