import { Pool } from 'pg';

/** PostgreSQL connection pool configuration */
export const pgPool = new Pool({
  user: process.env.DB_USER || 'admin',
  password: process.env.DB_PASS || 'password',
  host: process.env.DB_HOST || 'db',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'booking_platform',
  max: 20, // Maximum pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

/** Test database connection */
export async function testConnection(): Promise<boolean> {
  try {
    const client = await pgPool.connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}
