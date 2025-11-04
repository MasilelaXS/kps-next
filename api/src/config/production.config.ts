/**
 * KPS Pest Control API - Production Configuration
 * Hardcoded configuration for cPanel deployment (no .env needed)
 * 
 * @author KPS Development Team
 * @version 1.0.0
 */

export const productionConfig = {
  // Server configuration
  server: {
    env: 'production',
    port: 3001,
    host: '0.0.0.0',
    name: 'KPS Pest Control API',
    version: '1.0.0'
  },

  // Database configuration
  database: {
    host: 'localhost',
    port: 3306,
    name: 'kpspestcontrol_app',
    user: 'kpspestcontrol_admin',
    password: 'Dannel@2024!',
    connectionLimit: 10,
    acquireTimeout: 60000,
    timeout: 60000
  },

  // JWT configuration
  jwt: {
    secret: 'kps-jwt-prod-a8f9d7e6c5b4a3d2e1f0g9h8i7j6k5l4m3n2o1p0q9r8s7t6u5v4w3x2y1z0',
    expiresIn: '24h',
    refreshExpiresIn: '7d'
  },

  // Security configuration
  security: {
    bcryptRounds: 12,
    sessionSecret: 'kps-session-prod-z9y8x7w6v5u4t3s2r1q0p9o8n7m6l5k4j3i2h1g0f9e8d7c6b5a4',
    sessionTimeout: '24h',
    corsOrigin: 'https://my.kpspestcontrol.co.za,https://www.kpspestcontrol.co.za',
    corsCredentials: true,
    rateLimitWindowMs: 900000, // 15 minutes
    rateLimitMaxRequests: 1000,
    maxLoginAttempts: 5,
    accountLockoutDuration: 1800000 // 30 minutes
  },

  // Logging configuration
  logging: {
    level: 'info',
    format: 'combined',
    file: './logs/api.log'
  },

  // File upload configuration
  upload: {
    maxSize: 10485760, // 10MB
    uploadDir: './temp/uploads',
    allowedTypes: ['image/jpeg', 'image/png', 'application/pdf']
  },

  // Email configuration
  email: {
    host: 'mail.kpspestcontrol.co.za',
    port: 587,
    secure: false,
    user: 'mail@kpspestcontrol.co.za',
    password: 'CTECg@5188',
    from: 'KPS Pest Control <mail@kpspestcontrol.co.za>',
    replyTo: 'mail@kpspestcontrol.co.za'
  },

  // Frontend URL
  frontend: {
    url: 'https://my.kpspestcontrol.co.za'
  },

  // Timezone
  timezone: 'Africa/Johannesburg'
};

// Helper functions
export const isDevelopment = (): boolean => productionConfig.server.env === 'development';
export const isProduction = (): boolean => productionConfig.server.env === 'production';
export const isTest = (): boolean => productionConfig.server.env === 'test';
