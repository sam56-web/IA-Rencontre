import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';

import config from './config/index.js';
import { errorHandler, notFoundHandler } from './api/middleware/error.middleware.js';
import { rateLimit } from './api/middleware/rateLimit.middleware.js';

// Routes
import authRoutes from './api/routes/auth.routes.js';
import usersRoutes from './api/routes/users.routes.js';
import profilesRoutes from './api/routes/profiles.routes.js';
import photosRoutes from './api/routes/photos.routes.js';
import discoveryRoutes from './api/routes/discovery.routes.js';
import conversationsRoutes from './api/routes/conversations.routes.js';
import messagesRoutes from './api/routes/messages.routes.js';
import themesRoutes from './api/routes/themes.routes.js';
import groupsRoutes from './api/routes/groups.routes.js';
import searchRoutes from './api/routes/search.routes.js';
import notificationsRoutes from './api/routes/notifications.routes.js';
import affinityRoutes from './api/routes/affinity.routes.js';
import eventsRoutes from './api/routes/events.routes.js';
import badgesRoutes from './api/routes/badges.routes.js';

const app = express();

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// CORS
app.use(cors({
  origin: config.server.frontendUrl,
  credentials: true,
}));

// Logging
if (config.env !== 'test') {
  app.use(morgan(config.env === 'development' ? 'dev' : 'combined'));
}

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
app.use('/api', rateLimit());

// Static files for uploads
app.use('/uploads', express.static(path.resolve(config.storage.path)));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/profiles', profilesRoutes);
app.use('/api/photos', photosRoutes);
app.use('/api/discover', discoveryRoutes);
app.use('/api/conversations', conversationsRoutes);
app.use('/api/conversations', messagesRoutes); // Messages are nested under conversations
app.use('/api/themes', themesRoutes);
app.use('/api/groups', groupsRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/affinity', affinityRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/badges', badgesRoutes);

// 404 handler
app.use(notFoundHandler);

// Error handler
app.use(errorHandler);

export default app;
