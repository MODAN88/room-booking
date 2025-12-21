import { Request, Response } from 'express';
import { roomService } from '../services/room.service';

export class RoomController {
  /** GET /api/v1/rooms */
  async getAllRooms(req: Request, res: Response): Promise<void> {
    try {
      const rooms = await roomService.getAllRooms();
      res.json(rooms);
    } catch (error) {
      console.error('Failed to fetch rooms:', error);
      res.status(500).json({ error: 'Failed to fetch rooms' });
    }
  }
}

export const roomController = new RoomController();
