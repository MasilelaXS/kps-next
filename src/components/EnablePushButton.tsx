'use client';

import { useState, useEffect } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { buildApiUrl } from '@/lib/api';

export default function EnablePushButton() {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    checkSubscriptionStatus();
  }, []);

  const checkSubscriptionStatus = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setSupported(false);
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch (error) {
      console.error('Error checking subscription:', error);
    }
  };

  const handleEnablePush = async () => {
    if (!window.isSecureContext) {
      alert('Push notifications require HTTPS or localhost');
      return;
    }

    setLoading(true);

    try {
      // Request permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        alert('Please allow notifications to continue');
        setLoading(false);
        return;
      }

      // Get service worker
      const registration = await navigator.serviceWorker.ready;

      // Get VAPID key
      const token = localStorage.getItem('kps_token');
      const keyResponse = await fetch(buildApiUrl('/api/push/vapid-public-key'));
      
      if (!keyResponse.ok) {
        throw new Error('Failed to get VAPID key');
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
        body: JSON.stringify(subscription)
      });

      if (response.ok) {
        setIsSubscribed(true);
        alert('✅ Push notifications enabled!');
      } else {
        throw new Error('Failed to save subscription');
      }
    } catch (error) {
      console.error('Error enabling push:', error);
      alert('Failed to enable push notifications. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!supported) {
    return null;
  }

  if (isSubscribed) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-green-50 text-green-700 rounded-lg text-sm">
        <Bell className="w-4 h-4" />
        <span>Notifications enabled</span>
      </div>
    );
  }

  return (
    <button
      onClick={handleEnablePush}
      disabled={loading}
      className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 text-sm font-medium"
    >
      <BellOff className="w-4 h-4" />
      <span>{loading ? 'Enabling...' : 'Enable Notifications'}</span>
    </button>
  );
}
