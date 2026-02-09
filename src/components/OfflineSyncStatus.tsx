/**
 * Offline Sync Status Component
 * Shows connection status, queued items, and sync progress in header
 */

'use client';

import { useEffect, useState } from 'react';
import { getOfflineQueueManager, SyncStatus } from '@/lib/offlineSync';
import { WifiOff, RefreshCw, FileText, Users, AlertTriangle, Clock } from 'lucide-react';

export default function OfflineSyncStatus() {
  const [status, setStatus] = useState<SyncStatus>({
    isOnline: true,
    isSyncing: false,
    queuedReports: 0,
    queuedAssignments: 0,
    blockedReports: 0,
    lastSyncTime: null,
    nextRetryTime: null
  });

  useEffect(() => {
    const queueManager = getOfflineQueueManager();
    
    // Subscribe to status updates
    const unsubscribe = queueManager.subscribe((newStatus) => {
      setStatus(newStatus);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Calculate time until next retry
  const getNextRetryText = (): string | null => {
    if (!status.nextRetryTime) return null;
    
    const now = Date.now();
    const diff = status.nextRetryTime - now;
    
    if (diff <= 0) return 'Retrying now...';
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `Retry in ${hours}h`;
    if (minutes > 0) return `Retry in ${minutes}m`;
    return `Retry in ${seconds}s`;
  };

  // Don't show if online and nothing queued
  const totalQueued = status.queuedReports + status.queuedAssignments + status.blockedReports;
  if (status.isOnline && totalQueued === 0 && !status.isSyncing) {
    return null;
  }

  const nextRetryText = getNextRetryText();

  return (
    <div className="flex items-center gap-2">
      {/* Offline Status */}
      {!status.isOnline ? (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-medium border border-red-200">
          <WifiOff className="w-3.5 h-3.5" />
          <span>Offline</span>
          {totalQueued > 0 && (
            <>
              <span className="text-red-400">•</span>
              <span>{totalQueued} queued</span>
            </>
          )}
        </div>
      ) : status.isSyncing ? (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-600 text-xs font-medium border border-blue-200">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          <span>Syncing...</span>
        </div>
      ) : totalQueued > 0 ? (
        <div className="flex items-center gap-2">
          {/* Queued Items */}
          {(status.queuedReports > 0 || status.queuedAssignments > 0) && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-orange-50 text-orange-600 text-xs font-medium border border-orange-200">
              {status.queuedAssignments > 0 && (
                <>
                  <Users className="w-3.5 h-3.5" />
                  <span>{status.queuedAssignments}</span>
                </>
              )}
              {status.queuedReports > 0 && (
                <>
                  {status.queuedAssignments > 0 && <span className="text-orange-400">•</span>}
                  <FileText className="w-3.5 h-3.5" />
                  <span>{status.queuedReports}</span>
                </>
              )}
              {nextRetryText && (
                <>
                  <span className="text-orange-400">•</span>
                  <Clock className="w-3.5 h-3.5" />
                  <span>{nextRetryText}</span>
                </>
              )}
            </div>
          )}
          
          {/* Blocked Reports */}
          {status.blockedReports > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 text-amber-600 text-xs font-medium border border-amber-200">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{status.blockedReports} blocked</span>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
