import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  subscribeToPush,
  unsubscribeFromPush,
  getPublicVapidKey,
  isPushConfigured,
  sendPushNotification
} from '../services/pushNotificationService';
import { logger } from '../config/logger';

const router = Router();

/**
 * GET /api/push/vapid-public-key
 * Get the public VAPID key for push subscription
 */
router.get('/vapid-public-key', (req: Request, res: Response) => {
  try {
    if (!isPushConfigured()) {
      res.status(503).json({
        success: false,
        message: 'Push notifications are not configured on the server'
      });
      return;
    }

    const publicKey = getPublicVapidKey();
    
    res.json({
      success: true,
      publicKey
    });
  } catch (error) {
    logger.error('Error getting VAPID public key:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get VAPID public key',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/push/subscribe
 * Subscribe user to push notifications
 */
router.post('/subscribe', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const { subscription } = req.body;

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      res.status(400).json({
        success: false,
        message: 'Invalid subscription data'
      });
      return;
    }

    if (!subscription.keys.p256dh || !subscription.keys.auth) {
      res.status(400).json({
        success: false,
        message: 'Subscription missing required keys'
      });
      return;
    }

    const success = await subscribeToPush(userId, subscription);

    if (!success) {
      res.status(500).json({
        success: false,
        message: 'Failed to subscribe to push notifications'
      });
      return;
    }

    res.json({
      success: true,
      message: 'Successfully subscribed to push notifications'
    });
  } catch (error) {
    logger.error('Error subscribing to push notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to subscribe to push notifications',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/push/unsubscribe
 * Unsubscribe user from push notifications
 */
router.post('/unsubscribe', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const { endpoint } = req.body;

    if (!endpoint) {
      res.status(400).json({
        success: false,
        message: 'Endpoint is required'
      });
      return;
    }

    const success = await unsubscribeFromPush(userId, endpoint);

    if (!success) {
      res.status(500).json({
        success: false,
        message: 'Failed to unsubscribe from push notifications'
      });
      return;
    }

    res.json({
      success: true,
      message: 'Successfully unsubscribed from push notifications'
    });
  } catch (error) {
    logger.error('Error unsubscribing from push notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to unsubscribe from push notifications',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/push/test
 * Send a test push notification (for testing purposes)
 */
router.post('/test', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const userName = (req as any).user.first_name || 'User';

    const result = await sendPushNotification(userId, {
      title: 'Test Notification',
      body: `Hello ${userName}! Push notifications are working! 🎉`,
      icon: '/icons/192.png',
      data: {
        type: 'test',
        timestamp: Date.now()
      }
    });

    if (result.sent === 0 && result.failed === 0) {
      res.status(404).json({
        success: false,
        message: 'No push subscriptions found for your account'
      });
      return;
    }

    res.json({
      success: true,
      message: 'Test notification sent',
      sent: result.sent,
      failed: result.failed
    });
  } catch (error) {
    logger.error('Error sending test push notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send test notification',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
