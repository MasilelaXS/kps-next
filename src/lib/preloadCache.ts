/**
 * Preload Cache Manager
 * Preloads critical data when online to ensure offline availability
 */

import { apiCall } from './api';

interface PreloadConfig {
  endpoint: string;
  priority: 'high' | 'normal' | 'low';
  role?: 'pco' | 'admin' | 'both';
}

// Define critical endpoints to preload
const PRELOAD_ENDPOINTS: PreloadConfig[] = [
  // PCO Endpoints (High Priority)
  { endpoint: '/api/pco/sync/clients?include_contacts=true', priority: 'high', role: 'pco' },
  { endpoint: '/api/pco/dashboard/summary', priority: 'high', role: 'pco' },
  { endpoint: '/api/pco/dashboard/statistics', priority: 'high', role: 'pco' },
  { endpoint: '/api/pco/dashboard/recent-reports', priority: 'normal', role: 'pco' },
  { endpoint: '/api/pco/dashboard/declined-reports', priority: 'normal', role: 'pco' },
  
  // Admin Endpoints (High Priority)
  { endpoint: '/api/admin/dashboard/stats', priority: 'high', role: 'admin' },
  { endpoint: '/api/clients', priority: 'high', role: 'admin' },
  { endpoint: '/api/admin/users', priority: 'normal', role: 'admin' },
  { endpoint: '/api/pco/sync/chemicals', priority: 'normal', role: 'pco' },
  { endpoint: '/api/reports', priority: 'normal', role: 'admin' },
];

class PreloadCacheManager {
  private isPreloading = false;
  private preloadedEndpoints = new Set<string>();
  private readonly PRELOAD_KEY = 'kps_last_preload';
  private readonly PRELOAD_INTERVAL = 60 * 60 * 1000; // 1 hour

  /**
   * Check if we should preload (avoid too frequent preloads)
   */
  private shouldPreload(): boolean {
    const lastPreload = localStorage.getItem(this.PRELOAD_KEY);
    if (!lastPreload) return true;

    const timeSinceLastPreload = Date.now() - parseInt(lastPreload);
    return timeSinceLastPreload > this.PRELOAD_INTERVAL;
  }

  /**
   * Preload all critical data for a specific role
   */
  async preloadForRole(role: 'pco' | 'admin' | 'both'): Promise<void> {
    if (this.isPreloading) {
      console.log('[Preload] Already preloading, skipping...');
      return;
    }

    // Check if we should preload
    if (!this.shouldPreload()) {
      console.log('[Preload] Skipping - preloaded recently');
      return;
    }

    // Check if online
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    if (!isOnline) {
      console.log('[Preload] Skipping - offline');
      return;
    }

    console.log(`[Preload] Starting preload for role: ${role}`);
    this.isPreloading = true;

    try {
      // Filter endpoints by role
      const endpoints = PRELOAD_ENDPOINTS.filter(config => 
        config.role === role || config.role === 'both'
      );

      // Sort by priority
      const sortedEndpoints = endpoints.sort((a, b) => {
        const priorityOrder = { high: 0, normal: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });

      // Preload high priority endpoints first (sequential)
      const highPriority = sortedEndpoints.filter(e => e.priority === 'high');
      for (const config of highPriority) {
        await this.preloadEndpoint(config.endpoint);
      }

      // Preload normal/low priority in parallel
      const normalPriority = sortedEndpoints.filter(e => e.priority !== 'high');
      await Promise.allSettled(
        normalPriority.map(config => this.preloadEndpoint(config.endpoint))
      );

      // Update last preload time
      localStorage.setItem(this.PRELOAD_KEY, Date.now().toString());
      console.log('[Preload] Completed successfully');
    } catch (error) {
      console.error('[Preload] Failed:', error);
    } finally {
      this.isPreloading = false;
    }
  }

  /**
   * Preload a single endpoint
   */
  private async preloadEndpoint(endpoint: string): Promise<void> {
    try {
      // Skip if already preloaded in this session
      if (this.preloadedEndpoints.has(endpoint)) {
        return;
      }

      console.log(`[Preload] Caching: ${endpoint}`);
      await apiCall(endpoint);
      this.preloadedEndpoints.add(endpoint);
      
      // Small delay to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`[Preload] Failed to cache ${endpoint}:`, error);
    }
  }

  /**
   * Force preload regardless of time
   */
  async forcePreload(role: 'pco' | 'admin' | 'both'): Promise<void> {
    localStorage.removeItem(this.PRELOAD_KEY);
    this.preloadedEndpoints.clear();
    await this.preloadForRole(role);
  }

  /**
   * Clear preload tracking
   */
  clearPreloadTracking(): void {
    localStorage.removeItem(this.PRELOAD_KEY);
    this.preloadedEndpoints.clear();
  }

  /**
   * Get preload status
   */
  getStatus(): {
    isPreloading: boolean;
    preloadedCount: number;
    lastPreloadTime: number | null;
  } {
    const lastPreload = localStorage.getItem(this.PRELOAD_KEY);
    return {
      isPreloading: this.isPreloading,
      preloadedCount: this.preloadedEndpoints.size,
      lastPreloadTime: lastPreload ? parseInt(lastPreload) : null,
    };
  }
}

// Singleton instance
export const preloadCache = new PreloadCacheManager();

/**
 * Hook to trigger preload on mount (use in layout components)
 */
export function usePreloadCache(role: 'pco' | 'admin' | 'both') {
  if (typeof window !== 'undefined') {
    // Trigger preload in the background
    setTimeout(() => {
      preloadCache.preloadForRole(role);
    }, 1000); // Wait 1 second after mount
  }
}
