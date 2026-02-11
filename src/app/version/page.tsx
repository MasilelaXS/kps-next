'use client';

import { useEffect, useState } from 'react';

export default function VersionPage() {
  const [embeddedVersion, setEmbeddedVersion] = useState<string>('...');
  const [serverVersion, setServerVersion] = useState<string>('...');
  const [buildTime, setBuildTime] = useState<string>('...');
  const [localStorageData, setLocalStorageData] = useState<any>({});

  useEffect(() => {
    // Get embedded version (baked into JavaScript bundle)
    const embedded = process.env.NEXT_PUBLIC_APP_VERSION || 'dev';
    setEmbeddedVersion(embedded);

    // Fetch server version
    fetch(`/version.json?_t=${Date.now()}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(data => {
        setServerVersion(data.version);
        if (data.timestamp) {
          setBuildTime(new Date(data.timestamp).toLocaleString());
        }
      })
      .catch(err => {
        console.error('Failed to fetch server version:', err);
        setServerVersion('Error');
      });

    // Get localStorage version data
    const data = {
      dismissed: localStorage.getItem('kps-version-dismissed'),
      lastUpdate: localStorage.getItem('kps-last-update-version'),
      updateTimestamp: localStorage.getItem('kps-update-timestamp'),
    };
    setLocalStorageData(data);
  }, []);

  const clearLocalStorage = () => {
    localStorage.removeItem('kps-version-dismissed');
    localStorage.removeItem('kps-last-update-version');
    localStorage.removeItem('kps-update-timestamp');
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Version Information</h1>

        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Current Versions</h2>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center p-4 bg-blue-50 rounded">
              <span className="font-medium">Embedded Version (in JS bundle):</span>
              <span className="text-2xl font-bold text-blue-600">{embeddedVersion}</span>
            </div>

            <div className="flex justify-between items-center p-4 bg-green-50 rounded">
              <span className="font-medium">Server Version (version.json):</span>
              <span className="text-2xl font-bold text-green-600">{serverVersion}</span>
            </div>

            <div className="flex justify-between items-center p-4 bg-gray-50 rounded">
              <span className="font-medium">Build Time:</span>
              <span className="text-sm text-gray-700">{buildTime}</span>
            </div>
          </div>

          {embeddedVersion !== serverVersion && embeddedVersion !== 'dev' && serverVersion !== 'Error' && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded">
              <p className="text-yellow-800 font-semibold">⚠️ Version Mismatch Detected!</p>
              <p className="text-sm text-yellow-700 mt-1">
                The version check modal should appear. If it doesn't, check the console.
              </p>
            </div>
          )}

          {embeddedVersion === serverVersion && embeddedVersion !== '...' && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded">
              <p className="text-green-800 font-semibold">✅ Versions Match!</p>
              <p className="text-sm text-green-700 mt-1">
                App is up to date. No update modal should appear.
              </p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">LocalStorage State</h2>
          
          <div className="space-y-2 font-mono text-sm">
            <div className="flex justify-between p-2 bg-gray-50 rounded">
              <span>Dismissed Version:</span>
              <span className="text-gray-700">{localStorageData.dismissed || 'None'}</span>
            </div>
            <div className="flex justify-between p-2 bg-gray-50 rounded">
              <span>Last Update Target:</span>
              <span className="text-gray-700">{localStorageData.lastUpdate || 'None'}</span>
            </div>
            <div className="flex justify-between p-2 bg-gray-50 rounded">
              <span>Update Timestamp:</span>
              <span className="text-gray-700">
                {localStorageData.updateTimestamp 
                  ? new Date(parseInt(localStorageData.updateTimestamp)).toLocaleString()
                  : 'None'}
              </span>
            </div>
          </div>

          <button
            onClick={clearLocalStorage}
            className="mt-4 w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Clear LocalStorage & Reload
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Test Instructions</h2>
          
          <ol className="list-decimal list-inside space-y-2 text-gray-700">
            <li>Note the current <strong>Embedded Version</strong> above</li>
            <li>Run <code className="bg-gray-100 px-2 py-1 rounded">npm run build</code> to increment version</li>
            <li>Deploy the new build to production (update <code className="bg-gray-100 px-2 py-1 rounded">.next/</code> folder)</li>
            <li>Refresh this page (without clearing cache)</li>
            <li>You should see:
              <ul className="list-disc list-inside ml-6 mt-1">
                <li>Embedded version stays the same (old bundle in cache)</li>
                <li>Server version increases (new version.json)</li>
                <li>Update modal should appear</li>
              </ul>
            </li>
            <li>Click "Update Now" in the modal</li>
            <li>After reload, both versions should match the new version</li>
          </ol>
        </div>

        <div className="mt-6 p-4 bg-blue-50 rounded-lg text-center">
          <a href="/" className="text-blue-600 hover:underline font-medium">
            ← Back to Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
