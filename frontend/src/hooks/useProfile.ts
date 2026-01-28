import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { profilesApi } from '../services/api';

export function useMyProfile() {
  return useQuery({
    queryKey: ['profile', 'me'],
    queryFn: profilesApi.getMyProfile,
    retry: false,
  });
}

export function useProfile(userId: string) {
  return useQuery({
    queryKey: ['profile', userId],
    queryFn: () => profilesApi.getProfile(userId),
    enabled: !!userId,
  });
}

export function useCreateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: profilesApi.createProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: profilesApi.updateProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}
