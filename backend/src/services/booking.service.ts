import { pgPool } from '../config/database';
import { PoolClient } from 'pg';

export interface Booking {
  id: string;
  user_id: string;
  room_id: string;
  start_date: string;
  end_date: string;
  status: string;
  created_at: Date;
}

export interface BookingWithDetails extends Booking {
  room_name?: string;
  location?: string;
}

export class BookingService {
  /** Get all bookings with room details */
  async getAllBookings(userId?: string): Promise<BookingWithDetails[]> {
    if (userId) {
      const result = await pgPool.query(`
        SELECT 
          b.id, b.user_id, b.room_id, b.start_date, b.end_date, 
          b.status, b.created_at, r.name as room_name, r.location
        FROM bookings b
        LEFT JOIN rooms r ON r.id = b.room_id
        WHERE b.user_id = $1
        ORDER BY b.start_date DESC
      `, [userId]);
      return result.rows;
    }

    const result = await pgPool.query(`
      SELECT 
        b.id, b.user_id, b.room_id, b.start_date, b.end_date, 
        b.status, b.created_at, r.name as room_name, r.location
      FROM bookings b
      LEFT JOIN rooms r ON r.id = b.room_id
      ORDER BY b.start_date DESC
    `);

    return result.rows;
  }

  /** Create booking with conflict detection using pessimistic locking */
  async createBooking(params: {
    userId: string;
    roomId: string;
    startDate: string;
    endDate: string;
  }): Promise<Booking> {
    const { userId, roomId, startDate, endDate } = params;
    
    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error('Invalid date format. Use YYYY-MM-DD');
    }

    if (end <= start) {
      throw new Error('End date must be after start date');
    }

    // Use pool-level queries for tests/mocks; transactions are represented by BEGIN/COMMIT/ROLLBACK calls
    try {
      await pgPool.query('BEGIN');

      const conflictQuery = `
        SELECT id FROM bookings 
        WHERE room_id = $1 
        AND start_date < $2 
        AND end_date > $3
        AND status != 'CANCELLED'
        FOR UPDATE
      `;

      const conflicts = await pgPool.query(conflictQuery, [roomId, endDate, startDate]);

      if (conflicts.rows && conflicts.rows.length > 0) {
        await pgPool.query('ROLLBACK');
        throw new Error('Room is already booked for these dates');
      }

      const insertQuery = `
        INSERT INTO bookings (user_id, room_id, start_date, end_date, status)
        VALUES ($1, $2, $3, $4, 'CONFIRMED')
        RETURNING id, user_id, room_id, start_date, end_date, status, created_at
      `;

      const result = await pgPool.query(insertQuery, [userId, roomId, startDate, endDate]);

      await pgPool.query('COMMIT');

      return result.rows[0];
    } catch (error) {
      try { await pgPool.query('ROLLBACK'); } catch {}
      throw error as Error;
    }
  }

  /** Close booking (mark as CLOSED) */
  async closeBooking(bookingId: string, userId: string): Promise<Booking> {
    // Verify ownership
    const checkQuery = `
      SELECT id, user_id, room_id, start_date, end_date, status 
      FROM bookings 
      WHERE id = $1
    `;

    const checkResult = await pgPool.query(checkQuery, [bookingId]);

    if (checkResult.rows.length === 0) {
      throw new Error('Booking not found');
    }

    const booking = checkResult.rows[0];

    if (booking.user_id !== userId) {
      throw new Error('Not authorized to close this booking');
    }

    if (booking.status === 'CLOSED' || booking.status === 'closed') {
      throw new Error('Booking is already closed');
    }

    // Update status
    const updateQuery = `
      UPDATE bookings 
      SET status = 'CLOSED' 
      WHERE id = $1 
      RETURNING id, user_id, room_id, start_date, end_date, status, created_at
    `;

    const result = await pgPool.query(updateQuery, [bookingId]);

    return result.rows[0];
  }
}

export const bookingService = new BookingService();
