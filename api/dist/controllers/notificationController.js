"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteNotification = exports.markAllAsRead = exports.sendNotification = exports.markAsRead = exports.getNotifications = exports.createNotification = void 0;
const database_1 = require("../config/database");
const logger_1 = require("../config/logger");
const pushNotificationService_1 = require("../services/pushNotificationService");
const createNotification = async (userId, type, title, message) => {
    try {
        const result = await (0, database_1.executeQuery)(`INSERT INTO notifications (user_id, type, title, message)
       VALUES (?, ?, ?, ?)`, [userId, type, title, message]);
        const notificationId = result.insertId;
        logger_1.logger.info(`Notification created for user ${userId}: ${title}`);
        (0, pushNotificationService_1.sendPushNotification)(userId, {
            title,
            body: message,
            icon: '/icons/192.png',
            data: {
                type,
                notificationId,
                timestamp: Date.now()
            }
        }).catch(error => {
            logger_1.logger.error('Error sending push notification:', error);
        });
        return notificationId;
    }
    catch (error) {
        logger_1.logger.error('Error creating notification:', error);
        return null;
    }
};
exports.createNotification = createNotification;
const getNotifications = async (req, res) => {
    try {
        const userId = req.user.id;
        const { unread_only, limit = 20, offset = 0 } = req.query;
        const maxLimit = Math.min(parseInt(limit) || 20, 100);
        const offsetValue = parseInt(offset) || 0;
        const conditions = ['user_id = ?'];
        const params = [userId];
        if (unread_only === 'true' || unread_only === '1') {
            conditions.push('read_at IS NULL');
        }
        const countQuery = `
      SELECT COUNT(*) as total
      FROM notifications
      WHERE ${conditions.join(' AND ')}
    `;
        const countResult = await (0, database_1.executeQuerySingle)(countQuery, params);
        const totalCount = countResult?.total || 0;
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
        const notifications = await (0, database_1.executeQuery)(query, params);
        const unreadQuery = `
      SELECT COUNT(*) as unread
      FROM notifications
      WHERE user_id = ? AND read_at IS NULL
    `;
        const unreadResult = await (0, database_1.executeQuerySingle)(unreadQuery, [userId]);
        const unreadCount = unreadResult?.unread || 0;
        logger_1.logger.info(`Retrieved ${notifications.length} notifications for user ${userId}`);
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
    }
    catch (error) {
        logger_1.logger.error('Error getting notifications:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve notifications'
        });
    }
};
exports.getNotifications = getNotifications;
const markAsRead = async (req, res) => {
    try {
        const userId = req.user.id;
        const notificationId = parseInt(req.params.id);
        if (isNaN(notificationId)) {
            res.status(400).json({
                success: false,
                message: 'Invalid notification ID'
            });
            return;
        }
        const notification = await (0, database_1.executeQuerySingle)('SELECT id, read_at FROM notifications WHERE id = ? AND user_id = ?', [notificationId, userId]);
        if (!notification) {
            res.status(404).json({
                success: false,
                message: 'Notification not found'
            });
            return;
        }
        if (notification.read_at) {
            res.json({
                success: true,
                message: 'Notification already marked as read',
                data: { notification }
            });
            return;
        }
        await (0, database_1.executeQuery)('UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE id = ?', [notificationId]);
        const updatedNotification = await (0, database_1.executeQuerySingle)('SELECT id, type, title, message, read_at, created_at FROM notifications WHERE id = ?', [notificationId]);
        logger_1.logger.info(`Notification ${notificationId} marked as read by user ${userId}`);
        res.json({
            success: true,
            message: 'Notification marked as read',
            data: { notification: updatedNotification }
        });
    }
    catch (error) {
        logger_1.logger.error('Error marking notification as read:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to mark notification as read'
        });
    }
};
exports.markAsRead = markAsRead;
const sendNotification = async (req, res) => {
    try {
        const currentUserId = req.user.id;
        const currentUserRole = req.user.role;
        if (currentUserRole !== 'admin') {
            res.status(403).json({
                success: false,
                message: 'Only administrators can send notifications'
            });
            return;
        }
        const { user_id, type, title, message } = req.body;
        if (!user_id || !type || !title || !message) {
            res.status(400).json({
                success: false,
                message: 'Missing required fields: user_id, type, title, message'
            });
            return;
        }
        const validTypes = ['assignment', 'report_declined', 'report_submitted', 'system_update'];
        if (!validTypes.includes(type)) {
            res.status(400).json({
                success: false,
                message: `Invalid notification type. Must be one of: ${validTypes.join(', ')}`
            });
            return;
        }
        const user = await (0, database_1.executeQuerySingle)('SELECT id, name FROM users WHERE id = ? AND status = ? AND deleted_at IS NULL', [user_id, 'active']);
        if (!user) {
            res.status(404).json({
                success: false,
                message: 'User not found or inactive'
            });
            return;
        }
        const result = await (0, database_1.executeQuery)(`INSERT INTO notifications (user_id, type, title, message)
       VALUES (?, ?, ?, ?)`, [user_id, type, title, message]);
        const notificationId = result.insertId;
        const notification = await (0, database_1.executeQuerySingle)('SELECT id, user_id, type, title, message, read_at, created_at FROM notifications WHERE id = ?', [notificationId]);
        logger_1.logger.info(`Notification sent to user ${user_id} by admin ${currentUserId}`);
        (0, pushNotificationService_1.sendPushNotification)(user_id, {
            title,
            body: message,
            icon: '/icons/192.png',
            data: {
                type,
                notificationId,
                timestamp: Date.now()
            }
        }).catch(error => {
            logger_1.logger.error('Error sending push notification:', error);
        });
        res.status(201).json({
            success: true,
            message: 'Notification sent successfully',
            data: { notification }
        });
    }
    catch (error) {
        logger_1.logger.error('Error sending notification:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send notification'
        });
    }
};
exports.sendNotification = sendNotification;
const markAllAsRead = async (req, res) => {
    try {
        const userId = req.user.id;
        const countResult = await (0, database_1.executeQuerySingle)('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read_at IS NULL', [userId]);
        const unreadCount = countResult?.count || 0;
        if (unreadCount === 0) {
            res.json({
                success: true,
                message: 'No unread notifications',
                data: { updated: 0 }
            });
            return;
        }
        await (0, database_1.executeQuery)('UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE user_id = ? AND read_at IS NULL', [userId]);
        logger_1.logger.info(`${unreadCount} notifications marked as read for user ${userId}`);
        res.json({
            success: true,
            message: `${unreadCount} notification(s) marked as read`,
            data: { updated: unreadCount }
        });
    }
    catch (error) {
        logger_1.logger.error('Error marking all notifications as read:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to mark notifications as read'
        });
    }
};
exports.markAllAsRead = markAllAsRead;
const deleteNotification = async (req, res) => {
    try {
        const userId = req.user.id;
        const notificationId = parseInt(req.params.id);
        if (isNaN(notificationId)) {
            res.status(400).json({
                success: false,
                message: 'Invalid notification ID'
            });
            return;
        }
        const notification = await (0, database_1.executeQuerySingle)('SELECT id FROM notifications WHERE id = ? AND user_id = ?', [notificationId, userId]);
        if (!notification) {
            res.status(404).json({
                success: false,
                message: 'Notification not found'
            });
            return;
        }
        await (0, database_1.executeQuery)('DELETE FROM notifications WHERE id = ?', [notificationId]);
        logger_1.logger.info(`Notification ${notificationId} deleted by user ${userId}`);
        res.json({
            success: true,
            message: 'Notification deleted successfully'
        });
    }
    catch (error) {
        logger_1.logger.error('Error deleting notification:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete notification'
        });
    }
};
exports.deleteNotification = deleteNotification;
//# sourceMappingURL=notificationController.js.map