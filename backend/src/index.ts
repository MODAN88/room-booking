import express from 'express';
import { Pool } from 'pg';

const app = express();
app.use(express.json());

// PostgreSQL connection
const pgPool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK' });
});

// Booking endpoint (placeholder)
app.post('/api/v1/bookings', async (req, res) => {
  try {
    const { roomId, startDate, endDate } = req.body;
    
    if (!roomId || !startDate || !endDate) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    res.json({ message: 'Booking created', roomId, startDate, endDate });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
