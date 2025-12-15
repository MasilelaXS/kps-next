import { Request, Response } from 'express';
import { hasRole } from '../middleware/auth';
import { executeQuery, executeQuerySingle } from '../config/database';
import { logger } from '../config/logger';
import { sendPushNotification } from '../services/pushNotificationService';

/**
 * Helper function to create a notification
 * Can be called from other controllers without HTTP context
 * 
 * @param userId - The ID of the user to notify
 * @param type - Type of notification: 'assignment', 'report_declined', 'report_submitted', 'system_update'
 * @param title - Notification title
 * @param message - Notification message
 * @returns The created notification ID or null if failed
 */
export const createNotification = async (
  userId: number,
  type: 'assignment' | 'report_declined' | 'report_submitted' | 'system_update',
  title: string,
  message: string
): Promise<number | null> => {
  try {
    const result = await executeQuery(
      `INSERT INTO notifications (user_id, type, title, message)
       VALUES (?, ?, ?, ?)`,
      [userId, type, title, message]
    );
    
    const notificationId = (result as any).insertId;
    logger.info(`Notification created for user ${userId}: ${title}`);
    
    // Send push notification (don't wait for it, fire and forget)
    sendPushNotification(userId, {
      title,
      body: message,
      icon: '/icons/192.png',
      data: {
        type,
        notificationId,
        timestamp: Date.now()
      }
    }).catch(error => {
      logger.error('Error sending push notification:', error);
    });
    
    return notificationId;
  } catch (error) {
    logger.error('Error creating notification:', error);
    return null;
  }
};

/**
 * Get notifications for the authenticated user
 * Supports filtering by read status and pagination
 */
export const getNotifications = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const { unread_only, limit = 20, offset = 0 } = req.query;

    const maxLimit = Math.min(parseInt(limit as string) || 20, 100);
    const offsetValue = parseInt(offset as string) || 0;

    const conditions: string[] = ['user_id = ?'];
    const params: any[] = [userId];

    // Filter by read status
    if (unread_only === 'true' || unread_only === '1') {
      conditions.push('read_at IS NULL');
    }

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM notifications
      WHERE ${conditions.join(' AND ')}
    `;
    const countResult = await executeQuerySingle(countQuery, params);
    const totalCount = (countResult as any)?.total || 0;

    // Get notifications
    const query = `
      SELECT 
        id,
        type,
        title,
        message,
        read_at,
        created_at
      FROM notifications
      WHERE ${conditions.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;

    params.push(maxLimit, offsetValue);
    const notifications = await executeQuery(query, params);

    // Get unread count
    const unreadQuery = `
      SELECT COUNT(*) as unread
      FROM notifications
      WHERE user_id = ? AND read_at IS NULL
    `;
    const unreadResult = await executeQuerySingle(unreadQuery, [userId]);
    const unreadCount = (unreadResult as any)?.unread || 0;

    logger.info(`Retrieved ${(notifications as any[]).length} notifications for user ${userId}`);

    res.json({
      success: true,
      data: {
        total: totalCount,
        unread: unreadCount,
        limit: maxLimit,
        offset: offsetValue,
        notifications
      }
    });

  } catch (error) {
    logger.error('Error getting notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve notifications'
    });
  }
};

/**
 * Mark a notification as read
 */
export const markAsRead = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const notificationId = parseInt(req.params.id);

    if (isNaN(notificationId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid notification ID'
      });
      return;
    }

    // Check if notification exists and belongs to user
    const notification = await executeQuerySingle(
      'SELECT id, read_at FROM notifications WHERE id = ? AND user_id = ?',
      [notificationId, userId]
    );

    if (!notification) {
      res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
      return;
    }

    // Check if already read
    if ((notification as any).read_at) {
      res.json({
        success: true,
        message: 'Notification already marked as read',
        data: { notification }
      });
      return;
    }

    // Mark as read
    await executeQuery(
      'UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE id = ?',
      [notificationId]
    );

    // Get updated notification
    const updatedNotification = await executeQuerySingle(
      'SELECT id, type, title, message, read_at, created_at FROM notifications WHERE id = ?',
      [notificationId]
    );

    logger.info(`Notification ${notificationId} marked as read by user ${userId}`);

    res.json({
      success: true,
      message: 'Notification marked as read',
      data: { notification: updatedNotification }
    });

  } catch (error) {
    logger.error('Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read'
    });
  }
};

/**
 * Send a notification to a user
 * Admin only - used for system notifications
 */
export const sendNotification = async (req: Request, res: Response): Promise<void> => {
  try {
    const currentUserId = (req as any).user.id;
    const currentUserRole = (req as any).user.role;

    // Only admins can send notifications
    if (currentUserRole !== 'admin') {
      res.status(403).json({
        success: false,
        message: 'Only administrators can send notifications'
      });
      return;
    }

    const { user_id, type, title, message } = req.body;

    // Validate required fields
    if (!user_id || !type || !title || !message) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields: user_id, type, title, message'
      });
      return;
    }

    // Validate notification type
    const validTypes = ['assignment', 'report_declined', 'report_submitted', 'system_update'];
    if (!validTypes.includes(type)) {
      res.status(400).json({
        success: false,
        message: `Invalid notification type. Must be one of: ${validTypes.join(', ')}`
      });
      return;
    }

    // Validate user exists
    const user = await executeQuerySingle(
      'SELECT id, name FROM users WHERE id = ? AND status = ? AND deleted_at IS NULL',
      [user_id, 'active']
    );

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found or inactive'
      });
      return;
    }

    // Create notification
    const result = await executeQuery(
      `INSERT INTO notifications (user_id, type, title, message)
       VALUES (?, ?, ?, ?)`,
      [user_id, type, title, message]
    );

    const notificationId = (result as any).insertId;

    // Get created notification
    const notification = await executeQuerySingle(
      'SELECT id, user_id, type, title, message, read_at, created_at FROM notifications WHERE id = ?',
      [notificationId]
    );

    logger.info(`Notification sent to user ${user_id} by admin ${currentUserId}`);

    // Send push notification (fire and forget)
    sendPushNotification(user_id, {
      title,
      body: message,
      icon: '/icons/192.png',
      data: {
        type,
        notificationId,
        timestamp: Date.now()
      }
    }).catch(error => {
      logger.error('Error sending push notification:', error);
    });

    res.status(201).json({
      success: true,
      message: 'Notification sent successfully',
      data: { notification }
    });

  } catch (error) {
    logger.error('Error sending notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send notification'
    });
  }
};

/**
 * Mark all notifications as read for the authenticated user
 */
export const markAllAsRead = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.id;

    // Get count of unread notifications
    const countResult = await executeQuerySingle(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read_at IS NULL',
      [userId]
    );
    const unreadCount = (countResult as any)?.count || 0;

    if (unreadCount === 0) {
      res.json({
        success: true,
        message: 'No unread notifications',
        data: { updated: 0 }
      });
      return;
    }

    // Mark all as read
    await executeQuery(
      'UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE user_id = ? AND read_at IS NULL',
      [userId]
    );

    logger.info(`${unreadCount} notifications marked as read for user ${userId}`);

    res.json({
      success: true,
      message: `${unreadCount} notification(s) marked as read`,
      data: { updated: unreadCount }
    });

  } catch (error) {
    logger.error('Error marking all notifications as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark notifications as read'
    });
  }
};

/**
 * Delete a notification
 * Users can only delete their own notifications
 */
export const deleteNotification = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const notificationId = parseInt(req.params.id);

    if (isNaN(notificationId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid notification ID'
      });
      return;
    }

    // Check if notification exists and belongs to user
    const notification = await executeQuerySingle(
      'SELECT id FROM notifications WHERE id = ? AND user_id = ?',
      [notificationId, userId]
    );

    if (!notification) {
      res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
      return;
    }

    // Delete notification
    await executeQuery(
      'DELETE FROM notifications WHERE id = ?',
      [notificationId]
    );

    logger.info(`Notification ${notificationId} deleted by user ${userId}`);

    res.json({
      success: true,
      message: 'Notification deleted successfully'
    });

  } catch (error) {
    logger.error('Error deleting notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete notification'
    });
  }
};
