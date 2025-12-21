import express from 'express';
import helmet from 'helmet';
import { config, validateConfig } from './config/config';
import { testConnection } from './config/database';
import { corsMiddleware } from './middleware/cors.middleware';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { generalLimiter } from './middleware/rate-limit.middleware';
import routes from './routes';

const app = express();

// Security middleware
app.use(helmet()); // Security headers
const isTest = process.env.NODE_ENV === 'test' || process.env.TEST_MODE === '1';
if (!isTest) {
  app.use(generalLimiter); // Rate limiting
}

// Body parsing and CORS
app.use(express.json());
app.use(corsMiddleware);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK' });
});

// API routes
app.use('/api/v1', routes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

/** Start server */
export async function startServer(): Promise<void> {
  // Validate configuration
  validateConfig();

  // Optionally skip DB check for local/dev run without PostgreSQL
  const skipDb = process.env.SKIP_DB === '1';
  if (skipDb) {
    console.warn('⚠️  Starting server without database (SKIP_DB=1). API calls that require DB will fail.');
  } else {
    // Test database connection
    const dbConnected = await testConnection();
    if (!dbConnected) {
      console.error('❌ Failed to connect to database');
      process.exit(1);
    }
  }

  // Start listening
  app.listen(config.port, () => {
    console.log(`✅ Backend server running on port ${config.port} with ACID transactions enabled`);
    console.log(`📊 Database: ${skipDb ? 'Skipped (no DB)' : 'Connected'}`);
    console.log(`🔐 JWT: ${config.jwt.secret === 'your-secret-key-change-in-production' ? '⚠️  Using default secret' : 'Configured'}`);
    console.log(`📧 SMTP: ${config.smtp.host ? 'Configured' : 'Using Ethereal (test mode)'}`);
  });
}

export default app;
