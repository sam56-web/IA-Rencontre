import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import * as affinityService from '../../services/affinity.service';
import * as notificationService from '../../services/notification.service';
import { query } from '../../db/pool.js';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// GET /api/affinity/matches - Get top affinity matches
router.get('/matches', async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await affinityService.getTopAffinities(userId, limit, offset);

    res.json(result);
  } catch (error) {
    console.error('Error fetching affinity matches:', error);
    res.status(500).json({ error: 'Failed to fetch affinity matches' });
  }
});

// GET /api/affinity/score/:userId - Get affinity score with specific user
router.get('/score/:userId', async (req: Request, res: Response) => {
  try {
    const currentUserId = req.userId!;
    const targetUserId = req.params.userId;

    if (currentUserId === targetUserId) {
      return res.status(400).json({ error: 'Cannot calculate affinity with yourself' });
    }

    const score = await affinityService.calculateAffinity(currentUserId, targetUserId);

    res.json(score);
  } catch (error) {
    console.error('Error calculating affinity:', error);
    res.status(500).json({ error: 'Failed to calculate affinity' });
  }
});

// POST /api/affinity/view/:userId - Record profile view
router.post('/view/:userId', async (req: Request, res: Response) => {
  try {
    const viewerId = req.userId!;
    const viewedId = req.params.userId;

    if (viewerId === viewedId) {
      return res.status(400).json({ error: 'Cannot view your own profile' });
    }

    await affinityService.recordProfileView(viewerId, viewedId);

    // Send notification to viewed user (async, don't wait)
    (async () => {
      try {
        // Get viewer username
        const result = await query(
          'SELECT username FROM users WHERE id = $1',
          [viewerId]
        );
        if (result.rows.length > 0) {
          await notificationService.notifyProfileView(
            viewedId,
            result.rows[0].username,
            viewerId
          );
        }
      } catch (err) {
        console.error('Failed to send profile view notification:', err);
      }
    })();

    res.json({ success: true });
  } catch (error) {
    console.error('Error recording profile view:', error);
    res.status(500).json({ error: 'Failed to record profile view' });
  }
});

// GET /api/affinity/viewers - Get users who viewed my profile
router.get('/viewers', async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await affinityService.getProfileViewers(userId, limit, offset);

    res.json(result);
  } catch (error) {
    console.error('Error fetching profile viewers:', error);
    res.status(500).json({ error: 'Failed to fetch profile viewers' });
  }
});

export default router;
