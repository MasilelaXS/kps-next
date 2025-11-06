'use client';

import { useState, useEffect } from 'react';
import { pushManager } from '@/lib/pushNotifications';
import { useNotification } from '@/contexts/NotificationContext';
import Button from './Button';
import { Bell, BellOff, BellRing } from 'lucide-react';

export default function PushNotificationToggle() {
  const notification = useNotification();
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    checkNotificationStatus();
  }, []);

  const checkNotificationStatus = async () => {
    try {
      setChecking(true);
      const supported = pushManager.isSupported();
      setIsSupported(supported);

      if (supported) {
        const perm = pushManager.getPermissionStatus();
        setPermission(perm);

        const subscribed = await pushManager.isSubscribed();
        setIsSubscribed(subscribed);
      }
    } catch (error) {
      console.error('Error checking notification status:', error);
    } finally {
      setChecking(false);
    }
  };

  const handleEnable = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('kps_token');

      if (!token) {
        notification.error('Not Authenticated', 'Please log in to enable notifications');
        return;
      }

      const success = await pushManager.subscribe(token);

      if (success) {
        notification.success('Notifications Enabled', 'You will now receive push notifications');
        setIsSubscribed(true);
        setPermission('granted');
      } else {
        notification.error('Enable Failed', 'Could not enable push notifications. Please check your browser settings.');
      }
    } catch (error) {
      console.error('Error enabling notifications:', error);
      notification.error('Enable Failed', error instanceof Error ? error.message : 'Failed to enable notifications');
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('kps_token');

      if (!token) {
        notification.error('Not Authenticated', 'Please log in to disable notifications');
        return;
      }

      const success = await pushManager.unsubscribe(token);

      if (success) {
        notification.success('Notifications Disabled', 'You will no longer receive push notifications');
        setIsSubscribed(false);
      } else {
        notification.error('Disable Failed', 'Could not disable push notifications');
      }
    } catch (error) {
      console.error('Error disabling notifications:', error);
      notification.error('Disable Failed', error instanceof Error ? error.message : 'Failed to disable notifications');
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('kps_token');

      if (!token) {
        notification.error('Not Authenticated', 'Please log in to send test notification');
        return;
      }

      const success = await pushManager.sendTestNotification(token);

      if (success) {
        notification.success('Test Sent', 'Check for the test notification!');
      } else {
        notification.error('Test Failed', 'Could not send test notification');
      }
    } catch (error) {
      console.error('Error sending test notification:', error);
      notification.error('Test Failed', error instanceof Error ? error.message : 'Failed to send test');
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-blue-600" />
        <span>Checking notification status...</span>
      </div>
    );
  }

  if (!isSupported) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <BellOff className="w-4 h-4" />
        <span>Push notifications not supported in this browser</span>
      </div>
    );
  }

  if (permission === 'denied') {
    return (
      <div className="flex items-center gap-2 text-sm text-amber-600">
        <BellOff className="w-4 h-4" />
        <span>Notifications blocked. Please enable them in your browser settings.</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        {isSubscribed ? (
          <>
            <BellRing className="w-5 h-5 text-green-600" />
            <span className="text-sm font-medium text-green-600">Notifications Enabled</span>
          </>
        ) : (
          <>
            <Bell className="w-5 h-5 text-gray-400" />
            <span className="text-sm font-medium text-gray-600">Notifications Disabled</span>
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        {isSubscribed ? (
          <>
            <Button
              variant="secondary"
              size="xs"
              onClick={handleTest}
              loading={loading}
              disabled={loading}
            >
              Test
            </Button>
            <Button
              variant="danger"
              size="xs"
              onClick={handleDisable}
              loading={loading}
              disabled={loading}
            >
              Disable
            </Button>
          </>
        ) : (
          <Button
            variant="primary"
            size="xs"
            icon={<Bell className="w-3 h-3" />}
            onClick={handleEnable}
            loading={loading}
            disabled={loading}
          >
            Enable Notifications
          </Button>
        )}
      </div>
    </div>
  );
}
