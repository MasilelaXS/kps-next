/**
 * Admin Dashboard Controller
 * Phase 5.1 - Admin Portal Dashboard & Analytics
 * 
 * Handles:
 * - Dashboard metrics (counts, totals, trends)
 * - Activity monitoring (recent actions, logs)
 * - Statistics (performance, trends, analytics)
 * - Performance metrics (response times, success rates)
 * - Cache management (refresh dashboard data)
 * 
 * Caching Strategy:
 * - Metrics: 15 minutes TTL (frequently changing data)
 * - Stats: 60 minutes TTL (slower changing aggregates)
 * - Performance: 30 minutes TTL (moderate change rate)
 * - Manual refresh clears all dashboard cache
 */

import { Request, Response } from 'express';
import { executeQuery, executeQuerySingle } from '../config/database';
import { RowDataPacket } from 'mysql2';
import { logger } from '../config/logger';

// Simple in-memory cache (for production, use Redis)
interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

const dashboardCache: Map<string, CacheEntry> = new Map();

/**
 * Helper function to get cached data or execute query
 */
const getCachedData = async (
  cacheKey: string,
  ttl: number,
  dataFetcher: () => Promise<any>
): Promise<any> => {
  const cached = dashboardCache.get(cacheKey);
  const now = Date.now();

  // Return cached data if valid
  if (cached && (now - cached.timestamp) < cached.ttl) {
    logger.debug(`Cache HIT for ${cacheKey}`);
    return cached.data;
  }

  // Fetch fresh data
  logger.debug(`Cache MISS for ${cacheKey}, fetching fresh data`);
  const data = await dataFetcher();

  // Store in cache
  dashboardCache.set(cacheKey, {
    data,
    timestamp: now,
    ttl
  });

  return data;
};

/**
 * GET /api/admin/dashboard/metrics
 * Core dashboard metrics with counts and totals
 * 
 * Returns:
 * - Total users (PCO count, Admin count)
 * - Total clients (active, inactive)
 * - Total reports (by status)
 * - Active assignments count
 * - Chemicals count
 * 
 * Cache: 15 minutes
 */
export const getMetrics = async (req: Request, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const metrics = await getCachedData(
      'dashboard:metrics',
      15 * 60 * 1000, // 15 minutes
      async () => {
        // Total users by role
        const userCounts = await executeQuery<RowDataPacket[]>(
          `SELECT 
            role,
            status,
            COUNT(*) as count
          FROM users
          WHERE deleted_at IS NULL
          GROUP BY role, status`
        );

        // Total clients by status
        const clientCounts = await executeQuery<RowDataPacket[]>(
          `SELECT 
            status,
            COUNT(*) as count
          FROM clients
          WHERE deleted_at IS NULL
          GROUP BY status`
        );

        // Total reports by status
        const reportCounts = await executeQuery<RowDataPacket[]>(
          `SELECT 
            status,
            COUNT(*) as count
          FROM reports
          WHERE status != 'archived'
          GROUP BY status`
        );

        // Active assignments
        const activeAssignments = await executeQuerySingle<RowDataPacket>(
          `SELECT COUNT(*) as count
          FROM client_pco_assignments
          WHERE status = 'active'`
        );

        // Total chemicals
        const chemicalCount = await executeQuerySingle<RowDataPacket>(
          `SELECT COUNT(*) as count
          FROM chemicals
          WHERE deleted_at IS NULL`
        );

        // Recent activity (last 24 hours)
        const recentReports = await executeQuerySingle<RowDataPacket>(
          `SELECT COUNT(*) as count
          FROM reports
          WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)`
        );

        const recentAssignments = await executeQuerySingle<RowDataPacket>(
          `SELECT COUNT(*) as count
          FROM client_pco_assignments
          WHERE assigned_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)`
        );

        // Process user counts
        const users = {
          total: 0,
          pco: { active: 0, inactive: 0, total: 0 },
          admin: { active: 0, inactive: 0, total: 0 }
        };

        userCounts.forEach((row: any) => {
          const count = parseInt(row.count);
          users.total += count;

          if (row.role === 'pco') {
            users.pco.total += count;
            if (row.status === 'active') users.pco.active = count;
            else users.pco.inactive = count;
          } else if (row.role === 'admin') {
            users.admin.total += count;
            if (row.status === 'active') users.admin.active = count;
            else users.admin.inactive = count;
          }
        });

        // Process client counts
        const clients = {
          total: 0,
          active: 0,
          inactive: 0,
          suspended: 0
        };

        clientCounts.forEach((row: any) => {
          const count = parseInt(row.count);
          clients.total += count;
          if (row.status === 'active') clients.active = count;
          else if (row.status === 'inactive') clients.inactive = count;
          else if (row.status === 'suspended') clients.suspended = count;
        });

        // Process report counts
        const reports = {
          total: 0,
          draft: 0,
          pending: 0,
          approved: 0,
          declined: 0
        };

        reportCounts.forEach((row: any) => {
          const count = parseInt(row.count);
          reports.total += count;
          if (row.status === 'draft') reports.draft = count;
          else if (row.status === 'pending') reports.pending = count;
          else if (row.status === 'approved') reports.approved = count;
          else if (row.status === 'declined') reports.declined = count;
        });

        return {
          users,
          clients,
          reports,
          assignments: {
            active: parseInt((activeAssignments as any)?.count || 0)
          },
          chemicals: {
            total: parseInt((chemicalCount as any)?.count || 0)
          },
          recent_activity: {
            reports_24h: parseInt((recentReports as any)?.count || 0),
            assignments_24h: parseInt((recentAssignments as any)?.count || 0)
          },
          cache_info: {
            cached_at: new Date().toISOString(),
            ttl_minutes: 15
          }
        };
      }
    );

    return res.json({
      success: true,
      data: metrics
    });

  } catch (error) {
    logger.error('Error in getMetrics:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve dashboard metrics',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
};

/**
 * GET /api/admin/dashboard/activity
 * Recent activity log and timeline
 * 
 * Query params:
 * - limit (default: 20, max: 100)
 * - activity_type (users, clients, reports, assignments, all)
 * 
 * Returns:
 * - Recent user registrations
 * - Recent client additions
 * - Recent report submissions
 * - Recent assignments
 * 
 * Cache: None (real-time data)
 */
export const getActivity = async (req: Request, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const activityType = (req.query.activity_type as string) || 'all';

    const activities: any[] = [];

    // Recent users
    if (activityType === 'all' || activityType === 'users') {
      const recentUsers = await executeQuery<RowDataPacket[]>(
        `SELECT id, name, email, pco_number, role, status, created_at
         FROM users
         WHERE deleted_at IS NULL
         ORDER BY created_at DESC
         LIMIT ?`,
        [limit]
      );

      recentUsers.forEach((user: any) => {
        activities.push({
          type: 'user_created',
          timestamp: user.created_at,
          data: {
            user_id: user.id,
            name: user.name,
            role: user.role,
            pco_number: user.pco_number,
            status: user.status
          }
        });
      });
    }

    // Recent clients
    if (activityType === 'all' || activityType === 'clients') {
      const recentClients = await executeQuery<RowDataPacket[]>(
        `SELECT id, company_name, city, status, created_at
         FROM clients
         WHERE deleted_at IS NULL
         ORDER BY created_at DESC
         LIMIT ?`,
        [limit]
      );

      recentClients.forEach((client: any) => {
        activities.push({
          type: 'client_created',
          timestamp: client.created_at,
          data: {
            client_id: client.id,
            company_name: client.company_name,
            city: client.city,
            status: client.status
          }
        });
      });
    }

    // Recent reports
    if (activityType === 'all' || activityType === 'reports') {
      const recentReports = await executeQuery<RowDataPacket[]>(
        `SELECT 
          r.id,
          r.client_id,
          r.pco_id,
          r.report_type,
          r.status,
          r.submitted_at,
          r.reviewed_at,
          c.company_name as client_name,
          u.name as pco_name
         FROM reports r
         JOIN clients c ON r.client_id = c.id
         JOIN users u ON r.pco_id = u.id
         WHERE r.status != 'draft' AND r.status != 'archived'
         ORDER BY COALESCE(r.reviewed_at, r.submitted_at, r.created_at) DESC
         LIMIT ?`,
        [limit]
      );

      recentReports.forEach((report: any) => {
        activities.push({
          type: report.reviewed_at ? 'report_reviewed' : 'report_submitted',
          timestamp: report.reviewed_at || report.submitted_at,
          data: {
            report_id: report.id,
            client_name: report.client_name,
            pco_name: report.pco_name,
            report_type: report.report_type,
            status: report.status
          }
        });
      });
    }

    // Recent assignments
    if (activityType === 'all' || activityType === 'assignments') {
      const recentAssignments = await executeQuery<RowDataPacket[]>(
        `SELECT 
          cpa.id,
          cpa.client_id,
          cpa.pco_id,
          cpa.assigned_at,
          cpa.status,
          c.company_name as client_name,
          u.name as pco_name
         FROM client_pco_assignments cpa
         JOIN clients c ON cpa.client_id = c.id
         JOIN users u ON cpa.pco_id = u.id
         ORDER BY cpa.assigned_at DESC
         LIMIT ?`,
        [limit]
      );

      recentAssignments.forEach((assignment: any) => {
        activities.push({
          type: assignment.status === 'active' ? 'assignment_created' : 'assignment_ended',
          timestamp: assignment.assigned_at,
          data: {
            assignment_id: assignment.id,
            client_name: assignment.client_name,
            pco_name: assignment.pco_name,
            status: assignment.status
          }
        });
      });
    }

    // Sort all activities by timestamp (most recent first)
    activities.sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return timeB - timeA;
    });

    // Limit to requested count
    const limitedActivities = activities.slice(0, limit);

    return res.json({
      success: true,
      data: {
        activities: limitedActivities,
        count: limitedActivities.length,
        filter: activityType
      }
    });

  } catch (error) {
    logger.error('Error in getActivity:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve activity log',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
};

/**
 * GET /api/admin/dashboard/stats
 * Statistical analytics and trends
 * 
 * Query params:
 * - period (7d, 30d, 90d, 1y) - default: 30d
 * 
 * Returns:
 * - Report submission trends
 * - Approval rate trends
 * - Average turnaround time
 * - PCO performance distribution
 * - Client activity levels
 * 
 * Cache: 60 minutes
 */
export const getStats = async (req: Request, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    let period = (req.query.period as string) || '30d';
    
    // Validate and normalize period
    const validPeriods = ['7d', '30d', '90d', '1y'];
    if (!validPeriods.includes(period)) {
      period = '30d'; // Default to 30d for invalid periods
    }
    
    const cacheKey = `dashboard:stats:${period}`;

    const stats = await getCachedData(
      cacheKey,
      60 * 60 * 1000, // 60 minutes
      async () => {
        // Determine date range
        let daysBack = 30;
        if (period === '7d') daysBack = 7;
        else if (period === '30d') daysBack = 30;
        else if (period === '90d') daysBack = 90;
        else if (period === '1y') daysBack = 365;

        // Report trends by day
        const reportTrends = await executeQuery<RowDataPacket[]>(
          `SELECT 
            DATE(submitted_at) as date,
            COUNT(*) as count,
            status
          FROM reports
          WHERE submitted_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            AND status IN ('pending', 'approved', 'declined')
          GROUP BY DATE(submitted_at), status
          ORDER BY date DESC`,
          [daysBack]
        );

        // Approval rates
        const approvalStats = await executeQuerySingle<RowDataPacket>(
          `SELECT 
            COUNT(*) as total_reviewed,
            SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_count,
            SUM(CASE WHEN status = 'declined' THEN 1 ELSE 0 END) as declined_count,
            ROUND(AVG(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) * 100, 2) as approval_rate
          FROM reports
          WHERE reviewed_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            AND status IN ('approved', 'declined')`,
          [daysBack]
        );

        // Average turnaround time (submission to review)
        const turnaroundStats = await executeQuerySingle<RowDataPacket>(
          `SELECT 
            COUNT(*) as reviewed_reports,
            ROUND(AVG(TIMESTAMPDIFF(HOUR, submitted_at, reviewed_at)), 2) as avg_hours,
            ROUND(MIN(TIMESTAMPDIFF(HOUR, submitted_at, reviewed_at)), 2) as min_hours,
            ROUND(MAX(TIMESTAMPDIFF(HOUR, submitted_at, reviewed_at)), 2) as max_hours
          FROM reports
          WHERE reviewed_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            AND submitted_at IS NOT NULL
            AND reviewed_at IS NOT NULL`,
          [daysBack]
        );

        // PCO performance distribution
        const pcoPerformance = await executeQuery<RowDataPacket[]>(
          `SELECT 
            u.id as pco_id,
            u.name as pco_name,
            u.pco_number,
            COUNT(r.id) as total_reports,
            SUM(CASE WHEN r.status = 'approved' THEN 1 ELSE 0 END) as approved_reports,
            SUM(CASE WHEN r.status = 'declined' THEN 1 ELSE 0 END) as declined_reports,
            ROUND(AVG(CASE WHEN r.status = 'approved' THEN 1 ELSE 0 END) * 100, 2) as approval_rate,
            COUNT(DISTINCT cpa.client_id) as active_clients
          FROM users u
          LEFT JOIN reports r ON u.id = r.pco_id 
            AND r.submitted_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            AND r.status IN ('approved', 'declined')
          LEFT JOIN client_pco_assignments cpa ON u.id = cpa.pco_id
            AND cpa.status = 'active'
          WHERE u.role = 'pco' 
            AND u.status = 'active'
            AND u.deleted_at IS NULL
          GROUP BY u.id, u.name, u.pco_number
          HAVING total_reports > 0
          ORDER BY total_reports DESC
          LIMIT 10`,
          [daysBack]
        );

        // Client activity levels
        const clientActivity = await executeQuery<RowDataPacket[]>(
          `SELECT 
            c.id as client_id,
            c.company_name,
            c.city,
            COUNT(r.id) as report_count,
            MAX(r.service_date) as last_service_date
          FROM clients c
          LEFT JOIN reports r ON c.id = r.client_id
            AND r.service_date >= DATE_SUB(NOW(), INTERVAL ? DAY)
            AND r.status != 'archived'
          WHERE c.deleted_at IS NULL
            AND c.status = 'active'
          GROUP BY c.id, c.company_name, c.city
          ORDER BY report_count DESC
          LIMIT 10`,
          [daysBack]
        );

        return {
          period: {
            label: period,
            days: daysBack,
            start_date: new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            end_date: new Date().toISOString().split('T')[0]
          },
          report_trends: reportTrends,
          approval_stats: {
            total_reviewed: parseInt((approvalStats as any)?.total_reviewed || 0),
            approved: parseInt((approvalStats as any)?.approved_count || 0),
            declined: parseInt((approvalStats as any)?.declined_count || 0),
            approval_rate: parseFloat((approvalStats as any)?.approval_rate || 0)
          },
          turnaround_time: {
            reviewed_reports: parseInt((turnaroundStats as any)?.reviewed_reports || 0),
            avg_hours: parseFloat((turnaroundStats as any)?.avg_hours || 0),
            min_hours: parseFloat((turnaroundStats as any)?.min_hours || 0),
            max_hours: parseFloat((turnaroundStats as any)?.max_hours || 0)
          },
          top_pcos: pcoPerformance,
          top_clients: clientActivity,
          cache_info: {
            cached_at: new Date().toISOString(),
            ttl_minutes: 60
          }
        };
      }
    );

    return res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error('Error in getStats:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve dashboard statistics',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
};

/**
 * GET /api/admin/dashboard/performance
 * System performance metrics
 * 
 * Returns:
 * - Database query performance
 * - API response time averages
 * - Error rates
 * - Active sessions
 * - System health indicators
 * 
 * Cache: 30 minutes
 */
export const getPerformance = async (req: Request, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const performance = await getCachedData(
      'dashboard:performance',
      30 * 60 * 1000, // 30 minutes
      async () => {
        // Active sessions
        const activeSessions = await executeQuerySingle<RowDataPacket>(
          `SELECT COUNT(*) as count
          FROM user_sessions
          WHERE expires_at > NOW()`
        );

        // Recent failed logins
        const failedLogins = await executeQuerySingle<RowDataPacket>(
          `SELECT COUNT(*) as count
          FROM login_attempts
          WHERE attempt_time >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
            AND success = 0`
        );

        // Locked accounts
        const lockedAccounts = await executeQuerySingle<RowDataPacket>(
          `SELECT COUNT(*) as count
          FROM users
          WHERE locked_until > NOW()
            AND deleted_at IS NULL`
        );

        // Database size (approximate)
        const dbSize = await executeQuery<RowDataPacket[]>(
          `SELECT 
            table_name,
            ROUND(((data_length + index_length) / 1024 / 1024), 2) AS size_mb
          FROM information_schema.TABLES
          WHERE table_schema = DATABASE()
          ORDER BY (data_length + index_length) DESC
          LIMIT 10`
        );

        // Report processing stats
        const processingStats = await executeQuery<RowDataPacket[]>(
          `SELECT 
            status,
            COUNT(*) as count,
            AVG(TIMESTAMPDIFF(HOUR, submitted_at, COALESCE(reviewed_at, NOW()))) as avg_processing_hours
          FROM reports
          WHERE submitted_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
          GROUP BY status`
        );

        return {
          sessions: {
            active: parseInt((activeSessions as any)?.count || 0)
          },
          security: {
            failed_logins_24h: parseInt((failedLogins as any)?.count || 0),
            locked_accounts: parseInt((lockedAccounts as any)?.count || 0)
          },
          database: {
            tables: dbSize
          },
          processing: processingStats,
          timestamp: new Date().toISOString(),
          cache_info: {
            cached_at: new Date().toISOString(),
            ttl_minutes: 30
          }
        };
      }
    );

    return res.json({
      success: true,
      data: performance
    });

  } catch (error) {
    logger.error('Error in getPerformance:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve performance metrics',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
};

/**
 * POST /api/admin/dashboard/refresh-cache
 * Manually refresh dashboard cache
 * 
 * Clears all cached dashboard data to force fresh queries
 * Use this after major data changes or for troubleshooting
 * 
 * Returns:
 * - Number of cache entries cleared
 * - Timestamp of cache refresh
 */
export const refreshCache = async (req: Request, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const cacheKeysCleared: string[] = [];

    // Clear all dashboard cache entries
    dashboardCache.forEach((value, key) => {
      if (key.startsWith('dashboard:')) {
        cacheKeysCleared.push(key);
      }
    });

    cacheKeysCleared.forEach(key => dashboardCache.delete(key));

    logger.info(`Dashboard cache refreshed by admin ${req.user.id}. Cleared ${cacheKeysCleared.length} entries.`);

    return res.json({
      success: true,
      message: 'Dashboard cache refreshed successfully',
      data: {
        entries_cleared: cacheKeysCleared.length,
        cache_keys: cacheKeysCleared,
        refreshed_at: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Error in refreshCache:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to refresh cache',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
};
