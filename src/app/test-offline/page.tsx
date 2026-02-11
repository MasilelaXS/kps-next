'use client';

import { useEffect, useState } from 'react';
import { offlineTestingUtility, OfflineTestResult } from '@/lib/offlineTestingUtility';
import { serviceWorkerManager } from '@/lib/serviceWorkerManager';
import { storageQuotaManager } from '@/lib/storageQuotaManager';
import { getOfflineQueueManager } from '@/lib/offlineSync';

export default function OfflineTestPage() {
  const [testResults, setTestResults] = useState<OfflineTestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [storageInfo, setStorageInfo] = useState<any>(null);
  const [queueStatus, setQueueStatus] = useState<any>(null);
  const [swStatus, setSwStatus] = useState<any>(null);

  // Run tests on load
  useEffect(() => {
    runTests();
    loadStatus();
  }, []);

  const runTests = async () => {
    setIsRunning(true);
    try {
      const results = await offlineTestingUtility.runAllTests();
      setTestResults(results);
    } catch (error) {
      console.error('Test error:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const loadStatus = async () => {
    try {
      // Storage info
      const storage = await storageQuotaManager.getStorageInfo();
      setStorageInfo(storage);

      // Queue status
      const manager = getOfflineQueueManager();
      const queue = await manager.getStatus();
      setQueueStatus(queue);

      // Service worker status
      const sw = await serviceWorkerManager.getStatus();
      setSwStatus(sw);
    } catch (error) {
      console.error('Status error:', error);
    }
  };

  const handleClearCaches = async () => {
    try {
      await serviceWorkerManager.clearCaches();
      alert('Caches cleared successfully');
      await loadStatus();
    } catch (error) {
      alert('Error clearing caches: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleCompressStorage = async () => {
    try {
      const result = await storageQuotaManager.handleQuotaExceeded();
      alert(`Storage cleanup completed:\n` +
            `${result.message}\n` +
            `Total freed: ${storageQuotaManager.formatBytes(result.freedBytes)}\n` +
            `Actions: ${result.actions.join(', ')}`);
      await loadStatus();
    } catch (error) {
      alert('Error cleaning storage: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleClearQueue = async () => {
    try {
      const manager = getOfflineQueueManager();
      await manager.clearQueue();
      alert('Queue cleared successfully');
      await loadStatus();
    } catch (error) {
      alert('Error clearing queue: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleTriggerSync = async () => {
    try {
      const manager = getOfflineQueueManager();
      const result = await manager.syncAll();
      alert(`Sync completed:\n` +
            `Assignments: ${result.assignments.success} success, ${result.assignments.failed} failed, ${result.assignments.blocked} blocked\n` +
            `Reports: ${result.reports.success} success, ${result.reports.failed} failed, ${result.reports.blocked} blocked`);
      await loadStatus();
    } catch (error) {
      alert('Error triggering sync: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const passed = testResults.filter(r => r.passed).length;
  const failed = testResults.filter(r => !r.passed).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
            Offline Functionality Test Suite
          </h1>
          <p className="text-gray-600">
            Comprehensive testing of offline capabilities, storage management, and service workers
          </p>
        </div>

        {/* Test Results */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-800">Test Results</h2>
            <button
              onClick={runTests}
              disabled={isRunning}
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:shadow-lg transition-shadow disabled:opacity-50"
            >
              {isRunning ? 'Running Tests...' : 'Run Tests'}
            </button>
          </div>

          {testResults.length > 0 && (
            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-4">
                <span className="text-green-600 font-semibold">✓ {passed} Passed</span>
                <span className="text-red-600 font-semibold">✗ {failed} Failed</span>
                <div className="flex-1 bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-green-500 to-green-600 h-full transition-all"
                    style={{ width: `${(passed / testResults.length) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {testResults.map((result, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg border-2 ${
                  result.passed
                    ? 'bg-green-50 border-green-200'
                    : 'bg-red-50 border-red-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">
                    {result.passed ? '✓' : '✗'}
                  </span>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-800">{result.test}</h3>
                    <p className="text-gray-600 text-sm mt-1">{result.message}</p>
                    {result.details && (
                      <details className="mt-2">
                        <summary className="text-xs text-blue-600 cursor-pointer">
                          Show Details
                        </summary>
                        <pre className="mt-2 p-2 bg-white rounded text-xs overflow-x-auto">
                          {JSON.stringify(result.details, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Status Panels */}
        <div className="grid md:grid-cols-3 gap-6 mb-6">
          {/* Storage Info */}
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h3 className="font-bold text-gray-800 mb-4">Storage Quota</h3>
            {storageInfo ? (
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-gray-600">Used:</span>
                  <span className="font-semibold ml-2">
                    {storageQuotaManager.formatBytes(storageInfo.usage)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Quota:</span>
                  <span className="font-semibold ml-2">
                    {storageQuotaManager.formatBytes(storageInfo.quota)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Available:</span>
                  <span className="font-semibold ml-2">
                    {storageQuotaManager.formatBytes(storageInfo.available)}
                  </span>
                </div>
                <div className="pt-2">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span>Usage</span>
                    <span>{(storageInfo.percentUsed * 100).toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-full rounded-full ${
                        storageInfo.isCritical
                          ? 'bg-red-500'
                          : storageInfo.isLow
                          ? 'bg-yellow-500'
                          : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(storageInfo.percentUsed * 100, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-gray-400 text-sm">Loading...</p>
            )}
            <button
              onClick={handleCompressStorage}
              className="mt-4 w-full px-3 py-2 bg-blue-100 text-blue-700 rounded-lg text-sm hover:bg-blue-200 transition-colors"
            >
              Compress Large Items
            </button>
          </div>

          {/* Queue Status */}
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h3 className="font-bold text-gray-800 mb-4">Offline Queue</h3>
            {queueStatus ? (
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-gray-600">Reports:</span>
                  <span className="font-semibold ml-2">{queueStatus.queuedReports}</span>
                </div>
                <div>
                  <span className="text-gray-600">Assignments:</span>
                  <span className="font-semibold ml-2">{queueStatus.queuedAssignments}</span>
                </div>
                <div>
                  <span className="text-gray-600">Blocked:</span>
                  <span className="font-semibold ml-2">{queueStatus.blockedReports}</span>
                </div>
                <div>
                  <span className="text-gray-600">Status:</span>
                  <span className={`font-semibold ml-2 ${queueStatus.isOnline ? 'text-green-600' : 'text-orange-600'}`}>
                    {queueStatus.isOnline ? 'Online' : 'Offline'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Syncing:</span>
                  <span className="font-semibold ml-2">
                    {queueStatus.isSyncing ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-gray-400 text-sm">Loading...</p>
            )}
            <div className="mt-4 space-y-2">
              <button
                onClick={handleTriggerSync}
                className="w-full px-3 py-2 bg-green-100 text-green-700 rounded-lg text-sm hover:bg-green-200 transition-colors"
              >
                Trigger Sync
              </button>
              <button
                onClick={handleClearQueue}
                className="w-full px-3 py-2 bg-red-100 text-red-700 rounded-lg text-sm hover:bg-red-200 transition-colors"
              >
                Clear Queue
              </button>
            </div>
          </div>

          {/* Service Worker Status */}
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h3 className="font-bold text-gray-800 mb-4">Service Worker</h3>
            {swStatus ? (
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-gray-600">Status:</span>
                  <span className={`font-semibold ml-2 ${swStatus.registered ? 'text-green-600' : 'text-red-600'}`}>
                    {swStatus.registered ? 'Registered' : 'Not Registered'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Version:</span>
                  <span className="font-semibold ml-2">{swStatus.version || 'Unknown'}</span>
                </div>
                <div>
                  <span className="text-gray-600">Update:</span>
                  <span className="font-semibold ml-2">
                    {swStatus.updateAvailable ? 'Available' : 'None'}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-gray-400 text-sm">Loading...</p>
            )}
            <button
              onClick={handleClearCaches}
              className="mt-4 w-full px-3 py-2 bg-purple-100 text-purple-700 rounded-lg text-sm hover:bg-purple-200 transition-colors"
            >
              Clear All Caches
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h3 className="font-bold text-gray-800 mb-4">Test Actions</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <button
              onClick={() => offlineTestingUtility.simulateOffline()}
              className="px-4 py-3 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors"
            >
              Simulate Offline Mode
            </button>
            <button
              onClick={() => offlineTestingUtility.simulateOnline()}
              className="px-4 py-3 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
            >
              Simulate Online Mode
            </button>
            <button
              onClick={loadStatus}
              className="px-4 py-3 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
            >
              Refresh All Status
            </button>
            <button
              onClick={async () => {
                const report = await offlineTestingUtility.getStatusReport();
                console.log(report);
                alert('Status report logged to console');
              }}
              className="px-4 py-3 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors"
            >
              Generate Console Report
            </button>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-6 bg-blue-50 border-2 border-blue-200 rounded-2xl p-6">
          <h3 className="font-bold text-blue-900 mb-3">Testing Instructions</h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
            <li>Run all tests to verify offline functionality is operational</li>
            <li>Check storage quota - ensure you have enough space</li>
            <li>Test offline mode by disconnecting network or using browser DevTools</li>
            <li>Create a test report while offline to verify queue</li>
            <li>Reconnect network and verify automatic sync</li>
            <li>Check console logs for compression stats and sync activity</li>
            <li>Test service worker cache by reloading page while offline</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
