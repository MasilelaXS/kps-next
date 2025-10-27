// API Configuration
export const API_CONFIG = {
  BASE_URL: process.env.NEXT_PUBLIC_API_URL || 'http://192.168.1.128:3001',
  ENDPOINTS: {
    // Auth
    LOGIN: '/api/auth/login',
    LOGOUT: '/api/auth/logout',
    
    // Admin Dashboard
    ADMIN_STATS: '/api/admin/dashboard/stats',
    
    // PCO Dashboard
    PCO_SUMMARY: '/api/pco/dashboard/summary',
    PCO_RECENT_REPORTS: '/api/pco/dashboard/recent-reports',
    PCO_UPCOMING_ASSIGNMENTS: '/api/pco/dashboard/upcoming-assignments',
    PCO_DECLINED_REPORTS: '/api/pco/dashboard/declined-reports',
    PCO_STATISTICS: '/api/pco/dashboard/statistics',
    
    // Reports
    REPORTS: '/api/reports',
    REPORTS_SEARCH: '/api/reports/search',
    
    // Clients
    CLIENTS: '/api/clients',
    
    // Assignments
    ASSIGNMENTS: '/api/assignments',
    
    // Notifications
    NOTIFICATIONS: '/api/notifications',
    NOTIFICATIONS_MARK_READ: '/api/notifications/:id/read',
    NOTIFICATIONS_MARK_ALL_READ: '/api/notifications/mark-all-read',
    
    // Version
    VERSION: '/api/version/current',
  },
  
  // Request timeout
  TIMEOUT: 30000, // 30 seconds
};

// Helper function to build full URL
export const buildApiUrl = (endpoint: string): string => {
  return `${API_CONFIG.BASE_URL}${endpoint}`;
};

// Helper function to get auth headers
export const getAuthHeaders = (): HeadersInit => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('kps_token') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

// Helper function for API calls
export const apiCall = async (
  endpoint: string,
  options: RequestInit = {}
): Promise<any> => {
  const url = buildApiUrl(endpoint);
  const headers = {
    ...getAuthHeaders(),
    ...options.headers,
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Handle authentication errors
    if (response.status === 401 || response.status === 403) {
      // Clear local storage
      if (typeof window !== 'undefined') {
        console.log('Session expired or unauthorized. Redirecting to login...');
        localStorage.removeItem('kps_token');
        localStorage.removeItem('kps_user');
        localStorage.removeItem('current_report');
        // Use replace to prevent back button issues
        window.location.replace('/login');
      }
      throw new Error('Session expired. Please login again.');
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ 
        message: 'Request failed',
        status: response.status,
        statusText: response.statusText 
      }));
      
      // Don't log expected errors that will be handled (like existing drafts)
      if (!error.existing_draft_id) {
        console.error(`API Error [${response.status}]: ${url}`, error);
      }
      
      // Return the full error object including any additional data like existing_draft_id
      return error;
    }

    return await response.json();
  } catch (error: any) {
    // Enhanced error logging
    console.error(`API call failed: ${url}`, error);
    
    // Check if it's a network error (no response from server)
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Cannot connect to server. Please check if the API is running.');
    }
    
    throw error;
  }
};
