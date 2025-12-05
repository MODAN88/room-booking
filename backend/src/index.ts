import express, { Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import nodemailer from 'nodemailer';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

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
  user: process.env.DB_USER || 'admin',
  password: process.env.DB_PASS || 'password',
  host: process.env.DB_HOST || 'db',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'booking_platform',
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'OK' });
});

// JWT secret for token signing
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware to verify JWT token
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

// User registration endpoint
app.post('/api/v1/auth/register', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if user already exists
    const existingUser = await pgPool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const result = await pgPool.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at',
      [email, passwordHash]
    );

    const user = result.rows[0];
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      message: 'User registered successfully',
      user: { id: user.id, email: user.email },
      token
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// User login endpoint
app.post('/api/v1/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Find user
    const result = await pgPool.query('SELECT id, email, password_hash FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];

    // Verify password
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

// Rooms list
app.get('/api/v1/rooms', async (req: Request, res: Response) => {
  try {
    const result = await pgPool.query(`SELECT id, name, price_per_night, location, capacity, country FROM rooms ORDER BY location;`);

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

    // Determine user id from Authorization header (if present) otherwise fall back to a test user
    let userId = 'a1b2c3d4-e5f6-7890-1234-567890abcdef';
    const authHeader = (req.headers.authorization || '') as string;
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded: any = jwt.verify(token, JWT_SECRET);
        if (decoded?.userId) userId = decoded.userId;
      } catch (err) {
        console.warn('Invalid token provided for booking; proceeding with fallback user');
      }
    }

    // Insert the new booking
    const insertQuery = `
      INSERT INTO bookings (user_id, room_id, start_date, end_date, status)
      VALUES ($1, $2, $3, $4, 'CONFIRMED')
      RETURNING id, room_id, start_date, end_date, status, created_at;
    `;

    const result = await client.query(insertQuery, [userId, roomId, startDate, endDate]);

    // Commit transaction
    await client.query('COMMIT');

    // Attempt to fetch user email to send confirmation
    let userEmail: string | undefined = undefined;
    try {
      const userRes = await pgPool.query('SELECT email FROM users WHERE id = $1', [userId]);
      userEmail = userRes.rows[0]?.email;
    } catch (err) {
      console.warn('Could not fetch user email:', err);
    }

    // Prepare mail options
    const booking = result.rows[0];
    const mailOptions = {
      from: process.env.EMAIL_FROM || 'no-reply@example.com',
      to: userEmail,
      subject: `Booking Confirmation - ${booking.id}`,
      text: `Your booking is confirmed.\n\nRoom: ${booking.room_id}\nStart: ${booking.start_date}\nEnd: ${booking.end_date}\nStatus: ${booking.status}`
    };

    // If SMTP configured, use it. Otherwise create a test account and send via Ethereal for local preview.
    try {
      if (process.env.SMTP_HOST && userEmail) {
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || '587'),
          secure: (process.env.SMTP_SECURE === 'true'),
          auth: process.env.SMTP_USER ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          } : undefined
        });

        const info = await transporter.sendMail(mailOptions);
        console.log('Booking confirmation email sent:', info.messageId);
        // include no preview URL for real SMTP
        (res as any).locals.emailPreviewUrl = null;
      } else if (userEmail) {
        // No SMTP set — create a test account and send so developer can preview messages locally
        const testAccount = await nodemailer.createTestAccount();
        const transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass
          }
        });

        const info = await transporter.sendMail(mailOptions);
        const preview = nodemailer.getTestMessageUrl(info) || null;
        console.log('Test booking email sent. Preview URL:', preview);
        (res as any).locals.emailPreviewUrl = preview;
      } else {
        if (!userEmail) console.log('No user email found; skipping email send.');
        (res as any).locals.emailPreviewUrl = null;
      }
    } catch (mailErr) {
      console.warn('Failed sending booking email:', mailErr);
      (res as any).locals.emailPreviewUrl = null;
    }
    
    return res.status(201).json({ 
      message: 'Booking created successfully', 
      booking: result.rows[0],
      emailPreviewUrl: (res as any).locals.emailPreviewUrl || null
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
