import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import {
  updateUser,
  pauseUser,
  unpauseUser,
  deleteUser,
  checkAndResetWeeklyQuota,
} from '../../services/user.service.js';
import { userToPublic } from '../../services/auth.service.js';
import { updateUserSchema, pauseUserSchema } from '../../utils/validators.js';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// GET /api/users/me
router.get('/me', async (req: Request, res: Response) => {
  const user = req.user!;
  const quota = await checkAndResetWeeklyQuota(user.id);

  res.json({
    success: true,
    data: {
      ...userToPublic(user),
      email: user.email,
      emailVerified: user.emailVerified,
      isPaused: user.isPaused,
      pauseUntil: user.pauseUntil,
      quota: {
        weeklyInitiativesUsed: quota.used,
        weeklyInitiativesRemaining: quota.remaining,
        resetsAt: user.weeklyInitiativesResetAt,
      },
      createdAt: user.createdAt,
    },
  });
});

// PATCH /api/users/me
router.patch('/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = updateUserSchema.parse(req.body);
    const user = await updateUser(req.userId!, input);

    res.json({
      success: true,
      data: userToPublic(user),
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/users/me/pause
router.post('/me/pause', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { until } = pauseUserSchema.parse(req.body);
    const user = await pauseUser(req.userId!, until ? new Date(until) : undefined);

    res.json({
      success: true,
      data: {
        isPaused: user.isPaused,
        pauseUntil: user.pauseUntil,
        message: 'Your profile is now paused and hidden from discovery',
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/users/me/unpause
router.post('/me/unpause', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await unpauseUser(req.userId!);

    res.json({
      success: true,
      data: {
        isPaused: user.isPaused,
        message: 'Your profile is now visible again',
      },
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/users/me
router.delete('/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await deleteUser(req.userId!);

    res.json({
      success: true,
      data: { message: 'Account deleted successfully' },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
