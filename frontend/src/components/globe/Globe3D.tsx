import { useRef, useMemo, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sphere, Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import type { GlobeConnection, GlobeUser } from '../../types/globe';
import { latLonToVector3, getArcPoints } from '../../hooks/useGlobe';

interface Globe3DProps {
  user: GlobeUser;
  connections: GlobeConnection[];
  onConnectionClick?: (connection: GlobeConnection) => void;
  selectedConnection?: GlobeConnection | null;
}

const GLOBE_RADIUS = 1;

// Earth sphere component
function Earth() {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.001;
    }
  });

  return (
    <Sphere ref={meshRef} args={[GLOBE_RADIUS, 64, 64]}>
      <meshStandardMaterial
        color="#1a365d"
        roughness={0.8}
        metalness={0.2}
        transparent
        opacity={0.9}
      />
    </Sphere>
  );
}

// Grid lines on the globe
function GlobeGrid() {
  const lines = useMemo(() => {
    const result: JSX.Element[] = [];

    // Latitude lines
    for (let lat = -60; lat <= 60; lat += 30) {
      const points: THREE.Vector3[] = [];
      for (let lon = -180; lon <= 180; lon += 5) {
        const p = latLonToVector3(lat, lon, GLOBE_RADIUS * 1.01);
        points.push(new THREE.Vector3(p.x, p.y, p.z));
      }
      result.push(
        <Line
          key={`lat-${lat}`}
          points={points}
          color="#4a5568"
          lineWidth={0.5}
          transparent
          opacity={0.3}
        />
      );
    }

    // Longitude lines
    for (let lon = -180; lon < 180; lon += 30) {
      const points: THREE.Vector3[] = [];
      for (let lat = -90; lat <= 90; lat += 5) {
        const p = latLonToVector3(lat, lon, GLOBE_RADIUS * 1.01);
        points.push(new THREE.Vector3(p.x, p.y, p.z));
      }
      result.push(
        <Line
          key={`lon-${lon}`}
          points={points}
          color="#4a5568"
          lineWidth={0.5}
          transparent
          opacity={0.3}
        />
      );
    }

    return result;
  }, []);

  return <>{lines}</>;
}

// User marker (current user position) - REDUCED SIZE
function UserMarker({ user }: { user: GlobeUser }) {
  const position = useMemo(() => {
    const p = latLonToVector3(user.latitude, user.longitude, GLOBE_RADIUS * 1.02);
    return new THREE.Vector3(p.x, p.y, p.z);
  }, [user.latitude, user.longitude]);

  return (
    <group position={position}>
      {/* Main point - reduced from 0.03 to 0.018 */}
      <Sphere args={[0.018, 16, 16]}>
        <meshStandardMaterial color="#f6e05e" emissive="#f6e05e" emissiveIntensity={0.5} />
      </Sphere>
      {/* Halo - reduced from implicit to 0.028 */}
      <Sphere args={[0.028, 16, 16]}>
        <meshStandardMaterial color="#f6e05e" transparent opacity={0.3} />
      </Sphere>
      <Html center distanceFactor={3}>
        <div className="bg-yellow-500 text-black px-2 py-1 rounded text-xs font-bold whitespace-nowrap">
          Vous ({user.city || 'Unknown'})
        </div>
      </Html>
    </group>
  );
}

// Connection marker - REDUCED SIZE with overlap offset
function ConnectionMarker({
  connection,
  onClick,
  isSelected,
}: {
  connection: GlobeConnection;
  onClick?: () => void;
  isSelected?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const meshRef = useRef<THREE.Mesh>(null);

  // Position with slight offset to avoid overlap
  const position = useMemo(() => {
    const basePos = latLonToVector3(
      connection.latitude,
      connection.longitude,
      GLOBE_RADIUS * 1.02
    );

    // Deterministic offset based on connection ID to spread overlapping points
    const hash = connection.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const offsetAngle = (hash % 360) * (Math.PI / 180);
    const offsetDist = 0.015;

    const pos = new THREE.Vector3(basePos.x, basePos.y, basePos.z);
    pos.x += Math.cos(offsetAngle) * offsetDist;
    pos.z += Math.sin(offsetAngle) * offsetDist;

    // Re-normalize to sphere surface
    return pos.normalize().multiplyScalar(GLOBE_RADIUS * 1.02);
  }, [connection.latitude, connection.longitude, connection.id]);

  // REDUCED SIZE: base 0.008 (was 0.015), intensity bonus 0.006 (was 0.01)
  const scale = useMemo(() => {
    const base = 0.008;
    const intensityBonus = (connection.connectionIntensity / 100) * 0.006;
    const unreadBonus = connection.unreadMessages > 0 ? 0.004 : 0;
    return base + intensityBonus + unreadBonus;
  }, [connection.connectionIntensity, connection.unreadMessages]);

  useFrame(() => {
    if (meshRef.current && (hovered || isSelected)) {
      meshRef.current.rotation.y += 0.05;
    }
  });

  return (
    <group position={position}>
      {/* Main sphere */}
      <Sphere
        ref={meshRef}
        args={[scale, 16, 16]}
        onClick={onClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <meshStandardMaterial
          color={connection.themeColor || '#ffffff'}
          emissive={connection.themeColor || '#ffffff'}
          emissiveIntensity={hovered || isSelected ? 0.8 : 0.3}
        />
      </Sphere>

      {/* Halo for selected/hovered - reduced multiplier */}
      {(hovered || isSelected) && (
        <Sphere args={[scale * 1.3, 12, 12]}>
          <meshStandardMaterial
            color={connection.themeColor || '#ffffff'}
            transparent
            opacity={0.2}
          />
        </Sphere>
      )}

      {/* Online indicator - REDUCED: position closer, size smaller */}
      {connection.isOnline && (
        <Sphere args={[0.004, 8, 8]} position={[scale + 0.008, scale + 0.008, 0]}>
          <meshStandardMaterial color="#48bb78" emissive="#48bb78" emissiveIntensity={1} />
        </Sphere>
      )}

      {/* Unread messages indicator - REDUCED: position closer, size smaller */}
      {connection.unreadMessages > 0 && (
        <Sphere args={[0.005, 8, 8]} position={[-(scale + 0.008), scale + 0.008, 0]}>
          <meshStandardMaterial color="#fc8181" emissive="#fc8181" emissiveIntensity={1} />
        </Sphere>
      )}

      {/* Hover/Selected tooltip */}
      {(hovered || isSelected) && (
        <Html center distanceFactor={2.5}>
          <div className="bg-gray-900 text-white px-3 py-2 rounded-lg shadow-lg text-sm whitespace-nowrap">
            <div className="font-bold">{connection.displayName}</div>
            <div className="text-gray-300 text-xs">
              {connection.distanceFromUser ? `${connection.distanceFromUser} km` : 'Distance inconnue'}
            </div>
            {connection.commonThemes.length > 0 && (
              <div className="text-xs text-purple-300 mt-1">
                {connection.commonThemes.slice(0, 2).join(', ')}
              </div>
            )}
            {connection.unreadMessages > 0 && (
              <div className="text-xs text-red-300 mt-1">
                {connection.unreadMessages} message(s) non lu(s)
              </div>
            )}
          </div>
        </Html>
      )}
    </group>
  );
}

// Connection arc between user and a connection - REDUCED THICKNESS
function ConnectionArc({
  user,
  connection,
  isSelected,
}: {
  user: GlobeUser;
  connection: GlobeConnection;
  isSelected?: boolean;
}) {
  const points = useMemo(() => {
    const arcPoints = getArcPoints(
      { lat: user.latitude, lon: user.longitude },
      { lat: connection.latitude, lon: connection.longitude },
      GLOBE_RADIUS,
      30
    );
    return arcPoints.map(p => new THREE.Vector3(p.x, p.y, p.z));
  }, [user, connection]);

  // REDUCED opacity
  const opacity = useMemo(() => {
    if (isSelected) return 0.7;
    if (connection.unreadMessages > 0) return 0.5;
    return 0.15 + (connection.connectionIntensity / 100) * 0.25;
  }, [isSelected, connection.unreadMessages, connection.connectionIntensity]);

  // REDUCED lineWidth: was 1-2, now 0.5-1.2
  const lineWidth = isSelected ? 1.2 : 0.5;

  return (
    <Line
      points={points}
      color={connection.themeColor || '#ffffff'}
      lineWidth={lineWidth}
      transparent
      opacity={opacity}
    />
  );
}

// Main scene component
function GlobeScene({
  user,
  connections,
  onConnectionClick,
  selectedConnection,
}: Globe3DProps) {
  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      <pointLight position={[-10, -10, -10]} intensity={0.5} color="#4299e1" />

      {/* Earth */}
      <Earth />
      <GlobeGrid />

      {/* User marker */}
      <UserMarker user={user} />

      {/* Connection arcs */}
      {connections.map(conn => (
        <ConnectionArc
          key={`arc-${conn.id}`}
          user={user}
          connection={conn}
          isSelected={selectedConnection?.id === conn.id}
        />
      ))}

      {/* Connection markers */}
      {connections.map(conn => (
        <ConnectionMarker
          key={conn.id}
          connection={conn}
          onClick={() => onConnectionClick?.(conn)}
          isSelected={selectedConnection?.id === conn.id}
        />
      ))}

      {/* Controls - IMPROVED ZOOM */}
      <OrbitControls
        enablePan={false}
        enableZoom={true}
        minDistance={1.2}      // Closer zoom (was 1.5)
        maxDistance={8}        // Further dezoom (was 4)
        zoomSpeed={1.2}        // Faster zoom
        autoRotate={!selectedConnection}
        autoRotateSpeed={0.5}
      />
    </>
  );
}

// Main exported component
export function Globe3D({
  user,
  connections,
  onConnectionClick,
  selectedConnection,
}: Globe3DProps) {
  return (
    <div className="w-full h-full bg-gray-900 rounded-lg overflow-hidden">
      <Canvas
        camera={{
          position: [0, 0.5, 3],  // Slightly above and closer (was [0, 0, 2.5])
          fov: 50                 // Wider field of view (was 45)
        }}
        style={{ background: 'linear-gradient(to bottom, #1a202c, #0d1117)' }}
      >
        <GlobeScene
          user={user}
          connections={connections}
          onConnectionClick={onConnectionClick}
          selectedConnection={selectedConnection}
        />
      </Canvas>
    </div>
  );
}

export default Globe3D;
