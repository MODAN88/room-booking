import rateLimit from 'express-rate-limit';

/**
 * General API rate limiter
 * Limits: 100 requests per 15 minutes per IP
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Max 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Authentication rate limiter (stricter)
 * Limits: 5 requests per 15 minutes per IP
 * Prevents brute force attacks on login/register
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Max 5 requests per windowMs
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
});

/**
 * Booking creation rate limiter
 * Limits: 10 bookings per hour per IP
 * Prevents spam booking attempts
 */
export const bookingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Max 10 bookings per hour
  message: 'Too many booking requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
