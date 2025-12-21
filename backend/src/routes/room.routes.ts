import { Router } from 'express';
import { roomController } from '../controllers/room.controller';
import { optionalAuthMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.get('/', optionalAuthMiddleware, (req, res) => roomController.getAllRooms(req, res));

export default router;
