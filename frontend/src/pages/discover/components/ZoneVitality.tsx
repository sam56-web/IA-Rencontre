import { useZoneVitality } from '../../../hooks/useDiscovery';

export function ZoneVitality() {
  const { data: vitality, isLoading } = useZoneVitality();

  if (isLoading || !vitality) return null;

  const getStatusColor = (status: typeof vitality.status) => {
    switch (status) {
      case 'pioneer':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'growing':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'vibrant':
        return 'bg-purple-100 text-purple-800 border-purple-200';
    }
  };

  const getStatusIcon = (status: typeof vitality.status) => {
    switch (status) {
      case 'pioneer':
        return '🌱';
      case 'growing':
        return '🌿';
      case 'active':
        return '🌳';
      case 'vibrant':
        return '🌺';
    }
  };

  return (
    <div className={`rounded-lg p-4 border ${getStatusColor(vitality.status)}`}>
      <div className="flex items-start gap-3">
        <span className="text-2xl">{getStatusIcon(vitality.status)}</span>
        <div>
          <p className="text-sm font-medium">{vitality.message}</p>
          <div className="mt-2 flex gap-4 text-xs">
            <span>Local : {vitality.localCount}</span>
            <span>National : {vitality.nationalCount}</span>
            <span>Global : {vitality.globalCount}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
