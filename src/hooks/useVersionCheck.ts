'use client';

import { useEffect, useState } from 'react';
import { preloadCache } from '@/lib/preloadCache';
import { serviceWorkerManager } from '@/lib/serviceWorkerManager';

interface UseVersionCheckReturn {
  needsUpdate: boolean;
  forceUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  updateMessage: string;
  dismissUpdate: () => void;
  handleUpdate: () => Promise<void>;
}

const DEFAULT_APP_VERSION = 'dev';
const VERSION_CHECK_INTERVAL = 300000; // 5 minutes
const STORAGE_KEY_DISMISSED = 'kps-version-dismissed';
const STORAGE_KEY_LAST_UPDATE = 'kps-last-update-version';
const STORAGE_KEY_UPDATE_TIMESTAMP = 'kps-update-timestamp';
const UPDATE_COOLDOWN_MS = 10000; // Don't check for 10 seconds after update

// Get version embedded at build time
const getEmbeddedVersion = (): string => {
  return process.env.NEXT_PUBLIC_APP_VERSION || DEFAULT_APP_VERSION;
};

// Compare semantic versions (returns -1 if v1 < v2, 0 if equal, 1 if v1 > v2)
const compareVersions = (version1: string, version2: string): number => {
  const v1parts = version1.split('.').map(Number);
  const v2parts = version2.split('.').map(Number);
  
  for (let i = 0; i < 3; i++) {
    const v1part = v1parts[i] || 0;
    const v2part = v2parts[i] || 0;
    
    if (v1part > v2part) return 1;
    if (v1part < v2part) return -1;
  }
  return 0;
};

export function useVersionCheck(): UseVersionCheckReturn {
  const [needsUpdate, setNeedsUpdate] = useState(false);
  const [forceUpdate, setForceUpdate] = useState(false);
  const [latestVersion, setLatestVersion] = useState('');
  const [updateMessage, setUpdateMessage] = useState('');
  const [dismissed, setDismissed] = useState(false);
  const [updateHandled, setUpdateHandled] = useState(false);
  
  // Get version embedded at build time (this is the actual running code version)
  const currentVersion = getEmbeddedVersion();

  const refreshCaches = async (): Promise<void> => {
    try {
      // Ask service worker to update
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          await registration.update();
          if (registration.waiting) {
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
        }
      }

      // Clear cached assets
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames
            .filter((name) => name.startsWith('kps-'))
            .map((name) => caches.delete(name))
        );
      }

      // Refresh data caches in background
      await preloadCache.forcePreload('both');
    } catch (error) {
      console.warn('Cache refresh failed:', error);
    }
  };

  const checkVersion = async () => {
    try {
      // Check if we just performed an update (prevent infinite loop)
      const updateTimestamp = localStorage.getItem(STORAGE_KEY_UPDATE_TIMESTAMP);
      if (updateTimestamp) {
        const timeSinceUpdate = Date.now() - parseInt(updateTimestamp, 10);
        if (timeSinceUpdate < UPDATE_COOLDOWN_MS) {
          console.log(`[Version] Update cooldown active (${Math.round(timeSinceUpdate / 1000)}s ago), skipping check`);
          setNeedsUpdate(false);
          return;
        } else {
          // Cooldown expired - check if the update actually succeeded
          const targetVersion = localStorage.getItem(STORAGE_KEY_LAST_UPDATE);
          if (targetVersion && targetVersion !== currentVersion) {
            console.warn(`[Version] Update to ${targetVersion} failed - still on ${currentVersion}`);
            console.warn('[Version] Server may not have new version deployed yet');
            // Extend cooldown and try again later
            localStorage.setItem(STORAGE_KEY_UPDATE_TIMESTAMP, Date.now().toString());
            setNeedsUpdate(false);
            return;
          }
          
          // Update succeeded or was for different version, clear flags
          console.log('[Version] Update cooldown expired, clearing timestamp');
          localStorage.removeItem(STORAGE_KEY_UPDATE_TIMESTAMP);
          localStorage.removeItem(STORAGE_KEY_LAST_UPDATE);
        }
      }

      // Check if update was dismissed for this app version
      const dismissedVersion = localStorage.getItem(STORAGE_KEY_DISMISSED);
      if (dismissedVersion === currentVersion) {
        setDismissed(true);
        setNeedsUpdate(false);
        return;
      }

      // Fetch latest version from server (cache-busted to get fresh data)
      const timestamp = Date.now();
      const response = await fetch(`/version.json?_v=${timestamp}`, { 
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) {
        console.warn('[Version] Check failed:', response.statusText);
        return;
      }

      const serverVersion = await response.json();
      
      if (!serverVersion?.version) {
        console.warn('[Version] Invalid version data from server');
        return;
      }

      const latestVer = serverVersion.version;
      
      // Compare versions
      const comparison = compareVersions(latestVer, currentVersion);
      const updateAvailable = comparison > 0;
      
      setLatestVersion(latestVer);
      setUpdateMessage(`Version ${latestVer} is available with new features and improvements.`);

      // Only show update modal if there's actually an update AND not dismissed
      if (updateAvailable && !dismissed) {
        setNeedsUpdate(true);
        setForceUpdate(false); // No forced updates for now
        console.log('[Version] Update available:', {
          current: currentVersion,
          latest: latestVer
        });
      } else {
        setNeedsUpdate(false);
        setForceUpdate(false);
      }
    } catch (error) {
      console.error('[Version] Check error:', error);
    }
  };

  useEffect(() => {
    // Run initial version check after a short delay
    const initialCheckTimer = setTimeout(() => {
      checkVersion();
    }, 3000); // Wait 3 seconds after page load

    // Set up periodic checking
    const interval = setInterval(checkVersion, VERSION_CHECK_INTERVAL);

    return () => {
      clearTimeout(initialCheckTimer);
      clearInterval(interval);
    };
  }, [dismissed, currentVersion]);

  const dismissUpdate = () => {
    if (!forceUpdate) {
      // Store the dismissed version to prevent showing again for this version
      localStorage.setItem(STORAGE_KEY_DISMISSED, currentVersion);
      setDismissed(true);
      setNeedsUpdate(false);
      console.log('[Version] Update dismissed for version:', currentVersion);
    }
  };

  const handleUpdate = async () => {
    try {
      console.log('[Version] Starting update process...');
      
      // Prevent multiple update attempts
      if (updateHandled) {
        console.log('[Version] Update already in progress');
        return;
      }
      setUpdateHandled(true);

      // Mark the update timestamp (prevents infinite loop)
      const timestamp = Date.now().toString();
      localStorage.setItem(STORAGE_KEY_UPDATE_TIMESTAMP, timestamp);
      localStorage.setItem(STORAGE_KEY_LAST_UPDATE, latestVersion);
      console.log('[Version] Marked update timestamp:', timestamp, 'to version:', latestVersion);

      // Step 1: Clear service worker caches (but don't unregister - it will re-register with new version)
      console.log('[Version] Clearing service worker caches...');
      await serviceWorkerManager.clearCaches();

      // Step 2: Clear dismissed version flag (but keep last-update flag)
      localStorage.removeItem(STORAGE_KEY_DISMISSED);

      console.log('[Version] Caches cleared, performing hard reload...');
      
      // Step 3: Wait briefly for cleanup
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Step 4: Hard reload to fetch new bundles
      // Service worker will automatically re-register with new version on next load
      window.location.reload();
      
    } catch (error) {
      console.error('[Version] Update error:', error);
      // Emergency fallback
      window.location.reload();
    }
  };

  return {
    needsUpdate: needsUpdate && !dismissed,
    forceUpdate,
    currentVersion,
    latestVersion,
    updateMessage,
    dismissUpdate,
    handleUpdate
  };
}
