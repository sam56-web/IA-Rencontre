import { query, transaction } from '../db/pool.js';
import type { User, UserPublic } from '../types/index.js';
import type { UpdateUserInput } from '../utils/validators.js';
import { mapDbRowToUser, userToPublic } from './auth.service.js';
import config from '../config/index.js';

export async function getUserById(userId: string): Promise<User | null> {
  const result = await query('SELECT * FROM users WHERE id = $1', [userId]);

  if (result.rows.length === 0) {
    return null;
  }

  return mapDbRowToUser(result.rows[0]);
}

export async function getUserPublicById(userId: string): Promise<UserPublic | null> {
  const user = await getUserById(userId);
  return user ? userToPublic(user) : null;
}

export async function updateUser(userId: string, input: UpdateUserInput): Promise<User> {
  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (input.locationCountry !== undefined) {
    updates.push(`location_country = $${paramIndex++}`);
    values.push(input.locationCountry);
  }

  if (input.locationCity !== undefined) {
    updates.push(`location_city = $${paramIndex++}`);
    values.push(input.locationCity);
  }

  if (input.timezone !== undefined) {
    updates.push(`timezone = $${paramIndex++}`);
    values.push(input.timezone);
  }

  if (input.intentions !== undefined) {
    updates.push(`intentions = $${paramIndex++}`);
    values.push(input.intentions);
  }

  if (input.reachPreference !== undefined) {
    updates.push(`reach_preference = $${paramIndex++}`);
    values.push(input.reachPreference);
  }

  if (input.openToRemote !== undefined) {
    updates.push(`open_to_remote = $${paramIndex++}`);
    values.push(input.openToRemote);
  }

  if (input.languages !== undefined) {
    updates.push(`languages = $${paramIndex++}`);
    values.push(input.languages);
  }

  if (input.birthYear !== undefined) {
    updates.push(`birth_year = $${paramIndex++}`);
    values.push(input.birthYear);
  }

  if (updates.length === 0) {
    const user = await getUserById(userId);
    if (!user) throw new Error('User not found');
    return user;
  }

  values.push(userId);

  const result = await query(
    `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );

  if (result.rows.length === 0) {
    throw new Error('User not found');
  }

  return mapDbRowToUser(result.rows[0]);
}

export async function pauseUser(userId: string, until?: Date): Promise<User> {
  const pauseUntil = until || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // Default 30 days

  const result = await query(
    `UPDATE users SET is_paused = true, pause_until = $1 WHERE id = $2 RETURNING *`,
    [pauseUntil, userId]
  );

  if (result.rows.length === 0) {
    throw new Error('User not found');
  }

  return mapDbRowToUser(result.rows[0]);
}

export async function unpauseUser(userId: string): Promise<User> {
  const result = await query(
    `UPDATE users SET is_paused = false, pause_until = NULL WHERE id = $1 RETURNING *`,
    [userId]
  );

  if (result.rows.length === 0) {
    throw new Error('User not found');
  }

  return mapDbRowToUser(result.rows[0]);
}

export async function deleteUser(userId: string): Promise<void> {
  await transaction(async (client) => {
    // Delete all user data (cascade handles most)
    await client.query('DELETE FROM users WHERE id = $1', [userId]);
  });
}

export async function updateLastActive(userId: string): Promise<void> {
  await query('UPDATE users SET last_active_at = NOW() WHERE id = $1', [userId]);
}

export async function checkAndResetWeeklyQuota(userId: string): Promise<{ used: number; remaining: number }> {
  const user = await getUserById(userId);
  if (!user) throw new Error('User not found');

  const now = new Date();

  if (now > user.weeklyInitiativesResetAt) {
    // Reset quota
    await query(
      `UPDATE users SET weekly_initiatives_used = 0, weekly_initiatives_reset_at = NOW() + INTERVAL '7 days' WHERE id = $1`,
      [userId]
    );
    return {
      used: 0,
      remaining: user.isPremium ? config.quotas.premiumWeeklyInitiatives : config.quotas.freeWeeklyInitiatives,
    };
  }

  const limit = user.isPremium ? config.quotas.premiumWeeklyInitiatives : config.quotas.freeWeeklyInitiatives;
  return {
    used: user.weeklyInitiativesUsed,
    remaining: Math.max(0, limit - user.weeklyInitiativesUsed),
  };
}

export async function useInitiative(userId: string): Promise<boolean> {
  const quota = await checkAndResetWeeklyQuota(userId);

  if (quota.remaining <= 0) {
    return false;
  }

  await query(
    'UPDATE users SET weekly_initiatives_used = weekly_initiatives_used + 1 WHERE id = $1',
    [userId]
  );

  return true;
}

export async function isUserBlocked(userId: string, targetId: string): Promise<boolean> {
  const result = await query(
    `SELECT 1 FROM blocks WHERE
      (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)`,
    [userId, targetId]
  );

  return result.rows.length > 0;
}
