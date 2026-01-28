import http from 'http';
import app from './app.js';
import config from './config/index.js';
import { testConnection } from './db/pool.js';
import { createWebSocketServer } from './ws/server.js';

async function main(): Promise<void> {
  // Test database connection
  const dbConnected = await testConnection();
  if (!dbConnected) {
    console.error('Failed to connect to database. Exiting...');
    process.exit(1);
  }

  // Create HTTP server
  const server = http.createServer(app);

  // Create WebSocket server
  createWebSocketServer(server);

  // Start server
  server.listen(config.server.apiPort, () => {
    console.log(`
╔══════════════════════════════════════════════════╗
║                                                  ║
║   🚀 AI Connect Backend Server Started           ║
║                                                  ║
║   API:       http://localhost:${config.server.apiPort}              ║
║   WebSocket: ws://localhost:${config.server.apiPort}/ws             ║
║   Mode:      ${config.env.padEnd(32)}║
║                                                  ║
╚══════════════════════════════════════════════════╝
    `);
  });

  // Graceful shutdown
  const shutdown = async (signal: string): Promise<void> => {
    console.log(`\n${signal} received. Shutting down gracefully...`);

    server.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });

    // Force close after 10 seconds
    setTimeout(() => {
      console.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
