import { Pool, PoolClient } from 'pg';
import { RedisClientType, createClient } from 'redis';

// DB Configuration from Docker Compose environment variables
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'admin',
  password: process.env.DB_PASS || 'securePassword',
  database: process.env.DB_NAME || 'booking_platform',
});

// Redis client setup (for caching/rate limiting)
const redisClient: RedisClientType = createClient({
    url: `redis://${process.env.REDIS_HOST || 'localhost'}:6379`
});
redisClient.connect().catch(console.error);


export class BookingService {
  /**
   * Creates a new booking within a transaction using Pessimistic Locking to prevent double booking.
   * @throws {Error} ROOM_ALREADY_BOOKED if dates clash.
   */
  async createBooking(userId: string, roomId: string, startDate: string, endDate: string) {
    const client: PoolClient | null = await pool.connect();
    try {
      if (!client) throw new Error('Failed to connect to database');
      
      // 1. Begin Transaction
      await client.query('BEGIN');

      // 2. Availability check with Locking (Pessimistic Locking): 
      // Searches for overlapping bookings and locks potential conflict rows.
      // Overlap condition: (startA < endB) AND (endA > startB)
      const checkQuery = `
        SELECT id FROM bookings 
        WHERE room_id = $1 
        AND (start_date < $2 AND end_date > $3)
        FOR UPDATE; -- Acquires a row-level lock on conflicting bookings
      `;
      
      const conflictResult = await client.query(checkQuery, [roomId, endDate, startDate]);

      if (conflictResult && conflictResult.rowCount && conflictResult.rowCount > 0) {
        // Conflict found - throw error, which triggers ROLLBACK
        throw new Error("ROOM_ALREADY_BOOKED"); 
      }

      // 3. Insert the new booking
      const insertQuery = `
        INSERT INTO bookings (user_id, room_id, start_date, end_date)
        VALUES ($1, $2, $3, $4)
        RETURNING id, status, created_at
      `;
      
      const result = await client.query(insertQuery, [userId, roomId, startDate, endDate]);

      // 4. Commit Transaction successfully
      await client.query('COMMIT');
      
      // OPTIONAL: Invalidate relevant cache entries after a successful write
      await redisClient.del(`rooms_search:${roomId}`); 

      return result.rows[0];

    } catch (error) {
      if (client) {
        // Rollback changes in case of any error (including ROOM_ALREADY_BOOKED)
        await client.query('ROLLBACK');
      }
      throw error;
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  /**
   * Searches for available rooms, first checking the cache.
   */
  async searchRooms(startDate: string, endDate: string) {
    const cacheKey = `rooms_search:${startDate}:${endDate}`;
    
    // 1. Check Cache
    const cachedResult = await redisClient.get(cacheKey);
    if (cachedResult) {
        return JSON.parse(cachedResult);
    }

    // 2. If not in cache, query DB
    const query = `
      SELECT r.id, r.name, r.price_per_night, r.capacity, r.location
      FROM rooms r
      WHERE NOT EXISTS (
        SELECT 1 FROM bookings b
        WHERE b.room_id = r.id
        AND (b.start_date < $1 AND b.end_date > $2)
      );
    `;
    const result = await pool.query(query, [endDate, startDate]);
    const rooms = result.rows;
    
    // 3. Store in Cache (TTL of 5 minutes)
    await redisClient.set(cacheKey, JSON.stringify(rooms), { EX: 60 * 5 }); 

    return rooms;
  }
}