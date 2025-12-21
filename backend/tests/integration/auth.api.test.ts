import request from 'supertest';
import express from 'express';
import authRouter from '../../src/routes/auth.routes';
import { pgPool } from '../../src/config/database';

// Mock dependencies
jest.mock('../../src/config/database');

describe('Auth API Integration Tests', () => {
  let app: express.Application;
  let mockQuery: jest.Mock;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/auth', authRouter);

    mockQuery = jest.fn();
    (pgPool.query as jest.Mock) = mockQuery;
    jest.clearAllMocks();
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register new user successfully', async () => {
      const newUser = {
        email: 'newuser@example.com',
        password: 'Password123'
      };

      const mockUser = { id: '123', email: newUser.email, created_at: new Date() };

      mockQuery
        .mockResolvedValueOnce({ rows: [] }) // email check
        .mockResolvedValueOnce({ rows: [mockUser] }); // insert

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(newUser)
        .expect(201);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('token');
      expect(response.body.user.email).toBe(newUser.email);
    });

    it('should return 400 for missing email', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({ password: 'password123' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 for missing password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'test@example.com' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should return 409 for duplicate email', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ email: 'existing@example.com' }] });

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'existing@example.com',
          password: 'password123'
        })
        .expect(409);

      expect(response.body.error).toContain('already registered');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      const credentials = {
        email: 'user@example.com',
        password: 'password123'
      };

      const mockUser = {
        id: '123',
        email: credentials.email,
        password_hash: 'hashed_password',
        created_at: new Date()
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockUser] });

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send(credentials)
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('token');
    });

    it('should return 400 for missing email', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ password: 'password123' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 for missing password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'test@example.com' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should return 401 for non-existent user', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123'
        })
        .expect(401);

      expect(response.body.error).toContain('Invalid');
    });
  });
});
