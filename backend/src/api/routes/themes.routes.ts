import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import * as themeService from '../../services/theme.service.js';

const router = Router();

// GET /api/themes - List all themes
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const themes = await themeService.getAllThemes();

    res.json({
      success: true,
      data: { themes },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/themes/by-category - List themes grouped by category
router.get('/by-category', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const themesByCategory = await themeService.getThemesByCategory();

    res.json({
      success: true,
      data: { themesByCategory },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/themes/me - Get current user's themes
router.get('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const themes = await themeService.getUserThemes(req.userId!);

    res.json({
      success: true,
      data: { themes },
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/themes/me - Update current user's themes
router.put('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { themeIds } = req.body;

    if (!Array.isArray(themeIds)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'themeIds doit être un tableau' },
      });
    }

    if (themeIds.length > 10) {
      return res.status(400).json({
        success: false,
        error: { code: 'TOO_MANY_THEMES', message: 'Maximum 10 thématiques autorisées' },
      });
    }

    const themes = await themeService.updateUserThemes(req.userId!, themeIds);

    res.json({
      success: true,
      data: { themes },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/themes/:themeId - Get a specific theme
router.get('/:themeId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { themeId } = req.params;
    const theme = await themeService.getThemeById(themeId);

    if (!theme) {
      return res.status(404).json({
        success: false,
        error: { code: 'THEME_NOT_FOUND', message: 'Thématique non trouvée' },
      });
    }

    res.json({
      success: true,
      data: { theme },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
