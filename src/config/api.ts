/**
 * API Configuration
 * Centralized API base URL configuration for easy production deployment
 */

// Check if we're in production or development
const isProduction = process.env.NODE_ENV === 'production';

// API Base URLs
export const API_CONFIG = {
  // Backend API base URL
  BASE_URL: process.env.NEXT_PUBLIC_API_URL || 'http://192.168.1.128:3001',
  
  // API endpoints
  ENDPOINTS: {
    // Auth
    LOGIN: '/api/auth/login',
    REGISTER: '/api/auth/register',
    FORGOT_PASSWORD: '/api/auth/forgot-password',
    RESET_PASSWORD: '/api/auth/reset-password',
    VERIFY_TOKEN: '/api/auth/verify-token',
    
    // Admin
    ADMIN_DASHBOARD: '/api/admin/dashboard',
    ADMIN_USERS: '/api/admin/users',
    ADMIN_CLIENTS: '/api/admin/clients',
    ADMIN_REPORTS: '/api/admin/reports',
    ADMIN_CHEMICALS: '/api/admin/chemicals',
    ADMIN_SCHEDULE: '/api/admin/schedule',
    
    // PCO
    PCO_DASHBOARD: '/api/pco/dashboard',
    PCO_REPORTS: '/api/pco/reports',
    PCO_SCHEDULE: '/api/pco/schedule',
    PCO_PROFILE: '/api/pco/profile',
    
    // Reports
    REPORTS: '/api/reports',
    BAIT_STATIONS: '/api/bait-stations',
    FUMIGATION: '/api/fumigation',
    INSECT_MONITORS: '/api/insect-monitors',
  },
  
  // Request timeout (ms)
  TIMEOUT: 30000,
  
  // Retry configuration
  RETRY: {
    MAX_RETRIES: 3,
    DELAY: 1000, // ms
  }
} as const;

/**
 * Get full API URL
 */
export const getApiUrl = (endpoint: string): string => {
  return `${API_CONFIG.BASE_URL}${endpoint}`;
};

/**
 * Get authorization header
 */
export const getAuthHeader = (): Record<string, string> => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('kps_token') : null;
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

/**
 * Default fetch options
 */
export const getDefaultHeaders = (): HeadersInit => ({
  'Content-Type': 'application/json',
  ...getAuthHeader(),
});

/**
 * Enhanced fetch with timeout and error handling
 */
export const apiFetch = async (
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);

  try {
    const response = await fetch(getApiUrl(endpoint), {
      ...options,
      headers: {
        ...getDefaultHeaders(),
        ...options.headers,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timeout - please check your connection');
    }
    throw error;
  }
};

export default API_CONFIG;
