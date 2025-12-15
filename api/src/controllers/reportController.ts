import { Request, Response } from 'express';
import { hasRole } from '../middleware/auth';
import { executeQuery, executeQuerySingle, pool } from '../config/database';
import { logger } from '../config/logger';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { createNotification } from './notificationController';
import { pdfService } from '../services/pdfService';
import { sendReportEmail } from '../services/emailService';
import path from 'path';
import fs from 'fs/promises';

/**
 * Report Controller - Phase 3.2
 * 
 * Handles complete report management workflow:
 * - Multi-step report creation (draft → pending → approved/declined)
 * - PCO and Admin views with role-based access
 * - Auto-unassign PCO on submission (CRITICAL business rule)
 * - Admin approval/decline with PCO reassignment
 * - Sub-module integration (bait stations, fumigation, insect monitors)
 */

// ============================================================================
// CORE REPORT CRUD OPERATIONS
// ============================================================================

/**
 * GET /api/pco/reports
 * List all reports for authenticated PCO
 * 
 * Business Rules:
 * - PCO can see their own reports (all statuses)
 * - Pagination support (default: 25 per page)
 * - Filter by client_id, status, date range
 */
export const getPCOReports = async (req: Request, res: Response) => {
  try {
    const pcoId = req.user!.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 25;
    const offset = (page - 1) * limit;
    
    // Filters
    const clientId = req.query.client_id ? parseInt(req.query.client_id as string) : null;
    const status = req.query.status as string || 'all';
    const startDate = req.query.start_date as string;
    const endDate = req.query.end_date as string;

    // Build WHERE clause
    let whereConditions = ['r.pco_id = ?'];
    const queryParams: any[] = [pcoId];

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

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM reports r
      WHERE ${whereClause}
    `;

    const countResult = await executeQuery<RowDataPacket[]>(countQuery, queryParams);
    const totalRecords = (countResult[0] as any).total;
    const totalPages = Math.ceil(totalRecords / limit);

    // Get reports
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

    const reports = await executeQuery<RowDataPacket[]>(
      reportsQuery,
      [...queryParams, limit, offset]
    );

    logger.info(`PCO ${pcoId} retrieved ${reports.length} reports`);

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

  } catch (error) {
    logger.error('Error in getPCOReports:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve reports',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
};

/**
 * GET /api/admin/reports
 * List all reports for admin (excludes drafts by default)
 * 
 * Business Rules:
 * - Admin sees all reports EXCEPT drafts (PCO-only visibility)
 * - Filter by pco_id, client_id, status, date range
 * - Pagination support
 * - Priority sorting: pending → declined → approved → archived
 */
export const getAdminReports = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 25;
    const offset = (page - 1) * limit;
    
    // Filters
    const statusGroup = (req.query.status_group as string) || 'draft';
    const reportType = (req.query.report_type as string) || 'all';
    const search = (req.query.search as string) || '';
    const pcoId = req.query.pco_id ? parseInt(req.query.pco_id as string) : null;
    const clientId = req.query.client_id ? parseInt(req.query.client_id as string) : null;
    const status = req.query.status as string || 'all';
    const startDate = req.query.date_from as string;
    const endDate = req.query.date_to as string;

    // Build WHERE clause
    let whereConditions: string[] = [];
    const queryParams: any[] = [];

    // Status group filtering (replaces individual status filter)
    if (statusGroup !== 'all') {
      switch (statusGroup) {
        case 'draft':
          // Draft group shows only draft reports (work in progress)
          whereConditions.push('r.status = ?');
          queryParams.push('draft');
          break;
        case 'pending':
          // Pending group shows submitted reports awaiting approval
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
          // Emailed reports are approved reports that have been emailed to clients
          whereConditions.push('r.status = ? AND r.emailed_at IS NOT NULL');
          queryParams.push('approved');
          break;
        case 'archived':
          whereConditions.push('r.status = ?');
          queryParams.push('archived');
          break;
      }
    }

    // Report type filtering
    if (reportType !== 'all') {
      whereConditions.push('r.report_type = ?');
      queryParams.push(reportType);
    }

    // Search filtering (client name or PCO name)
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

    // Only apply status filter if status_group is 'all'
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

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM reports r
      JOIN clients c ON r.client_id = c.id
      JOIN users u ON r.pco_id = u.id
      WHERE ${whereClause}
    `;

    const countResult = await executeQuery<RowDataPacket[]>(countQuery, queryParams);
    const totalRecords = (countResult[0] as any).total;
    const totalPages = Math.ceil(totalRecords / limit);

    // Get reports
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

    const reports = await executeQuery<RowDataPacket[]>(
      reportsQuery,
      [...queryParams, limit, offset]
    );

    logger.info(`Admin retrieved ${reports.length} reports`);

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

  } catch (error) {
    logger.error('Error in getAdminReports:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve reports',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
};

/**
 * GET /api/admin/reports/pending
 * Get pending reports requiring admin review
 * Priority sorted by submission age
 */
export const getPendingReports = async (req: Request, res: Response) => {
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

    const pendingReports = await executeQuery<RowDataPacket[]>(query);

    logger.info(`Admin retrieved ${pendingReports.length} pending reports`);

    return res.json({
      success: true,
      data: pendingReports,
      total_pending: pendingReports.length
    });

  } catch (error) {
    logger.error('Error in getPendingReports:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve pending reports',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
};

/**
 * GET /api/reports/:id
 * Get complete report with all sub-modules
 * 
 * Business Rules:
 * - PCO can view their own reports (any status)
 * - Admin can view any report (except drafts unless they created it)
 * - Returns complete report data with all related modules
 */
export const getReportById = async (req: Request, res: Response) => {
  try {
    const reportId = parseInt(req.params.id);
    const userId = req.user!.id;
    const userRole = (req.user as any).role_context || req.user!.role;

    // Get basic report info with access control
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

    const reports = await executeQuery<RowDataPacket[]>(reportQuery, [reportId, userId, userRole, userRole]);

    if (reports.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Report not found or access denied'
      });
    }

    const report = reports[0];

    // Get bait stations with chemicals
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

    const baitStations = await executeQuery<RowDataPacket[]>(baitStationsQuery, [reportId]);

    // Parse chemicals JSON
    const parsedBaitStations = baitStations.map(station => ({
      ...station,
      chemicals: (station as any).chemicals ? JSON.parse(`[${(station as any).chemicals}]`) : []
    }));

    // Get fumigation data
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
      executeQuery<RowDataPacket[]>(areasQuery, [reportId]),
      executeQuery<RowDataPacket[]>(pestsQuery, [reportId]),
      executeQuery<RowDataPacket[]>(fumigationChemicalsQuery, [reportId])
    ]);

    // Get insect monitors
    const monitorsQuery = `SELECT * FROM insect_monitors WHERE report_id = ? ORDER BY monitor_type`;
    const monitors = await executeQuery<RowDataPacket[]>(monitorsQuery, [reportId]);

    // Assemble complete report
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

    logger.info(`Report ${reportId} retrieved by user ${userId}`);

    return res.json({
      success: true,
      data: completeReport
    });

  } catch (error) {
    logger.error('Error in getReportById:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve report',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
};

/**
 * POST /api/pco/reports
 * Create new draft report
 * 
 * Business Rules:
 * - PCO must be actively assigned to client
 * - Only one draft per client-PCO pair at a time
 * - Service date cannot be in future
 */
export const createReport = async (req: Request, res: Response) => {
  try {
    const pcoId = req.user!.id;
    const {
      client_id,
      report_type,
      service_date,
      next_service_date,
      pco_signature_data,
      general_remarks
    } = req.body;

    // Verify PCO is assigned to client
    const assignmentCheck = await executeQuery<RowDataPacket[]>(
      `SELECT id FROM client_pco_assignments 
       WHERE client_id = ? AND pco_id = ? AND status = 'active'`,
      [client_id, pcoId]
    );

    if (assignmentCheck.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'You are not assigned to this client'
      });
    }

    // Check for existing draft
    const draftCheck = await executeQuery<RowDataPacket[]>(
      `SELECT id FROM reports 
       WHERE client_id = ? AND pco_id = ? AND status = 'draft'`,
      [client_id, pcoId]
    );

    if (draftCheck.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'A draft report already exists for this client. Please complete or delete it first.',
        existing_draft_id: (draftCheck[0] as any).id
      });
    }

    // Create report
    const insertQuery = `
      INSERT INTO reports (
        client_id, pco_id, report_type, service_date, next_service_date,
        pco_signature_data, general_remarks, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'draft')
    `;

    const result = await executeQuery<ResultSetHeader>(insertQuery, [
      client_id, pcoId, report_type, service_date, next_service_date || null,
      pco_signature_data || null, general_remarks || null
    ]) as any;

    logger.info(`Report ${result.insertId} created by PCO ${pcoId}`);

    return res.status(201).json({
      success: true,
      message: 'Report created successfully',
      report_id: result.insertId
    });

  } catch (error) {
    logger.error('Error in createReport:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create report',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
};

/**
 * PUT /api/pco/reports/:id
 * Update draft report
 * 
 * Business Rules:
 * - Only draft status can be edited by PCO
 * - PCO can only edit their own reports
 */
export const updateReport = async (req: Request, res: Response) => {
  try {
    const reportId = parseInt(req.params.id);
    const pcoId = req.user!.id;
    const updateData = req.body;

    // Verify ownership and editable status (draft or declined)
    // Declined reports can be edited for revision before resubmission
    const reportCheck = await executeQuery<RowDataPacket[]>(
      `SELECT id FROM reports WHERE id = ? AND pco_id = ? AND status IN ('draft', 'declined')`,
      [reportId, pcoId]
    );

    if (reportCheck.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Report not found, not owned by you, or cannot be edited (only drafts and declined reports can be edited)'
      });
    }

    // Build dynamic update query for partial updates
    const fields = [];
    const values = [];

    const allowedFields = [
      'report_type', 'service_date', 'next_service_date',
      'pco_signature_data', 'client_signature_data', 'client_signature_name',
      'general_remarks'
    ];

    // Validate report_type if being updated
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
    
    await executeQuery(
      `UPDATE reports SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ? AND pco_id = ? AND status IN ('draft', 'declined')`,
      values
    );

    logger.info(`Report ${reportId} updated by PCO ${pcoId}`);

    return res.json({
      success: true,
      message: 'Report updated successfully'
    });

  } catch (error) {
    logger.error('Error in updateReport:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update report',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
};

/**
 * DELETE /api/pco/reports/:id
 * Delete draft report
 * 
 * Business Rules:
 * - Only draft status can be deleted
 * - Cascade deletes all sub-modules
 */
export const deleteReport = async (req: Request, res: Response) => {
  try {
    const reportId = parseInt(req.params.id);
    const pcoId = req.user!.id;

    // Verify ownership and draft status
    const reportCheck = await executeQuery<RowDataPacket[]>(
      `SELECT id FROM reports WHERE id = ? AND pco_id = ? AND status = 'draft'`,
      [reportId, pcoId]
    );

    if (reportCheck.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Report not found, not owned by you, or cannot be deleted (only drafts can be deleted)'
      });
    }

    // Delete report (cascade will handle sub-modules)
    await executeQuery(`DELETE FROM reports WHERE id = ?`, [reportId]);

    logger.info(`Report ${reportId} deleted by PCO ${pcoId}`);

    return res.json({
      success: true,
      message: 'Report deleted successfully'
    });

  } catch (error) {
    logger.error('Error in deleteReport:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete report',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
};

/**
 * POST /api/pco/reports/:id/submit
 * Submit report for admin review
 * 
 * Business Rules:
 * - Validates all required data complete
 * - Changes status from 'draft' to 'pending'
 * - PCO remains assigned to client until approval
 * - Records submission timestamp
 * - Sends notification to admin
 */
export const submitReport = async (req: Request, res: Response) => {
  try {
    const reportId = parseInt(req.params.id);
    const pcoId = req.user!.id;

    // Verify ownership and draft/declined status
    // Declined reports can be resubmitted after corrections
    const reportCheck = await executeQuery<RowDataPacket[]>(
      `SELECT r.*, c.company_name
       FROM reports r
       JOIN clients c ON r.client_id = c.id
       WHERE r.id = ? AND r.pco_id = ? AND r.status IN ('draft', 'declined')`,
      [reportId, pcoId]
    );

    if (reportCheck.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Report not found, not owned by you, or already submitted'
      });
    }

    const report = reportCheck[0] as any;

    // Validate report completeness
    const validation = await validateReportForSubmission(reportId, report.report_type);

    if (!validation.is_valid) {
      return res.status(400).json({
        success: false,
        message: 'Report is incomplete and cannot be submitted',
        missing_requirements: validation.missing
      });
    }

    // Update report - change status to pending and record submission timestamp
    await executeQuery(
      `UPDATE reports 
       SET status = 'pending', submitted_at = NOW(), updated_at = NOW()
       WHERE id = ?`,
      [reportId]
    );

    // Equipment tracking (backup layer - only marks equipment not already marked by frontend)
    // Frontend marks equipment when PCO confirms new additions
    // This is a safety net for cases where frontend marking was skipped
    const { 
      markNewBaitStations, 
      markNewInsectMonitors,
      updateReportNewEquipmentCounts,
      updateClientExpectedCounts 
    } = await import('../utils/equipmentTracking');

    // Check if equipment has already been marked by frontend
    const alreadyMarked = await executeQuery<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM bait_stations 
       WHERE report_id = ? AND is_new_addition = 1
       UNION ALL
       SELECT COUNT(*) as count FROM insect_monitors 
       WHERE report_id = ? AND is_new_addition = 1`,
      [reportId, reportId]
    );

    const hasMarkedEquipment = alreadyMarked.some((row: any) => row.count > 0);

    if (!hasMarkedEquipment) {
      // Frontend didn't mark equipment, use backend detection
      logger.info(`Backend marking new equipment for report ${reportId} (frontend marking was skipped)`);
      
      await markNewBaitStations(reportId, report.client_id, 'inside');
      await markNewBaitStations(reportId, report.client_id, 'outside');
      await markNewInsectMonitors(reportId, report.client_id, 'light');
      await markNewInsectMonitors(reportId, report.client_id, 'box');
    } else {
      logger.info(`Equipment already marked by frontend for report ${reportId}, skipping backend marking`);
    }

    // Always update report summary counts
    await updateReportNewEquipmentCounts(reportId);
    
    // Update client expected counts to match actual equipment in report
    // This uses the actual equipment count from the report, not from payload
    await updateClientExpectedCounts(reportId, report.client_id);

    // Auto-unassign PCO from client (critical business rule)
    // First delete any old inactive assignments to avoid unique constraint issues
    await executeQuery(
      `DELETE FROM client_pco_assignments 
       WHERE client_id = ? AND status = 'inactive'`,
      [report.client_id]
    );

    // Now unassign the current PCO
    await executeQuery(
      `UPDATE client_pco_assignments 
       SET status = 'inactive', unassigned_at = NOW()
       WHERE client_id = ? AND pco_id = ? AND status = 'active'`,
      [report.client_id, pcoId]
    );

    // Send notification to admin
    const adminUsers = await executeQuery<RowDataPacket[]>(
      `SELECT id, name FROM users WHERE role IN ('admin', 'both') AND status = 'active' LIMIT 1`
    );

    if (adminUsers.length > 0) {
      const adminId = (adminUsers[0] as any).id;
      
      // Get PCO name
      const pcoInfo = await executeQuerySingle(
        'SELECT name FROM users WHERE id = ?',
        [pcoId]
      );
      const pcoName = pcoInfo?.name || 'PCO';
      
      await createNotification(
        adminId,
        'report_submitted',
        'New Report Submitted',
        `${pcoName} submitted report for ${report.company_name}`
      );
    }

    logger.info(`Report ${reportId} submitted by PCO ${pcoId} - status remains draft`);

    return res.json({
      success: true,
      message: 'Report submitted successfully'
    });

  } catch (error) {
    logger.error('Error in submitReport:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to submit report',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
};

/**
 * POST /api/admin/reports/:id/approve
 * Approve pending report
 * 
 * Business Rules:
 * - Admin only
 * - Report must be in pending status (draft also supported for backward compatibility)
 * - Deletes PCO-client assignment (service complete)
 * - Records reviewer and timestamp
 * - Sends notification to PCO
 */
export const approveReport = async (req: Request, res: Response) => {
  try {
    const reportId = parseInt(req.params.id);
    const adminId = req.user!.id;
    const { admin_notes, recommendations } = req.body;

    // Verify report exists and is in pending or draft status (draft for backward compatibility)
    const reportCheck = await executeQuery<RowDataPacket[]>(
      `SELECT r.id, r.pco_id, r.client_id, c.company_name 
       FROM reports r
       JOIN clients c ON r.client_id = c.id
       WHERE r.id = ? AND r.status IN ('draft', 'pending')`,
      [reportId]
    );

    if (reportCheck.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Report not found or not available for approval'
      });
    }

    const report = reportCheck[0] as any;

    // Approve report (admin_notes and recommendations are optional, convert undefined to null)
    await executeQuery(
      `UPDATE reports 
       SET status = 'approved',
           admin_notes = ?,
           recommendations = ?,
           reviewed_by = ?,
           reviewed_at = NOW(),
           updated_at = NOW()
       WHERE id = ? AND status IN ('draft', 'pending')`,
      [admin_notes || null, recommendations || null, adminId, reportId]
    );

    // Delete the assignment (report approved, service complete)
    await executeQuery(
      `DELETE FROM client_pco_assignments 
       WHERE client_id = ? AND pco_id = ?`,
      [report.client_id, report.pco_id]
    );

    logger.info(`Assignment deleted for client ${report.client_id} after report approval`);

    // Send notification to PCO
    await createNotification(
      report.pco_id,
      'report_submitted',
      'Report Approved',
      `Your report for ${report.company_name} has been approved by the admin.${admin_notes ? ` Notes: ${admin_notes}` : ''}`
    );

    logger.info(`Report ${reportId} approved by admin ${adminId}`);

    return res.json({
      success: true,
      message: 'Report approved successfully'
    });

  } catch (error) {
    logger.error('Error in approveReport:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to approve report',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
};

/**
 * POST /api/admin/reports/:id/decline
 * Decline pending report with feedback
 * 
 * CRITICAL Business Rules:
 * - Admin only
 * - admin_notes is REQUIRED (min 10 chars)
 * - MUST reassign PCO to client for revision
 * - Sends notification to PCO with feedback
 */
export const declineReport = async (req: Request, res: Response) => {
  try {
    const reportId = parseInt(req.params.id);
    const adminId = req.user!.id;
    const { admin_notes } = req.body;

    if (!admin_notes || admin_notes.length < 10) {
      return res.status(400).json({
        success: false,
        message: 'admin_notes is required and must be at least 10 characters (PCO needs feedback for revision)'
      });
    }

    // Get report info (accept draft or pending status)
    const reportCheck = await executeQuery<RowDataPacket[]>(
      `SELECT r.*, c.company_name, u.name as pco_name
       FROM reports r
       JOIN clients c ON r.client_id = c.id
       JOIN users u ON r.pco_id = u.id
       WHERE r.id = ? AND r.status IN ('draft', 'pending')`,
      [reportId]
    );

    if (reportCheck.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Report not found or not available for decline'
      });
    }

    const report = reportCheck[0] as any;

    // Decline report - set to 'declined' status per workflow.md
    // Status: draft/pending → declined (PCO can then edit and resubmit)
    await executeQuery(
      `UPDATE reports 
       SET status = 'declined',
           admin_notes = ?,
           reviewed_by = ?,
           reviewed_at = NOW(),
           updated_at = NOW()
       WHERE id = ? AND status IN ('draft', 'pending')`,
      [admin_notes, adminId, reportId]
    );

    // Check if assignment exists for this client
    const existingAssignment = await executeQuery<RowDataPacket[]>(
      `SELECT pco_id, status FROM client_pco_assignments WHERE client_id = ?`,
      [report.client_id]
    );

    if (existingAssignment.length > 0) {
      const assignment = existingAssignment[0] as any;
      
      if (assignment.status === 'inactive' && assignment.pco_id === report.pco_id) {
        // Case A: Same PCO, just inactive - reinstate
        await executeQuery(
          `UPDATE client_pco_assignments 
           SET status = 'active', 
               assigned_at = NOW(),
               assigned_by = ?,
               unassigned_at = NULL,
               unassigned_by = NULL
           WHERE client_id = ? AND pco_id = ?`,
          [adminId, report.client_id, report.pco_id]
        );
        logger.info(`Assignment reinstated for PCO ${report.pco_id} to client ${report.client_id}`);
      } else if (assignment.pco_id !== report.pco_id) {
        // Case B: Different PCO currently assigned - needs admin confirmation
        // Return conflict info for frontend to handle
        return res.status(409).json({
          success: false,
          message: 'Assignment conflict detected',
          conflict: {
            current_pco_id: assignment.pco_id,
            current_pco_name: await executeQuerySingle(
              'SELECT name FROM users WHERE id = ?',
              [assignment.pco_id]
            ).then(r => r?.name),
            original_pco_id: report.pco_id,
            original_pco_name: report.pco_name,
            client_name: report.company_name
          },
          requires_confirmation: true
        });
      }
    } else {
      // Case C: No assignment exists - create new one
      await executeQuery(
        `INSERT INTO client_pco_assignments (client_id, pco_id, assigned_by, assigned_at, status)
         VALUES (?, ?, ?, NOW(), 'active')`,
        [report.client_id, report.pco_id, adminId]
      );
      logger.info(`New assignment created for PCO ${report.pco_id} to client ${report.client_id}`);
    }

    // Notify PCO using notification helper
    await createNotification(
      report.pco_id,
      'report_declined',
      'Report Declined - Revision Required',
      `Your report for ${report.company_name} has been declined. Admin feedback: ${admin_notes}`
    );

    logger.info(`Report ${reportId} declined by admin ${adminId} - PCO reassigned to client`);

    return res.json({
      success: true,
      message: 'Report declined successfully. PCO has been notified and reassigned for revision.'
    });

  } catch (error) {
    logger.error('Error in declineReport:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to decline report',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
};

/**
 * POST /api/admin/reports/:id/decline/force
 * Force decline with reassignment (handles conflict)
 * Called when admin confirms reassignment despite existing assignment
 */
export const forceDeclineReport = async (req: Request, res: Response) => {
  try {
    const reportId = parseInt(req.params.id);
    const adminId = req.user!.id;
    const { admin_notes } = req.body;

    if (!admin_notes || admin_notes.length < 10) {
      return res.status(400).json({
        success: false,
        message: 'admin_notes is required and must be at least 10 characters'
      });
    }

    // Get report info
    const reportCheck = await executeQuery<RowDataPacket[]>(
      `SELECT r.*, c.company_name, u.name as pco_name
       FROM reports r
       JOIN clients c ON r.client_id = c.id
       JOIN users u ON r.pco_id = u.id
       WHERE r.id = ? AND r.status IN ('draft', 'pending')`,
      [reportId]
    );

    if (reportCheck.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Report not found or not available for decline'
      });
    }

    const report = reportCheck[0] as any;

    // Decline report
    await executeQuery(
      `UPDATE reports 
       SET status = 'declined',
           admin_notes = ?,
           reviewed_by = ?,
           reviewed_at = NOW(),
           updated_at = NOW()
       WHERE id = ?`,
      [admin_notes, adminId, reportId]
    );

    // Delete any existing assignment for this client
    await executeQuery(
      `DELETE FROM client_pco_assignments WHERE client_id = ?`,
      [report.client_id]
    );

    // Create new assignment for original PCO
    await executeQuery(
      `INSERT INTO client_pco_assignments (client_id, pco_id, assigned_by, assigned_at, status)
       VALUES (?, ?, ?, NOW(), 'active')`,
      [report.client_id, report.pco_id, adminId]
    );

    logger.info(`Report ${reportId} force declined - existing assignment deleted, PCO ${report.pco_id} reassigned`);

    // Notify original PCO
    await createNotification(
      report.pco_id,
      'report_declined',
      'Report Declined - Revision Required',
      `Your report for ${report.company_name} has been declined. Admin feedback: ${admin_notes}`
    );

    return res.json({
      success: true,
      message: 'Report declined and PCO reassigned successfully'
    });

  } catch (error) {
    logger.error('Error in forceDeclineReport:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to force decline report',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Validate report completeness before submission
 */
async function validateReportForSubmission(reportId: number, reportType: string): Promise<{
  is_valid: boolean;
  missing: string[];
}> {
  const missing: string[] = [];

  // Check signatures
  const report = await executeQuery<RowDataPacket[]>(
    `SELECT pco_signature_data, client_signature_data, client_signature_name 
     FROM reports WHERE id = ?`,
    [reportId]
  );

  const reportData = report[0] as any;

  if (!reportData.pco_signature_data) {
    missing.push('PCO signature');
  }
  if (!reportData.client_signature_data) {
    missing.push('Client signature');
  }
  if (!reportData.client_signature_name) {
    missing.push('Client signature name');
  }

  // Check bait inspection data
  if (reportType === 'bait_inspection' || reportType === 'both') {
    const baitCount = await executeQuery<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM bait_stations WHERE report_id = ?`,
      [reportId]
    );
    if ((baitCount[0] as any).count === 0) {
      missing.push('At least one bait station (report type requires bait inspection data)');
    }
  }

  // Check fumigation data
  if (reportType === 'fumigation' || reportType === 'both') {
    const areaCount = await executeQuery<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM fumigation_areas WHERE report_id = ?`,
      [reportId]
    );
    const pestCount = await executeQuery<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM fumigation_target_pests WHERE report_id = ?`,
      [reportId]
    );

    if ((areaCount[0] as any).count === 0) {
      missing.push('At least one fumigation area (report type requires fumigation data)');
    }
    if ((pestCount[0] as any).count === 0) {
      missing.push('At least one target pest (report type requires fumigation data)');
    }
  }

  return {
    is_valid: missing.length === 0,
    missing
  };
}

// ============================================================================
// BAIT STATION MANAGEMENT
// ============================================================================

/**
 * POST /api/pco/reports/:id/bait-stations
 * Add bait station with chemicals
 */
export const addBaitStation = async (req: Request, res: Response) => {
  try {
    const reportId = parseInt(req.params.id);
    const pcoId = req.user!.id;
    const {
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
      station_remarks,
      is_new_addition,
      chemicals
    } = req.body;

    // Verify report ownership and editable status (draft or declined)
    const reportCheck = await executeQuery<RowDataPacket[]>(
      `SELECT id FROM reports WHERE id = ? AND pco_id = ? AND status IN ('draft', 'declined')`,
      [reportId, pcoId]
    );

    if (reportCheck.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Report not found, not owned by you, or not editable (only draft and declined reports can be edited)'
      });
    }

    // Insert bait station
    const stationQuery = `
      INSERT INTO bait_stations (
        report_id, station_number, location, is_accessible, inaccessible_reason,
        activity_detected, activity_droppings, activity_gnawing, activity_tracks,
        activity_other, activity_other_description, bait_status, station_condition,
        action_taken, warning_sign_condition, rodent_box_replaced, station_remarks, is_new_addition
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const result = await executeQuery<ResultSetHeader>(stationQuery, [
      reportId, station_number, location, is_accessible, inaccessible_reason || null,
      activity_detected, activity_droppings || 0, activity_gnawing || 0, activity_tracks || 0,
      activity_other || 0, activity_other_description || null, bait_status, station_condition,
      action_taken || 'none', warning_sign_condition || 'good', rodent_box_replaced || 0, station_remarks || null,
      is_new_addition || 0
    ]) as any;

    const stationId = result.insertId;

    // Insert chemicals if provided
    if (chemicals && chemicals.length > 0) {
      const chemicalValues = chemicals.map((chem: any) => [
        stationId,
        chem.chemical_id,
        chem.quantity,
        chem.batch_number || null
      ]);

      for (const values of chemicalValues) {
        await executeQuery(
          `INSERT INTO station_chemicals (station_id, chemical_id, quantity, batch_number) 
           VALUES (?, ?, ?, ?)`,
          values
        );
      }
    }

    logger.info(`Bait station ${stationId} added to report ${reportId} by PCO ${pcoId}`);

    return res.status(201).json({
      success: true,
      message: 'Bait station added successfully',
      station_id: stationId
    });

  } catch (error) {
    logger.error('Error in addBaitStation:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to add bait station',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
};

/**
 * PUT /api/pco/reports/:id/bait-stations/:stationId
 * Update bait station
 */
export const updateBaitStation = async (req: Request, res: Response) => {
  try {
    const reportId = parseInt(req.params.id);
    const stationId = parseInt(req.params.stationId);
    const pcoId = req.user!.id;
    const updateData = req.body;

    // Verify ownership and editable status (draft or declined)
    const checkQuery = `
      SELECT bs.id 
      FROM bait_stations bs
      JOIN reports r ON bs.report_id = r.id
      WHERE bs.id = ? AND bs.report_id = ? AND r.pco_id = ? AND r.status IN ('draft', 'declined')
    `;

    const check = await executeQuery<RowDataPacket[]>(checkQuery, [stationId, reportId, pcoId]);

    if (check.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Station not found or report not editable (only draft and declined reports can be edited)'
      });
    }

    // Build dynamic update query
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
      await executeQuery(
        `UPDATE bait_stations SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`,
        values
      );
    }

    // Update chemicals if provided
    if (updateData.chemicals) {
      // Delete existing chemicals
      await executeQuery(`DELETE FROM station_chemicals WHERE station_id = ?`, [stationId]);

      // Insert new chemicals
      if (updateData.chemicals.length > 0) {
        for (const chem of updateData.chemicals) {
          await executeQuery(
            `INSERT INTO station_chemicals (station_id, chemical_id, quantity, batch_number) 
             VALUES (?, ?, ?, ?)`,
            [stationId, chem.chemical_id, chem.quantity, chem.batch_number || null]
          );
        }
      }
    }

    logger.info(`Bait station ${stationId} updated by PCO ${pcoId}`);

    return res.json({
      success: true,
      message: 'Bait station updated successfully'
    });

  } catch (error) {
    logger.error('Error in updateBaitStation:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update bait station',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
};

/**
 * DELETE /api/pco/reports/:id/bait-stations/:stationId
 * Delete bait station
 */
export const deleteBaitStation = async (req: Request, res: Response) => {
  try {
    const reportId = parseInt(req.params.id);
    const stationId = parseInt(req.params.stationId);
    const pcoId = req.user!.id;

    // Verify ownership and editable status (draft or declined)
    const checkQuery = `
      SELECT bs.id 
      FROM bait_stations bs
      JOIN reports r ON bs.report_id = r.id
      WHERE bs.id = ? AND bs.report_id = ? AND r.pco_id = ? AND r.status IN ('draft', 'declined')
    `;

    const check = await executeQuery<RowDataPacket[]>(checkQuery, [stationId, reportId, pcoId]);

    if (check.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Station not found or report not editable (only draft and declined reports can be edited)'
      });
    }

    // Delete station (cascade will handle chemicals)
    await executeQuery(`DELETE FROM bait_stations WHERE id = ?`, [stationId]);

    logger.info(`Bait station ${stationId} deleted by PCO ${pcoId}`);

    return res.json({
      success: true,
      message: 'Bait station deleted successfully'
    });

  } catch (error) {
    logger.error('Error in deleteBaitStation:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete bait station',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
};

// ============================================================================
// FUMIGATION MANAGEMENT
// ============================================================================

/**
 * PUT /api/pco/reports/:id/fumigation
 * Replace all fumigation data (areas, pests, chemicals)
 */
export const updateFumigation = async (req: Request, res: Response) => {
  try {
    const reportId = parseInt(req.params.id);
    const pcoId = req.user!.id;
    const { areas, target_pests, chemicals } = req.body;

    // Verify ownership and editable status (draft or declined)
    const reportCheck = await executeQuery<RowDataPacket[]>(
      `SELECT id FROM reports WHERE id = ? AND pco_id = ? AND status IN ('draft', 'declined')`,
      [reportId, pcoId]
    );

    if (reportCheck.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Report not found, not owned by you, or not editable (only draft and declined reports can be edited)'
      });
    }

    // Delete existing fumigation data
    await executeQuery(`DELETE FROM fumigation_areas WHERE report_id = ?`, [reportId]);
    await executeQuery(`DELETE FROM fumigation_target_pests WHERE report_id = ?`, [reportId]);
    await executeQuery(`DELETE FROM fumigation_chemicals WHERE report_id = ?`, [reportId]);

    // Insert areas
    if (areas && areas.length > 0) {
      for (const area of areas) {
        await executeQuery(
          `INSERT INTO fumigation_areas (report_id, area_name, is_other, other_description) 
           VALUES (?, ?, ?, ?)`,
          [reportId, area.area_name, area.is_other || 0, area.other_description || null]
        );
      }
    }

    // Insert target pests
    if (target_pests && target_pests.length > 0) {
      for (const pest of target_pests) {
        await executeQuery(
          `INSERT INTO fumigation_target_pests (report_id, pest_name, is_other, other_description) 
           VALUES (?, ?, ?, ?)`,
          [reportId, pest.pest_name, pest.is_other || 0, pest.other_description || null]
        );
      }
    }

    // Insert chemicals
    if (chemicals && chemicals.length > 0) {
      for (const chem of chemicals) {
        await executeQuery(
          `INSERT INTO fumigation_chemicals (report_id, chemical_id, quantity, batch_number) 
           VALUES (?, ?, ?, ?)`,
          [reportId, chem.chemical_id, chem.quantity, chem.batch_number || null]
        );
      }
    }

    logger.info(`Fumigation data updated for report ${reportId} by PCO ${pcoId}`);

    return res.json({
      success: true,
      message: 'Fumigation data updated successfully'
    });

  } catch (error) {
    logger.error('Error in updateFumigation:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update fumigation data',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
};

// ============================================================================
// INSECT MONITOR MANAGEMENT
// ============================================================================

/**
 * POST /api/pco/reports/:id/insect-monitors
 * Add insect monitor
 */
export const addInsectMonitor = async (req: Request, res: Response) => {
  try {
    const reportId = parseInt(req.params.id);
    const pcoId = req.user!.id;
    const {
      monitor_number,
      location,
      monitor_type,
      monitor_condition,
      monitor_condition_other,
      warning_sign_condition,
      light_condition,
      light_faulty_type,
      light_faulty_other,
      glue_board_replaced,
      tubes_replaced,
      monitor_serviced,
      is_new_addition
    } = req.body;

    // Verify ownership and editable status (draft or declined)
    const reportCheck = await executeQuery<RowDataPacket[]>(
      `SELECT id FROM reports WHERE id = ? AND pco_id = ? AND status IN ('draft', 'declined')`,
      [reportId, pcoId]
    );

    if (reportCheck.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Report not found, not owned by you, or not editable (only draft and declined reports can be edited)'
      });
    }

    // Insert monitor
    const result = await executeQuery<ResultSetHeader>(
      `INSERT INTO insect_monitors 
       (report_id, monitor_number, location, monitor_type, monitor_condition, monitor_condition_other, warning_sign_condition,
        light_condition, light_faulty_type, light_faulty_other, glue_board_replaced, tubes_replaced, monitor_serviced, is_new_addition) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
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
      ]
    ) as any;

    logger.info(`Insect monitor ${result.insertId} added to report ${reportId} by PCO ${pcoId}`);

    return res.status(201).json({
      success: true,
      message: 'Insect monitor added successfully',
      monitor_id: result.insertId
    });

  } catch (error) {
    logger.error('Error in addInsectMonitor:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to add insect monitor',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
};

/**
 * PUT /api/pco/reports/:id/insect-monitors/:monitorId
 * Update insect monitor
 */
export const updateInsectMonitor = async (req: Request, res: Response) => {
  try {
    const reportId = parseInt(req.params.id);
    const monitorId = parseInt(req.params.monitorId);
    const pcoId = req.user!.id;
    const updateData = req.body;

    // Verify ownership and editable status (draft or declined)
    const checkQuery = `
      SELECT im.id 
      FROM insect_monitors im
      JOIN reports r ON im.report_id = r.id
      WHERE im.id = ? AND im.report_id = ? AND r.pco_id = ? AND r.status IN ('draft', 'declined')
    `;

    const check = await executeQuery<RowDataPacket[]>(checkQuery, [monitorId, reportId, pcoId]);

    if (check.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Monitor not found or report not editable (only draft and declined reports can be edited)'
      });
    }

    // Build dynamic update query for partial updates
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

    await executeQuery(
      `UPDATE insect_monitors SET ${fields.join(', ')} WHERE id = ?`,
      values
    );

    logger.info(`Insect monitor ${monitorId} updated by PCO ${pcoId}`);

    return res.json({
      success: true,
      message: 'Insect monitor updated successfully'
    });

  } catch (error) {
    logger.error('Error in updateInsectMonitor:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update insect monitor',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
};

/**
 * DELETE /api/pco/reports/:id/insect-monitors/:monitorId
 * Delete insect monitor
 */
export const deleteInsectMonitor = async (req: Request, res: Response) => {
  try {
    const reportId = parseInt(req.params.id);
    const monitorId = parseInt(req.params.monitorId);
    const pcoId = req.user!.id;

    // Verify ownership and editable status (draft or declined)
    const checkQuery = `
      SELECT im.id 
      FROM insect_monitors im
      JOIN reports r ON im.report_id = r.id
      WHERE im.id = ? AND im.report_id = ? AND r.pco_id = ? AND r.status IN ('draft', 'declined')
    `;

    const check = await executeQuery<RowDataPacket[]>(checkQuery, [monitorId, reportId, pcoId]);

    if (check.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Monitor not found or report not editable (only draft and declined reports can be edited)'
      });
    }

    // Delete monitor
    await executeQuery(`DELETE FROM insect_monitors WHERE id = ?`, [monitorId]);

    logger.info(`Insect monitor ${monitorId} deleted by PCO ${pcoId}`);

    return res.json({
      success: true,
      message: 'Insect monitor deleted successfully'
    });

  } catch (error) {
    logger.error('Error in deleteInsectMonitor:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete insect monitor',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
};

// ============================================================================
// PRE-FILL DATA
// ============================================================================

/**
 * GET /api/pco/reports/pre-fill/:clientId
 * Get pre-fill data from last APPROVED report
 */
export const getPreFillData = async (req: Request, res: Response) => {
  try {
    const clientId = parseInt(req.params.clientId);
    const pcoId = req.user!.id;

    // Verify PCO is assigned to client
    const assignmentCheck = await executeQuery<RowDataPacket[]>(
      `SELECT id FROM client_pco_assignments 
       WHERE client_id = ? AND pco_id = ? AND status = 'active'`,
      [clientId, pcoId]
    );

    if (assignmentCheck.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'You are not assigned to this client'
      });
    }

    // Get last APPROVED report for client
    const lastReportQuery = `
      SELECT id FROM reports 
      WHERE client_id = ? AND status = 'approved'
      ORDER BY service_date DESC, id DESC
      LIMIT 1
    `;

    const lastReport = await executeQuery<RowDataPacket[]>(lastReportQuery, [clientId]);

    if (lastReport.length === 0) {
      return res.json({
        success: true,
        message: 'No previous reports found',
        data: null
      });
    }

    const reportId = (lastReport[0] as any).id;

    // Get bait stations (without chemicals - PCO will add fresh)
    const baitStations = await executeQuery<RowDataPacket[]>(
      `SELECT station_number, location FROM bait_stations WHERE report_id = ? ORDER BY location, station_number`,
      [reportId]
    );

    // Get fumigation areas
    const areas = await executeQuery<RowDataPacket[]>(
      `SELECT area_name, is_other, other_description FROM fumigation_areas WHERE report_id = ?`,
      [reportId]
    );

    // Get target pests
    const pests = await executeQuery<RowDataPacket[]>(
      `SELECT pest_name, is_other, other_description FROM fumigation_target_pests WHERE report_id = ?`,
      [reportId]
    );

    // Get fumigation chemicals (as suggestions)
    const chemicals = await executeQuery<RowDataPacket[]>(
      `SELECT fc.chemical_id, c.name as chemical_name 
       FROM fumigation_chemicals fc
       JOIN chemicals c ON fc.chemical_id = c.id
       WHERE fc.report_id = ?`,
      [reportId]
    );

    // Get insect monitor types
    const monitors = await executeQuery<RowDataPacket[]>(
      `SELECT monitor_type FROM insect_monitors WHERE report_id = ? GROUP BY monitor_type`,
      [reportId]
    );

    logger.info(`Pre-fill data retrieved for client ${clientId} by PCO ${pcoId}`);

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

  } catch (error) {
    logger.error('Error in getPreFillData:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve pre-fill data',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
};

/**
 * POST /api/admin/reports/:id/archive
 * Archive a report
 * 
 * Business Rules:
 * - Admin only
 * - Can archive reports in any status except already archived
 * - Archived reports are completed but not for client distribution
 */
export const archiveReport = async (req: Request, res: Response) => {
  try {
    const reportId = parseInt(req.params.id);
    const adminId = req.user!.id;

    // Verify report exists and is not already archived, get PCO and client info
    const reportCheck = await executeQuery<RowDataPacket[]>(
      `SELECT r.id, r.status, r.pco_id, r.client_id, c.company_name 
       FROM reports r
       JOIN clients c ON r.client_id = c.id
       WHERE r.id = ?`,
      [reportId]
    );

    if (reportCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    const report = reportCheck[0] as any;

    if (report.status === 'archived') {
      return res.status(400).json({
        success: false,
        message: 'Report is already archived'
      });
    }

    // Archive report
    await executeQuery(
      `UPDATE reports 
       SET status = 'archived',
           reviewed_by = ?,
           reviewed_at = NOW(),
           updated_at = NOW()
       WHERE id = ?`,
      [adminId, reportId]
    );

    // Delete the assignment (report archived, service complete)
    await executeQuery(
      `DELETE FROM client_pco_assignments 
       WHERE client_id = ? AND pco_id = ?`,
      [report.client_id, report.pco_id]
    );

    logger.info(`Assignment deleted for client ${report.client_id} after report archival`);

    // Notify PCO that their report has been archived
    await createNotification(
      report.pco_id,
      'system_update',
      'Report Archived',
      `Your report for ${report.company_name} has been archived by the admin.`
    );

    logger.info(`Report ${reportId} archived by admin ${adminId}`);

    return res.json({
      success: true,
      message: 'Report archived successfully',
      data: {
        report_id: reportId,
        status: 'archived'
      }
    });

  } catch (error) {
    logger.error('Error in archiveReport:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to archive report',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
};

/**
 * PUT /api/admin/reports/:id
 * Admin comprehensive update report
 * 
 * Business Rules:
 * - Admin can edit ANY report regardless of status
 * - Can update ALL fields EXCEPT: general_remarks, pco_signature, client_signature
 * - Can add/edit/delete bait stations with chemicals
 * - Can add/edit/delete fumigation areas, target pests, and chemicals
 * - Can add/edit/delete insect monitors
 * - Full CRUD on all nested data
 */
export const adminUpdateReport = async (req: Request, res: Response) => {
  const connection = await pool.getConnection();
  
  try {
    const reportId = parseInt(req.params.id);
    const adminId = req.user!.id;
    const updateData = req.body;

    await connection.beginTransaction();

    // Verify report exists and get client info for equipment tracking
    const reportCheck = await executeQuery<RowDataPacket[]>(
      `SELECT r.id, r.status, r.report_type, r.client_id,
              c.total_bait_stations_inside, c.total_bait_stations_outside,
              c.total_insect_monitors_light, c.total_insect_monitors_box
       FROM reports r
       JOIN clients c ON r.client_id = c.id
       WHERE r.id = ?`,
      [reportId]
    );

    if (reportCheck.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    const report = reportCheck[0] as any;
    const clientId = report.client_id;
    const expectedBaitInside = report.total_bait_stations_inside || 0;
    const expectedBaitOutside = report.total_bait_stations_outside || 0;
    const expectedMonitorLight = report.total_insect_monitors_light || 0;
    const expectedMonitorBox = report.total_insect_monitors_box || 0;

    // ========================================================================
    // STEP 1: Update main report fields
    // ========================================================================
    const fields = [];
    const values = [];

    // Admin can update these fields (excluding general_remarks, pco_signature, client_signature)
    const allowedFields = [
      'service_date',
      'next_service_date',
      'report_type',
      'status',
      'recommendations',
      'admin_notes'
    ];

    // Validate report_type if being updated
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
      await connection.query(
        `UPDATE reports SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`,
        values
      );
    }

    // ========================================================================
    // STEP 2: Handle Bait Stations (Full CRUD)
    // ========================================================================
    if (updateData.bait_stations !== undefined && Array.isArray(updateData.bait_stations)) {
      // Get existing station IDs
      const existingStations = await connection.query<RowDataPacket[]>(
        'SELECT id FROM bait_stations WHERE report_id = ?',
        [reportId]
      );
      const existingIds = existingStations[0].map((s: any) => s.id);
      const incomingIds = updateData.bait_stations
        .filter((s: any) => s.id)
        .map((s: any) => s.id);

      // Delete removed stations
      const toDelete = existingIds.filter((id: number) => !incomingIds.includes(id));
      for (const stationId of toDelete) {
        // Delete associated chemicals first
        await connection.query('DELETE FROM station_chemicals WHERE station_id = ?', [stationId]);
        // Delete station
        await connection.query('DELETE FROM bait_stations WHERE id = ?', [stationId]);
      }

      // Update or insert stations
      for (const station of updateData.bait_stations) {
        if (station.id) {
          // Update existing station
          await connection.query(
            `UPDATE bait_stations SET
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
            WHERE id = ? AND report_id = ?`,
            [
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
            ]
          );

          // Update chemicals for this station
          if (station.chemicals && Array.isArray(station.chemicals)) {
            // Delete existing chemicals
            await connection.query('DELETE FROM station_chemicals WHERE station_id = ?', [station.id]);
            
            // Insert new chemicals
            for (const chem of station.chemicals) {
              if (chem.chemical_id) {
                await connection.query(
                  `INSERT INTO station_chemicals (station_id, chemical_id, quantity, batch_number)
                   VALUES (?, ?, ?, ?)`,
                  [station.id, chem.chemical_id, chem.quantity, chem.batch_number]
                );
              }
            }
          }
        } else {
          // Insert new station
          const [result] = await connection.query<ResultSetHeader>(
            `INSERT INTO bait_stations (
              report_id, \`location\`, station_number, is_accessible, inaccessible_reason,
              activity_detected, activity_droppings, activity_gnawing, activity_tracks, activity_other, activity_other_description,
              bait_status, station_condition, action_taken, warning_sign_condition, station_remarks
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
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
            ]
          );

          const newStationId = result.insertId;

          // Insert chemicals for new station
          if (station.chemicals && Array.isArray(station.chemicals)) {
            for (const chem of station.chemicals) {
              if (chem.chemical_id) {
                await connection.query(
                  `INSERT INTO station_chemicals (station_id, chemical_id, quantity, batch_number)
                   VALUES (?, ?, ?, ?)`,
                  [newStationId, chem.chemical_id, chem.quantity, chem.batch_number]
                );
              }
            }
          }
        }
      }
    }

    // ========================================================================
    // STEP 3: Handle Fumigation Areas
    // ========================================================================
    if (updateData.fumigation_areas !== undefined && Array.isArray(updateData.fumigation_areas)) {
      // Delete all existing areas and reinsert
      await connection.query('DELETE FROM fumigation_areas WHERE report_id = ?', [reportId]);
      
      for (const area of updateData.fumigation_areas) {
        if (area.area_name) {
          await connection.query(
            'INSERT INTO fumigation_areas (report_id, area_name, is_other, other_description) VALUES (?, ?, ?, ?)',
            [
              reportId, 
              area.area_name,
              area.is_other ? 1 : 0,
              area.other_description || null
            ]
          );
        }
      }
    }

    // ========================================================================
    // STEP 4: Handle Fumigation Target Pests
    // ========================================================================
    if (updateData.fumigation_target_pests !== undefined && Array.isArray(updateData.fumigation_target_pests)) {
      // Delete all existing pests and reinsert
      await connection.query('DELETE FROM fumigation_target_pests WHERE report_id = ?', [reportId]);
      
      for (const pest of updateData.fumigation_target_pests) {
        if (pest.pest_name) {
          await connection.query(
            'INSERT INTO fumigation_target_pests (report_id, pest_name, is_other, other_description) VALUES (?, ?, ?, ?)',
            [
              reportId, 
              pest.pest_name,
              pest.is_other ? 1 : 0,
              pest.other_description || null
            ]
          );
        }
      }
    }

    // ========================================================================
    // STEP 5: Handle Fumigation Chemicals
    // ========================================================================
    if (updateData.fumigation_chemicals !== undefined && Array.isArray(updateData.fumigation_chemicals)) {
      // Delete all existing fumigation chemicals and reinsert
      await connection.query('DELETE FROM fumigation_chemicals WHERE report_id = ?', [reportId]);
      
      for (const chem of updateData.fumigation_chemicals) {
        if (chem.chemical_id) {
          await connection.query(
            `INSERT INTO fumigation_chemicals (report_id, chemical_id, quantity, batch_number)
             VALUES (?, ?, ?, ?)`,
            [reportId, chem.chemical_id, chem.quantity, chem.batch_number]
          );
        }
      }
    }

    // ========================================================================
    // STEP 6: Handle Insect Monitors (Full CRUD)
    // ========================================================================
    if (updateData.insect_monitors !== undefined && Array.isArray(updateData.insect_monitors)) {
      // Get existing monitor IDs
      const existingMonitors = await connection.query<RowDataPacket[]>(
        'SELECT id FROM insect_monitors WHERE report_id = ?',
        [reportId]
      );
      const existingIds = existingMonitors[0].map((m: any) => m.id);
      const incomingIds = updateData.insect_monitors
        .filter((m: any) => m.id)
        .map((m: any) => m.id);

      // Delete removed monitors
      const toDelete = existingIds.filter((id: number) => !incomingIds.includes(id));
      for (const monitorId of toDelete) {
        await connection.query('DELETE FROM insect_monitors WHERE id = ?', [monitorId]);
      }

      // Update or insert monitors
      for (const monitor of updateData.insect_monitors) {
        if (monitor.id) {
          // Update existing monitor
          await connection.query(
            `UPDATE insect_monitors SET
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
            WHERE id = ? AND report_id = ?`,
            [
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
            ]
          );
        } else {
          // Insert new monitor
          await connection.query(
            `INSERT INTO insect_monitors (
              report_id, monitor_number, location, monitor_type, monitor_condition, monitor_condition_other,
              light_condition, light_faulty_type, light_faulty_other,
              glue_board_replaced, tubes_replaced, warning_sign_condition, monitor_serviced
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
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
            ]
          );
        }
      }
    }

    // ========================================================================
    // STEP 7: Equipment Tracking & Client Baseline Update
    // ========================================================================
    // Recalculate equipment counts and update client baseline if equipment was modified
    let actualBaitInside = 0;
    let actualBaitOutside = 0;
    let actualMonitorLight = 0;
    let actualMonitorBox = 0;

    // Count actual bait stations from database
    if (updateData.bait_stations !== undefined) {
      const baitCounts = await connection.query<RowDataPacket[]>(
        `SELECT 
          SUM(CASE WHEN location = 'inside' THEN 1 ELSE 0 END) as inside_count,
          SUM(CASE WHEN location = 'outside' THEN 1 ELSE 0 END) as outside_count
         FROM bait_stations WHERE report_id = ?`,
        [reportId]
      );
      actualBaitInside = baitCounts[0][0]?.inside_count || 0;
      actualBaitOutside = baitCounts[0][0]?.outside_count || 0;

      // Update is_new_addition flags based on baseline
      await connection.query(
        `UPDATE bait_stations bs
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
         END`,
        [reportId, expectedBaitInside, expectedBaitOutside]
      );
    }

    // Count actual monitors from database
    if (updateData.insect_monitors !== undefined) {
      const monitorCounts = await connection.query<RowDataPacket[]>(
        `SELECT 
          SUM(CASE WHEN monitor_type = 'light' THEN 1 ELSE 0 END) as light_count,
          SUM(CASE WHEN monitor_type = 'box' THEN 1 ELSE 0 END) as box_count
         FROM insect_monitors WHERE report_id = ?`,
        [reportId]
      );
      actualMonitorLight = monitorCounts[0][0]?.light_count || 0;
      actualMonitorBox = monitorCounts[0][0]?.box_count || 0;

      // Update is_new_addition flags based on baseline
      await connection.query(
        `UPDATE insect_monitors im
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
         END`,
        [reportId, expectedMonitorLight, expectedMonitorBox]
      );
    }

    // Calculate total new equipment counts
    const totalNewBait = Math.max(0, (actualBaitInside - expectedBaitInside) + (actualBaitOutside - expectedBaitOutside));
    const totalNewMonitors = Math.max(0, (actualMonitorLight - expectedMonitorLight) + (actualMonitorBox - expectedMonitorBox));

    // Update report with new equipment counts
    await connection.query(
      `UPDATE reports SET new_bait_stations_count = ?, new_insect_monitors_count = ?
       WHERE id = ?`,
      [totalNewBait, totalNewMonitors, reportId]
    );

    // Update client equipment baseline to match actual counts
    // Only update fields that have actual data to avoid overwriting with zeros
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    
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
      await connection.query(
        `UPDATE clients SET ${updateFields.join(', ')} WHERE id = ?`,
        updateValues
      );
    }

    await connection.commit();

    logger.info(`Report ${reportId} comprehensively updated by admin ${adminId}`);

    return res.json({
      success: true,
      message: 'Report updated successfully',
      data: {
        report_id: reportId
      }
    });

  } catch (error) {
    await connection.rollback();
    logger.error('Error in adminUpdateReport:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update report',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  } finally {
    connection.release();
  }
};

// ============================================================================
// OFFLINE SYNC - JSON EXPORT/IMPORT
// ============================================================================

/**
 * GET /api/pco/reports/:id/export-json
 * Export a complete report as JSON for offline backup
 * 
 * Business Rules:
 * - PCO can only export their own reports
 * - Exports complete report structure with all relationships
 * - Includes bait stations with chemicals, fumigation data, insect monitors
 * - Preserves is_new_addition flags for equipment tracking
 * - 100% compliant with database schema for reimport
 */
export const exportReportAsJSON = async (req: Request, res: Response) => {
  try {
    const reportId = parseInt(req.params.id);
    const userId = req.user!.id;
    const userRole = req.user!.role;

    if (isNaN(reportId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid report ID'
      });
    }

    // Get report with client info
    const report = await executeQuerySingle<RowDataPacket>(
      `SELECT r.*, c.company_name as client_name, c.company_number as client_company_number,
              u.name as pco_name, u.pco_number
       FROM reports r
       JOIN clients c ON r.client_id = c.id
       JOIN users u ON r.pco_id = u.id
       WHERE r.id = ?`,
      [reportId]
    );

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    // PCO can only export their own reports
    if (userRole === 'pco' && report.pco_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Get bait stations with chemicals
    const baitStations = await executeQuery<RowDataPacket[]>(
      `SELECT bs.*, 
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
       ORDER BY bs.station_number, bs.location`,
      [reportId]
    );

    // Get fumigation areas
    const fumigationAreas = await executeQuery<RowDataPacket[]>(
      `SELECT * FROM fumigation_areas WHERE report_id = ? ORDER BY id`,
      [reportId]
    );

    // Get fumigation target pests
    const fumigationPests = await executeQuery<RowDataPacket[]>(
      `SELECT * FROM fumigation_target_pests WHERE report_id = ? ORDER BY id`,
      [reportId]
    );

    // Get fumigation chemicals
    const fumigationChemicals = await executeQuery<RowDataPacket[]>(
      `SELECT fc.*, ch.name as chemical_name
       FROM fumigation_chemicals fc
       JOIN chemicals ch ON fc.chemical_id = ch.id
       WHERE fc.report_id = ?
       ORDER BY fc.id`,
      [reportId]
    );

    // Get insect monitors
    const insectMonitors = await executeQuery<RowDataPacket[]>(
      `SELECT * FROM insect_monitors WHERE report_id = ? ORDER BY id`,
      [reportId]
    );

    // Build complete JSON structure
    const exportData = {
      export_metadata: {
        export_date: new Date().toISOString(),
        exported_by: userId,
        app_version: '1.0.0',
        schema_version: '1.0'
      },
      report: {
        // Report metadata (exclude server-generated IDs and timestamps)
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
        
        // Bait stations with chemicals
        bait_stations: baitStations.map((bs: any) => ({
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
          is_new_addition: bs.is_new_addition, // CRITICAL: preserve for equipment tracking
          chemicals: JSON.parse(bs.chemicals || '[]')
        })),

        // Fumigation data
        fumigation: {
          areas: fumigationAreas,
          target_pests: fumigationPests,
          chemicals: fumigationChemicals
        },

        // Insect monitors
        insect_monitors: insectMonitors.map((im: any) => ({
          monitor_type: im.monitor_type,
          glue_board_replaced: im.glue_board_replaced,
          tubes_replaced: im.tubes_replaced,
          monitor_serviced: im.monitor_serviced,
          is_new_addition: im.is_new_addition // CRITICAL: preserve for equipment tracking
        }))
      }
    };

    logger.info(`Report ${reportId} exported as JSON by user ${userId}`);

    return res.json({
      success: true,
      data: exportData
    });

  } catch (error) {
    logger.error('Error in exportReportAsJSON:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to export report',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
};

/**
 * POST /api/admin/reports/import-json
 * Import a report from JSON file (for offline sync failures)
 * 
 * Business Rules:
 * - Admin only
 * - Validates JSON structure and required fields
 * - Checks for duplicate reports (same client + service date)
 * - Creates report with all relationships in a transaction
 * - Triggers equipment tracking after import
 * - All-or-nothing: rolls back if any part fails
 */
export const importReportFromJSON = async (req: Request, res: Response) => {
  const connection = await pool.getConnection();
  
  try {
    const { reportData } = req.body;

    if (!reportData || !reportData.report) {
      return res.status(400).json({
        success: false,
        message: 'Invalid JSON structure: reportData.report is required'
      });
    }

    const report = reportData.report;

    // Validate required fields
    const requiredFields = ['client_id', 'pco_id', 'report_type', 'service_date'];
    const missingFields = requiredFields.filter(field => !report[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    // Validate enums
    const validReportTypes = ['bait_inspection', 'fumigation', 'both'];
    if (!validReportTypes.includes(report.report_type)) {
      return res.status(400).json({
        success: false,
        message: `Invalid report_type. Must be one of: ${validReportTypes.join(', ')}`
      });
    }

    await connection.beginTransaction();

    // Check if client exists
    const clientCheck = await executeQuery<RowDataPacket[]>(
      `SELECT id FROM clients WHERE id = ?`,
      [report.client_id]
    );

    if (clientCheck.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: `Client with ID ${report.client_id} does not exist`
      });
    }

    // Check if PCO exists
    const pcoCheck = await executeQuery<RowDataPacket[]>(
      `SELECT id FROM users WHERE id = ? AND role = 'pco'`,
      [report.pco_id]
    );

    if (pcoCheck.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: `PCO with ID ${report.pco_id} does not exist`
      });
    }

    // Check for duplicate report (same client + service date)
    const duplicateCheck = await executeQuery<RowDataPacket[]>(
      `SELECT id FROM reports 
       WHERE client_id = ? AND service_date = ? AND status != 'archived'`,
      [report.client_id, report.service_date]
    );

    if (duplicateCheck.length > 0) {
      await connection.rollback();
      const existingReport = duplicateCheck[0] as any;
      return res.status(409).json({
        success: false,
        message: `Report already exists for client ${report.client_id} on ${report.service_date}`,
        existing_report_id: existingReport.id
      });
    }

    // Create report
    const reportResult = await connection.query(
      `INSERT INTO reports 
       (client_id, pco_id, report_type, service_date, next_service_date,
        pco_signature_data, client_signature_data, client_signature_name,
        general_remarks, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
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
      ]
    ) as any;

    const reportId = reportResult[0].insertId;

    // Import bait stations
    if (report.bait_stations && Array.isArray(report.bait_stations)) {
      for (const station of report.bait_stations) {
        const stationResult = await connection.query(
          `INSERT INTO bait_stations 
           (report_id, station_number, location, is_accessible, inaccessible_reason,
            activity_detected, activity_droppings, activity_gnawing, activity_tracks,
            activity_other, activity_other_description, bait_status, station_condition,
            rodent_box_replaced, station_remarks, is_new_addition)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
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
          ]
        ) as any;

        const stationId = stationResult[0].insertId;

        // Import station chemicals
        if (station.chemicals && Array.isArray(station.chemicals)) {
          for (const chem of station.chemicals) {
            // Validate chemical exists
            const chemCheck = await executeQuery<RowDataPacket[]>(
              `SELECT id FROM chemicals WHERE id = ?`,
              [chem.chemical_id]
            );

            if (chemCheck.length === 0) {
              await connection.rollback();
              return res.status(400).json({
                success: false,
                message: `Chemical with ID ${chem.chemical_id} does not exist`
              });
            }

            await connection.query(
              `INSERT INTO station_chemicals (station_id, chemical_id, quantity, batch_number)
               VALUES (?, ?, ?, ?)`,
              [stationId, chem.chemical_id, chem.quantity, chem.batch_number || null]
            );
          }
        }
      }
    }

    // Import fumigation data
    if (report.fumigation) {
      // Fumigation areas
      if (report.fumigation.areas && Array.isArray(report.fumigation.areas)) {
        for (const area of report.fumigation.areas) {
          await connection.query(
            `INSERT INTO fumigation_areas (report_id, area_name, is_other, other_description)
             VALUES (?, ?, ?, ?)`,
            [reportId, area.area_name, area.is_other ?? 0, area.other_description || null]
          );
        }
      }

      // Target pests
      if (report.fumigation.target_pests && Array.isArray(report.fumigation.target_pests)) {
        for (const pest of report.fumigation.target_pests) {
          await connection.query(
            `INSERT INTO fumigation_target_pests (report_id, pest_name, is_other, other_description)
             VALUES (?, ?, ?, ?)`,
            [reportId, pest.pest_name, pest.is_other ?? 0, pest.other_description || null]
          );
        }
      }

      // Fumigation chemicals
      if (report.fumigation.chemicals && Array.isArray(report.fumigation.chemicals)) {
        for (const chem of report.fumigation.chemicals) {
          // Validate chemical exists
          const chemCheck = await executeQuery<RowDataPacket[]>(
            `SELECT id FROM chemicals WHERE id = ?`,
            [chem.chemical_id]
          );

          if (chemCheck.length === 0) {
            await connection.rollback();
            return res.status(400).json({
              success: false,
              message: `Chemical with ID ${chem.chemical_id} does not exist`
            });
          }

          await connection.query(
            `INSERT INTO fumigation_chemicals (report_id, chemical_id, quantity, batch_number)
             VALUES (?, ?, ?, ?)`,
            [reportId, chem.chemical_id, chem.quantity, chem.batch_number || null]
          );
        }
      }
    }

    // Import insect monitors
    if (report.insect_monitors && Array.isArray(report.insect_monitors)) {
      for (const monitor of report.insect_monitors) {
        // Validate monitor_type
        const validMonitorTypes = ['light', 'box'];
        if (!validMonitorTypes.includes(monitor.monitor_type)) {
          await connection.rollback();
          return res.status(400).json({
            success: false,
            message: `Invalid monitor_type: ${monitor.monitor_type}. Must be one of: ${validMonitorTypes.join(', ')}`
          });
        }

        await connection.query(
          `INSERT INTO insect_monitors 
           (report_id, monitor_type, glue_board_replaced, tubes_replaced, monitor_serviced, is_new_addition)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            reportId,
            monitor.monitor_type,
            monitor.glue_board_replaced ?? 0,
            monitor.tubes_replaced || null,
            monitor.monitor_serviced ?? 0,
            monitor.is_new_addition ?? 0
          ]
        );
      }
    }

    await connection.commit();

    logger.info(`Report imported from JSON: Report ID ${reportId} for client ${report.client_id}`);

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

  } catch (error) {
    await connection.rollback();
    logger.error('Error in importReportFromJSON:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to import report',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  } finally {
    connection.release();
  }
};

/**
 * POST /api/pco/reports/:id/mark-new-equipment
 * Mark equipment as new additions based on counts exceeding expected
 * Called BEFORE updating client expected counts
 * 
 * Business Rules:
 * - PCO must own the report
 * - Report must be in draft or declined status
 * - Marks equipment with is_new_addition = 1 flag
 * - Used when PCO confirms new equipment before updating client counts
 * 
 * Request body:
 * {
 *   "expected_bait_inside": 5,
 *   "expected_bait_outside": 2,
 *   "expected_monitor_light": 3,
 *   "expected_monitor_box": 1
 * }
 */
export const markNewEquipmentBeforeUpdate = async (req: Request, res: Response) => {
  try {
    const reportId = parseInt(req.params.id);
    const pcoId = req.user!.id;
    const {
      expected_bait_inside,
      expected_bait_outside,
      expected_monitor_light,
      expected_monitor_box
    } = req.body;

    // Verify report ownership and editable status
    const reportCheck = await executeQuery<RowDataPacket[]>(
      `SELECT id, client_id FROM reports 
       WHERE id = ? AND pco_id = ? AND status IN ('draft', 'declined')`,
      [reportId, pcoId]
    );

    if (reportCheck.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Report not found, not owned by you, or not editable'
      });
    }

    const report = reportCheck[0] as any;
    const clientId = report.client_id;

    // Mark bait stations as new if they exceed expected counts
    if (expected_bait_inside !== undefined) {
      const insideStations = await executeQuery<RowDataPacket[]>(
        `SELECT id FROM bait_stations 
         WHERE report_id = ? AND location = 'inside' 
         ORDER BY id DESC`,
        [reportId]
      );

      if (insideStations.length > expected_bait_inside) {
        const newCount = insideStations.length - expected_bait_inside;
        const stationIds = insideStations.slice(0, newCount).map((s: any) => s.id);
        
        if (stationIds.length > 0) {
          await executeQuery(
            `UPDATE bait_stations SET is_new_addition = 1 
             WHERE id IN (${stationIds.join(',')})`,
            []
          );
          logger.info(`Marked ${newCount} inside bait stations as new for report ${reportId}`);
        }
      }
    }

    if (expected_bait_outside !== undefined) {
      const outsideStations = await executeQuery<RowDataPacket[]>(
        `SELECT id FROM bait_stations 
         WHERE report_id = ? AND location = 'outside' 
         ORDER BY id DESC`,
        [reportId]
      );

      if (outsideStations.length > expected_bait_outside) {
        const newCount = outsideStations.length - expected_bait_outside;
        const stationIds = outsideStations.slice(0, newCount).map((s: any) => s.id);
        
        if (stationIds.length > 0) {
          await executeQuery(
            `UPDATE bait_stations SET is_new_addition = 1 
             WHERE id IN (${stationIds.join(',')})`,
            []
          );
          logger.info(`Marked ${newCount} outside bait stations as new for report ${reportId}`);
        }
      }
    }

    // Mark insect monitors as new if they exceed expected counts
    if (expected_monitor_light !== undefined) {
      const lightMonitors = await executeQuery<RowDataPacket[]>(
        `SELECT id FROM insect_monitors 
         WHERE report_id = ? AND monitor_type = 'light' 
         ORDER BY id DESC`,
        [reportId]
      );

      if (lightMonitors.length > expected_monitor_light) {
        const newCount = lightMonitors.length - expected_monitor_light;
        const monitorIds = lightMonitors.slice(0, newCount).map((m: any) => m.id);
        
        if (monitorIds.length > 0) {
          await executeQuery(
            `UPDATE insect_monitors SET is_new_addition = 1 
             WHERE id IN (${monitorIds.join(',')})`,
            []
          );
          logger.info(`Marked ${newCount} light monitors as new for report ${reportId}`);
        }
      }
    }

    if (expected_monitor_box !== undefined) {
      const boxMonitors = await executeQuery<RowDataPacket[]>(
        `SELECT id FROM insect_monitors 
         WHERE report_id = ? AND monitor_type = 'box' 
         ORDER BY id DESC`,
        [reportId]
      );

      if (boxMonitors.length > expected_monitor_box) {
        const newCount = boxMonitors.length - expected_monitor_box;
        const monitorIds = boxMonitors.slice(0, newCount).map((m: any) => m.id);
        
        if (monitorIds.length > 0) {
          await executeQuery(
            `UPDATE insect_monitors SET is_new_addition = 1 
             WHERE id IN (${monitorIds.join(',')})`,
            []
          );
          logger.info(`Marked ${newCount} box monitors as new for report ${reportId}`);
        }
      }
    }

    // Count total new equipment for summary
    const newBaitCount = await executeQuery<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM bait_stations 
       WHERE report_id = ? AND is_new_addition = 1`,
      [reportId]
    );

    const newMonitorCount = await executeQuery<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM insect_monitors 
       WHERE report_id = ? AND is_new_addition = 1`,
      [reportId]
    );

    const totalNewBait = (newBaitCount[0] as any).count;
    const totalNewMonitors = (newMonitorCount[0] as any).count;

    // Update report summary counts
    await executeQuery(
      `UPDATE reports 
       SET new_bait_stations_count = ?, 
           new_insect_monitors_count = ? 
       WHERE id = ?`,
      [totalNewBait, totalNewMonitors, reportId]
    );

    logger.info(`Equipment marked as new for report ${reportId}: ${totalNewBait} bait stations, ${totalNewMonitors} monitors`);

    return res.status(200).json({
      success: true,
      message: 'New equipment marked successfully',
      new_bait_stations: totalNewBait,
      new_insect_monitors: totalNewMonitors
    });

  } catch (error) {
    logger.error('Error in markNewEquipmentBeforeUpdate:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to mark new equipment',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
};

/**
 * POST /api/pco/reports/complete
 * Complete report submission - handles everything in one transaction
 * Simple approach: Just create the report with all data, no complex equipment tracking
 */
/**
 * POST /api/pco/reports/complete
 * Submit complete report - handles everything in one transaction with smart equipment tracking
 * 
 * Workflow per workflow.md:
 * 1. Get client's expected equipment counts (baseline)
 * 2. Count actual equipment in report
 * 3. Mark excess equipment as new (is_new_addition flag)
 * 4. Update client baseline counts
 * 5. Store new equipment totals in report
 * 6. Set status to 'pending' for admin review
 */
export const createCompleteReport = async (req: Request, res: Response) => {
  const connection = await pool.getConnection();
  
  try {
    const pcoId = req.user!.id;
    const {
      client_id,
      report_type,
      service_date,
      next_service_date,
      pco_signature_data,
      client_signature_data,
      client_signature_name,
      general_remarks,
      bait_stations,
      fumigation
    } = req.body;

    await connection.beginTransaction();

    // Step 1: Get client's current equipment baseline
    const [clientRows] = await connection.query<RowDataPacket[]>(
      `SELECT total_bait_stations_inside, total_bait_stations_outside,
              total_insect_monitors_light, total_insect_monitors_box
       FROM clients WHERE id = ?`,
      [client_id]
    );

    if (clientRows.length === 0) {
      throw new Error('Client not found');
    }

    const client = clientRows[0];
    const expectedBaitInside = client.total_bait_stations_inside || 0;
    const expectedBaitOutside = client.total_bait_stations_outside || 0;
    const expectedMonitorLight = client.total_insect_monitors_light || 0;
    const expectedMonitorBox = client.total_insect_monitors_box || 0;

    // Step 2: Delete any existing draft/pending for this client
    await connection.query(
      'DELETE FROM reports WHERE client_id = ? AND pco_id = ? AND status IN (?, ?)',
      [client_id, pcoId, 'draft', 'pending']
    );

    // Step 3: Create report with status 'pending'
    const [reportResult] = await connection.query<ResultSetHeader>(
      `INSERT INTO reports (
        client_id, pco_id, report_type, service_date, next_service_date,
        pco_signature_data, client_signature_data, client_signature_name,
        general_remarks, status, submitted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW())`,
      [
        client_id, pcoId, report_type, service_date, next_service_date,
        pco_signature_data, client_signature_data, client_signature_name,
        general_remarks || null
      ]
    );

    const reportId = reportResult.insertId;

    // Step 4: Add bait stations with smart new equipment detection
    let actualBaitInside = 0;
    let actualBaitOutside = 0;

    if (bait_stations && Array.isArray(bait_stations)) {
      // Count actual equipment first
      for (const station of bait_stations) {
        if (station.location === 'inside') actualBaitInside++;
        else actualBaitOutside++;
      }

      // Track which position we're at for each location
      let insideCount = 0;
      let outsideCount = 0;

      for (const station of bait_stations) {
        let isNew = false;
        
        // Determine if this station is new based on position
        if (station.location === 'inside') {
          insideCount++;
          isNew = insideCount > expectedBaitInside;
        } else {
          outsideCount++;
          isNew = outsideCount > expectedBaitOutside;
        }

        const [stationResult] = await connection.query<ResultSetHeader>(
          `INSERT INTO bait_stations (
            report_id, station_number, location, is_accessible, inaccessible_reason,
            activity_detected, activity_droppings, activity_gnawing, activity_tracks,
            activity_other, activity_other_description, bait_status, station_condition,
            action_taken, warning_sign_condition, rodent_box_replaced, station_remarks,
            is_new_addition
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            reportId, station.station_number, station.location, station.is_accessible,
            station.inaccessible_reason, station.activity_detected, station.activity_droppings,
            station.activity_gnawing, station.activity_tracks, station.activity_other,
            station.activity_other_description, station.bait_status, station.station_condition,
            station.action_taken, station.warning_sign_condition, station.rodent_box_replaced,
            station.station_remarks, isNew
          ]
        );

        // Add chemicals for this station
        if (station.chemicals && Array.isArray(station.chemicals)) {
          for (const chem of station.chemicals) {
            await connection.query(
              `INSERT INTO station_chemicals (station_id, chemical_id, quantity, batch_number)
               VALUES (?, ?, ?, ?)`,
              [stationResult.insertId, chem.chemical_id, chem.quantity, chem.batch_number]
            );
          }
        }
      }
    }

    // Step 5: Add fumigation data with smart monitor tracking
    let actualMonitorLight = 0;
    let actualMonitorBox = 0;
    if (fumigation) {
      // Areas
      if (fumigation.areas && Array.isArray(fumigation.areas)) {
        for (const area of fumigation.areas) {
          await connection.query(
            `INSERT INTO fumigation_areas (report_id, area_name, is_other, other_description)
             VALUES (?, ?, ?, ?)`,
            [reportId, area.area_name, area.is_other || false, area.other_description || null]
          );
        }
      }

      // Pests
      if (fumigation.target_pests && Array.isArray(fumigation.target_pests)) {
        for (const pest of fumigation.target_pests) {
          await connection.query(
            `INSERT INTO fumigation_target_pests (report_id, pest_name, is_other, other_description)
             VALUES (?, ?, ?, ?)`,
            [reportId, pest.pest_name, pest.is_other || false, pest.other_description || null]
          );
        }
      }

      // Chemicals
      if (fumigation.chemicals && Array.isArray(fumigation.chemicals)) {
        for (const chem of fumigation.chemicals) {
          await connection.query(
            `INSERT INTO fumigation_chemicals (report_id, chemical_id, quantity, batch_number)
             VALUES (?, ?, ?, ?)`,
            [reportId, chem.chemical_id, chem.quantity, chem.batch_number]
          );
        }
      }

      // Monitors with smart new equipment detection
      if (fumigation.monitors && Array.isArray(fumigation.monitors)) {
        // Count actual equipment first
        for (const monitor of fumigation.monitors) {
          if (monitor.monitor_type === 'light') actualMonitorLight++;
          else actualMonitorBox++;
        }

        // Track which position we're at for each type
        let lightCount = 0;
        let boxCount = 0;

        for (const monitor of fumigation.monitors) {
          let isNew = false;
          
          // Determine if this monitor is new based on position
          if (monitor.monitor_type === 'light') {
            lightCount++;
            isNew = lightCount > expectedMonitorLight;
          } else {
            boxCount++;
            isNew = boxCount > expectedMonitorBox;
          }

          await connection.query(
            `INSERT INTO insect_monitors (
              report_id, monitor_number, location, monitor_type, monitor_condition, monitor_condition_other,
              warning_sign_condition, glue_board_replaced, light_condition,
              light_faulty_type, light_faulty_other, tubes_replaced, monitor_serviced,
              is_new_addition
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              reportId, monitor.monitor_number, monitor.location, monitor.monitor_type, 
              monitor.monitor_condition, monitor.monitor_condition_other,
              monitor.warning_sign_condition, monitor.glue_board_replaced, monitor.light_condition,
              monitor.light_faulty_type, monitor.light_faulty_other, monitor.tubes_replaced, true,
              isNew
            ]
          );
        }
      }
    }

    // Step 6: Calculate total new equipment counts
    const totalNewBait = (actualBaitInside - expectedBaitInside) + (actualBaitOutside - expectedBaitOutside);
    const totalNewMonitors = (actualMonitorLight - expectedMonitorLight) + (actualMonitorBox - expectedMonitorBox);
    
    // Update the report with new equipment counts
    await connection.query(
      `UPDATE reports SET new_bait_stations_count = ?, new_insect_monitors_count = ?
       WHERE id = ?`,
      [Math.max(0, totalNewBait), Math.max(0, totalNewMonitors), reportId]
    );

    // Step 7: Update client equipment baseline to match actual counts
    // (Per workflow.md: "Update the client's baseline to match the current actual count")
    // Only update fields that have actual data to avoid overwriting with zeros
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    
    // Update bait stations if data was provided
    if (bait_stations && Array.isArray(bait_stations) && bait_stations.length > 0) {
      updateFields.push('total_bait_stations_inside = ?', 'total_bait_stations_outside = ?');
      updateValues.push(actualBaitInside, actualBaitOutside);
    }
    
    // Update monitors if data was provided
    if (fumigation && fumigation.monitors && Array.isArray(fumigation.monitors) && fumigation.monitors.length > 0) {
      updateFields.push('total_insect_monitors_light = ?', 'total_insect_monitors_box = ?');
      updateValues.push(actualMonitorLight, actualMonitorBox);
    }
    
    // Only run update if we have fields to update
    if (updateFields.length > 0) {
      updateValues.push(client_id);
      await connection.query(
        `UPDATE clients SET ${updateFields.join(', ')} WHERE id = ?`,
        updateValues
      );
    }

    // Step 8: Auto-unassign PCO from client after report submission
    // (Per workflow.md: "PCOs are automatically unassigned after submitting a report")
    // Mark assignment as inactive (not deleted) so it can be reinstated on decline
    await connection.query(
      `UPDATE client_pco_assignments 
       SET status = 'inactive',
           unassigned_at = NOW(),
           unassigned_by = ?
       WHERE client_id = ? AND pco_id = ? AND status = 'active'`,
      [pcoId, client_id, pcoId]
    );

    logger.info(`PCO ${pcoId} auto-unassigned (marked inactive) from client ${client_id} after report submission`);

    // Step 9: Notify admin of new report submission
    // Get admin user IDs
    const [admins] = await connection.query<RowDataPacket[]>(
      `SELECT id FROM users WHERE role = 'admin' OR role = 'both'`
    );
    
    for (const admin of admins) {
      await createNotification(
        admin.id,
        'report_submitted',
        'New Report Submitted',
        `A new report has been submitted by PCO for client ${client.client_name}`
      );
    }

    await connection.commit();

    logger.info(`Report ${reportId} created and submitted by PCO ${pcoId}`);

    return res.status(201).json({
      success: true,
      message: 'Report submitted successfully',
      report_id: reportId
    });

  } catch (error) {
    await connection.rollback();
    logger.error('Error in createCompleteReport:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create report',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  } finally {
    connection.release();
  }
};

/**
 * PUT /api/pco/reports/:id/complete
 * Update and resubmit a complete report (for declined reports)
 * 
 * Business Rules:
 * - Only declined reports can be resubmitted via this endpoint
 * - Replaces all report data (bait stations, fumigation, monitors)
 * - Runs equipment tracking again
 * - Changes status back to 'draft' for admin review
 * - Clears admin_notes
 */
export const updateCompleteReport = async (req: Request, res: Response) => {
  const connection = await pool.getConnection();
  
  try {
    const reportId = parseInt(req.params.id);
    const pcoId = req.user!.id;
    const {
      report_type,
      service_date,
      next_service_date,
      pco_signature_data,
      client_signature_data,
      client_signature_name,
      general_remarks,
      bait_stations,
      fumigation
    } = req.body;

    await connection.beginTransaction();

    // Verify ownership and that it's a declined report
    const [reportRows] = await connection.query<RowDataPacket[]>(
      `SELECT r.id, r.client_id, r.status
       FROM reports r 
       WHERE r.id = ? AND r.pco_id = ?`,
      [reportId, pcoId]
    );

    if (reportRows.length === 0) {
      throw new Error('Report not found or not owned by you');
    }

    const report = reportRows[0];

    if (report.status !== 'declined') {
      throw new Error('Only declined reports can be resubmitted');
    }

    const clientId = report.client_id;

    // Get client's current equipment baseline
    const [clientRows] = await connection.query<RowDataPacket[]>(
      `SELECT total_bait_stations_inside, total_bait_stations_outside,
              total_insect_monitors_light, total_insect_monitors_box
       FROM clients WHERE id = ?`,
      [clientId]
    );

    if (clientRows.length === 0) {
      throw new Error('Client not found');
    }

    const client = clientRows[0];
    const expectedBaitInside = client.total_bait_stations_inside || 0;
    const expectedBaitOutside = client.total_bait_stations_outside || 0;
    const expectedMonitorLight = client.total_insect_monitors_light || 0;
    const expectedMonitorBox = client.total_insect_monitors_box || 0;

    // Delete existing bait stations, fumigation data, and monitors for this report
    await connection.query('DELETE FROM bait_stations WHERE report_id = ?', [reportId]);
    await connection.query('DELETE FROM fumigation_areas WHERE report_id = ?', [reportId]);
    await connection.query('DELETE FROM fumigation_target_pests WHERE report_id = ?', [reportId]);
    await connection.query('DELETE FROM fumigation_chemicals WHERE report_id = ?', [reportId]);
    await connection.query('DELETE FROM insect_monitors WHERE report_id = ?', [reportId]);

    // Update main report data and reset status to 'draft'
    await connection.query(
      `UPDATE reports 
       SET report_type = ?, service_date = ?, next_service_date = ?,
           pco_signature_data = ?, client_signature_data = ?, client_signature_name = ?,
           general_remarks = ?, status = 'draft', admin_notes = NULL, 
           submitted_at = NOW(), updated_at = NOW()
       WHERE id = ?`,
      [
        report_type, service_date, next_service_date,
        pco_signature_data, client_signature_data, client_signature_name,
        general_remarks || null,
        reportId
      ]
    );

    // Add bait stations with equipment tracking
    let actualBaitInside = 0;
    let actualBaitOutside = 0;

    if (bait_stations && Array.isArray(bait_stations)) {
      for (const station of bait_stations) {
        if (station.location === 'inside') actualBaitInside++;
        else actualBaitOutside++;
      }

      let insideCount = 0;
      let outsideCount = 0;

      for (const station of bait_stations) {
        let isNew = false;
        
        if (station.location === 'inside') {
          insideCount++;
          isNew = insideCount > expectedBaitInside;
        } else {
          outsideCount++;
          isNew = outsideCount > expectedBaitOutside;
        }

        const [stationResult] = await connection.query<ResultSetHeader>(
          `INSERT INTO bait_stations (
            report_id, station_number, location, is_accessible, inaccessible_reason,
            activity_detected, activity_droppings, activity_gnawing, activity_tracks,
            activity_other, activity_other_description, bait_status, station_condition,
            action_taken, warning_sign_condition, rodent_box_replaced, station_remarks,
            is_new_addition
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            reportId, station.station_number, station.location, station.is_accessible,
            station.inaccessible_reason, station.activity_detected, station.activity_droppings,
            station.activity_gnawing, station.activity_tracks, station.activity_other,
            station.activity_other_description, station.bait_status, station.station_condition,
            station.action_taken, station.warning_sign_condition, station.rodent_box_replaced,
            station.station_remarks, isNew
          ]
        );

        const stationId = stationResult.insertId;

        if (station.chemicals && Array.isArray(station.chemicals)) {
          for (const chemical of station.chemicals) {
            await connection.query(
              `INSERT INTO station_chemicals (bait_station_id, chemical_id, quantity_used, batch_number)
               VALUES (?, ?, ?, ?)`,
              [stationId, chemical.chemical_id, chemical.quantity_used, chemical.batch_number]
            );
          }
        }
      }
    }

    // Conditional baseline update for bait stations
    const updateFields: string[] = [];
    const updateValues: any[] = [];

    if (bait_stations && Array.isArray(bait_stations) && bait_stations.length > 0) {
      updateFields.push('total_bait_stations_inside = ?', 'total_bait_stations_outside = ?');
      updateValues.push(actualBaitInside, actualBaitOutside);
    }

    // Add fumigation data with equipment tracking
    let actualMonitorLight = 0;
    let actualMonitorBox = 0;

    if (fumigation) {
      if (fumigation.areas && Array.isArray(fumigation.areas)) {
        for (const area of fumigation.areas) {
          await connection.query(
            `INSERT INTO fumigation_areas (report_id, area_name, is_other, other_description)
             VALUES (?, ?, ?, ?)`,
            [reportId, area.area_name, area.is_other || false, area.other_description]
          );
        }
      }

      if (fumigation.target_pests && Array.isArray(fumigation.target_pests)) {
        for (const pest of fumigation.target_pests) {
          await connection.query(
            `INSERT INTO fumigation_target_pests (report_id, pest_name, is_other, other_description)
             VALUES (?, ?, ?, ?)`,
            [reportId, pest.pest_name, pest.is_other || false, pest.other_description]
          );
        }
      }

      if (fumigation.chemicals && Array.isArray(fumigation.chemicals)) {
        for (const chemical of fumigation.chemicals) {
          await connection.query(
            `INSERT INTO fumigation_chemicals (report_id, chemical_id, quantity_used, batch_number)
             VALUES (?, ?, ?, ?)`,
            [reportId, chemical.chemical_id, chemical.quantity_used, chemical.batch_number]
          );
        }
      }

      if (fumigation.monitors && Array.isArray(fumigation.monitors)) {
        for (const monitor of fumigation.monitors) {
          if (monitor.monitor_type === 'light') actualMonitorLight++;
          else actualMonitorBox++;
        }

        let lightCount = 0;
        let boxCount = 0;

        for (const monitor of fumigation.monitors) {
          let isNew = false;

          if (monitor.monitor_type === 'light') {
            lightCount++;
            isNew = lightCount > expectedMonitorLight;
          } else {
            boxCount++;
            isNew = boxCount > expectedMonitorBox;
          }

          await connection.query(
            `INSERT INTO insect_monitors (
              report_id, monitor_type, monitor_condition, monitor_condition_other,
              light_condition, light_faulty_type, light_faulty_other,
              glue_board_replaced, tubes_replaced, warning_sign_condition,
              monitor_serviced, is_new_addition
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              reportId, monitor.monitor_type, monitor.monitor_condition, monitor.monitor_condition_other,
              monitor.light_condition, monitor.light_faulty_type, monitor.light_faulty_other,
              monitor.glue_board_replaced, monitor.tubes_replaced, monitor.warning_sign_condition,
              monitor.monitor_serviced, isNew
            ]
          );
        }
      }
    }

    // Conditional baseline update for monitors
    if (fumigation && fumigation.monitors && Array.isArray(fumigation.monitors) && fumigation.monitors.length > 0) {
      updateFields.push('total_insect_monitors_light = ?', 'total_insect_monitors_box = ?');
      updateValues.push(actualMonitorLight, actualMonitorBox);
    }

    // Execute conditional baseline update
    if (updateFields.length > 0) {
      updateValues.push(clientId);
      await connection.query(
        `UPDATE clients SET ${updateFields.join(', ')} WHERE id = ?`,
        updateValues
      );
    }

    // Note: Equipment totals are tracked in the clients table, not reports table
    // The reports table only has new_bait_stations_count and new_insect_monitors_count
    // which are calculated during report creation/submission

    await connection.commit();

    logger.info(`Report ${reportId} resubmitted by PCO ${pcoId}`);

    return res.json({
      success: true,
      message: 'Report resubmitted successfully',
      report_id: reportId
    });

  } catch (error) {
    await connection.rollback();
    logger.error('Error in updateCompleteReport:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to resubmit report',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  } finally {
    connection.release();
  }
};

// ============================================================================
// PDF GENERATION ENDPOINTS
// ============================================================================

/**
 * GET /api/admin/reports/:id/download
 * Generate and download PDF for a report
 * 
 * Business Rules:
 * - Admin only
 * - Generates PDF matching legacy PHP format
 * - Returns PDF file with proper content-disposition
 */
export const adminDownloadReportPDF = async (req: Request, res: Response) => {
  try {
    const reportId = parseInt(req.params.id);

    if (isNaN(reportId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid report ID'
      });
    }

    // Verify report exists
    const report = await executeQuerySingle(
      'SELECT id, report_type FROM reports WHERE id = ?',
      [reportId]
    );

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    logger.info(`Generating PDF for report ${reportId}`);

    // Generate PDF using PHP dompdf service
    const pdfPath = await pdfService.generateReportPDF(reportId);
    const filename = `Report_${reportId}_${new Date().toISOString().split('T')[0]}.pdf`;

    // Set headers for download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Send file
    return res.sendFile(pdfPath, (err) => {
      if (err) {
        logger.error('Error sending PDF file', { reportId, error: err });
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            message: 'Failed to download PDF'
          });
        }
      } else {
        // Clean up PDF file after successful send
        fs.unlink(pdfPath).catch(unlinkErr => {
          logger.warn('Failed to delete temporary PDF file', { pdfPath, error: unlinkErr });
        });
      }
    });

  } catch (error) {
    logger.error('Error in adminDownloadReportPDF:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate PDF',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
};

/**
 * GET /api/admin/reports/:id/html
 * Generate HTML for client-side PDF conversion
 * 
 * Business Rules:
 * - Admin only
 * - Returns HTML that preserves all styling and layout
 * - Client-side converts to PDF using jsPDF + html2canvas
 */
export const adminGetReportHTML = async (req: Request, res: Response) => {
  try {
    const reportId = parseInt(req.params.id);

    if (isNaN(reportId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid report ID'
      });
    }

    // Verify report exists
    const report = await executeQuerySingle(
      'SELECT id, report_type FROM reports WHERE id = ?',
      [reportId]
    );

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    logger.info(`Generating HTML for client-side PDF conversion, report ${reportId}`);

    // Generate HTML
    const html = await pdfService.generateReportHTML(reportId);

    // Return HTML
    return res.status(200).json({
      success: true,
      html: html,
      reportId: reportId
    });

  } catch (error) {
    logger.error('Error in adminGetReportHTML:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate report HTML',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
};

/**
 * POST /api/admin/reports/:id/email
 * Generate PDF and email to client with optional CC and additional message
 * 
 * Body:
 * - recipients: string | string[] (primary recipients, defaults to client email)
 * - cc?: string | string[] (optional CC recipients)
 * - additionalMessage?: string (optional additional information to include)
 * 
 * Business Rules:
 * - Admin only
 * - Emails PDF to specified recipients or client's registered email
 * - Updates emailed_at timestamp when sent
 * - Can be sent multiple times (emailed_at tracks last send)
 * - Creates notification for client
 */
export const adminEmailReportPDF = async (req: Request, res: Response) => {
  try {
    const reportId = parseInt(req.params.id);
    const { recipients, cc, additionalMessage } = req.body;

    if (isNaN(reportId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid report ID'
      });
    }

    // Get report and client details
    const report = await executeQuerySingle(`
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

    // Determine recipients
    let emailRecipients: string | string[];
    if (recipients) {
      emailRecipients = recipients;
    } else {
      // If no recipients provided, try to get primary contact email from client_contacts
      const primaryContact = await executeQuerySingle(`
        SELECT email FROM client_contacts 
        WHERE client_id = ? AND is_primary = 1 AND email IS NOT NULL
        LIMIT 1
      `, [report.client_id]);
      
      if (primaryContact?.email) {
        emailRecipients = primaryContact.email;
      } else {
        return res.status(400).json({
          success: false,
          message: 'No recipients specified and client has no email address on file'
        });
      }
    }

    // Validate email format
    const validateEmail = (email: string) => {
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

    logger.info(`Emailing PDF for report ${reportId} to ${JSON.stringify(emailRecipients)}`);

    // Generate PDF
    const pdfPath = await pdfService.generateReportPDF(reportId);

    // Send email with PDF attachment
    const emailSent = await sendReportEmail(
      emailRecipients,
      {
        reportId: report.id,
        reportType: report.report_type,
        clientName: report.company_name,
        serviceDate: new Date(report.service_date).toLocaleDateString('en-ZA'),
        pdfPath
      },
      {
        cc,
        additionalMessage
      }
    );

    if (!emailSent) {
      return res.status(500).json({
        success: false,
        message: 'Failed to send email. Please check email configuration.'
      });
    }

    // Update emailed_at timestamp
    await executeQuery(
      'UPDATE reports SET emailed_at = NOW() WHERE id = ?',
      [reportId]
    );

    // Create notification for admin
    const adminUsers = await executeQuery(
      'SELECT id FROM users WHERE role = ?',
      ['admin']
    );
    
    for (const admin of adminUsers as any[]) {
      await createNotification(
        admin.id,
        'system_update',
        'Report Emailed',
        `Report #${reportId} has been emailed to ${Array.isArray(emailRecipients) ? emailRecipients.join(', ') : emailRecipients}`
      );
    }

    logger.info(`PDF emailed successfully for report ${reportId}`);

    return res.json({
      success: true,
      message: 'Report emailed successfully',
      recipients: emailRecipients,
      cc: cc || null,
      emailed_at: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error in adminEmailReportPDF:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to email PDF',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
};

/**
 * Cleanup old draft reports
 * Deletes draft reports that are older than 30 days
 * This keeps the database clean and removes abandoned reports
 * 
 * Should be called:
 * - On server startup
 * - Daily via cron job or scheduler
 */
export const cleanupOldDrafts = async (): Promise<{ success: boolean; deletedCount: number; message: string }> => {
  try {
    logger.info('Starting cleanup of old draft reports (older than 30 days)');

    // Delete draft reports older than 30 days
    const result = await executeQuery<ResultSetHeader>(
      `DELETE FROM reports 
       WHERE status = 'draft' 
       AND created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)`,
      []
    );

    const deletedCount = (result as any).affectedRows || 0;

    if (deletedCount > 0) {
      logger.info(`Cleanup completed: Deleted ${deletedCount} old draft reports`);
    } else {
      logger.info('Cleanup completed: No old draft reports to delete');
    }

    return {
      success: true,
      deletedCount,
      message: `Deleted ${deletedCount} draft reports older than 30 days`
    };

  } catch (error) {
    logger.error('Error in cleanupOldDrafts:', error);
    return {
      success: false,
      deletedCount: 0,
      message: 'Failed to cleanup old drafts'
    };
  }
};



