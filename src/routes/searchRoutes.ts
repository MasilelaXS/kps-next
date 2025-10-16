import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  globalSearch,
  searchReports,
  searchUsers,
  searchClients,
  searchChemicals
} from '../controllers/searchController';

const router = Router();

/**
 * @route   GET /api/search/global
 * @desc    Global search across all entities
 * @access  Private
 * @query   q (required) - Search query string
 * @query   limit (optional) - Max results (default 20, max 50)
 */
router.get('/global', authenticateToken, globalSearch);

/**
 * @route   GET /api/search/reports
 * @desc    Search reports with filters
 * @access  Private
 * @query   q (optional) - Search query
 * @query   status (optional) - Report status filter
 * @query   pco_id (optional) - Filter by PCO
 * @query   client_id (optional) - Filter by client
 * @query   date_from (optional) - Start date filter
 * @query   date_to (optional) - End date filter
 * @query   limit (optional) - Max results (default 20, max 100)
 */
router.get('/reports', authenticateToken, searchReports);

/**
 * @route   GET /api/search/users
 * @desc    Search users with filters
 * @access  Private
 * @query   q (optional) - Search query
 * @query   role (optional) - Filter by role (admin/pco)
 * @query   is_active (optional) - Filter by active status
 * @query   limit (optional) - Max results (default 20, max 100)
 */
router.get('/users', authenticateToken, searchUsers);

/**
 * @route   GET /api/search/clients
 * @desc    Search clients with filters
 * @access  Private
 * @query   q (optional) - Search query
 * @query   is_active (optional) - Filter by active status
 * @query   has_contract (optional) - Filter by contract status
 * @query   limit (optional) - Max results (default 20, max 100)
 */
router.get('/clients', authenticateToken, searchClients);

/**
 * @route   GET /api/search/chemicals
 * @desc    Search chemicals with filters
 * @access  Private
 * @query   q (optional) - Search query
 * @query   pest_type (optional) - Filter by pest type
 * @query   is_active (optional) - Filter by active status
 * @query   limit (optional) - Max results (default 20, max 100)
 */
router.get('/chemicals', authenticateToken, searchChemicals);

export default router;
