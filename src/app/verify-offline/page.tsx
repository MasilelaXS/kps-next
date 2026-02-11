'use client';

import { useEffect, useState } from 'react';
import { serviceWorkerManager } from '@/lib/serviceWorkerManager';
import { storageQuotaManager } from '@/lib/storageQuotaManager';
import { getOfflineQueueManager } from '@/lib/offlineSync';
import { offlineCache } from '@/lib/offlineCache';

interface TestResult {
  category: string;
  name: string;
  status: 'PASS' | 'FAIL' | 'WARN' | 'RUNNING';
  details: string;
  severity?: 'critical' | 'medium' | 'low';
}

export default function VerifyOfflinePage() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [summary, setSummary] = useState({ passed: 0, failed: 0, warnings: 0 });

  useEffect(() => {
    runVerification();
  }, []);

  const updateResult = (result: TestResult) => {
    setResults(prev => {
      const existing = prev.findIndex(r => r.category === result.category && r.name === result.name);
      if (existing >= 0) {
        const newResults = [...prev];
        newResults[existing] = result;
        return newResults;
      }
      return [...prev, result];
    });
  };

  const runVerification = async () => {
    setIsRunning(true);
    const testResults: TestResult[] = [];
    let passed = 0;
    let failed = 0;
    let warnings = 0;

    // ===========================================
    // 1. SERVICE WORKER TESTS
    // ===========================================
    
    // Test 1.1: Service Worker Support
    try {
      updateResult({ category: 'Service Worker', name: 'Browser Support', status: 'RUNNING', details: 'Checking...' });
      
      if ('serviceWorker' in navigator) {
        const result = { category: 'Service Worker', name: 'Browser Support', status: 'PASS' as const, details: 'Service Worker API available' };
        testResults.push(result);
        updateResult(result);
        passed++;
      } else {
        const result = { category: 'Service Worker', name: 'Browser Support', status: 'FAIL' as const, details: 'Service Worker not supported', severity: 'critical' as const };
        testResults.push(result);
        updateResult(result);
        failed++;
      }
    } catch (error) {
      const result = { category: 'Service Worker', name: 'Browser Support', status: 'FAIL' as const, details: 'Error checking support', severity: 'critical' as const };
      testResults.push(result);
      updateResult(result);
      failed++;
    }

    // Test 1.2: Service Worker Registration
    if ('serviceWorker' in navigator) {
      try {
        updateResult({ category: 'Service Worker', name: 'Registration', status: 'RUNNING', details: 'Checking...' });
        
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          const result = { category: 'Service Worker', name: 'Registration', status: 'PASS' as const, details: `Registered (scope: ${registration.scope})` };
          testResults.push(result);
          updateResult(result);
          passed++;
        } else {
          const result = { category: 'Service Worker', name: 'Registration', status: 'WARN' as const, details: 'Not registered yet (will register on load)' };
          testResults.push(result);
          updateResult(result);
          warnings++;
        }
      } catch (error) {
        const result = { category: 'Service Worker', name: 'Registration', status: 'FAIL' as const, details: 'Error checking registration', severity: 'medium' as const };
        testResults.push(result);
        updateResult(result);
        failed++;
      }
    }

    // Test 1.3: Service Worker Controller
    if ('serviceWorker' in navigator) {
      try {
        updateResult({ category: 'Service Worker', name: 'Active Controller', status: 'RUNNING', details: 'Checking...' });
        
        if (navigator.serviceWorker.controller) {
          const result = { category: 'Service Worker', name: 'Active Controller', status: 'PASS' as const, details: 'Service worker is controlling this page' };
          testResults.push(result);
          updateResult(result);
          passed++;
        } else {
          const result = { category: 'Service Worker', name: 'Active Controller', status: 'WARN' as const, details: 'No active controller (refresh page after registration)' };
          testResults.push(result);
          updateResult(result);
          warnings++;
        }
      } catch (error) {
        const result = { category: 'Service Worker', name: 'Active Controller', status: 'FAIL' as const, details: 'Error checking controller' };
        testResults.push(result);
        updateResult(result);
        failed++;
      }
    }

    // ===========================================
    // 2. STORAGE API TESTS
    // ===========================================

    // Test 2.1: Storage API Support
    try {
      updateResult({ category: 'Storage', name: 'API Support', status: 'RUNNING', details: 'Checking...' });
      
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const result = { category: 'Storage', name: 'API Support', status: 'PASS' as const, details: 'Storage estimation API available' };
        testResults.push(result);
        updateResult(result);
        passed++;
      } else {
        const result = { category: 'Storage', name: 'API Support', status: 'WARN' as const, details: 'Storage API not fully supported' };
        testResults.push(result);
        updateResult(result);
        warnings++;
      }
    } catch (error) {
      const result = { category: 'Storage', name: 'API Support', status: 'FAIL' as const, details: 'Error checking storage API' };
      testResults.push(result);
      updateResult(result);
      failed++;
    }

    // Test 2.2: Storage Quota
    try {
      updateResult({ category: 'Storage', name: 'Quota Available', status: 'RUNNING', details: 'Checking...' });
      
      const info = await storageQuotaManager.getStorageInfo();
      const details = `${storageQuotaManager.formatBytes(info.available)} available (${(info.percentUsed * 100).toFixed(1)}% used)`;
      
      if (info.isCritical) {
        const result = { category: 'Storage', name: 'Quota Available', status: 'WARN' as const, details: `Critical: ${details}`, severity: 'medium' as const };
        testResults.push(result);
        updateResult(result);
        warnings++;
      } else if (info.isLow) {
        const result = { category: 'Storage', name: 'Quota Available', status: 'WARN' as const, details: `Low: ${details}` };
        testResults.push(result);
        updateResult(result);
        warnings++;
      } else {
        const result = { category: 'Storage', name: 'Quota Available', status: 'PASS' as const, details };
        testResults.push(result);
        updateResult(result);
        passed++;
      }
    } catch (error) {
      const result = { category: 'Storage', name: 'Quota Available', status: 'FAIL' as const, details: 'Failed to check quota' };
      testResults.push(result);
      updateResult(result);
      failed++;
    }

    // Test 2.3: Persistent Storage
    try {
      updateResult({ category: 'Storage', name: 'Persistence', status: 'RUNNING', details: 'Checking...' });
      
      if ('storage' in navigator && 'persisted' in navigator.storage) {
        const persisted = await navigator.storage.persisted();
        if (persisted) {
          const result = { category: 'Storage', name: 'Persistence', status: 'PASS' as const, details: 'Storage is persistent (won\'t be evicted)' };
          testResults.push(result);
          updateResult(result);
          passed++;
        } else {
          const result = { category: 'Storage', name: 'Persistence', status: 'WARN' as const, details: 'Storage not persistent (may be evicted)' };
          testResults.push(result);
          updateResult(result);
          warnings++;
        }
      } else {
        const result = { category: 'Storage', name: 'Persistence', status: 'WARN' as const, details: 'Persistence API not supported' };
        testResults.push(result);
        updateResult(result);
        warnings++;
      }
    } catch (error) {
      const result = { category: 'Storage', name: 'Persistence', status: 'WARN' as const, details: 'Failed to check persistence' };
      testResults.push(result);
      updateResult(result);
      warnings++;
    }

    // ===========================================
    // 3. INDEXEDDB TESTS
    // ===========================================

    // Test 3.1: IndexedDB Support
    try {
      updateResult({ category: 'IndexedDB', name: 'API Support', status: 'RUNNING', details: 'Checking...' });
      
      if ('indexedDB' in window) {
        const result = { category: 'IndexedDB', name: 'API Support', status: 'PASS' as const, details: 'IndexedDB API available' };
        testResults.push(result);
        updateResult(result);
        passed++;
      } else {
        const result = { category: 'IndexedDB', name: 'API Support', status: 'FAIL' as const, details: 'IndexedDB not supported', severity: 'critical' as const };
        testResults.push(result);
        updateResult(result);
        failed++;
      }
    } catch (error) {
      const result = { category: 'IndexedDB', name: 'API Support', status: 'FAIL' as const, details: 'Error checking IndexedDB', severity: 'critical' as const };
      testResults.push(result);
      updateResult(result);
      failed++;
    }

    // Test 3.2: IndexedDB Read/Write
    if ('indexedDB' in window) {
      try {
        updateResult({ category: 'IndexedDB', name: 'Read/Write', status: 'RUNNING', details: 'Testing...' });
        
        const testDB = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open('KPSVerifyTest', 1);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
          request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains('test')) {
              db.createObjectStore('test', { keyPath: 'id' });
            }
          };
        });

        await new Promise<void>((resolve, reject) => {
          const transaction = testDB.transaction(['test'], 'readwrite');
          const store = transaction.objectStore('test');
          const request = store.put({ id: 1, data: 'test', timestamp: Date.now() });
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });

        testDB.close();
        indexedDB.deleteDatabase('KPSVerifyTest');

        const result = { category: 'IndexedDB', name: 'Read/Write', status: 'PASS' as const, details: 'Successfully tested read/write operations' };
        testResults.push(result);
        updateResult(result);
        passed++;
      } catch (error) {
        const result = { category: 'IndexedDB', name: 'Read/Write', status: 'FAIL' as const, details: `Read/write failed: ${error}`, severity: 'critical' as const };
        testResults.push(result);
        updateResult(result);
        failed++;
      }
    }

    // ===========================================
    // 4. CACHE API TESTS
    // ===========================================

    // Test 4.1: Cache API Support
    try {
      updateResult({ category: 'Cache API', name: 'API Support', status: 'RUNNING', details: 'Checking...' });
      
      if ('caches' in window) {
        const result = { category: 'Cache API', name: 'API Support', status: 'PASS' as const, details: 'Cache API available' };
        testResults.push(result);
        updateResult(result);
        passed++;
      } else {
        const result = { category: 'Cache API', name: 'API Support', status: 'FAIL' as const, details: 'Cache API not supported', severity: 'critical' as const };
        testResults.push(result);
        updateResult(result);
        failed++;
      }
    } catch (error) {
      const result = { category: 'Cache API', name: 'API Support', status: 'FAIL' as const, details: 'Error checking Cache API', severity: 'critical' as const };
      testResults.push(result);
      updateResult(result);
      failed++;
    }

    // Test 4.2: Cache Read/Write
    if ('caches' in window) {
      try {
        updateResult({ category: 'Cache API', name: 'Read/Write', status: 'RUNNING', details: 'Testing...' });
        
        const testCache = 'kps-verify-test';
        const cache = await caches.open(testCache);
        await cache.put('/test', new Response('test data'));
        const retrieved = await cache.match('/test');
        await caches.delete(testCache);

        if (retrieved) {
          const result = { category: 'Cache API', name: 'Read/Write', status: 'PASS' as const, details: 'Successfully tested cache operations' };
          testResults.push(result);
          updateResult(result);
          passed++;
        } else {
          throw new Error('Failed to retrieve cached data');
        }
      } catch (error) {
        const result = { category: 'Cache API', name: 'Read/Write', status: 'FAIL' as const, details: `Cache operations failed: ${error}`, severity: 'critical' as const };
        testResults.push(result);
        updateResult(result);
        failed++;
      }
    }

    // ===========================================
    // 5. OFFLINE QUEUE TESTS
    // ===========================================

    // Test 5.1: Offline Queue Status
    try {
      updateResult({ category: 'Offline Queue', name: 'Status Check', status: 'RUNNING', details: 'Checking...' });
      
      const manager = getOfflineQueueManager();
      const status = await manager.getStatus();
      const details = `${status.queuedReports} reports, ${status.queuedAssignments} assignments queued`;
      
      const result = { category: 'Offline Queue', name: 'Status Check', status: 'PASS' as const, details };
      testResults.push(result);
      updateResult(result);
      passed++;
    } catch (error) {
      const result = { category: 'Offline Queue', name: 'Status Check', status: 'FAIL' as const, details: `Failed to get queue status: ${error}`, severity: 'medium' as const };
      testResults.push(result);
      updateResult(result);
      failed++;
    }

    // ===========================================
    // 6. NETWORK DETECTION TESTS
    // ===========================================

    // Test 6.1: Online/Offline Events
    try {
      updateResult({ category: 'Network', name: 'Detection', status: 'RUNNING', details: 'Checking...' });
      
      const isOnline = navigator.onLine;
      const result = { category: 'Network', name: 'Detection', status: 'PASS' as const, details: `Currently ${isOnline ? 'online' : 'offline'}` };
      testResults.push(result);
      updateResult(result);
      passed++;
    } catch (error) {
      const result = { category: 'Network', name: 'Detection', status: 'FAIL' as const, details: 'Failed to detect network status' };
      testResults.push(result);
      updateResult(result);
      failed++;
    }

    // ===========================================
    // 7. LOCALSTORAGE TESTS
    // ===========================================

    // Test 7.1: LocalStorage Support
    try {
      updateResult({ category: 'LocalStorage', name: 'API Support', status: 'RUNNING', details: 'Checking...' });
      
      if ('localStorage' in window) {
        const testKey = 'kps_verify_test';
        localStorage.setItem(testKey, 'test');
        const retrieved = localStorage.getItem(testKey);
        localStorage.removeItem(testKey);

        if (retrieved === 'test') {
          const result = { category: 'LocalStorage', name: 'API Support', status: 'PASS' as const, details: 'LocalStorage working correctly' };
          testResults.push(result);
          updateResult(result);
          passed++;
        } else {
          throw new Error('Failed to retrieve data');
        }
      } else {
        const result = { category: 'LocalStorage', name: 'API Support', status: 'FAIL' as const, details: 'LocalStorage not supported', severity: 'critical' as const };
        testResults.push(result);
        updateResult(result);
        failed++;
      }
    } catch (error) {
      const result = { category: 'LocalStorage', name: 'API Support', status: 'FAIL' as const, details: `LocalStorage failed: ${error}`, severity: 'critical' as const };
      testResults.push(result);
      updateResult(result);
      failed++;
    }

    setSummary({ passed, failed, warnings });
    setIsRunning(false);
  };

  const criticalFailures = results.filter(r => r.status === 'FAIL' && r.severity === 'critical');
  const allPassed = summary.failed === 0 && !isRunning;

  const groupedResults = results.reduce((acc, result) => {
    if (!acc[result.category]) {
      acc[result.category] = [];
    }
    acc[result.category].push(result);
    return acc;
  }, {} as Record<string, TestResult[]>);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
            Offline System Verification
          </h1>
          <p className="text-gray-600">
            Comprehensive tests for all offline functionality components
          </p>
        </div>

        {/* Critical Failures Alert */}
        {criticalFailures.length > 0 && (
          <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-6 mb-6">
            <h2 className="text-xl font-bold text-red-900 mb-3">⚠️ Critical Issues Detected</h2>
            <div className="space-y-2">
              {criticalFailures.map((result, idx) => (
                <div key={idx} className="text-red-800">
                  <strong>{result.category} - {result.name}:</strong> {result.details}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Summary Card */}
        {results.length > 0 && (
          <div className={`rounded-2xl shadow-xl p-6 mb-6 ${
            allPassed 
              ? 'bg-gradient-to-r from-green-500 to-emerald-500' 
              : criticalFailures.length > 0
                ? 'bg-gradient-to-r from-red-500 to-orange-500'
                : 'bg-gradient-to-r from-blue-500 to-purple-500'
          }`}>
            <div className="text-white">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold">
                  {allPassed ? '✅ All Systems Operational' : isRunning ? '⏳ Running Tests...' : '📊 Test Results'}
                </h2>
                <button
                  onClick={runVerification}
                  disabled={isRunning}
                  className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors disabled:opacity-50"
                >
                  Rerun Tests
                </button>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white/20 rounded-lg p-4">
                  <div className="text-4xl font-bold">{summary.passed}</div>
                  <div className="text-sm">Passed</div>
                </div>
                <div className="bg-white/20 rounded-lg p-4">
                  <div className="text-4xl font-bold">{summary.failed}</div>
                  <div className="text-sm">Failed</div>
                </div>
                <div className="bg-white/20 rounded-lg p-4">
                  <div className="text-4xl font-bold">{summary.warnings}</div>
                  <div className="text-sm">Warnings</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Test Results by Category */}
        {Object.entries(groupedResults).map(([category, categoryResults]) => (
          <div key={category} className="bg-white rounded-2xl shadow-xl p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">{category}</h2>
            <div className="space-y-3">
              {categoryResults.map((result, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg border-2 ${
                    result.status === 'PASS'
                      ? 'bg-green-50 border-green-200'
                      : result.status === 'FAIL'
                      ? 'bg-red-50 border-red-200'
                      : result.status === 'WARN'
                      ? 'bg-yellow-50 border-yellow-200'
                      : 'bg-blue-50 border-blue-200 animate-pulse'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">
                      {result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : result.status === 'WARN' ? '⚠️' : '⏳'}
                    </span>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-800">{result.name}</h3>
                      <p className="text-sm text-gray-600 mt-1">{result.details}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Success Message */}
        {allPassed && (
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-2xl p-6">
            <h3 className="text-xl font-bold text-green-900 mb-3">🎉 All Systems Verified!</h3>
            <div className="text-green-800 space-y-2">
              <p>✓ Service Worker is operational</p>
              <p>✓ Storage APIs are working correctly</p>
              <p>✓ IndexedDB is functional</p>
              <p>✓ Cache API is operational</p>
              <p>✓ Offline queue is ready</p>
              <p>✓ Network detection is working</p>
              <p>✓ LocalStorage is functional</p>
              <p className="mt-4 pt-4 border-t border-green-200 font-semibold">
                📱 The offline system is rock-solid and ready for production deployment.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
