import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AuthError } from '../../services/auth.service.js';
import { ConversationError } from '../../services/conversation.service.js';
import { MessageError } from '../../services/message.service.js';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('Error:', err);

  // Zod validation errors
  if (err instanceof ZodError) {
    const errors = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));

    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: errors,
      },
    });
    return;
  }

  // Auth errors
  if (err instanceof AuthError) {
    const statusCode = getAuthErrorStatusCode(err.code);
    res.status(statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
      },
    });
    return;
  }

  // Conversation errors
  if (err instanceof ConversationError) {
    const statusCode = getConversationErrorStatusCode(err.code);
    res.status(statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
      },
    });
    return;
  }

  // Message errors
  if (err instanceof MessageError) {
    const statusCode = getMessageErrorStatusCode(err.code);
    res.status(statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
      },
    });
    return;
  }

  // PostgreSQL unique constraint violation
  if ((err as NodeJS.ErrnoException).code === '23505') {
    res.status(409).json({
      success: false,
      error: {
        code: 'DUPLICATE_ENTRY',
        message: 'A record with this value already exists',
      },
    });
    return;
  }

  // PostgreSQL foreign key violation
  if ((err as NodeJS.ErrnoException).code === '23503') {
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_REFERENCE',
        message: 'Referenced record does not exist',
      },
    });
    return;
  }

  // PostgreSQL check constraint violation
  if ((err as NodeJS.ErrnoException).code === '23514') {
    res.status(400).json({
      success: false,
      error: {
        code: 'CONSTRAINT_VIOLATION',
        message: 'Data does not meet requirements',
      },
    });
    return;
  }

  // Default error
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred',
    },
  });
}

function getAuthErrorStatusCode(code: string): number {
  switch (code) {
    case 'EMAIL_EXISTS':
    case 'USERNAME_EXISTS':
      return 409;
    case 'INVALID_CREDENTIALS':
    case 'INVALID_REFRESH_TOKEN':
      return 401;
    case 'ACCOUNT_DISABLED':
    case 'ACCOUNT_SUSPENDED':
      return 403;
    default:
      return 400;
  }
}

function getConversationErrorStatusCode(code: string): number {
  switch (code) {
    case 'NOT_FOUND':
    case 'RECIPIENT_NOT_FOUND':
      return 404;
    case 'BLOCKED':
    case 'QUOTA_EXCEEDED':
      return 403;
    case 'CONVERSATION_EXISTS':
      return 409;
    default:
      return 400;
  }
}

function getMessageErrorStatusCode(code: string): number {
  switch (code) {
    case 'ACCESS_DENIED':
    case 'BLOCKED':
      return 403;
    case 'CONVERSATION_INACTIVE':
      return 400;
    default:
      return 400;
  }
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
  });
}
