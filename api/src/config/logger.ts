/**
 * KPS Pest Control Management System - Logging Utility
 * 
 * Winston-based logging with structured format and multiple transports
 * 
 * @author KPS Development Team
 * @version 1.0.0
 */

import winston from 'winston';
import { config } from './env';

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
    return JSON.stringify({
      timestamp,
      level,
      message,
      service: service || config.server.name,
      ...meta
    });
  })
);

// Create logger instance
export const logger = winston.createLogger({
  level: config.logging.level,
  format: logFormat,
  defaultMeta: {
    service: config.server.name,
    version: config.server.version
  },
  transports: [
    // Console transport for development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
          return `${timestamp} ${level}: ${message} ${metaStr}`;
        })
      )
    })
  ]
});

// Add file transport for production
if (config.server.env === 'production') {
  logger.add(new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error'
  }));
  
  logger.add(new winston.transports.File({
    filename: 'logs/combined.log'
  }));
}

/**
 * Log HTTP requests
 */
export const logRequest = (
  req: any,
  res: any,
  duration: number
): void => {
  logger.info('HTTP Request', {
    method: req.method,
    url: req.originalUrl || req.url,
    status: res.statusCode,
    duration: `${duration}ms`,
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress,
    userId: req.user?.id
  });
};

/**
 * Log authentication events
 */
export const logAuth = (
  event: string,
  userId: number | string,
  details: Record<string, any> = {}
): void => {
  logger.info('Authentication Event', {
    event,
    userId,
    ...details
  });
};

/**
 * Log database operations
 */
export const logDatabase = (
  operation: string,
  table: string,
  duration?: number,
  details: Record<string, any> = {}
): void => {
  logger.debug('Database Operation', {
    operation,
    table,
    duration: duration ? `${duration}ms` : undefined,
    ...details
  });
};

export default logger;