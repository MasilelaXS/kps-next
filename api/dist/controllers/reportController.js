"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupOldDrafts = exports.adminEmailReportPDF = exports.adminGetReportHTML = exports.adminDownloadReportPDF = exports.updateCompleteReport = exports.createCompleteReport = exports.markNewEquipmentBeforeUpdate = exports.importReportFromJSON = exports.exportReportAsJSON = exports.adminUpdateReport = exports.archiveReport = exports.getPreFillData = exports.deleteInsectMonitor = exports.updateInsectMonitor = exports.addInsectMonitor = exports.updateFumigation = exports.deleteBaitStation = exports.updateBaitStation = exports.addBaitStation = exports.forceDeclineReport = exports.declineReport = exports.approveReport = exports.submitReport = exports.deleteReport = exports.updateReport = exports.createReport = exports.getReportById = exports.getPendingReports = exports.getAdminReports = exports.getPCOReports = void 0;
const database_1 = require("../config/database");
const logger_1 = require("../config/logger");
const notificationController_1 = require("./notificationController");
const pdfService_1 = require("../services/pdfService");
const emailService_1 = require("../services/emailService");
const promises_1 = __importDefault(require("fs/promises"));
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
        const statusGroup = req.query.status_group || 'draft';
        const reportType = req.query.report_type || 'all';
        const search = req.query.search || '';
        const pcoId = req.query.pco_id ? parseInt(req.query.pco_id) : null;
        const clientId = req.query.client_id ? parseInt(req.query.client_id) : null;
        const status = req.query.status || 'all';
        const startDate = req.query.date_from;
        const endDate = req.query.date_to;
        let whereConditions = [];
        const queryParams = [];
        if (statusGroup !== 'all') {
            switch (statusGroup) {
                case 'draft':
                    whereConditions.push('r.status = ?');
                    queryParams.push('draft');
                    break;
                case 'pending':
                    whereConditions.push('r.status = ?');
                    queryParams.push('pending');
                    break;
                case 'approved':
                    whereConditions.push('r.status = ?');
                    queryParams.push('approved');
                    break;
                case 'declined':
                    whereConditions.push('r.status = ?');
                    queryParams.push('declined');
                    break;
                case 'emailed':
                    whereConditions.push('r.status = ? AND r.emailed_at IS NOT NULL');
                    queryParams.push('approved');
                    break;
                case 'archived':
                    whereConditions.push('r.status = ?');
                    queryParams.push('archived');
                    break;
            }
        }
        if (reportType !== 'all') {
            whereConditions.push('r.report_type = ?');
            queryParams.push(reportType);
        }
        if (search) {
            whereConditions.push('(c.company_name LIKE ? OR u.name LIKE ?)');
            queryParams.push(`%${search}%`, `%${search}%`);
        }
        if (pcoId) {
            whereConditions.push('r.pco_id = ?');
            queryParams.push(pcoId);
        }
        if (clientId) {
            whereConditions.push('r.client_id = ?');
            queryParams.push(clientId);
        }
        if (status !== 'all' && statusGroup === 'all') {
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
        const whereClause = whereConditions.length > 0 ? whereConditions.join(' AND ') : '1=1';
        const countQuery = `
      SELECT COUNT(*) as total
      FROM reports r
      JOIN clients c ON r.client_id = c.id
      JOIN users u ON r.pco_id = u.id
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
        r.general_remarks,
        r.recommendations,
        r.admin_notes,
        r.created_at,
        r.submitted_at,
        r.reviewed_at,
        r.reviewed_by,
        r.emailed_at,
        c.company_name as client_name,
        c.city as client_city,
        u.name as pco_name,
        u.pco_number,
        CASE WHEN r.pco_signature_data IS NOT NULL THEN 1 ELSE 0 END as has_pco_signature,
        CASE WHEN r.client_signature_data IS NOT NULL THEN 1 ELSE 0 END as has_client_signature,
        (SELECT COUNT(*) FROM bait_stations WHERE report_id = r.id) as bait_stations_count,
        (SELECT COUNT(*) FROM fumigation_areas WHERE report_id = r.id) as fumigation_areas_count,
        (SELECT COUNT(*) FROM insect_monitors WHERE report_id = r.id) as insect_monitors_count,
        DATEDIFF(NOW(), r.submitted_at) as days_pending
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
            data: {
                reports: reports || [],
                pagination: {
                    current_page: page,
                    total_pages: totalPages,
                    total_reports: totalRecords,
                    per_page: limit,
                    has_next: page < totalPages,
                    has_prev: page > 1
                }
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
        c.total_bait_stations_inside,
        c.total_bait_stations_outside,
        c.total_insect_monitors_light,
        c.total_insect_monitors_box,
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
          OR ? = 'both'
        )
    `;
        const reports = await (0, database_1.executeQuery)(reportQuery, [reportId, userId, userRole, userRole]);
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
        if (updateData.report_type !== undefined) {
            const validReportTypes = ['bait_inspection', 'fumigation', 'both'];
            if (!validReportTypes.includes(updateData.report_type)) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid report_type. Must be one of: ${validReportTypes.join(', ')}`
                });
            }
        }
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
        const { markNewBaitStations, markNewInsectMonitors, updateReportNewEquipmentCounts, updateClientExpectedCounts } = await Promise.resolve().then(() => __importStar(require('../utils/equipmentTracking')));
        const alreadyMarked = await (0, database_1.executeQuery)(`SELECT COUNT(*) as count FROM bait_stations 
       WHERE report_id = ? AND is_new_addition = 1
       UNION ALL
       SELECT COUNT(*) as count FROM insect_monitors 
       WHERE report_id = ? AND is_new_addition = 1`, [reportId, reportId]);
        const hasMarkedEquipment = alreadyMarked.some((row) => row.count > 0);
        if (!hasMarkedEquipment) {
            logger_1.logger.info(`Backend marking new equipment for report ${reportId} (frontend marking was skipped)`);
            await markNewBaitStations(reportId, report.client_id, 'inside');
            await markNewBaitStations(reportId, report.client_id, 'outside');
            await markNewInsectMonitors(reportId, report.client_id, 'light');
            await markNewInsectMonitors(reportId, report.client_id, 'box');
        }
        else {
            logger_1.logger.info(`Equipment already marked by frontend for report ${reportId}, skipping backend marking`);
        }
        await updateReportNewEquipmentCounts(reportId);
        await updateClientExpectedCounts(reportId, report.client_id);
        await (0, database_1.executeQuery)(`DELETE FROM client_pco_assignments 
       WHERE client_id = ? AND status = 'inactive'`, [report.client_id]);
        await (0, database_1.executeQuery)(`UPDATE client_pco_assignments 
       SET status = 'inactive', unassigned_at = NOW()
       WHERE client_id = ? AND pco_id = ? AND status = 'active'`, [report.client_id, pcoId]);
        const adminUsers = await (0, database_1.executeQuery)(`SELECT id, name FROM users WHERE role IN ('admin', 'both') AND status = 'active' LIMIT 1`);
        if (adminUsers.length > 0) {
            const adminId = adminUsers[0].id;
            const pcoInfo = await (0, database_1.executeQuerySingle)('SELECT name FROM users WHERE id = ?', [pcoId]);
            const pcoName = pcoInfo?.name || 'PCO';
            await (0, notificationController_1.createNotification)(adminId, 'report_submitted', 'New Report Submitted', `${pcoName} submitted report for ${report.company_name}`);
        }
        logger_1.logger.info(`Report ${reportId} submitted by PCO ${pcoId} - status remains draft`);
        return res.json({
            success: true,
            message: 'Report submitted successfully'
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
        const reportCheck = await (0, database_1.executeQuery)(`SELECT r.id, r.pco_id, r.client_id, c.company_name 
       FROM reports r
       JOIN clients c ON r.client_id = c.id
       WHERE r.id = ? AND r.status IN ('draft', 'pending')`, [reportId]);
        if (reportCheck.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Report not found or not available for approval'
            });
        }
        const report = reportCheck[0];
        await (0, database_1.executeQuery)(`UPDATE reports 
       SET status = 'approved',
           admin_notes = ?,
           recommendations = ?,
           reviewed_by = ?,
           reviewed_at = NOW(),
           updated_at = NOW()
       WHERE id = ? AND status IN ('draft', 'pending')`, [admin_notes || null, recommendations || null, adminId, reportId]);
        await (0, database_1.executeQuery)(`DELETE FROM client_pco_assignments 
       WHERE client_id = ? AND pco_id = ?`, [report.client_id, report.pco_id]);
        logger_1.logger.info(`Assignment deleted for client ${report.client_id} after report approval`);
        await (0, notificationController_1.createNotification)(report.pco_id, 'report_submitted', 'Report Approved', `Your report for ${report.company_name} has been approved by the admin.${admin_notes ? ` Notes: ${admin_notes}` : ''}`);
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
       WHERE r.id = ? AND r.status IN ('draft', 'pending')`, [reportId]);
        if (reportCheck.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Report not found or not available for decline'
            });
        }
        const report = reportCheck[0];
        await (0, database_1.executeQuery)(`UPDATE reports 
       SET status = 'declined',
           admin_notes = ?,
           reviewed_by = ?,
           reviewed_at = NOW(),
           updated_at = NOW()
       WHERE id = ? AND status IN ('draft', 'pending')`, [admin_notes, adminId, reportId]);
        const existingAssignment = await (0, database_1.executeQuery)(`SELECT pco_id, status FROM client_pco_assignments WHERE client_id = ?`, [report.client_id]);
        if (existingAssignment.length > 0) {
            const assignment = existingAssignment[0];
            if (assignment.status === 'inactive' && assignment.pco_id === report.pco_id) {
                await (0, database_1.executeQuery)(`UPDATE client_pco_assignments 
           SET status = 'active', 
               assigned_at = NOW(),
               assigned_by = ?,
               unassigned_at = NULL,
               unassigned_by = NULL
           WHERE client_id = ? AND pco_id = ?`, [adminId, report.client_id, report.pco_id]);
                logger_1.logger.info(`Assignment reinstated for PCO ${report.pco_id} to client ${report.client_id}`);
            }
            else if (assignment.pco_id !== report.pco_id) {
                return res.status(409).json({
                    success: false,
                    message: 'Assignment conflict detected',
                    conflict: {
                        current_pco_id: assignment.pco_id,
                        current_pco_name: await (0, database_1.executeQuerySingle)('SELECT name FROM users WHERE id = ?', [assignment.pco_id]).then(r => r?.name),
                        original_pco_id: report.pco_id,
                        original_pco_name: report.pco_name,
                        client_name: report.company_name
                    },
                    requires_confirmation: true
                });
            }
        }
        else {
            await (0, database_1.executeQuery)(`INSERT INTO client_pco_assignments (client_id, pco_id, assigned_by, assigned_at, status)
         VALUES (?, ?, ?, NOW(), 'active')`, [report.client_id, report.pco_id, adminId]);
            logger_1.logger.info(`New assignment created for PCO ${report.pco_id} to client ${report.client_id}`);
        }
        await (0, notificationController_1.createNotification)(report.pco_id, 'report_declined', 'Report Declined - Revision Required', `Your report for ${report.company_name} has been declined. Admin feedback: ${admin_notes}`);
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
const forceDeclineReport = async (req, res) => {
    try {
        const reportId = parseInt(req.params.id);
        const adminId = req.user.id;
        const { admin_notes } = req.body;
        if (!admin_notes || admin_notes.length < 10) {
            return res.status(400).json({
                success: false,
                message: 'admin_notes is required and must be at least 10 characters'
            });
        }
        const reportCheck = await (0, database_1.executeQuery)(`SELECT r.*, c.company_name, u.name as pco_name
       FROM reports r
       JOIN clients c ON r.client_id = c.id
       JOIN users u ON r.pco_id = u.id
       WHERE r.id = ? AND r.status IN ('draft', 'pending')`, [reportId]);
        if (reportCheck.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Report not found or not available for decline'
            });
        }
        const report = reportCheck[0];
        await (0, database_1.executeQuery)(`UPDATE reports 
       SET status = 'declined',
           admin_notes = ?,
           reviewed_by = ?,
           reviewed_at = NOW(),
           updated_at = NOW()
       WHERE id = ?`, [admin_notes, adminId, reportId]);
        await (0, database_1.executeQuery)(`DELETE FROM client_pco_assignments WHERE client_id = ?`, [report.client_id]);
        await (0, database_1.executeQuery)(`INSERT INTO client_pco_assignments (client_id, pco_id, assigned_by, assigned_at, status)
       VALUES (?, ?, ?, NOW(), 'active')`, [report.client_id, report.pco_id, adminId]);
        logger_1.logger.info(`Report ${reportId} force declined - existing assignment deleted, PCO ${report.pco_id} reassigned`);
        await (0, notificationController_1.createNotification)(report.pco_id, 'report_declined', 'Report Declined - Revision Required', `Your report for ${report.company_name} has been declined. Admin feedback: ${admin_notes}`);
        return res.json({
            success: true,
            message: 'Report declined and PCO reassigned successfully'
        });
    }
    catch (error) {
        logger_1.logger.error('Error in forceDeclineReport:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to force decline report',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
exports.forceDeclineReport = forceDeclineReport;
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
        const { station_number, location, is_accessible, inaccessible_reason, activity_detected, activity_droppings, activity_gnawing, activity_tracks, activity_other, activity_other_description, bait_status, station_condition, action_taken, warning_sign_condition, rodent_box_replaced, station_remarks, is_new_addition, chemicals } = req.body;
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
        action_taken, warning_sign_condition, rodent_box_replaced, station_remarks, is_new_addition
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
        const result = await (0, database_1.executeQuery)(stationQuery, [
            reportId, station_number, location, is_accessible, inaccessible_reason || null,
            activity_detected, activity_droppings || 0, activity_gnawing || 0, activity_tracks || 0,
            activity_other || 0, activity_other_description || null, bait_status, station_condition,
            action_taken || 'none', warning_sign_condition || 'good', rodent_box_replaced || 0, station_remarks || null,
            is_new_addition || 0
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
        const { monitor_number, location, monitor_type, monitor_condition, monitor_condition_other, warning_sign_condition, light_condition, light_faulty_type, light_faulty_other, glue_board_replaced, tubes_replaced, monitor_serviced, is_new_addition } = req.body;
        const reportCheck = await (0, database_1.executeQuery)(`SELECT id FROM reports WHERE id = ? AND pco_id = ? AND status IN ('draft', 'declined')`, [reportId, pcoId]);
        if (reportCheck.length === 0) {
            return res.status(403).json({
                success: false,
                message: 'Report not found, not owned by you, or not editable (only draft and declined reports can be edited)'
            });
        }
        const result = await (0, database_1.executeQuery)(`INSERT INTO insect_monitors 
       (report_id, monitor_number, location, monitor_type, monitor_condition, monitor_condition_other, warning_sign_condition,
        light_condition, light_faulty_type, light_faulty_other, glue_board_replaced, tubes_replaced, monitor_serviced, is_new_addition) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            reportId,
            monitor_number || null,
            location || null,
            monitor_type,
            monitor_condition || 'good',
            monitor_condition_other || null,
            warning_sign_condition || 'good',
            light_condition || 'na',
            light_faulty_type || 'na',
            light_faulty_other || null,
            glue_board_replaced || 0,
            tubes_replaced || null,
            monitor_serviced || 0,
            is_new_addition || 0
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
            'monitor_number', 'location', 'monitor_type', 'monitor_condition', 'monitor_condition_other', 'warning_sign_condition',
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
const archiveReport = async (req, res) => {
    try {
        const reportId = parseInt(req.params.id);
        const adminId = req.user.id;
        const reportCheck = await (0, database_1.executeQuery)(`SELECT r.id, r.status, r.pco_id, r.client_id, c.company_name 
       FROM reports r
       JOIN clients c ON r.client_id = c.id
       WHERE r.id = ?`, [reportId]);
        if (reportCheck.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Report not found'
            });
        }
        const report = reportCheck[0];
        if (report.status === 'archived') {
            return res.status(400).json({
                success: false,
                message: 'Report is already archived'
            });
        }
        await (0, database_1.executeQuery)(`UPDATE reports 
       SET status = 'archived',
           reviewed_by = ?,
           reviewed_at = NOW(),
           updated_at = NOW()
       WHERE id = ?`, [adminId, reportId]);
        await (0, database_1.executeQuery)(`DELETE FROM client_pco_assignments 
       WHERE client_id = ? AND pco_id = ?`, [report.client_id, report.pco_id]);
        logger_1.logger.info(`Assignment deleted for client ${report.client_id} after report archival`);
        await (0, notificationController_1.createNotification)(report.pco_id, 'system_update', 'Report Archived', `Your report for ${report.company_name} has been archived by the admin.`);
        logger_1.logger.info(`Report ${reportId} archived by admin ${adminId}`);
        return res.json({
            success: true,
            message: 'Report archived successfully',
            data: {
                report_id: reportId,
                status: 'archived'
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Error in archiveReport:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to archive report',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
exports.archiveReport = archiveReport;
const adminUpdateReport = async (req, res) => {
    const connection = await database_1.pool.getConnection();
    try {
        const reportId = parseInt(req.params.id);
        const adminId = req.user.id;
        const updateData = req.body;
        await connection.beginTransaction();
        const reportCheck = await (0, database_1.executeQuery)(`SELECT r.id, r.status, r.report_type, r.client_id,
              c.total_bait_stations_inside, c.total_bait_stations_outside,
              c.total_insect_monitors_light, c.total_insect_monitors_box
       FROM reports r
       JOIN clients c ON r.client_id = c.id
       WHERE r.id = ?`, [reportId]);
        if (reportCheck.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: 'Report not found'
            });
        }
        const report = reportCheck[0];
        const clientId = report.client_id;
        const expectedBaitInside = report.total_bait_stations_inside || 0;
        const expectedBaitOutside = report.total_bait_stations_outside || 0;
        const expectedMonitorLight = report.total_insect_monitors_light || 0;
        const expectedMonitorBox = report.total_insect_monitors_box || 0;
        const fields = [];
        const values = [];
        const allowedFields = [
            'service_date',
            'next_service_date',
            'report_type',
            'status',
            'recommendations',
            'admin_notes'
        ];
        if (updateData.report_type !== undefined) {
            const validReportTypes = ['bait_inspection', 'fumigation', 'both'];
            if (!validReportTypes.includes(updateData.report_type)) {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    message: `Invalid report_type. Must be one of: ${validReportTypes.join(', ')}`
                });
            }
        }
        for (const field of allowedFields) {
            if (updateData[field] !== undefined) {
                fields.push(`${field} = ?`);
                values.push(updateData[field] || null);
            }
        }
        if (fields.length > 0) {
            values.push(reportId);
            await connection.query(`UPDATE reports SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`, values);
        }
        if (updateData.bait_stations !== undefined && Array.isArray(updateData.bait_stations)) {
            const existingStations = await connection.query('SELECT id FROM bait_stations WHERE report_id = ?', [reportId]);
            const existingIds = existingStations[0].map((s) => s.id);
            const incomingIds = updateData.bait_stations
                .filter((s) => s.id)
                .map((s) => s.id);
            const toDelete = existingIds.filter((id) => !incomingIds.includes(id));
            for (const stationId of toDelete) {
                await connection.query('DELETE FROM station_chemicals WHERE station_id = ?', [stationId]);
                await connection.query('DELETE FROM bait_stations WHERE id = ?', [stationId]);
            }
            for (const station of updateData.bait_stations) {
                if (station.id) {
                    await connection.query(`UPDATE bait_stations SET
              \`location\` = ?,
              station_number = ?,
              is_accessible = ?,
              inaccessible_reason = ?,
              activity_detected = ?,
              activity_droppings = ?,
              activity_gnawing = ?,
              activity_tracks = ?,
              activity_other = ?,
              activity_other_description = ?,
              bait_status = ?,
              station_condition = ?,
              action_taken = ?,
              warning_sign_condition = ?,
              station_remarks = ?
            WHERE id = ? AND report_id = ?`, [
                        station.location,
                        station.station_number,
                        station.accessible === 'yes' ? 1 : 0,
                        station.not_accessible_reason || null,
                        station.activity_detected === 'yes' ? 1 : 0,
                        station.activity_droppings ? 1 : 0,
                        station.activity_gnawing ? 1 : 0,
                        station.activity_tracks ? 1 : 0,
                        station.activity_other ? 1 : 0,
                        station.activity_other_description || null,
                        station.bait_status,
                        station.station_condition,
                        station.action_taken === '' ? 'none' : (station.action_taken || 'none'),
                        station.warning_sign_condition,
                        station.station_remarks || null,
                        station.id,
                        reportId
                    ]);
                    if (station.chemicals && Array.isArray(station.chemicals)) {
                        await connection.query('DELETE FROM station_chemicals WHERE station_id = ?', [station.id]);
                        for (const chem of station.chemicals) {
                            if (chem.chemical_id) {
                                await connection.query(`INSERT INTO station_chemicals (station_id, chemical_id, quantity, batch_number)
                   VALUES (?, ?, ?, ?)`, [station.id, chem.chemical_id, chem.quantity, chem.batch_number]);
                            }
                        }
                    }
                }
                else {
                    const [result] = await connection.query(`INSERT INTO bait_stations (
              report_id, \`location\`, station_number, is_accessible, inaccessible_reason,
              activity_detected, activity_droppings, activity_gnawing, activity_tracks, activity_other, activity_other_description,
              bait_status, station_condition, action_taken, warning_sign_condition, station_remarks
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                        reportId,
                        station.location,
                        station.station_number,
                        station.accessible === 'yes' ? 1 : 0,
                        station.not_accessible_reason || null,
                        station.activity_detected === 'yes' ? 1 : 0,
                        station.activity_droppings ? 1 : 0,
                        station.activity_gnawing ? 1 : 0,
                        station.activity_tracks ? 1 : 0,
                        station.activity_other ? 1 : 0,
                        station.activity_other_description || null,
                        station.bait_status,
                        station.station_condition,
                        station.action_taken === '' ? 'none' : (station.action_taken || 'none'),
                        station.warning_sign_condition,
                        station.station_remarks || null
                    ]);
                    const newStationId = result.insertId;
                    if (station.chemicals && Array.isArray(station.chemicals)) {
                        for (const chem of station.chemicals) {
                            if (chem.chemical_id) {
                                await connection.query(`INSERT INTO station_chemicals (station_id, chemical_id, quantity, batch_number)
                   VALUES (?, ?, ?, ?)`, [newStationId, chem.chemical_id, chem.quantity, chem.batch_number]);
                            }
                        }
                    }
                }
            }
        }
        if (updateData.fumigation_areas !== undefined && Array.isArray(updateData.fumigation_areas)) {
            await connection.query('DELETE FROM fumigation_areas WHERE report_id = ?', [reportId]);
            for (const area of updateData.fumigation_areas) {
                if (area.area_name) {
                    await connection.query('INSERT INTO fumigation_areas (report_id, area_name, is_other, other_description) VALUES (?, ?, ?, ?)', [
                        reportId,
                        area.area_name,
                        area.is_other ? 1 : 0,
                        area.other_description || null
                    ]);
                }
            }
        }
        if (updateData.fumigation_target_pests !== undefined && Array.isArray(updateData.fumigation_target_pests)) {
            await connection.query('DELETE FROM fumigation_target_pests WHERE report_id = ?', [reportId]);
            for (const pest of updateData.fumigation_target_pests) {
                if (pest.pest_name) {
                    await connection.query('INSERT INTO fumigation_target_pests (report_id, pest_name, is_other, other_description) VALUES (?, ?, ?, ?)', [
                        reportId,
                        pest.pest_name,
                        pest.is_other ? 1 : 0,
                        pest.other_description || null
                    ]);
                }
            }
        }
        if (updateData.fumigation_chemicals !== undefined && Array.isArray(updateData.fumigation_chemicals)) {
            await connection.query('DELETE FROM fumigation_chemicals WHERE report_id = ?', [reportId]);
            for (const chem of updateData.fumigation_chemicals) {
                if (chem.chemical_id) {
                    await connection.query(`INSERT INTO fumigation_chemicals (report_id, chemical_id, quantity, batch_number)
             VALUES (?, ?, ?, ?)`, [reportId, chem.chemical_id, chem.quantity, chem.batch_number]);
                }
            }
        }
        if (updateData.insect_monitors !== undefined && Array.isArray(updateData.insect_monitors)) {
            const existingMonitors = await connection.query('SELECT id FROM insect_monitors WHERE report_id = ?', [reportId]);
            const existingIds = existingMonitors[0].map((m) => m.id);
            const incomingIds = updateData.insect_monitors
                .filter((m) => m.id)
                .map((m) => m.id);
            const toDelete = existingIds.filter((id) => !incomingIds.includes(id));
            for (const monitorId of toDelete) {
                await connection.query('DELETE FROM insect_monitors WHERE id = ?', [monitorId]);
            }
            for (const monitor of updateData.insect_monitors) {
                if (monitor.id) {
                    await connection.query(`UPDATE insect_monitors SET
              monitor_number = ?,
              location = ?,
              monitor_type = ?,
              monitor_condition = ?,
              monitor_condition_other = ?,
              light_condition = ?,
              light_faulty_type = ?,
              light_faulty_other = ?,
              glue_board_replaced = ?,
              tubes_replaced = ?,
              warning_sign_condition = ?,
              monitor_serviced = ?
            WHERE id = ? AND report_id = ?`, [
                        monitor.monitor_number || null,
                        monitor.location || null,
                        monitor.monitor_type,
                        monitor.monitor_condition,
                        monitor.monitor_condition_other || null,
                        monitor.light_condition || null,
                        monitor.light_faulty_type || null,
                        monitor.light_faulty_other || null,
                        monitor.glue_board_replaced === 'yes' ? 1 : (monitor.glue_board_replaced === 'no' ? 0 : monitor.glue_board_replaced),
                        monitor.tubes_replaced === 'yes' ? 1 : (monitor.tubes_replaced === 'no' ? 0 : monitor.tubes_replaced),
                        monitor.warning_sign_condition,
                        monitor.monitor_serviced === 'yes' ? 1 : (monitor.monitor_serviced === 'no' ? 0 : monitor.monitor_serviced),
                        monitor.id,
                        reportId
                    ]);
                }
                else {
                    await connection.query(`INSERT INTO insect_monitors (
              report_id, monitor_number, location, monitor_type, monitor_condition, monitor_condition_other,
              light_condition, light_faulty_type, light_faulty_other,
              glue_board_replaced, tubes_replaced, warning_sign_condition, monitor_serviced
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                        reportId,
                        monitor.monitor_number || null,
                        monitor.location || null,
                        monitor.monitor_type,
                        monitor.monitor_condition,
                        monitor.monitor_condition_other || null,
                        monitor.light_condition || null,
                        monitor.light_faulty_type || null,
                        monitor.light_faulty_other || null,
                        monitor.glue_board_replaced === 'yes' ? 1 : (monitor.glue_board_replaced === 'no' ? 0 : monitor.glue_board_replaced),
                        monitor.tubes_replaced === 'yes' ? 1 : (monitor.tubes_replaced === 'no' ? 0 : monitor.tubes_replaced),
                        monitor.warning_sign_condition,
                        monitor.monitor_serviced === 'yes' ? 1 : (monitor.monitor_serviced === 'no' ? 0 : monitor.monitor_serviced)
                    ]);
                }
            }
        }
        let actualBaitInside = 0;
        let actualBaitOutside = 0;
        let actualMonitorLight = 0;
        let actualMonitorBox = 0;
        if (updateData.bait_stations !== undefined) {
            const baitCounts = await connection.query(`SELECT 
          SUM(CASE WHEN location = 'inside' THEN 1 ELSE 0 END) as inside_count,
          SUM(CASE WHEN location = 'outside' THEN 1 ELSE 0 END) as outside_count
         FROM bait_stations WHERE report_id = ?`, [reportId]);
            actualBaitInside = baitCounts[0][0]?.inside_count || 0;
            actualBaitOutside = baitCounts[0][0]?.outside_count || 0;
            await connection.query(`UPDATE bait_stations bs
         JOIN (
           SELECT id, 
                  location,
                  ROW_NUMBER() OVER (PARTITION BY location ORDER BY id) as position
           FROM bait_stations
           WHERE report_id = ?
         ) ranked ON bs.id = ranked.id
         SET bs.is_new_addition = CASE
           WHEN ranked.location = 'inside' AND ranked.position > ? THEN 1
           WHEN ranked.location = 'outside' AND ranked.position > ? THEN 1
           ELSE 0
         END`, [reportId, expectedBaitInside, expectedBaitOutside]);
        }
        if (updateData.insect_monitors !== undefined) {
            const monitorCounts = await connection.query(`SELECT 
          SUM(CASE WHEN monitor_type = 'light' THEN 1 ELSE 0 END) as light_count,
          SUM(CASE WHEN monitor_type = 'box' THEN 1 ELSE 0 END) as box_count
         FROM insect_monitors WHERE report_id = ?`, [reportId]);
            actualMonitorLight = monitorCounts[0][0]?.light_count || 0;
            actualMonitorBox = monitorCounts[0][0]?.box_count || 0;
            await connection.query(`UPDATE insect_monitors im
         JOIN (
           SELECT id, 
                  monitor_type,
                  ROW_NUMBER() OVER (PARTITION BY monitor_type ORDER BY id) as position
           FROM insect_monitors
           WHERE report_id = ?
         ) ranked ON im.id = ranked.id
         SET im.is_new_addition = CASE
           WHEN ranked.monitor_type = 'light' AND ranked.position > ? THEN 1
           WHEN ranked.monitor_type = 'box' AND ranked.position > ? THEN 1
           ELSE 0
         END`, [reportId, expectedMonitorLight, expectedMonitorBox]);
        }
        const totalNewBait = Math.max(0, (actualBaitInside - expectedBaitInside) + (actualBaitOutside - expectedBaitOutside));
        const totalNewMonitors = Math.max(0, (actualMonitorLight - expectedMonitorLight) + (actualMonitorBox - expectedMonitorBox));
        await connection.query(`UPDATE reports SET new_bait_stations_count = ?, new_insect_monitors_count = ?
       WHERE id = ?`, [totalNewBait, totalNewMonitors, reportId]);
        const updateFields = [];
        const updateValues = [];
        if (updateData.bait_stations !== undefined) {
            updateFields.push('total_bait_stations_inside = ?', 'total_bait_stations_outside = ?');
            updateValues.push(actualBaitInside, actualBaitOutside);
        }
        if (updateData.insect_monitors !== undefined) {
            updateFields.push('total_insect_monitors_light = ?', 'total_insect_monitors_box = ?');
            updateValues.push(actualMonitorLight, actualMonitorBox);
        }
        if (updateFields.length > 0) {
            updateValues.push(clientId);
            await connection.query(`UPDATE clients SET ${updateFields.join(', ')} WHERE id = ?`, updateValues);
        }
        await connection.commit();
        logger_1.logger.info(`Report ${reportId} comprehensively updated by admin ${adminId}`);
        return res.json({
            success: true,
            message: 'Report updated successfully',
            data: {
                report_id: reportId
            }
        });
    }
    catch (error) {
        await connection.rollback();
        logger_1.logger.error('Error in adminUpdateReport:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update report',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
    finally {
        connection.release();
    }
};
exports.adminUpdateReport = adminUpdateReport;
const exportReportAsJSON = async (req, res) => {
    try {
        const reportId = parseInt(req.params.id);
        const userId = req.user.id;
        const userRole = req.user.role;
        if (isNaN(reportId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid report ID'
            });
        }
        const report = await (0, database_1.executeQuerySingle)(`SELECT r.*, c.company_name as client_name, c.company_number as client_company_number,
              u.name as pco_name, u.pco_number
       FROM reports r
       JOIN clients c ON r.client_id = c.id
       JOIN users u ON r.pco_id = u.id
       WHERE r.id = ?`, [reportId]);
        if (!report) {
            return res.status(404).json({
                success: false,
                message: 'Report not found'
            });
        }
        if (userRole === 'pco' && report.pco_id !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }
        const baitStations = await (0, database_1.executeQuery)(`SELECT bs.*, 
              CONCAT('[', COALESCE(GROUP_CONCAT(
                DISTINCT JSON_OBJECT(
                  'id', sc.id,
                  'chemical_id', sc.chemical_id,
                  'quantity', sc.quantity,
                  'batch_number', sc.batch_number,
                  'chemical_name', ch.name
                )
              ), ''), ']') as chemicals
       FROM bait_stations bs
       LEFT JOIN station_chemicals sc ON bs.id = sc.station_id
       LEFT JOIN chemicals ch ON sc.chemical_id = ch.id
       WHERE bs.report_id = ?
       GROUP BY bs.id
       ORDER BY bs.station_number, bs.location`, [reportId]);
        const fumigationAreas = await (0, database_1.executeQuery)(`SELECT * FROM fumigation_areas WHERE report_id = ? ORDER BY id`, [reportId]);
        const fumigationPests = await (0, database_1.executeQuery)(`SELECT * FROM fumigation_target_pests WHERE report_id = ? ORDER BY id`, [reportId]);
        const fumigationChemicals = await (0, database_1.executeQuery)(`SELECT fc.*, ch.name as chemical_name
       FROM fumigation_chemicals fc
       JOIN chemicals ch ON fc.chemical_id = ch.id
       WHERE fc.report_id = ?
       ORDER BY fc.id`, [reportId]);
        const insectMonitors = await (0, database_1.executeQuery)(`SELECT * FROM insect_monitors WHERE report_id = ? ORDER BY id`, [reportId]);
        const exportData = {
            export_metadata: {
                export_date: new Date().toISOString(),
                exported_by: userId,
                app_version: '1.0.0',
                schema_version: '1.0'
            },
            report: {
                client_id: report.client_id,
                client_name: report.client_name,
                client_company_number: report.client_company_number,
                pco_id: report.pco_id,
                pco_name: report.pco_name,
                pco_number: report.pco_number,
                report_type: report.report_type,
                service_date: report.service_date,
                next_service_date: report.next_service_date,
                status: report.status,
                pco_signature_data: report.pco_signature_data,
                client_signature_data: report.client_signature_data,
                client_signature_name: report.client_signature_name,
                general_remarks: report.general_remarks,
                new_bait_stations_count: report.new_bait_stations_count,
                new_insect_monitors_count: report.new_insect_monitors_count,
                bait_stations: baitStations.map((bs) => ({
                    station_number: bs.station_number,
                    location: bs.location,
                    is_accessible: bs.is_accessible,
                    inaccessible_reason: bs.inaccessible_reason,
                    activity_detected: bs.activity_detected,
                    activity_droppings: bs.activity_droppings,
                    activity_gnawing: bs.activity_gnawing,
                    activity_tracks: bs.activity_tracks,
                    activity_other: bs.activity_other,
                    activity_other_description: bs.activity_other_description,
                    bait_status: bs.bait_status,
                    station_condition: bs.station_condition,
                    rodent_box_replaced: bs.rodent_box_replaced,
                    station_remarks: bs.station_remarks,
                    is_new_addition: bs.is_new_addition,
                    chemicals: JSON.parse(bs.chemicals || '[]')
                })),
                fumigation: {
                    areas: fumigationAreas,
                    target_pests: fumigationPests,
                    chemicals: fumigationChemicals
                },
                insect_monitors: insectMonitors.map((im) => ({
                    monitor_type: im.monitor_type,
                    glue_board_replaced: im.glue_board_replaced,
                    tubes_replaced: im.tubes_replaced,
                    monitor_serviced: im.monitor_serviced,
                    is_new_addition: im.is_new_addition
                }))
            }
        };
        logger_1.logger.info(`Report ${reportId} exported as JSON by user ${userId}`);
        return res.json({
            success: true,
            data: exportData
        });
    }
    catch (error) {
        logger_1.logger.error('Error in exportReportAsJSON:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to export report',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
exports.exportReportAsJSON = exportReportAsJSON;
const importReportFromJSON = async (req, res) => {
    const connection = await database_1.pool.getConnection();
    try {
        const { reportData } = req.body;
        if (!reportData || !reportData.report) {
            return res.status(400).json({
                success: false,
                message: 'Invalid JSON structure: reportData.report is required'
            });
        }
        const report = reportData.report;
        const requiredFields = ['client_id', 'pco_id', 'report_type', 'service_date'];
        const missingFields = requiredFields.filter(field => !report[field]);
        if (missingFields.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Missing required fields: ${missingFields.join(', ')}`
            });
        }
        const validReportTypes = ['bait_inspection', 'fumigation', 'both'];
        if (!validReportTypes.includes(report.report_type)) {
            return res.status(400).json({
                success: false,
                message: `Invalid report_type. Must be one of: ${validReportTypes.join(', ')}`
            });
        }
        await connection.beginTransaction();
        const clientCheck = await (0, database_1.executeQuery)(`SELECT id FROM clients WHERE id = ?`, [report.client_id]);
        if (clientCheck.length === 0) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: `Client with ID ${report.client_id} does not exist`
            });
        }
        const pcoCheck = await (0, database_1.executeQuery)(`SELECT id FROM users WHERE id = ? AND role = 'pco'`, [report.pco_id]);
        if (pcoCheck.length === 0) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: `PCO with ID ${report.pco_id} does not exist`
            });
        }
        const duplicateCheck = await (0, database_1.executeQuery)(`SELECT id FROM reports 
       WHERE client_id = ? AND service_date = ? AND status != 'archived'`, [report.client_id, report.service_date]);
        if (duplicateCheck.length > 0) {
            await connection.rollback();
            const existingReport = duplicateCheck[0];
            return res.status(409).json({
                success: false,
                message: `Report already exists for client ${report.client_id} on ${report.service_date}`,
                existing_report_id: existingReport.id
            });
        }
        const reportResult = await connection.query(`INSERT INTO reports 
       (client_id, pco_id, report_type, service_date, next_service_date,
        pco_signature_data, client_signature_data, client_signature_name,
        general_remarks, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`, [
            report.client_id,
            report.pco_id,
            report.report_type,
            report.service_date,
            report.next_service_date || null,
            report.pco_signature_data || null,
            report.client_signature_data || null,
            report.client_signature_name || null,
            report.general_remarks || null,
            report.status || 'pending'
        ]);
        const reportId = reportResult[0].insertId;
        if (report.bait_stations && Array.isArray(report.bait_stations)) {
            for (const station of report.bait_stations) {
                const stationResult = await connection.query(`INSERT INTO bait_stations 
           (report_id, station_number, location, is_accessible, inaccessible_reason,
            activity_detected, activity_droppings, activity_gnawing, activity_tracks,
            activity_other, activity_other_description, bait_status, station_condition,
            rodent_box_replaced, station_remarks, is_new_addition)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                    reportId,
                    station.station_number,
                    station.location,
                    station.is_accessible ?? 1,
                    station.inaccessible_reason || null,
                    station.activity_detected ?? 0,
                    station.activity_droppings ?? 0,
                    station.activity_gnawing ?? 0,
                    station.activity_tracks ?? 0,
                    station.activity_other ?? 0,
                    station.activity_other_description || null,
                    station.bait_status || 'clean',
                    station.station_condition || 'good',
                    station.rodent_box_replaced ?? 0,
                    station.station_remarks || null,
                    station.is_new_addition ?? 0
                ]);
                const stationId = stationResult[0].insertId;
                if (station.chemicals && Array.isArray(station.chemicals)) {
                    for (const chem of station.chemicals) {
                        const chemCheck = await (0, database_1.executeQuery)(`SELECT id FROM chemicals WHERE id = ?`, [chem.chemical_id]);
                        if (chemCheck.length === 0) {
                            await connection.rollback();
                            return res.status(400).json({
                                success: false,
                                message: `Chemical with ID ${chem.chemical_id} does not exist`
                            });
                        }
                        await connection.query(`INSERT INTO station_chemicals (station_id, chemical_id, quantity, batch_number)
               VALUES (?, ?, ?, ?)`, [stationId, chem.chemical_id, chem.quantity, chem.batch_number || null]);
                    }
                }
            }
        }
        if (report.fumigation) {
            if (report.fumigation.areas && Array.isArray(report.fumigation.areas)) {
                for (const area of report.fumigation.areas) {
                    await connection.query(`INSERT INTO fumigation_areas (report_id, area_name, is_other, other_description)
             VALUES (?, ?, ?, ?)`, [reportId, area.area_name, area.is_other ?? 0, area.other_description || null]);
                }
            }
            if (report.fumigation.target_pests && Array.isArray(report.fumigation.target_pests)) {
                for (const pest of report.fumigation.target_pests) {
                    await connection.query(`INSERT INTO fumigation_target_pests (report_id, pest_name, is_other, other_description)
             VALUES (?, ?, ?, ?)`, [reportId, pest.pest_name, pest.is_other ?? 0, pest.other_description || null]);
                }
            }
            if (report.fumigation.chemicals && Array.isArray(report.fumigation.chemicals)) {
                for (const chem of report.fumigation.chemicals) {
                    const chemCheck = await (0, database_1.executeQuery)(`SELECT id FROM chemicals WHERE id = ?`, [chem.chemical_id]);
                    if (chemCheck.length === 0) {
                        await connection.rollback();
                        return res.status(400).json({
                            success: false,
                            message: `Chemical with ID ${chem.chemical_id} does not exist`
                        });
                    }
                    await connection.query(`INSERT INTO fumigation_chemicals (report_id, chemical_id, quantity, batch_number)
             VALUES (?, ?, ?, ?)`, [reportId, chem.chemical_id, chem.quantity, chem.batch_number || null]);
                }
            }
        }
        if (report.insect_monitors && Array.isArray(report.insect_monitors)) {
            for (const monitor of report.insect_monitors) {
                const validMonitorTypes = ['light', 'box'];
                if (!validMonitorTypes.includes(monitor.monitor_type)) {
                    await connection.rollback();
                    return res.status(400).json({
                        success: false,
                        message: `Invalid monitor_type: ${monitor.monitor_type}. Must be one of: ${validMonitorTypes.join(', ')}`
                    });
                }
                await connection.query(`INSERT INTO insect_monitors 
           (report_id, monitor_type, glue_board_replaced, tubes_replaced, monitor_serviced, is_new_addition)
           VALUES (?, ?, ?, ?, ?, ?)`, [
                    reportId,
                    monitor.monitor_type,
                    monitor.glue_board_replaced ?? 0,
                    monitor.tubes_replaced || null,
                    monitor.monitor_serviced ?? 0,
                    monitor.is_new_addition ?? 0
                ]);
            }
        }
        await connection.commit();
        logger_1.logger.info(`Report imported from JSON: Report ID ${reportId} for client ${report.client_id}`);
        return res.status(201).json({
            success: true,
            message: 'Report imported successfully',
            data: {
                report_id: reportId,
                client_id: report.client_id,
                service_date: report.service_date,
                imported_at: new Date().toISOString()
            }
        });
    }
    catch (error) {
        await connection.rollback();
        logger_1.logger.error('Error in importReportFromJSON:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to import report',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
    finally {
        connection.release();
    }
};
exports.importReportFromJSON = importReportFromJSON;
const markNewEquipmentBeforeUpdate = async (req, res) => {
    try {
        const reportId = parseInt(req.params.id);
        const pcoId = req.user.id;
        const { expected_bait_inside, expected_bait_outside, expected_monitor_light, expected_monitor_box } = req.body;
        const reportCheck = await (0, database_1.executeQuery)(`SELECT id, client_id FROM reports 
       WHERE id = ? AND pco_id = ? AND status IN ('draft', 'declined')`, [reportId, pcoId]);
        if (reportCheck.length === 0) {
            return res.status(403).json({
                success: false,
                message: 'Report not found, not owned by you, or not editable'
            });
        }
        const report = reportCheck[0];
        const clientId = report.client_id;
        if (expected_bait_inside !== undefined) {
            const insideStations = await (0, database_1.executeQuery)(`SELECT id FROM bait_stations 
         WHERE report_id = ? AND location = 'inside' 
         ORDER BY id DESC`, [reportId]);
            if (insideStations.length > expected_bait_inside) {
                const newCount = insideStations.length - expected_bait_inside;
                const stationIds = insideStations.slice(0, newCount).map((s) => s.id);
                if (stationIds.length > 0) {
                    await (0, database_1.executeQuery)(`UPDATE bait_stations SET is_new_addition = 1 
             WHERE id IN (${stationIds.join(',')})`, []);
                    logger_1.logger.info(`Marked ${newCount} inside bait stations as new for report ${reportId}`);
                }
            }
        }
        if (expected_bait_outside !== undefined) {
            const outsideStations = await (0, database_1.executeQuery)(`SELECT id FROM bait_stations 
         WHERE report_id = ? AND location = 'outside' 
         ORDER BY id DESC`, [reportId]);
            if (outsideStations.length > expected_bait_outside) {
                const newCount = outsideStations.length - expected_bait_outside;
                const stationIds = outsideStations.slice(0, newCount).map((s) => s.id);
                if (stationIds.length > 0) {
                    await (0, database_1.executeQuery)(`UPDATE bait_stations SET is_new_addition = 1 
             WHERE id IN (${stationIds.join(',')})`, []);
                    logger_1.logger.info(`Marked ${newCount} outside bait stations as new for report ${reportId}`);
                }
            }
        }
        if (expected_monitor_light !== undefined) {
            const lightMonitors = await (0, database_1.executeQuery)(`SELECT id FROM insect_monitors 
         WHERE report_id = ? AND monitor_type = 'light' 
         ORDER BY id DESC`, [reportId]);
            if (lightMonitors.length > expected_monitor_light) {
                const newCount = lightMonitors.length - expected_monitor_light;
                const monitorIds = lightMonitors.slice(0, newCount).map((m) => m.id);
                if (monitorIds.length > 0) {
                    await (0, database_1.executeQuery)(`UPDATE insect_monitors SET is_new_addition = 1 
             WHERE id IN (${monitorIds.join(',')})`, []);
                    logger_1.logger.info(`Marked ${newCount} light monitors as new for report ${reportId}`);
                }
            }
        }
        if (expected_monitor_box !== undefined) {
            const boxMonitors = await (0, database_1.executeQuery)(`SELECT id FROM insect_monitors 
         WHERE report_id = ? AND monitor_type = 'box' 
         ORDER BY id DESC`, [reportId]);
            if (boxMonitors.length > expected_monitor_box) {
                const newCount = boxMonitors.length - expected_monitor_box;
                const monitorIds = boxMonitors.slice(0, newCount).map((m) => m.id);
                if (monitorIds.length > 0) {
                    await (0, database_1.executeQuery)(`UPDATE insect_monitors SET is_new_addition = 1 
             WHERE id IN (${monitorIds.join(',')})`, []);
                    logger_1.logger.info(`Marked ${newCount} box monitors as new for report ${reportId}`);
                }
            }
        }
        const newBaitCount = await (0, database_1.executeQuery)(`SELECT COUNT(*) as count FROM bait_stations 
       WHERE report_id = ? AND is_new_addition = 1`, [reportId]);
        const newMonitorCount = await (0, database_1.executeQuery)(`SELECT COUNT(*) as count FROM insect_monitors 
       WHERE report_id = ? AND is_new_addition = 1`, [reportId]);
        const totalNewBait = newBaitCount[0].count;
        const totalNewMonitors = newMonitorCount[0].count;
        await (0, database_1.executeQuery)(`UPDATE reports 
       SET new_bait_stations_count = ?, 
           new_insect_monitors_count = ? 
       WHERE id = ?`, [totalNewBait, totalNewMonitors, reportId]);
        logger_1.logger.info(`Equipment marked as new for report ${reportId}: ${totalNewBait} bait stations, ${totalNewMonitors} monitors`);
        return res.status(200).json({
            success: true,
            message: 'New equipment marked successfully',
            new_bait_stations: totalNewBait,
            new_insect_monitors: totalNewMonitors
        });
    }
    catch (error) {
        logger_1.logger.error('Error in markNewEquipmentBeforeUpdate:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to mark new equipment',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
exports.markNewEquipmentBeforeUpdate = markNewEquipmentBeforeUpdate;
const createCompleteReport = async (req, res) => {
    const connection = await database_1.pool.getConnection();
    try {
        const pcoId = req.user.id;
        const { client_id, report_type, service_date, next_service_date, pco_signature_data, client_signature_data, client_signature_name, general_remarks, bait_stations, fumigation } = req.body;
        await connection.beginTransaction();
        const [clientRows] = await connection.query(`SELECT total_bait_stations_inside, total_bait_stations_outside,
              total_insect_monitors_light, total_insect_monitors_box
       FROM clients WHERE id = ?`, [client_id]);
        if (clientRows.length === 0) {
            throw new Error('Client not found');
        }
        const client = clientRows[0];
        const expectedBaitInside = client.total_bait_stations_inside || 0;
        const expectedBaitOutside = client.total_bait_stations_outside || 0;
        const expectedMonitorLight = client.total_insect_monitors_light || 0;
        const expectedMonitorBox = client.total_insect_monitors_box || 0;
        await connection.query('DELETE FROM reports WHERE client_id = ? AND pco_id = ? AND status IN (?, ?)', [client_id, pcoId, 'draft', 'pending']);
        const [reportResult] = await connection.query(`INSERT INTO reports (
        client_id, pco_id, report_type, service_date, next_service_date,
        pco_signature_data, client_signature_data, client_signature_name,
        general_remarks, status, submitted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW())`, [
            client_id, pcoId, report_type, service_date, next_service_date,
            pco_signature_data, client_signature_data, client_signature_name,
            general_remarks || null
        ]);
        const reportId = reportResult.insertId;
        let actualBaitInside = 0;
        let actualBaitOutside = 0;
        if (bait_stations && Array.isArray(bait_stations)) {
            for (const station of bait_stations) {
                if (station.location === 'inside')
                    actualBaitInside++;
                else
                    actualBaitOutside++;
            }
            let insideCount = 0;
            let outsideCount = 0;
            for (const station of bait_stations) {
                let isNew = false;
                if (station.location === 'inside') {
                    insideCount++;
                    isNew = insideCount > expectedBaitInside;
                }
                else {
                    outsideCount++;
                    isNew = outsideCount > expectedBaitOutside;
                }
                const [stationResult] = await connection.query(`INSERT INTO bait_stations (
            report_id, station_number, location, is_accessible, inaccessible_reason,
            activity_detected, activity_droppings, activity_gnawing, activity_tracks,
            activity_other, activity_other_description, bait_status, station_condition,
            action_taken, warning_sign_condition, rodent_box_replaced, station_remarks,
            is_new_addition
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                    reportId, station.station_number, station.location, station.is_accessible,
                    station.inaccessible_reason, station.activity_detected, station.activity_droppings,
                    station.activity_gnawing, station.activity_tracks, station.activity_other,
                    station.activity_other_description, station.bait_status, station.station_condition,
                    station.action_taken, station.warning_sign_condition, station.rodent_box_replaced,
                    station.station_remarks, isNew
                ]);
                if (station.chemicals && Array.isArray(station.chemicals)) {
                    for (const chem of station.chemicals) {
                        await connection.query(`INSERT INTO station_chemicals (station_id, chemical_id, quantity, batch_number)
               VALUES (?, ?, ?, ?)`, [stationResult.insertId, chem.chemical_id, chem.quantity, chem.batch_number]);
                    }
                }
            }
        }
        let actualMonitorLight = 0;
        let actualMonitorBox = 0;
        if (fumigation) {
            if (fumigation.areas && Array.isArray(fumigation.areas)) {
                for (const area of fumigation.areas) {
                    await connection.query(`INSERT INTO fumigation_areas (report_id, area_name, is_other, other_description)
             VALUES (?, ?, ?, ?)`, [reportId, area.area_name, area.is_other || false, area.other_description || null]);
                }
            }
            if (fumigation.target_pests && Array.isArray(fumigation.target_pests)) {
                for (const pest of fumigation.target_pests) {
                    await connection.query(`INSERT INTO fumigation_target_pests (report_id, pest_name, is_other, other_description)
             VALUES (?, ?, ?, ?)`, [reportId, pest.pest_name, pest.is_other || false, pest.other_description || null]);
                }
            }
            if (fumigation.chemicals && Array.isArray(fumigation.chemicals)) {
                for (const chem of fumigation.chemicals) {
                    await connection.query(`INSERT INTO fumigation_chemicals (report_id, chemical_id, quantity, batch_number)
             VALUES (?, ?, ?, ?)`, [reportId, chem.chemical_id, chem.quantity, chem.batch_number]);
                }
            }
            if (fumigation.monitors && Array.isArray(fumigation.monitors)) {
                for (const monitor of fumigation.monitors) {
                    if (monitor.monitor_type === 'light')
                        actualMonitorLight++;
                    else
                        actualMonitorBox++;
                }
                let lightCount = 0;
                let boxCount = 0;
                for (const monitor of fumigation.monitors) {
                    let isNew = false;
                    if (monitor.monitor_type === 'light') {
                        lightCount++;
                        isNew = lightCount > expectedMonitorLight;
                    }
                    else {
                        boxCount++;
                        isNew = boxCount > expectedMonitorBox;
                    }
                    await connection.query(`INSERT INTO insect_monitors (
              report_id, monitor_number, location, monitor_type, monitor_condition, monitor_condition_other,
              warning_sign_condition, glue_board_replaced, light_condition,
              light_faulty_type, light_faulty_other, tubes_replaced, monitor_serviced,
              is_new_addition
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                        reportId, monitor.monitor_number, monitor.location, monitor.monitor_type,
                        monitor.monitor_condition, monitor.monitor_condition_other,
                        monitor.warning_sign_condition, monitor.glue_board_replaced, monitor.light_condition,
                        monitor.light_faulty_type, monitor.light_faulty_other, monitor.tubes_replaced, true,
                        isNew
                    ]);
                }
            }
        }
        const totalNewBait = (actualBaitInside - expectedBaitInside) + (actualBaitOutside - expectedBaitOutside);
        const totalNewMonitors = (actualMonitorLight - expectedMonitorLight) + (actualMonitorBox - expectedMonitorBox);
        await connection.query(`UPDATE reports SET new_bait_stations_count = ?, new_insect_monitors_count = ?
       WHERE id = ?`, [Math.max(0, totalNewBait), Math.max(0, totalNewMonitors), reportId]);
        const updateFields = [];
        const updateValues = [];
        if (bait_stations && Array.isArray(bait_stations) && bait_stations.length > 0) {
            updateFields.push('total_bait_stations_inside = ?', 'total_bait_stations_outside = ?');
            updateValues.push(actualBaitInside, actualBaitOutside);
        }
        if (fumigation && fumigation.monitors && Array.isArray(fumigation.monitors) && fumigation.monitors.length > 0) {
            updateFields.push('total_insect_monitors_light = ?', 'total_insect_monitors_box = ?');
            updateValues.push(actualMonitorLight, actualMonitorBox);
        }
        if (updateFields.length > 0) {
            updateValues.push(client_id);
            await connection.query(`UPDATE clients SET ${updateFields.join(', ')} WHERE id = ?`, updateValues);
        }
        await connection.query(`UPDATE client_pco_assignments 
       SET status = 'inactive',
           unassigned_at = NOW(),
           unassigned_by = ?
       WHERE client_id = ? AND pco_id = ? AND status = 'active'`, [pcoId, client_id, pcoId]);
        logger_1.logger.info(`PCO ${pcoId} auto-unassigned (marked inactive) from client ${client_id} after report submission`);
        const [admins] = await connection.query(`SELECT id FROM users WHERE role = 'admin' OR role = 'both'`);
        for (const admin of admins) {
            await (0, notificationController_1.createNotification)(admin.id, 'report_submitted', 'New Report Submitted', `A new report has been submitted by PCO for client ${client.client_name}`);
        }
        await connection.commit();
        logger_1.logger.info(`Report ${reportId} created and submitted by PCO ${pcoId}`);
        return res.status(201).json({
            success: true,
            message: 'Report submitted successfully',
            report_id: reportId
        });
    }
    catch (error) {
        await connection.rollback();
        logger_1.logger.error('Error in createCompleteReport:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to create report',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
    finally {
        connection.release();
    }
};
exports.createCompleteReport = createCompleteReport;
const updateCompleteReport = async (req, res) => {
    const connection = await database_1.pool.getConnection();
    try {
        const reportId = parseInt(req.params.id);
        const pcoId = req.user.id;
        const { report_type, service_date, next_service_date, pco_signature_data, client_signature_data, client_signature_name, general_remarks, bait_stations, fumigation } = req.body;
        await connection.beginTransaction();
        const [reportRows] = await connection.query(`SELECT r.id, r.client_id, r.status
       FROM reports r 
       WHERE r.id = ? AND r.pco_id = ?`, [reportId, pcoId]);
        if (reportRows.length === 0) {
            throw new Error('Report not found or not owned by you');
        }
        const report = reportRows[0];
        if (report.status !== 'declined') {
            throw new Error('Only declined reports can be resubmitted');
        }
        const clientId = report.client_id;
        const [clientRows] = await connection.query(`SELECT total_bait_stations_inside, total_bait_stations_outside,
              total_insect_monitors_light, total_insect_monitors_box
       FROM clients WHERE id = ?`, [clientId]);
        if (clientRows.length === 0) {
            throw new Error('Client not found');
        }
        const client = clientRows[0];
        const expectedBaitInside = client.total_bait_stations_inside || 0;
        const expectedBaitOutside = client.total_bait_stations_outside || 0;
        const expectedMonitorLight = client.total_insect_monitors_light || 0;
        const expectedMonitorBox = client.total_insect_monitors_box || 0;
        await connection.query('DELETE FROM bait_stations WHERE report_id = ?', [reportId]);
        await connection.query('DELETE FROM fumigation_areas WHERE report_id = ?', [reportId]);
        await connection.query('DELETE FROM fumigation_target_pests WHERE report_id = ?', [reportId]);
        await connection.query('DELETE FROM fumigation_chemicals WHERE report_id = ?', [reportId]);
        await connection.query('DELETE FROM insect_monitors WHERE report_id = ?', [reportId]);
        await connection.query(`UPDATE reports 
       SET report_type = ?, service_date = ?, next_service_date = ?,
           pco_signature_data = ?, client_signature_data = ?, client_signature_name = ?,
           general_remarks = ?, status = 'draft', admin_notes = NULL, 
           submitted_at = NOW(), updated_at = NOW()
       WHERE id = ?`, [
            report_type, service_date, next_service_date,
            pco_signature_data, client_signature_data, client_signature_name,
            general_remarks || null,
            reportId
        ]);
        let actualBaitInside = 0;
        let actualBaitOutside = 0;
        if (bait_stations && Array.isArray(bait_stations)) {
            for (const station of bait_stations) {
                if (station.location === 'inside')
                    actualBaitInside++;
                else
                    actualBaitOutside++;
            }
            let insideCount = 0;
            let outsideCount = 0;
            for (const station of bait_stations) {
                let isNew = false;
                if (station.location === 'inside') {
                    insideCount++;
                    isNew = insideCount > expectedBaitInside;
                }
                else {
                    outsideCount++;
                    isNew = outsideCount > expectedBaitOutside;
                }
                const [stationResult] = await connection.query(`INSERT INTO bait_stations (
            report_id, station_number, location, is_accessible, inaccessible_reason,
            activity_detected, activity_droppings, activity_gnawing, activity_tracks,
            activity_other, activity_other_description, bait_status, station_condition,
            action_taken, warning_sign_condition, rodent_box_replaced, station_remarks,
            is_new_addition
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                    reportId, station.station_number, station.location, station.is_accessible,
                    station.inaccessible_reason, station.activity_detected, station.activity_droppings,
                    station.activity_gnawing, station.activity_tracks, station.activity_other,
                    station.activity_other_description, station.bait_status, station.station_condition,
                    station.action_taken, station.warning_sign_condition, station.rodent_box_replaced,
                    station.station_remarks, isNew
                ]);
                const stationId = stationResult.insertId;
                if (station.chemicals && Array.isArray(station.chemicals)) {
                    for (const chemical of station.chemicals) {
                        await connection.query(`INSERT INTO station_chemicals (bait_station_id, chemical_id, quantity_used, batch_number)
               VALUES (?, ?, ?, ?)`, [stationId, chemical.chemical_id, chemical.quantity_used, chemical.batch_number]);
                    }
                }
            }
        }
        const updateFields = [];
        const updateValues = [];
        if (bait_stations && Array.isArray(bait_stations) && bait_stations.length > 0) {
            updateFields.push('total_bait_stations_inside = ?', 'total_bait_stations_outside = ?');
            updateValues.push(actualBaitInside, actualBaitOutside);
        }
        let actualMonitorLight = 0;
        let actualMonitorBox = 0;
        if (fumigation) {
            if (fumigation.areas && Array.isArray(fumigation.areas)) {
                for (const area of fumigation.areas) {
                    await connection.query(`INSERT INTO fumigation_areas (report_id, area_name, is_other, other_description)
             VALUES (?, ?, ?, ?)`, [reportId, area.area_name, area.is_other || false, area.other_description]);
                }
            }
            if (fumigation.target_pests && Array.isArray(fumigation.target_pests)) {
                for (const pest of fumigation.target_pests) {
                    await connection.query(`INSERT INTO fumigation_target_pests (report_id, pest_name, is_other, other_description)
             VALUES (?, ?, ?, ?)`, [reportId, pest.pest_name, pest.is_other || false, pest.other_description]);
                }
            }
            if (fumigation.chemicals && Array.isArray(fumigation.chemicals)) {
                for (const chemical of fumigation.chemicals) {
                    await connection.query(`INSERT INTO fumigation_chemicals (report_id, chemical_id, quantity_used, batch_number)
             VALUES (?, ?, ?, ?)`, [reportId, chemical.chemical_id, chemical.quantity_used, chemical.batch_number]);
                }
            }
            if (fumigation.monitors && Array.isArray(fumigation.monitors)) {
                for (const monitor of fumigation.monitors) {
                    if (monitor.monitor_type === 'light')
                        actualMonitorLight++;
                    else
                        actualMonitorBox++;
                }
                let lightCount = 0;
                let boxCount = 0;
                for (const monitor of fumigation.monitors) {
                    let isNew = false;
                    if (monitor.monitor_type === 'light') {
                        lightCount++;
                        isNew = lightCount > expectedMonitorLight;
                    }
                    else {
                        boxCount++;
                        isNew = boxCount > expectedMonitorBox;
                    }
                    await connection.query(`INSERT INTO insect_monitors (
              report_id, monitor_type, monitor_condition, monitor_condition_other,
              light_condition, light_faulty_type, light_faulty_other,
              glue_board_replaced, tubes_replaced, warning_sign_condition,
              monitor_serviced, is_new_addition
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                        reportId, monitor.monitor_type, monitor.monitor_condition, monitor.monitor_condition_other,
                        monitor.light_condition, monitor.light_faulty_type, monitor.light_faulty_other,
                        monitor.glue_board_replaced, monitor.tubes_replaced, monitor.warning_sign_condition,
                        monitor.monitor_serviced, isNew
                    ]);
                }
            }
        }
        if (fumigation && fumigation.monitors && Array.isArray(fumigation.monitors) && fumigation.monitors.length > 0) {
            updateFields.push('total_insect_monitors_light = ?', 'total_insect_monitors_box = ?');
            updateValues.push(actualMonitorLight, actualMonitorBox);
        }
        if (updateFields.length > 0) {
            updateValues.push(clientId);
            await connection.query(`UPDATE clients SET ${updateFields.join(', ')} WHERE id = ?`, updateValues);
        }
        await connection.commit();
        logger_1.logger.info(`Report ${reportId} resubmitted by PCO ${pcoId}`);
        return res.json({
            success: true,
            message: 'Report resubmitted successfully',
            report_id: reportId
        });
    }
    catch (error) {
        await connection.rollback();
        logger_1.logger.error('Error in updateCompleteReport:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to resubmit report',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
    finally {
        connection.release();
    }
};
exports.updateCompleteReport = updateCompleteReport;
const adminDownloadReportPDF = async (req, res) => {
    try {
        const reportId = parseInt(req.params.id);
        if (isNaN(reportId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid report ID'
            });
        }
        const report = await (0, database_1.executeQuerySingle)('SELECT id, report_type FROM reports WHERE id = ?', [reportId]);
        if (!report) {
            return res.status(404).json({
                success: false,
                message: 'Report not found'
            });
        }
        logger_1.logger.info(`Generating PDF for report ${reportId}`);
        const pdfPath = await pdfService_1.pdfService.generateReportPDF(reportId);
        const filename = `Report_${reportId}_${new Date().toISOString().split('T')[0]}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        return res.sendFile(pdfPath, (err) => {
            if (err) {
                logger_1.logger.error('Error sending PDF file', { reportId, error: err });
                if (!res.headersSent) {
                    res.status(500).json({
                        success: false,
                        message: 'Failed to download PDF'
                    });
                }
            }
            else {
                promises_1.default.unlink(pdfPath).catch(unlinkErr => {
                    logger_1.logger.warn('Failed to delete temporary PDF file', { pdfPath, error: unlinkErr });
                });
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Error in adminDownloadReportPDF:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to generate PDF',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
exports.adminDownloadReportPDF = adminDownloadReportPDF;
const adminGetReportHTML = async (req, res) => {
    try {
        const reportId = parseInt(req.params.id);
        if (isNaN(reportId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid report ID'
            });
        }
        const report = await (0, database_1.executeQuerySingle)('SELECT id, report_type FROM reports WHERE id = ?', [reportId]);
        if (!report) {
            return res.status(404).json({
                success: false,
                message: 'Report not found'
            });
        }
        logger_1.logger.info(`Generating HTML for client-side PDF conversion, report ${reportId}`);
        const html = await pdfService_1.pdfService.generateReportHTML(reportId);
        return res.status(200).json({
            success: true,
            html: html,
            reportId: reportId
        });
    }
    catch (error) {
        logger_1.logger.error('Error in adminGetReportHTML:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to generate report HTML',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
exports.adminGetReportHTML = adminGetReportHTML;
const adminEmailReportPDF = async (req, res) => {
    try {
        const reportId = parseInt(req.params.id);
        const { recipients, cc, additionalMessage } = req.body;
        if (isNaN(reportId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid report ID'
            });
        }
        const report = await (0, database_1.executeQuerySingle)(`
      SELECT 
        r.id,
        r.client_id,
        r.report_type,
        r.service_date,
        c.company_name
      FROM reports r
      INNER JOIN clients c ON r.client_id = c.id
      WHERE r.id = ?
    `, [reportId]);
        if (!report) {
            return res.status(404).json({
                success: false,
                message: 'Report not found'
            });
        }
        let emailRecipients;
        if (recipients) {
            emailRecipients = recipients;
        }
        else {
            const primaryContact = await (0, database_1.executeQuerySingle)(`
        SELECT email FROM client_contacts 
        WHERE client_id = ? AND is_primary = 1 AND email IS NOT NULL
        LIMIT 1
      `, [report.client_id]);
            if (primaryContact?.email) {
                emailRecipients = primaryContact.email;
            }
            else {
                return res.status(400).json({
                    success: false,
                    message: 'No recipients specified and client has no email address on file'
                });
            }
        }
        const validateEmail = (email) => {
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        };
        const recipientArray = Array.isArray(emailRecipients) ? emailRecipients : [emailRecipients];
        const invalidEmails = recipientArray.filter(email => !validateEmail(email));
        if (invalidEmails.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Invalid email address(es): ${invalidEmails.join(', ')}`
            });
        }
        if (cc) {
            const ccArray = Array.isArray(cc) ? cc : [cc];
            const invalidCCEmails = ccArray.filter(email => !validateEmail(email));
            if (invalidCCEmails.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid CC email address(es): ${invalidCCEmails.join(', ')}`
                });
            }
        }
        logger_1.logger.info(`Emailing PDF for report ${reportId} to ${JSON.stringify(emailRecipients)}`);
        const pdfPath = await pdfService_1.pdfService.generateReportPDF(reportId);
        const emailSent = await (0, emailService_1.sendReportEmail)(emailRecipients, {
            reportId: report.id,
            reportType: report.report_type,
            clientName: report.company_name,
            serviceDate: new Date(report.service_date).toLocaleDateString('en-ZA'),
            pdfPath
        }, {
            cc,
            additionalMessage
        });
        if (!emailSent) {
            return res.status(500).json({
                success: false,
                message: 'Failed to send email. Please check email configuration.'
            });
        }
        await (0, database_1.executeQuery)('UPDATE reports SET emailed_at = NOW() WHERE id = ?', [reportId]);
        const adminUsers = await (0, database_1.executeQuery)('SELECT id FROM users WHERE role = ?', ['admin']);
        for (const admin of adminUsers) {
            await (0, notificationController_1.createNotification)(admin.id, 'system_update', 'Report Emailed', `Report #${reportId} has been emailed to ${Array.isArray(emailRecipients) ? emailRecipients.join(', ') : emailRecipients}`);
        }
        logger_1.logger.info(`PDF emailed successfully for report ${reportId}`);
        return res.json({
            success: true,
            message: 'Report emailed successfully',
            recipients: emailRecipients,
            cc: cc || null,
            emailed_at: new Date().toISOString()
        });
    }
    catch (error) {
        logger_1.logger.error('Error in adminEmailReportPDF:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to email PDF',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
exports.adminEmailReportPDF = adminEmailReportPDF;
const cleanupOldDrafts = async () => {
    try {
        logger_1.logger.info('Starting cleanup of old draft reports (older than 30 days)');
        const result = await (0, database_1.executeQuery)(`DELETE FROM reports 
       WHERE status = 'draft' 
       AND created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)`, []);
        const deletedCount = result.affectedRows || 0;
        if (deletedCount > 0) {
            logger_1.logger.info(`Cleanup completed: Deleted ${deletedCount} old draft reports`);
        }
        else {
            logger_1.logger.info('Cleanup completed: No old draft reports to delete');
        }
        return {
            success: true,
            deletedCount,
            message: `Deleted ${deletedCount} draft reports older than 30 days`
        };
    }
    catch (error) {
        logger_1.logger.error('Error in cleanupOldDrafts:', error);
        return {
            success: false,
            deletedCount: 0,
            message: 'Failed to cleanup old drafts'
        };
    }
};
exports.cleanupOldDrafts = cleanupOldDrafts;
//# sourceMappingURL=reportController.js.map