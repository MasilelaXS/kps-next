/**
 * Production-Ready Offline Report Queue System
 * Uses IndexedDB for reliable offline report storage and automatic syncing
 */

import { buildApiUrl } from './api';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface QueuedReport {
  id: string;
  endpoint: string;
  method: 'POST' | 'PUT';
  payload: any;
  timestamp: number;
  retryCount: number;
  status: 'pending' | 'syncing' | 'failed';
  error?: string;
}

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  queuedReports: number;
  lastSyncTime: number | null;
}

// ============================================================================
// INDEXEDDB SETUP
// ============================================================================

const DB_NAME = 'KPSOfflineReports';
const DB_VERSION = 1;
const STORE_NAME = 'reportQueue';

class OfflineReportManager {
  private db: IDBDatabase | null = null;
  private isOnline: boolean = true;
  private isSyncing: boolean = false;
  private listeners: Set<(status: SyncStatus) => void> = new Set();
  private onlineHandler: () => void;
  private offlineHandler: () => void;
  private maxRetries: number = 3;

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

      // If online and has queued reports, sync them
      if (this.isOnline) {
        const count = await this.getQueuedCount();
        if (count > 0) {
          console.log(`[OfflineReports] Found ${count} queued reports, starting sync...`);
          setTimeout(() => this.syncReports(), 2000);
        }
      }

      console.log('[OfflineReports] Initialized successfully');
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
        
        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('status', 'status', { unique: false });
          console.log('[OfflineReports] Object store created');
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
   * Queue a report for offline submission
   */
  public async queueReport(endpoint: string, method: 'POST' | 'PUT', payload: any): Promise<string> {
    await this.ensureDB();

    const report: QueuedReport = {
      id: `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      endpoint,
      method,
      payload,
      timestamp: Date.now(),
      retryCount: 0,
      status: 'pending'
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.add(report);

      request.onsuccess = () => {
        console.log(`[OfflineReports] Report queued: ${report.id}`);
        this.notifyListeners();
        resolve(report.id);
      };

      request.onerror = () => {
        console.error('[OfflineReports] Failed to queue report:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get all queued reports
   */
  public async getQueuedReports(): Promise<QueuedReport[]> {
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const reports = request.result as QueuedReport[];
        resolve(reports.sort((a, b) => a.timestamp - b.timestamp));
      };

      request.onerror = () => {
        console.error('[OfflineReports] Failed to get queued reports:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get count of queued reports
   */
  public async getQueuedCount(): Promise<number> {
    if (!this.db) return 0;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.count();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        console.error('[OfflineReports] Failed to get count:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Update a report in the queue
   */
  private async updateReport(report: QueuedReport): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(report);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete a report from the queue
   */
  private async deleteReport(id: string): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => {
        console.log(`[OfflineReports] Report deleted: ${id}`);
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Sync all queued reports
   */
  public async syncReports(): Promise<{ success: number; failed: number }> {
    if (!this.isOnline) {
      console.log('[OfflineReports] Cannot sync - offline');
      return { success: 0, failed: 0 };
    }

    if (this.isSyncing) {
      console.log('[OfflineReports] Sync already in progress');
      return { success: 0, failed: 0 };
    }

    this.isSyncing = true;
    this.notifyListeners();

    const reports = await this.getQueuedReports();
    const results = { success: 0, failed: 0 };

    console.log(`[OfflineReports] Starting sync of ${reports.length} reports`);

    for (const report of reports) {
      // Skip if already exceeds max retries
      if (report.retryCount >= this.maxRetries) {
        console.error(`[OfflineReports] Report ${report.id} exceeded max retries, removing from queue`);
        await this.deleteReport(report.id);
        results.failed++;
        continue;
      }

      // Update status to syncing
      report.status = 'syncing';
      await this.updateReport(report);

      // Attempt to submit
      const success = await this.submitReport(report);

      if (success) {
        await this.deleteReport(report.id);
        results.success++;
        console.log(`[OfflineReports] ✓ Successfully synced report ${report.id}`);
      } else {
        report.retryCount++;
        report.status = 'failed';
        report.error = 'Submission failed';
        await this.updateReport(report);
        results.failed++;
        console.error(`[OfflineReports] ✗ Failed to sync report ${report.id} (attempt ${report.retryCount}/${this.maxRetries})`);
      }

      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    this.isSyncing = false;
    
    // If we went offline during sync, notify listeners
    if (!this.isOnline) {
      console.log('[OfflineReports] Lost connection during sync');
    }
    
    this.notifyListeners();

    console.log(`[OfflineReports] Sync completed: ${results.success} success, ${results.failed} failed`);
    return results;
  }

  /**
   * Submit a single report to the server
   */
  private async submitReport(report: QueuedReport): Promise<boolean> {
    try {
      const token = localStorage.getItem('kps_token');
      if (!token) {
        console.error('[OfflineReports] No auth token found');
        return false;
      }

      const response = await fetch(buildApiUrl(report.endpoint), {
        method: report.method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(report.payload)
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[OfflineReports] Report submitted successfully:', data);
        return true;
      } else if (response.status === 401) {
        console.error('[OfflineReports] Authentication failed');
        return false;
      } else {
        const error = await response.json().catch(() => ({ message: 'Unknown error' }));
        console.error('[OfflineReports] Submission failed:', error);
        return false;
      }
    } catch (error) {
      console.error('[OfflineReports] Network error during submission:', error);
      // Network error means we're actually offline
      this.isOnline = false;
      return false;
    }
  }

  /**
   * Handle online event
   */
  private async handleOnline(): Promise<void> {
    console.log('[OfflineReports] Online event detected, verifying connectivity...');
    
    // Verify we're actually online by trying to reach the server
    const actuallyOnline = await this.checkConnectivity();
    
    if (!actuallyOnline) {
      console.log('[OfflineReports] False positive - still offline');
      this.isOnline = false;
      this.notifyListeners();
      return;
    }

    console.log('[OfflineReports] Connection confirmed');
    this.isOnline = true;
    this.notifyListeners();

    // Trigger sync after a short delay
    setTimeout(async () => {
      const count = await this.getQueuedCount();
      if (count > 0 && this.isOnline) {
        console.log(`[OfflineReports] Auto-syncing ${count} queued reports`);
        await this.syncReports();
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
      console.log('[OfflineReports] Connectivity check failed:', error);
      return false;
    }
  }

  /**
   * Handle offline event
   */
  private handleOffline(): void {
    console.log('[OfflineReports] Connection lost');
    this.isOnline = false;
    this.notifyListeners();
  }

  /**
   * Get current sync status
   */
  public async getStatus(): Promise<SyncStatus> {
    const queuedReports = await this.getQueuedCount();
    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      queuedReports,
      lastSyncTime: queuedReports === 0 ? Date.now() : null
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
   * Clear all queued reports (use with caution)
   */
  public async clearQueue(): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => {
        console.log('[OfflineReports] Queue cleared');
        this.notifyListeners();
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Cleanup on destroy
   */
  public destroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.onlineHandler);
      window.removeEventListener('offline', this.offlineHandler);
    }

    if (this.db) {
      this.db.close();
      this.db = null;
    }

    this.listeners.clear();
    console.log('[OfflineReports] Destroyed');
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let offlineReportManager: OfflineReportManager | null = null;

export const getOfflineReportManager = (): OfflineReportManager => {
  if (!offlineReportManager) {
    offlineReportManager = new OfflineReportManager();
  }
  return offlineReportManager;
};

export default getOfflineReportManager;
