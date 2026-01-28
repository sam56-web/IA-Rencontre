import { Router, Request, Response, NextFunction } from 'express';
import { signup, login, refreshTokens, logout } from '../../services/auth.service.js';
import { signupSchema, loginSchema, refreshTokenSchema } from '../../utils/validators.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { authRateLimit } from '../middleware/rateLimit.middleware.js';

const router = Router();

// POST /api/auth/signup
router.post(
  '/signup',
  authRateLimit(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = signupSchema.parse(req.body);
      const result = await signup(input);

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/auth/login
router.post(
  '/login',
  authRateLimit(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = loginSchema.parse(req.body);
      const result = await login(input);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/auth/refresh
router.post(
  '/refresh',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { refreshToken } = refreshTokenSchema.parse(req.body);
      const tokens = await refreshTokens(refreshToken);

      res.json({
        success: true,
        data: tokens,
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/auth/logout
router.post(
  '/logout',
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const refreshToken = req.body.refreshToken;
      await logout(req.userId!, refreshToken);

      res.json({
        success: true,
        data: { message: 'Logged out successfully' },
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/auth/forgot-password (placeholder)
router.post(
  '/forgot-password',
  authRateLimit(),
  async (req: Request, res: Response) => {
    // In production, this would send a password reset email
    res.json({
      success: true,
      data: { message: 'If an account with this email exists, a reset link has been sent' },
    });
  }
);

export default router;
