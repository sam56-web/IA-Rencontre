import pool from '../db/pool.js';
import type { Theme, UserTheme } from '../types/index.js';

export async function getAllThemes(): Promise<Theme[]> {
  const result = await pool.query(`
    SELECT id, slug, name, icon, category
    FROM themes
    ORDER BY category, name
  `);

  return result.rows.map(row => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    icon: row.icon,
    category: row.category,
  }));
}

export async function getThemesByCategory(): Promise<Record<string, Theme[]>> {
  const themes = await getAllThemes();

  return themes.reduce((acc, theme) => {
    const category = theme.category || 'other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(theme);
    return acc;
  }, {} as Record<string, Theme[]>);
}

export async function getUserThemes(userId: string): Promise<Theme[]> {
  const result = await pool.query(`
    SELECT t.id, t.slug, t.name, t.icon, t.category
    FROM themes t
    JOIN user_themes ut ON t.id = ut.theme_id
    WHERE ut.user_id = $1
    ORDER BY t.category, t.name
  `, [userId]);

  return result.rows.map(row => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    icon: row.icon,
    category: row.category,
  }));
}

export async function updateUserThemes(userId: string, themeIds: string[]): Promise<Theme[]> {
  // Validate: max 10 themes
  if (themeIds.length > 10) {
    throw new Error('Maximum 10 thématiques autorisées');
  }

  // Validate: all theme IDs exist
  if (themeIds.length > 0) {
    const existingThemes = await pool.query(
      'SELECT id FROM themes WHERE id = ANY($1)',
      [themeIds]
    );

    if (existingThemes.rows.length !== themeIds.length) {
      throw new Error('Une ou plusieurs thématiques invalides');
    }
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Delete existing user themes
    await client.query('DELETE FROM user_themes WHERE user_id = $1', [userId]);

    // Insert new themes
    if (themeIds.length > 0) {
      const values = themeIds.map((themeId, index) =>
        `($1, $${index + 2})`
      ).join(', ');

      await client.query(
        `INSERT INTO user_themes (user_id, theme_id) VALUES ${values}`,
        [userId, ...themeIds]
      );
    }

    await client.query('COMMIT');

    // Return updated themes
    return getUserThemes(userId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function getThemeById(themeId: string): Promise<Theme | null> {
  const result = await pool.query(
    'SELECT id, slug, name, icon, category FROM themes WHERE id = $1',
    [themeId]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    icon: row.icon,
    category: row.category,
  };
}

export async function getThemeBySlug(slug: string): Promise<Theme | null> {
  const result = await pool.query(
    'SELECT id, slug, name, icon, category FROM themes WHERE slug = $1',
    [slug]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    icon: row.icon,
    category: row.category,
  };
}
