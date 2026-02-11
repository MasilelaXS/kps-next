/**
 * Offline Functionality Testing Utility
 * Provides tools to test offline scenarios comprehensively
 */

import { serviceWorkerManager } from './serviceWorkerManager';
import { getOfflineQueueManager } from './offlineSync';
import { storageQuotaManager } from './storageQuotaManager';
import { offlineCache } from './offlineCache';

export interface OfflineTestResult {
  test: string;
  passed: boolean;
  message: string;
  details?: any;
}

class OfflineTestingUtility {
  /**
   * Run all offline tests
   */
  async runAllTests(): Promise<OfflineTestResult[]> {
    console.log('[OfflineTest] Starting comprehensive offline tests...');
    
    const results: OfflineTestResult[] = [];

    // Test 1: Service Worker Registration
    results.push(await this.testServiceWorkerRegistration());

    // Test 2: Storage Quota
    results.push(await this.testStorageQuota());

    // Test 3: IndexedDB
    results.push(await this.testIndexedDB());

    // Test 4: Cache API
    results.push(await this.testCacheAPI());

    // Test 5: Offline Queue
    results.push(await this.testOfflineQueue());

    // Test 6: Image Compression
    results.push(await this.testImageCompression());

    // Test 7: Network Detection
    results.push(await this.testNetworkDetection());

    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;

    console.log(`[OfflineTest] Tests complete: ${passed} passed, ${failed} failed`);
    
    return results;
  }

  /**
   * Test Service Worker Registration
   */
  private async testServiceWorkerRegistration(): Promise<OfflineTestResult> {
    try {
      if (!('serviceWorker' in navigator)) {
        return {
          test: 'Service Worker Support',
          passed: false,
          message: 'Service Worker not supported in this browser'
        };
      }

      const status = await serviceWorkerManager.getStatus();
      
      return {
        test: 'Service Worker Registration',
        passed: status.registered,
        message: status.registered 
          ? `Service Worker registered (version: ${status.version})`
          : 'Service Worker not registered',
        details: status
      };
    } catch (error) {
      return {
        test: 'Service Worker Registration',
        passed: false,
        message: error instanceof Error ? error.message : 'Test failed'
      };
    }
  }

  /**
   * Test Storage Quota
   */
  private async testStorageQuota(): Promise<OfflineTestResult> {
    try {
      const info = await storageQuotaManager.getStorageInfo();
      
      const passed = info.quota > 0 && !info.isCritical;
      
      return {
        test: 'Storage Quota',
        passed,
        message: passed
          ? `Storage OK: ${storageQuotaManager.formatBytes(info.available)} available`
          : info.isCritical
            ? 'Storage critically low'
            : 'Could not determine storage quota',
        details: {
          usage: storageQuotaManager.formatBytes(info.usage),
          quota: storageQuotaManager.formatBytes(info.quota),
          available: storageQuotaManager.formatBytes(info.available),
          percentUsed: `${(info.percentUsed * 100).toFixed(2)}%`
        }
      };
    } catch (error) {
      return {
        test: 'Storage Quota',
        passed: false,
        message: error instanceof Error ? error.message : 'Test failed'
      };
    }
  }

  /**
   * Test IndexedDB
   */
  private async testIndexedDB(): Promise<OfflineTestResult> {
    try {
      if (!('indexedDB' in window)) {
        return {
          test: 'IndexedDB Support',
          passed: false,
          message: 'IndexedDB not supported in this browser'
        };
      }

      // Try to open a test database
      const testDB = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('KPSTestDB', 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains('test')) {
            db.createObjectStore('test', { keyPath: 'id' });
          }
        };
      });

      // Write test data
      await new Promise<void>((resolve, reject) => {
        const transaction = testDB.transaction(['test'], 'readwrite');
        const store = transaction.objectStore('test');
        const request = store.put({ id: 1, data: 'test' });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      // Read test data
      const data = await new Promise((resolve, reject) => {
        const transaction = testDB.transaction(['test'], 'readonly');
        const store = transaction.objectStore('test');
        const request = store.get(1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      testDB.close();
      indexedDB.deleteDatabase('KPSTestDB');

      return {
        test: 'IndexedDB',
        passed: !!data,
        message: data ? 'IndexedDB read/write successful' : 'IndexedDB test failed'
      };
    } catch (error) {
      return {
        test: 'IndexedDB',
        passed: false,
        message: error instanceof Error ? error.message : 'Test failed'
      };
    }
  }

  /**
   * Test Cache API
   */
  private async testCacheAPI(): Promise<OfflineTestResult> {
    try {
      if (!('caches' in window)) {
        return {
          test: 'Cache API Support',
          passed: false,
          message: 'Cache API not supported in this browser'
        };
      }

      const testCache = 'kps-test-cache';
      const cache = await caches.open(testCache);
      
      // Put test data
      const testResponse = new Response('test data');
      await cache.put('/test', testResponse);

      // Get test data
      const retrieved = await cache.match('/test');
      const passed = !!retrieved;

      // Cleanup
      await caches.delete(testCache);

      return {
        test: 'Cache API',
        passed,
        message: passed ? 'Cache API read/write successful' : 'Cache API test failed'
      };
    } catch (error) {
      return {
        test: 'Cache API',
        passed: false,
        message: error instanceof Error ? error.message : 'Test failed'
      };
    }
  }

  /**
   * Test Offline Queue
   */
  private async testOfflineQueue(): Promise<OfflineTestResult> {
    try {
      const manager = getOfflineQueueManager();
      const status = await manager.getStatus();

      return {
        test: 'Offline Queue',
        passed: true,
        message: `Queue operational: ${status.queuedReports + status.queuedAssignments} items queued`,
        details: {
          queuedReports: status.queuedReports,
          queuedAssignments: status.queuedAssignments,
          blockedReports: status.blockedReports,
          isOnline: status.isOnline,
          isSyncing: status.isSyncing
        }
      };
    } catch (error) {
      return {
        test: 'Offline Queue',
        passed: false,
        message: error instanceof Error ? error.message : 'Test failed'
      };
    }
  }

  /**
   * Test Image Compression
   */
  private async testImageCompression(): Promise<OfflineTestResult> {
    try {
      // Create a test canvas
      const canvas = document.createElement('canvas');
      canvas.width = 800;
      canvas.height = 600;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        throw new Error('Could not get canvas context');
      }

      // Draw something
      ctx.fillStyle = '#FF0000';
      ctx.fillRect(0, 0, 400, 300);
      ctx.fillStyle = '#00FF00';
      ctx.fillRect(400, 0, 400, 300);
      ctx.fillStyle = '#0000FF';
      ctx.fillRect(0, 300, 400, 300);
      ctx.fillStyle = '#FFFF00';
      ctx.fillRect(400, 300, 400, 300);

      // Import image compression
      const { imageCompression } = await import('./imageCompression');
      const result = imageCompression.compressCanvas(canvas, {
        maxWidth: 400,
        maxHeight: 300,
        quality: 0.8
      });

      const passed = result.compressionRatio <1 && result.compressedSize > 0;

      return {
        test: 'Image Compression',
        passed,
        message: passed 
          ? `Compression working: ${imageCompression.formatBytes(result.originalSize)} → ${imageCompression.formatBytes(result.compressedSize)} (${(result.compressionRatio * 100).toFixed(1)}%)`
          : 'Compression test failed',
        details: {
          originalSize: imageCompression.formatBytes(result.originalSize),
          compressedSize: imageCompression.formatBytes(result.compressedSize),
          compressionRatio: `${(result.compressionRatio * 100).toFixed(1)}%`,
          dimensions: `${result.width}x${result.height}`
        }
      };
    } catch (error) {
      return {
        test: 'Image Compression',
        passed: false,
        message: error instanceof Error ? error.message : 'Test failed'
      };
    }
  }

  /**
   * Test Network Detection
   */
  private async testNetworkDetection(): Promise<OfflineTestResult> {
    try {
      const isOnline = navigator.onLine;
      
      return {
        test: 'Network Detection',
        passed: true,
        message: `Network status: ${isOnline ? 'ONLINE' : 'OFFLINE'}`,
        details: {
          navigatorOnline: navigator.onLine,
          connection: (navigator as any).connection ? {
            effectiveType: (navigator as any).connection.effectiveType,
            downlink: (navigator as any).connection.downlink,
            rtt: (navigator as any).connection.rtt
          } : 'Not supported'
        }
      };
    } catch (error) {
      return {
        test: 'Network Detection',
        passed: false,
        message: error instanceof Error ? error.message : 'Test failed'
      };
    }
  }

  /**
   * Simulate offline mode
   */
  simulateOffline(): void {
    console.log('[OfflineTest] Simulating offline mode (disconnect network to fully test)');
    window.dispatchEvent(new Event('offline'));
  }

  /**
   * Simulate online mode
   */
  simulateOnline(): void {
    console.log('[OfflineTest] Simulating online mode');
    window.dispatchEvent(new Event('online'));
  }

  /**
   * Get comprehensive status report
   */
  async getStatusReport(): Promise<string> {
    const results = await this.runAllTests();
    
    let report = '=== KPS Offline Functionality Status Report ===\n\n';
    
    results.forEach(result => {
      const status = result.passed ? '✓' : '✗';
      report += `${status} ${result.test}: ${result.message}\n`;
      if (result.details) {
        report += `   Details: ${JSON.stringify(result.details, null, 2)}\n`;
      }
      report += '\n';
    });

    const passed = results.filter(r => r.passed).length;
    const total = results.length;
    
    report += `\nSummary: ${passed}/${total} tests passed\n`;
    
    return report;
  }
}

// Export singleton
export const offlineTestingUtility = new OfflineTestingUtility();

// Make available globally for console testing
if (typeof window !== 'undefined') {
  (window as any).offlineTest = offlineTestingUtility;
  console.log('[OfflineTest] Offline testing utility available at window.offlineTest');
  console.log('[OfflineTest] Run window.offlineTest.runAllTests() to test all offline functionality');
}
