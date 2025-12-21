import { Router, Request, Response, NextFunction } from 'express';
import { bookingController } from '../controllers/booking.controller';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.middleware';
import { bookingLimiter } from '../middleware/rate-limit.middleware';
import { createBookingValidation } from '../middleware/validation.middleware';
import { validationResult } from 'express-validator';

const router = Router();
const isTest = process.env.NODE_ENV === 'test' || process.env.TEST_MODE === '1';

// Validation error handler
const handleValidation = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }
  next();
};

router.get('/', optionalAuthMiddleware, (req: Request, res: Response) => bookingController.getAllBookings(req, res));
router.post('/', authMiddleware, ...(isTest ? [] : [bookingLimiter]), createBookingValidation, handleValidation, (req: Request, res: Response) => bookingController.createBooking(req, res));
router.post('/:id/close', authMiddleware, (req: Request, res: Response) => bookingController.closeBooking(req, res));

export default router;
