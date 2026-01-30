// ============ ENUMS ============

export const INTENTIONS = [
  'romantic',
  'friendship',
  'discussions',
  'creative_project',
  'travel_experiences',
  'not_sure_yet'
] as const;

export type Intention = typeof INTENTIONS[number];

export const INTENTION_LABELS: Record<Intention, string> = {
  romantic: 'Romantique',
  friendship: 'Amitié',
  discussions: 'Discussions',
  creative_project: 'Projet créatif',
  travel_experiences: 'Voyages',
  not_sure_yet: 'Pas encore sûr(e)',
};

export const REACH_PREFERENCES = [
  'local_only',
  'national',
  'international',
  'no_preference'
] as const;

export type ReachPreference = typeof REACH_PREFERENCES[number];

export const MODERATION_STATUSES = ['pending', 'approved', 'flagged', 'rejected'] as const;
export type ModerationStatus = typeof MODERATION_STATUSES[number];

// ============ USER ============

export interface User {
  id: string;
  email: string;
  emailVerified: boolean;
  username: string;
  birthYear?: number;
  locationCity?: string;
  locationCountry: string;
  intentions: Intention[];
  reachPreference: ReachPreference;
  openToRemote: boolean;
  languages: string[];
  isPremium: boolean;
  isPaused: boolean;
  pauseUntil?: string;
  quota?: {
    weeklyInitiativesUsed: number;
    weeklyInitiativesRemaining: number;
    resetsAt: string;
  };
  lastActiveAt: string;
  createdAt: string;
}

// ============ PROFILE ============

// Section photo for multiple photos per section
export interface SectionPhoto {
  id: string;
  userId: string;
  section: string;
  url: string;
  position: number;
  createdAt: string;
}

// Section photos grouped by section name (supports multiple photos per section)
export interface SectionPhotosGrouped {
  current_life: SectionPhoto[];
  looking_for: SectionPhoto[];
  important: SectionPhoto[];
}

// Section limits
export const SECTION_PHOTO_LIMITS = {
  current_life: 4,
  looking_for: 4,
  important: 2,
  not_looking_for: 0,
} as const;

export interface Profile {
  id: string;
  userId: string;
  currentLife: string;
  lookingFor: string;
  whatsImportant: string;
  notLookingFor?: string;
  extractedThemes: string[];
  wordCount: number;
  completenessScore: number;
  moderationStatus: ModerationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ProfilePreview {
  userId: string;
  username: string;
  age?: number;
  location: { city?: string; country: string };
  currentLifePreview: string;
  lookingFor: string;
  intentions: Intention[];
  matchedIntentions: Intention[];
  themes: string[];
  openToRemote: boolean;
  mainPhotoUrl?: string;
  isLocal: boolean;
  isSameCountry: boolean;
  lastActiveCategory: 'now' | 'today' | 'week' | 'month' | 'older';
}

export interface ProfileFull extends ProfilePreview {
  currentLife: string;
  whatsImportant: string;
  notLookingFor?: string;
  photos: Photo[];
  sectionPhotos?: SectionPhotosGrouped;
  completenessScore: number;
}

// ============ PHOTO ============

export interface Photo {
  id: string;
  userId: string;
  url: string;
  orderIndex: number;
  caption?: string;
  category: 'self' | 'place' | 'activity' | 'expressive';
  createdAt: string;
}

// ============ DISCOVERY ============

export type DiscoveryMode = 'geography' | 'affinities' | 'intentions';

export interface DiscoveryResponse {
  profiles: ProfilePreview[];
  total: number;
  page: number;
  hasMore: boolean;
  zoneVitality?: ZoneVitality;
}

export interface ZoneVitality {
  localCount: number;
  nationalCount: number;
  globalCount: number;
  status: 'pioneer' | 'growing' | 'active' | 'vibrant';
  message: string;
}

// ============ CONVERSATION ============

export interface Conversation {
  id: string;
  otherUser: {
    id: string;
    username: string;
    mainPhotoUrl?: string;
    lastActiveCategory: ProfilePreview['lastActiveCategory'];
  };
  matchedIntentions: Intention[];
  lastMessage?: {
    content: string;
    sentByMe: boolean;
    createdAt: string;
  };
  unreadCount: number;
  status: 'active' | 'archived' | 'blocked';
  createdAt: string;
}

export interface ConversationDetail extends Conversation {
  initialQuotedText?: string;
  messageCount: number;
}

// ============ MESSAGE ============

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  quotedProfileText?: string;
  isRead: boolean;
  readAt?: string;
  moderationStatus: ModerationStatus;
  createdAt: string;
}

// ============ AUTH ============

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface SignupInput {
  email: string;
  username: string;
  password: string;
  locationCountry: string;
  locationCity?: string;
  intentions: Intention[];
  reachPreference?: ReachPreference;
  openToRemote?: boolean;
  languages?: string[];
  birthYear?: number;
}

// ============ THEMES ============

export type ThemeCategory = 'intellectual' | 'creative' | 'social' | 'lifestyle';

export interface Theme {
  id: string;
  slug: string;
  name: string;
  icon?: string;
  category?: ThemeCategory;
}

export const THEME_CATEGORY_LABELS: Record<ThemeCategory, string> = {
  intellectual: 'Intellectuel',
  creative: 'Créatif',
  social: 'Social',
  lifestyle: 'Style de vie',
};

// ============ GROUPS ============

export type GroupRole = 'admin' | 'moderator' | 'member';
export type InvitationStatus = 'pending' | 'accepted' | 'declined';

export interface Group {
  id: string;
  name: string;
  description?: string;
  photoUrl?: string;
  theme?: {
    id: string;
    name: string;
    slug: string;
    icon?: string;
  };
  isPublic: boolean;
  memberCount: number;
  userRole: GroupRole | null;
  isMember: boolean;
  lastMessage?: {
    content: string;
    createdAt: string;
  };
}

export interface GroupDetail extends Group {
  creatorId: string;
  maxMembers: number;
  createdAt: string;
  updatedAt: string;
}

export interface GroupMember {
  groupId: string;
  userId: string;
  username: string;
  photoUrl?: string;
  role: GroupRole;
  joinedAt: string;
}

export interface GroupInvitation {
  id: string;
  groupId: string;
  inviterId: string;
  inviteeId: string;
  status: InvitationStatus;
  createdAt: string;
  inviterUsername: string;
  group: Group;
}

export interface GroupMessage {
  id: string;
  groupId: string;
  senderId: string;
  senderUsername: string;
  senderPhotoUrl?: string;
  content: string;
  createdAt: string;
}

export interface CreateGroupInput {
  name: string;
  description?: string;
  themeId?: string;
  isPublic?: boolean;
}

// ============ API ============

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

export interface ApiError {
  code: string;
  message: string;
  field?: string;
  details?: { field: string; message: string }[];
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}
