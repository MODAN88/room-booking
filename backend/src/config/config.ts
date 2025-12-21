/** Environment configuration with validation */
export const config = {
  port: parseInt(process.env.PORT || '3000'),
  
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    expiresIn: '7d',
  },
  
  bcrypt: {
    saltRounds: 10,
  },
  
  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.EMAIL_FROM || 'no-reply@example.com',
  },
  
  admin: {
    secret: process.env.ADMIN_SECRET,
  },
};

/** Validate required environment variables */
export function validateConfig(): void {
  if (config.jwt.secret === 'your-secret-key-change-in-production') {
    console.warn('⚠️  WARNING: Using default JWT_SECRET. Set JWT_SECRET environment variable in production!');
  }
}
