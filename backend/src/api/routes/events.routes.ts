import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import * as eventService from '../../services/event.service';
import * as notificationService from '../../services/notification.service';
import pool from '../../db/pool.js';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// GET /api/events - Get upcoming events
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;
    const groupId = req.query.group_id as string | undefined;
    const themeId = req.query.theme_id as string | undefined;

    const result = await eventService.getUpcomingEvents({
      userId,
      groupId,
      themeId,
      limit,
      offset,
    });

    res.json(result);
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// GET /api/events/my - Get user's events
router.get('/my', async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;
    const past = req.query.past === 'true';

    const result = await eventService.getUserEvents(userId, { limit, offset, past });

    res.json(result);
  } catch (error) {
    console.error('Error fetching user events:', error);
    res.status(500).json({ error: 'Failed to fetch user events' });
  }
});

// GET /api/events/:id - Get event details
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const eventId = req.params.id;

    const event = await eventService.getEventById(eventId, userId);

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json(event);
  } catch (error) {
    console.error('Error fetching event:', error);
    res.status(500).json({ error: 'Failed to fetch event' });
  }
});

// POST /api/events - Create event
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const {
      groupId,
      themeId,
      title,
      description,
      photoUrl,
      locationName,
      locationLat,
      locationLng,
      startsAt,
      endsAt,
      maxParticipants,
      isPublic,
    } = req.body;

    if (!title || !startsAt) {
      return res.status(400).json({ error: 'Title and start date are required' });
    }

    const event = await eventService.createEvent({
      creatorId: userId,
      groupId,
      themeId,
      title,
      description,
      photoUrl,
      locationName,
      locationLat,
      locationLng,
      startsAt: new Date(startsAt),
      endsAt: endsAt ? new Date(endsAt) : undefined,
      maxParticipants,
      isPublic,
    });

    // Auto-join creator as 'going'
    await eventService.joinEvent(event.id, userId, 'going');

    // Notify group members if event is in a group
    if (groupId) {
      notifyGroupMembers(groupId, event.id, title, userId);
    }

    res.status(201).json(event);
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// PUT /api/events/:id - Update event
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const eventId = req.params.id;

    const event = await eventService.updateEvent(eventId, userId, req.body);

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json(event);
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Not authorized to update this event') {
      return res.status(403).json({ error: error.message });
    }
    console.error('Error updating event:', error);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

// DELETE /api/events/:id - Delete event
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const eventId = req.params.id;

    const success = await eventService.deleteEvent(eventId, userId);

    if (!success) {
      return res.status(404).json({ error: 'Event not found or not authorized' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting event:', error);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

// POST /api/events/:id/join - Join event
router.post('/:id/join', async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const eventId = req.params.id;
    const status = req.body.status || 'going';

    if (!['going', 'maybe'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    await eventService.joinEvent(eventId, userId, status as 'going' | 'maybe');

    res.json({ success: true });
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message === 'Event not found') {
        return res.status(404).json({ error: error.message });
      }
      if (error.message === 'Event is full') {
        return res.status(409).json({ error: error.message });
      }
    }
    console.error('Error joining event:', error);
    res.status(500).json({ error: 'Failed to join event' });
  }
});

// DELETE /api/events/:id/join - Leave event
router.delete('/:id/join', async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const eventId = req.params.id;

    await eventService.leaveEvent(eventId, userId);

    res.json({ success: true });
  } catch (error) {
    console.error('Error leaving event:', error);
    res.status(500).json({ error: 'Failed to leave event' });
  }
});

// GET /api/events/:id/participants - Get event participants
router.get('/:id/participants', async (req: Request, res: Response) => {
  try {
    const eventId = req.params.id;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const status = req.query.status as 'going' | 'maybe' | 'not_going' | undefined;

    const result = await eventService.getEventParticipants(eventId, { status, limit, offset });

    res.json(result);
  } catch (error) {
    console.error('Error fetching participants:', error);
    res.status(500).json({ error: 'Failed to fetch participants' });
  }
});

// Helper function to notify group members about new event
async function notifyGroupMembers(
  groupId: string,
  eventId: string,
  eventTitle: string,
  creatorId: string
): Promise<void> {
  try {
    // Get group members except creator
    const membersResult = await pool.query(
      `SELECT gm.user_id, g.name as group_name
       FROM group_members gm
       JOIN groups g ON gm.group_id = g.id
       WHERE gm.group_id = $1 AND gm.user_id != $2`,
      [groupId, creatorId]
    );

    const groupName = membersResult.rows[0]?.group_name;

    // Send notifications to all members
    await Promise.all(
      membersResult.rows.map((row) =>
        notificationService.notifyNewEvent(row.user_id, eventTitle, eventId, groupName)
      )
    );
  } catch (error) {
    console.error('Failed to notify group members:', error);
  }
}

export default router;
