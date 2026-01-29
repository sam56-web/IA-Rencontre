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

  // États pour la recherche
  const [citySearch, setCitySearch] = useState('');
  const [radius, setRadius] = useState(20);
  const [interestSearch, setInterestSearch] = useState('');
  const [selectedThemes, setSelectedThemes] = useState<string[]>([]);
  const [globalSearch, setGlobalSearch] = useState('');
  const [ageFilter, setAgeFilter] = useState({ min: '', max: '' });

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

  const renderSearchBar = () => {
    switch (mode) {
      case 'around_me':
        return (
          <div className="mb-6 p-4 bg-white rounded-lg shadow-sm border border-gray-200">
            <h3 className="font-medium mb-3 flex items-center gap-2">
              <MapPinIcon className="w-4 h-4" />
              Rechercher par lieu
            </h3>
            <div className="flex gap-2 mb-3">
              <div className="relative flex-1">
                <MapPinIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  value={citySearch}
                  onChange={(e) => setCitySearch(e.target.value)}
                  placeholder="Entrez une ville (Paris, Lyon, New York...)"
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              {citySearch && (
                <button onClick={() => setCitySearch('')} className="px-3 py-2 text-gray-500 hover:text-gray-700">
                  <XIcon className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-gray-600">Rayon :</span>
              {[5, 10, 20, 50, 100].map(r => (
                <button
                  key={r}
                  onClick={() => setRadius(r)}
                  className={`px-3 py-1 rounded-full text-sm transition-colors ${
                    radius === r
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  {r} km
                </button>
              ))}
            </div>
          </div>
        );

      case 'by_affinity':
        return (
          <div className="mb-6 p-4 bg-white rounded-lg shadow-sm border border-gray-200">
            <h3 className="font-medium mb-3 flex items-center gap-2">
              <SearchIcon className="w-4 h-4" />
              Rechercher par centres d'intérêt
            </h3>
            <div className="relative mb-3">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                value={interestSearch}
                onChange={(e) => setInterestSearch(e.target.value)}
                placeholder="Rechercher (photographe, musicien, cinéphile...)"
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { slug: 'art', label: '🎨 Art' },
                { slug: 'politique', label: '🏛️ Politique' },
                { slug: 'science', label: '🔬 Science' },
                { slug: 'musique', label: '🎵 Musique' },
                { slug: 'cinema', label: '🎬 Cinéma' },
                { slug: 'litterature', label: '📚 Littérature' },
                { slug: 'voyage', label: '✈️ Voyage' },
                { slug: 'sport', label: '⚽ Sport' },
              ].map(theme => (
                <button
                  key={theme.slug}
                  onClick={() => setSelectedThemes(prev =>
                    prev.includes(theme.slug)
                      ? prev.filter(t => t !== theme.slug)
                      : [...prev, theme.slug]
                  )}
                  className={`px-3 py-1 rounded-full text-sm transition-colors ${
                    selectedThemes.includes(theme.slug)
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  {theme.label}
                </button>
              ))}
            </div>
          </div>
        );

      case 'everywhere':
        return (
          <div className="mb-6 p-4 bg-white rounded-lg shadow-sm border border-gray-200">
            <h3 className="font-medium mb-3 flex items-center gap-2">
              <SearchIcon className="w-4 h-4" />
              Recherche globale
            </h3>
            <div className="relative mb-3">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                placeholder="Rechercher un profil (nom, intérêt, ville...)"
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <input
                type="text"
                value={citySearch}
                onChange={(e) => setCitySearch(e.target.value)}
                placeholder="Ville"
                className="px-3 py-2 border rounded-lg text-sm"
              />
              <input
                type="number"
                value={ageFilter.min}
                onChange={(e) => setAgeFilter({ ...ageFilter, min: e.target.value })}
                placeholder="Âge min"
                className="px-3 py-2 border rounded-lg text-sm"
              />
              <input
                type="number"
                value={ageFilter.max}
                onChange={(e) => setAgeFilter({ ...ageFilter, max: e.target.value })}
                placeholder="Âge max"
                className="px-3 py-2 border rounded-lg text-sm"
              />
              <button
                onClick={() => {
                  setCitySearch('');
                  setAgeFilter({ min: '', max: '' });
                  setGlobalSearch('');
                }}
                className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm"
              >
                Effacer
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
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

        {/* Search bar contextuelle selon le mode */}
        {renderSearchBar()}

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

// Icons
function MapPinIcon({ className }: { className?: string }) {
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

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
