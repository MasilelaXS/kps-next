"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.optionalAuth = exports.requirePCO = exports.requireAdmin = exports.requireRole = exports.authenticateToken = exports.hasRole = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const database_1 = require("../config/database");
const logger_1 = require("../config/logger");
const env_1 = require("../config/env");
const hasRole = (user, requiredRole) => {
    if (!user)
        return false;
    return user.role === 'both' || user.role === requiredRole;
};
exports.hasRole = hasRole;
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];
        if (!token) {
            res.status(401).json({
                success: false,
                message: 'Access token required',
                error_code: 'NO_TOKEN'
            });
            return;
        }
        let decoded;
        try {
            decoded = jsonwebtoken_1.default.verify(token, env_1.config.jwt.secret);
        }
        catch (jwtError) {
            if (jwtError instanceof jsonwebtoken_1.default.TokenExpiredError) {
                res.status(401).json({
                    success: false,
                    message: 'Token expired',
                    error_code: 'TOKEN_EXPIRED'
                });
                return;
            }
            res.status(401).json({
                success: false,
                message: 'Invalid token',
                error_code: 'INVALID_TOKEN'
            });
            return;
        }
        if (!decoded || !decoded.userId || !decoded.sessionId) {
            res.status(401).json({
                success: false,
                message: 'Invalid token structure',
                error_code: 'INVALID_TOKEN_STRUCTURE'
            });
            return;
        }
        const session = await (0, database_1.executeQuerySingle)(`
      SELECT 
          s.user_id,
          s.role_context,
          s.expires_at,
          u.pco_number,
          u.name,
          u.email,
          u.role,
          u.status
      FROM user_sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.id = ?
      AND s.expires_at > NOW()
      AND u.status = 'active'
    `, [decoded.sessionId]);
        if (!session) {
            res.status(401).json({
                success: false,
                message: 'Session expired or invalid',
                error_code: 'SESSION_EXPIRED'
            });
            return;
        }
        await (0, database_1.executeQuery)('UPDATE user_sessions SET last_activity = NOW() WHERE id = ? AND expires_at > NOW()', [decoded.sessionId]);
        req.user = {
            id: session.user_id,
            login_id: session.pco_number,
            role: session.role,
            first_name: session.name,
            last_name: '',
            email: session.email,
            session_id: decoded.sessionId
        };
        (0, logger_1.logAuth)('token_validated', session.id, {
            session_id: decoded.sessionId,
            ip: req.ip
        });
        next();
    }
    catch (error) {
        logger_1.logger.error('Authentication middleware error', {
            error: error instanceof Error ? error.message : error,
            url: req.originalUrl
        });
        res.status(500).json({
            success: false,
            message: 'Authentication error',
            error_code: 'AUTH_ERROR'
        });
    }
};
exports.authenticateToken = authenticateToken;
const requireRole = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({
                success: false,
                message: 'Authentication required',
                error_code: 'AUTH_REQUIRED'
            });
            return;
        }
        const hasAccess = req.user.role === 'both' || roles.includes(req.user.role);
        if (!hasAccess) {
            (0, logger_1.logAuth)('access_denied', req.user.id, {
                required_roles: roles,
                user_role: req.user.role,
                endpoint: req.originalUrl
            });
            res.status(403).json({
                success: false,
                message: 'Insufficient permissions',
                error_code: 'INSUFFICIENT_PERMISSIONS',
                required_roles: roles,
                user_role: req.user.role
            });
            return;
        }
        next();
    };
};
exports.requireRole = requireRole;
exports.requireAdmin = (0, exports.requireRole)('admin');
exports.requirePCO = (0, exports.requireRole)('pco');
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];
        if (!token) {
            next();
            return;
        }
        try {
            const decoded = jsonwebtoken_1.default.verify(token, env_1.config.jwt.secret);
            if (decoded && decoded.userId) {
                const user = await (0, database_1.executeQuerySingle)('SELECT id, login_id, role, first_name, last_name, email FROM users WHERE id = ? AND is_active = 1', [decoded.userId]);
                if (user) {
                    req.user = {
                        id: user.id,
                        login_id: user.login_id,
                        role: user.role,
                        first_name: user.first_name,
                        last_name: user.last_name,
                        email: user.email,
                        session_id: decoded.sessionId
                    };
                }
            }
        }
        catch (error) {
            logger_1.logger.debug('Optional auth failed', { error });
        }
    }
    catch (error) {
        logger_1.logger.debug('Optional auth middleware error', { error });
    }
    next();
};
exports.optionalAuth = optionalAuth;
//# sourceMappingURL=auth.js.map