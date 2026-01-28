import { query } from '../db/pool.js';
import type { Profile, ProfileFull, ProfilePreview, User, Photo } from '../types/index.js';
import type { CreateProfileInput, UpdateProfileInput } from '../utils/validators.js';
import { extractThemes, calculateProfileCompleteness } from './themeExtractor.service.js';
import config from '../config/index.js';

export async function getProfileByUserId(userId: string): Promise<Profile | null> {
  const result = await query('SELECT * FROM profiles WHERE user_id = $1', [userId]);

  if (result.rows.length === 0) {
    return null;
  }

  return mapDbRowToProfile(result.rows[0]);
}

export async function createProfile(userId: string, input: CreateProfileInput): Promise<Profile> {
  // Check if profile already exists
  const existing = await getProfileByUserId(userId);
  if (existing) {
    throw new Error('Profile already exists');
  }

  // Extract themes
  const fullText = `${input.currentLife} ${input.lookingFor} ${input.whatsImportant}`;
  const themes = extractThemes(fullText);

  // Get user info for completeness calculation
  const userResult = await query('SELECT * FROM users WHERE id = $1', [userId]);
  if (userResult.rows.length === 0) {
    throw new Error('User not found');
  }
  const userRow = userResult.rows[0];

  // Count photos
  const photoResult = await query('SELECT COUNT(*) FROM photos WHERE user_id = $1', [userId]);
  const photoCount = parseInt(photoResult.rows[0].count, 10);

  // Calculate completeness
  const completeness = calculateProfileCompleteness(
    input.currentLife,
    input.lookingFor,
    input.whatsImportant,
    input.notLookingFor,
    photoCount,
    {
      birthYear: userRow.birth_year,
      locationCity: userRow.location_city,
      languages: userRow.languages,
      intentions: userRow.intentions,
    }
  );

  const moderationStatus = config.moderation.autoApprove ? 'approved' : 'pending';

  const result = await query(
    `INSERT INTO profiles (
      user_id, current_life, looking_for, whats_important, not_looking_for,
      extracted_themes, completeness_score, moderation_status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *`,
    [
      userId,
      input.currentLife,
      input.lookingFor,
      input.whatsImportant,
      input.notLookingFor || null,
      themes,
      completeness,
      moderationStatus,
    ]
  );

  return mapDbRowToProfile(result.rows[0]);
}

export async function updateProfile(userId: string, input: UpdateProfileInput): Promise<Profile> {
  const existing = await getProfileByUserId(userId);
  if (!existing) {
    throw new Error('Profile not found');
  }

  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  const currentLife = input.currentLife ?? existing.currentLife;
  const lookingFor = input.lookingFor ?? existing.lookingFor;
  const whatsImportant = input.whatsImportant ?? existing.whatsImportant;
  const notLookingFor = input.notLookingFor ?? existing.notLookingFor;

  if (input.currentLife !== undefined) {
    updates.push(`current_life = $${paramIndex++}`);
    values.push(input.currentLife);
  }

  if (input.lookingFor !== undefined) {
    updates.push(`looking_for = $${paramIndex++}`);
    values.push(input.lookingFor);
  }

  if (input.whatsImportant !== undefined) {
    updates.push(`whats_important = $${paramIndex++}`);
    values.push(input.whatsImportant);
  }

  if (input.notLookingFor !== undefined) {
    updates.push(`not_looking_for = $${paramIndex++}`);
    values.push(input.notLookingFor);
  }

  // Recalculate themes
  if (input.currentLife || input.lookingFor || input.whatsImportant) {
    const fullText = `${currentLife} ${lookingFor} ${whatsImportant}`;
    const themes = extractThemes(fullText);
    updates.push(`extracted_themes = $${paramIndex++}`);
    values.push(themes);
  }

  // Recalculate completeness
  const userResult = await query('SELECT * FROM users WHERE id = $1', [userId]);
  const userRow = userResult.rows[0];
  const photoResult = await query('SELECT COUNT(*) FROM photos WHERE user_id = $1', [userId]);
  const photoCount = parseInt(photoResult.rows[0].count, 10);

  const completeness = calculateProfileCompleteness(
    currentLife,
    lookingFor,
    whatsImportant,
    notLookingFor,
    photoCount,
    {
      birthYear: userRow.birth_year,
      locationCity: userRow.location_city,
      languages: userRow.languages,
      intentions: userRow.intentions,
    }
  );

  updates.push(`completeness_score = $${paramIndex++}`);
  values.push(completeness);

  // Reset moderation if content changed
  if (input.currentLife || input.lookingFor || input.whatsImportant || input.notLookingFor) {
    updates.push(`moderation_status = $${paramIndex++}`);
    values.push(config.moderation.autoApprove ? 'approved' : 'pending');
  }

  if (updates.length === 0) {
    return existing;
  }

  values.push(userId);

  const result = await query(
    `UPDATE profiles SET ${updates.join(', ')} WHERE user_id = $${paramIndex} RETURNING *`,
    values
  );

  return mapDbRowToProfile(result.rows[0]);
}

export async function getProfileFull(userId: string, viewerId?: string): Promise<ProfileFull | null> {
  // Get user and profile
  const result = await query(
    `SELECT
      u.id as user_id, u.username, u.birth_year, u.location_city, u.location_country,
      u.intentions, u.open_to_remote, u.last_active_at,
      p.current_life, p.looking_for, p.whats_important, p.not_looking_for,
      p.extracted_themes, p.completeness_score,
      p.photo_current_life, p.photo_looking_for, p.photo_important, p.photo_not_looking_for
    FROM users u
    JOIN profiles p ON p.user_id = u.id
    WHERE u.id = $1 AND u.is_active = true AND p.moderation_status = 'approved'`,
    [userId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];

  // Get photos
  const photosResult = await query(
    'SELECT * FROM photos WHERE user_id = $1 ORDER BY order_index',
    [userId]
  );

  const photos: Photo[] = photosResult.rows.map(mapDbRowToPhoto);

  // Get viewer info for matching
  let matchedIntentions: string[] = [];
  let isLocal = false;
  let isSameCountry = false;

  if (viewerId) {
    const viewerResult = await query(
      'SELECT intentions, location_city, location_country FROM users WHERE id = $1',
      [viewerId]
    );

    if (viewerResult.rows.length > 0) {
      const viewer = viewerResult.rows[0];
      matchedIntentions = (row.intentions as string[]).filter((i: string) =>
        (viewer.intentions as string[]).includes(i)
      );
      isLocal = viewer.location_city === row.location_city && viewer.location_country === row.location_country;
      isSameCountry = viewer.location_country === row.location_country;
    }
  }

  return {
    userId: row.user_id,
    username: row.username,
    age: row.birth_year ? new Date().getFullYear() - row.birth_year : undefined,
    location: {
      city: row.location_city,
      country: row.location_country,
    },
    currentLifePreview: row.current_life.slice(0, 200) + (row.current_life.length > 200 ? '...' : ''),
    currentLife: row.current_life,
    lookingFor: row.looking_for,
    whatsImportant: row.whats_important,
    notLookingFor: row.not_looking_for,
    intentions: row.intentions,
    matchedIntentions: matchedIntentions as ProfileFull['matchedIntentions'],
    themes: row.extracted_themes,
    openToRemote: row.open_to_remote,
    mainPhotoUrl: photos.length > 0 ? photos[0].url : undefined,
    photos,
    sectionPhotos: {
      currentLife: row.photo_current_life || undefined,
      lookingFor: row.photo_looking_for || undefined,
      important: row.photo_important || undefined,
      notLookingFor: row.photo_not_looking_for || undefined,
    },
    isLocal,
    isSameCountry,
    lastActiveCategory: getLastActiveCategory(new Date(row.last_active_at)),
    completenessScore: row.completeness_score,
  };
}

export function getLastActiveCategory(lastActive: Date): ProfilePreview['lastActiveCategory'] {
  const now = Date.now();
  const diff = now - lastActive.getTime();
  const hours = diff / (1000 * 60 * 60);

  if (hours < 1) return 'now';
  if (hours < 24) return 'today';
  if (hours < 168) return 'week';
  if (hours < 720) return 'month';
  return 'older';
}

function mapDbRowToProfile(row: Record<string, unknown>): Profile {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    currentLife: row.current_life as string,
    lookingFor: row.looking_for as string,
    whatsImportant: row.whats_important as string,
    notLookingFor: row.not_looking_for as string | undefined,
    extractedThemes: row.extracted_themes as string[],
    wordCount: row.word_count as number,
    completenessScore: row.completeness_score as number,
    moderationStatus: row.moderation_status as Profile['moderationStatus'],
    sectionPhotos: {
      currentLife: (row.photo_current_life as string) || undefined,
      lookingFor: (row.photo_looking_for as string) || undefined,
      important: (row.photo_important as string) || undefined,
      notLookingFor: (row.photo_not_looking_for as string) || undefined,
    },
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

function mapDbRowToPhoto(row: Record<string, unknown>): Photo {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    url: row.url as string,
    orderIndex: row.order_index as number,
    caption: row.caption as string | undefined,
    category: row.category as Photo['category'],
    createdAt: new Date(row.created_at as string),
  };
}

export { mapDbRowToProfile, mapDbRowToPhoto };
