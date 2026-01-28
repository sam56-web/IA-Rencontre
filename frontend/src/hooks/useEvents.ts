import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';

export interface Event {
  id: string;
  creatorId: string | null;
  groupId: string | null;
  themeId: string | null;
  title: string;
  description: string | null;
  photoUrl: string | null;
  locationName: string | null;
  locationLat: number | null;
  locationLng: number | null;
  startsAt: string;
  endsAt: string | null;
  maxParticipants: number | null;
  isPublic: boolean;
  creatorUsername: string | null;
  groupName: string | null;
  themeName: string | null;
  participantCount: number;
  userStatus: 'going' | 'maybe' | 'not_going' | null;
}

interface EventsResponse {
  events: Event[];
  total: number;
}

interface CreateEventData {
  groupId?: string;
  themeId?: string;
  title: string;
  description?: string;
  photoUrl?: string;
  locationName?: string;
  locationLat?: number;
  locationLng?: number;
  startsAt: string;
  endsAt?: string;
  maxParticipants?: number;
  isPublic?: boolean;
}

export function useUpcomingEvents(options?: { groupId?: string; themeId?: string; limit?: number }) {
  return useQuery({
    queryKey: ['events', 'upcoming', options],
    queryFn: async (): Promise<EventsResponse> => {
      const params = new URLSearchParams();
      if (options?.groupId) params.set('group_id', options.groupId);
      if (options?.themeId) params.set('theme_id', options.themeId);
      if (options?.limit) params.set('limit', String(options.limit));

      const response = await api.get(`/events?${params.toString()}`);
      return response.data;
    },
  });
}

export function useMyEvents(options?: { past?: boolean; limit?: number }) {
  return useQuery({
    queryKey: ['events', 'my', options],
    queryFn: async (): Promise<EventsResponse> => {
      const params = new URLSearchParams();
      if (options?.past) params.set('past', 'true');
      if (options?.limit) params.set('limit', String(options.limit));

      const response = await api.get(`/events/my?${params.toString()}`);
      return response.data;
    },
  });
}

export function useEvent(eventId: string) {
  return useQuery({
    queryKey: ['events', eventId],
    queryFn: async (): Promise<Event> => {
      const response = await api.get(`/events/${eventId}`);
      return response.data;
    },
    enabled: !!eventId,
  });
}

export function useCreateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateEventData) => {
      const response = await api.post('/events', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
}

export function useUpdateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ eventId, data }: { eventId: string; data: Partial<CreateEventData> }) => {
      const response = await api.put(`/events/${eventId}`, data);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['events', variables.eventId] });
    },
  });
}

export function useDeleteEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (eventId: string) => {
      const response = await api.delete(`/events/${eventId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
}

export function useJoinEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ eventId, status = 'going' }: { eventId: string; status?: 'going' | 'maybe' }) => {
      const response = await api.post(`/events/${eventId}/join`, { status });
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['events', variables.eventId] });
    },
  });
}

export function useLeaveEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (eventId: string) => {
      const response = await api.delete(`/events/${eventId}/join`);
      return response.data;
    },
    onSuccess: (_, eventId) => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['events', eventId] });
    },
  });
}

export function useEventParticipants(eventId: string, options?: { status?: string }) {
  return useQuery({
    queryKey: ['events', eventId, 'participants', options],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (options?.status) params.set('status', options.status);

      const response = await api.get(`/events/${eventId}/participants?${params.toString()}`);
      return response.data;
    },
    enabled: !!eventId,
  });
}
