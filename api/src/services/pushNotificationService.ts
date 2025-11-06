import webpush from 'web-push';
import { executeQuery } from '../config/database';
import { logger } from '../config/logger';
import { config } from '../config/env';

/**
 * Push Notification Service
 * Handles web push notifications using VAPID protocol
 */

// VAPID keys for push notifications
// Use production config (hardcoded) or fallback to .env for development
const VAPID_PUBLIC_KEY = config.push?.vapidPublicKey || process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = config.push?.vapidPrivateKey || process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = config.push?.vapidSubject || process.env.VAPID_SUBJECT || 'mailto:admin@kpspestcontrol.co.za';

// Initialize web-push with VAPID details
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    VAPID_SUBJECT,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
  logger.info('✓ Push notifications initialized with VAPID keys');
} else {
  logger.warn('⚠️  VAPID keys not configured. Push notifications will not work.');
  logger.warn('   Generate keys using: npx web-push generate-vapid-keys');
}

export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

/**
 * Subscribe user to push notifications
 */
export const subscribeToPush = async (
  userId: number,
  subscription: PushSubscription
): Promise<boolean> => {
  try {
    // Check if subscription already exists
    const existing = await executeQuery(
      'SELECT id FROM push_subscriptions WHERE user_id = ? AND endpoint = ?',
      [userId, subscription.endpoint]
    );

    if ((existing as any[]).length > 0) {
      // Update existing subscription
      await executeQuery(
        `UPDATE push_subscriptions 
         SET p256dh = ?, auth = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE user_id = ? AND endpoint = ?`,
        [subscription.keys.p256dh, subscription.keys.auth, userId, subscription.endpoint]
      );
      logger.info(`Push subscription updated for user ${userId}`);
    } else {
      // Create new subscription
      await executeQuery(
        `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) 
         VALUES (?, ?, ?, ?)`,
        [userId, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth]
      );
      logger.info(`Push subscription created for user ${userId}`);
    }

    return true;
  } catch (error) {
    logger.error('Error subscribing to push:', error);
    return false;
  }
};

/**
 * Unsubscribe user from push notifications
 */
export const unsubscribeFromPush = async (
  userId: number,
  endpoint: string
): Promise<boolean> => {
  try {
    await executeQuery(
      'DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?',
      [userId, endpoint]
    );
    logger.info(`Push subscription removed for user ${userId}`);
    return true;
  } catch (error) {
    logger.error('Error unsubscribing from push:', error);
    return false;
  }
};

/**
 * Get all push subscriptions for a user
 */
export const getUserPushSubscriptions = async (userId: number): Promise<PushSubscription[]> => {
  try {
    const subscriptions = await executeQuery(
      'SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?',
      [userId]
    );

    return (subscriptions as any[]).map(sub => ({
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.p256dh,
        auth: sub.auth
      }
    }));
  } catch (error) {
    logger.error('Error getting user push subscriptions:', error);
    return [];
  }
};

/**
 * Send push notification to a user
 */
export const sendPushNotification = async (
  userId: number,
  payload: {
    title: string;
    body: string;
    icon?: string;
    badge?: string;
    data?: any;
  }
): Promise<{ sent: number; failed: number }> => {
  try {
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      logger.warn('Cannot send push notification: VAPID keys not configured');
      return { sent: 0, failed: 0 };
    }

    const subscriptions = await getUserPushSubscriptions(userId);
    
    if (subscriptions.length === 0) {
      logger.info(`No push subscriptions found for user ${userId}`);
      return { sent: 0, failed: 0 };
    }

    const notificationPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon || '/icons/192.png',
      badge: payload.badge || '/icons/192.png',
      data: payload.data || {},
      timestamp: Date.now()
    });

    let sent = 0;
    let failed = 0;

    // Send to all user's subscriptions
    await Promise.all(
      subscriptions.map(async (subscription) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: {
                p256dh: subscription.keys.p256dh,
                auth: subscription.keys.auth
              }
            },
            notificationPayload
          );
          
          sent++;
          logger.info(`Push notification sent to user ${userId}`);
        } catch (error: any) {
          failed++;
          
          // If subscription is invalid or expired, remove it
          if (error.statusCode === 410 || error.statusCode === 404) {
            logger.info(`Removing expired push subscription for user ${userId}`);
            await unsubscribeFromPush(userId, subscription.endpoint);
          } else {
            logger.error(`Error sending push notification to user ${userId}:`, error);
          }
        }
      })
    );

    return { sent, failed };
  } catch (error) {
    logger.error('Error in sendPushNotification:', error);
    return { sent: 0, failed: 0 };
  }
};

/**
 * Send push notification to multiple users
 */
export const sendPushToMultipleUsers = async (
  userIds: number[],
  payload: {
    title: string;
    body: string;
    icon?: string;
    badge?: string;
    data?: any;
  }
): Promise<{ totalSent: number; totalFailed: number }> => {
  let totalSent = 0;
  let totalFailed = 0;

  await Promise.all(
    userIds.map(async (userId) => {
      const result = await sendPushNotification(userId, payload);
      totalSent += result.sent;
      totalFailed += result.failed;
    })
  );

  return { totalSent, totalFailed };
};

/**
 * Get the public VAPID key for frontend
 */
export const getPublicVapidKey = (): string => {
  return VAPID_PUBLIC_KEY;
};

/**
 * Check if push notifications are configured
 */
export const isPushConfigured = (): boolean => {
  return !!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
};
