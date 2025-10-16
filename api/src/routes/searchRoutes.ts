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
 * @swagger
 * /search/global:
 *   get:
 *     tags:
 *       - Search
 *     summary: Global search
 *     description: Search across all entities (users, clients, reports, chemicals) with relevance scoring
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query string
 *         example: john pest control
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 50
 *         description: Maximum results per entity type
 *     responses:
 *       200:
 *         description: Search results from all entities
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     users:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/User'
 *                     clients:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Client'
 *                     reports:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Report'
 *                     chemicals:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Chemical'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.get('/global', authenticateToken, globalSearch);

/**
 * @swagger
 * /search/reports:
 *   get:
 *     tags:
 *       - Search
 *     summary: Search reports
 *     description: Advanced search for reports with multiple filters
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search in client name, PCO name, or remarks
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, pending, approved, declined]
 *         description: Filter by report status
 *       - in: query
 *         name: pco_id
 *         schema:
 *           type: integer
 *         description: Filter by PCO user ID
 *       - in: query
 *         name: client_id
 *         schema:
 *           type: integer
 *         description: Filter by client ID
 *       - in: query
 *         name: date_from
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for service date range
 *       - in: query
 *         name: date_to
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for service date range
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *     responses:
 *       200:
 *         description: Report search results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Report'
 */
router.get('/reports', authenticateToken, searchReports);

/**
 * @swagger
 * /search/users:
 *   get:
 *     tags:
 *       - Search
 *     summary: Search users
 *     description: Search users by name, email, PCO number with filters
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search in name, email, or PCO number
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [admin, pco, both]
 *         description: Filter by user role
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive]
 *         description: Filter by active status
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *     responses:
 *       200:
 *         description: User search results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 */
router.get('/users', authenticateToken, searchUsers);

/**
 * @swagger
 * /search/clients:
 *   get:
 *     tags:
 *       - Search
 *     summary: Search clients
 *     description: Search clients by company name, address, or contact information
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search in company name, address, contact name/email
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive]
 *         description: Filter by active status
 *       - in: query
 *         name: city
 *         schema:
 *           type: string
 *         description: Filter by city
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *     responses:
 *       200:
 *         description: Client search results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Client'
 */
router.get('/clients', authenticateToken, searchClients);

/**
 * @swagger
 * /search/chemicals:
 *   get:
 *     tags:
 *       - Search
 *     summary: Search chemicals
 *     description: Search chemicals by name, active ingredients, or usage type
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search in chemical name or active ingredients
 *       - in: query
 *         name: usage_type
 *         schema:
 *           type: string
 *           enum: [bait_inspection, fumigation, multi_purpose]
 *         description: Filter by usage type
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive]
 *         description: Filter by active status
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *     responses:
 *       200:
 *         description: Chemical search results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Chemical'
 */
router.get('/chemicals', authenticateToken, searchChemicals);

export default router;
