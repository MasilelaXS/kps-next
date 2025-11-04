/**
 * Offline Sync Status Component
 * Shows connection status and queued reports in header
 */

'use client';

import { useEffect, useState } from 'react';
import { getOfflineReportManager, SyncStatus } from '@/lib/offlineSync';
import { WifiOff, RefreshCw, FileText } from 'lucide-react';

export default function OfflineSyncStatus() {
  const [status, setStatus] = useState<SyncStatus>({
    isOnline: true,
    isSyncing: false,
    queuedReports: 0,
    lastSyncTime: null
  });

  useEffect(() => {
    const reportManager = getOfflineReportManager();
    
    // Subscribe to status updates
    const unsubscribe = reportManager.subscribe((newStatus) => {
      setStatus(newStatus);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Don't show if online and nothing queued
  if (status.isOnline && status.queuedReports === 0 && !status.isSyncing) {
    return null;
  }

  return (
    <div className="flex items-center">
      {/* Status Badge */}
      {!status.isOnline ? (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-medium border border-red-200">
          <WifiOff className="w-3.5 h-3.5" />
          <span>Offline</span>
          {status.queuedReports > 0 && (
            <>
              <span className="text-red-400">•</span>
              <FileText className="w-3.5 h-3.5" />
              <span>{status.queuedReports} queued</span>
            </>
          )}
        </div>
      ) : status.isSyncing ? (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-600 text-xs font-medium border border-blue-200">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          <span>Syncing reports...</span>
        </div>
      ) : status.queuedReports > 0 ? (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-orange-50 text-orange-600 text-xs font-medium border border-orange-200">
          <FileText className="w-3.5 h-3.5" />
          <span>{status.queuedReports}</span>
        </div>
      ) : null}
    </div>
  );
}
