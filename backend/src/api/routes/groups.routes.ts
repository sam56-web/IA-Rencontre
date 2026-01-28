import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import { authenticate } from '../middleware/auth.middleware.js';
import * as groupService from '../../services/group.service.js';
import config from '../../config/index.js';

const router = Router();

// Configure multer for photo uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Type de fichier non supporté'));
    }
  },
});

// ============ GROUPS ============

// POST /api/groups - Create a group
router.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, description, themeId, isPublic, maxMembers } = req.body;

    if (!name || name.trim().length < 3) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_NAME', message: 'Le nom doit faire au moins 3 caractères' },
      });
    }

    const group = await groupService.createGroup(req.userId!, {
      name: name.trim(),
      description: description?.trim(),
      themeId,
      isPublic: isPublic ?? false,
      maxMembers: maxMembers ?? 50,
    });

    res.status(201).json({
      success: true,
      data: { group },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/groups - List user's groups and public groups
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type = 'mine', limit = '20', offset = '0' } = req.query;

    if (type === 'mine') {
      const groups = await groupService.getUserGroups(req.userId!);
      res.json({
        success: true,
        data: { groups },
      });
    } else if (type === 'discover') {
      const { groups, total } = await groupService.getPublicGroups(
        req.userId!,
        parseInt(limit as string, 10),
        parseInt(offset as string, 10)
      );
      res.json({
        success: true,
        data: { groups, total, hasMore: total > parseInt(offset as string, 10) + groups.length },
      });
    } else {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_TYPE', message: 'Type doit être "mine" ou "discover"' },
      });
    }
  } catch (error) {
    next(error);
  }
});

// GET /api/groups/:groupId - Get group details
router.get('/:groupId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { groupId } = req.params;
    const group = await groupService.getGroupDetail(groupId, req.userId!);

    if (!group) {
      return res.status(404).json({
        success: false,
        error: { code: 'GROUP_NOT_FOUND', message: 'Groupe non trouvé' },
      });
    }

    res.json({
      success: true,
      data: { group },
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/groups/:groupId - Update group
router.put('/:groupId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { groupId } = req.params;
    const { name, description, themeId, isPublic, maxMembers } = req.body;

    const group = await groupService.updateGroup(groupId, req.userId!, {
      name: name?.trim(),
      description: description?.trim(),
      themeId,
      isPublic,
      maxMembers,
    });

    res.json({
      success: true,
      data: { group },
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('administrateur')) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: error.message },
      });
    }
    next(error);
  }
});

// POST /api/groups/:groupId/photo - Upload group photo
router.post('/:groupId/photo', authenticate, upload.single('photo'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { groupId } = req.params;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_FILE', message: 'Aucun fichier fourni' },
      });
    }

    // Process image
    const filename = `group_${groupId}_${Date.now()}.webp`;
    const filepath = path.join(config.storage.path, 'groups', filename);

    // Ensure directory exists
    await fs.promises.mkdir(path.dirname(filepath), { recursive: true });

    // Process and save
    await sharp(req.file.buffer)
      .resize(400, 400, { fit: 'cover' })
      .webp({ quality: 85 })
      .toFile(filepath);

    const photoUrl = `/uploads/groups/${filename}`;

    const group = await groupService.updateGroupPhoto(groupId, req.userId!, photoUrl);

    res.json({
      success: true,
      data: { group },
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('administrateur')) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: error.message },
      });
    }
    next(error);
  }
});

// DELETE /api/groups/:groupId - Delete group
router.delete('/:groupId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { groupId } = req.params;
    await groupService.deleteGroup(groupId, req.userId!);

    res.json({
      success: true,
      data: { deleted: true },
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('créateur')) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: error.message },
      });
    }
    next(error);
  }
});

// ============ MEMBERS ============

// POST /api/groups/:groupId/join - Join a public group
router.post('/:groupId/join', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { groupId } = req.params;
    await groupService.joinGroup(groupId, req.userId!);

    res.json({
      success: true,
      data: { joined: true },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('privé')) {
        return res.status(403).json({
          success: false,
          error: { code: 'GROUP_PRIVATE', message: error.message },
        });
      }
      if (error.message.includes('limite') || error.message.includes('déjà membre')) {
        return res.status(400).json({
          success: false,
          error: { code: 'CANNOT_JOIN', message: error.message },
        });
      }
    }
    next(error);
  }
});

// POST /api/groups/:groupId/leave - Leave a group
router.post('/:groupId/leave', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { groupId } = req.params;
    await groupService.leaveGroup(groupId, req.userId!);

    res.json({
      success: true,
      data: { left: true },
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('créateur')) {
      return res.status(400).json({
        success: false,
        error: { code: 'CREATOR_CANNOT_LEAVE', message: error.message },
      });
    }
    next(error);
  }
});

// GET /api/groups/:groupId/members - Get group members
router.get('/:groupId/members', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { groupId } = req.params;
    const members = await groupService.getGroupMembers(groupId);

    res.json({
      success: true,
      data: { members },
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/groups/:groupId/members/:userId - Kick a member
router.delete('/:groupId/members/:userId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { groupId, userId } = req.params;
    await groupService.kickMember(groupId, req.userId!, userId);

    res.json({
      success: true,
      data: { kicked: true },
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Permission')) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: error.message },
      });
    }
    next(error);
  }
});

// PUT /api/groups/:groupId/members/:userId/role - Update member role
router.put('/:groupId/members/:userId/role', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { groupId, userId } = req.params;
    const { role } = req.body;

    if (!['moderator', 'member'].includes(role)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ROLE', message: 'Rôle invalide' },
      });
    }

    await groupService.updateMemberRole(groupId, req.userId!, userId, role);

    res.json({
      success: true,
      data: { updated: true },
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('administrateurs')) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: error.message },
      });
    }
    next(error);
  }
});

// ============ INVITATIONS ============

// POST /api/groups/:groupId/invite - Invite users to group
router.post('/:groupId/invite', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { groupId } = req.params;
    const { userIds } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'userIds doit être un tableau non vide' },
      });
    }

    const invitations = await groupService.inviteUsers(groupId, req.userId!, userIds);

    res.json({
      success: true,
      data: { invitations, invitedCount: invitations.length },
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('membre')) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: error.message },
      });
    }
    next(error);
  }
});

// GET /api/invitations - Get user's pending invitations
router.get('/invitations/pending', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const invitations = await groupService.getUserInvitations(req.userId!);

    res.json({
      success: true,
      data: { invitations },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/invitations/count - Get pending invitation count
router.get('/invitations/count', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const count = await groupService.getPendingInvitationsCount(req.userId!);

    res.json({
      success: true,
      data: { count },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/invitations/:invitationId/accept - Accept invitation
router.post('/invitations/:invitationId/accept', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { invitationId } = req.params;
    await groupService.acceptInvitation(invitationId, req.userId!);

    res.json({
      success: true,
      data: { accepted: true },
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('limite')) {
      return res.status(400).json({
        success: false,
        error: { code: 'GROUP_FULL', message: error.message },
      });
    }
    next(error);
  }
});

// POST /api/invitations/:invitationId/decline - Decline invitation
router.post('/invitations/:invitationId/decline', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { invitationId } = req.params;
    await groupService.declineInvitation(invitationId, req.userId!);

    res.json({
      success: true,
      data: { declined: true },
    });
  } catch (error) {
    next(error);
  }
});

// ============ MESSAGES ============

// GET /api/groups/:groupId/messages - Get group messages
router.get('/:groupId/messages', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { groupId } = req.params;
    const { limit = '50', before } = req.query;

    const { messages, hasMore } = await groupService.getGroupMessages(
      groupId,
      req.userId!,
      parseInt(limit as string, 10),
      before as string | undefined
    );

    res.json({
      success: true,
      data: { messages, hasMore },
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('membre')) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: error.message },
      });
    }
    next(error);
  }
});

// POST /api/groups/:groupId/messages - Send a group message
router.post('/:groupId/messages', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { groupId } = req.params;
    const { content } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_CONTENT', message: 'Le message ne peut pas être vide' },
      });
    }

    if (content.length > 5000) {
      return res.status(400).json({
        success: false,
        error: { code: 'CONTENT_TOO_LONG', message: 'Le message est trop long (max 5000 caractères)' },
      });
    }

    const message = await groupService.sendGroupMessage(groupId, req.userId!, content.trim());

    res.status(201).json({
      success: true,
      data: { message },
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('membre')) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: error.message },
      });
    }
    next(error);
  }
});

export default router;
