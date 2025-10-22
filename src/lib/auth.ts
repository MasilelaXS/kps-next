/**
 * Authentication utilities
 */

export interface User {
  id: number;
  pco_number: string;
  name: string;
  email: string;
  role: 'admin' | 'pco' | 'both';
  role_context?: 'admin' | 'pco';
  phone?: string;
}

/**
 * Check if user is authenticated
 */
export const isAuthenticated = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  const token = localStorage.getItem('kps_token');
  const user = localStorage.getItem('kps_user');
  
  return !!(token && user);
};

/**
 * Get current user from localStorage
 */
export const getCurrentUser = (): User | null => {
  if (typeof window === 'undefined') return null;
  
  try {
    const userStr = localStorage.getItem('kps_user');
    if (!userStr) return null;
    
    return JSON.parse(userStr) as User;
  } catch (error) {
    console.error('Error parsing user data:', error);
    return null;
  }
};

/**
 * Get auth token
 */
export const getToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('kps_token');
};

/**
 * Check if token is expired (simple check based on localStorage timestamp)
 */
export const isTokenExpired = (): boolean => {
  if (typeof window === 'undefined') return true;
  
  const loginTime = localStorage.getItem('kps_login_time');
  if (!loginTime) return true;
  
  const loginDate = new Date(loginTime);
  const now = new Date();
  const hoursSinceLogin = (now.getTime() - loginDate.getTime()) / (1000 * 60 * 60);
  
  // Token expires after 24 hours
  return hoursSinceLogin > 24;
};

/**
 * Logout and clear all auth data
 */
export const logout = (): void => {
  if (typeof window === 'undefined') return;
  
  console.log('Logging out and clearing auth data...');
  localStorage.removeItem('kps_token');
  localStorage.removeItem('kps_user');
  localStorage.removeItem('kps_login_time');
  localStorage.removeItem('current_report');
  
  // Force immediate redirect
  window.location.href = '/login';
};

/**
 * Save login data
 */
export const saveLoginData = (token: string, user: User): void => {
  if (typeof window === 'undefined') return;
  
  localStorage.setItem('kps_token', token);
  localStorage.setItem('kps_user', JSON.stringify(user));
  localStorage.setItem('kps_login_time', new Date().toISOString());
};

/**
 * Check authentication and redirect if needed
 * Returns true if authenticated, false if redirected
 */
export const requireAuth = (requiredRole?: 'admin' | 'pco'): boolean => {
  if (typeof window === 'undefined') return false;
  
  if (!isAuthenticated()) {
    console.log('Not authenticated, redirecting to login...');
    logout();
    return false;
  }
  
  if (isTokenExpired()) {
    console.log('Token expired, logging out...');
    logout();
    return false;
  }
  
  if (requiredRole) {
    const user = getCurrentUser();
    if (!user) {
      console.log('No user data found');
      logout();
      return false;
    }
    
    // For dual-role users, check role_context; otherwise check role
    const effectiveRole = user.role === 'both' ? user.role_context : user.role;
    
    if (effectiveRole !== requiredRole) {
      console.log(`Role mismatch: expected ${requiredRole}, got ${effectiveRole} (user.role: ${user.role})`);
      logout();
      return false;
    }
  }
  
  return true;
};
