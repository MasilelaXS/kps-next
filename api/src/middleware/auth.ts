/**
 * KPS Pest Control Management System - Authentication Middleware
 * 
 * JWT token verification and session validation middleware
 * 
 * @author KPS Development Team
 * @version 1.0.0
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { executeQuery, executeQuerySingle } from '../config/database';
import { logger, logAuth } from '../config/logger';
import { config } from '../config/env';

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      validatedData?: any;
    }
  }
}

// User interface for request context
export interface AuthenticatedUser {
  id: number;
  login_id: string;
  role: 'admin' | 'pco';
  first_name: string;
  last_name: string;
  email: string;
  session_id: string;
}

// JWT payload interface
interface JWTPayload {
  userId: number;
  sessionId: string;
  iat?: number;
  exp?: number;
}

/**
 * JWT Token Authentication Middleware
 * Verifies JWT token and attaches user info to request
 */
export const authenticateToken = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Access token required',
        error_code: 'NO_TOKEN'
      });
      return;
    }

    // Verify JWT token
    let decoded: JWTPayload;
    try {
      decoded = jwt.verify(token, config.jwt.secret) as JWTPayload;
    } catch (jwtError) {
      if (jwtError instanceof jwt.TokenExpiredError) {
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

    // Check if session is still active in database (using proper SQL from guides)
    const session = await executeQuerySingle(`
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

    // Update session last activity (using proper SQL from guides)
    await executeQuery(
      'UPDATE user_sessions SET last_activity = NOW() WHERE id = ? AND expires_at > NOW()',
      [decoded.sessionId]
    );

    // Attach user info to request
    req.user = {
      id: session.user_id,
      login_id: session.pco_number, // Keep interface consistent
      role: session.role,
      first_name: session.name, // Keep interface consistent
      last_name: '', // Not available in this schema
      email: session.email,
      session_id: decoded.sessionId
    };

    // Log successful authentication
    logAuth('token_validated', session.id, {
      session_id: decoded.sessionId,
      ip: req.ip
    });

    next();

  } catch (error) {
    logger.error('Authentication middleware error', { 
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

/**
 * Role-based access control middleware
 */
export const requireRole = (...roles: ('admin' | 'pco')[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
        error_code: 'AUTH_REQUIRED'
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      logAuth('access_denied', req.user.id, {
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

/**
 * Admin-only access middleware
 */
export const requireAdmin = requireRole('admin');

/**
 * PCO-only access middleware  
 */
export const requirePCO = requireRole('pco');

/**
 * Optional authentication middleware
 * Attaches user info if token is present but doesn't require it
 */
export const optionalAuth = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      next();
      return;
    }

    // Try to verify token without throwing errors
    try {
      const decoded = jwt.verify(token, config.jwt.secret) as JWTPayload;
      
      if (decoded && decoded.userId) {
        const user = await executeQuerySingle(
          'SELECT id, login_id, role, first_name, last_name, email FROM users WHERE id = ? AND is_active = 1',
          [decoded.userId]
        );

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
    } catch (error) {
      // Ignore authentication errors for optional auth
      logger.debug('Optional auth failed', { error });
    }
  } catch (error) {
    logger.debug('Optional auth middleware error', { error });
  }

  next();
};