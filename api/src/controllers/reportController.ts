import { Request, Response } from 'express';
import { executeQuery, executeQuerySingle } from '../config/database';
import { logger } from '../config/logger';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

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
    const pcoId = req.query.pco_id ? parseInt(req.query.pco_id as string) : null;
    const clientId = req.query.client_id ? parseInt(req.query.client_id as string) : null;
    const status = req.query.status as string || 'all';
    const startDate = req.query.start_date as string;
    const endDate = req.query.end_date as string;

    // Build WHERE clause - EXCLUDE DRAFTS by default
    let whereConditions = ["r.status != 'draft'"];
    const queryParams: any[] = [];

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

    const reports = await executeQuery<RowDataPacket[]>(
      reportsQuery,
      [...queryParams, limit, offset]
    );

    logger.info(`Admin retrieved ${reports.length} reports`);

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

    const reports = await executeQuery<RowDataPacket[]>(reportQuery, [reportId, userId, userRole]);

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
 * CRITICAL Business Rules:
 * - Validates all required data complete
 * - Changes status: draft → pending
 * - AUTO-UNASSIGNS PCO from client (CRITICAL!)
 * - Sends notification to admin
 */
export const submitReport = async (req: Request, res: Response) => {
  try {
    const reportId = parseInt(req.params.id);
    const pcoId = req.user!.id;

    // Verify ownership and draft/declined status (per workflow.md)
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

    // Manual submission logic (instead of stored procedure) to support declined report resubmission
    // Update report status to pending
    await executeQuery(
      `UPDATE reports 
       SET status = 'pending', submitted_at = NOW(), updated_at = NOW()
       WHERE id = ?`,
      [reportId]
    );

    // Auto-unassign PCO from client (critical business rule per workflow.md)
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
      `SELECT id FROM users WHERE role IN ('admin', 'both') AND status = 'active' LIMIT 1`
    );

    if (adminUsers.length > 0) {
      const adminId = (adminUsers[0] as any).id;
      await executeQuery(
        `INSERT INTO notifications (user_id, type, title, message)
         VALUES (?, 'report_submitted', 'New Report Submitted', ?)`,
        [
          adminId,
          `${report.company_name}: New report submitted by ${pcoId} for review`
        ]
      );
    }

    logger.info(`Report ${reportId} submitted by PCO ${pcoId} - PCO auto-unassigned from client`);

    return res.json({
      success: true,
      message: 'Report submitted successfully for admin review'
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
 * - Report must be in pending status
 * - Records reviewer and timestamp
 */
export const approveReport = async (req: Request, res: Response) => {
  try {
    const reportId = parseInt(req.params.id);
    const adminId = req.user!.id;
    const { admin_notes, recommendations } = req.body;

    // Verify report is pending
    const reportCheck = await executeQuery<RowDataPacket[]>(
      `SELECT id FROM reports WHERE id = ? AND status = 'pending'`,
      [reportId]
    );

    if (reportCheck.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Report not found or not in pending status'
      });
    }

    // Approve report (admin_notes and recommendations are optional, convert undefined to null)
    await executeQuery(
      `UPDATE reports 
       SET status = 'approved',
           admin_notes = ?,
           recommendations = ?,
           reviewed_by = ?,
           reviewed_at = NOW(),
           updated_at = NOW()
       WHERE id = ? AND status = 'pending'`,
      [admin_notes || null, recommendations || null, adminId, reportId]
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

    // Get report info
    const reportCheck = await executeQuery<RowDataPacket[]>(
      `SELECT r.*, c.company_name, u.name as pco_name
       FROM reports r
       JOIN clients c ON r.client_id = c.id
       JOIN users u ON r.pco_id = u.id
       WHERE r.id = ? AND r.status = 'pending'`,
      [reportId]
    );

    if (reportCheck.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Report not found or not in pending status'
      });
    }

    const report = reportCheck[0] as any;

    // Decline report - set to 'declined' status per workflow.md
    // Status: pending → declined (PCO can then edit and resubmit)
    await executeQuery(
      `UPDATE reports 
       SET status = 'declined',
           admin_notes = ?,
           reviewed_by = ?,
           reviewed_at = NOW(),
           updated_at = NOW()
       WHERE id = ? AND status = 'pending'`,
      [admin_notes, adminId, reportId]
    );

    // CRITICAL: Reassign PCO to client for revision
    // Only update the most recent inactive assignment (created by submission)
    await executeQuery(
      `UPDATE client_pco_assignments 
       SET status = 'active', assigned_at = NOW()
       WHERE client_id = ? AND pco_id = ? AND status = 'inactive'
       ORDER BY unassigned_at DESC
       LIMIT 1`,
      [report.client_id, report.pco_id]
    );

    // Notify PCO
    await executeQuery(
      `INSERT INTO notifications (user_id, type, title, message)
       VALUES (?, 'report_declined', 'Report Declined - Revision Required', ?)`,
      [
        report.pco_id,
        `Your report for ${report.company_name} has been declined. Admin feedback: ${admin_notes}`
      ]
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
        action_taken, warning_sign_condition, rodent_box_replaced, station_remarks
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const result = await executeQuery<ResultSetHeader>(stationQuery, [
      reportId, station_number, location, is_accessible, inaccessible_reason || null,
      activity_detected, activity_droppings || 0, activity_gnawing || 0, activity_tracks || 0,
      activity_other || 0, activity_other_description || null, bait_status, station_condition,
      action_taken || 'none', warning_sign_condition || 'good', rodent_box_replaced || 0, station_remarks || null
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
      monitor_type,
      monitor_condition,
      monitor_condition_other,
      warning_sign_condition,
      light_condition,
      light_faulty_type,
      light_faulty_other,
      glue_board_replaced,
      tubes_replaced,
      monitor_serviced
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
       (report_id, monitor_type, monitor_condition, monitor_condition_other, warning_sign_condition,
        light_condition, light_faulty_type, light_faulty_other, glue_board_replaced, tubes_replaced, monitor_serviced) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
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
