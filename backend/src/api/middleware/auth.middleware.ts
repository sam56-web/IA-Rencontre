import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../../utils/jwt.js';
import { getUserById } from '../../services/auth.service.js';
import { updateLastActive } from '../../services/user.service.js';
import { getUserRiskScore } from '../../services/moderation.service.js';

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'No token provided' },
    });
    return;
  }

  const token = authHeader.slice(7);
  const payload = verifyAccessToken(token);

  if (!payload) {
    res.status(401).json({
      success: false,
      error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' },
    });
    return;
  }

  const user = await getUserById(payload.userId);

  if (!user) {
    res.status(401).json({
      success: false,
      error: { code: 'USER_NOT_FOUND', message: 'User not found' },
    });
    return;
  }

  if (!user.isActive) {
    res.status(403).json({
      success: false,
      error: { code: 'ACCOUNT_DISABLED', message: 'Account has been disabled' },
    });
    return;
  }

  // Check if suspended
  const riskScore = await getUserRiskScore(user.id);
  if (riskScore?.isSuspended) {
    const message = riskScore.suspensionEnd
      ? `Account suspended until ${riskScore.suspensionEnd.toISOString()}`
      : 'Account suspended';
    res.status(403).json({
      success: false,
      error: { code: 'ACCOUNT_SUSPENDED', message },
    });
    return;
  }

  req.userId = user.id;
  req.user = user;

  // Update last active (fire and forget)
  updateLastActive(user.id).catch(() => {});

  next();
}

export function optionalAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = authHeader.slice(7);
  const payload = verifyAccessToken(token);

  if (payload) {
    req.userId = payload.userId;
  }

  next();
}
