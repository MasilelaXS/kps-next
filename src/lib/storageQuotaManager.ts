/**
 * Storage Quota Management
 * Manages storage space and handles quota exceeded errors gracefully
 */

import { imageCompression } from './imageCompression';
import { offlineCache } from './offlineCache';

export interface StorageInfo {
  usage: number;
  quota: number;
  available: number;
  percentUsed: number;
  isLow: boolean; // > 80%
  isCritical: boolean; // > 95%
}

export interface CleanupResult {
  success: boolean;
  freedBytes: number;
  message: string;
  actions: string[];
}

class StorageQuotaManager {
  private readonly LOW_STORAGE_THRESHOLD = 0.80; // 80%
  private readonly CRITICAL_STORAGE_THRESHOLD = 0.95; // 95%
  private readonly EMERGENCY_STORAGE_THRESHOLD = 0.98; // 98%

  /**
   * Get current storage information
   */
  async getStorageInfo(): Promise<StorageInfo> {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        const usage = estimate.usage || 0;
        const quota = estimate.quota || 0;
        const available = quota - usage;
        const percentUsed = quota > 0 ? usage / quota : 0;

        return {
          usage,
          quota,
          available,
          percentUsed,
          isLow: percentUsed > this.LOW_STORAGE_THRESHOLD,
          isCritical: percentUsed > this.CRITICAL_STORAGE_THRESHOLD
        };
      } else {
        // Fallback for older browsers
        return {
          usage: 0,
          quota: 0,
          available: 0,
          percentUsed: 0,
          isLow: false,
          isCritical: false
        };
      }
    } catch (error) {
      console.error('[StorageQuota] Failed to get storage info:', error);
      throw error;
    }
  }

  /**
   * Check if there's enough storage space
   */
  async hasSpace(requiredBytes: number): Promise<boolean> {
    try {
      const info = await this.getStorageInfo();
      return info.available >= requiredBytes;
    } catch (error) {
      console.error('[StorageQuota] Failed to check storage space:', error);
      return true; // Optimistic fallback
    }
  }

  /**
   * Handle quota exceeded error
   * Attempts to free up space automatically
   */
  async handleQuotaExceeded(): Promise<CleanupResult> {
    console.warn('[StorageQuota] Quota exceeded, attempting cleanup...');
    
    const actions: string[] = [];
    let totalFreed = 0;

    try {
      // Step 1: Clear expired cache
      const beforeCache = this.getLocalStorageSize();
      offlineCache.clearExpired();
      const afterCache = this.getLocalStorageSize();
      const freedFromCache = beforeCache - afterCache;
      
      if (freedFromCache > 0) {
        actions.push(`Cleared ${this.formatBytes(freedFromCache)} expired cache`);
        totalFreed += freedFromCache;
      }

      // Step 2: Remove old successful queue items (if we have access)
      try {
        const freedFromQueue = await this.cleanupOldQueueItems();
        if (freedFromQueue > 0) {
          actions.push(`Removed old queue items (${this.formatBytes(freedFromQueue)})`);
          totalFreed += freedFromQueue;
        }
      } catch (error) {
        console.warn('[StorageQuota] Could not cleanup queue:', error);
      }

      // Step 3: Compress large localStorage items
      const freedFromCompression = await this.compressLargeItems();
      if (freedFromCompression > 0) {
        actions.push(`Compressed large items (${this.formatBytes(freedFromCompression)})`);
        totalFreed += freedFromCompression;
      }

      const info = await this.getStorageInfo();
      const success = !info.isCritical;

      return {
        success,
        freedBytes: totalFreed,
        message: success 
          ? `Freed ${this.formatBytes(totalFreed)} of storage space`
          : 'Storage critically low despite cleanup',
        actions
      };
    } catch (error) {
      console.error('[StorageQuota] Cleanup failed:', error);
      return {
        success: false,
        freedBytes: totalFreed,
        message: error instanceof Error ? error.message : 'Cleanup failed',
        actions
      };
    }
  }

  /**
   * Proactive cleanup when storage is low
   */
  async ensureSpace(requiredBytes: number): Promise<boolean> {
    const info = await this.getStorageInfo();
    
    // If we have enough space, do nothing
    if (info.available >= requiredBytes) {
      return true;
    }

    // If storage is critically low, run aggressive cleanup
    if (info.isCritical || info.available < requiredBytes) {
      console.warn('[StorageQuota] Low storage, running cleanup...');
      const result = await this.handleQuotaExceeded();
      
      // Check again after cleanup
      const newInfo = await this.getStorageInfo();
      return newInfo.available >= requiredBytes;
    }

    return false;
  }

  /**
   * Compress large items in localStorage
   */
  private async compressLargeItems(): Promise<number> {
    let totalFreed = 0;

    try {
      const keys = Object.keys(localStorage);
      
      for (const key of keys) {
        // Skip critical keys
        if (key === 'kps_token' || key === 'kps_user') {
          continue;
        }

        try {
          const value = localStorage.getItem(key);
          if (!value) continue;

          const currentSize = this.estimateSize(value);
          
          // Only compress items larger than 50KB
          if (currentSize < 50 * 1024) continue;

          // Check if it's JSON data we can compress
          try {
            const data = JSON.parse(value);
            
            // If it contains base64 images, try to compress them
            if (this.containsBase64Images(data)) {
              const compressed = await this.compressBase64Images(data);
              const newValue = JSON.stringify(compressed);
              const newSize = this.estimateSize(newValue);
              
              if (newSize < currentSize) {
                localStorage.setItem(key, newValue);
                const freed = currentSize - newSize;
                totalFreed += freed;
                console.log(`[StorageQuota] Compressed ${key}: ${this.formatBytes(freed)} freed`);
              }
            }
          } catch {
            // Not JSON, skip
          }
        } catch (error) {
          console.warn(`[StorageQuota] Failed to compress ${key}:`, error);
        }
      }
    } catch (error) {
      console.error('[StorageQuota] Compression failed:', error);
    }

    return totalFreed;
  }

  /**
   * Clean up old queue items from IndexedDB
   */
  private async cleanupOldQueueItems(): Promise<number> {
    // This would require access to IndexedDB
    // For now, return 0 as this is handled by offlineHealthCheck
    return 0;
  }

  /**
   * Check if object contains base64 images
   */
  private containsBase64Images(obj: any): boolean {
    if (typeof obj === 'string') {
      return obj.startsWith('data:image/');
    }
    
    if (Array.isArray(obj)) {
      return obj.some(item => this.containsBase64Images(item));
    }
    
    if (obj && typeof obj === 'object') {
      return Object.values(obj).some(value => this.containsBase64Images(value));
    }
    
    return false;
  }

  /**
   * Recursively compress base64 images in object
   */
  private async compressBase64Images(obj: any): Promise<any> {
    if (typeof obj === 'string' && obj.startsWith('data:image/')) {
      try {
        // Only compress if not already compressed (ratio check)
        if (imageCompression.shouldCompress(obj, 100)) {
          const result = await imageCompression.compressDataUrl(obj, {
            maxWidth: 1280,
            maxHeight: 960,
            quality: 0.75
          });
          return result.dataUrl;
        }
      } catch (error) {
        console.warn('[StorageQuota] Failed to compress image:', error);
      }
      return obj;
    }
    
    if (Array.isArray(obj)) {
      return Promise.all(obj.map(item => this.compressBase64Images(item)));
    }
    
    if (obj && typeof obj === 'object') {
      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = await this.compressBase64Images(value);
      }
      return result;
    }
    
    return obj;
  }

  /**
   * Get approximate localStorage size
   */
  private getLocalStorageSize(): number {
    let total = 0;
    for (const key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        const value = localStorage.getItem(key);
        if (value) {
          total += this.estimateSize(value);
        }
      }
    }
    return total;
  }

  /**
   * Estimate size of a string in bytes
   */
  private estimateSize(str: string): number {
    // Each character is ~2 bytes (UTF-16)
    return str.length * 2;
  }

  /**
   * Format bytes for display
   */
  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  }

  /**
   * Monitor storage and auto-cleanup if needed
   */
  async monitorStorage(): Promise<void> {
    try {
      const info = await this.getStorageInfo();
      
      console.log('[StorageQuota] Current usage:', {
        used: this.formatBytes(info.usage),
        total: this.formatBytes(info.quota),
        percentUsed: `${(info.percentUsed * 100).toFixed(2)}%`
      });

      if (info.percentUsed > this.EMERGENCY_STORAGE_THRESHOLD) {
        console.error('[StorageQuota] EMERGENCY: Storage critically low!');
        await this.handleQuotaExceeded();
      } else if (info.isCritical) {
        console.warn('[StorageQuota] WARNING: Storage critically low');
        await this.handleQuotaExceeded();
      } else if (info.isLow) {
        console.warn('[StorageQuota] Storage running low');
      }
    } catch (error) {
      console.error('[StorageQuota] Monitor failed:', error);
    }
  }

  /**
   * Request persistent storage (prevents browser from evicting data)
   */
  async requestPersistentStorage(): Promise<boolean> {
    if ('storage' in navigator && 'persist' in navigator.storage) {
      try {
        const isPersisted = await navigator.storage.persist();
        console.log('[StorageQuota] Persistent storage:', isPersisted ? 'granted' : 'denied');
        return isPersisted;
      } catch (error) {
        console.error('[StorageQuota] Failed to request persistent storage:', error);
        return false;
      }
    }
    return false;
  }
}

// Export singleton
export const storageQuotaManager = new StorageQuotaManager();
