import { useState, useEffect } from 'react';
import { Layout } from '../../components/layout/Layout';
import { Button } from '../../components/ui/Button';
import { useDiscovery } from '../../hooks/useDiscovery';
import { useAffinityMatches } from '../../hooks/useAffinity';
import { ProfileCard } from './components/ProfileCard';
import { AffinityCard } from './components/AffinityCard';
import { ModeSelector } from './components/ModeSelector';
import { ZoneVitality } from './components/ZoneVitality';
import { INTENTIONS, INTENTION_LABELS } from '../../types';
import type { DiscoveryMode, Intention } from '../../types';

export function DiscoverPage() {
  const [mode, setMode] = useState<DiscoveryMode>('around_me');
  const [selectedIntentions, setSelectedIntentions] = useState<Intention[]>([]);

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useDiscovery({
    mode: mode === 'by_affinity' ? 'everywhere' : mode,
    intentions: mode === 'by_intention' ? selectedIntentions : undefined,
  });

  const {
    data: affinityData,
    isLoading: affinityLoading,
  } = useAffinityMatches({ limit: 20 });

  useEffect(() => {
    if (mode !== 'by_affinity') {
      refetch();
    }
  }, [mode, selectedIntentions, refetch]);

  const profiles = data?.pages.flatMap((page) => page.profiles) || [];
  const affinityMatches = affinityData?.users || [];

  const toggleIntention = (intention: Intention) => {
    setSelectedIntentions((prev) =>
      prev.includes(intention)
        ? prev.filter((i) => i !== intention)
        : [...prev, intention]
    );
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Découvrir</h1>
          <p className="text-gray-600">Trouvez des personnes qui partagent vos intentions</p>
        </div>

        {/* Mode selector */}
        <div className="mb-6">
          <ModeSelector mode={mode} onChange={setMode} />
        </div>

        {/* Intention filter (for by_intention mode) */}
        {mode === 'by_intention' && (
          <div className="mb-6 p-4 bg-white rounded-lg border border-gray-200">
            <p className="text-sm font-medium text-gray-700 mb-3">
              Filtrer par intention :
            </p>
            <div className="flex flex-wrap gap-2">
              {INTENTIONS.map((intention) => (
                <button
                  key={intention}
                  onClick={() => toggleIntention(intention)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    selectedIntentions.includes(intention)
                      ? 'bg-primary-100 text-primary-700 border-2 border-primary-500'
                      : 'bg-gray-100 text-gray-700 border-2 border-transparent hover:bg-gray-200'
                  }`}
                >
                  {INTENTION_LABELS[intention]}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Zone vitality (for around_me mode) */}
        {mode === 'around_me' && (
          <div className="mb-6">
            <ZoneVitality />
          </div>
        )}

        {/* Results */}
        {mode === 'by_affinity' ? (
          // Affinity mode
          affinityLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-40 bg-gray-100 rounded-xl animate-pulse"
                />
              ))}
            </div>
          ) : affinityMatches.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600 mb-4">
                Aucune affinité trouvée. Complétez votre profil pour améliorer les correspondances.
              </p>
              <Button variant="outline" onClick={() => setMode('everywhere')}>
                Voir tous les profils
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {affinityMatches.map((match) => (
                <AffinityCard key={match.id} match={match} />
              ))}
            </div>
          )
        ) : (
          // Other modes
          isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-40 bg-gray-100 rounded-xl animate-pulse"
                />
              ))}
            </div>
          ) : profiles.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600 mb-4">
                Aucun profil trouvé avec ces critères.
              </p>
              <Button variant="outline" onClick={() => setMode('everywhere')}>
                Voir tous les profils
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {profiles.map((profile) => (
                <ProfileCard key={profile.userId} profile={profile} />
              ))}

              {/* Load more */}
              {hasNextPage && (
                <div className="text-center pt-4">
                  <Button
                    variant="outline"
                    onClick={() => fetchNextPage()}
                    isLoading={isFetchingNextPage}
                  >
                    Charger plus de profils
                  </Button>
                </div>
              )}
            </div>
          )
        )}
      </div>
    </Layout>
  );
}
