import pool from '../db/pool.js';
import type {
  Group,
  GroupMember,
  GroupInvitation,
  GroupMessage,
  GroupView,
  GroupDetail,
  CreateGroupInput,
  UpdateGroupInput,
} from '../types/index.js';

// ============ GROUP CRUD ============

export async function createGroup(
  creatorId: string,
  input: CreateGroupInput
): Promise<Group> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Create the group
    const result = await client.query(`
      INSERT INTO groups (name, description, theme_id, creator_id, is_public, max_members)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      input.name,
      input.description || null,
      input.themeId || null,
      creatorId,
      input.isPublic ?? false,
      input.maxMembers ?? 50,
    ]);

    const group = mapGroupRow(result.rows[0]);

    // Add creator as admin member
    await client.query(`
      INSERT INTO group_members (group_id, user_id, role)
      VALUES ($1, $2, 'admin')
    `, [group.id, creatorId]);

    await client.query('COMMIT');

    return group;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function getGroup(groupId: string): Promise<Group | null> {
  const result = await pool.query('SELECT * FROM groups WHERE id = $1', [groupId]);

  if (result.rows.length === 0) return null;
  return mapGroupRow(result.rows[0]);
}

export async function getGroupDetail(groupId: string, userId: string): Promise<GroupDetail | null> {
  const result = await pool.query(`
    SELECT
      g.*,
      t.name as theme_name,
      t.slug as theme_slug,
      t.icon as theme_icon,
      (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count,
      gm.role as user_role
    FROM groups g
    LEFT JOIN themes t ON g.theme_id = t.id
    LEFT JOIN group_members gm ON g.id = gm.group_id AND gm.user_id = $2
    WHERE g.id = $1
  `, [groupId, userId]);

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    photoUrl: row.photo_url,
    theme: row.theme_id ? {
      id: row.theme_id,
      name: row.theme_name,
      slug: row.theme_slug,
      icon: row.theme_icon,
    } : undefined,
    creatorId: row.creator_id,
    isPublic: row.is_public,
    maxMembers: row.max_members,
    memberCount: parseInt(row.member_count, 10),
    userRole: row.user_role || null,
    isMember: !!row.user_role,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function updateGroup(
  groupId: string,
  userId: string,
  input: UpdateGroupInput
): Promise<Group> {
  // Check if user is admin
  const memberCheck = await pool.query(
    'SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2',
    [groupId, userId]
  );

  if (memberCheck.rows.length === 0 || memberCheck.rows[0].role !== 'admin') {
    throw new Error('Seuls les administrateurs peuvent modifier le groupe');
  }

  const updates: string[] = [];
  const values: (string | boolean | number | null)[] = [];
  let paramIndex = 1;

  if (input.name !== undefined) {
    updates.push(`name = $${paramIndex++}`);
    values.push(input.name);
  }
  if (input.description !== undefined) {
    updates.push(`description = $${paramIndex++}`);
    values.push(input.description);
  }
  if (input.themeId !== undefined) {
    updates.push(`theme_id = $${paramIndex++}`);
    values.push(input.themeId);
  }
  if (input.isPublic !== undefined) {
    updates.push(`is_public = $${paramIndex++}`);
    values.push(input.isPublic);
  }
  if (input.maxMembers !== undefined) {
    updates.push(`max_members = $${paramIndex++}`);
    values.push(input.maxMembers);
  }

  if (updates.length === 0) {
    const group = await getGroup(groupId);
    if (!group) throw new Error('Groupe non trouvé');
    return group;
  }

  values.push(groupId);

  const result = await pool.query(`
    UPDATE groups
    SET ${updates.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING *
  `, values);

  return mapGroupRow(result.rows[0]);
}

export async function updateGroupPhoto(groupId: string, userId: string, photoUrl: string): Promise<Group> {
  // Check if user is admin
  const memberCheck = await pool.query(
    'SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2',
    [groupId, userId]
  );

  if (memberCheck.rows.length === 0 || memberCheck.rows[0].role !== 'admin') {
    throw new Error('Seuls les administrateurs peuvent modifier la photo du groupe');
  }

  const result = await pool.query(
    'UPDATE groups SET photo_url = $1 WHERE id = $2 RETURNING *',
    [photoUrl, groupId]
  );

  return mapGroupRow(result.rows[0]);
}

export async function deleteGroup(groupId: string, userId: string): Promise<void> {
  // Check if user is admin (creator)
  const groupCheck = await pool.query(
    'SELECT creator_id FROM groups WHERE id = $1',
    [groupId]
  );

  if (groupCheck.rows.length === 0) {
    throw new Error('Groupe non trouvé');
  }

  if (groupCheck.rows[0].creator_id !== userId) {
    throw new Error('Seul le créateur peut supprimer le groupe');
  }

  await pool.query('DELETE FROM groups WHERE id = $1', [groupId]);
}

// ============ USER GROUPS ============

export async function getUserGroups(userId: string): Promise<GroupView[]> {
  const result = await pool.query(`
    SELECT
      g.*,
      t.name as theme_name,
      t.slug as theme_slug,
      t.icon as theme_icon,
      (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count,
      gm.role as user_role,
      (SELECT content FROM group_messages WHERE group_id = g.id ORDER BY created_at DESC LIMIT 1) as last_message_content,
      (SELECT created_at FROM group_messages WHERE group_id = g.id ORDER BY created_at DESC LIMIT 1) as last_message_at
    FROM groups g
    JOIN group_members gm ON g.id = gm.group_id
    LEFT JOIN themes t ON g.theme_id = t.id
    WHERE gm.user_id = $1
    ORDER BY COALESCE(
      (SELECT created_at FROM group_messages WHERE group_id = g.id ORDER BY created_at DESC LIMIT 1),
      g.created_at
    ) DESC
  `, [userId]);

  return result.rows.map(mapGroupViewRow);
}

export async function getPublicGroups(userId: string, limit = 20, offset = 0): Promise<{ groups: GroupView[]; total: number }> {
  const countResult = await pool.query(`
    SELECT COUNT(*) FROM groups
    WHERE is_public = true
    AND id NOT IN (SELECT group_id FROM group_members WHERE user_id = $1)
  `, [userId]);

  const result = await pool.query(`
    SELECT
      g.*,
      t.name as theme_name,
      t.slug as theme_slug,
      t.icon as theme_icon,
      (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count,
      NULL as user_role,
      (SELECT content FROM group_messages WHERE group_id = g.id ORDER BY created_at DESC LIMIT 1) as last_message_content,
      (SELECT created_at FROM group_messages WHERE group_id = g.id ORDER BY created_at DESC LIMIT 1) as last_message_at
    FROM groups g
    LEFT JOIN themes t ON g.theme_id = t.id
    WHERE g.is_public = true
    AND g.id NOT IN (SELECT group_id FROM group_members WHERE user_id = $1)
    ORDER BY member_count DESC, g.created_at DESC
    LIMIT $2 OFFSET $3
  `, [userId, limit, offset]);

  return {
    groups: result.rows.map(mapGroupViewRow),
    total: parseInt(countResult.rows[0].count, 10),
  };
}

// ============ MEMBERS ============

export async function getGroupMembers(groupId: string): Promise<GroupMember[]> {
  const result = await pool.query(`
    SELECT
      gm.*,
      u.username,
      (SELECT url FROM photos WHERE user_id = u.id ORDER BY order_index LIMIT 1) as photo_url
    FROM group_members gm
    JOIN users u ON gm.user_id = u.id
    WHERE gm.group_id = $1
    ORDER BY
      CASE gm.role
        WHEN 'admin' THEN 1
        WHEN 'moderator' THEN 2
        ELSE 3
      END,
      gm.joined_at
  `, [groupId]);

  return result.rows.map(row => ({
    groupId: row.group_id,
    userId: row.user_id,
    username: row.username,
    photoUrl: row.photo_url,
    role: row.role,
    joinedAt: row.joined_at,
  }));
}

export async function joinGroup(groupId: string, userId: string): Promise<void> {
  // Check if group exists and is public
  const groupCheck = await pool.query(
    'SELECT is_public, max_members FROM groups WHERE id = $1',
    [groupId]
  );

  if (groupCheck.rows.length === 0) {
    throw new Error('Groupe non trouvé');
  }

  if (!groupCheck.rows[0].is_public) {
    throw new Error('Ce groupe est privé, vous devez être invité');
  }

  // Check member count
  const memberCount = await pool.query(
    'SELECT COUNT(*) FROM group_members WHERE group_id = $1',
    [groupId]
  );

  if (parseInt(memberCount.rows[0].count, 10) >= groupCheck.rows[0].max_members) {
    throw new Error('Ce groupe a atteint sa limite de membres');
  }

  // Check if already member
  const existingMember = await pool.query(
    'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2',
    [groupId, userId]
  );

  if (existingMember.rows.length > 0) {
    throw new Error('Vous êtes déjà membre de ce groupe');
  }

  await pool.query(
    'INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, $3)',
    [groupId, userId, 'member']
  );
}

export async function leaveGroup(groupId: string, userId: string): Promise<void> {
  // Check if user is the creator (admin)
  const groupCheck = await pool.query(
    'SELECT creator_id FROM groups WHERE id = $1',
    [groupId]
  );

  if (groupCheck.rows.length === 0) {
    throw new Error('Groupe non trouvé');
  }

  if (groupCheck.rows[0].creator_id === userId) {
    throw new Error('Le créateur ne peut pas quitter le groupe. Supprimez le groupe à la place.');
  }

  await pool.query(
    'DELETE FROM group_members WHERE group_id = $1 AND user_id = $2',
    [groupId, userId]
  );
}

export async function kickMember(groupId: string, adminId: string, targetUserId: string): Promise<void> {
  // Check if admin has permission
  const adminCheck = await pool.query(
    'SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2',
    [groupId, adminId]
  );

  if (adminCheck.rows.length === 0 || !['admin', 'moderator'].includes(adminCheck.rows[0].role)) {
    throw new Error('Permission refusée');
  }

  // Check target user role
  const targetCheck = await pool.query(
    'SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2',
    [groupId, targetUserId]
  );

  if (targetCheck.rows.length === 0) {
    throw new Error('Utilisateur non membre du groupe');
  }

  // Moderators cannot kick admins
  if (adminCheck.rows[0].role === 'moderator' && targetCheck.rows[0].role === 'admin') {
    throw new Error('Un modérateur ne peut pas expulser un administrateur');
  }

  // Admin cannot be kicked
  if (targetCheck.rows[0].role === 'admin') {
    throw new Error('Un administrateur ne peut pas être expulsé');
  }

  await pool.query(
    'DELETE FROM group_members WHERE group_id = $1 AND user_id = $2',
    [groupId, targetUserId]
  );
}

export async function updateMemberRole(
  groupId: string,
  adminId: string,
  targetUserId: string,
  newRole: 'moderator' | 'member'
): Promise<void> {
  // Check if admin has permission
  const adminCheck = await pool.query(
    'SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2',
    [groupId, adminId]
  );

  if (adminCheck.rows.length === 0 || adminCheck.rows[0].role !== 'admin') {
    throw new Error('Seuls les administrateurs peuvent changer les rôles');
  }

  await pool.query(
    'UPDATE group_members SET role = $1 WHERE group_id = $2 AND user_id = $3',
    [newRole, groupId, targetUserId]
  );
}

// ============ INVITATIONS ============

export async function inviteUsers(
  groupId: string,
  inviterId: string,
  inviteeIds: string[]
): Promise<GroupInvitation[]> {
  // Check if inviter is member
  const memberCheck = await pool.query(
    'SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2',
    [groupId, inviterId]
  );

  if (memberCheck.rows.length === 0) {
    throw new Error('Vous devez être membre du groupe pour inviter');
  }

  const invitations: GroupInvitation[] = [];

  for (const inviteeId of inviteeIds) {
    // Skip if already member
    const existingMember = await pool.query(
      'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2',
      [groupId, inviteeId]
    );

    if (existingMember.rows.length > 0) continue;

    // Skip if already invited
    const existingInvite = await pool.query(
      'SELECT 1 FROM group_invitations WHERE group_id = $1 AND invitee_id = $2 AND status = $3',
      [groupId, inviteeId, 'pending']
    );

    if (existingInvite.rows.length > 0) continue;

    // Create invitation
    const result = await pool.query(`
      INSERT INTO group_invitations (group_id, inviter_id, invitee_id)
      VALUES ($1, $2, $3)
      ON CONFLICT (group_id, invitee_id) DO UPDATE SET
        inviter_id = $2,
        status = 'pending',
        created_at = NOW()
      RETURNING *
    `, [groupId, inviterId, inviteeId]);

    invitations.push(mapInvitationRow(result.rows[0]));
  }

  return invitations;
}

export async function getUserInvitations(userId: string): Promise<(GroupInvitation & { group: GroupView; inviterUsername: string })[]> {
  const result = await pool.query(`
    SELECT
      gi.*,
      g.name as group_name,
      g.description as group_description,
      g.photo_url as group_photo_url,
      g.is_public as group_is_public,
      t.name as theme_name,
      t.slug as theme_slug,
      t.icon as theme_icon,
      (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count,
      u.username as inviter_username
    FROM group_invitations gi
    JOIN groups g ON gi.group_id = g.id
    LEFT JOIN themes t ON g.theme_id = t.id
    JOIN users u ON gi.inviter_id = u.id
    WHERE gi.invitee_id = $1 AND gi.status = 'pending'
    ORDER BY gi.created_at DESC
  `, [userId]);

  return result.rows.map(row => ({
    id: row.id,
    groupId: row.group_id,
    inviterId: row.inviter_id,
    inviteeId: row.invitee_id,
    status: row.status,
    createdAt: row.created_at,
    inviterUsername: row.inviter_username,
    group: {
      id: row.group_id,
      name: row.group_name,
      description: row.group_description,
      photoUrl: row.group_photo_url,
      theme: row.theme_name ? {
        id: row.theme_id,
        name: row.theme_name,
        slug: row.theme_slug,
        icon: row.theme_icon,
      } : undefined,
      isPublic: row.group_is_public,
      memberCount: parseInt(row.member_count, 10),
      userRole: null,
      isMember: false,
    },
  }));
}

export async function acceptInvitation(invitationId: string, userId: string): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Get invitation
    const inviteCheck = await client.query(
      'SELECT * FROM group_invitations WHERE id = $1 AND invitee_id = $2 AND status = $3',
      [invitationId, userId, 'pending']
    );

    if (inviteCheck.rows.length === 0) {
      throw new Error('Invitation non trouvée ou déjà traitée');
    }

    const invitation = inviteCheck.rows[0];

    // Check member count
    const groupCheck = await client.query(
      'SELECT max_members FROM groups WHERE id = $1',
      [invitation.group_id]
    );

    const memberCount = await client.query(
      'SELECT COUNT(*) FROM group_members WHERE group_id = $1',
      [invitation.group_id]
    );

    if (parseInt(memberCount.rows[0].count, 10) >= groupCheck.rows[0].max_members) {
      throw new Error('Ce groupe a atteint sa limite de membres');
    }

    // Update invitation status
    await client.query(
      'UPDATE group_invitations SET status = $1 WHERE id = $2',
      ['accepted', invitationId]
    );

    // Add as member
    await client.query(
      'INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, $3)',
      [invitation.group_id, userId, 'member']
    );

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function declineInvitation(invitationId: string, userId: string): Promise<void> {
  const result = await pool.query(
    'UPDATE group_invitations SET status = $1 WHERE id = $2 AND invitee_id = $3 AND status = $4',
    ['declined', invitationId, userId, 'pending']
  );

  if (result.rowCount === 0) {
    throw new Error('Invitation non trouvée ou déjà traitée');
  }
}

export async function getPendingInvitationsCount(userId: string): Promise<number> {
  const result = await pool.query(
    'SELECT COUNT(*) FROM group_invitations WHERE invitee_id = $1 AND status = $2',
    [userId, 'pending']
  );

  return parseInt(result.rows[0].count, 10);
}

// ============ MESSAGES ============

export async function getGroupMessages(
  groupId: string,
  userId: string,
  limit = 50,
  before?: string
): Promise<{ messages: GroupMessage[]; hasMore: boolean }> {
  // Check if user is member
  const memberCheck = await pool.query(
    'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2',
    [groupId, userId]
  );

  if (memberCheck.rows.length === 0) {
    throw new Error('Vous devez être membre du groupe pour voir les messages');
  }

  let query = `
    SELECT
      gm.*,
      u.username as sender_username,
      (SELECT url FROM photos WHERE user_id = u.id ORDER BY order_index LIMIT 1) as sender_photo_url
    FROM group_messages gm
    JOIN users u ON gm.sender_id = u.id
    WHERE gm.group_id = $1
  `;
  const params: (string | number)[] = [groupId];

  if (before) {
    query += ` AND gm.created_at < $2`;
    params.push(before);
  }

  query += ` ORDER BY gm.created_at DESC LIMIT $${params.length + 1}`;
  params.push(limit + 1);

  const result = await pool.query(query, params);

  const hasMore = result.rows.length > limit;
  const messages = result.rows.slice(0, limit).map(row => ({
    id: row.id,
    groupId: row.group_id,
    senderId: row.sender_id,
    senderUsername: row.sender_username,
    senderPhotoUrl: row.sender_photo_url,
    content: row.content,
    createdAt: row.created_at,
  }));

  // Reverse to get chronological order
  messages.reverse();

  return { messages, hasMore };
}

export async function sendGroupMessage(
  groupId: string,
  senderId: string,
  content: string
): Promise<GroupMessage> {
  // Check if user is member
  const memberCheck = await pool.query(
    'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2',
    [groupId, senderId]
  );

  if (memberCheck.rows.length === 0) {
    throw new Error('Vous devez être membre du groupe pour envoyer des messages');
  }

  const result = await pool.query(`
    INSERT INTO group_messages (group_id, sender_id, content)
    VALUES ($1, $2, $3)
    RETURNING *
  `, [groupId, senderId, content]);

  // Get sender info
  const senderResult = await pool.query(`
    SELECT username, (SELECT url FROM photos WHERE user_id = u.id ORDER BY order_index LIMIT 1) as photo_url
    FROM users u WHERE id = $1
  `, [senderId]);

  return {
    id: result.rows[0].id,
    groupId: result.rows[0].group_id,
    senderId: result.rows[0].sender_id,
    senderUsername: senderResult.rows[0].username,
    senderPhotoUrl: senderResult.rows[0].photo_url,
    content: result.rows[0].content,
    createdAt: result.rows[0].created_at,
  };
}

// ============ HELPERS ============

function mapGroupRow(row: Record<string, unknown>): Group {
  return {
    id: row.id as string,
    name: row.name as string,
    description: row.description as string | undefined,
    photoUrl: row.photo_url as string | undefined,
    themeId: row.theme_id as string | undefined,
    creatorId: row.creator_id as string,
    isPublic: row.is_public as boolean,
    maxMembers: row.max_members as number,
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
  };
}

function mapGroupViewRow(row: Record<string, unknown>): GroupView {
  return {
    id: row.id as string,
    name: row.name as string,
    description: row.description as string | undefined,
    photoUrl: row.photo_url as string | undefined,
    theme: row.theme_name ? {
      id: row.theme_id as string,
      name: row.theme_name as string,
      slug: row.theme_slug as string,
      icon: row.theme_icon as string,
    } : undefined,
    isPublic: row.is_public as boolean,
    memberCount: parseInt(row.member_count as string, 10),
    userRole: row.user_role as 'admin' | 'moderator' | 'member' | null,
    isMember: !!row.user_role,
    lastMessage: row.last_message_content ? {
      content: row.last_message_content as string,
      createdAt: row.last_message_at as Date,
    } : undefined,
  };
}

function mapInvitationRow(row: Record<string, unknown>): GroupInvitation {
  return {
    id: row.id as string,
    groupId: row.group_id as string,
    inviterId: row.inviter_id as string,
    inviteeId: row.invitee_id as string,
    status: row.status as 'pending' | 'accepted' | 'declined',
    createdAt: row.created_at as Date,
  };
}

export async function isGroupMember(groupId: string, userId: string): Promise<boolean> {
  const result = await pool.query(
    'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2',
    [groupId, userId]
  );
  return result.rows.length > 0;
}

export async function getGroupMemberIds(groupId: string): Promise<string[]> {
  const result = await pool.query(
    'SELECT user_id FROM group_members WHERE group_id = $1',
    [groupId]
  );
  return result.rows.map(row => row.user_id);
}
