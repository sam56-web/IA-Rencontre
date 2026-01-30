import { useState, useEffect } from 'react';
import { Layout } from '../../components/layout/Layout';
import { Button } from '../../components/ui/Button';
import { useDiscovery } from '../../hooks/useDiscovery';
import { useAffinityMatches } from '../../hooks/useAffinity';
import { ProfileCard } from './components/ProfileCard';
import { AffinityCard } from './components/AffinityCard';
import { ModeSelector } from './components/ModeSelector';
import { ZoneVitality } from './components/ZoneVitality';
import { INTENTION_LABELS } from '../../types';
import type { DiscoveryMode, Intention } from '../../types';
import { extractKeywords, THEME_LABELS } from '../../utils/keywordExtractor';

export function DiscoverPage() {
  const [mode, setMode] = useState<DiscoveryMode>('geography');
  const [selectedIntentions, setSelectedIntentions] = useState<Intention[]>([]);

  // États pour la recherche - inputs temporaires
  const [cityInput, setCityInput] = useState('');
  const [affinityInput, setAffinityInput] = useState('');
  const [intentionInput, setIntentionInput] = useState('');

  // États pour les filtres validés
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [selectedThemes, setSelectedThemes] = useState<string[]>([]);
  const [radius, setRadius] = useState(0); // 0 = illimité
  const [ageFilter, setAgeFilter] = useState({ min: '', max: '' });

  // Remove criteria functions
  const removeCity = () => setSelectedCity(null);
  const removeTheme = (theme: string) => {
    setSelectedThemes(prev => prev.filter(t => t !== theme));
  };
  const removeIntention = (intention: Intention) => {
    setSelectedIntentions(prev => prev.filter(i => i !== intention));
  };

  // Check if any criteria are active
  const hasActiveCriteria = selectedCity ||
    selectedThemes.length > 0 ||
    selectedIntentions.length > 0 ||
    ageFilter.min ||
    ageFilter.max;

  // Handle Enter key in geography mode
  const handleCitySubmit = () => {
    if (cityInput.trim()) {
      const extracted = extractKeywords(cityInput);
      if (extracted.city) {
        setSelectedCity(extracted.city);
      } else {
        setSelectedCity(cityInput.trim());
      }
      // Also extract any themes
      if (extracted.themes.length > 0) {
        setSelectedThemes(prev => [...new Set([...prev, ...extracted.themes])]);
      }
      setCityInput(''); // Clear input after validation
    }
  };

  // Handle Enter key in affinities mode
  const handleAffinitySubmit = () => {
    if (affinityInput.trim()) {
      const extracted = extractKeywords(affinityInput);
      if (extracted.themes.length > 0) {
        setSelectedThemes(prev => [...new Set([...prev, ...extracted.themes])]);
      }
      if (extracted.city) {
        setSelectedCity(extracted.city);
      }
      setAffinityInput(''); // Clear input after validation
    }
  };

  // Handle Enter key in intentions mode
  const handleIntentionSubmit = () => {
    if (intentionInput.trim()) {
      const extracted = extractKeywords(intentionInput);
      if (extracted.intentions.length > 0) {
        // Map extracted intentions to actual Intention type
        const intentionMap: Record<string, Intention> = {
          'amitie': 'friendship',
          'romance': 'romantic',
          'projet': 'creative_project',
          'discussions': 'discussions',
        };
        extracted.intentions.forEach(i => {
          const mapped = intentionMap[i];
          if (mapped && !selectedIntentions.includes(mapped)) {
            setSelectedIntentions(prev => [...prev, mapped]);
          }
        });
      }
      if (extracted.city) {
        setSelectedCity(extracted.city);
      }
      setIntentionInput(''); // Clear input after validation
    }
  };

  const getSearchParams = () => {
    const location = selectedCity || undefined;
    const themes = selectedThemes.length > 0 ? selectedThemes : undefined;

    switch (mode) {
      case 'geography':
        return {
          location,
          themes,
          minAge: ageFilter.min ? parseInt(ageFilter.min) : undefined,
          maxAge: ageFilter.max ? parseInt(ageFilter.max) : undefined,
        };
      case 'affinities':
        return {
          themes,
          location,
        };
      case 'intentions':
        return {
          location,
          themes,
        };
      default:
        return {};
    }
  };

  const searchParams = getSearchParams();

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useDiscovery({
    mode,
    intentions: mode === 'intentions' ? selectedIntentions : undefined,
    ...searchParams,
  });

  const {
    data: affinityData,
    isLoading: affinityLoading,
  } = useAffinityMatches({ limit: 20 });

  useEffect(() => {
    refetch();
  }, [mode, selectedIntentions, selectedCity, selectedThemes, ageFilter, refetch]);

  const profiles = data?.pages.flatMap((page) => page.profiles) || [];
  const affinityMatches = affinityData?.users || [];

  const renderSearchBar = () => {
    switch (mode) {
      case 'geography':
        return (
          <div className="mb-6 p-4 bg-white rounded-lg shadow-sm border border-gray-200">
            <h3 className="font-medium mb-3">📍 Recherche géographique</h3>

            {/* Lieu */}
            <div className="mb-4">
              <label className="text-sm text-gray-600 mb-1 block">Lieu</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <MapPinIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    value={cityInput}
                    onChange={(e) => setCityInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCitySubmit()}
                    placeholder="Ville, pays... (ex: Paris, France)"
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <button
                  onClick={handleCitySubmit}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  OK
                </button>
              </div>
            </div>

            {/* Rayon */}
            <div className="mb-4">
              <label className="text-sm text-gray-600 mb-1 block">Rayon</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 0, label: 'Illimité' },
                  { value: 5, label: '5 km' },
                  { value: 10, label: '10 km' },
                  { value: 20, label: '20 km' },
                  { value: 50, label: '50 km' },
                  { value: 100, label: '100 km' },
                ].map(r => (
                  <button
                    key={r.value}
                    onClick={() => setRadius(r.value)}
                    className={`px-3 py-1 rounded-full text-sm transition-colors ${
                      radius === r.value
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Âge */}
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Tranche d'âge</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={ageFilter.min}
                  onChange={(e) => setAgeFilter({ ...ageFilter, min: e.target.value })}
                  placeholder="Min"
                  min="18"
                  max="99"
                  className="w-20 px-3 py-2 border rounded-lg text-center"
                />
                <span className="text-gray-400">—</span>
                <input
                  type="number"
                  value={ageFilter.max}
                  onChange={(e) => setAgeFilter({ ...ageFilter, max: e.target.value })}
                  placeholder="Max"
                  min="18"
                  max="99"
                  className="w-20 px-3 py-2 border rounded-lg text-center"
                />
                <span className="text-sm text-gray-500">ans</span>
              </div>
            </div>
          </div>
        );

      case 'affinities':
        return (
          <div className="mb-6 p-4 bg-white rounded-lg shadow-sm border border-gray-200">
            <h3 className="font-medium mb-3">💜 Rechercher par centres d'intérêt</h3>
            <div className="relative mb-4">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                value={affinityInput}
                onChange={(e) => setAffinityInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAffinitySubmit()}
                placeholder="Rechercher (musique, photo, voyage...)"
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

      case 'intentions':
        return (
          <div className="mb-6 p-4 bg-white rounded-lg shadow-sm border border-gray-200">
            <h3 className="font-medium mb-3">🎯 Rechercher par intention</h3>

            {/* Barre de recherche */}
            <div className="relative mb-4">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                value={intentionInput}
                onChange={(e) => setIntentionInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleIntentionSubmit()}
                placeholder="Rechercher (ami, projet, discussion...)"
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            {/* Boutons intentions */}
            <div className="flex flex-wrap gap-2">
              {[
                { slug: 'friendship' as Intention, label: '👋 Amitié' },
                { slug: 'romantic' as Intention, label: '❤️ Romance' },
                { slug: 'creative_project' as Intention, label: '🚀 Projet' },
                { slug: 'discussions' as Intention, label: '💬 Discussions' },
                { slug: 'travel_experiences' as Intention, label: '✈️ Voyages' },
              ].map(intention => (
                <button
                  key={intention.slug}
                  onClick={() => {
                    setSelectedIntentions(prev =>
                      prev.includes(intention.slug)
                        ? prev.filter(i => i !== intention.slug)
                        : [...prev, intention.slug]
                    );
                  }}
                  className={`px-4 py-2 rounded-full text-sm transition-colors ${
                    selectedIntentions.includes(intention.slug)
                      ? 'bg-pink-500 text-white'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  {intention.label}
                </button>
              ))}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto flex gap-6">
        {/* Main content - LEFT */}
        <div className="flex-1 max-w-3xl">
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

        {/* Zone vitality (for geography mode) */}
        {mode === 'geography' && (
          <div className="mb-6">
            <ZoneVitality />
          </div>
        )}

        {/* Results */}
        {mode === 'affinities' && affinityData ? (
          // Affinity mode with affinity data
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
              <Button variant="outline" onClick={() => setMode('geography')}>
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
              <Button variant="outline" onClick={() => {
                // Clear all filters
                setSelectedCity(null);
                setSelectedThemes([]);
                setSelectedIntentions([]);
                setAgeFilter({ min: '', max: '' });
              }}>
                Effacer les filtres
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

        {/* Right column - Active criteria */}
        {hasActiveCriteria && (
          <div className="hidden lg:block w-64 flex-shrink-0">
            <div className="sticky top-4 p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
              <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                <FilterIcon className="w-4 h-4" />
                Critères actifs
              </h3>

              {/* City */}
              {selectedCity && (
                <div className="mb-3">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Lieu</p>
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-sm">
                    <MapPinIcon className="w-3 h-3" />
                    {selectedCity}
                    <button
                      onClick={removeCity}
                      className="ml-1 hover:text-blue-900"
                      title="Supprimer"
                    >
                      <XIcon className="w-3 h-3" />
                    </button>
                  </span>
                </div>
              )}

              {/* Themes */}
              {selectedThemes.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Thèmes</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedThemes.map(theme => (
                      <span key={theme} className="inline-flex items-center gap-1 px-2 py-1 bg-purple-50 text-purple-700 rounded-full text-xs">
                        {THEME_LABELS[theme] || theme}
                        <button
                          onClick={() => removeTheme(theme)}
                          className="ml-1 hover:text-purple-900"
                          title="Supprimer"
                        >
                          <XIcon className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Intentions */}
              {selectedIntentions.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Intentions</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedIntentions.map(intention => (
                      <span key={intention} className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 rounded-full text-xs">
                        {INTENTION_LABELS[intention] || intention}
                        <button
                          onClick={() => removeIntention(intention)}
                          className="ml-1 hover:text-green-900"
                          title="Supprimer"
                        >
                          <XIcon className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Age filter display */}
              {(ageFilter.min || ageFilter.max) && (
                <div className="mb-3">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Âge</p>
                  <span className="px-2 py-1 bg-orange-50 text-orange-700 rounded-full text-xs">
                    {ageFilter.min || '18'} - {ageFilter.max || '99'} ans
                  </span>
                </div>
              )}
            </div>
          </div>
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

function FilterIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
    </svg>
  );
}
