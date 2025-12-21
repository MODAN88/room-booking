import { Request, Response } from 'express';
import { pgPool } from '../config/database';
import { config } from '../config/config';

export class AdminController {
  /** POST /api/v1/admin/reset */
  async resetDatabase(req: Request, res: Response): Promise<void> {
    const provided = (req.headers['x-admin-secret'] as string) || req.body?.secret;

    if (config.admin.secret && provided !== config.admin.secret) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const client = await pgPool.connect();

    try {
      await client.query('BEGIN');
      await client.query('TRUNCATE TABLE bookings RESTART IDENTITY CASCADE');
      await client.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
      await client.query('TRUNCATE TABLE rooms RESTART IDENTITY CASCADE');
      await client.query('COMMIT');

      res.json({ message: 'Database reset: bookings, users, rooms truncated' });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Admin reset failed:', err);
      res.status(500).json({ error: 'Reset failed' });
    } finally {
      client.release();
    }
  }
}

export const adminController = new AdminController();
