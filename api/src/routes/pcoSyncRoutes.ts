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
  exportData
} from '../controllers/pcoSyncController';
import {
  uploadReportsSchema,
  syncQuerySchema
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

export default router;
