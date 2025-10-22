import { Request, Response } from 'express';
import { hasRole } from '../middleware/auth';
import { pool } from '../config/database';
import { RowDataPacket } from 'mysql2';

// ========================================
// PHASE 4.1: PCO DASHBOARD ENDPOINTS
// ========================================
// Purpose: Mobile app home screen - metrics, activity, quick actions
// Reference: workflow.md - PCO Dashboard section

/**
 * GET /api/pco/dashboard/summary
 * Main dashboard - all key metrics in one call
 * Returns: assigned clients, pending/declined/draft reports, performance metrics
 */
export const getDashboardSummary = async (req: Request, res: Response): Promise<any> => {
  try {
    const pcoId = req.user!.id;

    // 🔥 TEST MARKER - If you see this message, NEW CODE IS RUNNING! 🔥
    console.log('🔥🔥🔥 NEW CODE LOADED - TEST MARKER 2024 🔥🔥🔥');
    
    // Get all metrics in parallel for performance
    const [metricsResult, performanceResult] = await Promise.all([
      // Basic counts query
      pool.query<RowDataPacket[]>(`
        SELECT 
          (SELECT COUNT(*) FROM client_pco_assignments 
           WHERE pco_id = ? AND status = 'active') as assigned_clients_count,
          
          (SELECT COUNT(*) FROM reports 
           WHERE pco_id = ? AND status = 'pending') as pending_reports_count,
          
          (SELECT COUNT(*) FROM reports 
           WHERE pco_id = ? AND status = 'draft' AND admin_notes IS NOT NULL) as declined_reports_count,
          
          (SELECT COUNT(*) FROM reports 
           WHERE pco_id = ? AND status = 'draft' AND admin_notes IS NULL) as draft_reports_count,
          
          (SELECT COUNT(*) FROM reports 
           WHERE pco_id = ? AND status = 'approved') as total_reports_completed,
          
          (SELECT COUNT(*) FROM reports 
           WHERE pco_id = ? AND status = 'approved' 
           AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)) as reports_this_month,
          
          (SELECT COUNT(*) FROM reports 
           WHERE pco_id = ? AND status = 'approved' 
           AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) as reports_this_week,
          
          (SELECT MAX(service_date) FROM reports 
           WHERE pco_id = ? AND status = 'approved') as last_report_date,
          
          (SELECT COUNT(DISTINCT r.client_id) 
           FROM reports r
           WHERE r.pco_id = ?
           AND r.next_service_date IS NOT NULL
           AND r.next_service_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)
           AND r.status = 'approved') as upcoming_services
      `, [pcoId, pcoId, pcoId, pcoId, pcoId, pcoId, pcoId, pcoId, pcoId]),

      // Performance metrics query (last 30 days)
      pool.query<RowDataPacket[]>(`
        SELECT 
          AVG(TIMESTAMPDIFF(HOUR, submitted_at, reviewed_at)) as avg_completion_hours,
          (SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) / COUNT(*) * 100) as approval_rate,
          (COUNT(*) / 4.29) as reports_per_week_avg
        FROM reports
        WHERE pco_id = ?
          AND submitted_at IS NOT NULL
          AND reviewed_at IS NOT NULL
          AND submitted_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      `, [pcoId])
    ]);

    const metrics = metricsResult[0][0];
    const performance = performanceResult[0][0];

    // Calculate average completion time in days
    const avgCompletionHours = performance.avg_completion_hours || 0;
    const avgCompletionDays = avgCompletionHours > 0 
      ? parseFloat((avgCompletionHours / 24).toFixed(1)) 
      : 0;

    // Safe formatting for performance metrics
    const approvalRatePercent = performance.approval_rate != null
      ? parseFloat(parseFloat(performance.approval_rate).toFixed(1)) 
      : 0;
    const reportsPerWeekAvg = performance.reports_per_week_avg != null
      ? parseFloat(parseFloat(performance.reports_per_week_avg).toFixed(1)) 
      : 0;

    res.json({
      success: true,
      test_marker: '🔥 NEW CODE ACTIVE - Build 2024-10-14 🔥',
      data: {
        assigned_clients_count: metrics.assigned_clients_count,
        pending_reports_count: metrics.pending_reports_count,
        declined_reports_count: metrics.declined_reports_count,
        draft_reports_count: metrics.draft_reports_count,
        total_reports_completed: metrics.total_reports_completed,
        reports_this_month: metrics.reports_this_month,
        reports_this_week: metrics.reports_this_week,
        last_report_date: metrics.last_report_date,
        upcoming_services: metrics.upcoming_services,
        performance_metrics: {
          average_completion_time_days: avgCompletionDays,
          approval_rate_percent: approvalRatePercent,
          reports_per_week_average: reportsPerWeekAvg
        }
      }
    });

  } catch (error) {
    console.error('Error fetching dashboard summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard summary',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * GET /api/pco/dashboard/upcoming-assignments
 * Show clients needing service soon
 * Query params: days_ahead (default 7), limit (default 10)
 */
export const getUpcomingAssignments = async (req: Request, res: Response): Promise<any> => {
  try {
    const pcoId = req.user!.id;
    const daysAhead = parseInt(req.query.days_ahead as string) || 7;
    const limit = parseInt(req.query.limit as string) || 10;

    // Validate parameters
    if (daysAhead < 1 || daysAhead > 90) {
      return res.status(400).json({
        success: false,
        message: 'days_ahead must be between 1 and 90'
      });
    }

    if (limit < 1 || limit > 50) {
      return res.status(400).json({
        success: false,
        message: 'limit must be between 1 and 50'
      });
    }

    const [assignments] = await pool.query<RowDataPacket[]>(`
      SELECT 
        c.id as client_id,
        c.company_name,
        c.city,
        r_last.next_service_date,
        DATEDIFF(r_last.next_service_date, CURDATE()) as days_until_service,
        'bi_weekly' as service_frequency,
        EXISTS(
          SELECT 1 FROM reports 
          WHERE client_id = c.id 
            AND pco_id = ? 
            AND status = 'draft'
        ) as has_draft,
        r_last.service_date as last_service_date,
        CASE
          WHEN DATEDIFF(r_last.next_service_date, CURDATE()) <= 1 THEN 'urgent'
          WHEN DATEDIFF(r_last.next_service_date, CURDATE()) <= 3 THEN 'high'
          ELSE 'normal'
        END as priority
      FROM clients c
      JOIN client_pco_assignments ca ON c.id = ca.client_id
      LEFT JOIN (
        SELECT client_id, service_date, next_service_date
        FROM reports
        WHERE status = 'approved' AND pco_id = ?
        GROUP BY client_id
        HAVING service_date = MAX(service_date)
      ) r_last ON c.id = r_last.client_id
      WHERE ca.pco_id = ?
        AND ca.status = 'active'
        AND r_last.next_service_date IS NOT NULL
        AND r_last.next_service_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
      ORDER BY days_until_service ASC, priority DESC
      LIMIT ?
    `, [pcoId, pcoId, pcoId, daysAhead, limit]);

    // Get total count for pagination
    const [countResult] = await pool.query<RowDataPacket[]>(`
      SELECT COUNT(DISTINCT c.id) as total
      FROM clients c
      JOIN client_pco_assignments ca ON c.id = ca.client_id
      LEFT JOIN (
        SELECT client_id, service_date, next_service_date
        FROM reports
        WHERE status = 'approved' AND pco_id = ?
        GROUP BY client_id
        HAVING service_date = MAX(service_date)
      ) r_last ON c.id = r_last.client_id
      WHERE ca.pco_id = ?
        AND ca.status = 'active'
        AND r_last.next_service_date IS NOT NULL
        AND r_last.next_service_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
    `, [pcoId, pcoId, daysAhead]);

    res.json({
      success: true,
      data: {
        assignments: assignments.map(a => ({
          client_id: a.client_id,
          company_name: a.company_name,
          city: a.city,
          last_service_date: a.last_service_date,
          next_service_date: a.next_service_date,
          days_until_service: a.days_until_service,
          service_frequency: a.service_frequency,
          has_draft: !!a.has_draft,
          priority: a.priority
        })),
        total_upcoming: countResult[0].total
      }
    });

  } catch (error) {
    console.error('Error fetching upcoming assignments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch upcoming assignments',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * GET /api/pco/dashboard/recent-reports
 * Recent activity and quick access to reports
 * Query params: limit (default 10), status (optional filter)
 */
export const getRecentReports = async (req: Request, res: Response): Promise<any> => {
  try {
    const pcoId = req.user!.id;
    const limit = parseInt(req.query.limit as string) || 10;
    const statusFilter = req.query.status as string;

    // Validate parameters
    if (limit < 1 || limit > 50) {
      return res.status(400).json({
        success: false,
        message: 'limit must be between 1 and 50'
      });
    }

    const validStatuses = ['draft', 'pending', 'approved', 'declined'];
    if (statusFilter && !validStatuses.includes(statusFilter)) {
      return res.status(400).json({
        success: false,
        message: `status must be one of: ${validStatuses.join(', ')}`
      });
    }

    // Build query with optional status filter
    let statusCondition = '';
    const queryParams: any[] = [pcoId];

    if (statusFilter) {
      // Handle 'declined' status (draft with admin_notes)
      if (statusFilter === 'declined') {
        statusCondition = "AND r.status = 'draft' AND r.admin_notes IS NOT NULL";
      } else {
        statusCondition = 'AND r.status = ?';
        queryParams.push(statusFilter);
      }
    }

    queryParams.push(limit);

    const [reports] = await pool.query<RowDataPacket[]>(`
      SELECT 
        r.id,
        r.client_id,
        c.company_name,
        r.report_type,
        r.service_date,
        r.status,
        r.created_at,
        r.submitted_at,
        r.admin_notes IS NOT NULL as has_admin_notes,
        (SELECT COUNT(*) FROM bait_stations 
         WHERE report_id = r.id) as bait_stations_count,
        (SELECT COUNT(*) FROM fumigation_areas 
         WHERE report_id = r.id) as fumigation_areas_count
      FROM reports r
      JOIN clients c ON r.client_id = c.id
      WHERE r.pco_id = ?
        ${statusCondition}
      ORDER BY r.created_at DESC
      LIMIT ?
    `, queryParams);

    // Get total count
    const countParams: any[] = [pcoId];
    if (statusFilter) {
      if (statusFilter !== 'declined') {
        countParams.push(statusFilter);
      }
    }

    const [countResult] = await pool.query<RowDataPacket[]>(`
      SELECT COUNT(*) as total
      FROM reports r
      WHERE r.pco_id = ?
        ${statusCondition}
    `.replace('LIMIT ?', ''), countParams);

    res.json({
      success: true,
      data: {
        reports: reports.map(r => ({
          id: r.id,
          client_id: r.client_id,
          company_name: r.company_name,
          report_type: r.report_type,
          service_date: r.service_date,
          status: r.status,
          created_at: r.created_at,
          submitted_at: r.submitted_at,
          has_admin_notes: !!r.has_admin_notes,
          bait_stations_count: r.bait_stations_count,
          fumigation_areas_count: r.fumigation_areas_count
        })),
        total_count: countResult[0].total
      }
    });

  } catch (error) {
    console.error('Error fetching recent reports:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recent reports',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * GET /api/pco/dashboard/declined-reports
 * Reports requiring revision (declined by admin)
 * These are drafts with admin_notes
 */
export const getDeclinedReports = async (req: Request, res: Response): Promise<any> => {
  try {
    const pcoId = req.user!.id;

    const [reports] = await pool.query<RowDataPacket[]>(`
      SELECT 
        r.id,
        r.client_id,
        c.company_name,
        r.service_date,
        r.reviewed_at as declined_at,
        r.admin_notes,
        u.name as reviewed_by_name,
        DATEDIFF(NOW(), r.reviewed_at) as days_since_declined,
        CASE
          WHEN DATEDIFF(NOW(), r.reviewed_at) > 3 THEN 'urgent'
          WHEN DATEDIFF(NOW(), r.reviewed_at) >= 2 THEN 'high'
          ELSE 'normal'
        END as priority
      FROM reports r
      JOIN clients c ON r.client_id = c.id
      LEFT JOIN users u ON r.reviewed_by = u.id
      WHERE r.pco_id = ?
        AND r.status = 'draft'
        AND r.admin_notes IS NOT NULL
      ORDER BY r.reviewed_at ASC
    `, [pcoId]);

    res.json({
      success: true,
      data: {
        declined_reports: reports.map(r => ({
          id: r.id,
          client_id: r.client_id,
          company_name: r.company_name,
          service_date: r.service_date,
          declined_at: r.declined_at,
          admin_notes: r.admin_notes,
          reviewed_by_name: r.reviewed_by_name,
          days_since_declined: r.days_since_declined,
          priority: r.priority
        })),
        total_declined: reports.length
      }
    });

  } catch (error) {
    console.error('Error fetching declined reports:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch declined reports',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * GET /api/pco/dashboard/statistics
 * Detailed performance statistics and trends
 * Query params: period (default 30) - days to analyze
 */
export const getStatistics = async (req: Request, res: Response): Promise<any> => {
  try {
    const pcoId = req.user!.id;
    const period = parseInt(req.query.period as string) || 30;

    // Validate parameter
    if (period < 1 || period > 365) {
      return res.status(400).json({
        success: false,
        message: 'period must be between 1 and 365 days'
      });
    }

    // Get comprehensive statistics
    const [statsResult] = await pool.query<RowDataPacket[]>(`
      SELECT 
        COUNT(*) as reports_submitted,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as reports_approved,
        SUM(CASE WHEN status = 'draft' AND admin_notes IS NOT NULL THEN 1 ELSE 0 END) as reports_declined,
        AVG(TIMESTAMPDIFF(HOUR, submitted_at, reviewed_at)) as avg_turnaround_hours,
        COUNT(DISTINCT client_id) as clients_serviced,
        SUM(CASE WHEN report_type = 'bait_inspection' THEN 1 ELSE 0 END) as bait_inspection_count,
        SUM(CASE WHEN report_type = 'fumigation' THEN 1 ELSE 0 END) as fumigation_count,
        SUM(CASE WHEN report_type = 'both' THEN 1 ELSE 0 END) as both_count
      FROM reports
      WHERE pco_id = ?
        AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
    `, [pcoId, period]);

    const stats = statsResult[0];

    // Calculate approval rate
    const approvalRate = stats.reports_submitted > 0
      ? parseFloat(((stats.reports_approved / stats.reports_submitted) * 100).toFixed(2))
      : 0;

    // Get most serviced client
    const [topClientResult] = await pool.query<RowDataPacket[]>(`
      SELECT 
        c.company_name,
        COUNT(*) as report_count
      FROM reports r
      JOIN clients c ON r.client_id = c.id
      WHERE r.pco_id = ?
        AND r.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY r.client_id, c.company_name
      ORDER BY report_count DESC
      LIMIT 1
    `, [pcoId, period]);

    const topClient = topClientResult.length > 0 ? topClientResult[0] : null;

    // Get monthly trend (last 6 months)
    const [trendResult] = await pool.query<RowDataPacket[]>(`
      SELECT 
        DATE_FORMAT(created_at, '%Y-%m') as month,
        COUNT(*) as reports,
        (SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) / COUNT(*) * 100) as approval_rate
      FROM reports
      WHERE pco_id = ?
        AND created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      GROUP BY DATE_FORMAT(created_at, '%Y-%m')
      ORDER BY month DESC
      LIMIT 6
    `, [pcoId]);

    res.json({
      success: true,
      data: {
        period_days: period,
        reports_submitted: stats.reports_submitted,
        reports_approved: stats.reports_approved,
        reports_declined: stats.reports_declined,
        approval_rate: approvalRate,
        average_turnaround_hours: stats.avg_turnaround_hours != null ? parseFloat(parseFloat(stats.avg_turnaround_hours).toFixed(1)) : 0,
        clients_serviced: stats.clients_serviced,
        most_serviced_client: topClient ? {
          company_name: topClient.company_name,
          report_count: topClient.report_count
        } : null,
        report_types: {
          bait_inspection: stats.bait_inspection_count,
          fumigation: stats.fumigation_count,
          both: stats.both_count
        },
        monthly_trend: trendResult.map(t => ({
          month: t.month,
          reports: t.reports,
          approval_rate: t.approval_rate != null ? parseFloat(parseFloat(t.approval_rate).toFixed(2)) : 0
        }))
      }
    });

  } catch (error) {
    console.error('Error fetching dashboard statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard statistics',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
