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

export const REACH_PREFERENCES = [
  'local_only',
  'national',
  'international',
  'no_preference'
] as const;

export type ReachPreference = typeof REACH_PREFERENCES[number];

export const MODERATION_STATUSES = ['pending', 'approved', 'flagged', 'rejected'] as const;
export type ModerationStatus = typeof MODERATION_STATUSES[number];

export const PHOTO_CATEGORIES = ['self', 'place', 'activity', 'expressive'] as const;
export type PhotoCategory = typeof PHOTO_CATEGORIES[number];

export const CONVERSATION_STATUSES = ['active', 'archived', 'blocked'] as const;
export type ConversationStatus = typeof CONVERSATION_STATUSES[number];

// ============ USER ============

export interface User {
  id: string;
  email: string;
  emailVerified: boolean;
  username: string;
  passwordHash: string;
  birthYear?: number;
  locationCity?: string;
  locationCountry: string;
  timezone?: string;
  intentions: Intention[];
  reachPreference: ReachPreference;
  openToRemote: boolean;
  languages: string[];
  isPremium: boolean;
  isActive: boolean;
  isPaused: boolean;
  pauseUntil?: Date;
  weeklyInitiativesUsed: number;
  weeklyInitiativesResetAt: Date;
  createdAt: Date;
  updatedAt: Date;
  lastActiveAt: Date;
}

export interface UserPublic {
  id: string;
  username: string;
  birthYear?: number;
  locationCity?: string;
  locationCountry: string;
  intentions: Intention[];
  reachPreference: ReachPreference;
  openToRemote: boolean;
  languages: string[];
  isPremium: boolean;
  lastActiveAt: Date;
}

// ============ PROFILE ============

export interface SectionPhotos {
  currentLife?: string;
  lookingFor?: string;
  important?: string;
  notLookingFor?: string;
}

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
  sectionPhotos?: SectionPhotos;
  createdAt: Date;
  updatedAt: Date;
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
  sectionPhotos?: SectionPhotos;
  completenessScore: number;
}

// ============ PHOTO ============

export interface Photo {
  id: string;
  userId: string;
  url: string;
  orderIndex: number;
  caption?: string;
  category: PhotoCategory;
  createdAt: Date;
}

// ============ DISCOVERY ============

export type DiscoveryMode = 'around_me' | 'everywhere' | 'by_intention';

export interface DiscoveryParams {
  mode: DiscoveryMode;
  intentions?: Intention[];
  languages?: string[];
  minAge?: number;
  maxAge?: number;
  page: number;
  limit: number;
}

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
  user1Id: string;
  user2Id: string;
  initiatedBy: string;
  initialQuotedText?: string;
  matchedIntentions: Intention[];
  status: ConversationStatus;
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt: Date;
}

export interface ConversationView {
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
    createdAt: Date;
  };
  unreadCount: number;
  status: ConversationStatus;
  createdAt: Date;
}

export interface ConversationDetail extends ConversationView {
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
  readAt?: Date;
  moderationStatus: ModerationStatus;
  createdAt: Date;
}

export interface SendMessageInput {
  content: string;
  quotedProfileText?: string;
}

export interface StartConversationInput {
  recipientId: string;
  content: string;
  quotedProfileText?: string;
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

export interface LoginResponse {
  user: UserPublic;
  tokens: AuthTokens;
}

// ============ MODERATION ============

export interface UserRiskScore {
  userId: string;
  spamScore: number;
  toxicityScore: number;
  harassmentScore: number;
  messageAsymmetryScore: number;
  persistenceScore: number;
  velocityScore: number;
  warningCount: number;
  lastWarningAt?: Date;
  reportsReceivedCount: number;
  blocksReceivedCount: number;
  isShadowBanned: boolean;
  isSuspended: boolean;
  suspensionEnd?: Date;
  updatedAt: Date;
}

export interface Block {
  id: string;
  blockerId: string;
  blockedId: string;
  reason?: string;
  createdAt: Date;
}

export interface Report {
  id: string;
  reporterId: string;
  reportedId: string;
  contentType: 'profile' | 'message' | 'photo' | 'behavior';
  contentId?: string;
  reason: string;
  status: 'pending' | 'reviewed' | 'actioned' | 'dismissed';
  createdAt: Date;
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
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// ============ WEBSOCKET ============

export type WSMessageType =
  | 'connected'
  | 'message_new'
  | 'message_sent'
  | 'message_read'
  | 'typing_start'
  | 'typing_stop'
  | 'typing_update'
  | 'presence_update'
  | 'error'
  | 'ping'
  | 'pong';

export interface WSMessage<T = unknown> {
  type: WSMessageType;
  payload: T;
  timestamp: string;
}

// ============ EXPRESS EXTENSIONS ============

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      user?: User;
    }
  }
}
