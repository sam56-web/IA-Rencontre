import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../../components/layout/Layout';
import { Button } from '../../components/ui/Button';
import { themesApi } from '../../services/api';
import type { Theme, ThemeCategory } from '../../types';
import { THEME_CATEGORY_LABELS } from '../../types';
import clsx from 'clsx';

const MAX_THEMES = 10;

const THEME_ICONS: Record<string, JSX.Element> = {
  landmark: <LandmarkIcon />,
  palette: <PaletteIcon />,
  microscope: <MicroscopeIcon />,
  heart: <HeartIcon />,
  music: <MusicIcon />,
  film: <FilmIcon />,
  'book-open': <BookIcon />,
  plane: <PlaneIcon />,
  dumbbell: <DumbbellIcon />,
  'chef-hat': <ChefHatIcon />,
  brain: <BrainIcon />,
  leaf: <LeafIcon />,
  rocket: <RocketIcon />,
  sparkles: <SparklesIcon />,
  'gamepad-2': <GamepadIcon />,
  camera: <CameraIcon />,
  shirt: <ShirtIcon />,
  megaphone: <MegaphoneIcon />,
};

export function ThemesSelectionPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data: themesByCategory, isLoading: loadingThemes } = useQuery({
    queryKey: ['themes', 'by-category'],
    queryFn: themesApi.getThemesByCategory,
  });

  const { data: myThemes, isLoading: loadingMyThemes } = useQuery({
    queryKey: ['themes', 'me'],
    queryFn: themesApi.getMyThemes,
  });

  // Initialize selected themes from user's current themes
  useEffect(() => {
    if (myThemes) {
      setSelectedIds(new Set(myThemes.map((t) => t.id)));
    }
  }, [myThemes]);

  const updateThemes = useMutation({
    mutationFn: (themeIds: string[]) => themesApi.updateMyThemes(themeIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['themes', 'me'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      navigate('/profile');
    },
  });

  const handleToggle = (themeId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(themeId)) {
        next.delete(themeId);
      } else if (next.size < MAX_THEMES) {
        next.add(themeId);
      }
      return next;
    });
  };

  const handleSave = () => {
    updateThemes.mutate(Array.from(selectedIds));
  };

  if (loadingThemes || loadingMyThemes) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-100 rounded w-1/3" />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[...Array(9)].map((_, i) => (
                <div key={i} className="h-24 bg-gray-100 rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  const categories = Object.keys(themesByCategory || {}) as ThemeCategory[];

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Mes centres d'interet</h1>
            <p className="text-gray-600 mt-1">
              Selectionnez jusqu'a {MAX_THEMES} thematiques qui vous passionnent
            </p>
          </div>
          <div className="text-right">
            <span
              className={clsx(
                'text-lg font-semibold',
                selectedIds.size >= MAX_THEMES ? 'text-amber-600' : 'text-gray-700'
              )}
            >
              {selectedIds.size}/{MAX_THEMES}
            </span>
            <p className="text-sm text-gray-500">selectionnees</p>
          </div>
        </div>

        <div className="space-y-8">
          {categories.map((category) => (
            <div key={category}>
              <h2 className="text-lg font-semibold text-gray-800 mb-4">
                {THEME_CATEGORY_LABELS[category] || category}
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {themesByCategory![category].map((theme) => (
                  <ThemeCard
                    key={theme.id}
                    theme={theme}
                    isSelected={selectedIds.has(theme.id)}
                    onToggle={() => handleToggle(theme.id)}
                    disabled={!selectedIds.has(theme.id) && selectedIds.size >= MAX_THEMES}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 flex justify-end gap-3 sticky bottom-4 bg-white/80 backdrop-blur-sm p-4 rounded-xl shadow-lg">
          <Button variant="outline" onClick={() => navigate('/profile')}>
            Annuler
          </Button>
          <Button onClick={handleSave} isLoading={updateThemes.isPending}>
            Enregistrer
          </Button>
        </div>
      </div>
    </Layout>
  );
}

interface ThemeCardProps {
  theme: Theme;
  isSelected: boolean;
  onToggle: () => void;
  disabled: boolean;
}

function ThemeCard({ theme, isSelected, onToggle, disabled }: ThemeCardProps) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className={clsx(
        'p-4 rounded-xl border-2 transition-all text-left',
        'flex items-center gap-3',
        isSelected
          ? 'border-primary-500 bg-primary-50 text-primary-700'
          : disabled
          ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
      )}
    >
      <div
        className={clsx(
          'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
          isSelected ? 'bg-primary-100' : 'bg-gray-100'
        )}
      >
        {theme.icon && THEME_ICONS[theme.icon] ? (
          <span className={clsx('w-5 h-5', isSelected ? 'text-primary-600' : 'text-gray-500')}>
            {THEME_ICONS[theme.icon]}
          </span>
        ) : (
          <span className="text-lg">{theme.name[0]}</span>
        )}
      </div>
      <span className="font-medium text-sm">{theme.name}</span>
    </button>
  );
}

// Icon components
function LandmarkIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  );
}

function PaletteIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
    </svg>
  );
}

function MicroscopeIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    </svg>
  );
}

function MusicIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
    </svg>
  );
}

function FilmIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  );
}

function PlaneIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
  );
}

function DumbbellIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h2m12 0h2M6 8v8M18 8v8M8 6h8v12H8z" />
    </svg>
  );
}

function ChefHatIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3c-1.5 0-2.7.6-3.6 1.5A4.5 4.5 0 006 9c0 1.5.7 2.8 1.8 3.6V21h8.4v-8.4c1.1-.8 1.8-2.1 1.8-3.6a4.5 4.5 0 00-2.4-4.5C14.7 3.6 13.5 3 12 3z" />
    </svg>
  );
}

function BrainIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  );
}

function LeafIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  );
}

function RocketIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
    </svg>
  );
}

function SparklesIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  );
}

function GamepadIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function ShirtIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zm0 4h12M10 2v6m4-6v6" />
    </svg>
  );
}

function MegaphoneIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
    </svg>
  );
}
