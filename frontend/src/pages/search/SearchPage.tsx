import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '../../components/layout/Layout';
import { SearchBar } from '../../components/SearchBar';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { searchApi, themesApi, SearchFilters, SearchProfileResult, getUploadUrl } from '../../services/api';
import { INTENTION_LABELS, Intention } from '../../types';

const INTENTIONS_LIST: Intention[] = [
  'romantic',
  'friendship',
  'discussions',
  'creative_project',
  'professional',
  'travel_experiences',
  'not_sure_yet',
];

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Get query from URL
  const query = searchParams.get('q') || '';

  // Filter state
  const [filters, setFilters] = useState<SearchFilters>({
    intentions: searchParams.get('intentions')?.split(',').filter(Boolean) || undefined,
    themeIds: searchParams.get('themeIds')?.split(',').filter(Boolean) || undefined,
    minAge: searchParams.get('minAge') ? parseInt(searchParams.get('minAge')!, 10) : undefined,
    maxAge: searchParams.get('maxAge') ? parseInt(searchParams.get('maxAge')!, 10) : undefined,
    city: searchParams.get('city') || undefined,
  });
  const [showFilters, setShowFilters] = useState(false);

  // Fetch themes for filter
  const { data: themes = [] } = useQuery({
    queryKey: ['themes'],
    queryFn: themesApi.getAllThemes,
  });

  // Fetch search results
  const { data: searchResult, isLoading, error } = useQuery({
    queryKey: ['search', query, filters],
    queryFn: () => searchApi.search(query, filters),
    enabled: query.length >= 2,
  });

  // Update URL when filters change
  const updateFilters = (newFilters: Partial<SearchFilters>) => {
    const updated = { ...filters, ...newFilters };
    setFilters(updated);

    // Update URL params
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (updated.intentions?.length) params.set('intentions', updated.intentions.join(','));
    if (updated.themeIds?.length) params.set('themeIds', updated.themeIds.join(','));
    if (updated.minAge) params.set('minAge', updated.minAge.toString());
    if (updated.maxAge) params.set('maxAge', updated.maxAge.toString());
    if (updated.city) params.set('city', updated.city);
    setSearchParams(params);
  };

  const handleSearch = (newQuery: string) => {
    const params = new URLSearchParams(searchParams);
    params.set('q', newQuery);
    setSearchParams(params);
  };

  const clearFilters = () => {
    setFilters({});
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    setSearchParams(params);
  };

  const hasActiveFilters = filters.intentions?.length || filters.themeIds?.length || filters.minAge || filters.maxAge || filters.city;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        {/* Search header */}
        <div className="mb-6">
          <SearchBar
            initialQuery={query}
            onSearch={handleSearch}
            autoFocus={!query}
          />
        </div>

        {/* Results info and filter toggle */}
        {query && (
          <div className="flex items-center justify-between mb-4">
            <div className="text-gray-600">
              {isLoading ? (
                'Recherche en cours...'
              ) : searchResult ? (
                <>
                  <span className="font-medium">{searchResult.total}</span> résultat{searchResult.total !== 1 ? 's' : ''} pour "<span className="font-medium">{searchResult.query}</span>"
                </>
              ) : null}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              <FilterIcon className="w-4 h-4 mr-2" />
              Filtres
              {hasActiveFilters && (
                <span className="ml-2 w-2 h-2 bg-primary-500 rounded-full" />
              )}
            </Button>
          </div>
        )}

        {/* Filters panel */}
        {showFilters && (
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Intentions filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Intentions
                  </label>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {INTENTIONS_LIST.map((intention) => (
                      <label key={intention} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={filters.intentions?.includes(intention) || false}
                          onChange={(e) => {
                            const current = filters.intentions || [];
                            const updated = e.target.checked
                              ? [...current, intention]
                              : current.filter(i => i !== intention);
                            updateFilters({ intentions: updated.length ? updated : undefined });
                          }}
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                        <span className="text-sm text-gray-700">{INTENTION_LABELS[intention]}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Age filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tranche d'age
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      placeholder="Min"
                      value={filters.minAge || ''}
                      onChange={(e) => updateFilters({ minAge: e.target.value ? parseInt(e.target.value, 10) : undefined })}
                      className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                      min={18}
                      max={99}
                    />
                    <span className="text-gray-400">-</span>
                    <input
                      type="number"
                      placeholder="Max"
                      value={filters.maxAge || ''}
                      onChange={(e) => updateFilters({ maxAge: e.target.value ? parseInt(e.target.value, 10) : undefined })}
                      className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                      min={18}
                      max={99}
                    />
                    <span className="text-sm text-gray-500">ans</span>
                  </div>
                </div>

                {/* City filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ville
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Paris"
                    value={filters.city || ''}
                    onChange={(e) => updateFilters({ city: e.target.value || undefined })}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
                  />
                </div>

                {/* Themes filter */}
                <div className="md:col-span-2 lg:col-span-3">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Thematiques
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {themes.map((theme) => (
                      <button
                        key={theme.id}
                        onClick={() => {
                          const current = filters.themeIds || [];
                          const updated = current.includes(theme.id)
                            ? current.filter(id => id !== theme.id)
                            : [...current, theme.id];
                          updateFilters({ themeIds: updated.length ? updated : undefined });
                        }}
                        className={`px-3 py-1 rounded-full text-sm transition-colors ${
                          filters.themeIds?.includes(theme.id)
                            ? 'bg-primary-500 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {theme.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Clear filters */}
              {hasActiveFilters && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <button
                    onClick={clearFilters}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    Effacer tous les filtres
                  </button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {!query ? (
          <EmptyState type="no-query" />
        ) : isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse bg-gray-100 rounded-xl h-40" />
            ))}
          </div>
        ) : error ? (
          <EmptyState type="error" />
        ) : searchResult?.profiles.length === 0 ? (
          <EmptyState type="no-results" query={query} />
        ) : (
          <div className="space-y-4">
            {searchResult?.profiles.map((profile) => (
              <SearchResultCard key={profile.userId} profile={profile} />
            ))}
          </div>
        )}

        {/* Pagination info */}
        {searchResult && searchResult.total > searchResult.profiles.length && (
          <div className="mt-6 text-center text-gray-500 text-sm">
            Affichage de {searchResult.profiles.length} sur {searchResult.total} résultats
          </div>
        )}
      </div>
    </Layout>
  );
}

// Search Result Card
function SearchResultCard({ profile }: { profile: SearchProfileResult }) {
  const navigate = useNavigate();

  const getActivityLabel = (category: SearchProfileResult['lastActiveCategory']) => {
    switch (category) {
      case 'now': return 'En ligne';
      case 'today': return "Aujourd'hui";
      case 'week': return 'Cette semaine';
      case 'month': return 'Ce mois';
      default: return 'Inactif';
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
              src={getUploadUrl(profile.mainPhotoUrl)}
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
                {profile.locationCity || profile.locationCountry}
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

          {/* Intentions */}
          <div className="flex flex-wrap gap-1">
            {profile.intentions.slice(0, 3).map((intention) => (
              <span
                key={intention}
                className="text-xs px-2 py-0.5 bg-primary-100 text-primary-700 rounded-full"
              >
                {INTENTION_LABELS[intention as Intention] || intention}
              </span>
            ))}
          </div>

          {/* Themes */}
          {profile.themes.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {profile.themes.slice(0, 3).map((theme, i) => (
                <span
                  key={i}
                  className="text-xs px-2 py-0.5 bg-warm-100 text-warm-700 rounded-full"
                >
                  {theme}
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </div>
    </Card>
  );
}

// Empty States
function EmptyState({ type, query }: { type: 'no-query' | 'no-results' | 'error'; query?: string }) {
  if (type === 'no-query') {
    return (
      <div className="text-center py-12">
        <SearchIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Rechercher des profils</h3>
        <p className="text-gray-500">
          Tapez un mot-clé pour trouver des profils correspondants.<br />
          Par exemple : "créatif", "randonnée", "développeur Paris"
        </p>
      </div>
    );
  }

  if (type === 'error') {
    return (
      <div className="text-center py-12">
        <div className="text-red-400 mb-4">
          <XCircleIcon className="w-12 h-12 mx-auto" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Erreur de recherche</h3>
        <p className="text-gray-500">
          Une erreur s'est produite. Veuillez réessayer.
        </p>
      </div>
    );
  }

  return (
    <div className="text-center py-12">
      <SearchIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
      <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun résultat</h3>
      <p className="text-gray-500">
        Aucun profil ne correspond à "{query}".<br />
        Essayez avec d'autres mots-clés ou ajustez les filtres.
      </p>
    </div>
  );
}

// Icons
function FilterIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

function XCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
