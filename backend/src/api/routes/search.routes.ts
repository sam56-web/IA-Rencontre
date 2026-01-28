import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import {
  searchProfiles,
  getSearchSuggestions,
  getPopularSearches,
} from '../../services/search.service.js';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// GET /api/search - Search profiles
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      q,
      intentions,
      themeIds,
      minAge,
      maxAge,
      city,
      country,
      limit,
      offset,
    } = req.query;

    if (!q || typeof q !== 'string' || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_QUERY', message: 'La recherche doit contenir au moins 2 caractères' },
      });
    }

    const result = await searchProfiles(req.userId!, {
      query: q.trim(),
      intentions: intentions ? (intentions as string).split(',') : undefined,
      themeIds: themeIds ? (themeIds as string).split(',') : undefined,
      minAge: minAge ? parseInt(minAge as string, 10) : undefined,
      maxAge: maxAge ? parseInt(maxAge as string, 10) : undefined,
      city: city as string | undefined,
      country: country as string | undefined,
      limit: limit ? parseInt(limit as string, 10) : 20,
      offset: offset ? parseInt(offset as string, 10) : 0,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/search/suggestions - Get search suggestions
router.get('/suggestions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { q } = req.query;

    if (!q || typeof q !== 'string') {
      return res.json({
        success: true,
        data: { suggestions: [] },
      });
    }

    const suggestions = await getSearchSuggestions(q.trim());

    res.json({
      success: true,
      data: { suggestions },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/search/popular - Get popular searches
router.get('/popular', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { limit } = req.query;
    const searches = await getPopularSearches(limit ? parseInt(limit as string, 10) : 10);

    res.json({
      success: true,
      data: { searches },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
