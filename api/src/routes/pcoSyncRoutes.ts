/**
 * PCO Sync & Offline Data Routes
 * Phase 4.2 - Mobile offline support with sync endpoints
 * 
 * Endpoints:
 * - GET /api/pco/sync/full - Complete data sync for initial download
 * - GET /api/pco/sync/clients - Incremental client sync
 * - GET /api/pco/sync/chemicals - Incremental chemical sync
 * - GET /api/pco/sync/reports - Incremental report sync
 * - POST /api/pco/sync/upload - Upload offline-created reports
 * - GET /api/pco/data/export - Export complete dataset for backup
 * - GET /api/pco/clients/available - Browse available clients for self-assignment
 * - POST /api/pco/assignments/self-assign - Self-assign to a client
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import {
  getFullSync,
  syncClients,
  syncChemicals,
  syncRecentReports,
  uploadReports,
  exportData,
  updateClientCounts,
  getAvailableClients,
  selfAssignClient
} from '../controllers/pcoSyncController';
import { ChemicalController } from '../controllers/chemicalController';
import {
  uploadReportsSchema,
  syncQuerySchema,
  updateClientCountsSchema
} from '../validation/syncValidation';

const router = Router();

/**
 * GET /api/pco/sync/full
 * Complete data sync for initial offline setup
 * - Returns user profile, all assigned clients with contacts, all active chemicals
 * - Returns last 10 reports per client with complete sub-modules
 */
router.get('/pco/sync/full', authenticateToken, getFullSync);

/**
 * GET /api/pco/sync/clients
 * Incremental client sync with optional timestamp filtering
 * Query params:
 * - since (timestamp) - Only clients updated after this time
 * - include_contacts (boolean) - Include client contacts (default: true)
 */
router.get('/pco/sync/clients', authenticateToken, validateRequest(syncQuerySchema, 'query'), syncClients);

/**
 * GET /api/pco/sync/chemicals
 * Incremental chemical sync with optional timestamp filtering
 * Query params:
 * - since (timestamp) - Only chemicals updated after this time
 */
router.get('/pco/sync/chemicals', authenticateToken, validateRequest(syncQuerySchema, 'query'), syncChemicals);

/**
 * GET /api/pco/sync/reports
 * Incremental report sync with optional filtering
 * Query params:
 * - since (timestamp) - Only reports updated after this time
 * - client_id (number) - Filter by specific client
 * Max 10 reports per client
 */
router.get('/pco/sync/reports', authenticateToken, validateRequest(syncQuerySchema, 'query'), syncRecentReports);

/**
 * POST /api/pco/sync/upload
 * Upload batch of reports created offline
 * Body:
 * - reports (array) - Array of report objects with local_id for mapping
 * Each report includes nested bait_stations, fumigation, insect_monitors
 */
router.post('/pco/sync/upload', authenticateToken, validateRequest(uploadReportsSchema), uploadReports);

/**
 * GET /api/pco/data/export
 * Export complete offline dataset for backup
 * Query params:
 * - format (string) - Export format (only 'json' supported currently)
 */
router.get('/pco/data/export', authenticateToken, exportData);

/**
 * PCO-specific chemical lookup by usage type
 * GET /api/pco/chemicals/:usage_type
 */
router.get('/pco/chemicals/:usage_type', authenticateToken, ChemicalController.getChemicalsForPco);

/**
 * PATCH /api/pco/clients/:id/update-counts
 * Update client station/monitor counts from report creation
 * Body:
 * - total_bait_stations_inside (optional)
 * - total_bait_stations_outside (optional)
 * - total_insect_monitors_light (optional)
 * - total_insect_monitors_box (optional)
 */
router.patch('/pco/clients/:id/update-counts', authenticateToken, validateRequest(updateClientCountsSchema), updateClientCounts);

/**
 * GET /api/pco/reports/last-for-client/:clientId
 * Get the last approved report for a client with full station details for pre-filling
 * Returns complete bait station data to pre-populate form fields
 */
router.get('/pco/reports/last-for-client/:clientId', authenticateToken, async (req, res, next) => {
  // This route is handled inline for simplicity - imports getLastReportForClient from controller
  const { getLastReportForClient } = require('../controllers/pcoSyncController');
  return getLastReportForClient(req, res, next);
});

/**
 * GET /api/pco/clients/available
 * Browse available clients for self-assignment
 * Returns active clients that are either unassigned or not assigned to this PCO
 * Query params:
 * - search (string) - Search by company name, city, or address
 * - page (number) - Page number for pagination
 * - limit (number) - Results per page (default: 25)
 */
router.get('/pco/clients/available', authenticateToken, getAvailableClients);

/**
 * POST /api/pco/assignments/self-assign
 * Self-assign to a client
 * Body:
 * - client_id (number) - The client ID to self-assign
 * Creates active assignment with assignment_type='self'
 */
router.post('/pco/assignments/self-assign', authenticateToken, selfAssignClient);

export default router;
