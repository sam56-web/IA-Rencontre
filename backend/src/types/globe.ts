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
  lastActive: Date | null;
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
  clusters?: {
    id: string;
    center: { lat: number; lon: number };
    count: number;
    primaryTheme: string;
  }[];
}

export interface GlobeConfig {
  clusteringEnabled: boolean;
  maxConnections: number;
  clusterRadius: number;
  autoRefreshInterval: number;
  themeColors: Record<string, string>;
}

export interface GlobeMetrics {
  requestCount: number;
  averageResponseTime: number;
  cacheHitRate: number;
  clusteredRequests: number;
  errors: number;
}
