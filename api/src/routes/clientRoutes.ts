/**
 * KPS Pest Control Management System - Client Routes
 * 
 * API endpoints for client management (Admin only)
 * 
 * @author KPS Development Team
 * @version 1.0.0
 */

import express from 'express';
import { ClientController } from '../controllers/clientController';
import { authenticateToken } from '../middleware/auth';
import { 
  validateClientInput, 
  validateClientUpdate, 
  validateClientSearch,
  validateClientListParams,
  validateContactInput,
  validateContactUpdate
} from '../middleware/clientValidation';

const router = express.Router();

/**
 * @swagger
 * /admin/clients:
 *   get:
 *     tags:
 *       - Clients
 *     summary: List all clients
 *     description: Get paginated list of clients with optional filtering (Admin only)
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
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive]
 *       - in: query
 *         name: city
 *         schema:
 *           type: string
 *         description: Filter by city
 *     responses:
 *       200:
 *         description: Clients retrieved successfully
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
 *                 pagination:
 *                   type: object
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *   post:
 *     tags:
 *       - Clients
 *     summary: Create new client
 *     description: Create a new client with contacts (Admin only)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - company_name
 *               - address_line1
 *               - city
 *               - contacts
 *             properties:
 *               company_name:
 *                 type: string
 *                 example: ABC Restaurant
 *               address_line1:
 *                 type: string
 *                 example: 123 Main Street
 *               address_line2:
 *                 type: string
 *               city:
 *                 type: string
 *                 example: Cape Town
 *               state:
 *                 type: string
 *                 example: Western Cape
 *               postal_code:
 *                 type: string
 *               country:
 *                 type: string
 *                 default: South Africa
 *               total_bait_stations_inside:
 *                 type: integer
 *                 description: Expected number of inside bait stations
 *               total_bait_stations_outside:
 *                 type: integer
 *                 description: Expected number of outside bait stations
 *               total_insect_monitors_light:
 *                 type: integer
 *                 description: Expected number of light (fly trap) monitors
 *               total_insect_monitors_box:
 *                 type: integer
 *                 description: Expected number of box monitors
 *               contacts:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required:
 *                     - name
 *                     - role
 *                   properties:
 *                     name:
 *                       type: string
 *                     email:
 *                       type: string
 *                       format: email
 *                     phone:
 *                       type: string
 *                     role:
 *                       type: string
 *                       example: Manager
 *                     is_primary:
 *                       type: boolean
 *                       default: false
 *     responses:
 *       201:
 *         description: Client created successfully
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.get('/debug', 
  authenticateToken,
  ClientController.debugDatabase
);

router.get('/', 
  authenticateToken,
  validateClientListParams,
  ClientController.getClientList
);

router.post('/', 
  authenticateToken,
  validateClientInput,
  ClientController.createClient
);

/**
 * @swagger
 * /admin/clients/search:
 *   get:
 *     tags:
 *       - Clients
 *     summary: Search clients
 *     description: Search clients by various criteria (Admin only)
 *     parameters:
 *       - in: query
 *         name: query
 *         schema:
 *           type: string
 *         description: Search term (company name, address, contact info)
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive]
 *       - in: query
 *         name: city
 *         schema:
 *           type: string
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
 *                     $ref: '#/components/schemas/Client'
 */
router.get('/search',
  authenticateToken,
  validateClientSearch,
  ClientController.searchClients
);

/**
 * @swagger
 * /admin/clients/{id}:
 *   get:
 *     tags:
 *       - Clients
 *     summary: Get client by ID
 *     description: Get detailed information about a specific client (Admin only)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Client details retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Client'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *   put:
 *     tags:
 *       - Clients
 *     summary: Update client
 *     description: Update client information (Admin only)
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
 *               company_name:
 *                 type: string
 *               address_line1:
 *                 type: string
 *               address_line2:
 *                 type: string
 *               city:
 *                 type: string
 *               state:
 *                 type: string
 *               postal_code:
 *                 type: string
 *               country:
 *                 type: string
 *               total_bait_stations_inside:
 *                 type: integer
 *               total_bait_stations_outside:
 *                 type: integer
 *               total_insect_monitors_light:
 *                 type: integer
 *               total_insect_monitors_box:
 *                 type: integer
 *               status:
 *                 type: string
 *                 enum: [active, inactive]
 *     responses:
 *       200:
 *         description: Client updated successfully
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *   delete:
 *     tags:
 *       - Clients
 *     summary: Delete client
 *     description: Soft delete client (hard delete if no reports) (Admin only)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Client deleted successfully
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get('/:id', 
  authenticateToken,
  ClientController.getClientById
);

router.put('/:id', 
  authenticateToken,
  validateClientUpdate,
  ClientController.updateClient
);

router.delete('/:id', 
  authenticateToken,
  ClientController.deleteClient
);

/**
 * @swagger
 * /admin/clients/{id}/contacts:
 *   get:
 *     tags:
 *       - Clients
 *     summary: Get client contacts
 *     description: Get all contacts for a specific client (Admin only)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Client ID
 *     responses:
 *       200:
 *         description: Contacts retrieved successfully
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
 *                     properties:
 *                       id:
 *                         type: integer
 *                       name:
 *                         type: string
 *                       email:
 *                         type: string
 *                       phone:
 *                         type: string
 *                       role:
 *                         type: string
 *                       is_primary:
 *                         type: boolean
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *   post:
 *     tags:
 *       - Clients
 *     summary: Add client contact
 *     description: Add a new contact to a client (Admin only)
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
 *               - name
 *               - role
 *             properties:
 *               name:
 *                 type: string
 *                 example: John Smith
 *               email:
 *                 type: string
 *                 format: email
 *               phone:
 *                 type: string
 *                 example: "+27123456789"
 *               role:
 *                 type: string
 *                 example: Manager
 *               is_primary:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       201:
 *         description: Contact created successfully
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.get('/:id/contacts', 
  authenticateToken,
  ClientController.getClientContacts
);

router.post('/:id/contacts', 
  authenticateToken,
  validateContactInput,
  ClientController.addClientContact
);

/**
 * @swagger
 * /admin/clients/{id}/contacts/{contactId}:
 *   put:
 *     tags:
 *       - Clients
 *     summary: Update client contact
 *     description: Update a client contact (Admin only)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Client ID
 *       - in: path
 *         name: contactId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Contact ID
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
 *               is_primary:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Contact updated successfully
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *   delete:
 *     tags:
 *       - Clients
 *     summary: Delete client contact
 *     description: Delete a client contact (Admin only)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: contactId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Contact deleted successfully
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.put('/:id/contacts/:contactId', 
  authenticateToken,
  validateContactUpdate,
  ClientController.updateClientContact
);

router.delete('/:id/contacts/:contactId', 
  authenticateToken,
  ClientController.deleteClientContact
);

/**
 * @swagger
 * /admin/clients/{id}/reports:
 *   get:
 *     tags:
 *       - Clients
 *     summary: Get client reports
 *     description: Get all reports for a specific client (Admin only)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, pending, approved, declined]
 *         description: Filter by report status
 *     responses:
 *       200:
 *         description: Reports retrieved successfully
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
router.get('/:id/reports', 
  authenticateToken,
  ClientController.getClientReports
);

/**
 * @swagger
 * /admin/clients/{id}/assign-pco:
 *   post:
 *     tags:
 *       - Clients
 *     summary: Assign PCO to client
 *     description: Assign a PCO user to a client (Admin only). One client can only have one PCO at a time.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Client ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - pco_id
 *             properties:
 *               pco_id:
 *                 type: integer
 *                 description: PCO user ID to assign
 *                 example: 4
 *     responses:
 *       200:
 *         description: PCO assigned successfully
 *       400:
 *         description: Client already assigned or PCO invalid
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/:id/assign-pco', 
  authenticateToken,
  ClientController.assignPcoToClient
);

/**
 * @swagger
 * /admin/clients/{id}/unassign-pco:
 *   post:
 *     tags:
 *       - Clients
 *     summary: Unassign PCO from client
 *     description: Remove PCO assignment from a client (Admin only)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Client ID
 *     responses:
 *       200:
 *         description: PCO unassigned successfully
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.post('/:id/unassign-pco', 
  authenticateToken,
  ClientController.unassignPcoFromClient
);

/**
 * @swagger
 * /admin/clients/{id}/assignments:
 *   get:
 *     tags:
 *       - Clients
 *     summary: Get client assignment history
 *     description: Get all PCO assignments for a client (current and past) (Admin only)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Assignment history retrieved
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
 *                     properties:
 *                       pco_id:
 *                         type: integer
 *                       pco_name:
 *                         type: string
 *                       assigned_at:
 *                         type: string
 *                         format: date-time
 *                       unassigned_at:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 */
router.get('/:id/assignments', 
  authenticateToken,
  ClientController.getClientPcoAssignments
);

export default router;