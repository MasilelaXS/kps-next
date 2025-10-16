/**
 * KPS Pest Control Management System - Chemical Routes
 * 
 * Routes for chemical management (admin) and chemical selection (PCO)
 * 
 * @author KPS Development Team
 * @version 1.0.0
 */

import { Router } from 'express';
import { ChemicalController } from '../controllers/chemicalController';
import { authenticateToken } from '../middleware/auth';
import { 
  validateChemicalInput,
  validateChemicalUpdate,
  validateChemicalSearch,
  validateChemicalListParams,
  validateChemicalStatus
} from '../middleware/chemicalValidation';

const router = Router();

/**
 * @swagger
 * /admin/chemicals:
 *   get:
 *     tags:
 *       - Chemicals
 *     summary: List all chemicals
 *     description: Get paginated list of chemicals with optional filtering (Admin only)
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 25
 *       - in: query
 *         name: usage_type
 *         schema:
 *           type: string
 *           enum: [bait_inspection, fumigation, multi_purpose]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in name or active ingredients
 *     responses:
 *       200:
 *         description: Chemicals retrieved successfully
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
 *                 pagination:
 *                   type: object
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *   post:
 *     tags:
 *       - Chemicals
 *     summary: Create new chemical
 *     description: Create a new chemical product (Admin only)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - active_ingredients
 *               - usage_type
 *             properties:
 *               name:
 *                 type: string
 *                 example: Baygon Cockroach Bait
 *               active_ingredients:
 *                 type: string
 *                 example: Fipronil 0.05%
 *               usage_type:
 *                 type: string
 *                 enum: [bait_inspection, fumigation, multi_purpose]
 *               quantity_unit:
 *                 type: string
 *                 example: grams
 *               safety_information:
 *                 type: string
 *                 example: Keep away from children. Wash hands after use.
 *     responses:
 *       201:
 *         description: Chemical created successfully
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.get(
  '/admin/chemicals',
  authenticateToken,
  validateChemicalListParams,
  ChemicalController.getChemicalList
);

router.post(
  '/admin/chemicals',
  authenticateToken,
  validateChemicalInput,
  ChemicalController.createChemical
);

/**
 * @swagger
 * /admin/chemicals/{id}:
 *   get:
 *     tags:
 *       - Chemicals
 *     summary: Get chemical by ID
 *     description: Get detailed information about a specific chemical with usage statistics (Admin only)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Chemical details retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Chemical'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *   put:
 *     tags:
 *       - Chemicals
 *     summary: Update chemical
 *     description: Update chemical information (Admin only)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               active_ingredients:
 *                 type: string
 *               usage_type:
 *                 type: string
 *                 enum: [bait_inspection, fumigation, multi_purpose]
 *               quantity_unit:
 *                 type: string
 *               safety_information:
 *                 type: string
 *     responses:
 *       200:
 *         description: Chemical updated successfully
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get(
  '/admin/chemicals/:id',
  authenticateToken,
  ChemicalController.getChemicalById
);

router.put(
  '/admin/chemicals/:id',
  authenticateToken,
  validateChemicalUpdate,
  ChemicalController.updateChemical
);

/**
 * @swagger
 * /admin/chemicals/{id}/status:
 *   put:
 *     tags:
 *       - Chemicals
 *     summary: Update chemical status
 *     description: Activate or deactivate a chemical (Admin only). Cannot delete chemicals used in reports.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [active, inactive]
 *     responses:
 *       200:
 *         description: Chemical status updated
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.put(
  '/admin/chemicals/:id/status',
  authenticateToken,
  validateChemicalStatus,
  ChemicalController.updateChemicalStatus
);

/**
 * @swagger
 * /chemicals/type/{usage_type}:
 *   get:
 *     tags:
 *       - Chemicals
 *     summary: Get chemicals by usage type
 *     description: Get active chemicals filtered by usage type (for report creation)
 *     parameters:
 *       - in: path
 *         name: usage_type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [bait_inspection, fumigation, multi_purpose]
 *         description: Type of pest control operation
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive]
 *           default: active
 *     responses:
 *       200:
 *         description: Chemicals retrieved
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
router.get(
  '/chemicals/type/:usage_type',
  authenticateToken,
  ChemicalController.getChemicalsByType
);

/**
 * @swagger
 * /chemicals/search:
 *   get:
 *     tags:
 *       - Chemicals
 *     summary: Search chemicals
 *     description: Search chemicals by name or active ingredients
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search query
 *       - in: query
 *         name: usage_type
 *         schema:
 *           type: string
 *           enum: [bait_inspection, fumigation, multi_purpose]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive]
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *     responses:
 *       200:
 *         description: Search results
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
router.get(
  '/chemicals/search',
  authenticateToken,
  validateChemicalSearch,
  ChemicalController.searchChemicals
);

export default router;
