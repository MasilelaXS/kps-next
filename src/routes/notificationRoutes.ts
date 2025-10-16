import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  getNotifications,
  markAsRead,
  sendNotification,
  markAllAsRead,
  deleteNotification
} from '../controllers/notificationController';

const router = Router();

/**
 * @route   GET /api/notifications
 * @desc    Get notifications for authenticated user
 * @access  Private
 * @query   unread_only (optional) - Filter unread only (true/false)
 * @query   limit (optional) - Max results (default 20, max 100)
 * @query   offset (optional) - Pagination offset (default 0)
 */
router.get('/', authenticateToken, getNotifications);

/**
 * @route   PUT /api/notifications/:id/read
 * @desc    Mark a notification as read
 * @access  Private
 * @param   id - Notification ID
 */
router.put('/:id/read', authenticateToken, markAsRead);

/**
 * @route   PUT /api/notifications/mark-all-read
 * @desc    Mark all notifications as read for the user
 * @access  Private
 */
router.put('/mark-all-read', authenticateToken, markAllAsRead);

/**
 * @route   POST /api/notifications/send
 * @desc    Send a notification to a user (Admin only)
 * @access  Private (Admin)
 * @body    user_id - Target user ID
 * @body    type - Notification type (assignment|report_declined|report_submitted|system_update)
 * @body    title - Notification title
 * @body    message - Notification message
 */
router.post('/send', authenticateToken, sendNotification);

/**
 * @route   DELETE /api/notifications/:id
 * @desc    Delete a notification
 * @access  Private
 * @param   id - Notification ID
 */
router.delete('/:id', authenticateToken, deleteNotification);

export default router;
