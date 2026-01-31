import { useState, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../../components/layout/Layout';
import { Button } from '../../components/ui/Button';
import { Globe3D } from '../../components/globe/Globe3D';
import { useGlobeConnections, useRefreshGlobeCache } from '../../hooks/useGlobe';
import type { GlobeConnection } from '../../types/globe';

function LoadingGlobe() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-gray-900 rounded-lg">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-3"></div>
        <p className="text-gray-400 text-sm">Chargement...</p>
      </div>
    </div>
  );
}

// Compact sidebar panel for selected connection
function ConnectionSidebar({ connection, onClose }: { connection: GlobeConnection; onClose: () => void }) {
  const navigate = useNavigate();

  return (
    <div className="w-56 bg-gray-800 border-l border-gray-700 flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-gray-700 flex justify-between items-start">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-sm text-white truncate">{connection.displayName}</h3>
          <p className="text-xs text-gray-400">
            {connection.distanceFromUser ? `${connection.distanceFromUser} km` : '—'}
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-white ml-2 flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Status badges */}
        <div className="flex flex-wrap gap-1">
          {connection.isOnline && (
            <span className="px-1.5 py-0.5 bg-green-900/50 text-green-400 rounded text-[10px]">
              En ligne
            </span>
          )}
          {connection.unreadMessages > 0 && (
            <span className="px-1.5 py-0.5 bg-red-900/50 text-red-400 rounded text-[10px]">
              {connection.unreadMessages} msg
            </span>
          )}
          <span
            className="px-1.5 py-0.5 rounded text-[10px]"
            style={{ backgroundColor: `${connection.themeColor}30`, color: connection.themeColor }}
          >
            {connection.connectionIntensity}%
          </span>
        </div>

        {/* Common themes */}
        {connection.commonThemes.length > 0 && (
          <div>
            <p className="text-[10px] text-gray-500 uppercase mb-1">Themes</p>
            <div className="flex flex-wrap gap-1">
              {connection.commonThemes.map(theme => (
                <span key={theme} className="px-1.5 py-0.5 bg-purple-900/50 text-purple-300 rounded text-[10px]">
                  {theme}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Common intentions */}
        {connection.commonIntentions.length > 0 && (
          <div>
            <p className="text-[10px] text-gray-500 uppercase mb-1">Intentions</p>
            <div className="flex flex-wrap gap-1">
              {connection.commonIntentions.map(intention => (
                <span key={intention} className="px-1.5 py-0.5 bg-blue-900/50 text-blue-300 rounded text-[10px]">
                  {intention}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-3 border-t border-gray-700 space-y-2">
        <Button
          variant="primary"
          size="sm"
          className="w-full text-xs py-1.5"
          onClick={() => navigate(`/profile/${connection.id}`)}
        >
          Voir profil
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs py-1.5"
          onClick={() => navigate(`/messages/${connection.id}`)}
        >
          Message
        </Button>
      </div>
    </div>
  );
}

// Compact stats overlay
function StatsOverlay({ stats }: { stats: any }) {
  return (
    <div className="absolute left-2 bottom-2 bg-black/70 backdrop-blur-sm rounded px-2 py-1.5 z-10">
      <div className="flex gap-3 text-[10px]">
        <span className="text-gray-400">
          Total: <span className="text-white font-medium">{stats?.total || 0}</span>
        </span>
        <span className="text-gray-400">
          En ligne: <span className="text-green-400 font-medium">{stats?.online || 0}</span>
        </span>
        {(stats?.withUnread || 0) > 0 && (
          <span className="text-gray-400">
            Non lus: <span className="text-red-400 font-medium">{stats?.withUnread}</span>
          </span>
        )}
      </div>
    </div>
  );
}

// Compact legend overlay
function LegendOverlay() {
  return (
    <div className="absolute right-2 bottom-2 bg-black/70 backdrop-blur-sm rounded px-2 py-1.5 z-10">
      <div className="flex gap-3 text-[10px]">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
          <span className="text-gray-300">Vous</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-green-400"></div>
          <span className="text-gray-300">Online</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-red-400"></div>
          <span className="text-gray-300">Msg</span>
        </div>
      </div>
    </div>
  );
}

export function GlobePage() {
  const [selectedConnection, setSelectedConnection] = useState<GlobeConnection | null>(null);
  const { data: globeData, isLoading, error } = useGlobeConnections();
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
            <p className="text-red-500 mb-4 text-sm">Erreur lors du chargement</p>
            <Button size="sm" onClick={() => window.location.reload()}>Reessayer</Button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="h-[calc(100vh-80px)] flex">
        {/* Globe container */}
        <div className="flex-1 relative">
          {/* Header overlay */}
          <div className="absolute top-2 left-2 right-2 z-10 flex justify-between items-center">
            <div>
              <h1 className="text-lg font-bold text-white drop-shadow-lg">Globe</h1>
              <p className="text-gray-300 text-xs drop-shadow">
                {globeData?.connections.length || 0} connexions
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refreshCache.mutate()}
              isLoading={refreshCache.isPending}
              className="bg-white/90 text-xs px-2 py-1"
            >
              Actualiser
            </Button>
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
                <p className="text-gray-400 text-sm">Aucune donnee</p>
              </div>
            )}
          </div>

          {/* Stats overlay */}
          {globeData && <StatsOverlay stats={globeData.stats} />}

          {/* Legend overlay */}
          <LegendOverlay />
        </div>

        {/* Sidebar - only shows when connection selected */}
        {selectedConnection && (
          <ConnectionSidebar connection={selectedConnection} onClose={handleClosePanel} />
        )}
      </div>
    </Layout>
  );
}

export default GlobePage;
