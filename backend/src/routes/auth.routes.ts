import { Router, Request, Response, NextFunction } from 'express';
import { authController } from '../controllers/auth.controller';
import { authLimiter } from '../middleware/rate-limit.middleware';
import { registerValidation, loginValidation } from '../middleware/validation.middleware';
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

router.post('/register', ...(isTest ? [] : [authLimiter]), registerValidation, handleValidation, (req: Request, res: Response) => authController.register(req, res));
router.post('/login', ...(isTest ? [] : [authLimiter]), loginValidation, handleValidation, (req: Request, res: Response) => authController.login(req, res));

export default router;
