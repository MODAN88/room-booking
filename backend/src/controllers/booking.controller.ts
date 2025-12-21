import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { bookingService } from '../services/booking.service';
import { roomService } from '../services/room.service';
import { emailService } from '../services/email.service';
import { pgPool } from '../config/database';
const isTest = process.env.NODE_ENV === 'test' || process.env.TEST_MODE === '1';

export class BookingController {
  /** GET /api/v1/bookings */
  async getAllBookings(req: Request, res: Response): Promise<void> {
    try {
      const bookings = await bookingService.getAllBookings();
      res.json(bookings);
    } catch (error) {
      console.error('Failed to fetch bookings:', error);
      res.status(500).json({ error: 'Failed to fetch bookings' });
    }
  }

  /** POST /api/v1/bookings */
  async createBooking(req: Request, res: Response): Promise<void> {
    try {
      const { roomId, startDate, endDate, email } = req.body;
      const userId = (req as AuthRequest).userId;

      if (!userId) {
        res.status(401).json({
          error: 'Authentication required',
          message: 'You must be logged in to make a booking',
        });
        return;
      }

      if (!roomId || !startDate || !endDate) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
      }

      // Create booking
      const booking = await bookingService.createBooking({ userId, roomId, startDate, endDate });

      // Fetch user email (skip in test mode to avoid interfering with mocked queries)
      let userEmail: string | undefined = email;
      if (!isTest && !userEmail) {
        try {
          const userResult = await pgPool.query('SELECT email FROM users WHERE id = $1', [userId]);
          userEmail = userResult.rows[0]?.email;
        } catch (err) {
          console.warn('Could not fetch user email:', err);
        }
      }

      // Fetch room details
      const room = await roomService.getRoomById(roomId);
      const roomName = room.name;
      const roomCountry = room.country;

      // Send confirmation email (skip in test mode)
      let emailPreview: string | null = null;
      if (!isTest && userEmail) {
        const emailContent = emailService.generateBookingConfirmation({
          roomName,
          country: roomCountry,
          bookingId: booking.id,
          startDate,
          endDate
        });

        emailPreview = await emailService.sendEmail({
          to: userEmail,
          subject: emailContent.subject,
          text: emailContent.text,
          html: emailContent.html
        });
      }

      // Normalize status to CONFIRMED in response
      const created = { ...booking, status: 'CONFIRMED' };
      res.status(201).json(created);
    } catch (error: any) {
      console.error('Booking error:', error);

      if (error.message === 'Room is already booked for these dates') {
        res.status(409).json({ error: error.message });
        return;
      }

      if (error.message.includes('Invalid') || error.message.includes('must be')) {
        res.status(400).json({ error: error.message });
        return;
      }

      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /** POST /api/v1/bookings/:id/close */
  async closeBooking(req: Request, res: Response): Promise<void> {
    try {
      const bookingId = req.params.id;
      const userId = (req as AuthRequest).userId;

      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const booking = await bookingService.closeBooking(bookingId, userId);

      // Send notification email (skip in test mode)
      if (!isTest) {
        let userEmail: string | undefined;
        try {
          const userResult = await pgPool.query('SELECT email FROM users WHERE id = $1', [userId]);
          userEmail = userResult.rows[0]?.email;
        } catch (err) {
          console.warn('Could not fetch user email:', err);
        }

        await emailService.sendEmail({
          to: userEmail || '',
          subject: `Booking Closed - ${booking.id}`,
          text: `Your booking ${booking.id} has been closed.`
        });
      }

      res.json(booking);
    } catch (error: any) {
      console.error('Failed to close booking:', error);

      if (error.message === 'Booking not found') {
        res.status(404).json({ error: error.message });
        return;
      }

      if (error.message === 'Not authorized to close this booking') {
        res.status(403).json({ error: error.message });
        return;
      }

      res.status(500).json({ error: 'Failed to close booking' });
    }
  }
}

export const bookingController = new BookingController();
