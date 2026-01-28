import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import * as badgeService from '../../services/badge.service';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// GET /api/badges - Get all available badges
router.get('/', async (_req: Request, res: Response) => {
  try {
    const badges = await badgeService.getAllBadges();
    res.json({ badges });
  } catch (error) {
    console.error('Error fetching badges:', error);
    res.status(500).json({ error: 'Failed to fetch badges' });
  }
});

// GET /api/badges/my - Get current user's badges
router.get('/my', async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const badges = await badgeService.getUserBadges(userId);
    res.json({ badges });
  } catch (error) {
    console.error('Error fetching user badges:', error);
    res.status(500).json({ error: 'Failed to fetch user badges' });
  }
});

// GET /api/badges/user/:userId - Get specific user's badges
router.get('/user/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const badges = await badgeService.getUserBadges(userId);
    res.json({ badges });
  } catch (error) {
    console.error('Error fetching user badges:', error);
    res.status(500).json({ error: 'Failed to fetch user badges' });
  }
});

// POST /api/badges/check - Check and award eligible badges
router.post('/check', async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const awardedBadges = await badgeService.checkAndAwardBadges(userId);

    res.json({
      success: true,
      newBadges: awardedBadges,
      message: awardedBadges.length > 0
        ? `${awardedBadges.length} nouveau(x) badge(s) débloqué(s) !`
        : 'Aucun nouveau badge disponible pour le moment.',
    });
  } catch (error) {
    console.error('Error checking badges:', error);
    res.status(500).json({ error: 'Failed to check badges' });
  }
});

// GET /api/badges/:slug - Get badge details
router.get('/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const badge = await badgeService.getBadgeBySlug(slug);

    if (!badge) {
      return res.status(404).json({ error: 'Badge not found' });
    }

    res.json(badge);
  } catch (error) {
    console.error('Error fetching badge:', error);
    res.status(500).json({ error: 'Failed to fetch badge' });
  }
});

export default router;
