/**
 * Production-Ready Offline Report Queue System
 * Uses IndexedDB for reliable offline report storage and automatic syncing
 */

import { buildApiUrl } from './api';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface QueuedItem {
  id: string;
  type: 'report' | 'assignment';
  endpoint: string;
  method: 'POST' | 'PUT';
  payload: any;
  timestamp: number;
  lastAttemptTime: number | null;
  attemptCount: number;
  status: 'pending' | 'syncing' | 'failed' | 'blocked';
  error?: string;
  blockReason?: string; // For reports blocked by assignment issues
}

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  queuedReports: number;
  queuedAssignments: number;
  blockedReports: number;
  lastSyncTime: number | null;
  nextRetryTime: number | null;
}

// Exponential backoff intervals (ms): 5s, 15s, 30s, 1m, 5m, 15m, 30m, 1h, 2h (cap)
const RETRY_INTERVALS = [
  5 * 1000,      // 5 seconds
  15 * 1000,     // 15 seconds
  30 * 1000,     // 30 seconds
  60 * 1000,     // 1 minute
  5 * 60 * 1000,   // 5 minutes
  15 * 60 * 1000,  // 15 minutes
  30 * 60 * 1000,  // 30 minutes
  60 * 60 * 1000,  // 1 hour
  2 * 60 * 60 * 1000  // 2 hours (cap)
];

function getRetryDelay(attemptCount: number): number {
  const index = Math.min(attemptCount, RETRY_INTERVALS.length - 1);
  return RETRY_INTERVALS[index];
}

// ============================================================================
// INDEXEDDB SETUP
// ============================================================================

const DB_NAME = 'KPSOfflineQueue';
const DB_VERSION = 2;
const QUEUE_STORE_NAME = 'offlineQueue';

class OfflineQueueManager {
  private db: IDBDatabase | null = null;
  private isOnline: boolean = true;
  private isSyncing: boolean = false;
  private listeners: Set<(status: SyncStatus) => void> = new Set();
  private onlineHandler: () => void;
  private offlineHandler: () => void;
  private syncTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.onlineHandler = () => this.handleOnline();
    this.offlineHandler = () => this.handleOffline();
    this.initialize();
  }

  /**
   * Initialize IndexedDB and event listeners
   */
  private async initialize(): Promise<void> {
    if (typeof window === 'undefined') return;

    try {
      // Initialize IndexedDB
      await this.initDB();

      // Set initial online status
      this.isOnline = navigator.onLine;

      // Add event listeners for online/offline
      window.addEventListener('online', this.onlineHandler);
      window.addEventListener('offline', this.offlineHandler);

      // If online and has queued items, sync them
      if (this.isOnline) {
        const status = await this.getStatus();
        const totalQueued = status.queuedReports + status.queuedAssignments;
        if (totalQueued > 0) {
          console.log(`[OfflineQueue] Found ${totalQueued} queued items (${status.queuedAssignments} assignments, ${status.queuedReports} reports), starting sync...`);
          setTimeout(() => this.syncAll(), 2000);
        }
      }

      // Schedule periodic retry checks
      this.scheduleNextRetry();

      console.log('[OfflineQueue] Initialized successfully');
    } catch (error) {
      console.error('[OfflineReports] Initialization failed:', error);
    }
  }

  /**
   * Initialize IndexedDB
   */
  private initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('[OfflineReports] IndexedDB error:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('[OfflineReports] IndexedDB opened successfully');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const oldVersion = event.oldVersion;
        
        // Migration from v1 to v2
        if (oldVersion < 2) {
          // Remove old store if exists
          if (db.objectStoreNames.contains('reportQueue')) {
            db.deleteObjectStore('reportQueue');
          }
          
          // Create new unified queue store
          if (!db.objectStoreNames.contains(QUEUE_STORE_NAME)) {
            const store = db.createObjectStore(QUEUE_STORE_NAME, { keyPath: 'id' });
            store.createIndex('type', 'type', { unique: false });
            store.createIndex('timestamp', 'timestamp', { unique: false });
            store.createIndex('status', 'status', { unique: false });
            store.createIndex('lastAttemptTime', 'lastAttemptTime', { unique: false });
            console.log('[OfflineQueue] Unified queue store created');
          }
        }
      };
    });
  }

  /**
   * Ensure DB is initialized (with retry logic)
   */
  private async ensureDB(): Promise<void> {
    if (this.db) return;

    // Wait for initialization (max 5 seconds)
    const startTime = Date.now();
    while (!this.db && Date.now() - startTime < 5000) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (!this.db) {
      // Try initializing again
      await this.initDB();
    }

    if (!this.db) {
      throw new Error('IndexedDB not initialized after retry');
    }
  }

  /**
   * Queue an item (report or assignment) for offline submission
   */
  public async queueItem(
    type: 'report' | 'assignment',
    endpoint: string,
    method: 'POST' | 'PUT',
    payload: any
  ): Promise<string> {
    await this.ensureDB();

    const item: QueuedItem = {
      id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      endpoint,
      method,
      payload,
      timestamp: Date.now(),
      lastAttemptTime: null,
      attemptCount: 0,
      status: 'pending'
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([QUEUE_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(QUEUE_STORE_NAME);
      const request = store.add(item);

      request.onsuccess = () => {
        console.log(`[OfflineQueue] ${type} queued: ${item.id}`);
        this.notifyListeners();
        resolve(item.id);
      };

      request.onerror = () => {
        console.error(`[OfflineQueue] Failed to queue ${type}:`, request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Backward compatibility wrapper for reports
   */
  public async queueReport(endpoint: string, method: 'POST' | 'PUT', payload: any): Promise<string> {
    return this.queueItem('report', endpoint, method, payload);
  }

  /**
   * Queue assignment for offline submission
   */
  public async queueAssignment(endpoint: string, method: 'POST' | 'PUT', payload: any): Promise<string> {
    return this.queueItem('assignment', endpoint, method, payload);
  }

  /**
   * Get all queued items, optionally filtered by type
   */
  public async getQueuedItems(type?: 'report' | 'assignment'): Promise<QueuedItem[]> {
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([QUEUE_STORE_NAME], 'readonly');
      const store = transaction.objectStore(QUEUE_STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        let items = request.result as QueuedItem[];
        
        // Filter by type if specified
        if (type) {
          items = items.filter(item => item.type === type);
        }
        
        resolve(items.sort((a, b) => a.timestamp - b.timestamp));
      };

      request.onerror = () => {
        console.error('[OfflineQueue] Failed to get queued items:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Backward compatibility wrapper
   */
  public async getQueuedReports(): Promise<QueuedItem[]> {
    return this.getQueuedItems('report');
  }

  /**
   * Get count of queued items by type
   */
  public async getQueuedCount(type?: 'report' | 'assignment'): Promise<number> {
    if (!this.db) return 0;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([QUEUE_STORE_NAME], 'readonly');
      const store = transaction.objectStore(QUEUE_STORE_NAME);
      
      if (type) {
        const index = store.index('type');
        const request = index.count(type);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => {
          console.error('[OfflineQueue] Failed to get count:', request.error);
          reject(request.error);
        };
      } else {
        const request = store.count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => {
          console.error('[OfflineQueue] Failed to get count:', request.error);
          reject(request.error);
        };
      }
    });
  }

  /**
   * Update an item in the queue
   */
  private async updateItem(item: QueuedItem): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([QUEUE_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(QUEUE_STORE_NAME);
      const request = store.put(item);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete an item from the queue
   */
  private async deleteItem(id: string): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([QUEUE_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(QUEUE_STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => {
        console.log(`[OfflineQueue] Item deleted: ${id}`);
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Sync all queued items (assignments first, then reports)
   */
  public async syncAll(): Promise<{ assignments: { success: number; failed: number; blocked: number }; reports: { success: number; failed: number; blocked: number } }> {
    if (!this.isOnline) {
      console.log('[OfflineQueue] Cannot sync - offline');
      return { 
        assignments: { success: 0, failed: 0, blocked: 0 },
        reports: { success: 0, failed: 0, blocked: 0 }
      };
    }

    if (this.isSyncing) {
      console.log('[OfflineQueue] Sync already in progress');
      return { 
        assignments: { success: 0, failed: 0, blocked: 0 },
        reports: { success: 0, failed: 0, blocked: 0 }
      };
    }

    this.isSyncing = true;
    this.notifyListeners();

    // Sync assignments first (priority)
    const assignmentResults = await this.syncItemsByType('assignment');
    
    // Small delay between batches
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Then sync reports (validate against fresh assignments)
    const reportResults = await this.syncItemsByType('report');

    this.isSyncing = false;
    this.notifyListeners();
    
    // Schedule next retry check
    this.scheduleNextRetry();

    console.log(`[OfflineQueue] Sync completed:`, {
      assignments: assignmentResults,
      reports: reportResults
    });

    return { assignments: assignmentResults, reports: reportResults };
  }

  /**
   * Sync items of a specific type
   */
  private async syncItemsByType(type: 'report' | 'assignment'): Promise<{ success: number; failed: number; blocked: number }> {
    const items = await this.getQueuedItems(type);
    const results = { success: 0, failed: 0, blocked: 0 };
    const now = Date.now();

    console.log(`[OfflineQueue] Starting sync of ${items.length} ${type}s`);

    for (const item of items) {
      // Skip if not ready for retry yet (exponential backoff)
      if (item.lastAttemptTime && item.attemptCount > 0) {
        const nextRetryTime = item.lastAttemptTime + getRetryDelay(item.attemptCount - 1);
        if (now < nextRetryTime) {
          console.log(`[OfflineQueue] ${item.id} not ready for retry (next attempt in ${Math.round((nextRetryTime - now) / 1000)}s)`);
          continue;
        }
      }

      // Skip blocked items
      if (item.status === 'blocked') {
        results.blocked++;
        continue;
      }

      // Update status to syncing
      item.status = 'syncing';
      item.lastAttemptTime = now;
      item.attemptCount++;
      await this.updateItem(item);

      // Attempt to submit
      const result = await this.submitItem(item);

      if (result.success) {
        await this.deleteItem(item.id);
        results.success++;
        console.log(`[OfflineQueue] ✓ Successfully synced ${item.type} ${item.id} (attempt ${item.attemptCount})`);
      } else if (result.blocked) {
        // Report blocked due to assignment conflict
        item.status = 'blocked';
        item.blockReason = result.blockReason;
        await this.updateItem(item);
        results.blocked++;
        console.warn(`[OfflineQueue] ⚠ ${item.type} ${item.id} blocked: ${result.blockReason}`);
      } else {
        // Failed - will retry with exponential backoff
        item.status = 'failed';
        item.error = result.error || 'Submission failed';
        await this.updateItem(item);
        results.failed++;
        const nextDelay = getRetryDelay(item.attemptCount - 1);
        console.error(`[OfflineQueue] ✗ Failed to sync ${item.type} ${item.id} (attempt ${item.attemptCount}, retry in ${Math.round(nextDelay / 1000)}s)`);
      }

      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return results;
  }

  /**
   * Backward compatibility wrapper
   */
  public async syncReports(): Promise<{ success: number; failed: number }> {
    const result = await this.syncAll();
    return { 
      success: result.reports.success, 
      failed: result.reports.failed + result.reports.blocked 
    };
  }

  /**
   * Submit a single item to the server
   */
  private async submitItem(item: QueuedItem): Promise<{ success: boolean; blocked?: boolean; blockReason?: string; error?: string }> {
    try {
      const token = localStorage.getItem('kps_token');
      if (!token) {
        console.error('[OfflineQueue] No auth token found');
        return { success: false, error: 'No authentication token' };
      }

      const response = await fetch(buildApiUrl(item.endpoint), {
        method: item.method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(item.payload)
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`[OfflineQueue] ${item.type} submitted successfully:`, data);
        return { success: true };
      } else if (response.status === 401) {
        console.error('[OfflineQueue] Authentication failed');
        return { success: false, error: 'Authentication failed' };
      } else if (response.status === 403) {
        // For reports: PCO not assigned to client (block until reassigned)
        const error = await response.json().catch(() => ({ message: 'Forbidden' }));
        if (item.type === 'report' && error.message?.includes('not assigned')) {
          return { 
            success: false, 
            blocked: true, 
            blockReason: 'Not assigned to client' 
          };
        }
        return { success: false, error: error.message || 'Forbidden' };
      } else if (response.status === 400) {
        const error = await response.json().catch(() => ({ message: 'Bad request' }));
        
        // For assignments: Already assigned (treat as success - idempotent)
        if (item.type === 'assignment' && error.message?.includes('already assigned')) {
          console.log(`[OfflineQueue] Assignment already exists, treating as success`);
          return { success: true };
        }
        
        return { success: false, error: error.message || 'Bad request' };
      } else {
        const error = await response.json().catch(() => ({ message: 'Unknown error' }));
        console.error('[OfflineQueue] Submission failed:', error);
        return { success: false, error: error.message || `HTTP ${response.status}` };
      }
    } catch (error) {
      console.error('[OfflineQueue] Network error during submission:', error);
      // Network error means we're actually offline
      this.isOnline = false;
      return { success: false, error: 'Network error' };
    }
  }

  /**
   * Backward compatibility wrapper
   */
  private async submitReport(report: QueuedItem): Promise<boolean> {
    const result = await this.submitItem(report);
    return result.success;
  }

  /**
   * Schedule next automatic retry check
   */
  private scheduleNextRetry(): void {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
      this.syncTimer = null;
    }

    if (!this.isOnline || this.isSyncing) return;

    // Check for items ready to retry
    this.getQueuedItems().then(items => {
      if (items.length === 0) return;

      const now = Date.now();
      let nextRetryTime = Infinity;

      for (const item of items) {
        if (item.status === 'blocked') continue; // Skip blocked items
        
        if (item.lastAttemptTime && item.attemptCount > 0) {
          const itemNextRetry = item.lastAttemptTime + getRetryDelay(item.attemptCount - 1);
          nextRetryTime = Math.min(nextRetryTime, itemNextRetry);
        } else {
          // Never attempted - retry immediately
          nextRetryTime = now;
        }
      }

      if (nextRetryTime !== Infinity) {
        const delay = Math.max(0, nextRetryTime - now);
        console.log(`[OfflineQueue] Next retry scheduled in ${Math.round(delay / 1000)}s`);
        
        this.syncTimer = setTimeout(() => {
          this.syncAll();
        }, delay);
      }
    });
  }

  /**
   * Handle online event
   */
  private async handleOnline(): Promise<void> {
    console.log('[OfflineQueue] Online event detected, verifying connectivity...');
    
    // Verify we're actually online by trying to reach the server
    const actuallyOnline = await this.checkConnectivity();
    
    if (!actuallyOnline) {
      console.log('[OfflineQueue] False positive - still offline');
      this.isOnline = false;
      this.notifyListeners();
      return;
    }

    console.log('[OfflineQueue] Connection confirmed');
    this.isOnline = true;
    this.notifyListeners();

    // Trigger sync after a short delay
    setTimeout(async () => {
      const status = await this.getStatus();
      const totalQueued = status.queuedReports + status.queuedAssignments;
      if (totalQueued > 0 && this.isOnline) {
        console.log(`[OfflineQueue] Auto-syncing ${totalQueued} queued items`);
        await this.syncAll();
      }
    }, 2000);
  }

  /**
   * Check if we actually have connectivity by trying to reach the API
   */
  private async checkConnectivity(): Promise<boolean> {
    try {
      const response = await fetch(buildApiUrl('/api/health'), {
        method: 'GET',
        cache: 'no-cache',
        signal: AbortSignal.timeout(3000) // 3 second timeout
      });
      return response.ok;
    } catch (error) {
      console.log('[OfflineQueue] Connectivity check failed:', error);
      return false;
    }
  }

  /**
   * Handle offline event
   */
  private handleOffline(): void {
    console.log('[OfflineQueue] Connection lost');
    this.isOnline = false;
    this.notifyListeners();
  }

  /**
   * Get current sync status
   */
  public async getStatus(): Promise<SyncStatus> {
    const items = await this.getQueuedItems();
    const reports = items.filter(i => i.type === 'report');
    const assignments = items.filter(i => i.type === 'assignment');
    const blockedReports = reports.filter(i => i.status === 'blocked').length;
    
    // Calculate next retry time
    let nextRetryTime: number | null = null;
    if (items.length > 0 && this.isOnline) {
      const now = Date.now();
      for (const item of items) {
        if (item.status === 'blocked') continue;
        if (item.lastAttemptTime && item.attemptCount > 0) {
          const itemNextRetry = item.lastAttemptTime + getRetryDelay(item.attemptCount - 1);
          if (!nextRetryTime || itemNextRetry < nextRetryTime) {
            nextRetryTime = itemNextRetry;
          }
        } else {
          nextRetryTime = now; // Ready now
          break;
        }
      }
    }
    
    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      queuedReports: reports.length - blockedReports,
      queuedAssignments: assignments.length,
      blockedReports,
      lastSyncTime: items.length === 0 ? Date.now() : null,
      nextRetryTime
    };
  }

  /**
   * Subscribe to status changes
   */
  public subscribe(listener: (status: SyncStatus) => void): () => void {
    this.listeners.add(listener);

    // Send initial status
    this.getStatus().then(listener);

    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners of status change
   */
  private notifyListeners(): void {
    this.getStatus().then(status => {
      this.listeners.forEach(listener => listener(status));
    });
  }

  /**
   * Check if online
   */
  public isNetworkOnline(): boolean {
    return this.isOnline;
  }

  /**
   * Clear all queued items (use with caution)
   */
  public async clearQueue(): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([QUEUE_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(QUEUE_STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => {
        console.log('[OfflineQueue] Queue cleared');
        this.notifyListeners();
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Unblock a specific report (when assignment is restored)
   */
  public async unblockReport(reportId: string): Promise<void> {
    const items = await this.getQueuedItems('report');
    const item = items.find(i => i.id === reportId);
    
    if (item && item.status === 'blocked') {
      item.status = 'pending';
      item.blockReason = undefined;
      item.attemptCount = 0;
      item.lastAttemptTime = null;
      await this.updateItem(item);
      console.log(`[OfflineQueue] Report ${reportId} unblocked`);
      this.notifyListeners();
      
      // Trigger immediate sync
      if (this.isOnline) {
        setTimeout(() => this.syncAll(), 1000);
      }
    }
  }

  /**
   * Cleanup on destroy
   */
  public destroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.onlineHandler);
      window.removeEventListener('offline', this.offlineHandler);
    }

    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
      this.syncTimer = null;
    }

    if (this.db) {
      this.db.close();
      this.db = null;
    }

    this.listeners.clear();
    console.log('[OfflineQueue] Destroyed');
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let offlineQueueManager: OfflineQueueManager | null = null;

export const getOfflineQueueManager = (): OfflineQueueManager => {
  if (!offlineQueueManager) {
    offlineQueueManager = new OfflineQueueManager();
  }
  return offlineQueueManager;
};

// Backward compatibility
export const getOfflineReportManager = getOfflineQueueManager;

export default getOfflineQueueManager;
