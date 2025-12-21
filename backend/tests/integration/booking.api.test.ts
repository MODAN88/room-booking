import request from 'supertest';
import express from 'express';
import bookingRouter from '../../src/routes/booking.routes';
import { pgPool } from '../../src/config/database';
import jwt from 'jsonwebtoken';
import { config } from '../../src/config/config';

// Mock dependencies
jest.mock('../../src/config/database');
jest.mock('jsonwebtoken');

describe('Booking API Integration Tests', () => {
  let app: express.Application;
  let mockQuery: jest.Mock;
  let validToken: string;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/bookings', bookingRouter);

    mockQuery = jest.fn();
    (pgPool.query as jest.Mock) = mockQuery;
    
    validToken = 'valid-jwt-token';
    (jwt.verify as jest.Mock).mockReturnValue({ userId: 'user123', email: 'test@example.com' });
    
    jest.clearAllMocks();
  });

  describe('GET /api/v1/bookings', () => {
    it('should return all bookings without authentication', async () => {
      const mockBookings = [
        {
          id: '1',
          room_id: 'room1',
          user_id: 'user1',
          start_date: '2024-01-01',
          end_date: '2024-01-05',
          status: 'active',
          room_name: 'Conference Room',
          country: 'USA'
        }
      ];

      mockQuery.mockResolvedValueOnce({ rows: mockBookings });

      const response = await request(app)
        .get('/api/v1/bookings')
        .expect(200);

      expect(response.body).toEqual(mockBookings);
    });

    it('should filter user bookings when authenticated', async () => {
      const mockBookings = [
        {
          id: '1',
          user_id: 'user123',
          room_name: 'My Room',
          status: 'active'
        }
      ];

      mockQuery.mockResolvedValueOnce({ rows: mockBookings });

      const response = await request(app)
        .get('/api/v1/bookings')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body).toEqual(mockBookings);
    });
  });

  describe('POST /api/v1/bookings', () => {
    const validBookingData = {
      roomId: 'room1',
      startDate: '2024-01-01',
      endDate: '2024-01-05'
    };

    it('should create booking successfully', async () => {
      const mockRoom = { id: 'room1', name: 'Conference Room', country: 'USA' };
      const mockNewBooking = {
        id: 'booking1',
        ...validBookingData,
        user_id: 'user123',
        status: 'active'
      };

      mockQuery
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // FOR UPDATE check
        .mockResolvedValueOnce({ rows: [mockNewBooking] }) // INSERT
        .mockResolvedValueOnce({}) // COMMIT
        .mockResolvedValueOnce({ rows: [mockRoom] }); // Get room details

      const response = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${validToken}`)
        .send(validBookingData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.status).toBe('CONFIRMED');
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .post('/api/v1/bookings')
        .send(validBookingData)
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 for missing roomId', async () => {
      const response = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          startDate: '2024-01-01',
          endDate: '2024-01-05'
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should return 409 for booking conflict', async () => {
      mockQuery
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 'existing' }] }); // Conflict

      const response = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${validToken}`)
        .send(validBookingData)
        .expect(409);

      expect(response.body.error).toContain('already booked');
    });
  });

  describe('POST /api/v1/bookings/:id/close', () => {
    it('should close booking successfully', async () => {
      const bookingId = 'booking123';
      const mockBooking = {
        id: bookingId,
        user_id: 'user123',
        status: 'active'
      };
      const mockClosedBooking = { ...mockBooking, status: 'CLOSED' };

      mockQuery
        .mockResolvedValueOnce({ rows: [mockBooking] }) // SELECT
        .mockResolvedValueOnce({ rows: [mockClosedBooking] }); // UPDATE

      const response = await request(app)
        .post(`/api/v1/bookings/${bookingId}/close`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.status).toBe('CLOSED');
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .post('/api/v1/bookings/booking123/close')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should return 404 for non-existent booking', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .post('/api/v1/bookings/nonexistent/close')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(404);

      expect(response.body.error).toContain('not found');
    });

    it('should return 403 for unauthorized user', async () => {
      const mockBooking = {
        id: 'booking123',
        user_id: 'different-user',
        status: 'active'
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockBooking] });

      const response = await request(app)
        .post('/api/v1/bookings/booking123/close')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(403);

      expect(response.body.error).toContain('Not authorized');
    });
  });
});
