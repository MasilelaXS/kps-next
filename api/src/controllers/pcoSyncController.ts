/**
 * PCO Sync & Offline Data Controller
 * Phase 4.2 - Data Synchronization for Mobile App
 * 
 * Handles:
 * - Full data sync for offline work
 * - Incremental sync with timestamps
 * - Report upload from offline
 * - Data export for backup
 * 
 * Business Rules:
 * - Maximum 10 reports per client for offline storage
 * - Only active assignments and chemicals
 * - PCO can only sync their own data
 */

import { Request, Response } from 'express';
import { executeQuery } from '../config/database';
import { RowDataPacket } from 'mysql2';
import { logger } from '../config/logger';

/**
 * GET /api/pco/sync/full
 * Complete data sync for initial login or full refresh
 * 
 * Returns:
 * - User profile
 * - Assigned clients with contacts
 * - All active chemicals
 * - Last 10 reports per assigned client (for context)
 */
export const getFullSync = async (req: Request, res: Response) => {
  try {
    const pcoId = req.user!.id;

    // Get user profile
    const userProfile = await executeQuery<RowDataPacket[]>(
      `SELECT id, pco_number, name, email, phone, role 
       FROM users 
       WHERE id = ?`,
      [pcoId]
    );

    if (userProfile.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get assigned clients with contacts
    const clients = await executeQuery<RowDataPacket[]>(
      `SELECT 
        c.id,
        c.company_name,
        c.address_line1,
        c.address_line2,
        c.city,
        c.state,
        c.postal_code,
        c.country,
        c.status,
        c.total_bait_stations_inside,
        c.total_bait_stations_outside,
        c.total_insect_monitors_light,
        c.total_insect_monitors_box,
        cpa.assigned_at,
        CONCAT('[', COALESCE(GROUP_CONCAT(
          JSON_OBJECT(
            'id', cc.id,
            'name', cc.name,
            'role', cc.role,
            'phone', cc.phone,
            'email', cc.email,
            'is_primary', cc.is_primary
          )
        ), ''), ']') as contacts
       FROM clients c
       JOIN client_pco_assignments cpa ON c.id = cpa.client_id
       LEFT JOIN client_contacts cc ON cc.client_id = c.id
       WHERE cpa.pco_id = ? AND cpa.status = 'active' AND c.status = 'active'
       GROUP BY c.id, c.company_name, c.address_line1, c.address_line2, c.city, c.state, c.postal_code, c.country, c.status, c.total_bait_stations_inside, c.total_bait_stations_outside, c.total_insect_monitors_light, c.total_insect_monitors_box, cpa.assigned_at
       ORDER BY c.company_name`,
      [pcoId]
    );

    // Get all active chemicals
    const chemicals = await executeQuery<RowDataPacket[]>(
      `SELECT 
        id,
        name,
        active_ingredients,
        usage_type,
        quantity_unit,
        safety_information
       FROM chemicals 
       WHERE status = 'active'
       ORDER BY name`
    );

    // Get last 10 reports per assigned client
    // Simplified for MariaDB 10.4 compatibility (no nested sub-modules for now)
    // TODO: Optimize to include nested data when upgrading to MariaDB 10.5+
    const reportsQuery = `
      SELECT 
        r.id,
        r.client_id,
        r.pco_id,
        r.report_type,
        r.service_date,
        r.next_service_date,
        r.status,
        r.pco_signature_data,
        r.client_signature_data,
        r.client_signature_name,
        r.general_remarks,
        r.admin_notes,
        r.created_at,
        r.submitted_at,
        r.reviewed_at,
        c.company_name as client_name
      FROM (
        SELECT r.*, ROW_NUMBER() OVER (PARTITION BY client_id ORDER BY service_date DESC, id DESC) as rn
        FROM reports r
        WHERE r.pco_id = ? 
          AND r.status IN ('approved', 'pending', 'declined')
          AND r.client_id IN (
            SELECT client_id FROM client_pco_assignments 
            WHERE pco_id = ? AND status = 'active'
          )
      ) r
      JOIN clients c ON r.client_id = c.id
      WHERE r.rn <= 10
      ORDER BY r.client_id, r.service_date DESC
    `;

    const reports = await executeQuery<RowDataPacket[]>(reportsQuery, [pcoId, pcoId]);

    // Return simplified reports without nested data for MariaDB 10.4 compatibility
    // PCO mobile app can fetch sub-modules separately if needed
    // TODO: When upgrading to MariaDB 10.5+, restore nested JSON_ARRAYAGG queries for better performance
    const parsedReports = reports.map((report: any) => ({
      ...report,
      bait_stations: [], // Empty for now - mobile app can fetch separately
      fumigation: null,
      insect_monitors: []
    }));

    // Parse client contacts
    const parsedClients = clients.map((client: any) => ({
      ...client,
      contacts: client.contacts ? JSON.parse(client.contacts) : []
    }));

    const syncTimestamp = new Date().toISOString();

    logger.info(`Full sync completed for PCO ${pcoId}: ${parsedClients.length} clients, ${chemicals.length} chemicals, ${parsedReports.length} reports`);

    return res.json({
      success: true,
      data: {
        user: userProfile[0],
        clients: parsedClients,
        chemicals: chemicals,
        reports: parsedReports
      },
      sync_timestamp: syncTimestamp,
      counts: {
        clients: parsedClients.length,
        chemicals: chemicals.length,
        reports: parsedReports.length
      }
    });

  } catch (error) {
    logger.error('Error in getFullSync:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to sync data',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
};

/**
 * GET /api/pco/sync/clients
 * Incremental sync for client data only
 * 
 * Query params:
 * - since (timestamp) - Only clients updated after this time
 * - include_contacts (boolean) - Include contact details (default: true)
 */
export const syncClients = async (req: Request, res: Response) => {
  try {
    const pcoId = req.user!.id;
    const { since, include_contacts = 'true' } = req.query;

    let query = `
      SELECT 
        c.id,
        c.company_name,
        c.address_line1,
        c.address_line2,
        c.city,
        c.state,
        c.postal_code,
        c.country,
        c.status,
        c.total_bait_stations_inside,
        c.total_bait_stations_outside,
        c.total_insect_monitors_light,
        c.total_insect_monitors_box,
        c.updated_at,
        cpa.assigned_at
    `;

    if (include_contacts === 'true') {
      query += `,
        CONCAT('[', COALESCE(GROUP_CONCAT(
          DISTINCT JSON_OBJECT(
            'id', cc.id,
            'name', cc.name,
            'role', cc.role,
            'phone', cc.phone,
            'email', cc.email,
            'is_primary', cc.is_primary
          )
        ), ''), ']') as contacts
      `;
    }

    query += `
      FROM clients c
      JOIN client_pco_assignments cpa ON c.id = cpa.client_id
    `;
    
    if (include_contacts === 'true') {
      query += `LEFT JOIN client_contacts cc ON cc.client_id = c.id `;
    }
    
    query += `
      WHERE cpa.pco_id = ? AND cpa.status = 'active' AND c.status = 'active'
    `;

    const params: any[] = [pcoId];

    if (since) {
      query += ` AND (c.updated_at > ? OR cpa.assigned_at > ?)`;
      params.push(since, since);
    }

    // Always add GROUP BY when include_contacts is true (needed for aggregation)
    if (include_contacts === 'true') {
      query += ` GROUP BY c.id, c.company_name, c.address_line1, c.address_line2, c.city, c.state, c.postal_code, c.country, c.status, c.total_bait_stations_inside, c.total_bait_stations_outside, c.total_insect_monitors_light, c.total_insect_monitors_box, c.updated_at, cpa.assigned_at`;
    }

    query += ` ORDER BY c.company_name`;

    const clients = await executeQuery<RowDataPacket[]>(query, params);

    // Parse contacts if included
    const parsedClients = clients.map((client: any) => ({
      ...client,
      contacts: include_contacts === 'true' && client.contacts ? JSON.parse(client.contacts) : undefined
    }));

    logger.info(`Client sync for PCO ${pcoId}: ${parsedClients.length} clients`);

    return res.json({
      success: true,
      data: parsedClients,
      sync_timestamp: new Date().toISOString(),
      count: parsedClients.length
    });

  } catch (error) {
    logger.error('Error in syncClients:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to sync clients',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
};

/**
 * GET /api/pco/sync/chemicals
 * Incremental sync for chemical data
 * 
 * Query params:
 * - since (timestamp) - Only chemicals updated after this time
 */
export const syncChemicals = async (req: Request, res: Response) => {
  try {
    const { since } = req.query;

    let query = `
      SELECT 
        id,
        name,
        active_ingredients,
        usage_type,
        quantity_unit,
        safety_information,
        updated_at
      FROM chemicals 
      WHERE status = 'active'
    `;

    const params: any[] = [];

    if (since) {
      query += ` AND updated_at > ?`;
      params.push(since);
    }

    query += ` ORDER BY name`;

    const chemicals = await executeQuery<RowDataPacket[]>(query, params);

    logger.info(`Chemical sync: ${chemicals.length} chemicals`);

    return res.json({
      success: true,
      data: chemicals,
      sync_timestamp: new Date().toISOString(),
      count: chemicals.length
    });

  } catch (error) {
    logger.error('Error in syncChemicals:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to sync chemicals',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
};

/**
 * GET /api/pco/sync/recent-reports
 * Incremental sync for report updates
 * 
 * Query params:
 * - since (timestamp) - Only reports updated after this time
 * - client_id (optional) - Filter by specific client
 */
export const syncRecentReports = async (req: Request, res: Response) => {
  try {
    const pcoId = req.user!.id;
    const { since, client_id } = req.query;

    let query = `
      SELECT 
        r.id,
        r.client_id,
        r.pco_id,
        r.report_type,
        r.service_date,
        r.next_service_date,
        r.status,
        r.pco_signature_data,
        r.client_signature_data,
        r.client_signature_name,
        r.general_remarks,
        r.admin_notes,
        r.created_at,
        r.updated_at,
        r.submitted_at,
        r.reviewed_at,
        c.company_name as client_name
      FROM (
        SELECT r.*, ROW_NUMBER() OVER (PARTITION BY client_id ORDER BY service_date DESC, id DESC) as rn
        FROM reports r
        WHERE r.pco_id = ?
    `;

    const params: any[] = [pcoId];

    if (since) {
      query += ` AND r.updated_at > ?`;
      params.push(since);
    }

    if (client_id) {
      query += ` AND r.client_id = ?`;
      params.push(client_id);
    }

    query += `
      ) r
      JOIN clients c ON r.client_id = c.id
      WHERE r.rn <= 10
      ORDER BY r.updated_at DESC
    `;

    const reports = await executeQuery<RowDataPacket[]>(query, params);

    // Return simplified reports for MariaDB 10.4 compatibility
    // PCO mobile app can fetch sub-modules separately if needed
    const parsedReports = reports.map((report: any) => ({
      ...report,
      bait_stations: [],
      fumigation: null,
      insect_monitors: []
    }));

    logger.info(`Report sync for PCO ${pcoId}: ${parsedReports.length} reports`);

    return res.json({
      success: true,
      data: parsedReports,
      sync_timestamp: new Date().toISOString(),
      count: parsedReports.length
    });

  } catch (error) {
    logger.error('Error in syncRecentReports:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to sync reports',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
};

/**
 * POST /api/pco/sync/upload
 * Upload locally created/edited reports from offline
 * 
 * Body:
 * - reports: Array of report objects with local_id for mapping
 */
export const uploadReports = async (req: Request, res: Response) => {
  try {
    const pcoId = req.user!.id;
    const { reports } = req.body;

    if (!Array.isArray(reports) || reports.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Reports array is required and cannot be empty'
      });
    }

    const results: any[] = [];
    const errors: any[] = [];

    // Process each report
    for (const report of reports) {
      try {
        const { local_id, client_id, report_type, service_date, next_service_date, 
                pco_signature_data, client_signature_data, client_signature_name,
                general_remarks, bait_stations, fumigation, insect_monitors } = report;

        // Verify PCO is assigned to client
        const assignmentCheck = await executeQuery<RowDataPacket[]>(
          `SELECT id FROM client_pco_assignments 
           WHERE client_id = ? AND pco_id = ? AND status = 'active'`,
          [client_id, pcoId]
        );

        if (assignmentCheck.length === 0) {
          errors.push({
            local_id,
            error: 'Client not assigned to PCO or assignment is inactive'
          });
          continue;
        }

        // Check for duplicate (same client + service date)
        const duplicateCheck = await executeQuery<RowDataPacket[]>(
          `SELECT id FROM reports 
           WHERE client_id = ? AND pco_id = ? AND service_date = ? AND status != 'archived'`,
          [client_id, pcoId, service_date]
        );

        if (duplicateCheck.length > 0) {
          errors.push({
            local_id,
            error: 'Report already exists for this client and service date'
          });
          continue;
        }

        // Create draft report
        const reportResult = await executeQuery(
          `INSERT INTO reports 
           (client_id, pco_id, report_type, service_date, next_service_date,
            pco_signature_data, client_signature_data, client_signature_name,
            general_remarks, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', NOW(), NOW())`,
          [client_id, pcoId, report_type, service_date, next_service_date || null,
           pco_signature_data, client_signature_data, client_signature_name,
           general_remarks || null]
        ) as any;

        const reportId = reportResult.insertId;

        // Add bait stations if provided
        if (bait_stations && Array.isArray(bait_stations)) {
          for (const station of bait_stations) {
            const stationResult = await executeQuery(
              `INSERT INTO bait_stations 
               (report_id, station_number, location, is_accessible, inaccessible_reason,
                activity_detected, activity_droppings, activity_gnawing, activity_tracks,
                activity_other, activity_other_description, bait_status, station_condition,
                rodent_box_replaced, station_remarks)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [reportId, station.station_number, station.location, station.is_accessible || 1,
               station.inaccessible_reason || null, station.activity_detected || 0,
               station.activity_droppings || 0, station.activity_gnawing || 0, 
               station.activity_tracks || 0, station.activity_other || 0,
               station.activity_other_description || null, station.bait_status || 'clean',
               station.station_condition || 'good', station.rodent_box_replaced || 0,
               station.station_remarks || null]
            ) as any;

            // Add station chemicals
            if (station.chemicals && Array.isArray(station.chemicals)) {
              for (const chem of station.chemicals) {
                await executeQuery(
                  `INSERT INTO station_chemicals (station_id, chemical_id, quantity, batch_number)
                   VALUES (?, ?, ?, ?)`,
                  [stationResult.insertId, chem.chemical_id, chem.quantity, chem.batch_number || null]
                );
              }
            }
          }
        }

        // Add fumigation data if provided
        if (fumigation) {
          // Areas
          if (fumigation.areas && Array.isArray(fumigation.areas)) {
            for (const area of fumigation.areas) {
              await executeQuery(
                `INSERT INTO fumigation_areas (report_id, area_name, is_other, other_description)
                 VALUES (?, ?, ?, ?)`,
                [reportId, area.area_name, area.is_other || 0, area.other_description || null]
              );
            }
          }

          // Target pests
          if (fumigation.target_pests && Array.isArray(fumigation.target_pests)) {
            for (const pest of fumigation.target_pests) {
              await executeQuery(
                `INSERT INTO fumigation_target_pests (report_id, pest_name, is_other, other_description)
                 VALUES (?, ?, ?, ?)`,
                [reportId, pest.pest_name, pest.is_other || 0, pest.other_description || null]
              );
            }
          }

          // Chemicals
          if (fumigation.chemicals && Array.isArray(fumigation.chemicals)) {
            for (const chem of fumigation.chemicals) {
              await executeQuery(
                `INSERT INTO fumigation_chemicals (report_id, chemical_id, quantity, batch_number)
                 VALUES (?, ?, ?, ?)`,
                [reportId, chem.chemical_id, chem.quantity, chem.batch_number || null]
              );
            }
          }
        }

        // Add insect monitors if provided
        if (insect_monitors && Array.isArray(insect_monitors)) {
          for (const monitor of insect_monitors) {
            await executeQuery(
              `INSERT INTO insect_monitors (report_id, monitor_type, glue_board_replaced, tubes_replaced, monitor_serviced)
               VALUES (?, ?, ?, ?, ?)`,
              [reportId, monitor.monitor_type, monitor.glue_board_replaced || 0,
               monitor.tubes_replaced || null, monitor.monitor_serviced || 0]
            );
          }
        }

        results.push({
          local_id,
          server_id: reportId,
          status: 'created',
          message: 'Report created successfully'
        });

      } catch (reportError) {
        logger.error(`Error uploading report ${report.local_id}:`, reportError);
        errors.push({
          local_id: report.local_id,
          error: (reportError as Error).message
        });
      }
    }

    logger.info(`Upload completed for PCO ${pcoId}: ${results.length} successful, ${errors.length} errors`);

    return res.json({
      success: true,
      results,
      errors,
      summary: {
        total: reports.length,
        successful: results.length,
        failed: errors.length
      }
    });

  } catch (error) {
    logger.error('Error in uploadReports:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload reports',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
};

/**
 * GET /api/pco/data/export
 * Export complete offline dataset for backup
 * 
 * Query params:
 * - format (json) - Default and only supported format for now
 */
export const exportData = async (req: Request, res: Response) => {
  try {
    const pcoId = req.user!.id;
    const { format = 'json' } = req.query;

    if (format !== 'json') {
      return res.status(400).json({
        success: false,
        message: 'Only JSON format is currently supported'
      });
    }

    // Reuse getFullSync logic but format as export
    // Get user profile
    const userProfile = await executeQuery<RowDataPacket[]>(
      `SELECT id, pco_number, name, email, phone, role FROM users WHERE id = ?`,
      [pcoId]
    );

    // Get clients (reusing sync query)
    const clients = await executeQuery<RowDataPacket[]>(
      `SELECT c.*, cpa.assigned_at,
        CONCAT('[', COALESCE(GROUP_CONCAT(
          DISTINCT JSON_OBJECT(
            'id', cc.id, 
            'name', cc.name, 
            'role', cc.role, 
            'phone', cc.phone, 
            'email', cc.email, 
            'is_primary', cc.is_primary
          )
        ), ''), ']') as contacts
       FROM clients c
       JOIN client_pco_assignments cpa ON c.id = cpa.client_id
       LEFT JOIN client_contacts cc ON cc.client_id = c.id
       WHERE cpa.pco_id = ? AND cpa.status = 'active' AND c.status = 'active'
       GROUP BY c.id, cpa.assigned_at`,
      [pcoId]
    );

    // Get chemicals
    const chemicals = await executeQuery<RowDataPacket[]>(
      `SELECT id, name, active_ingredients, usage_type, quantity_unit, safety_information 
       FROM chemicals WHERE status = 'active'`
    );

    // Get reports (last 10 per client) - simplified for MariaDB 10.4
    const reports = await executeQuery<RowDataPacket[]>(
      `SELECT r.*, c.company_name as client_name
       FROM (SELECT r.*, ROW_NUMBER() OVER (PARTITION BY client_id ORDER BY service_date DESC) as rn FROM reports r WHERE r.pco_id = ?) r
       JOIN clients c ON r.client_id = c.id
       WHERE r.rn <= 10`,
      [pcoId]
    );

    const exportData = {
      export_date: new Date().toISOString(),
      app_version: '1.0.0',
      pco: userProfile[0],
      clients: clients.map((c: any) => ({ ...c, contacts: JSON.parse(c.contacts || '[]') })),
      chemicals: chemicals,
      reports: reports.map((r: any) => ({
        ...r,
        bait_stations: [],
        fumigation: null,
        insect_monitors: []
      })),
      metadata: {
        total_clients: clients.length,
        total_chemicals: chemicals.length,
        total_reports: reports.length
      }
    };

    logger.info(`Data export for PCO ${pcoId}`);

    return res.json({
      success: true,
      data: exportData
    });

  } catch (error) {
    logger.error('Error in exportData:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to export data',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
};

/**
 * PATCH /api/pco/clients/:id/update-counts
 * Update client station/monitor counts when PCO discovers changes during report creation
 * 
 * Business Rules:
 * - PCO must be assigned to the client
 * - Only updates count fields, not other client data
 * - Used when PCO finds more/fewer stations or monitors than expected
 * 
 * Security:
 * - Validates PCO assignment before allowing update
 * - Only updates count fields, prevents modification of other client data
 */
export const updateClientCounts = async (req: Request, res: Response) => {
  try {
    const pcoId = req.user!.id;
    const clientId = parseInt(req.params.id);
    const {
      total_bait_stations_inside,
      total_bait_stations_outside,
      total_insect_monitors_light,
      total_insect_monitors_box
    } = req.body;

    // Verify client exists
    const clients = await executeQuery<RowDataPacket[]>(
      'SELECT id, company_name FROM clients WHERE id = ? AND deleted_at IS NULL',
      [clientId]
    );

    if (clients.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    // Verify PCO is assigned to this client
    const assignments = await executeQuery<RowDataPacket[]>(
      'SELECT id FROM client_pco_assignments WHERE client_id = ? AND pco_id = ? AND status = "active"',
      [clientId, pcoId]
    );

    if (assignments.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'You are not assigned to this client'
      });
    }

    // Build dynamic update query
    const updateFields: string[] = [];
    const updateValues: any[] = [];

    if (total_bait_stations_inside !== undefined) {
      updateFields.push('total_bait_stations_inside = ?');
      updateValues.push(total_bait_stations_inside);
    }
    if (total_bait_stations_outside !== undefined) {
      updateFields.push('total_bait_stations_outside = ?');
      updateValues.push(total_bait_stations_outside);
    }
    if (total_insect_monitors_light !== undefined) {
      updateFields.push('total_insect_monitors_light = ?');
      updateValues.push(total_insect_monitors_light);
    }
    if (total_insect_monitors_box !== undefined) {
      updateFields.push('total_insect_monitors_box = ?');
      updateValues.push(total_insect_monitors_box);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    updateFields.push('updated_at = NOW()');
    updateValues.push(clientId);

    const updateQuery = `UPDATE clients SET ${updateFields.join(', ')} WHERE id = ?`;
    await executeQuery(updateQuery, updateValues);

    // Fetch updated client data
    const updatedClients = await executeQuery<RowDataPacket[]>(
      `SELECT 
        id, 
        company_name,
        total_bait_stations_inside,
        total_bait_stations_outside,
        total_insect_monitors_light,
        total_insect_monitors_box,
        updated_at
       FROM clients WHERE id = ?`,
      [clientId]
    );

    logger.info(`Client counts updated by PCO ${pcoId} for client ${clientId}`);

    return res.json({
      success: true,
      message: 'Client counts updated successfully',
      data: updatedClients[0]
    });

  } catch (error) {
    logger.error('Error in updateClientCounts:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update client counts',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
};

/**
 * GET /api/pco/reports/last-for-client/:clientId
 * Get last approved report for client with complete bait station details
 * 
 * Used for pre-filling station data when PCO creates new report
 * Returns full station details including activity, conditions, etc.
 * 
 * Business Rules:
 * - Only returns approved reports (not drafts or pending)
 * - PCO must be assigned to the client
 * - Returns complete station data for exact pre-fill matching
 */
export const getLastReportForClient = async (req: Request, res: Response) => {
  try {
    const pcoId = req.user!.id;
    const clientId = parseInt(req.params.clientId);

    // Verify PCO is assigned to client
    const assignments = await executeQuery<RowDataPacket[]>(
      'SELECT id FROM client_pco_assignments WHERE client_id = ? AND pco_id = ? AND status = "active"',
      [clientId, pcoId]
    );

    if (assignments.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'You are not assigned to this client'
      });
    }

    // Get last approved report
    const lastReportQuery = `
      SELECT id, service_date 
      FROM reports 
      WHERE client_id = ? AND status = 'approved'
      ORDER BY service_date DESC, id DESC
      LIMIT 1
    `;

    const lastReports = await executeQuery<RowDataPacket[]>(lastReportQuery, [clientId]);

    if (lastReports.length === 0) {
      return res.json({
        success: true,
        message: 'No previous reports found',
        data: null
      });
    }

    const reportId = (lastReports[0] as any).id;

    // Get complete bait station data
    const baitStations = await executeQuery<RowDataPacket[]>(
      `SELECT 
        station_number,
        location,
        is_accessible,
        inaccessible_reason,
        activity_detected,
        activity_droppings,
        activity_gnawing,
        activity_tracks,
        activity_other,
        activity_other_description,
        bait_status,
        station_condition,
        action_taken,
        warning_sign_condition,
        rodent_box_replaced,
        station_remarks
      FROM bait_stations 
      WHERE report_id = ?
      ORDER BY location, station_number`,
      [reportId]
    );

    // Get bait station chemicals
    const stationChemicals = await executeQuery<RowDataPacket[]>(
      `SELECT 
        sc.station_id as bait_station_id,
        sc.chemical_id,
        c.name as chemical_name,
        sc.quantity,
        sc.batch_number
      FROM bait_stations bs
      JOIN station_chemicals sc ON bs.id = sc.station_id
      JOIN chemicals c ON sc.chemical_id = c.id
      WHERE bs.report_id = ?`,
      [reportId]
    );

    // Map chemicals to stations
    const stationsWithChemicals = baitStations.map((station: any) => ({
      ...station,
      chemicals: stationChemicals.filter((chem: any) => 
        chem.bait_station_id === station.id
      ).map((chem: any) => ({
        chemicalId: chem.chemical_id,
        chemicalName: chem.chemical_name,
        quantity: chem.quantity,
        batchNumber: chem.batch_number
      }))
    }));

    logger.info(`Last report data retrieved for client ${clientId} by PCO ${pcoId}`);

    return res.json({
      success: true,
      message: 'Previous report data retrieved successfully',
      data: {
        report_id: reportId,
        service_date: (lastReports[0] as any).service_date,
        bait_stations: stationsWithChemicals
      }
    });

  } catch (error) {
    logger.error('Error in getLastReportForClient:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve previous report data',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
};
