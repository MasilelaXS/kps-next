import express from 'express';
import {
  getDashboardSummary,
  getUpcomingAssignments,
  getRecentReports,
  getDeclinedReports,
  getStatistics
} from '../controllers/pcoDashboardController';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = express.Router();

// ========================================
// PHASE 4.1: PCO DASHBOARD ROUTES
// ========================================
// All routes require PCO authentication

// Apply authentication middleware to all routes
router.use(authenticateToken);
router.use(requireRole('pco'));

/**
 * GET /api/pco/dashboard/summary
 * Main dashboard - all key metrics in one call
 */
router.get('/summary', getDashboardSummary);

/**
 * GET /api/pco/dashboard/upcoming-assignments
 * Show clients needing service soon
 * Query params: days_ahead (default 7), limit (default 10)
 */
router.get('/upcoming-assignments', getUpcomingAssignments);

/**
 * GET /api/pco/dashboard/recent-reports
 * Recent activity and quick access to reports
 * Query params: limit (default 10), status (optional filter)
 */
router.get('/recent-reports', getRecentReports);

/**
 * GET /api/pco/dashboard/declined-reports
 * Reports requiring revision (declined by admin)
 */
router.get('/declined-reports', getDeclinedReports);

/**
 * GET /api/pco/dashboard/statistics
 * Detailed performance statistics and trends
 * Query params: period (default 30) - days to analyze
 */
router.get('/statistics', getStatistics);

export default router;
