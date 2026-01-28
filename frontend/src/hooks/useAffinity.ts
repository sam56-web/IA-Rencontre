import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';

interface AffinityMatch {
  id: string;
  username: string;
  avatarUrl: string | null;
  bio: string | null;
  city: string | null;
  themes: string[];
  intentions: string[];
  lastActive: string | null;
  affinityScore: number;
}

interface AffinityMatchesResponse {
  users: AffinityMatch[];
  total: number;
}

interface AffinityScore {
  userId: string;
  score: number;
  breakdown: {
    themes: number;
    intentions: number;
    keywords: number;
    location: number;
    activity: number;
  };
}

interface ProfileViewer {
  id: string;
  username: string;
  avatarUrl: string | null;
  bio: string | null;
  city: string | null;
  themes: string[];
  intentions: string[];
  lastActive: string | null;
}

interface ProfileViewersResponse {
  viewers: ProfileViewer[];
  total: number;
}

export function useAffinityMatches(options?: { limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ['affinity', 'matches', options],
    queryFn: async (): Promise<AffinityMatchesResponse> => {
      const params = new URLSearchParams();
      if (options?.limit) params.set('limit', String(options.limit));
      if (options?.offset) params.set('offset', String(options.offset));

      const response = await api.get(`/affinity/matches?${params.toString()}`);
      return response.data;
    },
  });
}

export function useAffinityScore(userId: string) {
  return useQuery({
    queryKey: ['affinity', 'score', userId],
    queryFn: async (): Promise<AffinityScore> => {
      const response = await api.get(`/affinity/score/${userId}`);
      return response.data;
    },
    enabled: !!userId,
  });
}

export function useRecordProfileView() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const response = await api.post(`/affinity/view/${userId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['affinity', 'viewers'] });
    },
  });
}

export function useProfileViewers(options?: { limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ['affinity', 'viewers', options],
    queryFn: async (): Promise<ProfileViewersResponse> => {
      const params = new URLSearchParams();
      if (options?.limit) params.set('limit', String(options.limit));
      if (options?.offset) params.set('offset', String(options.offset));

      const response = await api.get(`/affinity/viewers?${params.toString()}`);
      return response.data;
    },
  });
}
