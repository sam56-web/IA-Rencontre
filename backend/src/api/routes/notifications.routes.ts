import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import * as notificationService from '../../services/notification.service';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// GET /api/notifications - Get user's notifications
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;
    const unreadOnly = req.query.unread_only === 'true';

    const result = await notificationService.getUserNotifications(userId, {
      limit,
      offset,
      unreadOnly,
    });

    res.json(result);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// GET /api/notifications/unread-count - Get unread count only
router.get('/unread-count', async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const count = await notificationService.getUnreadNotificationCount(userId);
    res.json({ unreadCount: count });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

// PUT /api/notifications/:id/read - Mark a notification as read
router.put('/:id/read', async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const notificationId = req.params.id;

    const success = await notificationService.markAsRead(notificationId, userId);

    if (!success) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// PUT /api/notifications/read-all - Mark all notifications as read
router.put('/read-all', async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const count = await notificationService.markAllAsRead(userId);
    res.json({ success: true, markedCount: count });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ error: 'Failed to mark notifications as read' });
  }
});

// DELETE /api/notifications/:id - Delete a notification
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const notificationId = req.params.id;

    const success = await notificationService.deleteNotification(notificationId, userId);

    if (!success) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

export default router;
