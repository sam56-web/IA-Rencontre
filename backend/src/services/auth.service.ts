import { query } from '../db/pool.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
  getAccessTokenExpirySeconds,
  getRefreshTokenExpiryDate,
} from '../utils/jwt.js';
import type { User, AuthTokens, UserPublic } from '../types/index.js';
import type { SignupInput, LoginInput } from '../utils/validators.js';

interface AuthResult {
  user: UserPublic;
  tokens: AuthTokens;
}

export async function signup(input: SignupInput): Promise<AuthResult> {
  // Check if email already exists
  const emailCheck = await query('SELECT id FROM users WHERE email = $1', [input.email.toLowerCase()]);
  if (emailCheck.rows.length > 0) {
    throw new AuthError('EMAIL_EXISTS', 'An account with this email already exists');
  }

  // Check if username already exists
  const usernameCheck = await query('SELECT id FROM users WHERE username = $1', [input.username]);
  if (usernameCheck.rows.length > 0) {
    throw new AuthError('USERNAME_EXISTS', 'This username is already taken');
  }

  const passwordHash = await hashPassword(input.password);

  const result = await query<User>(
    `INSERT INTO users (
      email, username, password_hash, location_country, location_city,
      intentions, reach_preference, open_to_remote, languages, birth_year
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *`,
    [
      input.email.toLowerCase(),
      input.username,
      passwordHash,
      input.locationCountry,
      input.locationCity || null,
      input.intentions,
      input.reachPreference || 'no_preference',
      input.openToRemote ?? true,
      input.languages || ['fr'],
      input.birthYear || null,
    ]
  );

  const user = mapDbRowToUser(result.rows[0]);
  const tokens = await createTokens(user.id);

  return {
    user: userToPublic(user),
    tokens,
  };
}

export async function login(input: LoginInput): Promise<AuthResult> {
  const result = await query<User>(
    'SELECT * FROM users WHERE email = $1',
    [input.email.toLowerCase()]
  );

  if (result.rows.length === 0) {
    throw new AuthError('INVALID_CREDENTIALS', 'Invalid email or password');
  }

  const user = mapDbRowToUser(result.rows[0]);

  const isValidPassword = await verifyPassword(input.password, user.passwordHash);
  if (!isValidPassword) {
    throw new AuthError('INVALID_CREDENTIALS', 'Invalid email or password');
  }

  if (!user.isActive) {
    throw new AuthError('ACCOUNT_DISABLED', 'This account has been disabled');
  }

  // Update last active
  await query('UPDATE users SET last_active_at = NOW() WHERE id = $1', [user.id]);

  const tokens = await createTokens(user.id);

  return {
    user: userToPublic(user),
    tokens,
  };
}

export async function refreshTokens(refreshToken: string): Promise<AuthTokens> {
  const tokenHash = hashToken(refreshToken);

  const result = await query(
    `SELECT user_id, expires_at FROM refresh_tokens
     WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > NOW()`,
    [tokenHash]
  );

  if (result.rows.length === 0) {
    throw new AuthError('INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token');
  }

  const userId = result.rows[0].user_id;

  // Revoke old token
  await query(
    'UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1',
    [tokenHash]
  );

  // Create new tokens
  return createTokens(userId);
}

export async function logout(userId: string, refreshToken?: string): Promise<void> {
  if (refreshToken) {
    const tokenHash = hashToken(refreshToken);
    await query(
      'UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND token_hash = $2',
      [userId, tokenHash]
    );
  } else {
    // Revoke all tokens for user
    await query(
      'UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1',
      [userId]
    );
  }
}

export async function getUserById(userId: string): Promise<User | null> {
  const result = await query<User>('SELECT * FROM users WHERE id = $1', [userId]);

  if (result.rows.length === 0) {
    return null;
  }

  return mapDbRowToUser(result.rows[0]);
}

async function createTokens(userId: string): Promise<AuthTokens> {
  const accessToken = generateAccessToken(userId);
  const refreshToken = generateRefreshToken();
  const refreshTokenHash = hashToken(refreshToken);
  const expiresAt = getRefreshTokenExpiryDate();

  await query(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
    [userId, refreshTokenHash, expiresAt]
  );

  return {
    accessToken,
    refreshToken,
    expiresIn: getAccessTokenExpirySeconds(),
  };
}

function mapDbRowToUser(row: Record<string, unknown>): User {
  return {
    id: row.id as string,
    email: row.email as string,
    emailVerified: row.email_verified as boolean,
    username: row.username as string,
    passwordHash: row.password_hash as string,
    birthYear: row.birth_year as number | undefined,
    locationCity: row.location_city as string | undefined,
    locationCountry: row.location_country as string,
    timezone: row.timezone as string | undefined,
    intentions: row.intentions as User['intentions'],
    reachPreference: row.reach_preference as User['reachPreference'],
    openToRemote: row.open_to_remote as boolean,
    languages: row.languages as string[],
    isPremium: row.is_premium as boolean,
    isActive: row.is_active as boolean,
    isPaused: row.is_paused as boolean,
    pauseUntil: row.pause_until ? new Date(row.pause_until as string) : undefined,
    weeklyInitiativesUsed: row.weekly_initiatives_used as number,
    weeklyInitiativesResetAt: new Date(row.weekly_initiatives_reset_at as string),
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
    lastActiveAt: new Date(row.last_active_at as string),
  };
}

function userToPublic(user: User): UserPublic {
  return {
    id: user.id,
    username: user.username,
    birthYear: user.birthYear,
    locationCity: user.locationCity,
    locationCountry: user.locationCountry,
    intentions: user.intentions,
    reachPreference: user.reachPreference,
    openToRemote: user.openToRemote,
    languages: user.languages,
    isPremium: user.isPremium,
    lastActiveAt: user.lastActiveAt,
  };
}

export class AuthError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export { mapDbRowToUser, userToPublic };
