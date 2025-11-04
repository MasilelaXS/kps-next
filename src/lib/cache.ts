/**
 * API Cache with Background Refresh
 * Instantly shows cached data while fetching fresh data in background
 * This eliminates the feeling of slowness for repeated views
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

class ApiCache {
  private cache = new Map<string, CacheEntry<any>>();
  private DEFAULT_TTL = 30000; // 30 seconds
  private MAX_CACHE_SIZE = 100;

  /**
   * Get cached data or fetch fresh
   * Returns cached data INSTANTLY if available, then refreshes in background
   */
  async get<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: { ttl?: number; forceRefresh?: boolean } = {}
  ): Promise<{ data: T; fromCache: boolean }> {
    const now = Date.now();
    const cached = this.cache.get(key);
    const ttl = options.ttl || this.DEFAULT_TTL;

    // Return cached data immediately if valid and not forcing refresh
    if (!options.forceRefresh && cached && cached.expiresAt > now) {
      // Start background refresh if close to expiry (last 10 seconds)
      if (cached.expiresAt - now < 10000) {
        this.backgroundRefresh(key, fetcher, ttl);
      }
      return { data: cached.data, fromCache: true };
    }

    // Fetch fresh data
    const data = await fetcher();
    this.set(key, data, ttl);
    return { data, fromCache: false };
  }

  /**
   * Background refresh - updates cache without blocking
   */
  private async backgroundRefresh<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number
  ): Promise<void> {
    try {
      const data = await fetcher();
      this.set(key, data, ttl);
    } catch (error) {
      console.warn('Background refresh failed:', key, error);
      // Keep old cache on error
    }
  }

  /**
   * Set cache entry
   */
  set<T>(key: string, data: T, ttl: number = this.DEFAULT_TTL): void {
    // Evict oldest if cache is full
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      const oldestKey = Array.from(this.cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)[0][0];
      this.cache.delete(oldestKey);
    }

    const now = Date.now();
    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + ttl,
    });
  }

  /**
   * Invalidate cache entry
   */
  invalidate(keyOrPattern: string | RegExp): void {
    if (typeof keyOrPattern === 'string') {
      this.cache.delete(keyOrPattern);
    } else {
      // Pattern-based invalidation
      const keysToDelete = Array.from(this.cache.keys()).filter(key =>
        keyOrPattern.test(key)
      );
      keysToDelete.forEach(key => this.cache.delete(key));
    }
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache stats
   */
  getStats() {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.entries()).map(([key, entry]) => ({
        key,
        age: Date.now() - entry.timestamp,
        ttl: entry.expiresAt - Date.now(),
      })),
    };
  }
}

// Global cache instance
export const apiCache = new ApiCache();

/**
 * Cached API call with instant response
 */
export async function cachedApiCall<T>(
  endpoint: string,
  fetcher: () => Promise<T>,
  options?: { ttl?: number; forceRefresh?: boolean }
): Promise<T> {
  const cacheKey = `api:${endpoint}`;
  const { data } = await apiCache.get(cacheKey, fetcher, options);
  return data;
}

/**
 * Invalidate cache when data changes
 */
export function invalidateCache(pattern: string | RegExp) {
  apiCache.invalidate(pattern);
}
