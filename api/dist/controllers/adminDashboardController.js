"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.refreshCache = exports.getPerformance = exports.getStats = exports.getActivity = exports.getMetrics = void 0;
const auth_1 = require("../middleware/auth");
const database_1 = require("../config/database");
const logger_1 = require("../config/logger");
const dashboardCache = new Map();
const getCachedData = async (cacheKey, ttl, dataFetcher) => {
    const cached = dashboardCache.get(cacheKey);
    const now = Date.now();
    if (cached && (now - cached.timestamp) < cached.ttl) {
        logger_1.logger.debug(`Cache HIT for ${cacheKey}`);
        return cached.data;
    }
    logger_1.logger.debug(`Cache MISS for ${cacheKey}, fetching fresh data`);
    const data = await dataFetcher();
    dashboardCache.set(cacheKey, {
        data,
        timestamp: now,
        ttl
    });
    return data;
};
const getMetrics = async (req, res) => {
    try {
        if (!(0, auth_1.hasRole)(req.user, 'admin')) {
            return res.status(403).json({
                success: false,
                message: 'Admin access required'
            });
        }
        const metrics = await getCachedData('dashboard:metrics', 15 * 60 * 1000, async () => {
            const userCounts = await (0, database_1.executeQuery)(`SELECT 
            role,
            status,
            COUNT(*) as count
          FROM users
          WHERE deleted_at IS NULL
          GROUP BY role, status`);
            const clientCounts = await (0, database_1.executeQuery)(`SELECT 
            status,
            COUNT(*) as count
          FROM clients
          WHERE deleted_at IS NULL
          GROUP BY status`);
            const reportCounts = await (0, database_1.executeQuery)(`SELECT 
            status,
            COUNT(*) as count
          FROM reports
          WHERE status != 'archived'
          GROUP BY status`);
            const activeAssignments = await (0, database_1.executeQuerySingle)(`SELECT COUNT(*) as count
          FROM client_pco_assignments
          WHERE status = 'active'`);
            const chemicalCount = await (0, database_1.executeQuerySingle)(`SELECT COUNT(*) as count
          FROM chemicals
          WHERE deleted_at IS NULL`);
            const recentReports = await (0, database_1.executeQuerySingle)(`SELECT COUNT(*) as count
          FROM reports
          WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)`);
            const recentAssignments = await (0, database_1.executeQuerySingle)(`SELECT COUNT(*) as count
          FROM client_pco_assignments
          WHERE assigned_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)`);
            const users = {
                total: 0,
                pco: { active: 0, inactive: 0, total: 0 },
                admin: { active: 0, inactive: 0, total: 0 }
            };
            userCounts.forEach((row) => {
                const count = parseInt(row.count);
                users.total += count;
                if (row.role === 'pco') {
                    users.pco.total += count;
                    if (row.status === 'active')
                        users.pco.active = count;
                    else
                        users.pco.inactive = count;
                }
                else if (row.role === 'admin') {
                    users.admin.total += count;
                    if (row.status === 'active')
                        users.admin.active = count;
                    else
                        users.admin.inactive = count;
                }
            });
            const clients = {
                total: 0,
                active: 0,
                inactive: 0,
                suspended: 0
            };
            clientCounts.forEach((row) => {
                const count = parseInt(row.count);
                clients.total += count;
                if (row.status === 'active')
                    clients.active = count;
                else if (row.status === 'inactive')
                    clients.inactive = count;
                else if (row.status === 'suspended')
                    clients.suspended = count;
            });
            const reports = {
                total: 0,
                draft: 0,
                pending: 0,
                approved: 0,
                declined: 0
            };
            reportCounts.forEach((row) => {
                const count = parseInt(row.count);
                reports.total += count;
                if (row.status === 'draft')
                    reports.draft = count;
                else if (row.status === 'pending')
                    reports.pending = count;
                else if (row.status === 'approved')
                    reports.approved = count;
                else if (row.status === 'declined')
                    reports.declined = count;
            });
            return {
                users,
                clients,
                reports,
                assignments: {
                    active: parseInt(activeAssignments?.count || 0)
                },
                chemicals: {
                    total: parseInt(chemicalCount?.count || 0)
                },
                recent_activity: {
                    reports_24h: parseInt(recentReports?.count || 0),
                    assignments_24h: parseInt(recentAssignments?.count || 0)
                },
                cache_info: {
                    cached_at: new Date().toISOString(),
                    ttl_minutes: 15
                }
            };
        });
        return res.json({
            success: true,
            data: metrics
        });
    }
    catch (error) {
        logger_1.logger.error('Error in getMetrics:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve dashboard metrics',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
exports.getMetrics = getMetrics;
const getActivity = async (req, res) => {
    try {
        if (!(0, auth_1.hasRole)(req.user, 'admin')) {
            return res.status(403).json({
                success: false,
                message: 'Admin access required'
            });
        }
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const activityType = req.query.activity_type || 'all';
        const activities = [];
        if (activityType === 'all' || activityType === 'users') {
            const recentUsers = await (0, database_1.executeQuery)(`SELECT id, name, email, pco_number, role, status, created_at
         FROM users
         WHERE deleted_at IS NULL
         ORDER BY created_at DESC
         LIMIT ?`, [limit]);
            recentUsers.forEach((user) => {
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
        if (activityType === 'all' || activityType === 'clients') {
            const recentClients = await (0, database_1.executeQuery)(`SELECT id, company_name, city, status, created_at
         FROM clients
         WHERE deleted_at IS NULL
         ORDER BY created_at DESC
         LIMIT ?`, [limit]);
            recentClients.forEach((client) => {
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
        if (activityType === 'all' || activityType === 'reports') {
            const recentReports = await (0, database_1.executeQuery)(`SELECT 
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
         LIMIT ?`, [limit]);
            recentReports.forEach((report) => {
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
        if (activityType === 'all' || activityType === 'assignments') {
            const recentAssignments = await (0, database_1.executeQuery)(`SELECT 
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
         LIMIT ?`, [limit]);
            recentAssignments.forEach((assignment) => {
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
        activities.sort((a, b) => {
            const timeA = new Date(a.timestamp).getTime();
            const timeB = new Date(b.timestamp).getTime();
            return timeB - timeA;
        });
        const limitedActivities = activities.slice(0, limit);
        return res.json({
            success: true,
            data: {
                activities: limitedActivities,
                count: limitedActivities.length,
                filter: activityType
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Error in getActivity:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve activity log',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
exports.getActivity = getActivity;
const getStats = async (req, res) => {
    try {
        if (!(0, auth_1.hasRole)(req.user, 'admin')) {
            return res.status(403).json({
                success: false,
                message: 'Admin access required'
            });
        }
        let period = req.query.period || '30d';
        const validPeriods = ['7d', '30d', '90d', '1y'];
        if (!validPeriods.includes(period)) {
            period = '30d';
        }
        const cacheKey = `dashboard:stats:${period}`;
        const stats = await getCachedData(cacheKey, 60 * 60 * 1000, async () => {
            let daysBack = 30;
            if (period === '7d')
                daysBack = 7;
            else if (period === '30d')
                daysBack = 30;
            else if (period === '90d')
                daysBack = 90;
            else if (period === '1y')
                daysBack = 365;
            const reportTrends = await (0, database_1.executeQuery)(`SELECT 
            DATE(submitted_at) as date,
            COUNT(*) as count,
            status
          FROM reports
          WHERE submitted_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            AND status IN ('pending', 'approved', 'declined')
          GROUP BY DATE(submitted_at), status
          ORDER BY date DESC`, [daysBack]);
            const approvalStats = await (0, database_1.executeQuerySingle)(`SELECT 
            COUNT(*) as total_reviewed,
            SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_count,
            SUM(CASE WHEN status = 'declined' THEN 1 ELSE 0 END) as declined_count,
            ROUND(AVG(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) * 100, 2) as approval_rate
          FROM reports
          WHERE reviewed_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            AND status IN ('approved', 'declined')`, [daysBack]);
            const turnaroundStats = await (0, database_1.executeQuerySingle)(`SELECT 
            COUNT(*) as reviewed_reports,
            ROUND(AVG(TIMESTAMPDIFF(HOUR, submitted_at, reviewed_at)), 2) as avg_hours,
            ROUND(MIN(TIMESTAMPDIFF(HOUR, submitted_at, reviewed_at)), 2) as min_hours,
            ROUND(MAX(TIMESTAMPDIFF(HOUR, submitted_at, reviewed_at)), 2) as max_hours
          FROM reports
          WHERE reviewed_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            AND submitted_at IS NOT NULL
            AND reviewed_at IS NOT NULL`, [daysBack]);
            const pcoPerformance = await (0, database_1.executeQuery)(`SELECT 
            u.id as pco_id,
            u.name as pco_name,
            u.pco_number,
            u.role,
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
          WHERE u.role IN ('pco', 'both')
            AND u.status = 'active'
            AND u.deleted_at IS NULL
          GROUP BY u.id, u.name, u.pco_number, u.role
          HAVING total_reports > 0
          ORDER BY total_reports DESC
          LIMIT 10`, [daysBack]);
            const clientActivity = await (0, database_1.executeQuery)(`SELECT 
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
          LIMIT 10`, [daysBack]);
            return {
                period: {
                    label: period,
                    days: daysBack,
                    start_date: new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                    end_date: new Date().toISOString().split('T')[0]
                },
                report_trends: reportTrends,
                approval_stats: {
                    total_reviewed: parseInt(approvalStats?.total_reviewed || 0),
                    approved: parseInt(approvalStats?.approved_count || 0),
                    declined: parseInt(approvalStats?.declined_count || 0),
                    approval_rate: parseFloat(approvalStats?.approval_rate || 0)
                },
                turnaround_time: {
                    reviewed_reports: parseInt(turnaroundStats?.reviewed_reports || 0),
                    avg_hours: parseFloat(turnaroundStats?.avg_hours || 0),
                    min_hours: parseFloat(turnaroundStats?.min_hours || 0),
                    max_hours: parseFloat(turnaroundStats?.max_hours || 0)
                },
                top_pcos: pcoPerformance,
                top_clients: clientActivity,
                cache_info: {
                    cached_at: new Date().toISOString(),
                    ttl_minutes: 60
                }
            };
        });
        return res.json({
            success: true,
            data: stats
        });
    }
    catch (error) {
        logger_1.logger.error('Error in getStats:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve dashboard statistics',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
exports.getStats = getStats;
const getPerformance = async (req, res) => {
    try {
        if (!(0, auth_1.hasRole)(req.user, 'admin')) {
            return res.status(403).json({
                success: false,
                message: 'Admin access required'
            });
        }
        const performance = await getCachedData('dashboard:performance', 30 * 60 * 1000, async () => {
            const activeSessions = await (0, database_1.executeQuerySingle)(`SELECT COUNT(*) as count
          FROM user_sessions
          WHERE expires_at > NOW()`);
            const failedLogins = await (0, database_1.executeQuerySingle)(`SELECT COUNT(*) as count
          FROM login_attempts
          WHERE attempt_time >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
            AND success = 0`);
            const lockedAccounts = await (0, database_1.executeQuerySingle)(`SELECT COUNT(*) as count
          FROM users
          WHERE locked_until > NOW()
            AND deleted_at IS NULL`);
            const dbSize = await (0, database_1.executeQuery)(`SELECT 
            table_name,
            ROUND(((data_length + index_length) / 1024 / 1024), 2) AS size_mb
          FROM information_schema.TABLES
          WHERE table_schema = DATABASE()
          ORDER BY (data_length + index_length) DESC
          LIMIT 10`);
            const processingStats = await (0, database_1.executeQuery)(`SELECT 
            status,
            COUNT(*) as count,
            AVG(TIMESTAMPDIFF(HOUR, submitted_at, COALESCE(reviewed_at, NOW()))) as avg_processing_hours
          FROM reports
          WHERE submitted_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
          GROUP BY status`);
            return {
                sessions: {
                    active: parseInt(activeSessions?.count || 0)
                },
                security: {
                    failed_logins_24h: parseInt(failedLogins?.count || 0),
                    locked_accounts: parseInt(lockedAccounts?.count || 0)
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
        });
        return res.json({
            success: true,
            data: performance
        });
    }
    catch (error) {
        logger_1.logger.error('Error in getPerformance:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve performance metrics',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
exports.getPerformance = getPerformance;
const refreshCache = async (req, res) => {
    try {
        if (!(0, auth_1.hasRole)(req.user, 'admin')) {
            return res.status(403).json({
                success: false,
                message: 'Admin access required'
            });
        }
        const cacheKeysCleared = [];
        dashboardCache.forEach((value, key) => {
            if (key.startsWith('dashboard:')) {
                cacheKeysCleared.push(key);
            }
        });
        cacheKeysCleared.forEach(key => dashboardCache.delete(key));
        logger_1.logger.info(`Dashboard cache refreshed by admin ${req.user.id}. Cleared ${cacheKeysCleared.length} entries.`);
        return res.json({
            success: true,
            message: 'Dashboard cache refreshed successfully',
            data: {
                entries_cleared: cacheKeysCleared.length,
                cache_keys: cacheKeysCleared,
                refreshed_at: new Date().toISOString()
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Error in refreshCache:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to refresh cache',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
exports.refreshCache = refreshCache;
//# sourceMappingURL=adminDashboardController.js.map