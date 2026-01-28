import { z } from 'zod';
import { INTENTIONS, REACH_PREFERENCES, PHOTO_CATEGORIES } from '../types/index.js';

// ============ AUTH ============

export const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must not exceed 30 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores and hyphens'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must not exceed 128 characters'),
  locationCountry: z.string().min(2, 'Country is required').max(100),
  locationCity: z.string().max(100).optional(),
  intentions: z
    .array(z.enum(INTENTIONS))
    .min(1, 'At least one intention is required')
    .max(6, 'Maximum 6 intentions allowed'),
  reachPreference: z.enum(REACH_PREFERENCES).optional(),
  openToRemote: z.boolean().optional(),
  languages: z.array(z.string().min(2).max(10)).optional(),
  birthYear: z
    .number()
    .int()
    .min(1900)
    .max(new Date().getFullYear() - 18, 'You must be at least 18 years old')
    .optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

// ============ USER ============

export const updateUserSchema = z.object({
  locationCountry: z.string().min(2).max(100).optional(),
  locationCity: z.string().max(100).optional().nullable(),
  timezone: z.string().max(50).optional(),
  intentions: z.array(z.enum(INTENTIONS)).min(1).max(6).optional(),
  reachPreference: z.enum(REACH_PREFERENCES).optional(),
  openToRemote: z.boolean().optional(),
  languages: z.array(z.string().min(2).max(10)).optional(),
  birthYear: z
    .number()
    .int()
    .min(1900)
    .max(new Date().getFullYear() - 18)
    .optional()
    .nullable(),
});

export const pauseUserSchema = z.object({
  until: z.string().datetime().optional(),
});

// ============ PROFILE ============

export const createProfileSchema = z.object({
  currentLife: z
    .string()
    .min(20, 'Current life must be at least 20 characters')
    .max(1500, 'Current life must not exceed 1500 characters'),
  lookingFor: z
    .string()
    .min(20, 'Looking for must be at least 20 characters')
    .max(800, 'Looking for must not exceed 800 characters'),
  whatsImportant: z
    .string()
    .min(20, 'What is important must be at least 20 characters')
    .max(800, 'What is important must not exceed 800 characters'),
  notLookingFor: z
    .string()
    .max(500, 'Not looking for must not exceed 500 characters')
    .optional(),
});

export const updateProfileSchema = createProfileSchema.partial();

// ============ PHOTO ============

export const photoMetadataSchema = z.object({
  caption: z.string().max(200).optional(),
  category: z.enum(PHOTO_CATEGORIES).optional(),
});

export const reorderPhotosSchema = z.object({
  photoIds: z.array(z.string().uuid()).min(1),
});

// ============ DISCOVERY ============

export const discoveryQuerySchema = z.object({
  mode: z.enum(['around_me', 'everywhere', 'by_intention']).default('around_me'),
  intentions: z
    .string()
    .transform((val) => val.split(',').filter(Boolean))
    .pipe(z.array(z.enum(INTENTIONS)))
    .optional(),
  languages: z
    .string()
    .transform((val) => val.split(',').filter(Boolean))
    .pipe(z.array(z.string()))
    .optional(),
  minAge: z.coerce.number().int().min(18).max(120).optional(),
  maxAge: z.coerce.number().int().min(18).max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

// ============ CONVERSATION ============

export const startConversationSchema = z.object({
  recipientId: z.string().uuid('Invalid recipient ID'),
  content: z
    .string()
    .min(10, 'Message must be at least 10 characters')
    .max(5000, 'Message must not exceed 5000 characters'),
  quotedProfileText: z.string().max(500).optional(),
});

// ============ MESSAGE ============

export const sendMessageSchema = z.object({
  content: z
    .string()
    .min(1, 'Message cannot be empty')
    .max(5000, 'Message must not exceed 5000 characters'),
  quotedProfileText: z.string().max(500).optional(),
});

// ============ MODERATION ============

export const blockUserSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  reason: z.string().max(500).optional(),
});

export const reportSchema = z.object({
  reportedId: z.string().uuid('Invalid user ID'),
  contentType: z.enum(['profile', 'message', 'photo', 'behavior']),
  contentId: z.string().uuid().optional(),
  reason: z.string().min(10, 'Reason must be at least 10 characters').max(1000),
});

// ============ PAGINATION ============

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ============ HELPERS ============

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type CreateProfileInput = z.infer<typeof createProfileSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type DiscoveryQuery = z.infer<typeof discoveryQuerySchema>;
export type StartConversationInput = z.infer<typeof startConversationSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
