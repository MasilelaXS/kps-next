"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const notificationController_1 = require("../controllers/notificationController");
const router = (0, express_1.Router)();
router.get('/', auth_1.authenticateToken, notificationController_1.getNotifications);
router.put('/:id/read', auth_1.authenticateToken, notificationController_1.markAsRead);
router.put('/mark-all-read', auth_1.authenticateToken, notificationController_1.markAllAsRead);
router.post('/send', auth_1.authenticateToken, notificationController_1.sendNotification);
router.delete('/:id', auth_1.authenticateToken, notificationController_1.deleteNotification);
exports.default = router;
//# sourceMappingURL=notificationRoutes.js.map