// API Configuration
export const API_CONFIG = {
  BASE_URL: process.env.NEXT_PUBLIC_API_URL || 'https://app.kpspestcontrol.co.za',
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
    REPORTS: '/api/admin/reports',
    REPORTS_SEARCH: '/api/admin/reports/search',
    
    // Clients
    CLIENTS: '/api/admin/clients',
    
    // Assignments
    ASSIGNMENTS: '/api/admin/assignments',
    
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

// Helper function for API calls with automatic caching
export const apiCall = async (
  endpoint: string,
  options: RequestInit & { skipCache?: boolean } = {}
): Promise<any> => {
  const url = buildApiUrl(endpoint);
  const headers = {
    ...getAuthHeaders(),
    ...options.headers,
  };
  const method = options.method || 'GET';
  const isGet = method === 'GET';
  const cacheKey = `api_${endpoint}`;

  // For GET requests, try cache first if offline
  if (isGet && !options.skipCache) {
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    
    if (!isOnline) {
      // Try to get from cache when offline
      if (typeof window !== 'undefined') {
        const { offlineCache } = await import('./offlineCache');
        const cached = offlineCache.get(cacheKey);
        
        if (cached !== null) {
          console.log(`[API] Using cached data for ${endpoint} (offline)`);
          return cached;
        } else {
          console.log(`[API] No cached data available for ${endpoint}`);
          throw new Error('No cached data available. Please go online to load data.');
        }
      }
    }
  }

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

    const data = await response.json();

    // Cache GET requests automatically when online
    if (isGet && !options.skipCache && typeof window !== 'undefined') {
      const { offlineCache } = await import('./offlineCache');
      offlineCache.set(cacheKey, data);
      console.log(`[API] Cached response for ${endpoint}`);
    }

    return data;
  } catch (error: any) {
    // Enhanced error logging
    console.error(`API call failed: ${url}`, error);
    
    // Check if it's a network error (no response from server)
    if (error instanceof TypeError && error.message.includes('fetch')) {
      // Try cache as fallback for GET requests
      if (isGet && !options.skipCache && typeof window !== 'undefined') {
        const { offlineCache } = await import('./offlineCache');
        const cached = offlineCache.get(cacheKey);
        
        if (cached !== null) {
          console.log(`[API] Using cached data for ${endpoint} (network error)`);
          return cached;
        }
      }
      
      // Re-throw the original error so offlineAwareApiCall can handle it
      // Don't throw a generic message - let the calling function decide what to do
      throw error;
    }
    
    throw error;
  }
};

/**
 * Offline-aware API call for report submissions
 * Queues reports when offline using IndexedDB and syncs when connection is restored
 */
export const offlineAwareApiCall = async (
  endpoint: string,
  options: RequestInit & {
    queueIfOffline?: boolean;
    priority?: 'high' | 'normal' | 'low';
    type?: 'report' | 'signature' | 'profile' | 'other';
  } = {}
): Promise<any> => {
  const method = (options.method || 'GET').toUpperCase();
  const isReportSubmission = options.type === 'report' && (method === 'POST' || method === 'PUT');
  const shouldQueue = options.queueIfOffline !== false && isReportSubmission;

  // Check if we're offline
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  
  // If offline and should queue, queue the report immediately
  if (!isOnline && shouldQueue) {
    console.log('[API] Offline detected - queuing report');
    if (typeof window !== 'undefined') {
      const { getOfflineReportManager } = await import('./offlineSync');
      const manager = getOfflineReportManager();
      
      const body = typeof options.body === 'string' ? JSON.parse(options.body) : options.body;
      const reportId = await manager.queueReport(endpoint, method as 'POST' | 'PUT', body);
      
      return {
        success: true,
        queued: true,
        message: 'Report queued for submission when online',
        reportId
      };
    }
  }

  // Try to make the request
  if (shouldQueue) {
    try {
      const result = await apiCall(endpoint, options);
      return result;
    } catch (error: any) {
      // Check if it's a network error
      const errorMessage = error.message || '';
      const isNetworkError = 
        error instanceof TypeError ||
        errorMessage.includes('fetch') ||
        errorMessage.includes('network') ||
        errorMessage.includes('Failed to fetch') ||
        errorMessage.includes('NetworkError') ||
        errorMessage.includes('timeout');

      if (isNetworkError && typeof window !== 'undefined') {
        console.log('[API] Network error - queuing report');
        const { getOfflineReportManager } = await import('./offlineSync');
        const manager = getOfflineReportManager();
        
        const body = typeof options.body === 'string' ? JSON.parse(options.body) : options.body;
        const reportId = await manager.queueReport(endpoint, method as 'POST' | 'PUT', body);
        
        return {
          success: true,
          queued: true,
          message: 'Network error - report queued for submission',
          reportId
        };
      }

      // Not a network error - re-throw
      throw error;
    }
  }

  // For non-report requests, just call normally
  return apiCall(endpoint, options);
};
