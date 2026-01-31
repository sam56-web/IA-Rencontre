import { useRef, useEffect, useMemo, useState } from 'react';
import Globe from 'react-globe.gl';
import type { GlobeConnection, GlobeUser } from '../../types/globe';

// Check WebGL support
function isWebGLSupported(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}

interface TiledGlobeProps {
  user: GlobeUser;
  connections: GlobeConnection[];
  onConnectionClick?: (connection: GlobeConnection) => void;
  selectedConnection?: GlobeConnection | null;
}

interface PointData {
  id: string;
  lat: number;
  lng: number;
  name: string;
  color: string;
  size: number;
  isUser: boolean;
  connection?: GlobeConnection;
}

interface ArcData {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  color: string;
  stroke: number;
}

export function TiledGlobe({
  user,
  connections,
  onConnectionClick,
  selectedConnection,
}: TiledGlobeProps) {
  const globeRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [webglSupported] = useState(() => isWebGLSupported());

  // Return fallback if WebGL not supported
  if (!webglSupported) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-900 rounded-lg">
        <div className="text-center text-gray-400">
          <p className="text-sm">Globe 3D non disponible</p>
          <p className="text-xs mt-1">WebGL non support par votre navigateur</p>
        </div>
      </div>
    );
  }

  // Track container dimensions
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Points data (user + connections)
  const pointsData = useMemo<PointData[]>(() => {
    const points: PointData[] = [
      // User point (golden)
      {
        id: 'user',
        lat: user.latitude,
        lng: user.longitude,
        name: user.city ? `Vous (${user.city})` : 'Vous',
        color: '#FFD700',
        size: 0.8,
        isUser: true,
      },
      // Connections
      ...connections.map(conn => ({
        id: conn.id,
        lat: conn.latitude,
        lng: conn.longitude,
        name: conn.displayName,
        color: conn.themeColor || '#ffffff',
        size: conn.isOnline ? 0.6 : 0.4,
        isUser: false,
        connection: conn,
      })),
    ];
    return points;
  }, [user, connections]);

  // Arcs data (connections to user)
  const arcsData = useMemo<ArcData[]>(() => {
    return connections.map(conn => ({
      startLat: user.latitude,
      startLng: user.longitude,
      endLat: conn.latitude,
      endLng: conn.longitude,
      color: conn.themeColor || '#ffffff',
      stroke: selectedConnection?.id === conn.id ? 2 : 0.5,
    }));
  }, [user, connections, selectedConnection]);

  // Center on user on load
  useEffect(() => {
    if (globeRef.current) {
      globeRef.current.pointOfView(
        { lat: user.latitude, lng: user.longitude, altitude: 2 },
        1000
      );
    }
  }, [user.latitude, user.longitude]);

  // Highlight selected connection
  useEffect(() => {
    if (globeRef.current && selectedConnection) {
      globeRef.current.pointOfView(
        {
          lat: (user.latitude + selectedConnection.latitude) / 2,
          lng: (user.longitude + selectedConnection.longitude) / 2,
          altitude: 1.5,
        },
        1000
      );
    }
  }, [selectedConnection, user]);

  return (
    <div ref={containerRef} className="w-full h-full bg-gray-900">
      {dimensions.width > 0 && dimensions.height > 0 && (
        <Globe
          ref={globeRef}
          width={dimensions.width}
          height={dimensions.height}
          // High-res earth texture
          globeImageUrl="/textures/earth-4k.jpg"
          bumpImageUrl="/textures/earth-normal.jpg"
          backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
        // Points
        pointsData={pointsData}
        pointLat="lat"
        pointLng="lng"
        pointColor="color"
        pointAltitude={0.01}
        pointRadius="size"
        pointLabel={(d: unknown) => {
          const point = d as PointData;
          if (point.isUser) {
            return `<div style="background: rgba(0,0,0,0.85); color: #FFD700; padding: 8px 12px; border-radius: 6px; font-size: 13px;">
              <b>${point.name}</b>
            </div>`;
          }
          const conn = point.connection;
          return `<div style="background: rgba(0,0,0,0.85); color: white; padding: 8px 12px; border-radius: 6px; font-size: 13px;">
            <b style="color: ${point.color}">${point.name}</b>
            ${conn?.isOnline ? '<br/><span style="color: #48bb78">● En ligne</span>' : ''}
            ${conn?.unreadMessages ? `<br/><span style="color: #fc8181">💬 ${conn.unreadMessages} message(s)</span>` : ''}
            ${conn?.distanceFromUser ? `<br/><span style="color: #a0aec0">${conn.distanceFromUser} km</span>` : ''}
            ${conn?.commonThemes?.length ? `<br/><span style="color: #b794f4">${conn.commonThemes.slice(0, 2).join(', ')}</span>` : ''}
          </div>`;
        }}
        onPointClick={(point: unknown) => {
          const p = point as PointData;
          if (!p.isUser && p.connection) {
            onConnectionClick?.(p.connection);
          }
        }}
        // Arcs
        arcsData={arcsData}
        arcStartLat="startLat"
        arcStartLng="startLng"
        arcEndLat="endLat"
        arcEndLng="endLng"
        arcColor="color"
        arcAltitude={0.15}
        arcStroke="stroke"
        arcDashLength={0.5}
        arcDashGap={0.2}
        arcDashAnimateTime={2000}
        // Atmosphere
        atmosphereColor="#4a9eff"
        atmosphereAltitude={0.15}
        // Controls
        enablePointerInteraction={true}
      />
      )}
    </div>
  );
}

export default TiledGlobe;
