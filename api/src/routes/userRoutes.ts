/**
 * KPS Pest Control Management System - User Routes
 * 
 * API endpoints for user management (Admin only)
 * 
 * @author KPS Development Team
 * @version 1.0.0
 */

import express from 'express';
import { UserController } from '../controllers/userController';
import { authenticateToken } from '../middleware/auth';
import { 
  validateUserInput, 
  validateUserUpdate, 
  validateUserStatus, 
  validatePasswordReset,
  validateUserSearch,
  validateUserListParams
} from '../middleware/userValidation';

const router = express.Router();

/**
 * @swagger
 * /admin/users:
 *   get:
 *     tags:
 *       - Users
 *     summary: List all users
 *     description: Get paginated list of users with optional filtering (Admin only)
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 25
 *         description: Records per page
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
 *         description: Filter by user status
 *     responses:
 *       200:
 *         description: Users retrieved successfully
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
 *                 pagination:
 *                   type: object
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *   post:
 *     tags:
 *       - Users
 *     summary: Create new user
 *     description: Create a new user account (Admin only)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - pco_number
 *               - name
 *               - email
 *               - password
 *               - role
 *             properties:
 *               pco_number:
 *                 type: string
 *                 example: pco12345
 *               name:
 *                 type: string
 *                 example: John Doe
 *               email:
 *                 type: string
 *                 format: email
 *                 example: john@example.com
 *               phone:
 *                 type: string
 *                 example: "+27123456789"
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *               role:
 *                 type: string
 *                 enum: [admin, pco, both]
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
router.get('/', 
  authenticateToken,
  validateUserListParams,
  UserController.getUserList
);

router.post('/', 
  authenticateToken,
  validateUserInput,
  UserController.createUser
);

/**
 * @swagger
 * /admin/users/search:
 *   get:
 *     tags:
 *       - Users
 *     summary: Search users
 *     description: Search users by various criteria (Admin only)
 *     parameters:
 *       - in: query
 *         name: query
 *         schema:
 *           type: string
 *         description: Search term (name, email, PCO number)
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [admin, pco, both]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive]
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
 *                     $ref: '#/components/schemas/User'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
router.get('/search',
  authenticateToken,
  validateUserSearch,
  UserController.searchUsers
);

/**
 * @swagger
 * /admin/users/{id}:
 *   get:
 *     tags:
 *       - Users
 *     summary: Get user by ID
 *     description: Get detailed information about a specific user (Admin only)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     responses:
 *       200:
 *         description: User details retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *   put:
 *     tags:
 *       - Users
 *     summary: Update user
 *     description: Update user information (Admin only)
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
 *               email:
 *                 type: string
 *                 format: email
 *               phone:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [admin, pco, both]
 *     responses:
 *       200:
 *         description: User updated successfully
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *   delete:
 *     tags:
 *       - Users
 *     summary: Delete user
 *     description: Soft delete user (hard delete if no reports) (Admin only)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: User deleted successfully
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get('/:id', 
  authenticateToken,
  UserController.getUserById
);

router.put('/:id', 
  authenticateToken,
  validateUserUpdate,
  UserController.updateUser
);

router.delete('/:id', 
  authenticateToken,
  UserController.deleteUser
);

/**
 * @swagger
 * /admin/users/{id}/status:
 *   put:
 *     tags:
 *       - Users
 *     summary: Update user status
 *     description: Activate or deactivate user account (Admin only)
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
 *         description: Status updated successfully
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.put('/:id/status', 
  authenticateToken,
  validateUserStatus,
  UserController.updateUserStatus
);

/**
 * @swagger
 * /admin/users/{id}/reset-password:
 *   put:
 *     tags:
 *       - Users
 *     summary: Reset user password
 *     description: Admin reset of user password (Admin only)
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
 *               - new_password
 *             properties:
 *               new_password:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Password reset successfully
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.put('/:id/reset-password', 
  authenticateToken,
  validatePasswordReset,
  UserController.resetUserPassword
);

/**
 * @swagger
 * /admin/users/{id}/assignments:
 *   get:
 *     tags:
 *       - Users
 *     summary: Get user assignments
 *     description: Get all client assignments for a PCO user (Admin only)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Assignments retrieved successfully
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
 *                     type: object
 */
router.get('/:id/assignments', 
  authenticateToken,
  UserController.getUserAssignments
);

/**
 * @swagger
 * /admin/users/{id}/unassign-all:
 *   post:
 *     tags:
 *       - Users
 *     summary: Unassign user from all clients
 *     description: Remove all client assignments from a PCO user (Admin only)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: All assignments removed successfully
 */
router.post('/:id/unassign-all', 
  authenticateToken,
  UserController.unassignAllClients
);

export default router;