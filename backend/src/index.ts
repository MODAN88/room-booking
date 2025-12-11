import express, { Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import nodemailer from 'nodemailer';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const app = express();
app.use(express.json());

/** CORS middleware: Enables cross-origin requests from any domain */
app.use((req: Request, res: Response, next: NextFunction) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

/** PostgreSQL connection pool with configurable parameters from environment */
const pgPool = new Pool({
  user: process.env.DB_USER || 'admin',
  password: process.env.DB_PASS || 'password',
  host: process.env.DB_HOST || 'db',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'booking_platform',
});

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'OK' });
});

/** JWT secret for signing tokens - 7-day expiration configured at sign time */
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

/** Middleware: Extracts and validates JWT Bearer token from Authorization header */
const verifyToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
    if (err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    (req as any).userId = decoded.userId;
    next();
  });
};

/** POST /api/v1/auth/register: User registration with bcrypt password hashing (10 rounds) */
app.post('/api/v1/auth/register', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existingUser = await pgPool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    /** Hash password with bcrypt salt rounds = 10 (balanced security vs performance) */
    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pgPool.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at',
      [email, passwordHash]
    );

    const user = result.rows[0];
    /** Generate JWT token with 7-day expiration */
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    const preview = await sendEmail(user.email, 'Welcome to Room Booking', `Welcome ${user.email} — your account has been created.`);

    res.status(201).json({
      message: 'User registered successfully',
      user: { id: user.id, email: user.email },
      token,
      emailPreviewUrl: preview || null
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** POST /api/v1/auth/login: Authenticates user with email and password, returns JWT token */
app.post('/api/v1/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    const result = await pgPool.query('SELECT id, email, password_hash FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];
    /** Use bcrypt.compare to safely verify password against stored hash */
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      message: 'Login successful',
      user: { id: user.id, email: user.email },
      token
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** GET /api/v1/rooms: Lists all available rooms with emoji icons based on room type/keywords */
app.get('/api/v1/rooms', async (req: Request, res: Response) => {
  try {
    const result = await pgPool.query(`SELECT id, name, price_per_night, location, capacity, country FROM rooms ORDER BY location;`);

    /** Map rooms with emoji icons by matching keywords in room name */
    const emojiMap: Record<string, string> = {
      'King': '👑',
      'Suite': '✨',
      'Studio': '🎨',
      'Deluxe': '💎',
      'Luxury': '🌟',
      'Penthouse': '🏰',
      'Bungalow': '🏝️',
      'Villa': '🏡',
      'Apartment': '🏢',
      'Cottage': '🏠',
      'Loft': '🎭',
      'Home': '🏘️',
      'Chalet': '⛺',
      'Cabin': '🪵',
      'Retreat': '🧘',
      'Cozy': '🔥',
      'Harbor': '⛵',
      'Beach': '🏖️',
      'Ocean': '🌊',
      'Seaside': '🌅',
      'Garden': '🌸',
      'Historic': '🏛️',
      'Modern': '🏗️',
      'Designer': '🎨',
      'Classic': '🎼',
      'Boutique': '🛍️',
      'Central': '🌍',
      'Beachfront': '🏄',
      'Skyline': '🌆',
      'View': '🔭',
      'River': '🌊',
      'Mountain': '⛰️',
      'Alpine': '🏔️',
      'Ski': '⛷️',
      'Ryokan': '⛩️',
      'Minimalist': '⚫',
      'Romantic': '💕',
      'Couple': '👫',
      'Family': '👨‍👩‍👧‍👦',
      'Budget': '💰',
      'Economy': '🚗',
      'Outback': '🦘',
      'Rio': '🎉',
      'Samba': '🎵',
      'Bayfront': '🚤',
      'Copacabana': '🎪',
      'Townhouse': '🏠',
      'Canary': '🦅',
      'Wharf': '🏭',
      'Design': '🖼️',
      'Terrace': '🌳',
      'Ski-in': '🎿',
    };

    const mapped = result.rows.map((r: any) => {
      let emoji = '🏨';
      for (const [keyword, emo] of Object.entries(emojiMap)) {
        if (r.name.includes(keyword)) {
          emoji = emo;
          break;
        }
      }
      return {
        id: r.id,
        name: r.name,
        price: Number(r.price_per_night),
        location: r.location,
        capacity: r.capacity,
        emoji: emoji,
        country: r.country || 'Unknown'
      };
    });

    return res.json(mapped);
  } catch (err) {
    console.error('Failed to fetch rooms', err);
    return res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

/** Sends email via configured SMTP (Gmail) or falls back to Ethereal test email service */
async function sendEmail(to: string | undefined, subject: string, text: string): Promise<string | null> {
  if (!to) return null;
  try {
    if (process.env.SMTP_HOST) {
      /** Production: Use configured SMTP (Gmail with app password) */
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: (process.env.SMTP_SECURE === 'true'),
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
      });

      const info = await transporter.sendMail({ from: process.env.EMAIL_FROM || 'no-reply@example.com', to, subject, text });
      console.log('Email sent:', info.messageId);
      return null;
    } else {
      /** Development: Use Ethereal test account for preview URLs */
      const testAccount = await nodemailer.createTestAccount();
      const transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: { user: testAccount.user, pass: testAccount.pass }
      });
      const info = await transporter.sendMail({ from: process.env.EMAIL_FROM || 'no-reply@example.com', to, subject, text });
      const preview = nodemailer.getTestMessageUrl(info) || null;
      console.log('Test email sent. Preview URL:', preview);
      return preview;
    }
  } catch (err) {
    console.warn('Failed to send email:', err);
    return null;
  }
}

/** GET /api/v1/bookings: Retrieves all bookings with room details via LEFT JOIN */
app.get('/api/v1/bookings', async (req: Request, res: Response) => {
  try {
    const q = `
      SELECT b.id, b.user_id, b.room_id, b.start_date, b.end_date, b.status, b.created_at, r.name as room_name, r.location
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

/**
 * POST /api/v1/bookings: Creates booking with conflict detection & ACID transactions
 * - Validates date format and logic (end > start)
 * - Requires authentication (JWT Bearer token mandatory)
 * - Uses pessimistic locking (FOR UPDATE) to prevent race conditions
 * - Returns HTTP 409 if room already booked for given dates
 */
app.post('/api/v1/bookings', async (req: Request, res: Response) => {
  const client = await pgPool.connect();
  try {
    const { roomId, startDate, endDate, email } = req.body;
    if (!roomId || !startDate || !endDate) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    /** Validate date format (YYYY-MM-DD) and logical order */
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
    }
    if (end <= start) {
      return res.status(400).json({ error: 'Check-out date must be after check-in date' });
    }

    let userId: string | null = null;
    const authHeader = (req.headers.authorization || '') as string; // Extract Bearer token
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded: any = jwt.verify(token, JWT_SECRET);
        if (decoded?.userId) userId = decoded.userId;
      } catch (err) {
        console.warn('Invalid token provided for booking');
      }
    }

    // If no valid user, return error (user must be logged in to book)
    if (!userId) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'You must be logged in to make a booking'
      });
    }
    
    /** Start ACID transaction with pessimistic locking (FOR UPDATE) */
    await client.query('BEGIN');

    // Query with FOR UPDATE lock to detect overlapping bookings
    const checkQuery = `
      SELECT id FROM bookings 
      WHERE room_id = $1 
      AND start_date < $2 
      AND end_date > $3
      AND status != 'CANCELLED'
      FOR UPDATE;
    `;
    
    /** Detect overlapping bookings: (startA < endB) AND (endA > startB) with FOR UPDATE lock */
    const conflictResult = await client.query(checkQuery, [roomId, endDate, startDate]);
    
    if (conflictResult.rowCount && conflictResult.rowCount > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ 
        error: 'Room is already booked for these dates',
        conflictingBookings: conflictResult.rows
      });
    }

    /** Insert booking record into database within transaction */
    const insertQuery = `
      INSERT INTO bookings (user_id, room_id, start_date, end_date, status)
      VALUES ($1, $2, $3, $4, 'CONFIRMED')
      RETURNING id, room_id, start_date, end_date, status, created_at;
    `;

    const result = await client.query(insertQuery, [userId, roomId, startDate, endDate]);
    const booking = result.rows[0];
    /** Commit transaction - persists booking to database */
    await client.query('COMMIT');

    // Attempt to fetch user email to send confirmation (prefer explicit email param)
    let userEmail: string | undefined = email;
    if (!userEmail) {
      try {
        const userRes = await pgPool.query('SELECT email FROM users WHERE id = $1', [userId]);
        userEmail = userRes.rows[0]?.email;
      } catch (err) {
        console.warn('Could not fetch user email:', err);
      }
    }

    /** Fetch room details for personalized confirmation email */
    let roomName = 'Your Room';
    let roomLocation = '';
    try {
      const roomResult = await pgPool.query('SELECT name, location FROM rooms WHERE id = $1', [roomId]);
      if (roomResult.rows.length > 0) {
        roomName = roomResult.rows[0].name;
        roomLocation = roomResult.rows[0].location;
      }
    } catch (err) {
      console.warn('Could not fetch room details:', err);
    }

    /** Send confirmation email with booking details */
    let emailPreview: string | null = null;
    try {
      emailPreview = await sendEmail(
        userEmail, 
        'Room Booking Confirmation - Your Reservation is Confirmed!', 
        `Dear Guest,

Your room booking has been confirmed!

Booking Details:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Room: ${roomName}
Location: ${roomLocation}
Booking ID: ${booking.id}
Check-in Date: ${startDate}
Check-out Date: ${endDate}
Status: CONFIRMED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Thank you for choosing our service!

Best regards,
Room Booking Team`
      );
    } catch (emailErr) {
      console.error('Email sending failed:', emailErr);
    }

    /** Return booking confirmation with optional email preview URL for testing */
    return res.status(200).json({ 
      message: 'Booking successful',
      bookingId: booking.id,
      emailSent: emailPreview !== null,
      emailPreviewUrl: emailPreview || null
    });

  } catch (error: any) {
    /** Rollback transaction on error to ensure data consistency */
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('Rollback error:', rollbackErr);
    }
    console.error('Booking error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

/** POST /api/v1/bookings/:id/close: Marks booking as CLOSED (protected route - requires JWT) */
app.post('/api/v1/bookings/:id/close', verifyToken, async (req: Request, res: Response) => {
  const bookingId = req.params.id;
  const userId = (req as any).userId as string;

  try {
    const q = `SELECT id, user_id, room_id, start_date, end_date, status FROM bookings WHERE id = $1`;
    const r = await pgPool.query(q, [bookingId]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Booking not found' });
    const booking = r.rows[0];
    if (booking.user_id !== userId) return res.status(403).json({ error: 'Not authorized to close this booking' });

    const updateQ = `UPDATE bookings SET status = 'CLOSED' WHERE id = $1 RETURNING id, user_id, room_id, start_date, end_date, status`;
    const updated = await pgPool.query(updateQ, [bookingId]);

    let userEmail: string | undefined;
    try {
      const userRes = await pgPool.query('SELECT email FROM users WHERE id = $1', [userId]);
      userEmail = userRes.rows[0]?.email;
    } catch (err) {
      console.warn('Could not fetch user email for close notification:', err);
    }

    const closed = updated.rows[0];
    const preview = await sendEmail(userEmail, `Booking Closed - ${closed.id}`, `Your booking ${closed.id} has been closed.`);

    return res.json({ booking: closed, emailPreviewUrl: preview || null });
  } catch (err) {
    console.error('Failed to close booking', err);
    return res.status(500).json({ error: 'Failed to close booking' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Backend server running on port ${PORT} with ACID transactions enabled`);
});

/** POST /api/v1/admin/reset: Truncates all data for clean slate (admin endpoint) */
app.post('/api/v1/admin/reset', async (req: Request, res: Response) => {
  const provided = (req.headers['x-admin-secret'] as string) || req.body?.secret;
  const adminSecret = process.env.ADMIN_SECRET;
  if (adminSecret && provided !== adminSecret) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const client = await pgPool.connect();
  try {
    await client.query('BEGIN');
    await client.query('TRUNCATE TABLE bookings RESTART IDENTITY CASCADE');
    await client.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
    await client.query('TRUNCATE TABLE rooms RESTART IDENTITY CASCADE');
    await client.query('COMMIT');
    return res.json({ message: 'Database reset: bookings, users, rooms truncated' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Admin reset failed', err);
    return res.status(500).json({ error: 'Reset failed' });
  } finally {
    client.release();
  }
});
