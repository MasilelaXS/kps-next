"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientController = void 0;
const database_1 = require("../config/database");
const logger_1 = require("../config/logger");
class ClientController {
    static async debugDatabase(req, res) {
        try {
            const tables = await (0, database_1.executeQuery)('SHOW TABLES');
            let clientsSchema = null;
            try {
                clientsSchema = await (0, database_1.executeQuery)('DESCRIBE clients');
            }
            catch (error) {
                clientsSchema = { error: error.message };
            }
            let clientCount = null;
            try {
                const countResult = await (0, database_1.executeQuerySingle)('SELECT COUNT(*) as count FROM clients');
                clientCount = countResult?.count || 0;
            }
            catch (error) {
                clientCount = { error: error.message };
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
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
    static async getClientList(req, res) {
        try {
            if (req.user?.role !== 'admin') {
                res.status(403).json({
                    success: false,
                    message: 'Admin access required'
                });
                return;
            }
            const { page = 1, limit = 25, status, pco_id, search } = req.query;
            const pageNum = parseInt(page);
            const limitNum = parseInt(limit);
            const offset = (pageNum - 1) * limitNum;
            let whereConditions = [];
            let queryParams = [];
            if (status && status !== 'all') {
                whereConditions.push('c.status = ?');
                queryParams.push(status);
            }
            if (pco_id && pco_id !== 'all') {
                whereConditions.push('EXISTS(SELECT 1 FROM client_pco_assignments cpa WHERE cpa.client_id = c.id AND cpa.pco_id = ? AND cpa.status = "active")');
                queryParams.push(pco_id);
            }
            if (search) {
                whereConditions.push('(c.company_name LIKE ? OR c.city LIKE ? OR c.address_line1 LIKE ?)');
                const searchTerm = `%${search}%`;
                queryParams.push(searchTerm, searchTerm, searchTerm);
            }
            whereConditions.push('c.deleted_at IS NULL');
            const whereClause = whereConditions.length > 0
                ? `WHERE ${whereConditions.join(' AND ')}`
                : '';
            const countQuery = `
        SELECT COUNT(*) as total
        FROM clients c
        ${whereClause}
      `;
            const countResult = await (0, database_1.executeQuerySingle)(countQuery, queryParams);
            const totalClients = countResult?.total || 0;
            const totalPages = Math.ceil(totalClients / limitNum);
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
          u.name as assigned_pco_name,
          u.pco_number as assigned_pco_number,
          cpa.assigned_at,
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
            const clients = await (0, database_1.executeQuery)(clientsQuery, [...queryParams, limitNum, offset]);
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
        }
        catch (error) {
            logger_1.logger.error('Get client list error', {
                error: error instanceof Error ? error.message : error,
                user_id: req.user?.id
            });
            res.status(500).json({
                success: false,
                message: 'Failed to retrieve clients'
            });
        }
    }
    static async createClient(req, res) {
        try {
            if (req.user?.role !== 'admin') {
                res.status(403).json({
                    success: false,
                    message: 'Admin access required'
                });
                return;
            }
            const { company_name, address_line1, address_line2, city, state, postal_code, country = 'South Africa', total_bait_stations_inside = 0, total_bait_stations_outside = 0, total_insect_monitors_light = 0, total_insect_monitors_box = 0, contacts = [] } = req.body;
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
            logger_1.logger.info('Creating client', {
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
            const existingClient = await (0, database_1.executeQuerySingle)('SELECT id FROM clients WHERE company_name = ? AND deleted_at IS NULL', [company_name]);
            if (existingClient) {
                res.status(409).json({
                    success: false,
                    message: `Client with company name "${company_name}" already exists`
                });
                return;
            }
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
            const result = await (0, database_1.executeQuery)(insertQuery, [
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
            const clientId = result.insertId;
            if (contacts.length > 0) {
                for (const contact of contacts) {
                    await (0, database_1.executeQuery)(`
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
            const newClient = await (0, database_1.executeQuerySingle)(`
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
            const clientContacts = await (0, database_1.executeQuery)(`
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
            logger_1.logger.info('New client created', {
                client_id: clientId,
                company_name,
                contacts_count: contacts.length,
                created_by: req.user.id
            });
            res.status(201).json({
                success: true,
                message: 'Client created successfully',
                data: {
                    client: newClient,
                    contacts: clientContacts
                }
            });
        }
        catch (error) {
            logger_1.logger.error('Create client error', {
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
    static async getClientById(req, res) {
        try {
            if (req.user?.role !== 'admin') {
                res.status(403).json({
                    success: false,
                    message: 'Admin access required'
                });
                return;
            }
            const { id } = req.params;
            const client = await (0, database_1.executeQuerySingle)(`
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
            const contacts = await (0, database_1.executeQuery)(`
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
            const assignmentHistory = await (0, database_1.executeQuery)(`
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
        }
        catch (error) {
            logger_1.logger.error('Get client by ID error', {
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
    static async updateClient(req, res) {
        try {
            if (req.user?.role !== 'admin') {
                res.status(403).json({
                    success: false,
                    message: 'Admin access required'
                });
                return;
            }
            const { id } = req.params;
            const { company_name, address_line1, address_line2, city, state, postal_code, country, total_bait_stations_inside, total_bait_stations_outside, total_insect_monitors_light, total_insect_monitors_box } = req.body;
            const existingClient = await (0, database_1.executeQuerySingle)('SELECT * FROM clients WHERE id = ? AND deleted_at IS NULL', [id]);
            if (!existingClient) {
                res.status(404).json({
                    success: false,
                    message: 'Client not found'
                });
                return;
            }
            if (company_name && company_name !== existingClient.company_name) {
                const nameConflict = await (0, database_1.executeQuerySingle)('SELECT id FROM clients WHERE company_name = ? AND id != ? AND deleted_at IS NULL', [company_name, id]);
                if (nameConflict) {
                    res.status(409).json({
                        success: false,
                        message: `Company name "${company_name}" already exists`
                    });
                    return;
                }
            }
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
            await (0, database_1.executeQuery)(updateQuery, [
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
            const updatedClient = await (0, database_1.executeQuerySingle)('SELECT id, company_name, address_line1, address_line2, city, state, postal_code, status, created_at, updated_at FROM clients WHERE id = ?', [id]);
            logger_1.logger.info('Client updated', {
                client_id: id,
                updated_fields: { company_name, address_line1, city, state },
                updated_by: req.user.id
            });
            res.json({
                success: true,
                message: 'Client updated successfully',
                data: updatedClient
            });
        }
        catch (error) {
            logger_1.logger.error('Update client error', {
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
    static async deleteClient(req, res) {
        try {
            if (req.user?.role !== 'admin') {
                res.status(403).json({
                    success: false,
                    message: 'Admin access required'
                });
                return;
            }
            const { id } = req.params;
            const client = await (0, database_1.executeQuerySingle)('SELECT * FROM clients WHERE id = ? AND deleted_at IS NULL', [id]);
            if (!client) {
                res.status(404).json({
                    success: false,
                    message: 'Client not found'
                });
                return;
            }
            const existingReports = await (0, database_1.executeQuerySingle)('SELECT COUNT(*) as count FROM reports WHERE client_id = ?', [id]);
            if (existingReports?.count > 0) {
                res.status(400).json({
                    success: false,
                    message: `Cannot delete client with ${existingReports.count} existing reports. Client will be deactivated instead.`,
                    data: {
                        existing_reports: existingReports.count,
                        action_taken: 'deactivation'
                    }
                });
                await (0, database_1.executeQuery)('UPDATE clients SET status = "inactive", updated_at = NOW() WHERE id = ?', [id]);
                await (0, database_1.executeQuery)('UPDATE client_pco_assignments SET status = "inactive", unassigned_at = NOW(), unassigned_by = ? WHERE client_id = ? AND status = "active"', [req.user.id, id]);
                return;
            }
            await (0, database_1.executeQuery)('UPDATE clients SET deleted_at = NOW(), status = "inactive" WHERE id = ?', [id]);
            await (0, database_1.executeQuery)('UPDATE client_pco_assignments SET status = "inactive", unassigned_at = NOW(), unassigned_by = ? WHERE client_id = ? AND status = "active"', [req.user.id, id]);
            logger_1.logger.info('Client soft deleted', {
                deleted_client_id: id,
                deleted_client_name: client.company_name,
                deleted_by: req.user.id
            });
            res.json({
                success: true,
                message: 'Client deleted successfully'
            });
        }
        catch (error) {
            logger_1.logger.error('Delete client error', {
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
    static async getClientContacts(req, res) {
        try {
            if (req.user?.role !== 'admin') {
                res.status(403).json({
                    success: false,
                    message: 'Admin access required'
                });
                return;
            }
            const { id } = req.params;
            const client = await (0, database_1.executeQuerySingle)('SELECT id, company_name FROM clients WHERE id = ? AND deleted_at IS NULL', [id]);
            if (!client) {
                res.status(404).json({
                    success: false,
                    message: 'Client not found'
                });
                return;
            }
            const contacts = await (0, database_1.executeQuery)(`
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
                        primary_contacts: contacts.filter((c) => c.is_primary).length
                    }
                }
            });
        }
        catch (error) {
            logger_1.logger.error('Get client contacts error', {
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
    static async addClientContact(req, res) {
        try {
            if (req.user?.role !== 'admin') {
                res.status(403).json({
                    success: false,
                    message: 'Admin access required'
                });
                return;
            }
            const { id } = req.params;
            const { name, role, phone, email, is_primary } = req.body;
            const client = await (0, database_1.executeQuerySingle)('SELECT id, company_name FROM clients WHERE id = ? AND deleted_at IS NULL', [id]);
            if (!client) {
                res.status(404).json({
                    success: false,
                    message: 'Client not found'
                });
                return;
            }
            if (is_primary) {
                await (0, database_1.executeQuery)('UPDATE client_contacts SET is_primary = 0 WHERE client_id = ?', [id]);
            }
            const result = await (0, database_1.executeQuery)(`
        INSERT INTO client_contacts (client_id, name, role, phone, email, is_primary)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [id, name, role || 'other', phone, email, is_primary ? 1 : 0]);
            const newContact = await (0, database_1.executeQuerySingle)('SELECT * FROM client_contacts WHERE id = ?', [result.insertId]);
            logger_1.logger.info('New client contact added', {
                client_id: id,
                contact_id: result.insertId,
                name,
                added_by: req.user.id
            });
            res.status(201).json({
                success: true,
                message: 'Contact added successfully',
                data: newContact
            });
        }
        catch (error) {
            logger_1.logger.error('Add client contact error', {
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
    static async updateClientContact(req, res) {
        try {
            if (req.user?.role !== 'admin') {
                res.status(403).json({
                    success: false,
                    message: 'Admin access required'
                });
                return;
            }
            const { id, contactId } = req.params;
            const { name, role, phone, email, is_primary } = req.body;
            const existingContact = await (0, database_1.executeQuerySingle)('SELECT * FROM client_contacts WHERE id = ? AND client_id = ?', [contactId, id]);
            if (!existingContact) {
                res.status(404).json({
                    success: false,
                    message: 'Contact not found'
                });
                return;
            }
            if (is_primary) {
                await (0, database_1.executeQuery)('UPDATE client_contacts SET is_primary = 0 WHERE client_id = ? AND id != ?', [id, contactId]);
            }
            await (0, database_1.executeQuery)(`
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
            const updatedContact = await (0, database_1.executeQuerySingle)('SELECT * FROM client_contacts WHERE id = ?', [contactId]);
            logger_1.logger.info('Client contact updated', {
                client_id: id,
                contact_id: contactId,
                updated_by: req.user.id
            });
            res.json({
                success: true,
                message: 'Contact updated successfully',
                data: updatedContact
            });
        }
        catch (error) {
            logger_1.logger.error('Update client contact error', {
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
    static async deleteClientContact(req, res) {
        try {
            if (req.user?.role !== 'admin') {
                res.status(403).json({
                    success: false,
                    message: 'Admin access required'
                });
                return;
            }
            const { id, contactId } = req.params;
            const contact = await (0, database_1.executeQuerySingle)('SELECT * FROM client_contacts WHERE id = ? AND client_id = ?', [contactId, id]);
            if (!contact) {
                res.status(404).json({
                    success: false,
                    message: 'Contact not found'
                });
                return;
            }
            const contactCount = await (0, database_1.executeQuerySingle)('SELECT COUNT(*) as count FROM client_contacts WHERE client_id = ?', [id]);
            if (contactCount?.count <= 1) {
                res.status(400).json({
                    success: false,
                    message: 'Cannot delete the only contact. Client must have at least one contact.'
                });
                return;
            }
            await (0, database_1.executeQuery)('DELETE FROM client_contacts WHERE id = ?', [contactId]);
            logger_1.logger.info('Client contact deleted', {
                client_id: id,
                contact_id: contactId,
                contact_name: contact.name,
                deleted_by: req.user.id
            });
            res.json({
                success: true,
                message: 'Contact deleted successfully'
            });
        }
        catch (error) {
            logger_1.logger.error('Delete client contact error', {
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
    static async getClientReports(req, res) {
        try {
            if (req.user?.role !== 'admin') {
                res.status(403).json({
                    success: false,
                    message: 'Admin access required'
                });
                return;
            }
            const { id } = req.params;
            const { status, limit = 50 } = req.query;
            const client = await (0, database_1.executeQuerySingle)('SELECT id, company_name FROM clients WHERE id = ? AND deleted_at IS NULL', [id]);
            if (!client) {
                res.status(404).json({
                    success: false,
                    message: 'Client not found'
                });
                return;
            }
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
            const queryParams = [id];
            if (status && status !== 'all') {
                query += ' AND r.status = ?';
                queryParams.push(status);
            }
            query += ' ORDER BY r.service_date DESC LIMIT ?';
            queryParams.push(parseInt(limit));
            const reports = await (0, database_1.executeQuery)(query, queryParams);
            const summary = await (0, database_1.executeQuerySingle)(`
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
        }
        catch (error) {
            logger_1.logger.error('Get client reports error', {
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
    static async assignPcoToClient(req, res) {
        try {
            if (req.user?.role !== 'admin') {
                res.status(403).json({
                    success: false,
                    message: 'Admin access required'
                });
                return;
            }
            const { id } = req.params;
            const { pco_id } = req.body;
            const client = await (0, database_1.executeQuerySingle)('SELECT * FROM clients WHERE id = ? AND deleted_at IS NULL', [id]);
            if (!client) {
                res.status(404).json({
                    success: false,
                    message: 'Client not found'
                });
                return;
            }
            const pco = await (0, database_1.executeQuerySingle)('SELECT * FROM users WHERE id = ? AND role IN ("pco", "both") AND deleted_at IS NULL AND status = "active"', [pco_id]);
            if (!pco) {
                res.status(404).json({
                    success: false,
                    message: 'PCO not found or not active'
                });
                return;
            }
            const existingAssignment = await (0, database_1.executeQuerySingle)('SELECT * FROM client_pco_assignments WHERE client_id = ? AND status = "active"', [id]);
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
            await (0, database_1.executeQuery)(`
        INSERT INTO client_pco_assignments (
          client_id, 
          pco_id, 
          assigned_by, 
          assigned_at, 
          status
        ) VALUES (?, ?, ?, NOW(), 'active')
      `, [id, pco_id, req.user.id]);
            logger_1.logger.info('PCO assigned to client', {
                client_id: id,
                client_name: client.company_name,
                pco_id,
                pco_name: pco.name,
                assigned_by: req.user.id
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
        }
        catch (error) {
            logger_1.logger.error('Assign PCO to client error', {
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
    static async unassignPcoFromClient(req, res) {
        try {
            if (req.user?.role !== 'admin') {
                res.status(403).json({
                    success: false,
                    message: 'Admin access required'
                });
                return;
            }
            const { id } = req.params;
            const client = await (0, database_1.executeQuerySingle)('SELECT * FROM clients WHERE id = ? AND deleted_at IS NULL', [id]);
            if (!client) {
                res.status(404).json({
                    success: false,
                    message: 'Client not found'
                });
                return;
            }
            const activeAssignment = await (0, database_1.executeQuerySingle)(`
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
            await (0, database_1.executeQuery)(`
        DELETE FROM client_pco_assignments 
        WHERE client_id = ? AND status = 'inactive'
      `, [id]);
            await (0, database_1.executeQuery)(`
        UPDATE client_pco_assignments 
        SET status = 'inactive', unassigned_at = NOW(), unassigned_by = ?
        WHERE client_id = ? AND status = 'active'
      `, [req.user.id, id]);
            logger_1.logger.info('PCO unassigned from client', {
                client_id: id,
                client_name: client.company_name,
                pco_id: activeAssignment.pco_id,
                pco_name: activeAssignment.pco_name,
                unassigned_by: req.user.id
            });
            res.json({
                success: true,
                message: `PCO ${activeAssignment.pco_name} unassigned from client ${client.company_name} successfully`
            });
        }
        catch (error) {
            logger_1.logger.error('Unassign PCO from client error', {
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
    static async getClientPcoAssignments(req, res) {
        try {
            if (req.user?.role !== 'admin') {
                res.status(403).json({
                    success: false,
                    message: 'Admin access required'
                });
                return;
            }
            const { id } = req.params;
            const client = await (0, database_1.executeQuerySingle)('SELECT id, company_name FROM clients WHERE id = ? AND deleted_at IS NULL', [id]);
            if (!client) {
                res.status(404).json({
                    success: false,
                    message: 'Client not found'
                });
                return;
            }
            const assignments = await (0, database_1.executeQuery)(`
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
                        active_assignments: assignments.filter((a) => a.status === 'active').length,
                        inactive_assignments: assignments.filter((a) => a.status === 'inactive').length
                    }
                }
            });
        }
        catch (error) {
            logger_1.logger.error('Get client PCO assignments error', {
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
    static async searchClients(req, res) {
        try {
            if (req.user?.role !== 'admin') {
                res.status(403).json({
                    success: false,
                    message: 'Admin access required'
                });
                return;
            }
            const { q, status, pco_id, limit = 10 } = req.query;
            if (!q || q.length < 2) {
                res.status(400).json({
                    success: false,
                    message: 'Search query must be at least 2 characters'
                });
                return;
            }
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
                queryParams.push(status);
            }
            if (pco_id && pco_id !== 'all') {
                query += ' AND cpa.pco_id = ?';
                queryParams.push(pco_id);
            }
            query += ' ORDER BY c.company_name ASC LIMIT ?';
            queryParams.push(limit);
            const clients = await (0, database_1.executeQuery)(query, queryParams);
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
        }
        catch (error) {
            logger_1.logger.error('Search clients error', {
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
exports.ClientController = ClientController;
exports.default = ClientController;
//# sourceMappingURL=clientController.js.map