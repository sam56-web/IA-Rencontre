import { Request, Response, NextFunction } from 'express';
import config from '../../config/index.js';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store (would use Redis in production)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up old entries every minute
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}, 60000);

export function rateLimit(options?: {
  windowMs?: number;
  maxRequests?: number;
  keyPrefix?: string;
}) {
  const windowMs = options?.windowMs ?? config.rateLimit.windowMs;
  const maxRequests = options?.maxRequests ?? config.rateLimit.maxRequests;
  const keyPrefix = options?.keyPrefix ?? 'global';

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = `${keyPrefix}:${getClientIdentifier(req)}`;
    const now = Date.now();

    let entry = rateLimitStore.get(key);

    if (!entry || entry.resetAt < now) {
      entry = {
        count: 1,
        resetAt: now + windowMs,
      };
      rateLimitStore.set(key, entry);
    } else {
      entry.count++;
    }

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', maxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - entry.count).toString());
    res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetAt / 1000).toString());

    if (entry.count > maxRequests) {
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests, please try again later',
          retryAfter: Math.ceil((entry.resetAt - now) / 1000),
        },
      });
      return;
    }

    next();
  };
}

export function authRateLimit() {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: config.rateLimit.authMaxRequests,
    keyPrefix: 'auth',
  });
}

export function messageRateLimit() {
  return rateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30, // 30 messages per minute
    keyPrefix: 'message',
  });
}

function getClientIdentifier(req: Request): string {
  // Prefer authenticated user ID, fall back to IP
  if (req.userId) {
    return `user:${req.userId}`;
  }

  // Get IP from X-Forwarded-For header (for proxied requests) or direct connection
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return `ip:${forwarded.split(',')[0].trim()}`;
  }

  return `ip:${req.ip || req.socket.remoteAddress || 'unknown'}`;
}
