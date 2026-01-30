import { useRef, useMemo, useState, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sphere, Html, Line, useTexture, useProgress } from '@react-three/drei';
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
const EARTH_TEXTURE_URL = 'https://unpkg.com/three-globe@2.31.0/example/img/earth-blue-marble.jpg';

// Loading indicator while texture loads
function Loader() {
  const { progress } = useProgress();
  return (
    <Html center>
      <div className="text-white text-sm bg-black/50 px-3 py-2 rounded">
        Chargement {progress.toFixed(0)}%
      </div>
    </Html>
  );
}

// Earth globe with realistic texture
function EarthGlobe() {
  const meshRef = useRef<THREE.Mesh>(null);
  const earthTexture = useTexture(EARTH_TEXTURE_URL);

  // Improve texture rendering
  earthTexture.colorSpace = THREE.SRGBColorSpace;

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.0005;
    }
  });

  return (
    <group>
      {/* Earth with texture */}
      <Sphere ref={meshRef} args={[GLOBE_RADIUS, 64, 64]}>
        <meshStandardMaterial
          map={earthTexture}
          metalness={0.1}
          roughness={0.8}
        />
      </Sphere>

      {/* Subtle atmosphere glow */}
      <Sphere args={[GLOBE_RADIUS * 1.015, 64, 64]}>
        <meshBasicMaterial
          color="#4a9eff"
          transparent
          opacity={0.08}
          side={THREE.BackSide}
        />
      </Sphere>
    </group>
  );
}

// User marker with hover-only label
function UserMarker({ user }: { user: GlobeUser }) {
  const [hovered, setHovered] = useState(false);

  const position = useMemo(() => {
    const p = latLonToVector3(user.latitude, user.longitude, GLOBE_RADIUS * 1.02);
    return new THREE.Vector3(p.x, p.y, p.z);
  }, [user.latitude, user.longitude]);

  return (
    <group
      position={position}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      {/* Main golden point */}
      <Sphere args={[0.018, 16, 16]}>
        <meshStandardMaterial color="#f6e05e" emissive="#f6e05e" emissiveIntensity={0.5} />
      </Sphere>

      {/* Halo */}
      <Sphere args={[0.028, 16, 16]}>
        <meshStandardMaterial color="#f6e05e" transparent opacity={0.3} />
      </Sphere>

      {/* Label only on hover - much smaller */}
      {hovered && (
        <Html position={[0, 0.05, 0]} center style={{ pointerEvents: 'none' }}>
          <div className="bg-black/80 text-yellow-400 text-[10px] px-2 py-1 rounded font-medium whitespace-nowrap">
            Vous {user.city ? `(${user.city})` : ''}
          </div>
        </Html>
      )}
    </group>
  );
}

// Connection marker with overlap offset
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

    // Deterministic offset based on connection ID
    const hash = connection.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const offsetAngle = (hash % 360) * (Math.PI / 180);
    const offsetDist = 0.015;

    const pos = new THREE.Vector3(basePos.x, basePos.y, basePos.z);
    pos.x += Math.cos(offsetAngle) * offsetDist;
    pos.z += Math.sin(offsetAngle) * offsetDist;

    return pos.normalize().multiplyScalar(GLOBE_RADIUS * 1.02);
  }, [connection.latitude, connection.longitude, connection.id]);

  // Reduced size
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

      {/* Halo for selected/hovered */}
      {(hovered || isSelected) && (
        <Sphere args={[scale * 1.3, 12, 12]}>
          <meshStandardMaterial
            color={connection.themeColor || '#ffffff'}
            transparent
            opacity={0.2}
          />
        </Sphere>
      )}

      {/* Online indicator */}
      {connection.isOnline && (
        <Sphere args={[0.004, 8, 8]} position={[scale + 0.008, scale + 0.008, 0]}>
          <meshStandardMaterial color="#48bb78" emissive="#48bb78" emissiveIntensity={1} />
        </Sphere>
      )}

      {/* Unread messages indicator */}
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

// Connection arc between user and a connection
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

  const opacity = useMemo(() => {
    if (isSelected) return 0.7;
    if (connection.unreadMessages > 0) return 0.5;
    return 0.15 + (connection.connectionIntensity / 100) * 0.25;
  }, [isSelected, connection.unreadMessages, connection.connectionIntensity]);

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
      {/* Improved lighting for texture */}
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 3, 5]} intensity={1.2} />
      <pointLight position={[-10, -10, -10]} intensity={0.3} color="#87CEEB" />

      {/* Earth with texture */}
      <EarthGlobe />

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

      {/* Controls */}
      <OrbitControls
        enablePan={false}
        enableZoom={true}
        minDistance={1.2}
        maxDistance={8}
        zoomSpeed={1.2}
        autoRotate={!selectedConnection}
        autoRotateSpeed={0.3}
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
          position: [0, 0.5, 3],
          fov: 50
        }}
        style={{ background: 'linear-gradient(to bottom, #0f172a, #020617)' }}
      >
        <Suspense fallback={<Loader />}>
          <GlobeScene
            user={user}
            connections={connections}
            onConnectionClick={onConnectionClick}
            selectedConnection={selectedConnection}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}

export default Globe3D;
