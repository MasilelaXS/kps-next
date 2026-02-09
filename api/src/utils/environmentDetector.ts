/**
 * KPS Pest Control - Dynamic Environment Detector
 * 
 * Determines if app is running in development or production based on:
 * - Request hostname (localhost vs app.kpspestcontrol.co.za)
 * - NODE_ENV as fallback
 * 
 * @version 1.0.0
 */

import { Request } from 'express';

/**
 * Environment detection result
 */
export interface EnvironmentInfo {
  isProduction: boolean;
  isDevelopment: boolean;
  hostname: string;
  frontendUrl: string;
  apiUrl: string;
}

/**
 * Detect environment based on request hostname
 * Priority: hostname check > NODE_ENV
 */
export function detectEnvironment(req?: Request): EnvironmentInfo {
  let hostname = '';
  let isProduction = false;
  
  // Try to get hostname from request
  if (req) {
    hostname = req.hostname || req.get('host') || '';
  }
  
  // Determine if production based on hostname
  if (hostname) {
    isProduction = hostname.includes('kpspestcontrol.co.za') || 
                   hostname.includes('app.kpspestcontrol');
  } else {
    // Fallback to NODE_ENV if no request available
    isProduction = process.env.NODE_ENV === 'production';
  }
  
  // Determine URLs based on environment
  const frontendUrl = isProduction 
    ? 'https://app.kpspestcontrol.co.za'
    : 'http://localhost:3000';
    
  const apiUrl = isProduction
    ? 'https://app.kpspestcontrol.co.za'
    : 'http://localhost:3001';
  
  return {
    isProduction,
    isDevelopment: !isProduction,
    hostname: hostname || 'unknown',
    frontendUrl,
    apiUrl
  };
}

/**
 * Get frontend URL based on environment
 * Can be used in email templates, password reset links, etc.
 */
export function getFrontendUrl(req?: Request): string {
  return detectEnvironment(req).frontendUrl;
}

/**
 * Get API URL based on environment
 */
export function getApiUrl(req?: Request): string {
  return detectEnvironment(req).apiUrl;
}

/**
 * Check if currently in production (no request needed)
 */
export function isProductionEnvironment(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Check if currently in development (no request needed)
 */
export function isDevelopmentEnvironment(): boolean {
  return process.env.NODE_ENV !== 'production';
}

/**
 * Get environment info as string for logging
 */
export function getEnvironmentInfo(req?: Request): string {
  const env = detectEnvironment(req);
  return `Environment: ${env.isProduction ? 'PRODUCTION' : 'DEVELOPMENT'} | Hostname: ${env.hostname} | Frontend: ${env.frontendUrl}`;
}
