import clsx from 'clsx';
import type { DiscoveryMode } from '../../../types';

interface ModeSelectorProps {
  mode: DiscoveryMode;
  onChange: (mode: DiscoveryMode) => void;
}

const modes: { value: DiscoveryMode; label: string; description: string; icon: string }[] = [
  {
    value: 'geography',
    label: 'Géographie',
    description: 'Rechercher par lieu et rayon',
    icon: '📍',
  },
  {
    value: 'affinities',
    label: 'Affinités',
    description: 'Par centres d\'intérêt',
    icon: '💜',
  },
  {
    value: 'intentions',
    label: 'Par intention',
    description: 'Ce que les gens cherchent',
    icon: '🎯',
  },
];

export function ModeSelector({ mode, onChange }: ModeSelectorProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-2 sm:gap-0 sm:rounded-lg sm:border sm:border-gray-200 sm:p-1 sm:bg-gray-50">
      {modes.map((m) => (
        <button
          key={m.value}
          onClick={() => onChange(m.value)}
          className={clsx(
            'flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            mode === m.value
              ? 'bg-white text-primary-700 shadow-sm sm:border sm:border-gray-200'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          )}
        >
          <span className="block">{m.icon} {m.label}</span>
          <span className="hidden lg:block text-xs font-normal text-gray-500">
            {m.description}
          </span>
        </button>
      ))}
    </div>
  );
}
