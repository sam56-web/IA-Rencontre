import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import type { GlobeApiResponse, ClusteredResponse, ZoneStatsResponse } from '../types/globe';

// Fetch globe connections
export function useGlobeConnections() {
  return useQuery({
    queryKey: ['globe', 'connections'],
    queryFn: async () => {
      const response = await api.get<GlobeApiResponse>('/globe/connections');
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes (same as backend cache)
    refetchInterval: 5 * 60 * 1000,
  });
}

// Fetch clustered connections
export function useClusteredConnections(maxDistance: number = 500) {
  return useQuery({
    queryKey: ['globe', 'clustered', maxDistance],
    queryFn: async () => {
      const response = await api.get<ClusteredResponse>('/globe/connections/clustered', {
        params: { maxDistance }
      });
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

// Fetch zone stats
export function useZoneStats() {
  return useQuery({
    queryKey: ['globe', 'zone-stats'],
    queryFn: async () => {
      const response = await api.get<ZoneStatsResponse>('/globe/zone-stats');
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

// Refresh cache mutation
export function useRefreshGlobeCache() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await api.post<GlobeApiResponse>('/globe/refresh-cache');
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['globe'] });
    },
  });
}

// Convert lat/lon to 3D coordinates on a sphere
export function latLonToVector3(lat: number, lon: number, radius: number = 1) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);

  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const y = radius * Math.cos(phi);
  const z = radius * Math.sin(phi) * Math.sin(theta);

  return { x, y, z };
}

// Get arc points between two coordinates
export function getArcPoints(
  start: { lat: number; lon: number },
  end: { lat: number; lon: number },
  radius: number = 1,
  segments: number = 50
) {
  const points: { x: number; y: number; z: number }[] = [];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;

    // Interpolate lat/lon
    const lat = start.lat + (end.lat - start.lat) * t;
    const lon = start.lon + (end.lon - start.lon) * t;

    // Add altitude for arc effect (higher in the middle)
    const altitude = 1 + Math.sin(t * Math.PI) * 0.1;

    const point = latLonToVector3(lat, lon, radius * altitude);
    points.push(point);
  }

  return points;
}
