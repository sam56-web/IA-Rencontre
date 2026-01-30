import { useState, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../../components/layout/Layout';
import { Button } from '../../components/ui/Button';
import { Globe3D } from '../../components/globe/Globe3D';
import { useGlobeConnections, useZoneStats, useRefreshGlobeCache } from '../../hooks/useGlobe';
import type { GlobeConnection } from '../../types/globe';

function LoadingGlobe() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-gray-900 rounded-lg">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-gray-400">Chargement du globe...</p>
      </div>
    </div>
  );
}

function ConnectionPanel({ connection, onClose }: { connection: GlobeConnection; onClose: () => void }) {
  const navigate = useNavigate();

  return (
    <div className="absolute right-4 top-4 w-80 bg-white rounded-lg shadow-xl p-4 z-10">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="font-bold text-lg">{connection.displayName}</h3>
          <p className="text-sm text-gray-500">
            {connection.distanceFromUser ? `${connection.distanceFromUser} km` : 'Distance inconnue'}
          </p>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Status indicators */}
      <div className="flex gap-2 mb-4">
        {connection.isOnline && (
          <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
            En ligne
          </span>
        )}
        {connection.unreadMessages > 0 && (
          <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs">
            {connection.unreadMessages} non lu(s)
          </span>
        )}
        <span
          className="px-2 py-1 rounded-full text-xs"
          style={{ backgroundColor: `${connection.themeColor}20`, color: connection.themeColor }}
        >
          Intensite: {connection.connectionIntensity}%
        </span>
      </div>

      {/* Common themes */}
      {connection.commonThemes.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Themes communs</p>
          <div className="flex flex-wrap gap-1">
            {connection.commonThemes.map(theme => (
              <span key={theme} className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs">
                {theme}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Common intentions */}
      {connection.commonIntentions.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Intentions communes</p>
          <div className="flex flex-wrap gap-1">
            {connection.commonIntentions.map(intention => (
              <span key={intention} className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                {intention}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          variant="primary"
          size="sm"
          className="flex-1"
          onClick={() => navigate(`/profile/${connection.id}`)}
        >
          Voir le profil
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => navigate(`/messages/${connection.id}`)}
        >
          Message
        </Button>
      </div>
    </div>
  );
}

function StatsPanel({ stats, zoneStats }: { stats: any; zoneStats: any }) {
  return (
    <div className="absolute left-4 bottom-4 bg-white/90 backdrop-blur rounded-lg shadow-lg p-4 z-10">
      <h4 className="font-semibold text-sm mb-2">Statistiques</h4>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <span className="text-gray-500">Total:</span>
        <span className="font-medium">{stats?.total || 0}</span>

        <span className="text-gray-500">En ligne:</span>
        <span className="font-medium text-green-600">{stats?.online || 0}</span>

        <span className="text-gray-500">Messages non lus:</span>
        <span className="font-medium text-red-600">{stats?.withUnread || 0}</span>

        <span className="text-gray-500">Proches (&lt;200km):</span>
        <span className="font-medium text-blue-600">{stats?.local || 0}</span>

        {zoneStats && (
          <>
            <span className="text-gray-500">Dans 50km:</span>
            <span className="font-medium">{zoneStats.within_50km || 0}</span>
          </>
        )}
      </div>
    </div>
  );
}

export function GlobePage() {
  const [selectedConnection, setSelectedConnection] = useState<GlobeConnection | null>(null);
  const { data: globeData, isLoading, error } = useGlobeConnections();
  const { data: zoneStats } = useZoneStats();
  const refreshCache = useRefreshGlobeCache();

  const handleConnectionClick = (connection: GlobeConnection) => {
    setSelectedConnection(connection);
  };

  const handleClosePanel = () => {
    setSelectedConnection(null);
  };

  if (error) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-[calc(100vh-200px)]">
          <div className="text-center">
            <p className="text-red-500 mb-4">Erreur lors du chargement du globe</p>
            <Button onClick={() => window.location.reload()}>Reessayer</Button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="h-[calc(100vh-120px)] relative">
        {/* Header */}
        <div className="absolute top-4 left-4 right-4 z-10 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-white drop-shadow-lg">Globe</h1>
            <p className="text-gray-300 text-sm drop-shadow">
              Vos connexions dans le monde
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refreshCache.mutate()}
              isLoading={refreshCache.isPending}
              className="bg-white/90"
            >
              Actualiser
            </Button>
          </div>
        </div>

        {/* Globe */}
        <div className="w-full h-full">
          {isLoading ? (
            <LoadingGlobe />
          ) : globeData ? (
            <Suspense fallback={<LoadingGlobe />}>
              <Globe3D
                user={globeData.user}
                connections={globeData.connections}
                onConnectionClick={handleConnectionClick}
                selectedConnection={selectedConnection}
              />
            </Suspense>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-900 rounded-lg">
              <p className="text-gray-400">Aucune donnee disponible</p>
            </div>
          )}
        </div>

        {/* Stats panel */}
        {globeData && <StatsPanel stats={globeData.stats} zoneStats={zoneStats} />}

        {/* Selected connection panel */}
        {selectedConnection && (
          <ConnectionPanel connection={selectedConnection} onClose={handleClosePanel} />
        )}

        {/* Legend */}
        <div className="absolute right-4 bottom-4 bg-white/90 backdrop-blur rounded-lg shadow-lg p-3 z-10">
          <h4 className="font-semibold text-xs mb-2">Legende</h4>
          <div className="space-y-1 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
              <span>Vous</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-400"></div>
              <span>En ligne</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-400"></div>
              <span>Messages non lus</span>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default GlobePage;
