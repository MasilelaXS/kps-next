/**
 * Report Management Routes
 * Phase 3.2 - Complete Report Workflow
 * 
 * Handles:
 * - Report CRUD operations
 * - Status transitions (draft → pending → approved/declined)
 * - Sub-modules: Bait Stations, Fumigation, Insect Monitors
 * - Pre-fill functionality
 * - Admin approval workflow
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import {
  // Core Report Operations
  getPCOReports,
  getAdminReports,
  getPendingReports,
  getReportById,
  createReport,
  updateReport,
  deleteReport,
  submitReport,
  approveReport,
  declineReport,
  
  // Bait Station Management
  addBaitStation,
  updateBaitStation,
  deleteBaitStation,
  
  // Fumigation Management
  updateFumigation,
  
  // Insect Monitor Management
  addInsectMonitor,
  updateInsectMonitor,
  deleteInsectMonitor,
  
  // Pre-fill Data
  getPreFillData
} from '../controllers/reportController';
import {
  createReportSchema,
  updateReportSchema,
  submitReportSchema,
  approveReportSchema,
  declineReportSchema,
  addBaitStationSchema,
  updateBaitStationSchema,
  updateFumigationSchema,
  addInsectMonitorSchema,
  updateInsectMonitorSchema,
  reportListQuerySchema
} from '../validation/reportValidation';

const router = Router();

// ============================================================================
// PCO ROUTES
// ============================================================================

/**
 * GET /api/pco/reports
 * List PCO's own reports (all statuses including drafts)
 * Query params: page, limit, client_id, status, date_from, date_to
 */
router.get(
  '/pco/reports',
  authenticateToken,
  validateRequest(reportListQuerySchema, 'query'),
  getPCOReports
);

/**
 * GET /api/pco/reports/pre-fill/:clientId
 * Get pre-fill data from last approved report for client
 */
router.get(
  '/pco/reports/pre-fill/:clientId',
  authenticateToken,
  getPreFillData
);

/**
 * GET /api/pco/reports/:id
 * Get complete report with all sub-modules
 */
router.get(
  '/pco/reports/:id',
  authenticateToken,
  getReportById
);

/**
 * POST /api/pco/reports
 * Create new draft report
 * Body: { client_id, report_type, service_date, next_service_date, pco_signature_data, general_remarks }
 */
router.post(
  '/pco/reports',
  authenticateToken,
  validateRequest(createReportSchema),
  createReport
);

/**
 * PUT /api/pco/reports/:id
 * Update draft report
 * Body: Same as create (all optional)
 */
router.put(
  '/pco/reports/:id',
  authenticateToken,
  validateRequest(updateReportSchema),
  updateReport
);

/**
 * DELETE /api/pco/reports/:id
 * Delete draft report
 */
router.delete(
  '/pco/reports/:id',
  authenticateToken,
  deleteReport
);

/**
 * POST /api/pco/reports/:id/submit
 * Submit report for admin review
 * Business Rule: Auto-unassigns PCO from client
 */
router.post(
  '/pco/reports/:id/submit',
  authenticateToken,
  validateRequest(submitReportSchema),
  submitReport
);

// ============================================================================
// BAIT STATION SUB-MODULE ROUTES
// ============================================================================

/**
 * POST /api/pco/reports/:id/bait-stations
 * Add bait station with chemicals
 */
router.post(
  '/pco/reports/:id/bait-stations',
  authenticateToken,
  validateRequest(addBaitStationSchema),
  addBaitStation
);

/**
 * PUT /api/pco/reports/:id/bait-stations/:stationId
 * Update bait station
 */
router.put(
  '/pco/reports/:id/bait-stations/:stationId',
  authenticateToken,
  validateRequest(updateBaitStationSchema),
  updateBaitStation
);

/**
 * DELETE /api/pco/reports/:id/bait-stations/:stationId
 * Delete bait station
 */
router.delete(
  '/pco/reports/:id/bait-stations/:stationId',
  authenticateToken,
  deleteBaitStation
);

// ============================================================================
// FUMIGATION SUB-MODULE ROUTES
// ============================================================================

/**
 * PUT /api/pco/reports/:id/fumigation
 * Replace all fumigation data (areas, pests, chemicals)
 */
router.put(
  '/pco/reports/:id/fumigation',
  authenticateToken,
  validateRequest(updateFumigationSchema),
  updateFumigation
);

// ============================================================================
// INSECT MONITOR SUB-MODULE ROUTES
// ============================================================================

/**
 * POST /api/pco/reports/:id/insect-monitors
 * Add insect monitor
 */
router.post(
  '/pco/reports/:id/insect-monitors',
  authenticateToken,
  validateRequest(addInsectMonitorSchema),
  addInsectMonitor
);

/**
 * PUT /api/pco/reports/:id/insect-monitors/:monitorId
 * Update insect monitor
 */
router.put(
  '/pco/reports/:id/insect-monitors/:monitorId',
  authenticateToken,
  validateRequest(updateInsectMonitorSchema),
  updateInsectMonitor
);

/**
 * DELETE /api/pco/reports/:id/insect-monitors/:monitorId
 * Delete insect monitor
 */
router.delete(
  '/pco/reports/:id/insect-monitors/:monitorId',
  authenticateToken,
  deleteInsectMonitor
);

// ============================================================================
// ADMIN ROUTES
// ============================================================================

/**
 * GET /api/admin/reports
 * List all reports (excluding drafts - critical business rule)
 * Query params: page, limit, pco_id, client_id, status, date_from, date_to
 */
router.get(
  '/admin/reports',
  authenticateToken,
  validateRequest(reportListQuerySchema, 'query'),
  getAdminReports
);

/**
 * GET /api/admin/reports/pending
 * Quick access to pending reports for review
 */
router.get(
  '/admin/reports/pending',
  authenticateToken,
  getPendingReports
);

/**
 * GET /api/admin/reports/:id
 * Get complete report (admin can view any report except other PCOs' drafts)
 */
router.get(
  '/admin/reports/:id',
  authenticateToken,
  getReportById
);

/**
 * POST /api/admin/reports/:id/approve
 * Approve pending report
 * Body: { admin_notes? }
 */
router.post(
  '/admin/reports/:id/approve',
  authenticateToken,
  validateRequest(approveReportSchema),
  approveReport
);

/**
 * POST /api/admin/reports/:id/decline
 * Decline pending report with feedback
 * Body: { admin_notes } - REQUIRED (min 10 chars)
 * Business Rule: Reassigns PCO to client for revision
 */
router.post(
  '/admin/reports/:id/decline',
  authenticateToken,
  validateRequest(declineReportSchema),
  declineReport
);

export default router;
