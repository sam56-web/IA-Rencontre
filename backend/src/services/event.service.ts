import pool from '../db/pool.js';

export interface Event {
  id: string;
  creatorId: string | null;
  groupId: string | null;
  themeId: string | null;
  title: string;
  description: string | null;
  photoUrl: string | null;
  locationName: string | null;
  locationLat: number | null;
  locationLng: number | null;
  startsAt: Date;
  endsAt: Date | null;
  maxParticipants: number | null;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface EventWithDetails extends Event {
  creatorUsername: string | null;
  groupName: string | null;
  themeName: string | null;
  participantCount: number;
  userStatus: 'going' | 'maybe' | 'not_going' | null;
}

export interface CreateEventData {
  creatorId: string;
  groupId?: string;
  themeId?: string;
  title: string;
  description?: string;
  photoUrl?: string;
  locationName?: string;
  locationLat?: number;
  locationLng?: number;
  startsAt: Date;
  endsAt?: Date;
  maxParticipants?: number;
  isPublic?: boolean;
}

export interface UpdateEventData {
  title?: string;
  description?: string;
  photoUrl?: string;
  locationName?: string;
  locationLat?: number;
  locationLng?: number;
  startsAt?: Date;
  endsAt?: Date;
  maxParticipants?: number;
  isPublic?: boolean;
}

export async function createEvent(data: CreateEventData): Promise<Event> {
  const result = await pool.query(
    `INSERT INTO events (
       creator_id, group_id, theme_id, title, description, photo_url,
       location_name, location_lat, location_lng, starts_at, ends_at,
       max_participants, is_public
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING *`,
    [
      data.creatorId,
      data.groupId || null,
      data.themeId || null,
      data.title,
      data.description || null,
      data.photoUrl || null,
      data.locationName || null,
      data.locationLat || null,
      data.locationLng || null,
      data.startsAt,
      data.endsAt || null,
      data.maxParticipants || null,
      data.isPublic ?? true,
    ]
  );

  return mapRowToEvent(result.rows[0]);
}

export async function updateEvent(
  eventId: string,
  userId: string,
  data: UpdateEventData
): Promise<Event | null> {
  // First check if user is the creator
  const checkResult = await pool.query(
    'SELECT creator_id FROM events WHERE id = $1',
    [eventId]
  );

  if (checkResult.rows.length === 0) {
    return null;
  }

  if (checkResult.rows[0].creator_id !== userId) {
    throw new Error('Not authorized to update this event');
  }

  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (data.title !== undefined) {
    updates.push(`title = $${paramIndex++}`);
    values.push(data.title);
  }
  if (data.description !== undefined) {
    updates.push(`description = $${paramIndex++}`);
    values.push(data.description);
  }
  if (data.photoUrl !== undefined) {
    updates.push(`photo_url = $${paramIndex++}`);
    values.push(data.photoUrl);
  }
  if (data.locationName !== undefined) {
    updates.push(`location_name = $${paramIndex++}`);
    values.push(data.locationName);
  }
  if (data.locationLat !== undefined) {
    updates.push(`location_lat = $${paramIndex++}`);
    values.push(data.locationLat);
  }
  if (data.locationLng !== undefined) {
    updates.push(`location_lng = $${paramIndex++}`);
    values.push(data.locationLng);
  }
  if (data.startsAt !== undefined) {
    updates.push(`starts_at = $${paramIndex++}`);
    values.push(data.startsAt);
  }
  if (data.endsAt !== undefined) {
    updates.push(`ends_at = $${paramIndex++}`);
    values.push(data.endsAt);
  }
  if (data.maxParticipants !== undefined) {
    updates.push(`max_participants = $${paramIndex++}`);
    values.push(data.maxParticipants);
  }
  if (data.isPublic !== undefined) {
    updates.push(`is_public = $${paramIndex++}`);
    values.push(data.isPublic);
  }

  if (updates.length === 0) {
    const current = await getEventById(eventId, userId);
    return current;
  }

  values.push(eventId);
  const result = await pool.query(
    `UPDATE events SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );

  return mapRowToEvent(result.rows[0]);
}

export async function deleteEvent(eventId: string, userId: string): Promise<boolean> {
  const result = await pool.query(
    'DELETE FROM events WHERE id = $1 AND creator_id = $2 RETURNING id',
    [eventId, userId]
  );
  return result.rowCount > 0;
}

export async function getEventById(
  eventId: string,
  userId?: string
): Promise<EventWithDetails | null> {
  const result = await pool.query(
    `SELECT
       e.*,
       u.username as creator_username,
       g.name as group_name,
       t.name as theme_name,
       (SELECT COUNT(*) FROM event_participants WHERE event_id = e.id AND status = 'going') as participant_count,
       ${userId ? `(SELECT status FROM event_participants WHERE event_id = e.id AND user_id = $2)` : 'NULL'} as user_status
     FROM events e
     LEFT JOIN users u ON e.creator_id = u.id
     LEFT JOIN groups g ON e.group_id = g.id
     LEFT JOIN themes t ON e.theme_id = t.id
     WHERE e.id = $1`,
    userId ? [eventId, userId] : [eventId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return mapRowToEventWithDetails(result.rows[0]);
}

export async function getUpcomingEvents(
  options: {
    userId?: string;
    groupId?: string;
    themeId?: string;
    limit?: number;
    offset?: number;
    publicOnly?: boolean;
  } = {}
): Promise<{ events: EventWithDetails[]; total: number }> {
  const { userId, groupId, themeId, limit = 20, offset = 0, publicOnly = true } = options;

  const conditions: string[] = ['e.starts_at > NOW()'];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (publicOnly) {
    conditions.push('e.is_public = TRUE');
  }

  if (groupId) {
    conditions.push(`e.group_id = $${paramIndex++}`);
    params.push(groupId);
  }

  if (themeId) {
    conditions.push(`e.theme_id = $${paramIndex++}`);
    params.push(themeId);
  }

  const whereClause = conditions.join(' AND ');

  const [eventsResult, countResult] = await Promise.all([
    pool.query(
      `SELECT
         e.*,
         u.username as creator_username,
         g.name as group_name,
         t.name as theme_name,
         (SELECT COUNT(*) FROM event_participants WHERE event_id = e.id AND status = 'going') as participant_count,
         ${userId ? `(SELECT status FROM event_participants WHERE event_id = e.id AND user_id = $${paramIndex++})` : 'NULL'} as user_status
       FROM events e
       LEFT JOIN users u ON e.creator_id = u.id
       LEFT JOIN groups g ON e.group_id = g.id
       LEFT JOIN themes t ON e.theme_id = t.id
       WHERE ${whereClause}
       ORDER BY e.starts_at ASC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, ...(userId ? [userId] : []), limit, offset]
    ),
    pool.query(
      `SELECT COUNT(*) FROM events e WHERE ${whereClause}`,
      params
    ),
  ]);

  return {
    events: eventsResult.rows.map(mapRowToEventWithDetails),
    total: parseInt(countResult.rows[0].count, 10),
  };
}

export async function getUserEvents(
  userId: string,
  options: { limit?: number; offset?: number; past?: boolean } = {}
): Promise<{ events: EventWithDetails[]; total: number }> {
  const { limit = 20, offset = 0, past = false } = options;

  const timeCondition = past ? 'e.starts_at <= NOW()' : 'e.starts_at > NOW()';

  const [eventsResult, countResult] = await Promise.all([
    pool.query(
      `SELECT
         e.*,
         u.username as creator_username,
         g.name as group_name,
         t.name as theme_name,
         (SELECT COUNT(*) FROM event_participants WHERE event_id = e.id AND status = 'going') as participant_count,
         ep.status as user_status
       FROM event_participants ep
       JOIN events e ON ep.event_id = e.id
       LEFT JOIN users u ON e.creator_id = u.id
       LEFT JOIN groups g ON e.group_id = g.id
       LEFT JOIN themes t ON e.theme_id = t.id
       WHERE ep.user_id = $1 AND ep.status IN ('going', 'maybe') AND ${timeCondition}
       ORDER BY e.starts_at ${past ? 'DESC' : 'ASC'}
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    ),
    pool.query(
      `SELECT COUNT(*)
       FROM event_participants ep
       JOIN events e ON ep.event_id = e.id
       WHERE ep.user_id = $1 AND ep.status IN ('going', 'maybe') AND ${timeCondition}`,
      [userId]
    ),
  ]);

  return {
    events: eventsResult.rows.map(mapRowToEventWithDetails),
    total: parseInt(countResult.rows[0].count, 10),
  };
}

export async function joinEvent(
  eventId: string,
  userId: string,
  status: 'going' | 'maybe' = 'going'
): Promise<boolean> {
  // Check if event exists and has capacity
  const eventResult = await pool.query(
    `SELECT max_participants,
            (SELECT COUNT(*) FROM event_participants WHERE event_id = $1 AND status = 'going') as current_count
     FROM events WHERE id = $1`,
    [eventId]
  );

  if (eventResult.rows.length === 0) {
    throw new Error('Event not found');
  }

  const { max_participants, current_count } = eventResult.rows[0];

  if (status === 'going' && max_participants && current_count >= max_participants) {
    throw new Error('Event is full');
  }

  await pool.query(
    `INSERT INTO event_participants (event_id, user_id, status)
     VALUES ($1, $2, $3)
     ON CONFLICT (event_id, user_id)
     DO UPDATE SET status = $3, registered_at = NOW()`,
    [eventId, userId, status]
  );

  return true;
}

export async function leaveEvent(eventId: string, userId: string): Promise<boolean> {
  const result = await pool.query(
    'DELETE FROM event_participants WHERE event_id = $1 AND user_id = $2 RETURNING event_id',
    [eventId, userId]
  );
  return result.rowCount > 0;
}

export async function getEventParticipants(
  eventId: string,
  options: { status?: 'going' | 'maybe' | 'not_going'; limit?: number; offset?: number } = {}
): Promise<{ participants: Array<{ userId: string; username: string; avatarUrl: string | null; status: string; registeredAt: Date }>; total: number }> {
  const { status, limit = 50, offset = 0 } = options;

  const conditions = ['ep.event_id = $1'];
  const params: unknown[] = [eventId];
  let paramIndex = 2;

  if (status) {
    conditions.push(`ep.status = $${paramIndex++}`);
    params.push(status);
  }

  const whereClause = conditions.join(' AND ');

  const [participantsResult, countResult] = await Promise.all([
    pool.query(
      `SELECT
         u.id as user_id,
         u.username,
         p.avatar_url,
         ep.status,
         ep.registered_at
       FROM event_participants ep
       JOIN users u ON ep.user_id = u.id
       LEFT JOIN profiles p ON u.id = p.user_id
       WHERE ${whereClause}
       ORDER BY ep.registered_at ASC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, limit, offset]
    ),
    pool.query(
      `SELECT COUNT(*) FROM event_participants ep WHERE ${whereClause}`,
      params
    ),
  ]);

  return {
    participants: participantsResult.rows.map((row) => ({
      userId: row.user_id,
      username: row.username,
      avatarUrl: row.avatar_url,
      status: row.status,
      registeredAt: row.registered_at,
    })),
    total: parseInt(countResult.rows[0].count, 10),
  };
}

function mapRowToEvent(row: Record<string, unknown>): Event {
  return {
    id: row.id as string,
    creatorId: row.creator_id as string | null,
    groupId: row.group_id as string | null,
    themeId: row.theme_id as string | null,
    title: row.title as string,
    description: row.description as string | null,
    photoUrl: row.photo_url as string | null,
    locationName: row.location_name as string | null,
    locationLat: row.location_lat ? parseFloat(row.location_lat as string) : null,
    locationLng: row.location_lng ? parseFloat(row.location_lng as string) : null,
    startsAt: row.starts_at as Date,
    endsAt: row.ends_at as Date | null,
    maxParticipants: row.max_participants as number | null,
    isPublic: row.is_public as boolean,
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
  };
}

function mapRowToEventWithDetails(row: Record<string, unknown>): EventWithDetails {
  return {
    ...mapRowToEvent(row),
    creatorUsername: row.creator_username as string | null,
    groupName: row.group_name as string | null,
    themeName: row.theme_name as string | null,
    participantCount: parseInt(row.participant_count as string, 10) || 0,
    userStatus: row.user_status as 'going' | 'maybe' | 'not_going' | null,
  };
}
