import { EmailService } from '../../src/services/email.service';
import nodemailer from 'nodemailer';

// Mock nodemailer
jest.mock('nodemailer');

describe('EmailService', () => {
  let emailService: EmailService;
  let mockTransporter: any;

  beforeEach(() => {
    mockTransporter = {
      sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' })
    };
    (nodemailer.createTransport as jest.Mock).mockReturnValue(mockTransporter);
    emailService = new EmailService();
    jest.clearAllMocks();
  });

  describe('sendEmail', () => {
    it('should successfully send email', async () => {
      const emailData = {
        to: 'test@example.com',
        subject: 'Test Subject',
        text: 'Test message',
        html: '<p>Test message</p>'
      };

      await emailService.sendEmail(emailData);

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: emailData.to,
          subject: emailData.subject,
          text: emailData.text,
          html: emailData.html
        })
      );
    });

    it('should handle email sending failure', async () => {
      mockTransporter.sendMail.mockRejectedValueOnce(new Error('SMTP error'));

      await expect(emailService.sendEmail({
        to: 'test@example.com',
        subject: 'Test',
        text: 'Test'
      })).rejects.toThrow('SMTP error');
    });
  });

  describe('generateBookingConfirmation', () => {
    it('should generate booking confirmation with all details', () => {
      const bookingData = {
        userName: 'John Doe',
        roomName: 'Conference Room A',
        country: 'USA',
        startDate: '2024-01-01',
        endDate: '2024-01-05',
        bookingId: 'booking123'
      };

      const result = emailService.generateBookingConfirmation(bookingData);

      expect(result.subject).toBe('Booking Confirmation');
      expect(result.text).toContain('John Doe');
      expect(result.text).toContain('Conference Room A');
      expect(result.text).toContain('USA');
      expect(result.text).toContain('2024-01-01');
      expect(result.text).toContain('2024-01-05');
      expect(result.text).toContain('booking123');
      expect(result.html).toContain('<h1>Booking Confirmed</h1>');
      expect(result.html).toContain('Conference Room A');
    });

    it('should generate HTML with proper structure', () => {
      const bookingData = {
        userName: 'Jane Smith',
        roomName: 'Meeting Room B',
        country: 'UK',
        startDate: '2024-02-01',
        endDate: '2024-02-10',
        bookingId: 'booking456'
      };

      const result = emailService.generateBookingConfirmation(bookingData);

      expect(result.html).toContain('<!DOCTYPE html>');
      expect(result.html).toContain('<html>');
      expect(result.html).toContain('</html>');
      expect(result.html).toContain('Meeting Room B');
      expect(result.html).toContain('UK');
    });

    it('should include booking ID in confirmation', () => {
      const bookingData = {
        userName: 'Test User',
        roomName: 'Test Room',
        country: 'Test Country',
        startDate: '2024-01-01',
        endDate: '2024-01-02',
        bookingId: 'test-booking-id-123'
      };

      const result = emailService.generateBookingConfirmation(bookingData);

      expect(result.text).toContain('test-booking-id-123');
      expect(result.html).toContain('test-booking-id-123');
    });
  });
});
