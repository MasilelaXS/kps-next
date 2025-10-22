/**
 * KPS Pest Control Management System - Client Controller
 * 
 * Handles client management operations for admin portal
 * 
 * @author KPS Development Team
 * @version 1.0.0
 */

import { Request, Response } from 'express';
import { hasRole } from '../middleware/auth';
import { executeQuery, executeQuerySingle } from '../config/database';
import { logger } from '../config/logger';
import { createNotification } from './notificationController';

// Client status type
type ClientStatus = 'active' | 'inactive' | 'suspended';
type ContactRole = 'primary' | 'billing' | 'site_manager' | 'emergency' | 'other';

export class ClientController {
  /**
   * Debug endpoint to check database tables
   * GET /api/admin/clients/debug
   */
  static async debugDatabase(req: Request, res: Response): Promise<void> {
    try {
      // Check if tables exist
      const tables = await executeQuery('SHOW TABLES');
      
      // Try to describe clients table
      let clientsSchema = null;
      try {
        clientsSchema = await executeQuery('DESCRIBE clients');
      } catch (error) {
        clientsSchema = { error: (error as Error).message };
      }
      
      // Try simple count
      let clientCount = null;
      try {
        const countResult = await executeQuerySingle('SELECT COUNT(*) as count FROM clients');
        clientCount = countResult?.count || 0;
      } catch (error) {
        clientCount = { error: (error as Error).message };
      }

      res.json({
        success: true,
        debug: {
          database: 'kpspestcontrol_app',
          tables: tables,
          clientsSchema: clientsSchema,
          clientCount: clientCount
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  }

  /**
   * Get paginated client list with filtering
   * GET /api/admin/clients
   */
  static async getClientList(req: Request, res: Response): Promise<void> {
    try {
      // Check if user is admin
      if (!hasRole(req.user, 'admin')) {
        res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
        return;
      }

      const {
        page = 1,
        limit = 25,
        status,
        pco_id,
        search,
        unassigned // New parameter to filter by assignment status
      } = req.query;

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const offset = (pageNum - 1) * limitNum;

      // Build query conditions
      let whereConditions: string[] = [];
      let queryParams: any[] = [];

      // Filter by status
      if (status && status !== 'all') {
        whereConditions.push('c.status = ?');
        queryParams.push(status as string);
      }

      // Filter by assigned PCO
      if (pco_id && pco_id !== 'all') {
        whereConditions.push('EXISTS(SELECT 1 FROM client_pco_assignments cpa WHERE cpa.client_id = c.id AND cpa.pco_id = ? AND cpa.status = "active")');
        queryParams.push(pco_id as string);
      }

      // Filter by assignment status (unassigned only)
      if (unassigned === 'true') {
        whereConditions.push('NOT EXISTS(SELECT 1 FROM client_pco_assignments cpa WHERE cpa.client_id = c.id AND cpa.status = "active")');
      }

      // Search functionality
      if (search) {
        whereConditions.push('(c.company_name LIKE ? OR c.city LIKE ? OR c.address_line1 LIKE ?)');
        const searchTerm = `%${search}%`;
        queryParams.push(searchTerm, searchTerm, searchTerm);
      }

      // Exclude soft deleted clients
      whereConditions.push('c.deleted_at IS NULL');

      const whereClause = whereConditions.length > 0 
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '';

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM clients c
        ${whereClause}
      `;
      
      const countResult = await executeQuerySingle(countQuery, queryParams);
      const totalClients = countResult?.total || 0;
      const totalPages = Math.ceil(totalClients / limitNum);

      // Get clients with pagination
      const clientsQuery = `
        SELECT 
          c.id,
          c.company_name,
          c.address_line1,
          c.address_line2,
          c.city,
          c.state,
          c.postal_code,
          c.status,
          c.created_at,
          c.updated_at,
          -- PCO Assignment info
          cpa.id as assignment_id,
          u.id as assigned_pco_id,
          u.name as assigned_pco_name,
          u.pco_number as assigned_pco_number,
          cpa.assigned_at,
          -- Assignment status flag
          CASE WHEN cpa.id IS NOT NULL THEN 1 ELSE 0 END as is_assigned,
          -- Service statistics
          (SELECT COUNT(*) FROM reports WHERE client_id = c.id) as total_reports,
          (SELECT MAX(service_date) FROM reports WHERE client_id = c.id) as last_service_date,
          (SELECT COUNT(*) FROM reports WHERE client_id = c.id AND status = 'pending') as pending_reports
        FROM clients c
        LEFT JOIN client_pco_assignments cpa ON c.id = cpa.client_id AND cpa.status = 'active'
        LEFT JOIN users u ON cpa.pco_id = u.id
        ${whereClause}
        ORDER BY c.created_at DESC
        LIMIT ? OFFSET ?
      `;

      const clients = await executeQuery(clientsQuery, [...queryParams, limitNum, offset]);

      // Calculate pagination metadata
      const pagination = {
        current_page: pageNum,
        total_pages: totalPages,
        total_clients: totalClients,
        per_page: limitNum,
        has_next: pageNum < totalPages,
        has_prev: pageNum > 1
      };

      res.json({
        success: true,
        data: {
          clients,
          pagination,
          filters: {
            status: status || 'all',
            pco_id: pco_id || 'all',
            search: search || ''
          }
        }
      });

    } catch (error) {
      logger.error('Get client list error', { 
        error: error instanceof Error ? error.message : error,
        user_id: req.user?.id 
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve clients'
      });
    }
  }

  /**
   * Create new client
   * POST /api/admin/clients
   */
  static async createClient(req: Request, res: Response): Promise<void> {
    try {
      // Check if user is admin
      if (!hasRole(req.user, 'admin')) {
        res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
        return;
      }

      const { 
        company_name, 
        address_line1, 
        address_line2, 
        city, 
        state, 
        postal_code,
        country = 'South Africa',
        total_bait_stations_inside = 0,
        total_bait_stations_outside = 0,
        total_insect_monitors_light = 0,
        total_insect_monitors_box = 0,
        contacts = [] // Optional contacts array
      } = req.body;

      // Validation
      if (!company_name || !address_line1 || !city || !state || !postal_code) {
        res.status(400).json({
          success: false,
          message: 'Missing required fields',
          errors: [
            { field: 'company_name', message: !company_name ? 'Company name is required' : undefined },
            { field: 'address_line1', message: !address_line1 ? 'Address is required' : undefined },
            { field: 'city', message: !city ? 'City is required' : undefined },
            { field: 'state', message: !state ? 'State is required' : undefined },
            { field: 'postal_code', message: !postal_code ? 'Postal code is required' : undefined }
          ].filter(e => e.message)
        });
        return;
      }

      logger.info('Creating client', { 
        company_name, 
        city, 
        equipment: { 
          bait_inside: total_bait_stations_inside, 
          bait_outside: total_bait_stations_outside,
          monitor_light: total_insect_monitors_light,
          monitor_box: total_insect_monitors_box
        },
        contacts: contacts.length 
      });

      // Check for duplicate company name
      const existingClient = await executeQuerySingle(
        'SELECT id FROM clients WHERE company_name = ? AND deleted_at IS NULL',
        [company_name]
      );

      if (existingClient) {
        res.status(409).json({
          success: false,
          message: `Client with company name "${company_name}" already exists`
        });
        return;
      }

      // Insert new client
      const insertQuery = `
        INSERT INTO clients (
          company_name, 
          address_line1, 
          address_line2, 
          city, 
          state, 
          postal_code,
          country,
          total_bait_stations_inside,
          total_bait_stations_outside,
          total_insect_monitors_light,
          total_insect_monitors_box,
          status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
      `;

      const result = await executeQuery(insertQuery, [
        company_name,
        address_line1,
        address_line2 || null,
        city,
        state,
        postal_code,
        country,
        total_bait_stations_inside,
        total_bait_stations_outside,
        total_insect_monitors_light,
        total_insect_monitors_box
      ]);

      const clientId = (result as any).insertId;

      // Add contacts if provided
      if (contacts.length > 0) {
        for (const contact of contacts) {
          await executeQuery(`
            INSERT INTO client_contacts (
              client_id, 
              name, 
              role, 
              phone, 
              email, 
              is_primary
            ) VALUES (?, ?, ?, ?, ?, ?)
          `, [
            clientId,
            contact.name,
            contact.role,
            contact.phone || null,
            contact.email || null,
            contact.is_primary || false
          ]);
        }
      }

      // Get the created client with contacts
      const newClient = await executeQuerySingle(`
        SELECT 
          id, 
          company_name, 
          address_line1, 
          address_line2, 
          city, 
          state, 
          postal_code, 
          status, 
          created_at 
        FROM clients 
        WHERE id = ?
      `, [clientId]);

      const clientContacts = await executeQuery(`
        SELECT 
          id, 
          name, 
          role, 
          phone, 
          email, 
          is_primary 
        FROM client_contacts 
        WHERE client_id = ?
      `, [clientId]);

      logger.info('New client created', {
        client_id: clientId,
        company_name,
        contacts_count: contacts.length,
        created_by: req.user!.id
      });

      res.status(201).json({
        success: true,
        message: 'Client created successfully',
        data: {
          client: newClient,
          contacts: clientContacts
        }
      });

    } catch (error) {
      logger.error('Create client error', { 
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        admin_id: req.user?.id,
        body: req.body
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to create client',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get specific client by ID
   * GET /api/admin/clients/:id
   */
  static async getClientById(req: Request, res: Response): Promise<void> {
    try {
      // Check if user is admin
      if (!hasRole(req.user, 'admin')) {
        res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
        return;
      }

      const { id } = req.params;

      // Get client with assignment information
      const client = await executeQuerySingle(`
        SELECT 
          c.id,
          c.company_name,
          c.address_line1,
          c.address_line2,
          c.city,
          c.state,
          c.postal_code,
          c.status,
          c.created_at,
          c.updated_at,
          -- Current PCO assignment
          u.id as assigned_pco_id,
          u.name as assigned_pco_name,
          u.pco_number as assigned_pco_number,
          cpa.assigned_at,
          -- Service statistics
          (SELECT COUNT(*) FROM reports WHERE client_id = c.id) as total_reports,
          (SELECT COUNT(*) FROM reports WHERE client_id = c.id AND status = 'pending') as pending_reports,
          (SELECT MAX(service_date) FROM reports WHERE client_id = c.id) as last_service_date,
          (SELECT MIN(service_date) FROM reports WHERE client_id = c.id) as first_service_date
        FROM clients c
        LEFT JOIN client_pco_assignments cpa ON c.id = cpa.client_id AND cpa.status = 'active'
        LEFT JOIN users u ON cpa.pco_id = u.id
        WHERE c.id = ? AND c.deleted_at IS NULL
      `, [id]);

      if (!client) {
        res.status(404).json({
          success: false,
          message: 'Client not found'
        });
        return;
      }

      // Get client contacts
      const contacts = await executeQuery(`
        SELECT 
          id,
          name,
          role,
          phone,
          email,
          is_primary,
          created_at
        FROM client_contacts
        WHERE client_id = ?
        ORDER BY is_primary DESC, role
      `, [id]);

      // Get assignment history
      const assignmentHistory = await executeQuery(`
        SELECT 
          cpa.id,
          u.name as pco_name,
          u.pco_number,
          cpa.assigned_at,
          cpa.unassigned_at,
          cpa.status,
          assigned_by_user.name as assigned_by_name,
          unassigned_by_user.name as unassigned_by_name
        FROM client_pco_assignments cpa
        JOIN users u ON cpa.pco_id = u.id
        LEFT JOIN users assigned_by_user ON cpa.assigned_by = assigned_by_user.id
        LEFT JOIN users unassigned_by_user ON cpa.unassigned_by = unassigned_by_user.id
        WHERE cpa.client_id = ?
        ORDER BY cpa.assigned_at DESC
        LIMIT 10
      `, [id]);

      res.json({
        success: true,
        data: {
          client,
          contacts,
          assignment_history: assignmentHistory
        }
      });

    } catch (error) {
      logger.error('Get client by ID error', { 
        error: error instanceof Error ? error.message : error,
        client_id: req.params.id,
        admin_id: req.user?.id 
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve client'
      });
    }
  }

  /**
   * Update client information
   * PUT /api/admin/clients/:id
   */
  static async updateClient(req: Request, res: Response): Promise<void> {
    try {
      // Check if user is admin
      if (!hasRole(req.user, 'admin')) {
        res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
        return;
      }

      const { id } = req.params;
      const { 
        company_name, 
        address_line1, 
        address_line2, 
        city, 
        state, 
        postal_code,
        country,
        total_bait_stations_inside,
        total_bait_stations_outside,
        total_insect_monitors_light,
        total_insect_monitors_box
      } = req.body;

      // Check if client exists
      const existingClient = await executeQuerySingle(
        'SELECT * FROM clients WHERE id = ? AND deleted_at IS NULL',
        [id]
      );

      if (!existingClient) {
        res.status(404).json({
          success: false,
          message: 'Client not found'
        });
        return;
      }

      // Check for company name conflicts (excluding current client)
      if (company_name && company_name !== existingClient.company_name) {
        const nameConflict = await executeQuerySingle(
          'SELECT id FROM clients WHERE company_name = ? AND id != ? AND deleted_at IS NULL',
          [company_name, id]
        );

        if (nameConflict) {
          res.status(409).json({
            success: false,
            message: `Company name "${company_name}" already exists`
          });
          return;
        }
      }

      // Update client
      const updateQuery = `
        UPDATE clients 
        SET 
          company_name = ?, 
          address_line1 = ?, 
          address_line2 = ?, 
          city = ?, 
          state = ?, 
          postal_code = ?,
          country = ?,
          total_bait_stations_inside = ?,
          total_bait_stations_outside = ?,
          total_insect_monitors_light = ?,
          total_insect_monitors_box = ?,
          updated_at = NOW()
        WHERE id = ?
      `;

      await executeQuery(updateQuery, [
        company_name || existingClient.company_name,
        address_line1 || existingClient.address_line1,
        address_line2 !== undefined ? address_line2 : existingClient.address_line2,
        city || existingClient.city,
        state || existingClient.state,
        postal_code || existingClient.postal_code,
        country !== undefined ? country : existingClient.country,
        total_bait_stations_inside !== undefined ? total_bait_stations_inside : existingClient.total_bait_stations_inside,
        total_bait_stations_outside !== undefined ? total_bait_stations_outside : existingClient.total_bait_stations_outside,
        total_insect_monitors_light !== undefined ? total_insect_monitors_light : existingClient.total_insect_monitors_light,
        total_insect_monitors_box !== undefined ? total_insect_monitors_box : existingClient.total_insect_monitors_box,
        id
      ]);

      // Get updated client
      const updatedClient = await executeQuerySingle(
        'SELECT id, company_name, address_line1, address_line2, city, state, postal_code, status, created_at, updated_at FROM clients WHERE id = ?',
        [id]
      );

      logger.info('Client updated', {
        client_id: id,
        updated_fields: { company_name, address_line1, city, state },
        updated_by: req.user!.id
      });

      res.json({
        success: true,
        message: 'Client updated successfully',
        data: updatedClient
      });

    } catch (error) {
      logger.error('Update client error', { 
        error: error instanceof Error ? error.message : error,
        client_id: req.params.id,
        admin_id: req.user?.id 
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to update client'
      });
    }
  }

  /**
   * Soft delete client
   * DELETE /api/admin/clients/:id
   */
  static async deleteClient(req: Request, res: Response): Promise<void> {
    try {
      // Check if user is admin
      if (!hasRole(req.user, 'admin')) {
        res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
        return;
      }

      const { id } = req.params;

      // Check if client exists
      const client = await executeQuerySingle(
        'SELECT * FROM clients WHERE id = ? AND deleted_at IS NULL',
        [id]
      );

      if (!client) {
        res.status(404).json({
          success: false,
          message: 'Client not found'
        });
        return;
      }

      // Check for existing reports
      const existingReports = await executeQuerySingle(
        'SELECT COUNT(*) as count FROM reports WHERE client_id = ?',
        [id]
      );

      if (existingReports?.count > 0) {
        res.status(400).json({
          success: false,
          message: `Cannot delete client with ${existingReports.count} existing reports. Client will be deactivated instead.`,
          data: {
            existing_reports: existingReports.count,
            action_taken: 'deactivation'
          }
        });

        // Deactivate client and unassign PCO
        await executeQuery(
          'UPDATE clients SET status = "inactive", updated_at = NOW() WHERE id = ?',
          [id]
        );

        await executeQuery(
          'UPDATE client_pco_assignments SET status = "inactive", unassigned_at = NOW(), unassigned_by = ? WHERE client_id = ? AND status = "active"',
          [req.user!.id, id]
        );

        return;
      }

      // Soft delete client (no reports exist)
      await executeQuery(
        'UPDATE clients SET deleted_at = NOW(), status = "inactive" WHERE id = ?',
        [id]
      );

      // Deactivate any PCO assignments
      await executeQuery(
        'UPDATE client_pco_assignments SET status = "inactive", unassigned_at = NOW(), unassigned_by = ? WHERE client_id = ? AND status = "active"',
        [req.user!.id, id]
      );

      logger.info('Client soft deleted', {
        deleted_client_id: id,
        deleted_client_name: client.company_name,
        deleted_by: req.user!.id
      });

      res.json({
        success: true,
        message: 'Client deleted successfully'
      });

    } catch (error) {
      logger.error('Delete client error', { 
        error: error instanceof Error ? error.message : error,
        client_id: req.params.id,
        admin_id: req.user?.id 
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to delete client'
      });
    }
  }

  /**
   * Get client contacts
   * GET /api/admin/clients/:id/contacts
   */
  static async getClientContacts(req: Request, res: Response): Promise<void> {
    try {
      // Check if user is admin
      if (!hasRole(req.user, 'admin')) {
        res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
        return;
      }

      const { id } = req.params;

      // Check if client exists
      const client = await executeQuerySingle(
        'SELECT id, company_name FROM clients WHERE id = ? AND deleted_at IS NULL',
        [id]
      );

      if (!client) {
        res.status(404).json({
          success: false,
          message: 'Client not found'
        });
        return;
      }

      // Get contacts
      const contacts = await executeQuery(`
        SELECT 
          id,
          name,
          role,
          phone,
          email,
          is_primary,
          created_at,
          updated_at
        FROM client_contacts
        WHERE client_id = ?
        ORDER BY is_primary DESC, role, name
      `, [id]);

      res.json({
        success: true,
        data: {
          client,
          contacts,
          summary: {
            total_contacts: contacts.length,
            primary_contacts: contacts.filter((c: any) => c.is_primary).length
          }
        }
      });

    } catch (error) {
      logger.error('Get client contacts error', { 
        error: error instanceof Error ? error.message : error,
        client_id: req.params.id,
        admin_id: req.user?.id 
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve client contacts'
      });
    }
  }

  /**
   * Add new contact to client
   * POST /api/admin/clients/:id/contacts
   */
  static async addClientContact(req: Request, res: Response): Promise<void> {
    try {
      // Check if user is admin
      if (!hasRole(req.user, 'admin')) {
        res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
        return;
      }

      const { id } = req.params;
      const { name, role, phone, email, is_primary } = req.body;

      // Check if client exists
      const client = await executeQuerySingle(
        'SELECT id, company_name FROM clients WHERE id = ? AND deleted_at IS NULL',
        [id]
      );

      if (!client) {
        res.status(404).json({
          success: false,
          message: 'Client not found'
        });
        return;
      }

      // If setting as primary, unset other primary contacts
      if (is_primary) {
        await executeQuery(
          'UPDATE client_contacts SET is_primary = 0 WHERE client_id = ?',
          [id]
        );
      }

      // Insert new contact
      const result = await executeQuery(`
        INSERT INTO client_contacts (client_id, name, role, phone, email, is_primary)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [id, name, role || 'other', phone, email, is_primary ? 1 : 0]);

      // Get the created contact
      const newContact = await executeQuerySingle(
        'SELECT * FROM client_contacts WHERE id = ?',
        [(result as any).insertId]
      );

      logger.info('New client contact added', {
        client_id: id,
        contact_id: (result as any).insertId,
        name,
        added_by: req.user!.id
      });

      res.status(201).json({
        success: true,
        message: 'Contact added successfully',
        data: newContact
      });

    } catch (error) {
      logger.error('Add client contact error', { 
        error: error instanceof Error ? error.message : error,
        client_id: req.params.id,
        admin_id: req.user?.id 
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to add contact'
      });
    }
  }

  /**
   * Update client contact
   * PUT /api/admin/clients/:id/contacts/:contactId
   */
  static async updateClientContact(req: Request, res: Response): Promise<void> {
    try {
      // Check if user is admin
      if (!hasRole(req.user, 'admin')) {
        res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
        return;
      }

      const { id, contactId } = req.params;
      const { name, role, phone, email, is_primary } = req.body;

      // Check if contact exists and belongs to this client
      const existingContact = await executeQuerySingle(
        'SELECT * FROM client_contacts WHERE id = ? AND client_id = ?',
        [contactId, id]
      );

      if (!existingContact) {
        res.status(404).json({
          success: false,
          message: 'Contact not found'
        });
        return;
      }

      // If setting as primary, unset other primary contacts
      if (is_primary) {
        await executeQuery(
          'UPDATE client_contacts SET is_primary = 0 WHERE client_id = ? AND id != ?',
          [id, contactId]
        );
      }

      // Update contact
      await executeQuery(`
        UPDATE client_contacts 
        SET name = ?, role = ?, phone = ?, email = ?, is_primary = ?, updated_at = NOW()
        WHERE id = ?
      `, [
        name || existingContact.name,
        role || existingContact.role,
        phone || existingContact.phone,
        email || existingContact.email,
        is_primary !== undefined ? (is_primary ? 1 : 0) : existingContact.is_primary,
        contactId
      ]);

      // Get updated contact
      const updatedContact = await executeQuerySingle(
        'SELECT * FROM client_contacts WHERE id = ?',
        [contactId]
      );

      logger.info('Client contact updated', {
        client_id: id,
        contact_id: contactId,
        updated_by: req.user!.id
      });

      res.json({
        success: true,
        message: 'Contact updated successfully',
        data: updatedContact
      });

    } catch (error) {
      logger.error('Update client contact error', { 
        error: error instanceof Error ? error.message : error,
        client_id: req.params.id,
        contact_id: req.params.contactId,
        admin_id: req.user?.id 
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to update contact'
      });
    }
  }

  /**
   * Delete client contact
   * DELETE /api/admin/clients/:id/contacts/:contactId
   */
  static async deleteClientContact(req: Request, res: Response): Promise<void> {
    try {
      // Check if user is admin
      if (!hasRole(req.user, 'admin')) {
        res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
        return;
      }

      const { id, contactId } = req.params;

      // Check if contact exists and belongs to this client
      const contact = await executeQuerySingle(
        'SELECT * FROM client_contacts WHERE id = ? AND client_id = ?',
        [contactId, id]
      );

      if (!contact) {
        res.status(404).json({
          success: false,
          message: 'Contact not found'
        });
        return;
      }

      // Prevent deleting the only contact
      const contactCount = await executeQuerySingle(
        'SELECT COUNT(*) as count FROM client_contacts WHERE client_id = ?',
        [id]
      );

      if (contactCount?.count <= 1) {
        res.status(400).json({
          success: false,
          message: 'Cannot delete the only contact. Client must have at least one contact.'
        });
        return;
      }

      // Delete contact
      await executeQuery(
        'DELETE FROM client_contacts WHERE id = ?',
        [contactId]
      );

      logger.info('Client contact deleted', {
        client_id: id,
        contact_id: contactId,
        contact_name: contact.name,
        deleted_by: req.user!.id
      });

      res.json({
        success: true,
        message: 'Contact deleted successfully'
      });

    } catch (error) {
      logger.error('Delete client contact error', { 
        error: error instanceof Error ? error.message : error,
        client_id: req.params.id,
        contact_id: req.params.contactId,
        admin_id: req.user?.id 
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to delete contact'
      });
    }
  }

  /**
   * Get client reports
   * GET /api/admin/clients/:id/reports
   */
  static async getClientReports(req: Request, res: Response): Promise<void> {
    try {
      // Check if user is admin
      if (!hasRole(req.user, 'admin')) {
        res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
        return;
      }

      const { id } = req.params;
      const { status, limit = 50 } = req.query;

      // Check if client exists
      const client = await executeQuerySingle(
        'SELECT id, company_name FROM clients WHERE id = ? AND deleted_at IS NULL',
        [id]
      );

      if (!client) {
        res.status(404).json({
          success: false,
          message: 'Client not found'
        });
        return;
      }

      // Build query for reports
      let query = `
        SELECT 
          r.id,
          r.service_date,
          r.status,
          r.created_at,
          u.name as pco_name,
          u.pco_number
        FROM reports r
        LEFT JOIN users u ON r.pco_id = u.id
        WHERE r.client_id = ?
      `;

      const queryParams: any[] = [id];

      if (status && status !== 'all') {
        query += ' AND r.status = ?';
        queryParams.push(status as string);
      }

      query += ' ORDER BY r.service_date DESC LIMIT ?';
      queryParams.push(parseInt(limit as string));

      const reports = await executeQuery(query, queryParams);

      // Get summary statistics
      const summary = await executeQuerySingle(`
        SELECT 
          COUNT(*) as total_reports,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_reports,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_reports,
          MAX(service_date) as last_service_date,
          MIN(service_date) as first_service_date
        FROM reports
        WHERE client_id = ?
      `, [id]);

      res.json({
        success: true,
        data: {
          client,
          reports,
          summary
        }
      });

    } catch (error) {
      logger.error('Get client reports error', { 
        error: error instanceof Error ? error.message : error,
        client_id: req.params.id,
        admin_id: req.user?.id 
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve client reports'
      });
    }
  }

  /**
   * Assign PCO to client
   * POST /api/admin/clients/:id/assign-pco
   */
  static async assignPcoToClient(req: Request, res: Response): Promise<void> {
    try {
      // Check if user is admin
      if (!hasRole(req.user, 'admin')) {
        res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
        return;
      }

      const { id } = req.params;
      const { pco_id } = req.body;

      // Check if client exists
      const client = await executeQuerySingle(
        'SELECT * FROM clients WHERE id = ? AND deleted_at IS NULL',
        [id]
      );

      if (!client) {
        res.status(404).json({
          success: false,
          message: 'Client not found'
        });
        return;
      }

      // Check if PCO exists
      const pco = await executeQuerySingle(
        'SELECT * FROM users WHERE id = ? AND role IN ("pco", "both") AND deleted_at IS NULL AND status = "active"',
        [pco_id]
      );

      if (!pco) {
        res.status(404).json({
          success: false,
          message: 'PCO not found or not active'
        });
        return;
      }

      // Check if client is already assigned to a PCO
      const existingAssignment = await executeQuerySingle(
        'SELECT * FROM client_pco_assignments WHERE client_id = ? AND status = "active"',
        [id]
      );

      if (existingAssignment) {
        res.status(400).json({
          success: false,
          message: 'Client is already assigned to a PCO. Please unassign first.',
          data: {
            current_pco_id: existingAssignment.pco_id
          }
        });
        return;
      }

      // Create new assignment
      await executeQuery(`
        INSERT INTO client_pco_assignments (
          client_id, 
          pco_id, 
          assigned_by, 
          assigned_at, 
          status
        ) VALUES (?, ?, ?, NOW(), 'active')
      `, [id, pco_id, req.user!.id]);

      // Send notification to PCO
      await createNotification(
        pco_id,
        'assignment',
        'New Client Assignment',
        `You've been assigned to ${client.company_name}`
      );

      logger.info('PCO assigned to client', {
        client_id: id,
        client_name: client.company_name,
        pco_id,
        pco_name: pco.name,
        assigned_by: req.user!.id
      });

      res.json({
        success: true,
        message: `PCO ${pco.name} assigned to client ${client.company_name} successfully`,
        data: {
          client_id: id,
          pco_id,
          pco_name: pco.name,
          assigned_at: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Assign PCO to client error', { 
        error: error instanceof Error ? error.message : error,
        client_id: req.params.id,
        admin_id: req.user?.id 
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to assign PCO to client'
      });
    }
  }

  /**
   * Unassign PCO from client
   * POST /api/admin/clients/:id/unassign-pco
   */
  static async unassignPcoFromClient(req: Request, res: Response): Promise<void> {
    try {
      // Check if user is admin
      if (!hasRole(req.user, 'admin')) {
        res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
        return;
      }

      const { id } = req.params;

      // Check if client exists
      const client = await executeQuerySingle(
        'SELECT * FROM clients WHERE id = ? AND deleted_at IS NULL',
        [id]
      );

      if (!client) {
        res.status(404).json({
          success: false,
          message: 'Client not found'
        });
        return;
      }

      // Check if client has an active assignment
      const activeAssignment = await executeQuerySingle(`
        SELECT cpa.*, u.name as pco_name 
        FROM client_pco_assignments cpa
        JOIN users u ON cpa.pco_id = u.id
        WHERE cpa.client_id = ? AND cpa.status = 'active'
      `, [id]);

      if (!activeAssignment) {
        res.status(400).json({
          success: false,
          message: 'Client is not currently assigned to any PCO'
        });
        return;
      }

      // Unassign PCO
      // First delete any old inactive assignments to avoid unique constraint violation
      await executeQuery(`
        DELETE FROM client_pco_assignments 
        WHERE client_id = ? AND status = 'inactive'
      `, [id]);
      
      // Then update the active assignment to inactive
      await executeQuery(`
        UPDATE client_pco_assignments 
        SET status = 'inactive', unassigned_at = NOW(), unassigned_by = ?
        WHERE client_id = ? AND status = 'active'
      `, [req.user!.id, id]);

      logger.info('PCO unassigned from client', {
        client_id: id,
        client_name: client.company_name,
        pco_id: activeAssignment.pco_id,
        pco_name: activeAssignment.pco_name,
        unassigned_by: req.user!.id
      });

      res.json({
        success: true,
        message: `PCO ${activeAssignment.pco_name} unassigned from client ${client.company_name} successfully`
      });

    } catch (error) {
      logger.error('Unassign PCO from client error', { 
        error: error instanceof Error ? error.message : error,
        client_id: req.params.id,
        admin_id: req.user?.id 
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to unassign PCO from client'
      });
    }
  }

  /**
   * Get client PCO assignments history
   * GET /api/admin/clients/:id/assignments
   */
  static async getClientPcoAssignments(req: Request, res: Response): Promise<void> {
    try {
      // Check if user is admin
      if (!hasRole(req.user, 'admin')) {
        res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
        return;
      }

      const { id } = req.params;

      // Check if client exists
      const client = await executeQuerySingle(
        'SELECT id, company_name FROM clients WHERE id = ? AND deleted_at IS NULL',
        [id]
      );

      if (!client) {
        res.status(404).json({
          success: false,
          message: 'Client not found'
        });
        return;
      }

      // Get assignment history
      const assignments = await executeQuery(`
        SELECT 
          cpa.id,
          cpa.pco_id,
          u.name as pco_name,
          u.pco_number,
          cpa.assigned_at,
          cpa.unassigned_at,
          cpa.status,
          assigned_by_user.name as assigned_by_name,
          unassigned_by_user.name as unassigned_by_name,
          -- Service statistics for this assignment
          (SELECT COUNT(*) FROM reports 
           WHERE client_id = cpa.client_id AND pco_id = cpa.pco_id 
           AND service_date BETWEEN cpa.assigned_at AND COALESCE(cpa.unassigned_at, NOW())
          ) as reports_during_assignment
        FROM client_pco_assignments cpa
        JOIN users u ON cpa.pco_id = u.id
        LEFT JOIN users assigned_by_user ON cpa.assigned_by = assigned_by_user.id
        LEFT JOIN users unassigned_by_user ON cpa.unassigned_by = unassigned_by_user.id
        WHERE cpa.client_id = ?
        ORDER BY cpa.assigned_at DESC
      `, [id]);

      res.json({
        success: true,
        data: {
          client,
          assignments,
          summary: {
            total_assignments: assignments.length,
            active_assignments: assignments.filter((a: any) => a.status === 'active').length,
            inactive_assignments: assignments.filter((a: any) => a.status === 'inactive').length
          }
        }
      });

    } catch (error) {
      logger.error('Get client PCO assignments error', { 
        error: error instanceof Error ? error.message : error,
        client_id: req.params.id,
        admin_id: req.user?.id 
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve client PCO assignments'
      });
    }
  }

  /**
   * Search clients
   * GET /api/admin/clients/search
   */
  static async searchClients(req: Request, res: Response): Promise<void> {
    try {
      // Check if user is admin
      if (!hasRole(req.user, 'admin')) {
        res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
        return;
      }

      const { q, status, pco_id, limit = 10 } = req.query;

      if (!q || (q as string).length < 2) {
        res.status(400).json({
          success: false,
          message: 'Search query must be at least 2 characters'
        });
        return;
      }

      // Build search query
      let query = `
        SELECT 
          c.id,
          c.company_name,
          c.city,
          c.state,
          c.address_line1,
          c.status,
          u.name as assigned_pco_name,
          u.pco_number as assigned_pco_number,
          (SELECT COUNT(*) FROM reports WHERE client_id = c.id) as total_reports
        FROM clients c
        LEFT JOIN client_pco_assignments cpa ON c.id = cpa.client_id AND cpa.status = 'active'
        LEFT JOIN users u ON cpa.pco_id = u.id
        WHERE c.deleted_at IS NULL
        AND (c.company_name LIKE ? OR c.city LIKE ? OR c.address_line1 LIKE ?)
      `;

      const searchTerm = `%${q}%`;
      let queryParams = [searchTerm, searchTerm, searchTerm];

      if (status && status !== 'all') {
        query += ' AND c.status = ?';
        queryParams.push(status as string);
      }

      if (pco_id && pco_id !== 'all') {
        query += ' AND cpa.pco_id = ?';
        queryParams.push(pco_id as string);
      }

      query += ' ORDER BY c.company_name ASC LIMIT ?';
      queryParams.push(limit as string);

      const clients = await executeQuery(query, queryParams);

      res.json({
        success: true,
        data: {
          clients,
          query: q,
          total_results: clients.length,
          filters: {
            status: status || 'all',
            pco_id: pco_id || 'all'
          }
        }
      });

    } catch (error) {
      logger.error('Search clients error', { 
        error: error instanceof Error ? error.message : error,
        search_query: req.query.q,
        admin_id: req.user?.id 
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to search clients'
      });
    }
  }
}

export default ClientController;