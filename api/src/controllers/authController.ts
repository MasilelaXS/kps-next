/**
 * KPS Pest Control Management System - Authentication Controller
 * 
 * Handles user authentication, session management, and password operations
 * 
 * @author KPS Development Team
 * @version 1.0.0
 */

import { Request, Response } from 'express';
import { hasRole } from '../middleware/auth';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

import { config } from '../config/env';
import { logger, logAuth } from '../config/logger';
import { executeQuery, executeQuerySingle, executeTransaction } from '../config/database';
import { 
  validateLoginInput, 
  validateChangePasswordInput,
  validateProfileUpdateInput 
} from '../utils/validation';
import { sendPasswordResetEmail } from '../services/emailService';

// Helper function to generate session ID
const generateSessionId = (): string => {
  return uuidv4().replace(/-/g, '');
};

// Account lockout configuration
const LOCKOUT_CONFIG = {
  maxFailedAttempts: 5,
  lockoutDurationMinutes: 15,
  attemptWindowMinutes: 15
};

// Helper function to check if account is locked
const checkAccountLockout = async (pcoNumber: string): Promise<{ isLocked: boolean; lockUntil?: Date; remainingAttempts?: number }> => {
  // Check if user has active lockout
  const user = await executeQuerySingle(
    'SELECT failed_login_attempts, locked_until FROM users WHERE pco_number = ?',
    [pcoNumber]
  );
  
  if (!user) {
    return { isLocked: false };
  }
  
  // Check if currently locked
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    return { 
      isLocked: true, 
      lockUntil: new Date(user.locked_until)
    };
  }
  
  // If lock expired, reset attempts
  if (user.locked_until && new Date(user.locked_until) <= new Date()) {
    await executeQuery(
      'UPDATE users SET failed_login_attempts = 0, locked_until = NULL, account_locked_at = NULL WHERE pco_number = ?',
      [pcoNumber]
    );
    return { isLocked: false, remainingAttempts: LOCKOUT_CONFIG.maxFailedAttempts };
  }
  
  // Check failed attempts in window
  const failedAttempts = await executeQuerySingle(`
    SELECT COUNT(*) as count 
    FROM login_attempts 
    WHERE pco_number = ? 
    AND success = FALSE 
    AND attempt_time > DATE_SUB(NOW(), INTERVAL ? MINUTE)
  `, [pcoNumber, LOCKOUT_CONFIG.attemptWindowMinutes]);
  
  const currentAttempts = Math.max(user.failed_login_attempts || 0, failedAttempts?.count || 0);
  
  if (currentAttempts >= LOCKOUT_CONFIG.maxFailedAttempts) {
    // Lock the account
    const lockUntil = new Date(Date.now() + LOCKOUT_CONFIG.lockoutDurationMinutes * 60 * 1000);
    await executeQuery(
      'UPDATE users SET locked_until = ?, account_locked_at = NOW() WHERE pco_number = ?',
      [lockUntil, pcoNumber]
    );
    
    return { isLocked: true, lockUntil };
  }
  
  return { 
    isLocked: false, 
    remainingAttempts: LOCKOUT_CONFIG.maxFailedAttempts - currentAttempts 
  };
};

// Helper function to record login attempt
const recordLoginAttempt = async (
  pcoNumber: string, 
  userId: number | null, 
  success: boolean, 
  failureReason: string | null, 
  ipAddress: string, 
  userAgent: string
): Promise<void> => {
  await executeQuery(
    'INSERT INTO login_attempts (user_id, pco_number, ip_address, success, failure_reason, user_agent) VALUES (?, ?, ?, ?, ?, ?)',
    [userId, pcoNumber, ipAddress, success, failureReason, userAgent]
  );
  
  if (!success && userId) {
    // Increment failed attempts counter
    await executeQuery(
      'UPDATE users SET failed_login_attempts = COALESCE(failed_login_attempts, 0) + 1 WHERE id = ?',
      [userId]
    );
  } else if (success && userId) {
    // Reset failed attempts on successful login
    await executeQuery(
      'UPDATE users SET failed_login_attempts = 0, locked_until = NULL, account_locked_at = NULL WHERE id = ?',
      [userId]
    );
  }
};

// Helper function to parse login format
// Handles case-insensitive input (ADMIN/Admin/admin, PCO/Pco/pco) and removes spaces
const parseLoginId = (loginId: string): { type: 'admin' | 'pco'; number: string } | null => {
  // Remove all spaces and convert to lowercase for matching
  const cleanedInput = loginId.replace(/\s+/g, '').toLowerCase();
  
  // Match admin or pco prefix (case-insensitive) followed by digits
  const match = cleanedInput.match(/^(admin|pco)(\d+)$/);
  if (!match) return null;
  
  return {
    type: match[1] as 'admin' | 'pco',
    number: match[2]
  };
};

/**
 * Authentication Controller Class
 */
export class AuthController {
  
  /**
   * Login endpoint - handles unique PCO number login format
   * POST /api/auth/login
   */
  static async login(req: Request, res: Response): Promise<void> {
    try {
      // Validate input
      const { error, value } = validateLoginInput(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          message: 'Invalid input',
          errors: error.details.map((d: any) => d.message)
        });
        return;
      }

      const { login_id, password } = value;

      // Parse login ID format (case-insensitive, removes spaces)
      const parsed = parseLoginId(login_id);
      if (!parsed) {
        await recordLoginAttempt(
          login_id, null, false, 'invalid_credentials', req.ip || '0.0.0.0', req.get('User-Agent') || 'Unknown'
        );
        
        res.status(400).json({
          success: false,
          message: 'Invalid login format. Use admin12345 or pco67890 (case-insensitive, spaces allowed)'
        });
        return;
      }

      // Check account lockout status
      const lockoutStatus = await checkAccountLockout(parsed.number);
      if (lockoutStatus.isLocked) {
        await recordLoginAttempt(
          parsed.number, null, false, 'account_locked', req.ip || '0.0.0.0', req.get('User-Agent') || 'Unknown'
        );
        
        const lockUntil = lockoutStatus.lockUntil;
        const minutesRemaining = lockUntil ? Math.ceil((lockUntil.getTime() - Date.now()) / (1000 * 60)) : 0;
        
        res.status(423).json({
          success: false,
          message: `Account temporarily locked due to too many failed attempts. Please try again in ${minutesRemaining} minutes.`,
          error_code: 'ACCOUNT_LOCKED',
          lock_until: lockUntil,
          minutes_remaining: minutesRemaining
        });
        return;
      }

      // Query using parsed values (already normalized to lowercase)
      const query = `
        SELECT 
            u.id,
            u.pco_number,
            u.name,
            u.email,
            u.role,
            u.status,
            u.password_hash,
            ? as role_context
        FROM users u 
        WHERE u.pco_number = ?
        AND u.status = 'active'
        AND (
            (? = 'admin' AND u.role IN ('admin', 'both'))
            OR 
            (? = 'pco' AND u.role IN ('pco', 'both'))
        )
      `;
      
      const user = await executeQuerySingle(query, [
        parsed.type,  // role_context
        parsed.number,  // pco_number
        parsed.type,  // for admin check
        parsed.type   // for pco check
      ]);

      if (!user) {
        await recordLoginAttempt(
          parsed.number, null, false, 'invalid_credentials', req.ip || '0.0.0.0', req.get('User-Agent') || 'Unknown'
        );
        
        logAuth('login_failed', login_id, { 
          reason: 'user_not_found',
          ip: req.ip 
        });

        res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
        return;
      }

      // Verify password
      const passwordValid = await bcrypt.compare(password, user.password_hash);
      if (!passwordValid) {
        await recordLoginAttempt(
          user.pco_number, user.id, false, 'invalid_credentials', req.ip || '0.0.0.0', req.get('User-Agent') || 'Unknown'
        );
        
        // Check if this failure caused account lockout
        const newLockoutStatus = await checkAccountLockout(user.pco_number);
        let responseMessage = 'Invalid credentials';
        
        if (newLockoutStatus.isLocked) {
          const lockUntil = newLockoutStatus.lockUntil;
          const minutesRemaining = lockUntil ? Math.ceil((lockUntil.getTime() - Date.now()) / (1000 * 60)) : 0;
          responseMessage = `Too many failed attempts. Account locked for ${minutesRemaining} minutes.`;
        } else if (newLockoutStatus.remainingAttempts !== undefined) {
          responseMessage = `Invalid credentials. ${newLockoutStatus.remainingAttempts} attempts remaining before lockout.`;
        }
        
        logAuth('login_failed', user.id, { 
          reason: 'invalid_password',
          ip: req.ip,
          remaining_attempts: newLockoutStatus.remainingAttempts
        });

        res.status(401).json({
          success: false,
          message: responseMessage,
          remaining_attempts: newLockoutStatus.remainingAttempts
        });
        return;
      }

      // Role context is already determined by the SQL query

      // Create new session using SQL from guides
      const sessionId = generateSessionId();
      
      await executeQuery(`
        INSERT INTO user_sessions (
            id, user_id, role_context, ip_address, user_agent, expires_at
        ) VALUES (
            ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 24 HOUR)
        )`, [
          sessionId,
          user.id,
          user.role_context,
          req.ip,
          req.get('User-Agent') || 'Unknown'
        ]
      );

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, sessionId },
        config.jwt.secret,
        { expiresIn: config.jwt.expiresIn } as jwt.SignOptions
      );

      // Update last login (skip if column doesn't exist)
      // await executeQuery(
      //   'UPDATE users SET last_login = NOW() WHERE id = ?',
      //   [user.id]
      // );

      // Record successful login attempt and reset failed attempts
      await recordLoginAttempt(
        user.pco_number, user.id, true, null, req.ip || '0.0.0.0', req.get('User-Agent') || 'Unknown'
      );
      
      // Log successful login
      logAuth('login_success', user.id, {
        session_id: sessionId,
        role_context: user.role_context,
        ip: req.ip
      });

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: {
            id: user.id,
            pco_number: user.pco_number,
            name: user.name,
            email: user.email,
            role: user.role,
            role_context: user.role_context // Use prefix-based role for routing (admin/pco)
          },
          token,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
        }
      });

    } catch (error) {
      logger.error('Login error', { 
        error: error instanceof Error ? error.message : error 
      });
      
      res.status(500).json({
        success: false,
        message: 'Login failed due to server error'
      });
    }
  }

  /**
   * Logout endpoint - invalidates session and JWT token
   * POST /api/auth/logout
   */
  static async logout(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const sessionId = req.user?.session_id;

      if (!userId || !sessionId) {
        res.status(401).json({
          success: false,
          message: 'Not authenticated'
        });
        return;
      }

      // Invalidate session in database (using SQL from guides)
      await executeQuery(
        'DELETE FROM user_sessions WHERE id = ?',
        [sessionId]
      );

      // Log logout
      logAuth('logout', userId, {
        session_id: sessionId,
        ip: req.ip
      });

      res.json({
        success: true,
        message: 'Logged out successfully'
      });

    } catch (error) {
      logger.error('Logout error', { 
        error: error instanceof Error ? error.message : error 
      });
      
      res.status(500).json({
        success: false,
        message: 'Logout failed'
      });
    }
  }

  /**
   * Get current user profile
   * GET /api/auth/profile
   */
  static async getProfile(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      const user = await executeQuerySingle(
        'SELECT id, pco_number, name, email, phone, role, created_at, status FROM users WHERE id = ? AND status = ?',
        [userId, 'active']
      );

      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      res.json({
        success: true,
        data: user
      });

    } catch (error) {
      logger.error('Get profile error', { 
        error: error instanceof Error ? error.message : error,
        userId: req.user?.id 
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve profile'
      });
    }
  }

  /**
   * Update user profile
   * PUT /api/auth/profile
   */
  static async updateProfile(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      // Validate input
      const { error, value } = validateProfileUpdateInput(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          message: 'Invalid input',
          errors: error.details.map((d: any) => d.message)
        });
        return;
      }

      const updates = Object.entries(value)
        .filter(([_, v]) => v !== undefined)
        .map(([key, _]) => `${key} = ?`);
      
      const updateValues = Object.values(value).filter(v => v !== undefined);

      if (updates.length === 0) {
        res.status(400).json({
          success: false,
          message: 'No valid fields to update'
        });
        return;
      }

      // Update user profile
      await executeQuery(
        `UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
        [...updateValues, userId]
      );

      // Get updated user data
      const updatedUser = await executeQuerySingle(
        'SELECT id, login_id, first_name, last_name, email, phone, role, created_at, last_login FROM users WHERE id = ?',
        [userId]
      );

      logAuth('profile_updated', userId, { 
        fields: Object.keys(value),
        ip: req.ip 
      });

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: updatedUser
      });

    } catch (error) {
      logger.error('Update profile error', { 
        error: error instanceof Error ? error.message : error,
        userId: req.user?.id 
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to update profile'
      });
    }
  }

  /**
   * Change password
   * POST /api/auth/change-password
   */
  static async changePassword(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      // Validate input
      const { error, value } = validateChangePasswordInput(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          message: 'Invalid input',
          errors: error.details.map((d: any) => d.message)
        });
        return;
      }

      const { current_password, new_password } = value;

      // Get current user (using proper SQL from guides)
      const user = await executeQuerySingle(
        'SELECT password_hash FROM users WHERE id = ? AND status = ?',
        [userId, 'active']
      );

      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      // Verify current password
      const passwordValid = await bcrypt.compare(current_password, user.password_hash);
      if (!passwordValid) {
        logAuth('password_change_failed', userId, { 
          reason: 'invalid_current_password',
          ip: req.ip 
        });

        res.status(401).json({
          success: false,
          message: 'Current password is incorrect'
        });
        return;
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(new_password, config.security.bcryptRounds);

      // Update password using proper SQL from guides
      await executeQuery(
        'UPDATE users SET password_hash = ? WHERE id = ?',
        [hashedPassword, userId]
      );

      // Invalidate all other sessions (delete them since there's no is_active column)
      await executeQuery(
        'DELETE FROM user_sessions WHERE user_id = ? AND id != ?',
        [userId, req.user?.session_id]
      );

      logAuth('password_changed', userId, { ip: req.ip });

      res.json({
        success: true,
        message: 'Password changed successfully. Other sessions have been logged out.'
      });

    } catch (error) {
      logger.error('Change password error', { 
        error: error instanceof Error ? error.message : error,
        userId: req.user?.id 
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to change password'
      });
    }
  }

  /**
   * Forgot password - generate reset token
   * POST /api/auth/forgot-password
   */
  static async forgotPassword(req: Request, res: Response): Promise<void> {
    try {
      const { pco_number } = req.body;

      if (!pco_number) {
        res.status(400).json({
          success: false,
          message: 'PCO number is required'
        });
        return;
      }

      // Check if user exists (using SQL from guides)
      const user = await executeQuerySingle(
        'SELECT id, email, name FROM users WHERE pco_number = ? AND status = ?',
        [pco_number, 'active']
      );

      if (!user) {
        // Don't reveal if user exists or not for security
        res.json({
          success: true,
          message: 'If the PCO number exists, a password reset email has been sent.'
        });
        return;
      }

      // Generate reset token (using SQL from guides)
      const resetToken = generateSessionId();
      await executeQuery(`
        INSERT INTO password_reset_tokens (
            user_id, token, expires_at
        ) VALUES (
            ?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR)
        )`, [user.id, resetToken]
      );

      // Send password reset email
      const emailSent = await sendPasswordResetEmail(user.email, user.name, resetToken);

      if (!emailSent) {
        logger.warn('Password reset email failed to send', { userId: user.id, email: user.email });
        // Continue anyway - token is generated, user can contact admin
      }

      logger.info('Password reset requested', { 
        userId: user.id, 
        email: user.email,
        emailSent 
      });

      res.json({
        success: true,
        message: 'If the PCO number exists, a password reset email has been sent.'
      });

    } catch (error) {
      logger.error('Forgot password error', { 
        error: error instanceof Error ? error.message : error 
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to process forgot password request'
      });
    }
  }

  /**
   * Verify reset token
   * GET /api/auth/verify-reset-token
   */
  static async verifyResetToken(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.query;

      if (!token || typeof token !== 'string') {
        res.status(400).json({
          success: false,
          message: 'Reset token is required'
        });
        return;
      }

      // Verify reset token (using SQL from guides)
      const resetData = await executeQuerySingle(`
        SELECT 
            prt.user_id,
            prt.expires_at,
            u.pco_number,
            u.name,
            u.email
        FROM password_reset_tokens prt
        JOIN users u ON prt.user_id = u.id
        WHERE prt.token = ?
        AND prt.expires_at > NOW()
        AND prt.used_at IS NULL
        AND u.status = 'active'
      `, [token]);

      if (!resetData) {
        res.status(400).json({
          success: false,
          message: 'Invalid or expired reset token'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Reset token is valid',
        data: {
          pco_number: resetData.pco_number,
          name: resetData.name,
          email: resetData.email,
          expires_at: resetData.expires_at
        }
      });

    } catch (error) {
      logger.error('Verify reset token error', { 
        error: error instanceof Error ? error.message : error 
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to verify reset token'
      });
    }
  }

  /**
   * Reset password using token
   * POST /api/auth/reset-password
   */
  static async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      const { token, new_password } = req.body;

      if (!token || !new_password) {
        res.status(400).json({
          success: false,
          message: 'Token and new password are required'
        });
        return;
      }

      if (new_password.length < 6) {
        res.status(400).json({
          success: false,
          message: 'Password must be at least 6 characters long'
        });
        return;
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(new_password, config.security.bcryptRounds);

      // Reset password (using SQL from guides)
      const updateResult = await executeQuery(`
        UPDATE users 
        SET password_hash = ?
        WHERE id = (
            SELECT user_id FROM password_reset_tokens 
            WHERE token = ? 
            AND expires_at > NOW() 
            AND used_at IS NULL
        )
      `, [hashedPassword, token]);

      if (!updateResult || (updateResult as any).affectedRows === 0) {
        res.status(400).json({
          success: false,
          message: 'Invalid or expired reset token'
        });
        return;
      }

      // Mark token as used (using SQL from guides)
      await executeQuery(
        'UPDATE password_reset_tokens SET used_at = NOW() WHERE token = ?',
        [token]
      );

      // Invalidate all sessions for this user
      await executeQuery(`
        DELETE FROM user_sessions 
        WHERE user_id = (
          SELECT user_id FROM password_reset_tokens WHERE token = ?
        )
      `, [token]);

      logger.info('Password reset successfully', { token });

      res.json({
        success: true,
        message: 'Password has been reset successfully. Please login with your new password.'
      });

    } catch (error) {
      logger.error('Reset password error', { 
        error: error instanceof Error ? error.message : error 
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to reset password'
      });
    }
  }

  /**
   * Check account lockout status
   * GET /api/auth/lockout-status
   */
  static async checkLockoutStatus(req: Request, res: Response): Promise<void> {
    try {
      const { pco_number } = req.query;

      if (!pco_number || typeof pco_number !== 'string') {
        res.status(400).json({
          success: false,
          message: 'PCO number is required'
        });
        return;
      }

      const lockoutStatus = await checkAccountLockout(pco_number);
      
      // Get recent login attempts
      const recentAttempts = await executeQuery(`
        SELECT 
          attempt_time,
          success,
          failure_reason,
          ip_address
        FROM login_attempts 
        WHERE pco_number = ? 
        ORDER BY attempt_time DESC 
        LIMIT 10
      `, [pco_number]);

      res.json({
        success: true,
        data: {
          is_locked: lockoutStatus.isLocked,
          lock_until: lockoutStatus.lockUntil,
          remaining_attempts: lockoutStatus.remainingAttempts,
          recent_attempts: recentAttempts,
          lockout_config: LOCKOUT_CONFIG
        }
      });

    } catch (error) {
      logger.error('Check lockout status error', { 
        error: error instanceof Error ? error.message : error 
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to check lockout status'
      });
    }
  }

  /**
   * Unlock account (admin only)
   * POST /api/auth/unlock-account
   */
  static async unlockAccount(req: Request, res: Response): Promise<void> {
    try {
      // Check if user is admin
      if (!hasRole(req.user, 'admin')) {
        res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
        return;
      }

      const { pco_number } = req.body;

      if (!pco_number) {
        res.status(400).json({
          success: false,
          message: 'PCO number is required'
        });
        return;
      }

      // Unlock the account
      const result = await executeQuery(
        'UPDATE users SET failed_login_attempts = 0, locked_until = NULL, account_locked_at = NULL WHERE pco_number = ?',
        [pco_number]
      );

      if ((result as any).affectedRows === 0) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      // Log the unlock action
      logAuth('account_unlocked', req.user!.id, {
        unlocked_pco_number: pco_number,
        admin_user: req.user!.id,
        ip: req.ip
      });

      res.json({
        success: true,
        message: `Account ${pco_number} has been unlocked successfully`
      });

    } catch (error) {
      logger.error('Unlock account error', { 
        error: error instanceof Error ? error.message : error 
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to unlock account'
      });
    }
  }

  /**
   * Validate token endpoint
   * GET /api/auth/validate
   */
  static async validateToken(req: Request, res: Response): Promise<void> {
    // If we reach here, the token is valid (middleware already checked)
    res.json({
      success: true,
      message: 'Token is valid',
      data: {
        user: req.user,
        expires_in: '24h' // This should be calculated from JWT
      }
    });
  }

  /**
   * Test email configuration
   * POST /api/auth/test-email
   */
  static async testEmail(req: Request, res: Response): Promise<void> {
    try {
      const { email } = req.body;

      if (!email) {
        res.status(400).json({
          success: false,
          message: 'Email address is required'
        });
        return;
      }

      // Import test email function
      const { sendTestEmail } = await import('../services/emailService');
      const emailSent = await sendTestEmail(email);

      if (emailSent) {
        res.json({
          success: true,
          message: `Test email sent to ${email}`
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to send test email. Check server logs for details.'
        });
      }
    } catch (error) {
      logger.error('Test email error', { 
        error: error instanceof Error ? error.message : error 
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to send test email'
      });
    }
  }
}

export default AuthController;