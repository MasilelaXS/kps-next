/**
 * Offline Settings Page
 * Allows PCO to manage offline data, view sync status, and trigger manual operations
 */

'use client';

import { useEffect, useState } from 'react';
import PcoDashboardLayout from '@/components/PcoDashboardLayout';
import { useNotification } from '@/contexts/NotificationContext';
import { clientCache } from '@/lib/clientCache';
import { getOfflineQueueManager } from '@/lib/offlineSync';
import { getHealthManager } from '@/lib/offlineHealthCheck';
import { 
  Download, 
  RefreshCw, 
  Trash2, 
  Database, 
  WifiOff, 
  CheckCircle,
  AlertTriangle,
  Clock,
  HardDrive
} from 'lucide-react';
import Loading from '@/components/Loading';

export default function OfflineSettingsPage() {
  const notification = useNotification();
  const [loading, setLoading] = useState(true);
  const [downloadingCache, setDownloadingCache] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [cacheStats, setCacheStats] = useState<any>(null);
  const [queueStatus, setQueueStatus] = useState<any>(null);
  const [healthReport, setHealthReport] = useState<any>(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      
      // Get cache stats
      const stats = clientCache.getStats();
      setCacheStats(stats);
      
      // Get queue status
      const manager = getOfflineQueueManager();
      const status = await manager.getStatus();
      setQueueStatus(status);
      
      // Get health report
      const healthMgr = getHealthManager();
      const report = await healthMgr.getHealthReport();
      setHealthReport(report);
    } catch (error) {
      console.error('Error loading stats:', error);
      notification.error('Failed to load offline data stats');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadCache = async () => {
    try {
      setDownloadingCache(true);
      notification.info('Downloading data for offline use...');
      
      const result = await clientCache.downloadAllClients();
      
      if (result.success) {
        notification.success(
          `Downloaded ${result.totalClients} clients (${result.assignedCount} assigned, ${result.availableCount} available) and ${result.chemicalsCount} chemicals`
        );
        await loadStats();
      } else {
        notification.error(result.error || 'Failed to download data');
      }
    } catch (error) {
      console.error('Error downloading cache:', error);
      notification.error('Failed to download data');
    } finally {
      setDownloadingCache(false);
    }
  };

  const handleManualSync = async () => {
    try {
      setSyncing(true);
      notification.info('Syncing queued items...');
      
      const manager = getOfflineQueueManager();
      const result = await manager.syncAll();
      
      const totalSuccess = result.assignments.success + result.reports.success;
      const totalFailed = result.assignments.failed + result.reports.failed;
      
      if (totalSuccess > 0) {
        notification.success(`Synced ${totalSuccess} items successfully`);
      }
      
      if (totalFailed > 0) {
        notification.warning(`${totalFailed} items failed to sync (will retry)`);
      }
      
      if (totalSuccess === 0 && totalFailed === 0) {
        notification.info('No items to sync');
      }
      
      await loadStats();
    } catch (error) {
      console.error('Error syncing:', error);
      notification.error('Failed to sync data');
    } finally {
      setSyncing(false);
    }
  };

  const handleClearCache = async () => {
    if (!confirm('Are you sure you want to clear all offline cache? This will remove downloaded clients but keep queued assignments and reports.')) {
      return;
    }
    
    try {
      setClearing(true);
      clientCache.clearCache();
      notification.success('Offline cache cleared');
      await loadStats();
    } catch (error) {
      console.error('Error clearing cache:', error);
      notification.error('Failed to clear cache');
    } finally {
      setClearing(false);
    }
  };

  if (loading) {
    return (
      <PcoDashboardLayout>
        <div className="flex items-center justify-center py-12">
          <Loading size="lg" />
        </div>
      </PcoDashboardLayout>
    );
  }

  const totalQueued = (queueStatus?.queuedReports || 0) + (queueStatus?.queuedAssignments || 0);

  return (
    <PcoDashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Offline Settings</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage offline data, sync status, and storage
          </p>
        </div>

        {/* Connection Status */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {queueStatus?.isOnline ? (
                <>
                  <CheckCircle className="w-6 h-6 text-green-600" />
                  <div>
                    <h3 className="font-semibold text-gray-900">Online</h3>
                    <p className="text-sm text-gray-500">Connected to server</p>
                  </div>
                </>
              ) : (
                <>
                  <WifiOff className="w-6 h-6 text-red-600" />
                  <div>
                    <h3 className="font-semibold text-gray-900">Offline</h3>
                    <p className="text-sm text-gray-500">No connection - using cached data</p>
                  </div>
                </>
              )}
            </div>
            
            {queueStatus?.isOnline && totalQueued > 0 && (
              <button
                onClick={handleManualSync}
                disabled={syncing || queueStatus.isSyncing}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {syncing || queueStatus.isSyncing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Sync Now
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Queue Status */}
        {totalQueued > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Sync Queue</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {queueStatus.queuedAssignments > 0 && (
                <div className="p-4 bg-purple-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Assignments</p>
                      <p className="text-2xl font-bold text-purple-600">{queueStatus.queuedAssignments}</p>
                    </div>
                    <Clock className="w-8 h-8 text-purple-400" />
                  </div>
                </div>
              )}
              
              {queueStatus.queuedReports > 0 && (
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Reports</p>
                      <p className="text-2xl font-bold text-blue-600">{queueStatus.queuedReports}</p>
                    </div>
                    <Clock className="w-8 h-8 text-blue-400" />
                  </div>
                </div>
              )}
              
              {queueStatus.blockedReports > 0 && (
                <div className="p-4 bg-amber-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Blocked</p>
                      <p className="text-2xl font-bold text-amber-600">{queueStatus.blockedReports}</p>
                    </div>
                    <AlertTriangle className="w-8 h-8 text-amber-400" />
                  </div>
                  <p className="text-xs text-amber-600 mt-2">Assignment conflicts</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Cached Data */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-900">Cached Data</h3>
              <p className="text-xs text-gray-500 mt-1">Auto-downloads every 4 hours when online</p>
            </div>
            <button
              onClick={handleDownloadCache}
              disabled={downloadingCache || !queueStatus?.isOnline}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {downloadingCache ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Refreshing...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Refresh Now
                </>
              )}
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Available Clients</p>
              <p className="text-2xl font-bold text-gray-900">{cacheStats?.availableClients || 0}</p>
              <p className="text-xs text-gray-500 mt-1">
                {cacheStats?.lastUpdated 
                  ? `Updated ${cacheStats.cacheAge}`
                  : 'Not downloaded yet'}
              </p>
            </div>
            
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Assigned Clients</p>
              <p className="text-2xl font-bold text-gray-900">{cacheStats?.assignedClients || 0}</p>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Chemicals</p>
              <p className="text-2xl font-bold text-gray-900">{cacheStats?.chemicals || 0}</p>
              <p className="text-xs text-gray-500 mt-1">For offline reports</p>
            </div>
          </div>
        </div>

        {/* Storage Info */}
        {healthReport?.storage && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Storage Usage</h3>
            
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Used Storage</span>
                  <span className="text-sm font-medium text-gray-900">
                    {healthReport.storage.used} / {healthReport.storage.total}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${
                      healthReport.storage.percentUsed > 80 ? 'bg-red-600' :
                      healthReport.storage.percentUsed > 60 ? 'bg-amber-600' :
                      'bg-green-600'
                    }`}
                    style={{ width: `${Math.min(100, healthReport.storage.percentUsed)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {healthReport.storage.percentUsed.toFixed(1)}% used
                </p>
              </div>
              
              <button
                onClick={handleClearCache}
                disabled={clearing}
                className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {clearing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Clearing...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Clear Cache
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex gap-3">
            <Database className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-medium mb-1">About Offline Mode</p>
              <ul className="space-y-1 text-blue-700">
                <li>• Data is downloaded for offline access</li>
                <li>• Changes are queued and synced automatically when online</li>
                <li>• Sync retries with increasing intervals (never loses data)</li>
                <li>• Storage is cleaned up automatically after 30 days</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </PcoDashboardLayout>
  );
}
