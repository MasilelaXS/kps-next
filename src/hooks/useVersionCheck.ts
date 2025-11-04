'use client';

import { useEffect, useState } from 'react';
import { buildApiUrl } from '@/lib/api';

interface UseVersionCheckReturn {
  needsUpdate: boolean;
  forceUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  updateMessage: string;
  dismissUpdate: () => void;
}

const CURRENT_APP_VERSION = '1.0.0'; // Update this with each release
const VERSION_CHECK_INTERVAL = 300000; // 5 minutes

export function useVersionCheck(): UseVersionCheckReturn {
  const [needsUpdate, setNeedsUpdate] = useState(false);
  const [forceUpdate, setForceUpdate] = useState(false);
  const [latestVersion, setLatestVersion] = useState('');
  const [updateMessage, setUpdateMessage] = useState('');
  const [dismissed, setDismissed] = useState(false);

  const checkVersion = async () => {
    try {
      // Add cache-busting parameter to ensure fresh data
      const timestamp = new Date().getTime();
      const response = await fetch(buildApiUrl(`/api/version/current?current_version=${CURRENT_APP_VERSION}&platform=web&_t=${timestamp}`), {
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

        // Log version check
        console.log('Version Check:', {
          current: CURRENT_APP_VERSION,
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
    // Check immediately on mount
    checkVersion();

    // Set up periodic checking
    const interval = setInterval(checkVersion, VERSION_CHECK_INTERVAL);

    return () => clearInterval(interval);
  }, [dismissed]);

  const dismissUpdate = () => {
    if (!forceUpdate) {
      setDismissed(true);
      setNeedsUpdate(false);
    }
  };

  return {
    needsUpdate: needsUpdate && !dismissed,
    forceUpdate,
    currentVersion: CURRENT_APP_VERSION,
    latestVersion,
    updateMessage,
    dismissUpdate
  };
}
