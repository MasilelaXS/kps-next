/**
 * KPS Pest Control Management System - Assignment Routes
 * 
 * Routes for PCO-Client assignment management (admin only)
 * 
 * @author KPS Development Team
 * @version 1.0.0
 */

import { Router } from 'express';
import { AssignmentController } from '../controllers/assignmentController';
import { authenticateToken } from '../middleware/auth';
import {
  validateBulkAssign,
  validateBulkUnassign,
  validateAssignmentListParams
} from '../middleware/assignmentValidation';

const router = Router();

// ==============================================
// SHARED ROUTE - Role-based response
// ==============================================

/**
 * Get assignments
 * - PCO: GET /api/pco/assignments (own assignments)
 * - Admin: GET /api/admin/assignments (all assignments with filters)
 */
router.get(
  '/',
  authenticateToken,
  async (req, res, next) => {
    // If PCO, use PCO-specific handler
    if (req.user?.role === 'pco') {
      return AssignmentController.getPCOAssignments(req, res);
    }
    // Otherwise continue to admin handler with validation
    next();
  },
  validateAssignmentListParams,
  AssignmentController.getAssignmentList
);

// ==============================================
// ADMIN ROUTES (requires authentication + admin role)
// ==============================================

/**
 * Get assignment statistics and workload distribution
 * GET /api/admin/assignments/stats
 */
router.get(
  '/stats',
  authenticateToken,
  AssignmentController.getAssignmentStats
);

/**
 * Get workload balance suggestions
 * GET /api/admin/assignments/workload-balance
 */
router.get(
  '/workload-balance',
  authenticateToken,
  AssignmentController.getWorkloadBalance
);

/**
 * Bulk assign clients to a PCO
 * POST /api/admin/assignments/bulk-assign
 * Body: { pco_id: number, client_ids: number[] }
 */
router.post(
  '/bulk-assign',
  authenticateToken,
  validateBulkAssign,
  AssignmentController.bulkAssignClients
);

/**
 * Bulk unassign clients from their PCOs
 * POST /api/admin/assignments/bulk-unassign
 * Body: { assignment_ids: number[] }
 */
router.post(
  '/bulk-unassign',
  authenticateToken,
  validateBulkUnassign,
  AssignmentController.bulkUnassignClients
);

export default router;
