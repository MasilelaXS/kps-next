'use client';

import { useState, useEffect } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { buildApiUrl } from '@/lib/api';
import { useNotification } from '@/contexts/NotificationContext';

export default function EnablePushButton() {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [supported, setSupported] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const notification = useNotification();

  useEffect(() => {
    // Check if user is authenticated
    const token = localStorage.getItem('kps_token');
    if (token) {
      setIsAuthenticated(true);
      checkSubscriptionStatus();
    }
  }, []);

  const checkSubscriptionStatus = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setSupported(false);
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        setIsSubscribed(true);
      } else {
        // Auto-enable notifications on every visit (no flag check)
        await handleEnablePush(true); // Silent mode - always attempt
      }
    } catch (error) {
      console.error('Error checking subscription:', error);
    }
  };

  const handleEnablePush = async (silent: boolean = false) => {
    if (!window.isSecureContext) {
      if (!silent) notification.error('Secure Connection Required', 'Push notifications require HTTPS or localhost');
      return;
    }

    setLoading(true);

    try {
      // Request permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        if (!silent) notification.warning('Permission Denied', 'Please allow notifications to receive updates');
        setLoading(false);
        return;
      }

      // Get service worker
      const registration = await navigator.serviceWorker.ready;

      // Get VAPID key
      const token = localStorage.getItem('kps_token');
      const keyResponse = await fetch(buildApiUrl('/api/push/vapid-public-key'));
      
      if (!keyResponse.ok) {
        console.error('Failed to get VAPID key');
        setLoading(false);
        return;
      }

      const { publicKey } = await keyResponse.json();

      // Convert VAPID key
      const urlBase64ToUint8Array = (base64String: string) => {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
          outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
      };

      // Subscribe
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource
      });

      // Save to backend
      const response = await fetch(buildApiUrl('/api/push/subscribe'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ subscription })
      });

      if (response.ok) {
        setIsSubscribed(true);
        console.log('✅ Push notifications enabled!');
        if (!silent) notification.success('Notifications Enabled', 'You will now receive push notifications');
      } else {
        const errorData = await response.json();
        console.error('Failed to save subscription:', errorData);
        if (!silent) notification.error('Failed to Save', 'Could not save notification subscription. Please try again.');
      }
    } catch (error) {
      console.error('Error enabling push:', error);
      if (!silent) notification.error('Failed to Enable', 'Could not enable push notifications. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!supported) {
    return null;
  }

  // Don't show if user is not authenticated
  if (!isAuthenticated) {
    return null;
  }

  if (isSubscribed) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 rounded-lg text-sm border border-emerald-200 dark:border-emerald-800">
        <Bell className="w-4 h-4" />
        <span>Notifications enabled</span>
      </div>
    );
  }

  return (
    <button
      onClick={() => handleEnablePush(false)}
      disabled={loading}
      className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium shadow-sm"
    >
      <BellOff className="w-4 h-4" />
      <span>{loading ? 'Enabling...' : 'Enable Notifications'}</span>
    </button>
  );
}