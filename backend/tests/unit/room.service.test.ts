import { RoomService } from '../../src/services/room.service';
import { pgPool } from '../../src/config/database';

// Mock dependencies
jest.mock('../../src/config/database');

describe('RoomService', () => {
  let roomService: RoomService;
  let mockQuery: jest.Mock;

  beforeEach(() => {
    roomService = new RoomService();
    mockQuery = jest.fn();
    (pgPool.query as jest.Mock) = mockQuery;
    jest.clearAllMocks();
  });

  describe('getAllRooms', () => {
    it('should return all rooms', async () => {
      const mockRooms = [
        { id: '1', name: 'Conference Room', price_per_night: 100, location: 'New York', capacity: 10, country: 'USA' },
        { id: '2', name: 'Office Space', price_per_night: 150, location: 'London', capacity: 5, country: 'UK' }
      ];

      mockQuery.mockResolvedValueOnce({ rows: mockRooms });

      const result = await roomService.getAllRooms();

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('emoji');
      expect(result[0].country).toBe('USA');
      expect(mockQuery).toHaveBeenCalled();
    });

    it('should return empty array when no rooms exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await roomService.getAllRooms();

      expect(result).toEqual([]);
    });
  });

  describe('getRoomById', () => {
    it('should return room when it exists', async () => {
      const mockRoom = { id: '1', name: 'Conference Room', country: 'USA', type: 'Conference' };
      mockQuery.mockResolvedValueOnce({ rows: [mockRoom] });

      const result = await roomService.getRoomById('1');

      expect(result).toEqual(mockRoom);
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM rooms WHERE id = $1',
        ['1']
      );
    });

    it('should throw error when room does not exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(roomService.getRoomById('nonexistent'))
        .rejects.toThrow('Room not found');
    });
  });

  describe('Emoji mapping', () => {
    it('should map Conference to 🏢', () => {
      // This tests the EMOJI_MAP constant indirectly through room service usage
      const roomType = 'Conference';
      expect(roomService['EMOJI_MAP'][roomType]).toBe('🏢');
    });

    it('should map Office to 💼', () => {
      const roomType = 'Office';
      expect(roomService['EMOJI_MAP'][roomType]).toBe('💼');
    });

    it('should map Meeting to 👥', () => {
      const roomType = 'Meeting';
      expect(roomService['EMOJI_MAP'][roomType]).toBe('👥');
    });
  });
});
