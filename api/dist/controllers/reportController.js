"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPreFillData = exports.deleteInsectMonitor = exports.updateInsectMonitor = exports.addInsectMonitor = exports.updateFumigation = exports.deleteBaitStation = exports.updateBaitStation = exports.addBaitStation = exports.declineReport = exports.approveReport = exports.submitReport = exports.deleteReport = exports.updateReport = exports.createReport = exports.getReportById = exports.getPendingReports = exports.getAdminReports = exports.getPCOReports = void 0;
const database_1 = require("../config/database");
const logger_1 = require("../config/logger");
const getPCOReports = async (req, res) => {
    try {
        const pcoId = req.user.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 25;
        const offset = (page - 1) * limit;
        const clientId = req.query.client_id ? parseInt(req.query.client_id) : null;
        const status = req.query.status || 'all';
        const startDate = req.query.start_date;
        const endDate = req.query.end_date;
        let whereConditions = ['r.pco_id = ?'];
        const queryParams = [pcoId];
        if (clientId) {
            whereConditions.push('r.client_id = ?');
            queryParams.push(clientId);
        }
        if (status !== 'all') {
            whereConditions.push('r.status = ?');
            queryParams.push(status);
        }
        if (startDate) {
            whereConditions.push('r.service_date >= ?');
            queryParams.push(startDate);
        }
        if (endDate) {
            whereConditions.push('r.service_date <= ?');
            queryParams.push(endDate);
        }
        const whereClause = whereConditions.join(' AND ');
        const countQuery = `
      SELECT COUNT(*) as total
      FROM reports r
      WHERE ${whereClause}
    `;
        const countResult = await (0, database_1.executeQuery)(countQuery, queryParams);
        const totalRecords = countResult[0].total;
        const totalPages = Math.ceil(totalRecords / limit);
        const reportsQuery = `
      SELECT 
        r.id,
        r.client_id,
        r.report_type,
        r.service_date,
        r.next_service_date,
        r.status,
        r.created_at,
        r.submitted_at,
        r.reviewed_at,
        c.company_name as client_name,
        c.city as client_city,
        CASE WHEN r.pco_signature_data IS NOT NULL THEN 1 ELSE 0 END as has_pco_signature,
        CASE WHEN r.client_signature_data IS NOT NULL THEN 1 ELSE 0 END as has_client_signature,
        (SELECT COUNT(*) FROM bait_stations WHERE report_id = r.id) as bait_stations_count,
        (SELECT COUNT(*) FROM fumigation_areas WHERE report_id = r.id) as fumigation_areas_count,
        CASE 
          WHEN r.status = 'declined' THEN r.admin_notes
          ELSE NULL 
        END as admin_notes
      FROM reports r
      JOIN clients c ON r.client_id = c.id
      WHERE ${whereClause}
      ORDER BY 
        CASE r.status
          WHEN 'draft' THEN 1
          WHEN 'declined' THEN 2
          WHEN 'pending' THEN 3
          WHEN 'approved' THEN 4
          WHEN 'archived' THEN 5
        END,
        r.created_at DESC
      LIMIT ? OFFSET ?
    `;
        const reports = await (0, database_1.executeQuery)(reportsQuery, [...queryParams, limit, offset]);
        logger_1.logger.info(`PCO ${pcoId} retrieved ${reports.length} reports`);
        return res.json({
            success: true,
            data: reports,
            pagination: {
                page,
                limit,
                total_records: totalRecords,
                total_pages: totalPages,
                has_next: page < totalPages,
                has_previous: page > 1
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Error in getPCOReports:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve reports',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
exports.getPCOReports = getPCOReports;
const getAdminReports = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 25;
        const offset = (page - 1) * limit;
        const pcoId = req.query.pco_id ? parseInt(req.query.pco_id) : null;
        const clientId = req.query.client_id ? parseInt(req.query.client_id) : null;
        const status = req.query.status || 'all';
        const startDate = req.query.start_date;
        const endDate = req.query.end_date;
        let whereConditions = ["r.status != 'draft'"];
        const queryParams = [];
        if (pcoId) {
            whereConditions.push('r.pco_id = ?');
            queryParams.push(pcoId);
        }
        if (clientId) {
            whereConditions.push('r.client_id = ?');
            queryParams.push(clientId);
        }
        if (status !== 'all') {
            whereConditions.push('r.status = ?');
            queryParams.push(status);
        }
        if (startDate) {
            whereConditions.push('r.service_date >= ?');
            queryParams.push(startDate);
        }
        if (endDate) {
            whereConditions.push('r.service_date <= ?');
            queryParams.push(endDate);
        }
        const whereClause = whereConditions.join(' AND ');
        const countQuery = `
      SELECT COUNT(*) as total
      FROM reports r
      WHERE ${whereClause}
    `;
        const countResult = await (0, database_1.executeQuery)(countQuery, queryParams);
        const totalRecords = countResult[0].total;
        const totalPages = Math.ceil(totalRecords / limit);
        const reportsQuery = `
      SELECT 
        r.id,
        r.client_id,
        r.pco_id,
        r.report_type,
        r.service_date,
        r.next_service_date,
        r.status,
        r.created_at,
        r.submitted_at,
        r.reviewed_at,
        r.reviewed_by,
        c.company_name as client_name,
        c.city as client_city,
        u.name as pco_name,
        u.pco_number,
        CASE WHEN r.pco_signature_data IS NOT NULL THEN 1 ELSE 0 END as has_pco_signature,
        CASE WHEN r.client_signature_data IS NOT NULL THEN 1 ELSE 0 END as has_client_signature,
        (SELECT COUNT(*) FROM bait_stations WHERE report_id = r.id) as bait_stations_count,
        (SELECT COUNT(*) FROM fumigation_areas WHERE report_id = r.id) as fumigation_areas_count,
        (SELECT COUNT(*) FROM insect_monitors WHERE report_id = r.id) as insect_monitors_count,
        DATEDIFF(NOW(), r.submitted_at) as days_pending,
        r.admin_notes
      FROM reports r
      JOIN clients c ON r.client_id = c.id
      JOIN users u ON r.pco_id = u.id
      WHERE ${whereClause}
      ORDER BY 
        CASE r.status
          WHEN 'pending' THEN 1
          WHEN 'declined' THEN 2
          WHEN 'approved' THEN 3
          WHEN 'archived' THEN 4
        END,
        r.submitted_at DESC,
        r.created_at DESC
      LIMIT ? OFFSET ?
    `;
        const reports = await (0, database_1.executeQuery)(reportsQuery, [...queryParams, limit, offset]);
        logger_1.logger.info(`Admin retrieved ${reports.length} reports`);
        return res.json({
            success: true,
            data: reports,
            pagination: {
                page,
                limit,
                total_records: totalRecords,
                total_pages: totalPages,
                has_next: page < totalPages,
                has_previous: page > 1
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Error in getAdminReports:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve reports',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
exports.getAdminReports = getAdminReports;
const getPendingReports = async (req, res) => {
    try {
        const query = `
      SELECT 
        r.id,
        r.report_type,
        r.service_date,
        r.submitted_at,
        c.company_name as client_name,
        c.city as client_city,
        u.name as pco_name,
        u.pco_number,
        DATEDIFF(NOW(), r.submitted_at) as days_pending,
        (SELECT COUNT(*) FROM bait_stations WHERE report_id = r.id) as bait_stations_count,
        (SELECT COUNT(*) FROM fumigation_areas WHERE report_id = r.id) as fumigation_areas_count,
        CASE 
          WHEN DATEDIFF(NOW(), r.submitted_at) >= 7 THEN 'urgent'
          WHEN DATEDIFF(NOW(), r.submitted_at) >= 3 THEN 'high'
          ELSE 'normal'
        END as priority
      FROM reports r
      JOIN clients c ON r.client_id = c.id
      JOIN users u ON r.pco_id = u.id
      WHERE r.status = 'pending'
      ORDER BY 
        DATEDIFF(NOW(), r.submitted_at) DESC,
        r.submitted_at ASC
    `;
        const pendingReports = await (0, database_1.executeQuery)(query);
        logger_1.logger.info(`Admin retrieved ${pendingReports.length} pending reports`);
        return res.json({
            success: true,
            data: pendingReports,
            total_pending: pendingReports.length
        });
    }
    catch (error) {
        logger_1.logger.error('Error in getPendingReports:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve pending reports',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
exports.getPendingReports = getPendingReports;
const getReportById = async (req, res) => {
    try {
        const reportId = parseInt(req.params.id);
        const userId = req.user.id;
        const userRole = req.user.role_context || req.user.role;
        const reportQuery = `
      SELECT 
        r.*,
        c.company_name,
        c.address_line1,
        c.address_line2,
        c.city,
        c.state,
        c.postal_code,
        u.name as pco_name,
        u.pco_number,
        u.email as pco_email,
        reviewer.name as reviewer_name
      FROM reports r
      JOIN clients c ON r.client_id = c.id
      JOIN users u ON r.pco_id = u.id
      LEFT JOIN users reviewer ON r.reviewed_by = reviewer.id
      WHERE r.id = ?
        AND (
          r.pco_id = ? 
          OR ? = 'admin'
        )
    `;
        const reports = await (0, database_1.executeQuery)(reportQuery, [reportId, userId, userRole]);
        if (reports.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Report not found or access denied'
            });
        }
        const report = reports[0];
        const baitStationsQuery = `
      SELECT 
        bs.*,
        GROUP_CONCAT(
          JSON_OBJECT(
            'id', sc.id,
            'chemical_id', sc.chemical_id,
            'chemical_name', ch.name,
            'quantity', sc.quantity,
            'batch_number', sc.batch_number
          )
        ) as chemicals
      FROM bait_stations bs
      LEFT JOIN station_chemicals sc ON bs.id = sc.station_id
      LEFT JOIN chemicals ch ON sc.chemical_id = ch.id
      WHERE bs.report_id = ?
      GROUP BY bs.id
      ORDER BY bs.location, bs.station_number
    `;
        const baitStations = await (0, database_1.executeQuery)(baitStationsQuery, [reportId]);
        const parsedBaitStations = baitStations.map(station => ({
            ...station,
            chemicals: station.chemicals ? JSON.parse(`[${station.chemicals}]`) : []
        }));
        const areasQuery = `SELECT * FROM fumigation_areas WHERE report_id = ? ORDER BY area_name`;
        const pestsQuery = `SELECT * FROM fumigation_target_pests WHERE report_id = ? ORDER BY pest_name`;
        const fumigationChemicalsQuery = `
      SELECT 
        fc.*,
        ch.name as chemical_name,
        ch.active_ingredients,
        ch.safety_information
      FROM fumigation_chemicals fc
      JOIN chemicals ch ON fc.chemical_id = ch.id
      WHERE fc.report_id = ?
      ORDER BY ch.name
    `;
        const [areas, pests, fumigationChemicals] = await Promise.all([
            (0, database_1.executeQuery)(areasQuery, [reportId]),
            (0, database_1.executeQuery)(pestsQuery, [reportId]),
            (0, database_1.executeQuery)(fumigationChemicalsQuery, [reportId])
        ]);
        const monitorsQuery = `SELECT * FROM insect_monitors WHERE report_id = ? ORDER BY monitor_type`;
        const monitors = await (0, database_1.executeQuery)(monitorsQuery, [reportId]);
        const completeReport = {
            ...report,
            bait_stations: parsedBaitStations,
            fumigation: {
                areas,
                target_pests: pests,
                chemicals: fumigationChemicals
            },
            insect_monitors: monitors
        };
        logger_1.logger.info(`Report ${reportId} retrieved by user ${userId}`);
        return res.json({
            success: true,
            data: completeReport
        });
    }
    catch (error) {
        logger_1.logger.error('Error in getReportById:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve report',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
exports.getReportById = getReportById;
const createReport = async (req, res) => {
    try {
        const pcoId = req.user.id;
        const { client_id, report_type, service_date, next_service_date, pco_signature_data, general_remarks } = req.body;
        const assignmentCheck = await (0, database_1.executeQuery)(`SELECT id FROM client_pco_assignments 
       WHERE client_id = ? AND pco_id = ? AND status = 'active'`, [client_id, pcoId]);
        if (assignmentCheck.length === 0) {
            return res.status(403).json({
                success: false,
                message: 'You are not assigned to this client'
            });
        }
        const draftCheck = await (0, database_1.executeQuery)(`SELECT id FROM reports 
       WHERE client_id = ? AND pco_id = ? AND status = 'draft'`, [client_id, pcoId]);
        if (draftCheck.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'A draft report already exists for this client. Please complete or delete it first.',
                existing_draft_id: draftCheck[0].id
            });
        }
        const insertQuery = `
      INSERT INTO reports (
        client_id, pco_id, report_type, service_date, next_service_date,
        pco_signature_data, general_remarks, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'draft')
    `;
        const result = await (0, database_1.executeQuery)(insertQuery, [
            client_id, pcoId, report_type, service_date, next_service_date || null,
            pco_signature_data || null, general_remarks || null
        ]);
        logger_1.logger.info(`Report ${result.insertId} created by PCO ${pcoId}`);
        return res.status(201).json({
            success: true,
            message: 'Report created successfully',
            report_id: result.insertId
        });
    }
    catch (error) {
        logger_1.logger.error('Error in createReport:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to create report',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
exports.createReport = createReport;
const updateReport = async (req, res) => {
    try {
        const reportId = parseInt(req.params.id);
        const pcoId = req.user.id;
        const updateData = req.body;
        const reportCheck = await (0, database_1.executeQuery)(`SELECT id FROM reports WHERE id = ? AND pco_id = ? AND status IN ('draft', 'declined')`, [reportId, pcoId]);
        if (reportCheck.length === 0) {
            return res.status(403).json({
                success: false,
                message: 'Report not found, not owned by you, or cannot be edited (only drafts and declined reports can be edited)'
            });
        }
        const fields = [];
        const values = [];
        const allowedFields = [
            'report_type', 'service_date', 'next_service_date',
            'pco_signature_data', 'client_signature_data', 'client_signature_name',
            'general_remarks'
        ];
        for (const field of allowedFields) {
            if (updateData[field] !== undefined) {
                fields.push(`${field} = ?`);
                values.push(updateData[field]);
            }
        }
        if (fields.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No valid fields to update'
            });
        }
        values.push(reportId, pcoId);
        await (0, database_1.executeQuery)(`UPDATE reports SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ? AND pco_id = ? AND status IN ('draft', 'declined')`, values);
        logger_1.logger.info(`Report ${reportId} updated by PCO ${pcoId}`);
        return res.json({
            success: true,
            message: 'Report updated successfully'
        });
    }
    catch (error) {
        logger_1.logger.error('Error in updateReport:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update report',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
exports.updateReport = updateReport;
const deleteReport = async (req, res) => {
    try {
        const reportId = parseInt(req.params.id);
        const pcoId = req.user.id;
        const reportCheck = await (0, database_1.executeQuery)(`SELECT id FROM reports WHERE id = ? AND pco_id = ? AND status = 'draft'`, [reportId, pcoId]);
        if (reportCheck.length === 0) {
            return res.status(403).json({
                success: false,
                message: 'Report not found, not owned by you, or cannot be deleted (only drafts can be deleted)'
            });
        }
        await (0, database_1.executeQuery)(`DELETE FROM reports WHERE id = ?`, [reportId]);
        logger_1.logger.info(`Report ${reportId} deleted by PCO ${pcoId}`);
        return res.json({
            success: true,
            message: 'Report deleted successfully'
        });
    }
    catch (error) {
        logger_1.logger.error('Error in deleteReport:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete report',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
exports.deleteReport = deleteReport;
const submitReport = async (req, res) => {
    try {
        const reportId = parseInt(req.params.id);
        const pcoId = req.user.id;
        const reportCheck = await (0, database_1.executeQuery)(`SELECT r.*, c.company_name
       FROM reports r
       JOIN clients c ON r.client_id = c.id
       WHERE r.id = ? AND r.pco_id = ? AND r.status IN ('draft', 'declined')`, [reportId, pcoId]);
        if (reportCheck.length === 0) {
            return res.status(403).json({
                success: false,
                message: 'Report not found, not owned by you, or already submitted'
            });
        }
        const report = reportCheck[0];
        const validation = await validateReportForSubmission(reportId, report.report_type);
        if (!validation.is_valid) {
            return res.status(400).json({
                success: false,
                message: 'Report is incomplete and cannot be submitted',
                missing_requirements: validation.missing
            });
        }
        await (0, database_1.executeQuery)(`UPDATE reports 
       SET status = 'pending', submitted_at = NOW(), updated_at = NOW()
       WHERE id = ?`, [reportId]);
        await (0, database_1.executeQuery)(`DELETE FROM client_pco_assignments 
       WHERE client_id = ? AND status = 'inactive'`, [report.client_id]);
        await (0, database_1.executeQuery)(`UPDATE client_pco_assignments 
       SET status = 'inactive', unassigned_at = NOW()
       WHERE client_id = ? AND pco_id = ? AND status = 'active'`, [report.client_id, pcoId]);
        const adminUsers = await (0, database_1.executeQuery)(`SELECT id FROM users WHERE role IN ('admin', 'both') AND status = 'active' LIMIT 1`);
        if (adminUsers.length > 0) {
            const adminId = adminUsers[0].id;
            await (0, database_1.executeQuery)(`INSERT INTO notifications (user_id, type, title, message)
         VALUES (?, 'report_submitted', 'New Report Submitted', ?)`, [
                adminId,
                `${report.company_name}: New report submitted by ${pcoId} for review`
            ]);
        }
        logger_1.logger.info(`Report ${reportId} submitted by PCO ${pcoId} - PCO auto-unassigned from client`);
        return res.json({
            success: true,
            message: 'Report submitted successfully for admin review'
        });
    }
    catch (error) {
        logger_1.logger.error('Error in submitReport:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to submit report',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
exports.submitReport = submitReport;
const approveReport = async (req, res) => {
    try {
        const reportId = parseInt(req.params.id);
        const adminId = req.user.id;
        const { admin_notes, recommendations } = req.body;
        const reportCheck = await (0, database_1.executeQuery)(`SELECT id FROM reports WHERE id = ? AND status = 'pending'`, [reportId]);
        if (reportCheck.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Report not found or not in pending status'
            });
        }
        await (0, database_1.executeQuery)(`UPDATE reports 
       SET status = 'approved',
           admin_notes = ?,
           recommendations = ?,
           reviewed_by = ?,
           reviewed_at = NOW(),
           updated_at = NOW()
       WHERE id = ? AND status = 'pending'`, [admin_notes || null, recommendations || null, adminId, reportId]);
        logger_1.logger.info(`Report ${reportId} approved by admin ${adminId}`);
        return res.json({
            success: true,
            message: 'Report approved successfully'
        });
    }
    catch (error) {
        logger_1.logger.error('Error in approveReport:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to approve report',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
exports.approveReport = approveReport;
const declineReport = async (req, res) => {
    try {
        const reportId = parseInt(req.params.id);
        const adminId = req.user.id;
        const { admin_notes } = req.body;
        if (!admin_notes || admin_notes.length < 10) {
            return res.status(400).json({
                success: false,
                message: 'admin_notes is required and must be at least 10 characters (PCO needs feedback for revision)'
            });
        }
        const reportCheck = await (0, database_1.executeQuery)(`SELECT r.*, c.company_name, u.name as pco_name
       FROM reports r
       JOIN clients c ON r.client_id = c.id
       JOIN users u ON r.pco_id = u.id
       WHERE r.id = ? AND r.status = 'pending'`, [reportId]);
        if (reportCheck.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Report not found or not in pending status'
            });
        }
        const report = reportCheck[0];
        await (0, database_1.executeQuery)(`UPDATE reports 
       SET status = 'declined',
           admin_notes = ?,
           reviewed_by = ?,
           reviewed_at = NOW(),
           updated_at = NOW()
       WHERE id = ? AND status = 'pending'`, [admin_notes, adminId, reportId]);
        await (0, database_1.executeQuery)(`UPDATE client_pco_assignments 
       SET status = 'active', assigned_at = NOW()
       WHERE client_id = ? AND pco_id = ? AND status = 'inactive'
       ORDER BY unassigned_at DESC
       LIMIT 1`, [report.client_id, report.pco_id]);
        await (0, database_1.executeQuery)(`INSERT INTO notifications (user_id, type, title, message)
       VALUES (?, 'report_declined', 'Report Declined - Revision Required', ?)`, [
            report.pco_id,
            `Your report for ${report.company_name} has been declined. Admin feedback: ${admin_notes}`
        ]);
        logger_1.logger.info(`Report ${reportId} declined by admin ${adminId} - PCO reassigned to client`);
        return res.json({
            success: true,
            message: 'Report declined successfully. PCO has been notified and reassigned for revision.'
        });
    }
    catch (error) {
        logger_1.logger.error('Error in declineReport:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to decline report',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
exports.declineReport = declineReport;
async function validateReportForSubmission(reportId, reportType) {
    const missing = [];
    const report = await (0, database_1.executeQuery)(`SELECT pco_signature_data, client_signature_data, client_signature_name 
     FROM reports WHERE id = ?`, [reportId]);
    const reportData = report[0];
    if (!reportData.pco_signature_data) {
        missing.push('PCO signature');
    }
    if (!reportData.client_signature_data) {
        missing.push('Client signature');
    }
    if (!reportData.client_signature_name) {
        missing.push('Client signature name');
    }
    if (reportType === 'bait_inspection' || reportType === 'both') {
        const baitCount = await (0, database_1.executeQuery)(`SELECT COUNT(*) as count FROM bait_stations WHERE report_id = ?`, [reportId]);
        if (baitCount[0].count === 0) {
            missing.push('At least one bait station (report type requires bait inspection data)');
        }
    }
    if (reportType === 'fumigation' || reportType === 'both') {
        const areaCount = await (0, database_1.executeQuery)(`SELECT COUNT(*) as count FROM fumigation_areas WHERE report_id = ?`, [reportId]);
        const pestCount = await (0, database_1.executeQuery)(`SELECT COUNT(*) as count FROM fumigation_target_pests WHERE report_id = ?`, [reportId]);
        if (areaCount[0].count === 0) {
            missing.push('At least one fumigation area (report type requires fumigation data)');
        }
        if (pestCount[0].count === 0) {
            missing.push('At least one target pest (report type requires fumigation data)');
        }
    }
    return {
        is_valid: missing.length === 0,
        missing
    };
}
const addBaitStation = async (req, res) => {
    try {
        const reportId = parseInt(req.params.id);
        const pcoId = req.user.id;
        const { station_number, location, is_accessible, inaccessible_reason, activity_detected, activity_droppings, activity_gnawing, activity_tracks, activity_other, activity_other_description, bait_status, station_condition, action_taken, warning_sign_condition, rodent_box_replaced, station_remarks, chemicals } = req.body;
        const reportCheck = await (0, database_1.executeQuery)(`SELECT id FROM reports WHERE id = ? AND pco_id = ? AND status IN ('draft', 'declined')`, [reportId, pcoId]);
        if (reportCheck.length === 0) {
            return res.status(403).json({
                success: false,
                message: 'Report not found, not owned by you, or not editable (only draft and declined reports can be edited)'
            });
        }
        const stationQuery = `
      INSERT INTO bait_stations (
        report_id, station_number, location, is_accessible, inaccessible_reason,
        activity_detected, activity_droppings, activity_gnawing, activity_tracks,
        activity_other, activity_other_description, bait_status, station_condition,
        action_taken, warning_sign_condition, rodent_box_replaced, station_remarks
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
        const result = await (0, database_1.executeQuery)(stationQuery, [
            reportId, station_number, location, is_accessible, inaccessible_reason || null,
            activity_detected, activity_droppings || 0, activity_gnawing || 0, activity_tracks || 0,
            activity_other || 0, activity_other_description || null, bait_status, station_condition,
            action_taken || 'none', warning_sign_condition || 'good', rodent_box_replaced || 0, station_remarks || null
        ]);
        const stationId = result.insertId;
        if (chemicals && chemicals.length > 0) {
            const chemicalValues = chemicals.map((chem) => [
                stationId,
                chem.chemical_id,
                chem.quantity,
                chem.batch_number || null
            ]);
            for (const values of chemicalValues) {
                await (0, database_1.executeQuery)(`INSERT INTO station_chemicals (station_id, chemical_id, quantity, batch_number) 
           VALUES (?, ?, ?, ?)`, values);
            }
        }
        logger_1.logger.info(`Bait station ${stationId} added to report ${reportId} by PCO ${pcoId}`);
        return res.status(201).json({
            success: true,
            message: 'Bait station added successfully',
            station_id: stationId
        });
    }
    catch (error) {
        logger_1.logger.error('Error in addBaitStation:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to add bait station',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
exports.addBaitStation = addBaitStation;
const updateBaitStation = async (req, res) => {
    try {
        const reportId = parseInt(req.params.id);
        const stationId = parseInt(req.params.stationId);
        const pcoId = req.user.id;
        const updateData = req.body;
        const checkQuery = `
      SELECT bs.id 
      FROM bait_stations bs
      JOIN reports r ON bs.report_id = r.id
      WHERE bs.id = ? AND bs.report_id = ? AND r.pco_id = ? AND r.status IN ('draft', 'declined')
    `;
        const check = await (0, database_1.executeQuery)(checkQuery, [stationId, reportId, pcoId]);
        if (check.length === 0) {
            return res.status(403).json({
                success: false,
                message: 'Station not found or report not editable (only draft and declined reports can be edited)'
            });
        }
        const fields = [];
        const values = [];
        const allowedFields = [
            'station_number', 'location', 'is_accessible', 'inaccessible_reason',
            'activity_detected', 'activity_droppings', 'activity_gnawing', 'activity_tracks',
            'activity_other', 'activity_other_description', 'bait_status', 'station_condition',
            'action_taken', 'warning_sign_condition', 'rodent_box_replaced', 'station_remarks'
        ];
        for (const field of allowedFields) {
            if (updateData[field] !== undefined) {
                fields.push(`${field} = ?`);
                values.push(updateData[field]);
            }
        }
        if (fields.length > 0) {
            values.push(stationId);
            await (0, database_1.executeQuery)(`UPDATE bait_stations SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`, values);
        }
        if (updateData.chemicals) {
            await (0, database_1.executeQuery)(`DELETE FROM station_chemicals WHERE station_id = ?`, [stationId]);
            if (updateData.chemicals.length > 0) {
                for (const chem of updateData.chemicals) {
                    await (0, database_1.executeQuery)(`INSERT INTO station_chemicals (station_id, chemical_id, quantity, batch_number) 
             VALUES (?, ?, ?, ?)`, [stationId, chem.chemical_id, chem.quantity, chem.batch_number || null]);
                }
            }
        }
        logger_1.logger.info(`Bait station ${stationId} updated by PCO ${pcoId}`);
        return res.json({
            success: true,
            message: 'Bait station updated successfully'
        });
    }
    catch (error) {
        logger_1.logger.error('Error in updateBaitStation:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update bait station',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
exports.updateBaitStation = updateBaitStation;
const deleteBaitStation = async (req, res) => {
    try {
        const reportId = parseInt(req.params.id);
        const stationId = parseInt(req.params.stationId);
        const pcoId = req.user.id;
        const checkQuery = `
      SELECT bs.id 
      FROM bait_stations bs
      JOIN reports r ON bs.report_id = r.id
      WHERE bs.id = ? AND bs.report_id = ? AND r.pco_id = ? AND r.status IN ('draft', 'declined')
    `;
        const check = await (0, database_1.executeQuery)(checkQuery, [stationId, reportId, pcoId]);
        if (check.length === 0) {
            return res.status(403).json({
                success: false,
                message: 'Station not found or report not editable (only draft and declined reports can be edited)'
            });
        }
        await (0, database_1.executeQuery)(`DELETE FROM bait_stations WHERE id = ?`, [stationId]);
        logger_1.logger.info(`Bait station ${stationId} deleted by PCO ${pcoId}`);
        return res.json({
            success: true,
            message: 'Bait station deleted successfully'
        });
    }
    catch (error) {
        logger_1.logger.error('Error in deleteBaitStation:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete bait station',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
exports.deleteBaitStation = deleteBaitStation;
const updateFumigation = async (req, res) => {
    try {
        const reportId = parseInt(req.params.id);
        const pcoId = req.user.id;
        const { areas, target_pests, chemicals } = req.body;
        const reportCheck = await (0, database_1.executeQuery)(`SELECT id FROM reports WHERE id = ? AND pco_id = ? AND status IN ('draft', 'declined')`, [reportId, pcoId]);
        if (reportCheck.length === 0) {
            return res.status(403).json({
                success: false,
                message: 'Report not found, not owned by you, or not editable (only draft and declined reports can be edited)'
            });
        }
        await (0, database_1.executeQuery)(`DELETE FROM fumigation_areas WHERE report_id = ?`, [reportId]);
        await (0, database_1.executeQuery)(`DELETE FROM fumigation_target_pests WHERE report_id = ?`, [reportId]);
        await (0, database_1.executeQuery)(`DELETE FROM fumigation_chemicals WHERE report_id = ?`, [reportId]);
        if (areas && areas.length > 0) {
            for (const area of areas) {
                await (0, database_1.executeQuery)(`INSERT INTO fumigation_areas (report_id, area_name, is_other, other_description) 
           VALUES (?, ?, ?, ?)`, [reportId, area.area_name, area.is_other || 0, area.other_description || null]);
            }
        }
        if (target_pests && target_pests.length > 0) {
            for (const pest of target_pests) {
                await (0, database_1.executeQuery)(`INSERT INTO fumigation_target_pests (report_id, pest_name, is_other, other_description) 
           VALUES (?, ?, ?, ?)`, [reportId, pest.pest_name, pest.is_other || 0, pest.other_description || null]);
            }
        }
        if (chemicals && chemicals.length > 0) {
            for (const chem of chemicals) {
                await (0, database_1.executeQuery)(`INSERT INTO fumigation_chemicals (report_id, chemical_id, quantity, batch_number) 
           VALUES (?, ?, ?, ?)`, [reportId, chem.chemical_id, chem.quantity, chem.batch_number || null]);
            }
        }
        logger_1.logger.info(`Fumigation data updated for report ${reportId} by PCO ${pcoId}`);
        return res.json({
            success: true,
            message: 'Fumigation data updated successfully'
        });
    }
    catch (error) {
        logger_1.logger.error('Error in updateFumigation:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update fumigation data',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
exports.updateFumigation = updateFumigation;
const addInsectMonitor = async (req, res) => {
    try {
        const reportId = parseInt(req.params.id);
        const pcoId = req.user.id;
        const { monitor_type, monitor_condition, monitor_condition_other, warning_sign_condition, light_condition, light_faulty_type, light_faulty_other, glue_board_replaced, tubes_replaced, monitor_serviced } = req.body;
        const reportCheck = await (0, database_1.executeQuery)(`SELECT id FROM reports WHERE id = ? AND pco_id = ? AND status IN ('draft', 'declined')`, [reportId, pcoId]);
        if (reportCheck.length === 0) {
            return res.status(403).json({
                success: false,
                message: 'Report not found, not owned by you, or not editable (only draft and declined reports can be edited)'
            });
        }
        const result = await (0, database_1.executeQuery)(`INSERT INTO insect_monitors 
       (report_id, monitor_type, monitor_condition, monitor_condition_other, warning_sign_condition,
        light_condition, light_faulty_type, light_faulty_other, glue_board_replaced, tubes_replaced, monitor_serviced) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            reportId,
            monitor_type,
            monitor_condition || 'good',
            monitor_condition_other || null,
            warning_sign_condition || 'good',
            light_condition || 'na',
            light_faulty_type || 'na',
            light_faulty_other || null,
            glue_board_replaced || 0,
            tubes_replaced || null,
            monitor_serviced || 0
        ]);
        logger_1.logger.info(`Insect monitor ${result.insertId} added to report ${reportId} by PCO ${pcoId}`);
        return res.status(201).json({
            success: true,
            message: 'Insect monitor added successfully',
            monitor_id: result.insertId
        });
    }
    catch (error) {
        logger_1.logger.error('Error in addInsectMonitor:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to add insect monitor',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
exports.addInsectMonitor = addInsectMonitor;
const updateInsectMonitor = async (req, res) => {
    try {
        const reportId = parseInt(req.params.id);
        const monitorId = parseInt(req.params.monitorId);
        const pcoId = req.user.id;
        const updateData = req.body;
        const checkQuery = `
      SELECT im.id 
      FROM insect_monitors im
      JOIN reports r ON im.report_id = r.id
      WHERE im.id = ? AND im.report_id = ? AND r.pco_id = ? AND r.status IN ('draft', 'declined')
    `;
        const check = await (0, database_1.executeQuery)(checkQuery, [monitorId, reportId, pcoId]);
        if (check.length === 0) {
            return res.status(403).json({
                success: false,
                message: 'Monitor not found or report not editable (only draft and declined reports can be edited)'
            });
        }
        const fields = [];
        const values = [];
        const allowedFields = [
            'monitor_type', 'monitor_condition', 'monitor_condition_other', 'warning_sign_condition',
            'light_condition', 'light_faulty_type', 'light_faulty_other',
            'glue_board_replaced', 'tubes_replaced', 'monitor_serviced'
        ];
        for (const field of allowedFields) {
            if (updateData[field] !== undefined) {
                fields.push(`${field} = ?`);
                values.push(updateData[field]);
            }
        }
        if (fields.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No valid fields to update'
            });
        }
        values.push(monitorId);
        await (0, database_1.executeQuery)(`UPDATE insect_monitors SET ${fields.join(', ')} WHERE id = ?`, values);
        logger_1.logger.info(`Insect monitor ${monitorId} updated by PCO ${pcoId}`);
        return res.json({
            success: true,
            message: 'Insect monitor updated successfully'
        });
    }
    catch (error) {
        logger_1.logger.error('Error in updateInsectMonitor:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update insect monitor',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
exports.updateInsectMonitor = updateInsectMonitor;
const deleteInsectMonitor = async (req, res) => {
    try {
        const reportId = parseInt(req.params.id);
        const monitorId = parseInt(req.params.monitorId);
        const pcoId = req.user.id;
        const checkQuery = `
      SELECT im.id 
      FROM insect_monitors im
      JOIN reports r ON im.report_id = r.id
      WHERE im.id = ? AND im.report_id = ? AND r.pco_id = ? AND r.status IN ('draft', 'declined')
    `;
        const check = await (0, database_1.executeQuery)(checkQuery, [monitorId, reportId, pcoId]);
        if (check.length === 0) {
            return res.status(403).json({
                success: false,
                message: 'Monitor not found or report not editable (only draft and declined reports can be edited)'
            });
        }
        await (0, database_1.executeQuery)(`DELETE FROM insect_monitors WHERE id = ?`, [monitorId]);
        logger_1.logger.info(`Insect monitor ${monitorId} deleted by PCO ${pcoId}`);
        return res.json({
            success: true,
            message: 'Insect monitor deleted successfully'
        });
    }
    catch (error) {
        logger_1.logger.error('Error in deleteInsectMonitor:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete insect monitor',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
exports.deleteInsectMonitor = deleteInsectMonitor;
const getPreFillData = async (req, res) => {
    try {
        const clientId = parseInt(req.params.clientId);
        const pcoId = req.user.id;
        const assignmentCheck = await (0, database_1.executeQuery)(`SELECT id FROM client_pco_assignments 
       WHERE client_id = ? AND pco_id = ? AND status = 'active'`, [clientId, pcoId]);
        if (assignmentCheck.length === 0) {
            return res.status(403).json({
                success: false,
                message: 'You are not assigned to this client'
            });
        }
        const lastReportQuery = `
      SELECT id FROM reports 
      WHERE client_id = ? AND status = 'approved'
      ORDER BY service_date DESC, id DESC
      LIMIT 1
    `;
        const lastReport = await (0, database_1.executeQuery)(lastReportQuery, [clientId]);
        if (lastReport.length === 0) {
            return res.json({
                success: true,
                message: 'No previous reports found',
                data: null
            });
        }
        const reportId = lastReport[0].id;
        const baitStations = await (0, database_1.executeQuery)(`SELECT station_number, location FROM bait_stations WHERE report_id = ? ORDER BY location, station_number`, [reportId]);
        const areas = await (0, database_1.executeQuery)(`SELECT area_name, is_other, other_description FROM fumigation_areas WHERE report_id = ?`, [reportId]);
        const pests = await (0, database_1.executeQuery)(`SELECT pest_name, is_other, other_description FROM fumigation_target_pests WHERE report_id = ?`, [reportId]);
        const chemicals = await (0, database_1.executeQuery)(`SELECT fc.chemical_id, c.name as chemical_name 
       FROM fumigation_chemicals fc
       JOIN chemicals c ON fc.chemical_id = c.id
       WHERE fc.report_id = ?`, [reportId]);
        const monitors = await (0, database_1.executeQuery)(`SELECT monitor_type FROM insect_monitors WHERE report_id = ? GROUP BY monitor_type`, [reportId]);
        logger_1.logger.info(`Pre-fill data retrieved for client ${clientId} by PCO ${pcoId}`);
        return res.json({
            success: true,
            message: 'Pre-fill data retrieved successfully',
            data: {
                bait_stations: baitStations,
                fumigation: {
                    areas,
                    target_pests: pests,
                    chemicals
                },
                insect_monitors: monitors
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Error in getPreFillData:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve pre-fill data',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
exports.getPreFillData = getPreFillData;
//# sourceMappingURL=reportController.js.map