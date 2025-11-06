'use client';

import { useEffect, useState } from 'react';
import AlertModal from '@/components/AlertModal';

export default function ServiceWorkerRegistration() {
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [newWorker, setNewWorker] = useState<ServiceWorker | null>(null);
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      // Register service worker
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          // Check for updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // New service worker available
                  setNewWorker(newWorker);
                  setShowUpdateModal(true);
                }
              });
            }
          });
        })
        .catch((error) => {
          if (process.env.NODE_ENV === 'development') {
            console.error('[PWA] Service Worker registration failed:', error);
          }
        });

      // Handle controller change (new SW activated)
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('[PWA] New Service Worker activated');
      });

      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        console.log('[PWA] Message from SW:', event.data);
      });
    }
  }, []);

  const handleUpdate = () => {
    if (newWorker) {
      newWorker.postMessage({ type: 'SKIP_WAITING' });
      window.location.reload();
    }
  };

  return (
    <AlertModal
      isOpen={showUpdateModal}
      title="New Version Available"
      message="A new version of the app is available. Would you like to reload and update now?"
      type="info"
      confirmText="Update Now"
      cancelText="Later"
      onConfirm={handleUpdate}
      onCancel={() => setShowUpdateModal(false)}
      onClose={() => setShowUpdateModal(false)}
    />
  );
}
