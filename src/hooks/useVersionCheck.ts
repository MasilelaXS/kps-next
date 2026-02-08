'use client';

import { useEffect, useState } from 'react';
import { buildApiUrl } from '@/lib/api';
import { preloadCache } from '@/lib/preloadCache';

interface UseVersionCheckReturn {
  needsUpdate: boolean;
  forceUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  updateMessage: string;
  dismissUpdate: () => void;
}

const DEFAULT_APP_VERSION = 'dev';
const VERSION_CHECK_INTERVAL = 300000; // 5 minutes

export function useVersionCheck(): UseVersionCheckReturn {
  const [needsUpdate, setNeedsUpdate] = useState(false);
  const [forceUpdate, setForceUpdate] = useState(false);
  const [latestVersion, setLatestVersion] = useState('');
  const [updateMessage, setUpdateMessage] = useState('');
  const [dismissed, setDismissed] = useState(false);
  const [currentVersion, setCurrentVersion] = useState(DEFAULT_APP_VERSION);
  const [updateHandled, setUpdateHandled] = useState(false);

  const fetchLocalVersion = async (): Promise<string> => {
    try {
      const cacheBuster = `?_t=${Date.now()}`;
      const response = await fetch(`/api/version${cacheBuster}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('Version endpoint failed');
      const data = await response.json();
      return data?.version || DEFAULT_APP_VERSION;
    } catch {
      try {
        const response = await fetch(`/version.json?_t=${Date.now()}`, { cache: 'no-store' });
        if (!response.ok) return DEFAULT_APP_VERSION;
        const data = await response.json();
        return data?.version || DEFAULT_APP_VERSION;
      } catch {
        return DEFAULT_APP_VERSION;
      }
    }
  };

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
      // Add cache-busting parameter to ensure fresh data
      const timestamp = new Date().getTime();
      const response = await fetch(buildApiUrl(`/api/version/current?current_version=${currentVersion}&platform=web&_t=${timestamp}`), {
        cache: 'no-store'
      });
      
      if (!response.ok) {
        console.warn('Version check failed:', response.statusText);
        return;
      }

      const data = await response.json();
      
      if (data.success && data.data) {
        const versionData = data.data;
        
        // Safety check for undefined versions
        if (!versionData.latest_version) {
          console.warn('Version info incomplete:', versionData);
          return;
        }
        
        const latestVer = versionData.latest_version;
        const updateAvailable = versionData.update_available || false;
        const forceUpdateRequired = versionData.force_update || false;
        
        setLatestVersion(latestVer);
        setUpdateMessage(versionData.release_notes || 'A new version is available. Please refresh your browser to get the latest features and fixes.');

        setNeedsUpdate(updateAvailable && !dismissed);
        setForceUpdate(forceUpdateRequired);

        if (updateAvailable && !updateHandled) {
          await refreshCaches();
          setUpdateHandled(true);

          if (forceUpdateRequired) {
            window.location.reload();
          }
        }

        // Log version check
        console.log('Version Check:', {
          current: currentVersion,
          latest: latestVer,
          updateAvailable,
          forceUpdate: forceUpdateRequired,
          message: data.message
        });
      }
    } catch (error) {
      console.error('Version check error:', error);
    }
  };

  useEffect(() => {
    fetchLocalVersion().then((version) => {
      setCurrentVersion(version);
    });
  }, []);

  useEffect(() => {
    checkVersion();

    // Set up periodic checking
    const interval = setInterval(checkVersion, VERSION_CHECK_INTERVAL);

    return () => clearInterval(interval);
  }, [dismissed, currentVersion]);

  const dismissUpdate = () => {
    if (!forceUpdate) {
      setDismissed(true);
      setNeedsUpdate(false);
    }
  };

  return {
    needsUpdate: needsUpdate && !dismissed,
    forceUpdate,
    currentVersion,
    latestVersion,
    updateMessage,
    dismissUpdate
  };
}
