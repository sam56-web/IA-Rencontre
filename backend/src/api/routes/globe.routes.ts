import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import globeService, { globeMonitor } from '../../services/globe.service.js';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// GET /api/globe/connections - Récupérer les connexions pour le globe
router.get('/connections', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Non authentifié' });
    }

    const globeData = await globeService.getGlobeConnections(userId);

    res.json({
      success: true,
      data: globeData
    });

  } catch (error) {
    next(error);
  }
});

// GET /api/globe/connections/clustered - Connexions avec clustering
router.get('/connections/clustered', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId;
    const maxDistance = parseFloat(req.query.maxDistance as string) || 500;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Non authentifié' });
    }

    const result = await globeService.getClusteredConnections(userId, maxDistance);

    res.json({
      success: true,
      data: {
        connections: result.connections,
        originalCount: result.originalCount,
        clusteredCount: result.clusteredCount,
        reduction: result.originalCount > 0
          ? Math.round((1 - result.clusteredCount / result.originalCount) * 100)
          : 0
      }
    });

  } catch (error) {
    next(error);
  }
});

// GET /api/globe/zone-stats - Stats de la zone de l'utilisateur
router.get('/zone-stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Non authentifié' });
    }

    const stats = await globeService.getZoneStats(userId);

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    next(error);
  }
});

// POST /api/globe/refresh-cache - Rafraîchir le cache
router.post('/refresh-cache', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Non authentifié' });
    }

    const freshData = await globeService.refreshCache(userId);

    res.json({
      success: true,
      message: 'Cache rafraîchi avec succès',
      data: freshData
    });

  } catch (error) {
    next(error);
  }
});

// GET /api/globe/metrics - Métriques de performance
router.get('/metrics', async (req: Request, res: Response, _next: NextFunction) => {
  res.json({
    success: true,
    data: {
      globe: globeMonitor.getMetrics(),
      timestamp: new Date().toISOString()
    }
  });
});

export default router;
