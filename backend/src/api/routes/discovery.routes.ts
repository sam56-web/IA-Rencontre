import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import {
  discoverProfiles,
  getZoneVitality,
  getSerendipityProfiles,
} from '../../services/discovery.service.js';
import { discoveryQuerySchema } from '../../utils/validators.js';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// GET /api/discover
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = discoveryQuerySchema.parse(req.query);
    const result = await discoverProfiles(req.userId!, params);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/discover/serendipity
router.get('/serendipity', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 5, 10);
    const profiles = await getSerendipityProfiles(req.userId!, limit);

    res.json({
      success: true,
      data: {
        profiles,
        message: 'Des profils différents pour élargir vos horizons',
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/zones/vitality
router.get('/zones/vitality', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const vitality = await getZoneVitality(user.locationCountry, user.locationCity);

    res.json({
      success: true,
      data: vitality,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
