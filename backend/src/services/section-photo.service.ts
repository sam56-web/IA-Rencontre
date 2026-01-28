import path from 'path';
import fs from 'fs/promises';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/pool.js';
import config from '../config/index.js';

export interface SectionPhoto {
  id: string;
  userId: string;
  section: string;
  url: string;
  position: number;
  createdAt: Date;
}

export type SectionName = 'current_life' | 'looking_for' | 'important';

// Limits for each section
export const SECTION_LIMITS: Record<string, number> = {
  current_life: 4,
  looking_for: 4,
  important: 2,
  not_looking_for: 0, // Not allowed
};

const VALID_SECTIONS = ['current_life', 'looking_for', 'important'];

const uploadDir = path.resolve(config.storage.path);

// Ensure upload directory exists
fs.mkdir(path.join(uploadDir, 'sections'), { recursive: true }).catch(() => {});

export function isValidSection(section: string): section is SectionName {
  return VALID_SECTIONS.includes(section);
}

export async function uploadSectionPhoto(
  userId: string,
  section: string,
  fileBuffer: Buffer
): Promise<SectionPhoto> {
  // Validate section
  if (!isValidSection(section)) {
    throw new Error(`Invalid section: ${section}. Must be one of: ${VALID_SECTIONS.join(', ')}`);
  }

  const limit = SECTION_LIMITS[section];
  if (limit === 0) {
    throw new Error(`Photos are not allowed for section: ${section}`);
  }

  // Check current count for this section
  const countResult = await query(
    'SELECT COUNT(*) FROM section_photos WHERE user_id = $1 AND section = $2',
    [userId, section]
  );
  const currentCount = parseInt(countResult.rows[0].count, 10);

  if (currentCount >= limit) {
    throw new Error(`Maximum ${limit} photos allowed for section ${section}`);
  }

  // Process image with sharp - square crop for section photos
  const photoId = uuidv4();
  const filename = `section_${section}_${photoId}.webp`;
  const filepath = path.join(uploadDir, 'sections', filename);

  await sharp(fileBuffer)
    .resize(600, 600, { fit: 'cover', position: 'centre' })
    .webp({ quality: 85 })
    .toFile(filepath);

  const url = `/uploads/sections/${filename}`;

  // Insert with position = current count (append at end)
  const result = await query(
    `INSERT INTO section_photos (id, user_id, section, url, position)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [photoId, userId, section, url, currentCount]
  );

  return mapRowToSectionPhoto(result.rows[0]);
}

export async function getSectionPhotos(
  userId: string,
  section?: string
): Promise<Record<string, SectionPhoto[]> | SectionPhoto[]> {
  if (section) {
    // Return photos for specific section
    const result = await query(
      `SELECT * FROM section_photos
       WHERE user_id = $1 AND section = $2
       ORDER BY position`,
      [userId, section]
    );
    return result.rows.map(mapRowToSectionPhoto);
  }

  // Return all photos grouped by section
  const result = await query(
    `SELECT * FROM section_photos
     WHERE user_id = $1
     ORDER BY section, position`,
    [userId]
  );

  const grouped: Record<string, SectionPhoto[]> = {
    current_life: [],
    looking_for: [],
    important: [],
  };

  for (const row of result.rows) {
    const photo = mapRowToSectionPhoto(row);
    if (grouped[photo.section]) {
      grouped[photo.section].push(photo);
    }
  }

  return grouped;
}

export async function getSectionPhotosForUser(
  userId: string
): Promise<Record<string, SectionPhoto[]>> {
  const result = await query(
    `SELECT * FROM section_photos
     WHERE user_id = $1
     ORDER BY section, position`,
    [userId]
  );

  const grouped: Record<string, SectionPhoto[]> = {
    current_life: [],
    looking_for: [],
    important: [],
  };

  for (const row of result.rows) {
    const photo = mapRowToSectionPhoto(row);
    if (grouped[photo.section]) {
      grouped[photo.section].push(photo);
    }
  }

  return grouped;
}

export async function deleteSectionPhoto(
  userId: string,
  photoId: string
): Promise<boolean> {
  // Get the photo to verify ownership and get file path
  const photoResult = await query(
    'SELECT * FROM section_photos WHERE id = $1 AND user_id = $2',
    [photoId, userId]
  );

  if (photoResult.rows.length === 0) {
    return false;
  }

  const photo = photoResult.rows[0];
  const section = photo.section;
  const position = photo.position;

  // Delete file
  const filename = photo.url.split('/').pop();
  if (filename) {
    await fs.unlink(path.join(uploadDir, 'sections', filename)).catch(() => {});
  }

  // Delete from database
  await query('DELETE FROM section_photos WHERE id = $1', [photoId]);

  // Reorder remaining photos in this section
  await query(
    `UPDATE section_photos
     SET position = position - 1
     WHERE user_id = $1 AND section = $2 AND position > $3`,
    [userId, section, position]
  );

  return true;
}

export async function reorderSectionPhotos(
  userId: string,
  section: string,
  photoIds: string[]
): Promise<boolean> {
  if (!isValidSection(section)) {
    throw new Error(`Invalid section: ${section}`);
  }

  // Verify all photos belong to user and section
  const result = await query(
    'SELECT id FROM section_photos WHERE user_id = $1 AND section = $2',
    [userId, section]
  );

  const existingIds = result.rows.map((r) => r.id);
  const allValid = photoIds.every((id) => existingIds.includes(id));

  if (!allValid || photoIds.length !== existingIds.length) {
    throw new Error('Invalid photo IDs provided');
  }

  // Update positions
  for (let i = 0; i < photoIds.length; i++) {
    await query(
      'UPDATE section_photos SET position = $1 WHERE id = $2',
      [i, photoIds[i]]
    );
  }

  return true;
}

function mapRowToSectionPhoto(row: Record<string, unknown>): SectionPhoto {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    section: row.section as string,
    url: row.url as string,
    position: row.position as number,
    createdAt: new Date(row.created_at as string),
  };
}
