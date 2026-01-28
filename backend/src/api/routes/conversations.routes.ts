import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import {
  getConversations,
  getConversationById,
  startConversation,
  archiveConversation,
} from '../../services/conversation.service.js';
import { startConversationSchema } from '../../utils/validators.js';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// GET /api/conversations
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const conversations = await getConversations(req.userId!);

    res.json({
      success: true,
      data: conversations,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/conversations
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = startConversationSchema.parse(req.body);
    const result = await startConversation(req.userId!, input);

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/conversations/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const conversation = await getConversationById(id, req.userId!);

    if (!conversation) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Conversation not found' },
      });
      return;
    }

    res.json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/conversations/:id/archive
router.post('/:id/archive', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await archiveConversation(id, req.userId!);

    res.json({
      success: true,
      data: { message: 'Conversation archived successfully' },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
