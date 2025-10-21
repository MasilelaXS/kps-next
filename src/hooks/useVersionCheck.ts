'use client';

import { useEffect, useState } from 'react';

interface VersionInfo {
  version: string;
  minimum_version: string;
  force_update: boolean;
  update_message: string | null;
}

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
      const response = await fetch('http://192.168.1.128:3001/api/version/current');
      
      if (!response.ok) {
        console.warn('Version check failed:', response.statusText);
        return;
      }

      const data = await response.json();
      
      if (data.success && data.data) {
        const versionInfo: VersionInfo = data.data;
        
        // Safety check for undefined versions
        if (!versionInfo.version || !versionInfo.minimum_version) {
          console.warn('Version info incomplete:', versionInfo);
          return;
        }
        
        setLatestVersion(versionInfo.version);
        setUpdateMessage(versionInfo.update_message || 'A new version is available');

        // Compare versions
        const needsUpdateCheck = compareVersions(CURRENT_APP_VERSION, versionInfo.version) < 0;
        const forceUpdateCheck = compareVersions(CURRENT_APP_VERSION, versionInfo.minimum_version) < 0;

        setNeedsUpdate(needsUpdateCheck && !dismissed);
        setForceUpdate(forceUpdateCheck);

        // Log version check
        console.log('Version Check:', {
          current: CURRENT_APP_VERSION,
          latest: versionInfo.version,
          minimum: versionInfo.minimum_version,
          needsUpdate: needsUpdateCheck,
          forceUpdate: forceUpdateCheck
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

/**
 * Compare two semantic version strings
 * Returns: -1 if v1 < v2, 0 if v1 === v2, 1 if v1 > v2
 */
function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const part1 = parts1[i] || 0;
    const part2 = parts2[i] || 0;

    if (part1 < part2) return -1;
    if (part1 > part2) return 1;
  }

  return 0;
}
