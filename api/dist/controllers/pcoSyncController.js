"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportData = exports.uploadReports = exports.syncRecentReports = exports.syncChemicals = exports.syncClients = exports.getFullSync = void 0;
const database_1 = require("../config/database");
const logger_1 = require("../config/logger");
const getFullSync = async (req, res) => {
    try {
        const pcoId = req.user.id;
        const userProfile = await (0, database_1.executeQuery)(`SELECT id, pco_number, name, email, phone, role 
       FROM users 
       WHERE id = ?`, [pcoId]);
        if (userProfile.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        const clients = await (0, database_1.executeQuery)(`SELECT 
        c.id,
        c.company_name,
        c.address_line1,
        c.address_line2,
        c.city,
        c.state,
        c.postal_code,
        c.country,
        c.status,
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
       GROUP BY c.id, c.company_name, c.address_line1, c.address_line2, c.city, c.state, c.postal_code, c.country, c.status, cpa.assigned_at
       ORDER BY c.company_name`, [pcoId]);
        const chemicals = await (0, database_1.executeQuery)(`SELECT 
        id,
        name,
        active_ingredients,
        usage_type,
        quantity_unit,
        safety_information
       FROM chemicals 
       WHERE status = 'active'
       ORDER BY name`);
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
        const reports = await (0, database_1.executeQuery)(reportsQuery, [pcoId, pcoId]);
        const parsedReports = reports.map((report) => ({
            ...report,
            bait_stations: [],
            fumigation: null,
            insect_monitors: []
        }));
        const parsedClients = clients.map((client) => ({
            ...client,
            contacts: client.contacts ? JSON.parse(client.contacts) : []
        }));
        const syncTimestamp = new Date().toISOString();
        logger_1.logger.info(`Full sync completed for PCO ${pcoId}: ${parsedClients.length} clients, ${chemicals.length} chemicals, ${parsedReports.length} reports`);
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
    }
    catch (error) {
        logger_1.logger.error('Error in getFullSync:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to sync data',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
exports.getFullSync = getFullSync;
const syncClients = async (req, res) => {
    try {
        const pcoId = req.user.id;
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
        const params = [pcoId];
        if (since) {
            query += ` AND (c.updated_at > ? OR cpa.assigned_at > ?)`;
            params.push(since, since);
        }
        if (include_contacts === 'true') {
            query += ` GROUP BY c.id, c.company_name, c.address_line1, c.address_line2, c.city, c.state, c.postal_code, c.country, c.status, c.updated_at, cpa.assigned_at`;
        }
        query += ` ORDER BY c.company_name`;
        const clients = await (0, database_1.executeQuery)(query, params);
        const parsedClients = clients.map((client) => ({
            ...client,
            contacts: include_contacts === 'true' && client.contacts ? JSON.parse(client.contacts) : undefined
        }));
        logger_1.logger.info(`Client sync for PCO ${pcoId}: ${parsedClients.length} clients`);
        return res.json({
            success: true,
            data: parsedClients,
            sync_timestamp: new Date().toISOString(),
            count: parsedClients.length
        });
    }
    catch (error) {
        logger_1.logger.error('Error in syncClients:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to sync clients',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
exports.syncClients = syncClients;
const syncChemicals = async (req, res) => {
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
        const params = [];
        if (since) {
            query += ` AND updated_at > ?`;
            params.push(since);
        }
        query += ` ORDER BY name`;
        const chemicals = await (0, database_1.executeQuery)(query, params);
        logger_1.logger.info(`Chemical sync: ${chemicals.length} chemicals`);
        return res.json({
            success: true,
            data: chemicals,
            sync_timestamp: new Date().toISOString(),
            count: chemicals.length
        });
    }
    catch (error) {
        logger_1.logger.error('Error in syncChemicals:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to sync chemicals',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
exports.syncChemicals = syncChemicals;
const syncRecentReports = async (req, res) => {
    try {
        const pcoId = req.user.id;
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
        const params = [pcoId];
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
        const reports = await (0, database_1.executeQuery)(query, params);
        const parsedReports = reports.map((report) => ({
            ...report,
            bait_stations: [],
            fumigation: null,
            insect_monitors: []
        }));
        logger_1.logger.info(`Report sync for PCO ${pcoId}: ${parsedReports.length} reports`);
        return res.json({
            success: true,
            data: parsedReports,
            sync_timestamp: new Date().toISOString(),
            count: parsedReports.length
        });
    }
    catch (error) {
        logger_1.logger.error('Error in syncRecentReports:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to sync reports',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
exports.syncRecentReports = syncRecentReports;
const uploadReports = async (req, res) => {
    try {
        const pcoId = req.user.id;
        const { reports } = req.body;
        if (!Array.isArray(reports) || reports.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Reports array is required and cannot be empty'
            });
        }
        const results = [];
        const errors = [];
        for (const report of reports) {
            try {
                const { local_id, client_id, report_type, service_date, next_service_date, pco_signature_data, client_signature_data, client_signature_name, general_remarks, bait_stations, fumigation, insect_monitors } = report;
                const assignmentCheck = await (0, database_1.executeQuery)(`SELECT id FROM client_pco_assignments 
           WHERE client_id = ? AND pco_id = ? AND status = 'active'`, [client_id, pcoId]);
                if (assignmentCheck.length === 0) {
                    errors.push({
                        local_id,
                        error: 'Client not assigned to PCO or assignment is inactive'
                    });
                    continue;
                }
                const duplicateCheck = await (0, database_1.executeQuery)(`SELECT id FROM reports 
           WHERE client_id = ? AND pco_id = ? AND service_date = ? AND status != 'archived'`, [client_id, pcoId, service_date]);
                if (duplicateCheck.length > 0) {
                    errors.push({
                        local_id,
                        error: 'Report already exists for this client and service date'
                    });
                    continue;
                }
                const reportResult = await (0, database_1.executeQuery)(`INSERT INTO reports 
           (client_id, pco_id, report_type, service_date, next_service_date,
            pco_signature_data, client_signature_data, client_signature_name,
            general_remarks, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', NOW(), NOW())`, [client_id, pcoId, report_type, service_date, next_service_date || null,
                    pco_signature_data, client_signature_data, client_signature_name,
                    general_remarks || null]);
                const reportId = reportResult.insertId;
                if (bait_stations && Array.isArray(bait_stations)) {
                    for (const station of bait_stations) {
                        const stationResult = await (0, database_1.executeQuery)(`INSERT INTO bait_stations 
               (report_id, station_number, location, is_accessible, inaccessible_reason,
                activity_detected, activity_droppings, activity_gnawing, activity_tracks,
                activity_other, activity_other_description, bait_status, station_condition,
                rodent_box_replaced, station_remarks)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [reportId, station.station_number, station.location, station.is_accessible || 1,
                            station.inaccessible_reason || null, station.activity_detected || 0,
                            station.activity_droppings || 0, station.activity_gnawing || 0,
                            station.activity_tracks || 0, station.activity_other || 0,
                            station.activity_other_description || null, station.bait_status || 'clean',
                            station.station_condition || 'good', station.rodent_box_replaced || 0,
                            station.station_remarks || null]);
                        if (station.chemicals && Array.isArray(station.chemicals)) {
                            for (const chem of station.chemicals) {
                                await (0, database_1.executeQuery)(`INSERT INTO station_chemicals (station_id, chemical_id, quantity, batch_number)
                   VALUES (?, ?, ?, ?)`, [stationResult.insertId, chem.chemical_id, chem.quantity, chem.batch_number || null]);
                            }
                        }
                    }
                }
                if (fumigation) {
                    if (fumigation.areas && Array.isArray(fumigation.areas)) {
                        for (const area of fumigation.areas) {
                            await (0, database_1.executeQuery)(`INSERT INTO fumigation_areas (report_id, area_name, is_other, other_description)
                 VALUES (?, ?, ?, ?)`, [reportId, area.area_name, area.is_other || 0, area.other_description || null]);
                        }
                    }
                    if (fumigation.target_pests && Array.isArray(fumigation.target_pests)) {
                        for (const pest of fumigation.target_pests) {
                            await (0, database_1.executeQuery)(`INSERT INTO fumigation_target_pests (report_id, pest_name, is_other, other_description)
                 VALUES (?, ?, ?, ?)`, [reportId, pest.pest_name, pest.is_other || 0, pest.other_description || null]);
                        }
                    }
                    if (fumigation.chemicals && Array.isArray(fumigation.chemicals)) {
                        for (const chem of fumigation.chemicals) {
                            await (0, database_1.executeQuery)(`INSERT INTO fumigation_chemicals (report_id, chemical_id, quantity, batch_number)
                 VALUES (?, ?, ?, ?)`, [reportId, chem.chemical_id, chem.quantity, chem.batch_number || null]);
                        }
                    }
                }
                if (insect_monitors && Array.isArray(insect_monitors)) {
                    for (const monitor of insect_monitors) {
                        await (0, database_1.executeQuery)(`INSERT INTO insect_monitors (report_id, monitor_type, glue_board_replaced, tubes_replaced, monitor_serviced)
               VALUES (?, ?, ?, ?, ?)`, [reportId, monitor.monitor_type, monitor.glue_board_replaced || 0,
                            monitor.tubes_replaced || null, monitor.monitor_serviced || 0]);
                    }
                }
                results.push({
                    local_id,
                    server_id: reportId,
                    status: 'created',
                    message: 'Report created successfully'
                });
            }
            catch (reportError) {
                logger_1.logger.error(`Error uploading report ${report.local_id}:`, reportError);
                errors.push({
                    local_id: report.local_id,
                    error: reportError.message
                });
            }
        }
        logger_1.logger.info(`Upload completed for PCO ${pcoId}: ${results.length} successful, ${errors.length} errors`);
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
    }
    catch (error) {
        logger_1.logger.error('Error in uploadReports:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to upload reports',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
exports.uploadReports = uploadReports;
const exportData = async (req, res) => {
    try {
        const pcoId = req.user.id;
        const { format = 'json' } = req.query;
        if (format !== 'json') {
            return res.status(400).json({
                success: false,
                message: 'Only JSON format is currently supported'
            });
        }
        const userProfile = await (0, database_1.executeQuery)(`SELECT id, pco_number, name, email, phone, role FROM users WHERE id = ?`, [pcoId]);
        const clients = await (0, database_1.executeQuery)(`SELECT c.*, cpa.assigned_at,
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
       GROUP BY c.id, cpa.assigned_at`, [pcoId]);
        const chemicals = await (0, database_1.executeQuery)(`SELECT id, name, active_ingredients, usage_type, quantity_unit, safety_information 
       FROM chemicals WHERE status = 'active'`);
        const reports = await (0, database_1.executeQuery)(`SELECT r.*, c.company_name as client_name
       FROM (SELECT r.*, ROW_NUMBER() OVER (PARTITION BY client_id ORDER BY service_date DESC) as rn FROM reports r WHERE r.pco_id = ?) r
       JOIN clients c ON r.client_id = c.id
       WHERE r.rn <= 10`, [pcoId]);
        const exportData = {
            export_date: new Date().toISOString(),
            app_version: '1.0.0',
            pco: userProfile[0],
            clients: clients.map((c) => ({ ...c, contacts: JSON.parse(c.contacts || '[]') })),
            chemicals: chemicals,
            reports: reports.map((r) => ({
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
        logger_1.logger.info(`Data export for PCO ${pcoId}`);
        return res.json({
            success: true,
            data: exportData
        });
    }
    catch (error) {
        logger_1.logger.error('Error in exportData:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to export data',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
exports.exportData = exportData;
//# sourceMappingURL=pcoSyncController.js.map