const nodemailer = require('nodemailer');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Create reusable transporter object using SMTP transport
const createTransporter = () => {
  // For development, you can use Gmail or other SMTP services
  // For production, configure with your actual SMTP settings
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter;
};

// Send password reset email
const sendPasswordResetEmail = async (email, resetToken) => {
  try {
    const transporter = createTransporter();
    
    // Get frontend URL from environment or use default
    const frontendUrl = process.env.FRONTEND_URL || process.env.CORS_ORIGIN || 'http://localhost:3000';
    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: email,
      subject: 'Password Reset Request',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .button { display: inline-block; padding: 12px 24px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .button:hover { background-color: #45a049; }
            .footer { margin-top: 30px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>Password Reset Request</h2>
            <p>You have requested to reset your password. Click the button below to reset it:</p>
            <a href="${resetUrl}" class="button">Reset Password</a>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all;">${resetUrl}</p>
            <p>This link will expire in 1 hour.</p>
            <p>If you did not request this password reset, please ignore this email.</p>
            <div class="footer">
              <p>This is an automated message, please do not reply.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Password Reset Request
        
        You have requested to reset your password. Click the link below to reset it:
        
        ${resetUrl}
        
        This link will expire in 1 hour.
        
        If you did not request this password reset, please ignore this email.
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Password reset email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending password reset email:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendPasswordResetEmail,
  createTransporter,
};

