'use client';

import { useEffect, useState } from 'react';
import { serviceWorkerManager } from '@/lib/serviceWorkerManager';
import AlertModal from '@/components/AlertModal';

export default function ServiceWorkerRegistration() {
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  useEffect(() => {
    // Service worker manager handles registration automatically in production
    // We just listen for update events
    const handleServiceWorkerUpdate = () => {
      setShowUpdateModal(true);
    };

    // Listen for custom update event from serviceWorkerManager
    window.addEventListener('serviceWorkerUpdate', handleServiceWorkerUpdate);

    return () => {
      window.removeEventListener('serviceWorkerUpdate', handleServiceWorkerUpdate);
    };
  }, []);

  const handleUpdate = async () => {
    try {
      // Activate the new service worker
      await serviceWorkerManager.activateUpdate();
      setShowUpdateModal(false);
      // Reload will happen automatically when new SW takes control
    } catch (error) {
      console.error('[SW] Error activating update:', error);
      // Fallback to manual reload
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
