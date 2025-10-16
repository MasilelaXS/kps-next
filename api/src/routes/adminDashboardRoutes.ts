/**
 * Admin Dashboard Routes
 * Phase 5.1 - Admin portal dashboard and analytics
 * 
 * Endpoints:
 * - GET /api/admin/dashboard/metrics - Core counts and totals (cached 15min)
 * - GET /api/admin/dashboard/activity - Recent activity log (real-time)
 * - GET /api/admin/dashboard/stats - Statistical analytics and trends (cached 60min)
 * - GET /api/admin/dashboard/performance - System performance metrics (cached 30min)
 * - POST /api/admin/dashboard/refresh-cache - Manual cache refresh
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  getMetrics,
  getActivity,
  getStats,
  getPerformance,
  refreshCache
} from '../controllers/adminDashboardController';

const router = Router();

/**
 * GET /api/admin/dashboard/metrics
 * Core dashboard metrics with counts and totals
 * - Total users (PCO/Admin, active/inactive)
 * - Total clients by status
 * - Total reports by status
 * - Active assignments count
 * - Chemicals count
 * - Recent activity (24h)
 * Cache: 15 minutes
 */
router.get('/admin/dashboard/metrics', authenticateToken, getMetrics);

/**
 * GET /api/admin/dashboard/activity
 * Recent activity log and timeline
 * Query params:
 * - limit: Number of activities to return (default: 20, max: 100)
 * - activity_type: Filter by type (users, clients, reports, assignments, all)
 * Real-time data (no cache)
 */
router.get('/admin/dashboard/activity', authenticateToken, getActivity);

/**
 * GET /api/admin/dashboard/stats
 * Statistical analytics and trends
 * Query params:
 * - period: Time period (7d, 30d, 90d, 1y) - default: 30d
 * Returns:
 * - Report submission trends
 * - Approval rate analytics
 * - Turnaround time metrics
 * - Top PCOs by performance
 * - Top clients by activity
 * Cache: 60 minutes
 */
router.get('/admin/dashboard/stats', authenticateToken, getStats);

/**
 * GET /api/admin/dashboard/performance
 * System performance and health metrics
 * Returns:
 * - Active sessions count
 * - Security metrics (failed logins, locked accounts)
 * - Database size information
 * - Report processing statistics
 * Cache: 30 minutes
 */
router.get('/admin/dashboard/performance', authenticateToken, getPerformance);

/**
 * POST /api/admin/dashboard/refresh-cache
 * Manually clear dashboard cache
 * Forces fresh data fetch on next request
 * Use after major data changes or for troubleshooting
 */
router.post('/admin/dashboard/refresh-cache', authenticateToken, refreshCache);

export default router;
