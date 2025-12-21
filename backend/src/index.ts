import { startServer } from './app';

/**
 * Application entry point
 * Initializes and starts the Express server
 */
startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
