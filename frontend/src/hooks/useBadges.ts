import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';

export interface Badge {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  criteria: Record<string, unknown>;
  createdAt: string;
}

export interface UserBadge extends Badge {
  earnedAt: string;
}

export function useAllBadges() {
  return useQuery({
    queryKey: ['badges', 'all'],
    queryFn: async (): Promise<{ badges: Badge[] }> => {
      const response = await api.get('/badges');
      return response.data;
    },
  });
}

export function useMyBadges() {
  return useQuery({
    queryKey: ['badges', 'my'],
    queryFn: async (): Promise<{ badges: UserBadge[] }> => {
      const response = await api.get('/badges/my');
      return response.data;
    },
  });
}

export function useUserBadges(userId: string) {
  return useQuery({
    queryKey: ['badges', 'user', userId],
    queryFn: async (): Promise<{ badges: UserBadge[] }> => {
      const response = await api.get(`/badges/user/${userId}`);
      return response.data;
    },
    enabled: !!userId,
  });
}

export function useCheckBadges() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await api.post('/badges/check');
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['badges'] });
    },
  });
}
