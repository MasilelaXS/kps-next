/**
 * Browser Notification Hook
 * Shows native browser notifications when new notifications arrive
 */

import { useEffect, useRef, useState } from 'react';
import { buildApiUrl } from '@/lib/api';

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  created_at: string;
}

export function useBrowserNotifications() {
  const previousCountRef = useRef<number>(0);
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    // Check if browser supports notifications
    if (!('Notification' in window)) {
      console.log('[BrowserNotifications] Not supported');
      return;
    }

    setPermission(Notification.permission);

    // Request permission if not already granted or denied
    if (Notification.permission === 'default') {
      Notification.requestPermission().then(perm => {
        setPermission(perm);
      });
    }
  }, []);

  const checkForNewNotifications = async () => {
    if (!navigator.onLine || Notification.permission !== 'granted') {
      return;
    }

    try {
      const token = localStorage.getItem('kps_token');
      if (!token) return;

      const response = await fetch(buildApiUrl('/api/notifications?unread_only=true&limit=5'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const result = await response.json();
        const unreadCount = result.data.unread || 0;
        const notifications: Notification[] = result.data.notifications || [];

        // If unread count increased, show browser notification for new ones
        if (unreadCount > previousCountRef.current && notifications.length > 0) {
          const newCount = unreadCount - previousCountRef.current;
          
          // Show notification for the most recent one
          const latest = notifications[0];
          showBrowserNotification(latest.title, latest.message, latest.type);

          // If multiple new notifications, show a summary
          if (newCount > 1) {
            setTimeout(() => {
              showBrowserNotification(
                `${newCount} New Notifications`,
                'You have multiple new notifications',
                'system'
              );
            }, 500);
          }
        }

        previousCountRef.current = unreadCount;
      }
    } catch (error) {
      // Silently fail - don't spam console
      if (navigator.onLine) {
        console.error('[BrowserNotifications] Check failed:', error);
      }
    }
  };

  const showBrowserNotification = (title: string, body: string, type: string) => {
    if (Notification.permission !== 'granted') return;

    // Don't show if tab is focused
    if (!document.hidden) return;

    const iconMap: { [key: string]: string } = {
      'assignment': '📋',
      'report_submitted': '📝',
      'report_declined': '❌',
      'report_approved': '✅',
      'system_update': '🔔',
      'system': '🔔'
    };

    const icon = iconMap[type] || '🔔';

    const notification = new Notification(`${icon} ${title}`, {
      body,
      icon: '/icons/192.png',
      badge: '/icons/96.png',
      tag: `kps-${type}`,
      requireInteraction: false,
      silent: false
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    // Auto-close after 10 seconds
    setTimeout(() => notification.close(), 10000);
  };

  useEffect(() => {
    // Initial check
    checkForNewNotifications();

    // Poll every 15 seconds
    const interval = setInterval(checkForNewNotifications, 15000);

    // Listen for visibility change to check when user returns to tab
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        checkForNewNotifications();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [permission]);

  return { permission };
}
