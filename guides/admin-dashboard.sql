-- ============================================================================
-- ADMIN DASHBOARD ENDPOINTS SQL STATEMENTS
-- KPS Pest Control Management System  
-- Created: October 7, 2025
-- ============================================================================

-- ============================================================================
-- 1. DASHBOARD METRICS ENDPOINTS
-- ============================================================================

-- 1.1 GET DASHBOARD METRICS
-- Description: Get cached dashboard metrics for admin
-- Method: GET /api/admin/dashboard/metrics
-- Required Data: None
-- Returns: Dashboard statistics

-- Get Dashboard Metrics SQL (with cache)
SELECT 
    cache_key,
    JSON_EXTRACT(cache_value, '$.count') as count,
    expires_at
FROM dashboard_cache 
WHERE cache_key IN (
    'active_clients_count', 
    'pending_reports_count', 
    'reports_today_count'
) 
AND expires_at > NOW();

-- Fallback real-time metrics (if cache expired)
SELECT 'active_clients_count' as metric, COUNT(*) as count 
FROM clients WHERE status = 'active'
UNION ALL
SELECT 'pending_reports_count' as metric, COUNT(*) as count 
FROM reports WHERE status = 'pending'
UNION ALL  
SELECT 'reports_today_count' as metric, COUNT(*) as count 
FROM reports WHERE DATE(created_at) = CURDATE()
UNION ALL
SELECT 'active_pcos_count' as metric, COUNT(*) as count 
FROM users WHERE role IN ('pco', 'both') AND status = 'active';

-- 1.2 GET RECENT ACTIVITY
-- Description: Get recent system activity for dashboard
-- Method: GET /api/admin/dashboard/activity
-- Required Data: limit (optional, default 10)
-- Returns: Recent reports and assignments

-- Recent Reports Activity SQL
SELECT 
    'report_submitted' as activity_type,
    r.id as entity_id,
    r.submitted_at as activity_time,
    CONCAT(u.name, ' submitted report for ', c.company_name) as description,
    r.status
FROM reports r
JOIN users u ON r.pco_id = u.id
JOIN clients c ON r.client_id = c.id
WHERE r.submitted_at IS NOT NULL
ORDER BY r.submitted_at DESC
LIMIT ?;

-- Recent Assignments Activity SQL  
SELECT 
    'client_assigned' as activity_type,
    ca.id as entity_id,
    ca.assigned_at as activity_time,
    CONCAT(u.name, ' assigned to ', c.company_name) as description,
    ca.status
FROM client_pco_assignments ca
JOIN users u ON ca.pco_id = u.id  
JOIN clients c ON ca.client_id = c.id
WHERE ca.status = 'active'
ORDER BY ca.assigned_at DESC
LIMIT ?;

-- Parameters:
-- ? = limit (default 10)

-- ============================================================================
-- 2. SYSTEM OVERVIEW ENDPOINTS
-- ============================================================================

-- 2.1 GET SYSTEM STATS
-- Description: Get comprehensive system statistics
-- Method: GET /api/admin/dashboard/stats
-- Required Data: None
-- Returns: System-wide statistics

-- System Statistics SQL
SELECT 
    (SELECT COUNT(*) FROM clients WHERE deleted_at IS NULL) as total_clients,
    (SELECT COUNT(*) FROM clients WHERE status = 'active' AND deleted_at IS NULL) as active_clients,
    (SELECT COUNT(*) FROM users WHERE role IN ('pco', 'both') AND deleted_at IS NULL) as total_pcos,
    (SELECT COUNT(*) FROM users WHERE role IN ('pco', 'both') AND status = 'active' AND deleted_at IS NULL) as active_pcos,
    (SELECT COUNT(*) FROM reports) as total_reports,
    (SELECT COUNT(*) FROM reports WHERE status = 'approved') as approved_reports,
    (SELECT COUNT(*) FROM reports WHERE status = 'pending') as pending_reports,
    (SELECT COUNT(*) FROM reports WHERE DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)) as reports_last_30_days,
    (SELECT COUNT(*) FROM client_pco_assignments WHERE status = 'active') as active_assignments,
    (SELECT COUNT(*) FROM chemicals WHERE status = 'active' AND deleted_at IS NULL) as active_chemicals;

-- Parameters: None

-- 2.2 GET PERFORMANCE METRICS
-- Description: Get system performance metrics
-- Method: GET /api/admin/dashboard/performance
-- Required Data: None
-- Returns: Performance indicators

-- Performance Metrics SQL
SELECT 
    AVG(DATEDIFF(reviewed_at, submitted_at)) as avg_review_time_days,
    COUNT(CASE WHEN DATEDIFF(NOW(), submitted_at) > 3 AND status = 'pending' THEN 1 END) as overdue_reviews,
    AVG(DATEDIFF(unassigned_at, assigned_at)) as avg_assignment_duration_days,
    (SELECT COUNT(*) FROM reports WHERE status = 'approved') / 
    NULLIF((SELECT COUNT(*) FROM reports WHERE status IN ('approved', 'declined')), 0) * 100 as approval_rate_percentage,
    COUNT(CASE WHEN DATE(created_at) = CURDATE() THEN 1 END) as reports_created_today
FROM reports 
WHERE submitted_at IS NOT NULL;

-- Parameters: None

-- ============================================================================
-- 3. CACHE MANAGEMENT ENDPOINTS
-- ============================================================================

-- 3.1 REFRESH DASHBOARD CACHE
-- Description: Manually refresh dashboard cache
-- Method: POST /api/admin/dashboard/refresh-cache
-- Required Data: None
-- Returns: Success message

-- Use stored procedure to update cache
CALL UpdateDashboardCache();

-- 3.2 GET CACHE STATUS
-- Description: Get current cache status
-- Method: GET /api/admin/dashboard/cache-status
-- Required Data: None
-- Returns: Cache information

-- Cache Status SQL
SELECT 
    cache_key,
    JSON_EXTRACT(cache_value, '$.count') as cached_value,
    expires_at,
    CASE WHEN expires_at > NOW() THEN 'valid' ELSE 'expired' END as status,
    TIMESTAMPDIFF(MINUTE, NOW(), expires_at) as expires_in_minutes
FROM dashboard_cache
ORDER BY cache_key;

-- Parameters: None

-- ============================================================================
-- SAMPLE USAGE EXAMPLES
-- ============================================================================

/*
1. GET DASHBOARD METRICS:
   Query: SELECT cache_key, JSON_EXTRACT(cache_value, '$.count') FROM dashboard_cache;
   Output: {"active_clients_count": 15, "pending_reports_count": 3}

2. GET RECENT ACTIVITY:
   Input: limit=5
   Query: SELECT activity_type, description FROM recent reports/assignments;
   Output: [{"activity_type": "report_submitted", "description": "John submitted report for ABC Restaurant"}]

3. REFRESH CACHE:
   Query: CALL UpdateDashboardCache();
   Result: Dashboard cache refreshed with current metrics

4. GET SYSTEM STATS:
   Query: SELECT total_clients, active_clients, total_reports FROM system statistics;
   Output: {"total_clients": 25, "active_clients": 22, "total_reports": 150}
*/