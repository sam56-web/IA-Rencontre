import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../../../components/ui/Card';
import { INTENTION_LABELS } from '../../../types';
import type { ProfilePreview } from '../../../types';

interface ProfileCardProps {
  profile: ProfilePreview;
}

export function ProfileCard({ profile }: ProfileCardProps) {
  const navigate = useNavigate();

  const getActivityLabel = (category: ProfilePreview['lastActiveCategory']) => {
    switch (category) {
      case 'now':
        return 'En ligne';
      case 'today':
        return "Aujourd'hui";
      case 'week':
        return 'Cette semaine';
      case 'month':
        return 'Ce mois';
      default:
        return 'Inactif';
    }
  };

  return (
    <Card
      hover
      onClick={() => navigate(`/profile/${profile.userId}`)}
      className="overflow-hidden"
    >
      <div className="flex">
        {/* Photo */}
        <div className="w-32 h-40 flex-shrink-0 bg-warm-100">
          {profile.mainPhotoUrl ? (
            <img
              src={profile.mainPhotoUrl}
              alt={profile.username}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-4xl text-warm-400">
                {profile.username[0].toUpperCase()}
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <CardContent className="flex-1 p-4">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h3 className="font-semibold text-gray-900">{profile.username}</h3>
              <p className="text-sm text-gray-500">
                {profile.age && `${profile.age} ans • `}
                {profile.location.city || profile.location.country}
              </p>
            </div>
            <span
              className={`text-xs px-2 py-1 rounded-full ${
                profile.lastActiveCategory === 'now'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {getActivityLabel(profile.lastActiveCategory)}
            </span>
          </div>

          {/* Preview text */}
          <p className="text-sm text-gray-700 font-serif italic line-clamp-2 mb-3">
            "{profile.currentLifePreview}"
          </p>

          {/* Matched intentions */}
          {profile.matchedIntentions.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {profile.matchedIntentions.map((intention) => (
                <span
                  key={intention}
                  className="text-xs px-2 py-0.5 bg-primary-100 text-primary-700 rounded-full"
                >
                  {INTENTION_LABELS[intention]}
                </span>
              ))}
            </div>
          )}

          {/* Location badge */}
          {(profile.isLocal || profile.openToRemote) && (
            <div className="mt-2 flex gap-2">
              {profile.isLocal && (
                <span className="text-xs text-green-600">Près de chez vous</span>
              )}
              {profile.openToRemote && !profile.isLocal && (
                <span className="text-xs text-blue-600">Ouvert au virtuel</span>
              )}
            </div>
          )}
        </CardContent>
      </div>
    </Card>
  );
}
