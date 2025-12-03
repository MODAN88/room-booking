import express, { Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import nodemailer from 'nodemailer';

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

// Rooms list
app.get('/api/v1/rooms', async (req: Request, res: Response) => {
  try {
    const result = await pgPool.query(`SELECT id, name, price_per_night, location, capacity FROM rooms ORDER BY location;`);
    const cityToCountry: Record<string, string> = {
      'Tel Aviv': 'Israel',
      'Haifa': 'Israel',
      'Miami Beach': 'United States',
      'Berlin': 'Germany',
      'Lisbon': 'Portugal',
      'Tokyo': 'Japan',
      'Paris': 'France',
      'Zermatt': 'Switzerland',
      'Barcelona': 'Spain',
      'London': 'United Kingdom',
      'Melbourne': 'Australia',
      'Rio de Janeiro': 'Brazil'
    };

    const mapped = result.rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      price: Number(r.price_per_night),
      location: r.location,
      capacity: r.capacity,
      emoji: '🏨',
      country: cityToCountry[r.location] || 'Unknown'
    }));

    return res.json(mapped);
  } catch (err) {
    console.error('Failed to fetch rooms', err);
    return res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

// List bookings (all)
app.get('/api/v1/bookings', async (req: Request, res: Response) => {
  try {
    const q = `
      SELECT b.id, b.room_id, b.start_date, b.end_date, b.status, b.created_at, r.name as room_name, r.location
      FROM bookings b
      LEFT JOIN rooms r ON r.id = b.room_id
      ORDER BY b.start_date DESC;
    `;
    const result = await pgPool.query(q);
    return res.json(result.rows);
  } catch (err) {
    console.error('Failed to fetch bookings', err);
    return res.status(500).json({ error: 'Failed to fetch bookings' });
  }
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

    // Enforce future-only bookings: startDate must be strictly after today
    const today = new Date();
    today.setHours(0,0,0,0);
    if (checkInDate <= today) {
      return res.status(400).json({ error: 'Bookings must start in the future (no same-day or past bookings allowed)' });
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

    // Attempt to fetch user email to send confirmation
    let userEmail: string | undefined = undefined;
    try {
      const userRes = await pgPool.query('SELECT email FROM users WHERE id = $1', [testUserId]);
      userEmail = userRes.rows[0]?.email;
    } catch (err) {
      console.warn('Could not fetch user email:', err);
    }

    // Setup transporter if SMTP is configured
    const smtpHost = process.env.SMTP_HOST;
    if (smtpHost && userEmail) {
      try {
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || '587'),
          secure: (process.env.SMTP_SECURE === 'true'),
          auth: process.env.SMTP_USER ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          } : undefined
        });

        const booking = result.rows[0];
        const mailOptions = {
          from: process.env.EMAIL_FROM || 'no-reply@example.com',
          to: userEmail,
          subject: `Booking Confirmation - ${booking.id}`,
          text: `Your booking is confirmed.\n\nRoom: ${booking.room_id}\nStart: ${booking.start_date}\nEnd: ${booking.end_date}\nStatus: ${booking.status}`
        };

        transporter.sendMail(mailOptions).then(info => {
          console.log('Booking confirmation email sent:', info.messageId);
        }).catch(mailErr => {
          console.warn('Failed sending booking email:', mailErr);
        });
      } catch (mailSetupErr) {
        console.warn('SMTP setup failed, skipping email:', mailSetupErr);
      }
    } else {
      if (!smtpHost) console.log('SMTP not configured; skipping email send.');
      if (!userEmail) console.log('No user email found; skipping email send.');
    }
    
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
