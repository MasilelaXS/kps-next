/**
 * Offline Storage Health Check & Cleanup System
 * Runs periodic checks and cleanup of offline data
 */

import { offlineCache } from './offlineCache';
import { getOfflineQueueManager } from './offlineSync';
import { storageQuotaManager } from './storageQuotaManager';

const CLEANUP_AGE_DAYS = 30; // Remove successfully synced items older than 30 days
const HEALTH_CHECK_INTERVAL = 60 * 60 * 1000; // Run every hour

class OfflineHealthManager {
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private lastHealthCheck: number = 0;

  /**
   * Initialize health check system
   * Runs immediately and then periodically
   */
  initialize(): void {
    if (typeof window === 'undefined') return;

    console.log('[HealthCheck] Initializing offline storage health check system');
    
    // Run initial health check
    this.runHealthCheck();

    // Schedule periodic health checks
    this.healthCheckTimer = setInterval(() => {
      this.runHealthCheck();
    }, HEALTH_CHECK_INTERVAL);
  }

  /**
   * Run complete health check
   */
  async runHealthCheck(): Promise<void> {
    try {
      console.log('[HealthCheck] Running health check...');
      this.lastHealthCheck = Date.now();

      await Promise.all([
        this.checkStorageQuota(),
        this.cleanupExpiredCache(),
        this.logQueueStatus()
      ]);

      console.log('[HealthCheck] Health check completed');
    } catch (error) {
      console.error('[HealthCheck] Error during health check:', error);
    }
  }

  /**
   * Check localStorage and IndexedDB quota
   */
  private async checkStorageQuota(): Promise<void> {
    try {
      // Use storage quota manager for monitoring
      await storageQuotaManager.monitorStorage();
    } catch (error) {
      console.error('[HealthCheck] Error checking storage quota:', error);
    }
  }

  /**
   * Clean up expired cache entries
   */
  private async cleanupExpiredCache(): Promise<void> {
    try {
      const beforeCount = this.getCacheCount();
      offlineCache.clearExpired();
      const afterCount = this.getCacheCount();
      const removed = beforeCount - afterCount;

      if (removed > 0) {
        console.log(`[HealthCheck] Removed ${removed} expired cache entries`);
      }
    } catch (error) {
      console.error('[HealthCheck] Error cleaning up cache:', error);
    }
  }

  /**
   * Log current queue status
   */
  private async logQueueStatus(): Promise<void> {
    try {
      const manager = getOfflineQueueManager();
      const status = await manager.getStatus();

      console.log('[HealthCheck] Queue status:', {
        online: status.isOnline,
        syncing: status.isSyncing,
        queuedReports: status.queuedReports,
        queuedAssignments: status.queuedAssignments,
        blockedReports: status.blockedReports
      });

      // Warn if too many items queued
      const totalQueued = status.queuedReports + status.queuedAssignments;
      if (totalQueued > 50) {
        console.warn(`[HealthCheck] Large queue detected: ${totalQueued} items`);
      }
    } catch (error) {
      console.error('[HealthCheck] Error checking queue status:', error);
    }
  }

  /**
   * Get count of localStorage cache entries
   */
  private getCacheCount(): number {
    try {
      return Object.keys(localStorage).filter(key => key.startsWith('kps_cache_')).length;
    } catch {
      return 0;
    }
  }

  /**
   * Manual cleanup trigger (for user-initiated cleanup)
   */
  async manualCleanup(): Promise<{ success: boolean; message: string }> {
    try {
      console.log('[HealthCheck] Manual cleanup initiated');
      
      const beforeCache = this.getCacheCount();
      
      // Clear expired cache
      offlineCache.clearExpired();
      
      const afterCache = this.getCacheCount();
      const removedCache = beforeCache - afterCache;
      
      const message = `Removed ${removedCache} expired cache entries`;
      console.log(`[HealthCheck] ${message}`);
      
      return { success: true, message };
    } catch (error) {
      console.error('[HealthCheck] Manual cleanup failed:', error);
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Cleanup failed' 
      };
    }
  }

  /**
   * Get health status report
   */
  async getHealthReport(): Promise<{
    storage: { used: string; total: string; percentUsed: number } | null;
    cache: { entries: number; expired: number };
    queue: {
      reports: number;
      assignments: number;
      blocked: number;
      syncing: boolean;
    };
    lastCheck: Date | null;
  }> {
    try {
      // Storage info from storageQuotaManager
      const storageInfo = await storageQuotaManager.getStorageInfo();
      const storage = {
        used: storageQuotaManager.formatBytes(storageInfo.usage),
        total: storageQuotaManager.formatBytes(storageInfo.quota),
        percentUsed: parseFloat((storageInfo.percentUsed * 100).toFixed(2))
      };

      // Cache info
      const cacheEntries = this.getCacheCount();

      // Queue info
      const manager = getOfflineQueueManager();
      const status = await manager.getStatus();

      return {
        storage,
        cache: {
          entries: cacheEntries,
          expired: 0 // Would need to scan to count
        },
        queue: {
          reports: status.queuedReports,
          assignments: status.queuedAssignments,
          blocked: status.blockedReports,
          syncing: status.isSyncing
        },
        lastCheck: this.lastHealthCheck > 0 ? new Date(this.lastHealthCheck) : null
      };
    } catch (error) {
      console.error('[HealthCheck] Error getting health report:', error);
      throw error;
    }
  }

  /**
   * Cleanup on destroy
   */
  destroy(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
    console.log('[HealthCheck] Destroyed');
  }
}

// Singleton instance
let healthManager: OfflineHealthManager | null = null;

export const getHealthManager = (): OfflineHealthManager => {
  if (!healthManager) {
    healthManager = new OfflineHealthManager();
  }
  return healthManager;
};

// Auto-initialize on import (if in browser)
if (typeof window !== 'undefined') {
  getHealthManager().initialize();
}

export default getHealthManager;
