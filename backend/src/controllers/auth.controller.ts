import { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { emailService } from '../services/email.service';
const isTest = process.env.NODE_ENV === 'test' || process.env.TEST_MODE === '1';
const skipDb = process.env.SKIP_DB === '1';

export class AuthController {
  /** POST /api/v1/auth/register */
  async register(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        res.status(400).json({ error: 'Email and password required' });
        return;
      }

      const result = await authService.register(email, password);

      // Send welcome email (skip in test or SKIP_DB mode; ignore errors)
      let emailPreview: string | null = null;
      if (!isTest && !skipDb) {
        try {
          emailPreview = await emailService.sendEmail({
            to: email,
            subject: 'Welcome to Room Booking',
            text: `Welcome ${email} — your account has been created.`
          });
        } catch (e) {
          console.warn('Welcome email failed:', e);
        }
      }

      res.status(201).json({
        message: 'User registered successfully',
        user: { id: result.user.id, email: result.user.email },
        token: result.token,
        emailPreviewUrl: emailPreview || null,
      });
    } catch (error: any) {
      console.error('Registration error:', error);
      
      if (error.message === 'Email already registered') {
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

  /** POST /api/v1/auth/login */
  async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        res.status(400).json({ error: 'Email and password required' });
        return;
      }

      const result = await authService.login(email, password);

      res.json({
        message: 'Login successful',
        user: { id: result.user.id, email: result.user.email },
        token: result.token,
      });
    } catch (error: any) {
      console.error('Login error:', error);

      if (error.message === 'Invalid email or password') {
        res.status(401).json({ error: error.message });
        return;
      }

      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

export const authController = new AuthController();
