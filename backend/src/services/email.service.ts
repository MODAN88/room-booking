import nodemailer from 'nodemailer';
import { config } from '../config/config';

export class EmailService {
  /** Send email via SMTP or Ethereal test account */
  async sendEmail(params: {
    to: string;
    subject: string;
    text: string;
    html?: string;
  }): Promise<string | null> {
    const { to, subject, text, html } = params;
    
    if (!to) return null;

    try {
      if (config.smtp.host) {
        // Production: Use configured SMTP
        const transporter = nodemailer.createTransport({
          host: config.smtp.host,
          port: config.smtp.port,
          secure: config.smtp.secure,
          auth: config.smtp.user
            ? { user: config.smtp.user, pass: config.smtp.pass }
            : undefined,
        });

        const info = await transporter.sendMail({
          from: config.smtp.from,
          to,
          subject,
          text,
          html,
        });
        return nodemailer.getTestMessageUrl(info) || null;
      } else {
        // Development/Test: Use JSON transport when testing to avoid external calls
        const isTest = process.env.NODE_ENV === 'test' || process.env.TEST_MODE === '1';
        const transporter = isTest
          ? nodemailer.createTransport({ jsonTransport: true })
          : nodemailer.createTransport({
              host: 'smtp.ethereal.email',
              port: 587,
              secure: false,
            });

        const info = await transporter.sendMail({
          from: config.smtp.from,
          to,
          subject,
          text,
          html,
        });

        return nodemailer.getTestMessageUrl(info) || null;
      }
    } catch (err) {
      // Propagate errors in tests for clearer assertions
      throw err;
    }
  }

  /** Generate booking confirmation email */
  generateBookingConfirmation(params: {
    userName?: string;
    roomName: string;
    country: string;
    startDate: string;
    endDate: string;
    bookingId: string;
  }): { subject: string; text: string; html: string } {
    const { userName = 'Guest', roomName, country, startDate, endDate, bookingId } = params;
    
    const text = `Dear ${userName},

Your room booking has been confirmed!

Booking Details:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Room: ${roomName}
Country: ${country}
Booking ID: ${bookingId}
Check-in Date: ${startDate}
Check-out Date: ${endDate}
Status: CONFIRMED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Thank you for choosing our service!

Best regards,
Room Booking Team`;

    const html = `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .details { background: #f5f5f5; padding: 15px; border-radius: 5px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Booking Confirmed</h1>
    <p>Dear ${userName},</p>
    <p>Your room booking has been confirmed!</p>
    <div class="details">
      <h2>Booking Details</h2>
      <p><strong>Room:</strong> ${roomName}</p>
      <p><strong>Country:</strong> ${country}</p>
      <p><strong>Booking ID:</strong> ${bookingId}</p>
      <p><strong>Check-in Date:</strong> ${startDate}</p>
      <p><strong>Check-out Date:</strong> ${endDate}</p>
      <p><strong>Status:</strong> CONFIRMED</p>
    </div>
    <p>Thank you for choosing our service!</p>
    <p>Best regards,<br>Room Booking Team</p>
  </div>
</body>
</html>`;

    return {
      subject: 'Booking Confirmation',
      text,
      html
    };
  }
}

export const emailService = new EmailService();
