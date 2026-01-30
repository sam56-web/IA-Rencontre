import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { discoveryApi } from '../services/api';
import type { DiscoveryMode, Intention } from '../types';

interface DiscoveryParams {
  mode?: DiscoveryMode;
  intentions?: Intention[];
  languages?: string[];
  minAge?: number;
  maxAge?: number;
  location?: string;
  themes?: string[];
  search?: string;
}

export function useDiscovery(params: DiscoveryParams = {}) {
  return useInfiniteQuery({
    queryKey: ['discovery', params],
    queryFn: ({ pageParam = 1 }) =>
      discoveryApi.discover({
        ...params,
        page: pageParam,
        limit: 20,
      }),
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.page + 1 : undefined,
    initialPageParam: 1,
  });
}

export function useSerendipity(limit: number = 5) {
  return useQuery({
    queryKey: ['discovery', 'serendipity', limit],
    queryFn: () => discoveryApi.getSerendipity(limit),
  });
}

export function useZoneVitality() {
  return useQuery({
    queryKey: ['zones', 'vitality'],
    queryFn: discoveryApi.getZoneVitality,
  });
}
