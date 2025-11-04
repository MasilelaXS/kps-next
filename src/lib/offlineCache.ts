/**
 * Offline Cache Manager
 * Automatically caches API responses when online for offline access
 */

export interface CachedData<T = any> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

class OfflineCacheManager {
  private readonly CACHE_PREFIX = 'kps_cache_';
  private readonly DEFAULT_TTL = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Save data to cache with expiration
   */
  set<T>(key: string, data: T, ttl: number = this.DEFAULT_TTL): void {
    try {
      const cacheData: CachedData<T> = {
        data,
        timestamp: Date.now(),
        expiresAt: Date.now() + ttl
      };

      localStorage.setItem(
        `${this.CACHE_PREFIX}${key}`,
        JSON.stringify(cacheData)
      );
    } catch (error) {
      console.error('Failed to cache data:', error);
    }
  }

  /**
   * Get data from cache
   * Returns null if not found or expired
   */
  get<T>(key: string): T | null {
    try {
      const cached = localStorage.getItem(`${this.CACHE_PREFIX}${key}`);
      if (!cached) return null;

      const cacheData: CachedData<T> = JSON.parse(cached);

      // Check if expired
      if (Date.now() > cacheData.expiresAt) {
        this.remove(key);
        return null;
      }

      return cacheData.data;
    } catch (error) {
      console.error('Failed to get cached data:', error);
      return null;
    }
  }

  /**
   * Remove specific cache entry
   */
  remove(key: string): void {
    try {
      localStorage.removeItem(`${this.CACHE_PREFIX}${key}`);
    } catch (error) {
      console.error('Failed to remove cache:', error);
    }
  }

  /**
   * Clear all expired cache entries
   */
  clearExpired(): void {
    try {
      const keys = Object.keys(localStorage);
      const now = Date.now();

      keys.forEach(key => {
        if (key.startsWith(this.CACHE_PREFIX)) {
          try {
            const cached = localStorage.getItem(key);
            if (cached) {
              const cacheData: CachedData = JSON.parse(cached);
              if (now > cacheData.expiresAt) {
                localStorage.removeItem(key);
              }
            }
          } catch (error) {
            // Invalid cache entry, remove it
            localStorage.removeItem(key);
          }
        }
      });
    } catch (error) {
      console.error('Failed to clear expired cache:', error);
    }
  }

  /**
   * Clear all cache entries
   */
  clearAll(): void {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(this.CACHE_PREFIX)) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  }

  /**
   * Get cache metadata
   */
  getMetadata(key: string): { timestamp: number; expiresAt: number } | null {
    try {
      const cached = localStorage.getItem(`${this.CACHE_PREFIX}${key}`);
      if (!cached) return null;

      const cacheData: CachedData = JSON.parse(cached);
      return {
        timestamp: cacheData.timestamp,
        expiresAt: cacheData.expiresAt
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if cache entry exists and is valid
   */
  has(key: string): boolean {
    const cached = this.get(key);
    return cached !== null;
  }
}

// Singleton instance
export const offlineCache = new OfflineCacheManager();

/**
 * Higher-order function to wrap API calls with caching
 */
export function withOfflineCache<T>(
  cacheKey: string,
  apiFn: () => Promise<T>,
  ttl?: number
): () => Promise<T> {
  return async () => {
    // Try to get from cache first when offline
    if (!navigator.onLine) {
      const cached = offlineCache.get<T>(cacheKey);
      if (cached !== null) {
        console.log(`Using cached data for ${cacheKey} (offline mode)`);
        return cached;
      }
      throw new Error('No cached data available offline');
    }

    // Online: fetch from API
    try {
      const data = await apiFn();
      // Cache the result
      offlineCache.set(cacheKey, data, ttl);
      return data;
    } catch (error) {
      // If API fails, try cache as fallback
      const cached = offlineCache.get<T>(cacheKey);
      if (cached !== null) {
        console.log(`Using cached data for ${cacheKey} (API failed)`);
        return cached;
      }
      throw error;
    }
  };
}
