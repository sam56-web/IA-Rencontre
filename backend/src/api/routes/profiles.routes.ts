import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import {
  getProfileByUserId,
  createProfile,
  updateProfile,
  getProfileFull,
} from '../../services/profile.service.js';
import { createProfileSchema, updateProfileSchema } from '../../utils/validators.js';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// GET /api/profiles/me
router.get('/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = await getProfileByUserId(req.userId!);

    if (!profile) {
      res.status(404).json({
        success: false,
        error: { code: 'PROFILE_NOT_FOUND', message: 'Profile not found' },
      });
      return;
    }

    res.json({
      success: true,
      data: profile,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/profiles
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createProfileSchema.parse(req.body);
    const profile = await createProfile(req.userId!, input);

    res.status(201).json({
      success: true,
      data: profile,
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/profiles
router.patch('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = updateProfileSchema.parse(req.body);
    const profile = await updateProfile(req.userId!, input);

    res.json({
      success: true,
      data: profile,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/profiles/:userId
router.get('/:userId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;
    const profile = await getProfileFull(userId, req.userId);

    if (!profile) {
      res.status(404).json({
        success: false,
        error: { code: 'PROFILE_NOT_FOUND', message: 'Profile not found' },
      });
      return;
    }

    res.json({
      success: true,
      data: profile,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
