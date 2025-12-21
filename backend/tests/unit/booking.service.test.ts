import { BookingService } from '../../src/services/booking.service';
import { pgPool } from '../../src/config/database';

// Mock dependencies
jest.mock('../../src/config/database');

describe('BookingService', () => {
  let bookingService: BookingService;
  let mockQuery: jest.Mock;
  let mockConnect: jest.Mock;
  let mockRelease: jest.Mock;

  beforeEach(() => {
    bookingService = new BookingService();
    mockQuery = jest.fn();
    mockRelease = jest.fn();
    mockConnect = jest.fn().mockResolvedValue({
      query: mockQuery,
      release: mockRelease
    });
    (pgPool.query as jest.Mock) = mockQuery;
    (pgPool.connect as jest.Mock) = mockConnect;
    jest.clearAllMocks();
  });

  describe('getAllBookings', () => {
    it('should return all bookings with room data', async () => {
      const mockBookings = [
        {
          id: '1',
          room_id: 'room1',
          user_id: 'user1',
          start_date: '2024-01-01',
          end_date: '2024-01-05',
          status: 'active',
          room_name: 'Conference Room A',
          country: 'USA'
        }
      ];

      mockQuery.mockResolvedValueOnce({ rows: mockBookings });

      const result = await bookingService.getAllBookings();

      expect(result).toEqual(mockBookings);
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('LEFT JOIN rooms'));
    });

    it('should filter bookings by userId when provided', async () => {
      const userId = 'user123';
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await bookingService.getAllBookings(userId);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE b.user_id = $1'),
        [userId]
      );
    });
  });

  describe('createBooking', () => {
    const validBooking = {
      roomId: 'room1',
      userId: 'user1',
      startDate: '2024-01-01',
      endDate: '2024-01-05'
    };

    it('should successfully create booking with no conflicts', async () => {
      const mockNewBooking = { id: 'booking1', ...validBooking, status: 'active' };

      // Mock transaction: BEGIN, SELECT FOR UPDATE, INSERT, COMMIT
      mockQuery
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // SELECT FOR UPDATE - no conflicts
        .mockResolvedValueOnce({ rows: [mockNewBooking] }) // INSERT
        .mockResolvedValueOnce({}); // COMMIT

      const result = await bookingService.createBooking(validBooking);

      expect(result).toEqual(mockNewBooking);
      expect(mockQuery).toHaveBeenCalledWith('BEGIN');
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('FOR UPDATE'), expect.any(Array));
      expect(mockQuery).toHaveBeenCalledWith('COMMIT');
    });

    it('should rollback on conflict detection', async () => {
      const conflictingBooking = { id: 'existing', room_id: 'room1' };

      mockQuery
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [conflictingBooking] }) // SELECT FOR UPDATE - conflict
        .mockResolvedValueOnce({}); // ROLLBACK

      await expect(bookingService.createBooking(validBooking))
        .rejects.toThrow('Room is already booked for these dates');

      expect(mockQuery).toHaveBeenCalledWith('ROLLBACK');
    });

    it('should rollback on database error', async () => {
      mockQuery
        .mockResolvedValueOnce({}) // BEGIN
        .mockRejectedValueOnce(new Error('Database error')); // SELECT FOR UPDATE fails

      await expect(bookingService.createBooking(validBooking))
        .rejects.toThrow('Database error');

      expect(mockQuery).toHaveBeenCalledWith('ROLLBACK');
    });

    it('should reject invalid date format', async () => {
      await expect(bookingService.createBooking({
        ...validBooking,
        startDate: 'invalid-date'
      })).rejects.toThrow('Invalid date format');
    });

    it('should reject end date before start date', async () => {
      await expect(bookingService.createBooking({
        ...validBooking,
        startDate: '2024-01-10',
        endDate: '2024-01-05'
      })).rejects.toThrow('End date must be after start date');
    });
  });

  describe('closeBooking', () => {
    it('should successfully close owned booking', async () => {
      const bookingId = 'booking1';
      const userId = 'user1';
      const mockBooking = { id: bookingId, user_id: userId, status: 'active' };
      const mockUpdated = { ...mockBooking, status: 'closed' };

      mockQuery
        .mockResolvedValueOnce({ rows: [mockBooking] }) // SELECT booking
        .mockResolvedValueOnce({ rows: [mockUpdated] }); // UPDATE

      const result = await bookingService.closeBooking(bookingId, userId);

      expect(result).toEqual(mockUpdated);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE bookings'),
        expect.arrayContaining([bookingId])
      );
    });

    it('should reject closing non-existent booking', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(bookingService.closeBooking('nonexistent', 'user1'))
        .rejects.toThrow('Booking not found');
    });

    it('should reject closing booking owned by different user', async () => {
      const mockBooking = { id: 'booking1', user_id: 'user1', status: 'active' };
      mockQuery.mockResolvedValueOnce({ rows: [mockBooking] });

      await expect(bookingService.closeBooking('booking1', 'user2'))
        .rejects.toThrow('Not authorized to close this booking');
    });

    it('should reject closing already closed booking', async () => {
      const mockBooking = { id: 'booking1', user_id: 'user1', status: 'closed' };
      mockQuery.mockResolvedValueOnce({ rows: [mockBooking] });

      await expect(bookingService.closeBooking('booking1', 'user1'))
        .rejects.toThrow('Booking is already closed');
    });
  });
});
