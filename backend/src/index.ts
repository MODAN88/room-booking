import express, { Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';

const app = express();
app.use(express.json());

// CORS middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// PostgreSQL connection
const pgPool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'OK' });
});

// Booking endpoint with database persistence and conflict detection
app.post('/api/v1/bookings', async (req: Request, res: Response) => {
  const client = await pgPool.connect();
  try {
    const { roomId, startDate, endDate } = req.body;
    
    if (!roomId || !startDate || !endDate) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate that check-out is after check-in
    const checkInDate = new Date(startDate);
    const checkOutDate = new Date(endDate);
    
    if (checkOutDate <= checkInDate) {
      return res.status(400).json({ error: 'Check-out date must be after check-in date' });
    }

    // Start transaction
    await client.query('BEGIN');

    // Check for overlapping bookings with row-level lock (pessimistic locking)
    // Overlap condition: (startA < endB) AND (endA > startB)
    const conflictQuery = `
      SELECT id FROM bookings 
      WHERE room_id = $1 
      AND start_date < $2 
      AND end_date > $3
      FOR UPDATE;
    `;
    
    const conflictResult = await client.query(conflictQuery, [roomId, endDate, startDate]);
    
    if (conflictResult.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Room is already booked for these dates' });
    }

    // Insert the new booking
    const insertQuery = `
      INSERT INTO bookings (user_id, room_id, start_date, end_date, status)
      VALUES ($1, $2, $3, $4, 'CONFIRMED')
      RETURNING id, room_id, start_date, end_date, status, created_at;
    `;
    
    // Use test user ID
    const testUserId = 'a1b2c3d4-e5f6-7890-1234-567890abcdef';
    
    const result = await client.query(insertQuery, [testUserId, roomId, startDate, endDate]);

    // Commit transaction
    await client.query('COMMIT');
    
    return res.status(201).json({ 
      message: 'Booking created successfully', 
      booking: result.rows[0] 
    });

  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Booking error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
