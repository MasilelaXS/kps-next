"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const adminDashboardController_1 = require("../controllers/adminDashboardController");
const router = (0, express_1.Router)();
router.get('/admin/dashboard/metrics', auth_1.authenticateToken, adminDashboardController_1.getMetrics);
router.get('/admin/dashboard/activity', auth_1.authenticateToken, adminDashboardController_1.getActivity);
router.get('/admin/dashboard/stats', auth_1.authenticateToken, adminDashboardController_1.getStats);
router.get('/admin/dashboard/performance', auth_1.authenticateToken, adminDashboardController_1.getPerformance);
router.post('/admin/dashboard/refresh-cache', auth_1.authenticateToken, adminDashboardController_1.refreshCache);
exports.default = router;
//# sourceMappingURL=adminDashboardRoutes.js.map