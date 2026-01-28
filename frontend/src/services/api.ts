import axios, { AxiosError } from 'axios';
import type {
  ApiResponse,
  User,
  Profile,
  ProfileFull,
  DiscoveryResponse,
  Conversation,
  ConversationDetail,
  Message,
  Photo,
  AuthTokens,
  LoginInput,
  SignupInput,
  PaginatedResponse,
  ZoneVitality,
  DiscoveryMode,
  Intention,
} from '../types';
import { useAuthStore } from '../stores/auth.store';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Helper to get full URL for uploaded files
export function getUploadUrl(path: string | undefined): string | undefined {
  if (!path) return undefined;
  if (path.startsWith('http')) return path;
  return `${API_URL}${path}`;
}

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for auth token
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for token refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && originalRequest && !originalRequest.headers['X-Retry']) {
      const refreshToken = useAuthStore.getState().refreshToken;

      if (refreshToken) {
        try {
          const tokens = await authApi.refresh(refreshToken);
          useAuthStore.getState().setTokens(tokens);

          originalRequest.headers['X-Retry'] = 'true';
          originalRequest.headers.Authorization = `Bearer ${tokens.accessToken}`;
          return api(originalRequest);
        } catch {
          useAuthStore.getState().logout();
        }
      }
    }

    return Promise.reject(error);
  }
);

// ============ AUTH ============

export const authApi = {
  async signup(input: SignupInput): Promise<{ user: User; tokens: AuthTokens }> {
    const { data } = await api.post<ApiResponse<{ user: User; tokens: AuthTokens }>>('/auth/signup', input);
    return data.data!;
  },

  async login(input: LoginInput): Promise<{ user: User; tokens: AuthTokens }> {
    const { data } = await api.post<ApiResponse<{ user: User; tokens: AuthTokens }>>('/auth/login', input);
    return data.data!;
  },

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const { data } = await api.post<ApiResponse<AuthTokens>>('/auth/refresh', { refreshToken });
    return data.data!;
  },

  async logout(): Promise<void> {
    const refreshToken = useAuthStore.getState().refreshToken;
    await api.post('/auth/logout', { refreshToken });
  },
};

// ============ USERS ============

export const usersApi = {
  async getMe(): Promise<User> {
    const { data } = await api.get<ApiResponse<User>>('/users/me');
    return data.data!;
  },

  async updateMe(input: Partial<User>): Promise<User> {
    const { data } = await api.patch<ApiResponse<User>>('/users/me', input);
    return data.data!;
  },

  async pauseMe(until?: string): Promise<{ isPaused: boolean; pauseUntil?: string }> {
    const { data } = await api.post<ApiResponse<{ isPaused: boolean; pauseUntil?: string }>>('/users/me/pause', { until });
    return data.data!;
  },

  async unpauseMe(): Promise<{ isPaused: boolean }> {
    const { data } = await api.post<ApiResponse<{ isPaused: boolean }>>('/users/me/unpause');
    return data.data!;
  },

  async deleteMe(): Promise<void> {
    await api.delete('/users/me');
  },
};

// ============ PROFILES ============

export const profilesApi = {
  async getMyProfile(): Promise<Profile> {
    const { data } = await api.get<ApiResponse<Profile>>('/profiles/me');
    return data.data!;
  },

  async createProfile(input: {
    currentLife: string;
    lookingFor: string;
    whatsImportant: string;
    notLookingFor?: string;
  }): Promise<Profile> {
    const { data } = await api.post<ApiResponse<Profile>>('/profiles', input);
    return data.data!;
  },

  async updateProfile(input: Partial<{
    currentLife: string;
    lookingFor: string;
    whatsImportant: string;
    notLookingFor: string;
  }>): Promise<Profile> {
    const { data } = await api.patch<ApiResponse<Profile>>('/profiles', input);
    return data.data!;
  },

  async getProfile(userId: string): Promise<ProfileFull> {
    const { data } = await api.get<ApiResponse<ProfileFull>>(`/profiles/${userId}`);
    return data.data!;
  },
};

// ============ PHOTOS ============

export type SectionPhotoType = 'current_life' | 'looking_for' | 'important' | 'not_looking_for';

export const photosApi = {
  async getMyPhotos(): Promise<Photo[]> {
    const { data } = await api.get<ApiResponse<Photo[]>>('/photos');
    return data.data!;
  },

  async uploadPhoto(file: File, caption?: string, category?: string): Promise<Photo> {
    const formData = new FormData();
    formData.append('photo', file);
    if (caption) formData.append('caption', caption);
    if (category) formData.append('category', category);

    const { data } = await api.post<ApiResponse<Photo>>('/photos', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data.data!;
  },

  async deletePhoto(photoId: string): Promise<void> {
    await api.delete(`/photos/${photoId}`);
  },

  async reorderPhotos(photoIds: string[]): Promise<void> {
    await api.patch('/photos/reorder', { photoIds });
  },

  async uploadSectionPhoto(section: SectionPhotoType, file: File): Promise<{ section: string; url: string }> {
    const formData = new FormData();
    formData.append('photo', file);

    const { data } = await api.post<ApiResponse<{ section: string; url: string }>>(
      `/photos/section/${section}`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return data.data!;
  },

  async deleteSectionPhoto(section: SectionPhotoType): Promise<void> {
    await api.delete(`/photos/section/${section}`);
  },
};

// ============ DISCOVERY ============

export const discoveryApi = {
  async discover(params: {
    mode?: DiscoveryMode;
    intentions?: Intention[];
    languages?: string[];
    minAge?: number;
    maxAge?: number;
    page?: number;
    limit?: number;
  }): Promise<DiscoveryResponse> {
    const { data } = await api.get<ApiResponse<DiscoveryResponse>>('/discover', {
      params: {
        ...params,
        intentions: params.intentions?.join(','),
        languages: params.languages?.join(','),
      },
    });
    return data.data!;
  },

  async getSerendipity(limit?: number): Promise<{ profiles: ProfileFull[]; message: string }> {
    const { data } = await api.get<ApiResponse<{ profiles: ProfileFull[]; message: string }>>('/discover/serendipity', {
      params: { limit },
    });
    return data.data!;
  },

  async getZoneVitality(): Promise<ZoneVitality> {
    const { data } = await api.get<ApiResponse<ZoneVitality>>('/discover/zones/vitality');
    return data.data!;
  },
};

// ============ CONVERSATIONS ============

export const conversationsApi = {
  async getConversations(): Promise<Conversation[]> {
    const { data } = await api.get<ApiResponse<Conversation[]>>('/conversations');
    return data.data!;
  },

  async startConversation(input: {
    recipientId: string;
    content: string;
    quotedProfileText?: string;
  }): Promise<{ conversation: ConversationDetail; messageId: string }> {
    const { data } = await api.post<ApiResponse<{ conversation: ConversationDetail; messageId: string }>>('/conversations', input);
    return data.data!;
  },

  async getConversation(conversationId: string): Promise<ConversationDetail> {
    const { data } = await api.get<ApiResponse<ConversationDetail>>(`/conversations/${conversationId}`);
    return data.data!;
  },

  async archiveConversation(conversationId: string): Promise<void> {
    await api.post(`/conversations/${conversationId}/archive`);
  },
};

// ============ MESSAGES ============

export const messagesApi = {
  async getMessages(conversationId: string, page?: number, limit?: number): Promise<PaginatedResponse<Message>> {
    const { data } = await api.get<ApiResponse<PaginatedResponse<Message>>>(`/conversations/${conversationId}/messages`, {
      params: { page, limit },
    });
    return data.data!;
  },

  async sendMessage(conversationId: string, input: { content: string; quotedProfileText?: string }): Promise<Message> {
    const { data } = await api.post<ApiResponse<Message>>(`/conversations/${conversationId}/messages`, input);
    return data.data!;
  },

  async markAsRead(conversationId: string, messageIds?: string[]): Promise<{ markedAsRead: number }> {
    const { data } = await api.post<ApiResponse<{ markedAsRead: number }>>(`/conversations/${conversationId}/read`, { messageIds });
    return data.data!;
  },

  async getUnreadCount(): Promise<{ unreadCount: number }> {
    const { data } = await api.get<ApiResponse<{ unreadCount: number }>>('/conversations/unread-count');
    return data.data!;
  },
};

// ============ MODERATION ============

export const moderationApi = {
  async blockUser(userId: string, reason?: string): Promise<void> {
    await api.post('/blocks', { userId, reason });
  },

  async unblockUser(userId: string): Promise<void> {
    await api.delete(`/blocks/${userId}`);
  },

  async reportUser(input: {
    reportedId: string;
    contentType: 'profile' | 'message' | 'photo' | 'behavior';
    contentId?: string;
    reason: string;
  }): Promise<void> {
    await api.post('/reports', input);
  },
};

export default api;
