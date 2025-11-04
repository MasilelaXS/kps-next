/**
 * KPS Pest Control Management System - Environment Configuration
 * 
 * Centralized environment variable management with validation
 * Uses hardcoded config for production (cPanel), .env for development
 * 
 * @author KPS Development Team
 * @version 1.0.0
 */

import dotenv from 'dotenv';
import path from 'path';
import { productionConfig } from './production.config';

// Load environment variables (only for development)
dotenv.config();

// Check if we're in production and should use hardcoded config
const useProductionConfig = process.env.NODE_ENV === 'production' || !process.env.NODE_ENV;

// Environment validation (only for development)
if (!useProductionConfig) {
  const requiredEnvVars = [
    'NODE_ENV',
    'PORT',
    'DB_HOST',
    'DB_NAME',
    'DB_USER',
    'JWT_SECRET'
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    console.error(`❌ Missing required environment variables: ${missingVars.join(', ')}`);
    process.exit(1);
  }
}

// Environment configuration object
export const config = useProductionConfig ? productionConfig : {
  // Server configuration
  server: {
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3001', 10),
    host: process.env.HOST || '0.0.0.0',
    name: 'KPS Pest Control API',
    version: process.env.API_VERSION || '1.0.0'
  },

  // Database configuration
  database: {
    host: process.env.DB_HOST!,
    port: parseInt(process.env.DB_PORT || '3306', 10),
    name: process.env.DB_NAME!,
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD || '',
    connectionLimit: 10,
    acquireTimeout: 60000,
    timeout: 60000
  },

  // JWT configuration
  jwt: {
    secret: process.env.JWT_SECRET!,
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
  },

  // Security configuration
  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
    sessionSecret: process.env.SESSION_SECRET || 'dev-session-secret',
    sessionTimeout: process.env.SESSION_TIMEOUT || '24h',
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:3002',
    corsCredentials: process.env.CORS_CREDENTIALS === 'true',
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
    maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5', 10),
    accountLockoutDuration: parseInt(process.env.ACCOUNT_LOCKOUT_DURATION || '1800000', 10)
  },

  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'combined',
    file: process.env.LOG_FILE || './logs/api.log'
  },

  // File upload configuration
  upload: {
    maxSize: parseInt(process.env.UPLOAD_MAX_SIZE || '10485760', 10), // 10MB
    uploadDir: process.env.UPLOAD_DIR || './temp/uploads',
    allowedTypes: (process.env.UPLOAD_ALLOWED_TYPES || 'image/jpeg,image/png,application/pdf').split(',')
  },

  // Email configuration
  email: {
    host: process.env.SMTP_HOST || 'mail.kpspestcontrol.co.za',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || 'mail@kpspestcontrol.co.za',
    password: process.env.SMTP_PASSWORD || '',
    from: process.env.EMAIL_FROM || 'KPS Pest Control <mail@kpspestcontrol.co.za>',
    replyTo: process.env.EMAIL_REPLY_TO || 'mail@kpspestcontrol.co.za'
  },

  // Frontend URL
  frontend: {
    url: process.env.FRONTEND_URL || 'http://localhost:3000'
  },

  // Timezone
  timezone: process.env.TZ || 'Africa/Johannesburg'
};

// Helper functions
export const isDevelopment = (): boolean => config.server.env === 'development';
export const isProduction = (): boolean => config.server.env === 'production';
export const isTest = (): boolean => config.server.env === 'test';

// Log current configuration (without sensitive data)
if (isDevelopment()) {
  console.log('🔧 Environment Configuration:');
  console.log(`   Environment: ${config.server.env}`);
  console.log(`   Port: ${config.server.port}`);
  console.log(`   Database: ${config.database.host}:${config.database.port}/${config.database.name}`);
  console.log(`   CORS Origin: ${config.security.corsOrigin}`);
}