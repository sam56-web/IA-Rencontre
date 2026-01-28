import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { query } from '../../db/pool.js';
import { photoMetadataSchema, reorderPhotosSchema } from '../../utils/validators.js';
import config from '../../config/index.js';
import type { Photo } from '../../types/index.js';

const router = Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.'));
    }
  },
});

// Ensure upload directory exists
const uploadDir = path.resolve(config.storage.path);
fs.mkdir(uploadDir, { recursive: true }).catch(() => {});

// All routes require authentication
router.use(authMiddleware);

// GET /api/photos
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      'SELECT * FROM photos WHERE user_id = $1 ORDER BY order_index',
      [req.userId!]
    );

    const photos: Photo[] = result.rows.map(mapDbRowToPhoto);

    res.json({
      success: true,
      data: photos,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/photos
router.post(
  '/',
  upload.single('photo'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          error: { code: 'NO_FILE', message: 'No file uploaded' },
        });
        return;
      }

      // Check photo limit
      const countResult = await query(
        'SELECT COUNT(*) FROM photos WHERE user_id = $1',
        [req.userId!]
      );
      const photoCount = parseInt(countResult.rows[0].count, 10);

      if (photoCount >= 6) {
        res.status(400).json({
          success: false,
          error: { code: 'LIMIT_EXCEEDED', message: 'Maximum 6 photos allowed' },
        });
        return;
      }

      // Parse metadata
      const metadata = photoMetadataSchema.parse({
        caption: req.body.caption,
        category: req.body.category,
      });

      // Process image with sharp
      const photoId = uuidv4();
      const filename = `${photoId}.webp`;
      const filepath = path.join(uploadDir, filename);

      await sharp(req.file.buffer)
        .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 85 })
        .toFile(filepath);

      // Save to database
      const url = `/uploads/${filename}`;
      const result = await query(
        `INSERT INTO photos (id, user_id, url, order_index, caption, category)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [photoId, req.userId!, url, photoCount, metadata.caption || null, metadata.category || 'self']
      );

      const photo = mapDbRowToPhoto(result.rows[0]);

      // Update profile completeness (trigger recalculation)
      await recalculateProfileCompleteness(req.userId!);

      res.status(201).json({
        success: true,
        data: photo,
      });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/photos/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Get photo
    const photoResult = await query(
      'SELECT * FROM photos WHERE id = $1 AND user_id = $2',
      [id, req.userId!]
    );

    if (photoResult.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Photo not found' },
      });
      return;
    }

    const photo = photoResult.rows[0];

    // Delete file
    const filename = photo.url.split('/').pop();
    if (filename) {
      await fs.unlink(path.join(uploadDir, filename)).catch(() => {});
    }

    // Delete from database
    await query('DELETE FROM photos WHERE id = $1', [id]);

    // Reorder remaining photos
    await query(
      `UPDATE photos SET order_index = order_index - 1
       WHERE user_id = $1 AND order_index > $2`,
      [req.userId!, photo.order_index]
    );

    // Update profile completeness
    await recalculateProfileCompleteness(req.userId!);

    res.json({
      success: true,
      data: { message: 'Photo deleted successfully' },
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/photos/reorder
router.patch('/reorder', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { photoIds } = reorderPhotosSchema.parse(req.body);

    // Verify all photos belong to user
    const result = await query(
      'SELECT id FROM photos WHERE user_id = $1',
      [req.userId!]
    );

    const userPhotoIds = result.rows.map((r) => r.id);
    const allValid = photoIds.every((id) => userPhotoIds.includes(id));

    if (!allValid) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_PHOTOS', message: 'Some photos do not belong to you' },
      });
      return;
    }

    // Update order
    for (let i = 0; i < photoIds.length; i++) {
      await query(
        'UPDATE photos SET order_index = $1 WHERE id = $2',
        [i, photoIds[i]]
      );
    }

    res.json({
      success: true,
      data: { message: 'Photos reordered successfully' },
    });
  } catch (error) {
    next(error);
  }
});

// Import section photo service
import * as sectionPhotoService from '../../services/section-photo.service.js';

// GET /api/photos/section - Get all section photos grouped by section
router.get('/section', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const photos = await sectionPhotoService.getSectionPhotosForUser(req.userId!);

    res.json({
      success: true,
      data: photos,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/photos/section/:section - Get photos for a specific section
router.get('/section/:section', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { section } = req.params;

    if (!sectionPhotoService.isValidSection(section)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_SECTION',
          message: 'Invalid section. Must be one of: current_life, looking_for, important',
        },
      });
      return;
    }

    const photos = await sectionPhotoService.getSectionPhotos(req.userId!, section);

    res.json({
      success: true,
      data: photos,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/photos/section/:section - Upload a photo to a section
router.post(
  '/section/:section',
  upload.single('photo'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { section } = req.params;

      if (!req.file) {
        res.status(400).json({
          success: false,
          error: { code: 'NO_FILE', message: 'No file uploaded' },
        });
        return;
      }

      // Check if user has a profile
      const profileResult = await query(
        'SELECT id FROM profiles WHERE user_id = $1',
        [req.userId!]
      );

      if (profileResult.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: { code: 'NO_PROFILE', message: 'You must create a profile first' },
        });
        return;
      }

      const photo = await sectionPhotoService.uploadSectionPhoto(
        req.userId!,
        section,
        req.file.buffer
      );

      res.status(201).json({
        success: true,
        data: photo,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Invalid section')) {
          res.status(400).json({
            success: false,
            error: { code: 'INVALID_SECTION', message: error.message },
          });
          return;
        }
        if (error.message.includes('Maximum')) {
          res.status(400).json({
            success: false,
            error: { code: 'LIMIT_EXCEEDED', message: error.message },
          });
          return;
        }
        if (error.message.includes('not allowed')) {
          res.status(400).json({
            success: false,
            error: { code: 'NOT_ALLOWED', message: error.message },
          });
          return;
        }
      }
      next(error);
    }
  }
);

// DELETE /api/photos/section/:photoId - Delete a section photo
router.delete('/section/:photoId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { photoId } = req.params;

    const deleted = await sectionPhotoService.deleteSectionPhoto(req.userId!, photoId);

    if (!deleted) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Photo not found or not owned by you' },
      });
      return;
    }

    res.json({
      success: true,
      data: { message: 'Section photo deleted successfully' },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/photos/section/:section/reorder - Reorder photos in a section
router.post('/section/:section/reorder', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { section } = req.params;
    const { photoIds } = req.body;

    if (!Array.isArray(photoIds)) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'photoIds must be an array' },
      });
      return;
    }

    await sectionPhotoService.reorderSectionPhotos(req.userId!, section, photoIds);

    res.json({
      success: true,
      data: { message: 'Photos reordered successfully' },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Invalid section') || error.message.includes('Invalid photo')) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: error.message },
        });
        return;
      }
    }
    next(error);
  }
});

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

async function recalculateProfileCompleteness(userId: string): Promise<void> {
  // This triggers a profile update to recalculate completeness
  const profileResult = await query(
    'SELECT current_life, looking_for, whats_important, not_looking_for FROM profiles WHERE user_id = $1',
    [userId]
  );

  if (profileResult.rows.length === 0) return;

  const profile = profileResult.rows[0];
  const userResult = await query('SELECT * FROM users WHERE id = $1', [userId]);
  const user = userResult.rows[0];
  const photoResult = await query('SELECT COUNT(*) FROM photos WHERE user_id = $1', [userId]);
  const photoCount = parseInt(photoResult.rows[0].count, 10);

  // Calculate completeness
  let score = 0;

  // Text blocks (50 points max)
  score += Math.min((profile.current_life as string).length / 100, 15);
  score += Math.min((profile.looking_for as string).length / 60, 15);
  score += Math.min((profile.whats_important as string).length / 60, 15);
  if (profile.not_looking_for && (profile.not_looking_for as string).length > 10) score += 5;

  // Photos (25 points max)
  score += Math.min(photoCount * 6, 24);
  if (photoCount >= 2) score += 1;

  // User info (25 points max)
  if (user.birth_year) score += 5;
  if (user.location_city) score += 5;
  if ((user.languages as string[]).length > 1) score += 5;
  if ((user.intentions as string[]).length > 1) score += 5;
  score += 5;

  const completeness = Math.min(Math.round(score), 100);

  await query(
    'UPDATE profiles SET completeness_score = $1 WHERE user_id = $2',
    [completeness, userId]
  );
}

export default router;
