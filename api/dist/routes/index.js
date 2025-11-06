"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = __importDefault(require("./auth"));
const versionRoutes_1 = __importDefault(require("./versionRoutes"));
const userRoutes_1 = __importDefault(require("./userRoutes"));
const clientRoutes_1 = __importDefault(require("./clientRoutes"));
const chemicalRoutes_1 = __importDefault(require("./chemicalRoutes"));
const assignmentRoutes_1 = __importDefault(require("./assignmentRoutes"));
const reportRoutes_1 = __importDefault(require("./reportRoutes"));
const pcoDashboardRoutes_1 = __importDefault(require("./pcoDashboardRoutes"));
const pcoSyncRoutes_1 = __importDefault(require("./pcoSyncRoutes"));
const adminDashboardRoutes_1 = __importDefault(require("./adminDashboardRoutes"));
const searchRoutes_1 = __importDefault(require("./searchRoutes"));
const notificationRoutes_1 = __importDefault(require("./notificationRoutes"));
const cleanupRoutes_1 = __importDefault(require("./cleanupRoutes"));
const pushRoutes_1 = __importDefault(require("./pushRoutes"));
const router = (0, express_1.Router)();
router.get('/health', (req, res) => {
    res.json({
        success: true,
        status: 'healthy',
        message: 'API is running',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        version: '1.0.0'
    });
});
router.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Welcome to KPS Pest Control Management API',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        endpoints: {
            authentication: '/api/auth',
            version: '/api/version',
            users: '/api/admin/users',
            clients: '/api/admin/clients',
            chemicals: '/api/admin/chemicals',
            chemical_search: '/api/chemicals/search',
            assignments: '/api/admin/assignments',
            pco_reports: '/api/pco/reports',
            admin_reports: '/api/admin/reports',
            pco_dashboard: '/api/pco/dashboard',
            pco_sync: '/api/pco/sync',
            pco_data_export: '/api/pco/data/export',
            admin_dashboard: '/api/admin/dashboard',
            search: '/api/search',
            notifications: '/api/notifications',
            cleanup: '/api/cleanup',
            health: '/api/health',
            status: '/api/status'
        }
    });
});
router.use('/auth', auth_1.default);
router.use('/version', versionRoutes_1.default);
router.use('/admin/users', userRoutes_1.default);
router.use('/admin/clients', clientRoutes_1.default);
router.use('/', chemicalRoutes_1.default);
router.use('/admin/assignments', assignmentRoutes_1.default);
router.use('/pco/assignments', assignmentRoutes_1.default);
router.use('/', reportRoutes_1.default);
router.use('/pco/dashboard', pcoDashboardRoutes_1.default);
router.use('/', pcoSyncRoutes_1.default);
router.use('/', adminDashboardRoutes_1.default);
router.use('/search', searchRoutes_1.default);
router.use('/notifications', notificationRoutes_1.default);
router.use('/cleanup', cleanupRoutes_1.default);
router.use('/push', pushRoutes_1.default);
exports.default = router;
//# sourceMappingURL=index.js.map