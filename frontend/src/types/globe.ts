export interface GlobeConnection {
  id: string;
  username: string;
  displayName: string;
  latitude: number;
  longitude: number;
  themes: string[];
  intentions: string[];
  themeColor: string;
  unreadMessages: number;
  totalConnections: number;
  isOnline: boolean;
  lastActive: string | null;
  connectionIntensity: number;
  commonThemes: string[];
  commonIntentions: string[];
  distanceFromUser?: number;
  clusterId?: string;
}

export interface GlobeUser {
  id: string;
  username: string;
  latitude: number;
  longitude: number;
  city?: string;
  country?: string;
}

export interface GlobeStats {
  total: number;
  online: number;
  withUnread: number;
  local: number;
  clustered?: number;
}

export interface GlobeData {
  user: GlobeUser;
  connections: GlobeConnection[];
  stats: GlobeStats;
}

export interface GlobeApiResponse {
  success: boolean;
  data: GlobeData;
}

export interface ClusteredResponse {
  success: boolean;
  data: {
    connections: GlobeConnection[];
    originalCount: number;
    clusteredCount: number;
    reduction: number;
  };
}

export interface ZoneStatsResponse {
  success: boolean;
  data: {
    total_nearby: string;
    within_50km: string;
    within_200km: string;
    within_500km: string;
  };
}

// Pour le rendu 3D
export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface ConnectionLine {
  start: Point3D;
  end: Point3D;
  intensity: number;
  color: string;
}
