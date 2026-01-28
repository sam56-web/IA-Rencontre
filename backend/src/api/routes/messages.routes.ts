import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { messageRateLimit } from '../middleware/rateLimit.middleware.js';
import {
  getMessages,
  sendMessage,
  markMessagesAsRead,
} from '../../services/message.service.js';
import { sendMessageSchema, paginationSchema } from '../../utils/validators.js';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// GET /api/conversations/:conversationId/messages
router.get(
  '/:conversationId/messages',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { conversationId } = req.params;
      const { page, limit } = paginationSchema.parse(req.query);

      const result = await getMessages(conversationId, req.userId!, page, limit);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/conversations/:conversationId/messages
router.post(
  '/:conversationId/messages',
  messageRateLimit(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { conversationId } = req.params;
      const input = sendMessageSchema.parse(req.body);

      const message = await sendMessage(conversationId, req.userId!, input);

      res.status(201).json({
        success: true,
        data: message,
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/conversations/:conversationId/read
router.post(
  '/:conversationId/read',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { conversationId } = req.params;
      const messageIds = req.body.messageIds as string[] | undefined;

      const count = await markMessagesAsRead(conversationId, req.userId!, messageIds);

      res.json({
        success: true,
        data: { markedAsRead: count },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Note: /unread-count route moved to conversations.routes.ts to avoid /:id conflict

export default router;
