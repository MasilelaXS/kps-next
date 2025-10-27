"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const auth_1 = require("../middleware/auth");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const uuid_1 = require("uuid");
const env_1 = require("../config/env");
const logger_1 = require("../config/logger");
const database_1 = require("../config/database");
const validation_1 = require("../utils/validation");
const emailService_1 = require("../services/emailService");
const generateSessionId = () => {
    return (0, uuid_1.v4)().replace(/-/g, '');
};
const LOCKOUT_CONFIG = {
    maxFailedAttempts: 5,
    lockoutDurationMinutes: 15,
    attemptWindowMinutes: 15
};
const checkAccountLockout = async (pcoNumber) => {
    const user = await (0, database_1.executeQuerySingle)('SELECT failed_login_attempts, locked_until FROM users WHERE pco_number = ?', [pcoNumber]);
    if (!user) {
        return { isLocked: false };
    }
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
        return {
            isLocked: true,
            lockUntil: new Date(user.locked_until)
        };
    }
    if (user.locked_until && new Date(user.locked_until) <= new Date()) {
        await (0, database_1.executeQuery)('UPDATE users SET failed_login_attempts = 0, locked_until = NULL, account_locked_at = NULL WHERE pco_number = ?', [pcoNumber]);
        return { isLocked: false, remainingAttempts: LOCKOUT_CONFIG.maxFailedAttempts };
    }
    const failedAttempts = await (0, database_1.executeQuerySingle)(`
    SELECT COUNT(*) as count 
    FROM login_attempts 
    WHERE pco_number = ? 
    AND success = FALSE 
    AND attempt_time > DATE_SUB(NOW(), INTERVAL ? MINUTE)
  `, [pcoNumber, LOCKOUT_CONFIG.attemptWindowMinutes]);
    const currentAttempts = Math.max(user.failed_login_attempts || 0, failedAttempts?.count || 0);
    if (currentAttempts >= LOCKOUT_CONFIG.maxFailedAttempts) {
        const lockUntil = new Date(Date.now() + LOCKOUT_CONFIG.lockoutDurationMinutes * 60 * 1000);
        await (0, database_1.executeQuery)('UPDATE users SET locked_until = ?, account_locked_at = NOW() WHERE pco_number = ?', [lockUntil, pcoNumber]);
        return { isLocked: true, lockUntil };
    }
    return {
        isLocked: false,
        remainingAttempts: LOCKOUT_CONFIG.maxFailedAttempts - currentAttempts
    };
};
const recordLoginAttempt = async (pcoNumber, userId, success, failureReason, ipAddress, userAgent) => {
    await (0, database_1.executeQuery)('INSERT INTO login_attempts (user_id, pco_number, ip_address, success, failure_reason, user_agent) VALUES (?, ?, ?, ?, ?, ?)', [userId, pcoNumber, ipAddress, success, failureReason, userAgent]);
    if (!success && userId) {
        await (0, database_1.executeQuery)('UPDATE users SET failed_login_attempts = COALESCE(failed_login_attempts, 0) + 1 WHERE id = ?', [userId]);
    }
    else if (success && userId) {
        await (0, database_1.executeQuery)('UPDATE users SET failed_login_attempts = 0, locked_until = NULL, account_locked_at = NULL WHERE id = ?', [userId]);
    }
};
const parseLoginId = (loginId) => {
    const match = loginId.match(/^(admin|pco)(\d+)$/);
    if (!match)
        return null;
    return {
        type: match[1],
        number: match[2]
    };
};
class AuthController {
    static async login(req, res) {
        try {
            const { error, value } = (0, validation_1.validateLoginInput)(req.body);
            if (error) {
                res.status(400).json({
                    success: false,
                    message: 'Invalid input',
                    errors: error.details.map((d) => d.message)
                });
                return;
            }
            const { login_id, password } = value;
            const parsed = parseLoginId(login_id);
            if (!parsed) {
                await recordLoginAttempt(login_id, null, false, 'invalid_credentials', req.ip || '0.0.0.0', req.get('User-Agent') || 'Unknown');
                res.status(400).json({
                    success: false,
                    message: 'Invalid login format. Use admin12345 or pco67890'
                });
                return;
            }
            const lockoutStatus = await checkAccountLockout(parsed.number);
            if (lockoutStatus.isLocked) {
                await recordLoginAttempt(parsed.number, null, false, 'account_locked', req.ip || '0.0.0.0', req.get('User-Agent') || 'Unknown');
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
            const query = `
        SELECT 
            u.id,
            u.pco_number,
            u.name,
            u.email,
            u.role,
            u.status,
            u.password_hash,
            CASE 
                WHEN LEFT(?, 5) = 'admin' THEN 'admin'
                WHEN LEFT(?, 3) = 'pco' THEN 'pco'
                ELSE NULL 
            END as role_context
        FROM users u 
        WHERE u.pco_number = CASE 
            WHEN LEFT(?, 5) = 'admin' THEN SUBSTRING(?, 6)
            WHEN LEFT(?, 3) = 'pco' THEN SUBSTRING(?, 4)
            ELSE NULL 
        END
        AND u.status = 'active'
        AND (
            (LEFT(?, 5) = 'admin' AND u.role IN ('admin', 'both'))
            OR 
            (LEFT(?, 3) = 'pco' AND u.role IN ('pco', 'both'))
        )
      `;
            const user = await (0, database_1.executeQuerySingle)(query, [
                login_id, login_id, login_id, login_id, login_id, login_id, login_id, login_id
            ]);
            if (!user) {
                await recordLoginAttempt(parsed.number, null, false, 'invalid_credentials', req.ip || '0.0.0.0', req.get('User-Agent') || 'Unknown');
                (0, logger_1.logAuth)('login_failed', login_id, {
                    reason: 'user_not_found',
                    ip: req.ip
                });
                res.status(401).json({
                    success: false,
                    message: 'Invalid credentials'
                });
                return;
            }
            const passwordValid = await bcryptjs_1.default.compare(password, user.password_hash);
            if (!passwordValid) {
                await recordLoginAttempt(user.pco_number, user.id, false, 'invalid_credentials', req.ip || '0.0.0.0', req.get('User-Agent') || 'Unknown');
                const newLockoutStatus = await checkAccountLockout(user.pco_number);
                let responseMessage = 'Invalid credentials';
                if (newLockoutStatus.isLocked) {
                    const lockUntil = newLockoutStatus.lockUntil;
                    const minutesRemaining = lockUntil ? Math.ceil((lockUntil.getTime() - Date.now()) / (1000 * 60)) : 0;
                    responseMessage = `Too many failed attempts. Account locked for ${minutesRemaining} minutes.`;
                }
                else if (newLockoutStatus.remainingAttempts !== undefined) {
                    responseMessage = `Invalid credentials. ${newLockoutStatus.remainingAttempts} attempts remaining before lockout.`;
                }
                (0, logger_1.logAuth)('login_failed', user.id, {
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
            const sessionId = generateSessionId();
            await (0, database_1.executeQuery)(`
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
            ]);
            const token = jsonwebtoken_1.default.sign({ userId: user.id, sessionId }, env_1.config.jwt.secret, { expiresIn: env_1.config.jwt.expiresIn });
            await recordLoginAttempt(user.pco_number, user.id, true, null, req.ip || '0.0.0.0', req.get('User-Agent') || 'Unknown');
            (0, logger_1.logAuth)('login_success', user.id, {
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
                        role_context: user.role_context
                    },
                    token,
                    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
                }
            });
        }
        catch (error) {
            logger_1.logger.error('Login error', {
                error: error instanceof Error ? error.message : error
            });
            res.status(500).json({
                success: false,
                message: 'Login failed due to server error'
            });
        }
    }
    static async logout(req, res) {
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
            await (0, database_1.executeQuery)('DELETE FROM user_sessions WHERE id = ?', [sessionId]);
            (0, logger_1.logAuth)('logout', userId, {
                session_id: sessionId,
                ip: req.ip
            });
            res.json({
                success: true,
                message: 'Logged out successfully'
            });
        }
        catch (error) {
            logger_1.logger.error('Logout error', {
                error: error instanceof Error ? error.message : error
            });
            res.status(500).json({
                success: false,
                message: 'Logout failed'
            });
        }
    }
    static async getProfile(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({
                    success: false,
                    message: 'Authentication required'
                });
                return;
            }
            const user = await (0, database_1.executeQuerySingle)('SELECT id, pco_number, name, email, phone, role, created_at, status FROM users WHERE id = ? AND status = ?', [userId, 'active']);
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
        }
        catch (error) {
            logger_1.logger.error('Get profile error', {
                error: error instanceof Error ? error.message : error,
                userId: req.user?.id
            });
            res.status(500).json({
                success: false,
                message: 'Failed to retrieve profile'
            });
        }
    }
    static async updateProfile(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({
                    success: false,
                    message: 'Authentication required'
                });
                return;
            }
            const { error, value } = (0, validation_1.validateProfileUpdateInput)(req.body);
            if (error) {
                res.status(400).json({
                    success: false,
                    message: 'Invalid input',
                    errors: error.details.map((d) => d.message)
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
            await (0, database_1.executeQuery)(`UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`, [...updateValues, userId]);
            const updatedUser = await (0, database_1.executeQuerySingle)('SELECT id, login_id, first_name, last_name, email, phone, role, created_at, last_login FROM users WHERE id = ?', [userId]);
            (0, logger_1.logAuth)('profile_updated', userId, {
                fields: Object.keys(value),
                ip: req.ip
            });
            res.json({
                success: true,
                message: 'Profile updated successfully',
                data: updatedUser
            });
        }
        catch (error) {
            logger_1.logger.error('Update profile error', {
                error: error instanceof Error ? error.message : error,
                userId: req.user?.id
            });
            res.status(500).json({
                success: false,
                message: 'Failed to update profile'
            });
        }
    }
    static async changePassword(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({
                    success: false,
                    message: 'Authentication required'
                });
                return;
            }
            const { error, value } = (0, validation_1.validateChangePasswordInput)(req.body);
            if (error) {
                res.status(400).json({
                    success: false,
                    message: 'Invalid input',
                    errors: error.details.map((d) => d.message)
                });
                return;
            }
            const { current_password, new_password } = value;
            const user = await (0, database_1.executeQuerySingle)('SELECT password_hash FROM users WHERE id = ? AND status = ?', [userId, 'active']);
            if (!user) {
                res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
                return;
            }
            const passwordValid = await bcryptjs_1.default.compare(current_password, user.password_hash);
            if (!passwordValid) {
                (0, logger_1.logAuth)('password_change_failed', userId, {
                    reason: 'invalid_current_password',
                    ip: req.ip
                });
                res.status(401).json({
                    success: false,
                    message: 'Current password is incorrect'
                });
                return;
            }
            const hashedPassword = await bcryptjs_1.default.hash(new_password, env_1.config.security.bcryptRounds);
            await (0, database_1.executeQuery)('UPDATE users SET password_hash = ? WHERE id = ?', [hashedPassword, userId]);
            await (0, database_1.executeQuery)('DELETE FROM user_sessions WHERE user_id = ? AND id != ?', [userId, req.user?.session_id]);
            (0, logger_1.logAuth)('password_changed', userId, { ip: req.ip });
            res.json({
                success: true,
                message: 'Password changed successfully. Other sessions have been logged out.'
            });
        }
        catch (error) {
            logger_1.logger.error('Change password error', {
                error: error instanceof Error ? error.message : error,
                userId: req.user?.id
            });
            res.status(500).json({
                success: false,
                message: 'Failed to change password'
            });
        }
    }
    static async forgotPassword(req, res) {
        try {
            const { pco_number } = req.body;
            if (!pco_number) {
                res.status(400).json({
                    success: false,
                    message: 'PCO number is required'
                });
                return;
            }
            const user = await (0, database_1.executeQuerySingle)('SELECT id, email, name FROM users WHERE pco_number = ? AND status = ?', [pco_number, 'active']);
            if (!user) {
                res.json({
                    success: true,
                    message: 'If the PCO number exists, a password reset email has been sent.'
                });
                return;
            }
            const resetToken = generateSessionId();
            await (0, database_1.executeQuery)(`
        INSERT INTO password_reset_tokens (
            user_id, token, expires_at
        ) VALUES (
            ?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR)
        )`, [user.id, resetToken]);
            const emailSent = await (0, emailService_1.sendPasswordResetEmail)(user.email, user.name, resetToken);
            if (!emailSent) {
                logger_1.logger.warn('Password reset email failed to send', { userId: user.id, email: user.email });
            }
            logger_1.logger.info('Password reset requested', {
                userId: user.id,
                email: user.email,
                emailSent
            });
            res.json({
                success: true,
                message: 'If the PCO number exists, a password reset email has been sent.'
            });
        }
        catch (error) {
            logger_1.logger.error('Forgot password error', {
                error: error instanceof Error ? error.message : error
            });
            res.status(500).json({
                success: false,
                message: 'Failed to process forgot password request'
            });
        }
    }
    static async verifyResetToken(req, res) {
        try {
            const { token } = req.query;
            if (!token || typeof token !== 'string') {
                res.status(400).json({
                    success: false,
                    message: 'Reset token is required'
                });
                return;
            }
            const resetData = await (0, database_1.executeQuerySingle)(`
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
        }
        catch (error) {
            logger_1.logger.error('Verify reset token error', {
                error: error instanceof Error ? error.message : error
            });
            res.status(500).json({
                success: false,
                message: 'Failed to verify reset token'
            });
        }
    }
    static async resetPassword(req, res) {
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
            const hashedPassword = await bcryptjs_1.default.hash(new_password, env_1.config.security.bcryptRounds);
            const updateResult = await (0, database_1.executeQuery)(`
        UPDATE users 
        SET password_hash = ?
        WHERE id = (
            SELECT user_id FROM password_reset_tokens 
            WHERE token = ? 
            AND expires_at > NOW() 
            AND used_at IS NULL
        )
      `, [hashedPassword, token]);
            if (!updateResult || updateResult.affectedRows === 0) {
                res.status(400).json({
                    success: false,
                    message: 'Invalid or expired reset token'
                });
                return;
            }
            await (0, database_1.executeQuery)('UPDATE password_reset_tokens SET used_at = NOW() WHERE token = ?', [token]);
            await (0, database_1.executeQuery)(`
        DELETE FROM user_sessions 
        WHERE user_id = (
          SELECT user_id FROM password_reset_tokens WHERE token = ?
        )
      `, [token]);
            logger_1.logger.info('Password reset successfully', { token });
            res.json({
                success: true,
                message: 'Password has been reset successfully. Please login with your new password.'
            });
        }
        catch (error) {
            logger_1.logger.error('Reset password error', {
                error: error instanceof Error ? error.message : error
            });
            res.status(500).json({
                success: false,
                message: 'Failed to reset password'
            });
        }
    }
    static async checkLockoutStatus(req, res) {
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
            const recentAttempts = await (0, database_1.executeQuery)(`
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
        }
        catch (error) {
            logger_1.logger.error('Check lockout status error', {
                error: error instanceof Error ? error.message : error
            });
            res.status(500).json({
                success: false,
                message: 'Failed to check lockout status'
            });
        }
    }
    static async unlockAccount(req, res) {
        try {
            if (!(0, auth_1.hasRole)(req.user, 'admin')) {
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
            const result = await (0, database_1.executeQuery)('UPDATE users SET failed_login_attempts = 0, locked_until = NULL, account_locked_at = NULL WHERE pco_number = ?', [pco_number]);
            if (result.affectedRows === 0) {
                res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
                return;
            }
            (0, logger_1.logAuth)('account_unlocked', req.user.id, {
                unlocked_pco_number: pco_number,
                admin_user: req.user.id,
                ip: req.ip
            });
            res.json({
                success: true,
                message: `Account ${pco_number} has been unlocked successfully`
            });
        }
        catch (error) {
            logger_1.logger.error('Unlock account error', {
                error: error instanceof Error ? error.message : error
            });
            res.status(500).json({
                success: false,
                message: 'Failed to unlock account'
            });
        }
    }
    static async validateToken(req, res) {
        res.json({
            success: true,
            message: 'Token is valid',
            data: {
                user: req.user,
                expires_in: '24h'
            }
        });
    }
    static async testEmail(req, res) {
        try {
            const { email } = req.body;
            if (!email) {
                res.status(400).json({
                    success: false,
                    message: 'Email address is required'
                });
                return;
            }
            const { sendTestEmail } = await Promise.resolve().then(() => __importStar(require('../services/emailService')));
            const emailSent = await sendTestEmail(email);
            if (emailSent) {
                res.json({
                    success: true,
                    message: `Test email sent to ${email}`
                });
            }
            else {
                res.status(500).json({
                    success: false,
                    message: 'Failed to send test email. Check server logs for details.'
                });
            }
        }
        catch (error) {
            logger_1.logger.error('Test email error', {
                error: error instanceof Error ? error.message : error
            });
            res.status(500).json({
                success: false,
                message: 'Failed to send test email'
            });
        }
    }
}
exports.AuthController = AuthController;
exports.default = AuthController;
//# sourceMappingURL=authController.js.map