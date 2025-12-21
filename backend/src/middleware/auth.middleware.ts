import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/config';

export interface AuthRequest extends Request {
  userId?: string;
  userEmail?: string;
}

/** JWT authentication middleware */
export const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as { userId: string; email: string };
    (req as AuthRequest).userId = decoded.userId;
    (req as AuthRequest).userEmail = decoded.email;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

/** Optional authentication - extracts user if token exists but doesn't fail if missing */
export const optionalAuthMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    try {
      const decoded = jwt.verify(token, config.jwt.secret) as { userId: string; email: string };
      (req as AuthRequest).userId = decoded.userId;
      (req as AuthRequest).userEmail = decoded.email;
    } catch (err) {
      // Token invalid but we don't fail - just continue without user
    }
  }
  
  next();
};
