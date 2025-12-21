import { AuthService } from '../../src/services/auth.service';
import { pgPool } from '../../src/config/database';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { config } from '../../src/config/config';

// Mock dependencies
jest.mock('../../src/config/database');
jest.mock('bcrypt');
jest.mock('jsonwebtoken');

describe('AuthService', () => {
  let authService: AuthService;
  let mockQuery: jest.Mock;

  beforeEach(() => {
    authService = new AuthService();
    mockQuery = jest.fn();
    (pgPool.query as jest.Mock) = mockQuery;
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should successfully register a new user', async () => {
      const email = 'test@example.com';
      const password = 'password123';
      const hashedPassword = 'hashed_password';
      const mockUser = { id: '123', email, created_at: new Date() };
      const mockToken = 'jwt_token';

      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);
      mockQuery
        .mockResolvedValueOnce({ rows: [] }) // email check
        .mockResolvedValueOnce({ rows: [mockUser] }); // insert
      (jwt.sign as jest.Mock).mockReturnValue(mockToken);

      const result = await authService.register(email, password);

      expect(result.user).toEqual(mockUser);
      expect(result.token).toEqual(mockToken);
      expect(bcrypt.hash).toHaveBeenCalledWith(password, config.bcrypt.saltRounds);
      expect(mockQuery).toHaveBeenCalledTimes(2);
    });

    it('should reject invalid email format', async () => {
      await expect(authService.register('invalid-email', 'password123'))
        .rejects.toThrow('Invalid email format');
    });

    it('should reject short password', async () => {
      await expect(authService.register('test@example.com', '12345'))
        .rejects.toThrow('Password must be at least 6 characters');
    });

    it('should reject duplicate email', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ email: 'test@example.com' }] });

      await expect(authService.register('test@example.com', 'password123'))
        .rejects.toThrow('Email already registered');
    });
  });

  describe('login', () => {
    it('should successfully login with valid credentials', async () => {
      const email = 'test@example.com';
      const password = 'password123';
      const mockUser = {
        id: '123',
        email,
        password_hash: 'hashed_password',
        created_at: new Date()
      };
      const mockToken = 'jwt_token';

      mockQuery.mockResolvedValueOnce({ rows: [mockUser] });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (jwt.sign as jest.Mock).mockReturnValue(mockToken);

      const result = await authService.login(email, password);

      expect(result.user.email).toEqual(email);
      expect(result.token).toEqual(mockToken);
      expect(bcrypt.compare).toHaveBeenCalledWith(password, mockUser.password_hash);
    });

    it('should reject login with non-existent email', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(authService.login('nonexistent@example.com', 'password123'))
        .rejects.toThrow('Invalid email or password');
    });

    it('should reject login with wrong password', async () => {
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        password_hash: 'hashed_password',
        created_at: new Date()
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockUser] });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(authService.login('test@example.com', 'wrong_password'))
        .rejects.toThrow('Invalid email or password');
    });

    it('should reject invalid email format on login', async () => {
      await expect(authService.login('invalid-email', 'password123'))
        .rejects.toThrow('Invalid email format');
    });
  });
});
