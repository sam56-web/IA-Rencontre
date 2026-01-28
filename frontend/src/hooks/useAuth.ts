import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { authApi, usersApi } from '../services/api';
import { useAuthStore } from '../stores/auth.store';
import { websocket } from '../services/websocket';
import type { LoginInput, SignupInput } from '../types';

export function useAuth() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isAuthenticated, login, logout, setUser } = useAuthStore();

  const loginMutation = useMutation({
    mutationFn: (input: LoginInput) => authApi.login(input),
    onSuccess: (data) => {
      login(data.user, data.tokens);
      websocket.connect();
      queryClient.invalidateQueries();
      navigate('/discover');
    },
  });

  const signupMutation = useMutation({
    mutationFn: (input: SignupInput) => authApi.signup(input),
    onSuccess: (data) => {
      login(data.user, data.tokens);
      websocket.connect();
      navigate('/profile/create');
    },
  });

  const logoutMutation = useMutation({
    mutationFn: () => authApi.logout(),
    onSuccess: () => {
      websocket.disconnect();
      logout();
      queryClient.clear();
      navigate('/login');
    },
    onError: () => {
      websocket.disconnect();
      logout();
      queryClient.clear();
      navigate('/login');
    },
  });

  const { data: userData, refetch: refreshUser } = useQuery({
    queryKey: ['user', 'me'],
    queryFn: usersApi.getMe,
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  });

  // Update user in store when query data changes (React Query v5 pattern)
  useEffect(() => {
    if (userData) {
      setUser(userData);
    }
  }, [userData, setUser]);

  return {
    user,
    isAuthenticated,
    login: loginMutation.mutate,
    signup: signupMutation.mutate,
    logout: logoutMutation.mutate,
    refreshUser,
    isLoggingIn: loginMutation.isPending,
    isSigningUp: signupMutation.isPending,
    loginError: loginMutation.error,
    signupError: signupMutation.error,
  };
}
