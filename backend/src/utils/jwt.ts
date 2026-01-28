import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import config from '../config/index.js';

interface TokenPayload {
  userId: string;
  type: 'access' | 'refresh';
}

export function generateAccessToken(userId: string): string {
  return jwt.sign(
    { userId, type: 'access' } as TokenPayload,
    config.jwt.secret,
    { expiresIn: config.jwt.accessExpiry }
  );
}

export function generateRefreshToken(): string {
  return crypto.randomBytes(64).toString('hex');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function verifyAccessToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, config.jwt.secret) as TokenPayload;
    if (decoded.type !== 'access') {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

export function getAccessTokenExpirySeconds(): number {
  const expiry = config.jwt.accessExpiry;
  const match = expiry.match(/^(\d+)([smhd])$/);

  if (!match) {
    return 900; // Default 15 minutes
  }

  const [, value, unit] = match;
  const num = parseInt(value, 10);

  switch (unit) {
    case 's':
      return num;
    case 'm':
      return num * 60;
    case 'h':
      return num * 3600;
    case 'd':
      return num * 86400;
    default:
      return 900;
  }
}

export function getRefreshTokenExpiryDate(): Date {
  const expiry = config.jwt.refreshExpiry;
  const match = expiry.match(/^(\d+)([smhd])$/);

  const now = new Date();

  if (!match) {
    now.setDate(now.getDate() + 7); // Default 7 days
    return now;
  }

  const [, value, unit] = match;
  const num = parseInt(value, 10);

  switch (unit) {
    case 's':
      now.setSeconds(now.getSeconds() + num);
      break;
    case 'm':
      now.setMinutes(now.getMinutes() + num);
      break;
    case 'h':
      now.setHours(now.getHours() + num);
      break;
    case 'd':
      now.setDate(now.getDate() + num);
      break;
  }

  return now;
}
