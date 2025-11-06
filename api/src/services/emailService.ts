/**
 * KPS Pest Control Management System - Email Service
 * 
 * Handles all email sending functionality using nodemailer
 * 
 * @author KPS Development Team
 * @version 1.0.0
 */

import nodemailer from 'nodemailer';
import { config } from '../config/env';
import { logger } from '../config/logger';

// Create reusable transporter
const transporter = nodemailer.createTransport({
  host: config.email.host,
  port: config.email.port,
  secure: config.email.secure,
  auth: {
    user: config.email.user,
    pass: config.email.password
  },
  tls: {
    rejectUnauthorized: false // For self-signed certificates
  }
});

// Verify connection configuration
transporter.verify((error, success) => {
  if (error) {
    logger.error('Email configuration error:', error);
  } else {
    logger.info('✅ Email service ready');
  }
});

/**
 * Send password reset email
 */
export const sendPasswordResetEmail = async (
  to: string,
  name: string,
  resetToken: string
): Promise<boolean> => {
  try {
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
    
    const mailOptions = {
      from: config.email.from,
      to,
      subject: 'KPS Pest Control - Password Reset Request',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body {
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #333;
              }
              .container {
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
              }
              .header {
                background-color: #2563eb;
                color: white;
                padding: 20px;
                text-align: center;
                border-radius: 5px 5px 0 0;
              }
              .content {
                background-color: #f9fafb;
                padding: 30px;
                border-radius: 0 0 5px 5px;
              }
              .button {
                display: inline-block;
                padding: 12px 30px;
                background-color: #2563eb;
                color: white;
                text-decoration: none;
                border-radius: 5px;
                margin: 20px 0;
              }
              .footer {
                text-align: center;
                margin-top: 20px;
                font-size: 12px;
                color: #6b7280;
              }
              .warning {
                background-color: #fef3c7;
                border-left: 4px solid #f59e0b;
                padding: 15px;
                margin: 20px 0;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>KPS Pest Control</h1>
              </div>
              <div class="content">
                <h2>Password Reset Request</h2>
                <p>Hello ${name},</p>
                <p>We received a request to reset your password for your KPS Pest Control account.</p>
                <p>Click the button below to reset your password:</p>
                <a href="${resetUrl}" class="button">Reset Password</a>
                <p>Or copy and paste this link into your browser:</p>
                <p style="word-break: break-all; color: #2563eb;">${resetUrl}</p>
                <div class="warning">
                  <strong>⚠️ Security Notice:</strong>
                  <ul>
                    <li>This link will expire in 1 hour</li>
                    <li>If you didn't request this, please ignore this email</li>
                    <li>Never share this link with anyone</li>
                  </ul>
                </div>
                <p>If you have any questions, please contact your administrator.</p>
                <p>Best regards,<br>KPS Pest Control Team</p>
              </div>
              <div class="footer">
                <p>This is an automated email. Please do not reply to this message.</p>
                <p>&copy; ${new Date().getFullYear()} KPS Pest Control. All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>
      `,
      text: `
        KPS Pest Control - Password Reset Request
        
        Hello ${name},
        
        We received a request to reset your password for your KPS Pest Control account.
        
        Click the link below to reset your password:
        ${resetUrl}
        
        Security Notice:
        - This link will expire in 1 hour
        - If you didn't request this, please ignore this email
        - Never share this link with anyone
        
        If you have any questions, please contact your administrator.
        
        Best regards,
        KPS Pest Control Team
        
        ---
        This is an automated email. Please do not reply to this message.
      `
    };

    await transporter.sendMail(mailOptions);
    logger.info(`Password reset email sent to ${to}`);
    return true;
  } catch (error) {
    logger.error('Failed to send password reset email:', error);
    return false;
  }
};

/**
 * Send welcome email (for new users)
 */
export const sendWelcomeEmail = async (
  to: string,
  name: string,
  pcoNumber: string,
  tempPassword: string
): Promise<boolean> => {
  try {
    const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`;
    
    const mailOptions = {
      from: config.email.from,
      to,
      subject: 'Welcome to KPS Pest Control',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body {
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #333;
              }
              .container {
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
              }
              .header {
                background-color: #2563eb;
                color: white;
                padding: 20px;
                text-align: center;
                border-radius: 5px 5px 0 0;
              }
              .content {
                background-color: #f9fafb;
                padding: 30px;
                border-radius: 0 0 5px 5px;
              }
              .credentials {
                background-color: #e0f2fe;
                border-left: 4px solid #2563eb;
                padding: 15px;
                margin: 20px 0;
                font-family: monospace;
              }
              .button {
                display: inline-block;
                padding: 12px 30px;
                background-color: #2563eb;
                color: white;
                text-decoration: none;
                border-radius: 5px;
                margin: 20px 0;
              }
              .footer {
                text-align: center;
                margin-top: 20px;
                font-size: 12px;
                color: #6b7280;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Welcome to KPS Pest Control!</h1>
              </div>
              <div class="content">
                <h2>Your Account Has Been Created</h2>
                <p>Hello ${name},</p>
                <p>Your account has been successfully created in the KPS Pest Control Management System.</p>
                <div class="credentials">
                  <strong>Your Login Credentials:</strong><br>
                  PCO Number: ${pcoNumber}<br>
                  Temporary Password: ${tempPassword}
                </div>
                <p><strong>⚠️ Important:</strong> For security reasons, you will be required to change your password upon first login.</p>
                <a href="${loginUrl}" class="button">Login Now</a>
                <p>If the button doesn't work, copy and paste this link:</p>
                <p style="word-break: break-all; color: #2563eb;">${loginUrl}</p>
                <p>If you have any questions or need assistance, please contact your administrator.</p>
                <p>Best regards,<br>KPS Pest Control Team</p>
              </div>
              <div class="footer">
                <p>This is an automated email. Please do not reply to this message.</p>
                <p>&copy; ${new Date().getFullYear()} KPS Pest Control. All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>
      `,
      text: `
        Welcome to KPS Pest Control!
        
        Hello ${name},
        
        Your account has been successfully created in the KPS Pest Control Management System.
        
        Your Login Credentials:
        PCO Number: ${pcoNumber}
        Temporary Password: ${tempPassword}
        
        ⚠️ Important: For security reasons, you will be required to change your password upon first login.
        
        Login here: ${loginUrl}
        
        If you have any questions or need assistance, please contact your administrator.
        
        Best regards,
        KPS Pest Control Team
        
        ---
        This is an automated email. Please do not reply to this message.
      `
    };

    await transporter.sendMail(mailOptions);
    logger.info(`Welcome email sent to ${to}`);
    return true;
  } catch (error) {
    logger.error('Failed to send welcome email:', error);
    return false;
  }
};

/**
 * Send report email with PDF attachment
 */
export const sendReportEmail = async (
  to: string | string[],
  reportData: {
    reportId: number;
    reportType: string;
    clientName: string;
    serviceDate: string;
    pdfPath: string;
  },
  options?: {
    cc?: string | string[];
    additionalMessage?: string;
  }
): Promise<boolean> => {
  try {
    const recipients = Array.isArray(to) ? to.join(', ') : to;
    const ccRecipients = options?.cc ? (Array.isArray(options.cc) ? options.cc.join(', ') : options.cc) : undefined;
    
    const reportTypeDisplay = reportData.reportType === 'bait_inspection' 
      ? 'SERVICE REPORT - BAIT INSPECTION' 
      : reportData.reportType === 'fumigation'
      ? 'SERVICE REPORT - FUMIGATION'
      : 'Service Report';

    const mailOptions = {
      from: config.email.from,
      to: recipients,
      cc: ccRecipients,
      subject: `KPS Pest Control - ${reportTypeDisplay} #${reportData.reportId}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body {
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #333;
              }
              .container {
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
              }
              .header {
                background-color: #1f5582;
                color: white;
                padding: 20px;
                text-align: center;
                border-radius: 5px 5px 0 0;
              }
              .content {
                background-color: #f9fafb;
                padding: 30px;
                border-radius: 0 0 5px 5px;
              }
              .info-box {
                background-color: white;
                border: 1px solid #ddd;
                border-radius: 5px;
                padding: 15px;
                margin: 20px 0;
              }
              .info-row {
                display: flex;
                justify-content: space-between;
                padding: 8px 0;
                border-bottom: 1px solid #eee;
              }
              .info-row:last-child {
                border-bottom: none;
              }
              .label {
                font-weight: bold;
                color: #666;
              }
              .value {
                color: #333;
              }
              .additional-message {
                background-color: #e3f2fd;
                border-left: 4px solid #1f5582;
                padding: 15px;
                margin: 20px 0;
              }
              .footer {
                text-align: center;
                margin-top: 20px;
                padding-top: 20px;
                border-top: 1px solid #ddd;
                font-size: 12px;
                color: #6b7280;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0;">KPS PEST CONTROL</h1>
                <p style="margin: 10px 0 0 0;">${reportTypeDisplay}</p>
              </div>
              <div class="content">
                <p>Dear ${reportData.clientName},</p>
                
                <p>Please find attached your ${reportTypeDisplay.toLowerCase()} from KPS Pest Control.</p>
                
                <div class="info-box">
                  <div class="info-row">
                    <span class="label">Report ID:</span>
                    <span class="value">#${reportData.reportId}</span>
                  </div>
                  <div class="info-row">
                    <span class="label">Service Date:</span>
                    <span class="value">${reportData.serviceDate}</span>
                  </div>
                  <div class="info-row">
                    <span class="label">Report Type:</span>
                    <span class="value">${reportTypeDisplay}</span>
                  </div>
                </div>
                
                ${options?.additionalMessage ? `
                  <div class="additional-message">
                    <p style="margin: 0;"><strong>Additional Information:</strong></p>
                    <p style="margin: 10px 0 0 0;">${options.additionalMessage.replace(/\n/g, '<br>')}</p>
                  </div>
                ` : ''}
                
                <p>If you have any questions or concerns about this report, please don't hesitate to contact us.</p>
                
                <p style="margin-top: 30px;">Best regards,<br>
                <strong>KPS Pest Control Team</strong></p>
              </div>
              <div class="footer">
                <p><strong>KPS Pest Control</strong></p>
                <p>3B Hamman Street, Groblersdal, 0470, South Africa</p>
                <p>This is an automated email. Please do not reply directly to this message.</p>
              </div>
            </div>
          </body>
        </html>
      `,
      attachments: [
        {
          filename: `${reportTypeDisplay.replace(/\s+/g, '_')}_${reportData.reportId}.pdf`,
          path: reportData.pdfPath
        }
      ]
    };

    await transporter.sendMail(mailOptions);
    logger.info(`Report email sent to ${recipients}${ccRecipients ? ` (CC: ${ccRecipients})` : ''}`);
    return true;
  } catch (error) {
    logger.error('Failed to send report email:', error);
    return false;
  }
};

/**
 * Test email configuration
 */
export const sendTestEmail = async (to: string): Promise<boolean> => {
  try {
    const mailOptions = {
      from: config.email.from,
      to,
      subject: 'KPS Pest Control - Email Test',
      html: `
        <h2>Email Configuration Test</h2>
        <p>If you're reading this, your email configuration is working correctly!</p>
        <p>Timestamp: ${new Date().toISOString()}</p>
      `,
      text: `
        Email Configuration Test
        
        If you're reading this, your email configuration is working correctly!
        
        Timestamp: ${new Date().toISOString()}
      `
    };

    await transporter.sendMail(mailOptions);
    logger.info(`Test email sent to ${to}`);
    return true;
  } catch (error) {
    logger.error('Failed to send test email:', error);
    return false;
  }
};

