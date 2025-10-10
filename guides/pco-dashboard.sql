-- ============================================================================
-- PCO DASHBOARD ENDPOINTS SQL STATEMENTS
-- KPS Pest Control Management System - Mobile App
-- Created: October 7, 2025
-- ============================================================================

-- ============================================================================
-- 1. PCO DASHBOARD METRICS
-- ============================================================================

-- 1.1 GET PCO DASHBOARD DATA
-- Description: Get dashboard data for PCO mobile app
-- Method: GET /api/pco/dashboard
-- Required Data: pco_id (from session)
-- Returns: Dashboard statistics and key metrics

-- Get PCO Dashboard Metrics SQL
SELECT 
    (SELECT COUNT(*) FROM client_pco_assignments WHERE pco_id = ? AND status = 'active') as assigned_clients,
    (SELECT COUNT(*) FROM reports WHERE pco_id = ? AND status = 'draft') as draft_reports,
    (SELECT COUNT(*) FROM reports WHERE pco_id = ? AND status = 'declined') as revision_needed,
    (SELECT COUNT(*) FROM reports WHERE pco_id = ? AND DATE(created_at) = CURDATE()) as reports_today,
    (SELECT COUNT(*) FROM reports WHERE pco_id = ? AND DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL 7 DAY)) as reports_this_week,
    (SELECT COUNT(*) FROM notifications WHERE user_id = ? AND read_at IS NULL) as unread_notifications;

-- Parameters:
-- ? = pco_id (repeated 6 times)

-- 1.2 GET RECENT ACTIVITY SUMMARY
-- Description: Get recent activity for dashboard overview
-- Method: GET /api/pco/dashboard/activity
-- Required Data: pco_id
-- Returns: Recent reports and notifications

-- Get Recent Reports SQL
SELECT 
    r.id,
    r.report_type,
    r.service_date,
    r.status,
    r.created_at,
    c.company_name,
    c.city
FROM reports r
JOIN clients c ON r.client_id = c.id
WHERE r.pco_id = ?
ORDER BY r.created_at DESC
LIMIT 5;

-- Get Recent Notifications SQL
SELECT 
    id,
    type,
    title,
    message,
    read_at,
    created_at
FROM notifications 
WHERE user_id = ?
ORDER BY created_at DESC
LIMIT 10;

-- Parameters:
-- ? = pco_id (for both queries)

-- ============================================================================
-- 2. WORK SCHEDULE DASHBOARD
-- ============================================================================

-- 2.1 GET ASSIGNED CLIENTS FOR SCHEDULE
-- Description: Get list of assigned clients with service status
-- Method: GET /api/pco/dashboard/schedule
-- Required Data: pco_id
-- Returns: Client list with service indicators

-- Get Assigned Clients SQL
SELECT 
    c.id,
    c.company_name,
    c.address_line1,
    c.city,
    c.status,
    ca.assigned_at,
    -- Service history indicators
    (SELECT COUNT(*) FROM reports WHERE client_id = c.id AND pco_id = ?) as total_reports,
    (SELECT MAX(service_date) FROM reports WHERE client_id = c.id AND pco_id = ?) as last_service_date,
    (SELECT COUNT(*) FROM reports WHERE client_id = c.id AND pco_id = ? AND status = 'draft') as draft_reports,
    (SELECT COUNT(*) FROM reports WHERE client_id = c.id AND pco_id = ? AND status = 'pending') as pending_reports,
    -- Service priority indicators
    CASE 
        WHEN (SELECT COUNT(*) FROM reports WHERE client_id = c.id AND pco_id = ? AND status = 'draft') > 0 THEN 'has_draft'
        WHEN (SELECT MAX(service_date) FROM reports WHERE client_id = c.id AND pco_id = ?) < DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN 'overdue'
        WHEN (SELECT MAX(service_date) FROM reports WHERE client_id = c.id AND pco_id = ?) < DATE_SUB(CURDATE(), INTERVAL 14 DAY) THEN 'due_soon'
        ELSE 'current'
    END as service_priority
FROM clients c
JOIN client_pco_assignments ca ON c.id = ca.client_id
WHERE ca.pco_id = ? 
AND ca.status = 'active'
ORDER BY 
    -- Priority order: draft reports first, then overdue, then by assignment date
    CASE 
        WHEN (SELECT COUNT(*) FROM reports WHERE client_id = c.id AND pco_id = ? AND status = 'draft') > 0 THEN 1
        WHEN (SELECT MAX(service_date) FROM reports WHERE client_id = c.id AND pco_id = ?) < DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN 2
        WHEN (SELECT MAX(service_date) FROM reports WHERE client_id = c.id AND pco_id = ?) < DATE_SUB(CURDATE(), INTERVAL 14 DAY) THEN 3
        ELSE 4
    END,
    ca.assigned_at DESC;

-- Parameters:
-- ? = pco_id (repeated multiple times for calculations and filtering)

-- 2.2 GET CLIENT COUNT BY STATUS
-- Description: Get client counts by service status for dashboard widgets
-- Method: GET /api/pco/dashboard/client-stats
-- Required Data: pco_id
-- Returns: Client status breakdown

-- Get Client Status Counts SQL
SELECT 
    COUNT(*) as total_assigned,
    COUNT(CASE WHEN c.status = 'active' THEN 1 END) as active_clients,
    COUNT(CASE WHEN c.status = 'inactive' THEN 1 END) as inactive_clients,
    -- Service status counts
    COUNT(CASE WHEN draft_counts.draft_count > 0 THEN 1 END) as clients_with_drafts,
    COUNT(CASE WHEN last_service.last_date < DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN 1 END) as overdue_clients,
    COUNT(CASE WHEN last_service.last_date < DATE_SUB(CURDATE(), INTERVAL 14 DAY) 
               AND last_service.last_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN 1 END) as due_soon_clients
FROM clients c
JOIN client_pco_assignments ca ON c.id = ca.client_id
LEFT JOIN (
    SELECT client_id, COUNT(*) as draft_count
    FROM reports 
    WHERE pco_id = ? AND status = 'draft'
    GROUP BY client_id
) draft_counts ON c.id = draft_counts.client_id
LEFT JOIN (
    SELECT client_id, MAX(service_date) as last_date
    FROM reports 
    WHERE pco_id = ?
    GROUP BY client_id
) last_service ON c.id = last_service.client_id
WHERE ca.pco_id = ? AND ca.status = 'active';

-- Parameters:
-- ? = pco_id (repeated 3 times)

-- ============================================================================
-- 3. PERFORMANCE METRICS DASHBOARD
-- ============================================================================

-- 3.1 GET PCO PERFORMANCE STATISTICS
-- Description: Get performance metrics for PCO dashboard
-- Method: GET /api/pco/dashboard/performance
-- Required Data: pco_id, period (optional, default 30 days)
-- Returns: Performance statistics and trends

-- Get Performance Metrics SQL
SELECT 
    -- Report statistics
    COUNT(CASE WHEN r.created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY) THEN 1 END) as reports_period,
    COUNT(CASE WHEN r.submitted_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY) THEN 1 END) as submitted_period,
    COUNT(CASE WHEN r.status = 'approved' AND r.reviewed_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY) THEN 1 END) as approved_period,
    COUNT(CASE WHEN r.status = 'declined' AND r.reviewed_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY) THEN 1 END) as declined_period,
    
    -- Approval rate calculation
    CASE 
        WHEN COUNT(CASE WHEN r.reviewed_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY) THEN 1 END) > 0 
        THEN (COUNT(CASE WHEN r.status = 'approved' AND r.reviewed_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY) THEN 1 END) * 100.0 / 
              COUNT(CASE WHEN r.reviewed_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY) THEN 1 END))
        ELSE 0 
    END as approval_rate_percent,
    
    -- Average time metrics
    AVG(CASE WHEN r.submitted_at IS NOT NULL AND r.submitted_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY) 
             THEN TIMESTAMPDIFF(HOUR, r.created_at, r.submitted_at) END) as avg_completion_hours,
    
    -- Service frequency
    AVG(service_gaps.days_between_services) as avg_days_between_services
    
FROM reports r
LEFT JOIN (
    SELECT 
        client_id,
        AVG(DATEDIFF(
            LEAD(service_date) OVER (PARTITION BY client_id ORDER BY service_date),
            service_date
        )) as days_between_services
    FROM reports
    WHERE pco_id = ? AND service_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
    GROUP BY client_id
) service_gaps ON r.client_id = service_gaps.client_id
WHERE r.pco_id = ?;

-- Parameters:
-- ? = period_days (repeated multiple times), pco_id (repeated 3 times)

-- 3.2 GET MONTHLY REPORT TRENDS
-- Description: Get monthly report submission trends
-- Method: GET /api/pco/dashboard/trends?months=6
-- Required Data: pco_id, months (optional, default 6)
-- Returns: Monthly report statistics

-- Get Monthly Trends SQL
SELECT 
    DATE_FORMAT(r.service_date, '%Y-%m') as month,
    COUNT(*) as total_reports,
    COUNT(CASE WHEN r.status = 'approved' THEN 1 END) as approved_reports,
    COUNT(CASE WHEN r.status = 'declined' THEN 1 END) as declined_reports,
    COUNT(CASE WHEN r.status = 'pending' THEN 1 END) as pending_reports,
    COUNT(DISTINCT r.client_id) as unique_clients_served
FROM reports r
WHERE r.pco_id = ? 
AND r.service_date >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
GROUP BY DATE_FORMAT(r.service_date, '%Y-%m')
ORDER BY month DESC;

-- Parameters:
-- ? = pco_id, months

-- ============================================================================
-- 4. NOTIFICATION DASHBOARD
-- ============================================================================

-- 4.1 GET UNREAD NOTIFICATIONS
-- Description: Get unread notifications for dashboard
-- Method: GET /api/pco/dashboard/notifications
-- Required Data: pco_id
-- Returns: Unread notifications with priority

-- Get Unread Notifications SQL
SELECT 
    id,
    type,
    title,
    message,
    created_at,
    CASE type
        WHEN 'assignment' THEN 1
        WHEN 'report_declined' THEN 2
        WHEN 'system_update' THEN 3
        ELSE 4
    END as priority_order
FROM notifications 
WHERE user_id = ? AND read_at IS NULL
ORDER BY priority_order, created_at DESC
LIMIT 20;

-- Parameters:
-- ? = pco_id

-- 4.2 MARK NOTIFICATION AS READ
-- Description: Mark notification as read
-- Method: PUT /api/pco/notifications/{id}/read
-- Required Data: notification_id, pco_id
-- Returns: Success message

-- Verify notification ownership
SELECT id FROM notifications WHERE id = ? AND user_id = ?;

-- Mark Notification Read SQL
UPDATE notifications 
SET read_at = NOW()
WHERE id = ? AND user_id = ? AND read_at IS NULL;

-- Parameters:
-- ? = notification_id, pco_id (for verification and update)

-- 4.3 MARK ALL NOTIFICATIONS AS READ
-- Description: Mark all notifications as read for PCO
-- Method: PUT /api/pco/notifications/read-all
-- Required Data: pco_id
-- Returns: Count of notifications marked

-- Mark All Notifications Read SQL
UPDATE notifications 
SET read_at = NOW()
WHERE user_id = ? AND read_at IS NULL;

-- Get count of updated notifications
SELECT ROW_COUNT() as notifications_marked;

-- Parameters:
-- ? = pco_id

-- ============================================================================
-- 5. QUICK ACTIONS DASHBOARD
-- ============================================================================

-- 5.1 GET QUICK ACTION ITEMS
-- Description: Get items requiring immediate attention
-- Method: GET /api/pco/dashboard/quick-actions
-- Required Data: pco_id
-- Returns: Action items with urgency indicators

-- Get Quick Actions SQL
SELECT 
    'draft_report' as action_type,
    r.id as item_id,
    c.company_name as title,
    CONCAT('Draft report created ', DATEDIFF(CURDATE(), DATE(r.created_at)), ' days ago') as description,
    CASE 
        WHEN DATEDIFF(CURDATE(), DATE(r.created_at)) >= 3 THEN 'high'
        WHEN DATEDIFF(CURDATE(), DATE(r.created_at)) >= 1 THEN 'medium'
        ELSE 'low'
    END as urgency,
    r.created_at as created_date
FROM reports r
JOIN clients c ON r.client_id = c.id
WHERE r.pco_id = ? AND r.status = 'draft'

UNION ALL

SELECT 
    'declined_report' as action_type,
    r.id as item_id,
    c.company_name as title,
    CONCAT('Report declined: ', COALESCE(r.admin_notes, 'Needs revision')) as description,
    'high' as urgency,
    r.reviewed_at as created_date
FROM reports r
JOIN clients c ON r.client_id = c.id
WHERE r.pco_id = ? AND r.status = 'declined'

UNION ALL

SELECT 
    'overdue_service' as action_type,
    c.id as item_id,
    c.company_name as title,
    CONCAT('Last service: ', COALESCE(DATE_FORMAT(last_service.service_date, '%d %b %Y'), 'Never')) as description,
    CASE 
        WHEN last_service.service_date < DATE_SUB(CURDATE(), INTERVAL 45 DAY) THEN 'high'
        WHEN last_service.service_date < DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN 'medium'
        ELSE 'low'
    END as urgency,
    COALESCE(last_service.service_date, ca.assigned_at) as created_date
FROM clients c
JOIN client_pco_assignments ca ON c.id = ca.client_id
LEFT JOIN (
    SELECT client_id, MAX(service_date) as service_date
    FROM reports WHERE pco_id = ?
    GROUP BY client_id
) last_service ON c.id = last_service.client_id
WHERE ca.pco_id = ? AND ca.status = 'active'
AND (last_service.service_date IS NULL OR last_service.service_date < DATE_SUB(CURDATE(), INTERVAL 21 DAY))

ORDER BY 
    CASE urgency 
        WHEN 'high' THEN 1 
        WHEN 'medium' THEN 2 
        ELSE 3 
    END,
    created_date DESC
LIMIT 20;

-- Parameters:
-- ? = pco_id (repeated 4 times)

-- ============================================================================
-- 6. OFFLINE DATA INDICATORS
-- ============================================================================

-- 6.1 GET SYNC STATUS INDICATORS
-- Description: Get data freshness indicators for offline operation
-- Method: GET /api/pco/dashboard/sync-status
-- Required Data: pco_id, last_sync_timestamp (optional)
-- Returns: Data synchronization status

-- Get Sync Status SQL
SELECT 
    -- Data freshness indicators
    (SELECT COUNT(*) FROM client_pco_assignments 
     WHERE pco_id = ? AND (assigned_at > ? OR unassigned_at > ?)) as assignment_updates,
    
    (SELECT COUNT(*) FROM chemicals 
     WHERE status = 'active' AND updated_at > ?) as chemical_updates,
    
    (SELECT COUNT(*) FROM reports 
     WHERE pco_id = ? AND (reviewed_at > ? OR updated_at > ?) 
     AND status IN ('approved', 'declined')) as report_status_updates,
    
    -- Current data counts
    (SELECT COUNT(*) FROM client_pco_assignments WHERE pco_id = ? AND status = 'active') as current_assignments,
    (SELECT COUNT(*) FROM chemicals WHERE status = 'active') as active_chemicals,
    (SELECT COUNT(*) FROM reports WHERE pco_id = ? AND status = 'draft') as draft_reports_count,
    
    -- Last sync indicator
    COALESCE(?, '1970-01-01 00:00:00') as last_sync_time,
    NOW() as current_server_time;

-- Parameters:
-- ? = pco_id, last_sync_timestamp (repeated as needed)

-- ============================================================================
-- SAMPLE USAGE EXAMPLES
-- ============================================================================

/*
1. GET DASHBOARD DATA:
   Input: pco_id=2
   Query: SELECT dashboard metrics including assigned clients, draft reports, notifications
   Output: {"assigned_clients": 3, "draft_reports": 1, "revision_needed": 0, "unread_notifications": 2}

2. GET SCHEDULE WITH PRIORITY:
   Input: pco_id=2
   Query: SELECT clients with service priority indicators
   Output: List of clients with priority flags (has_draft, overdue, due_soon, current)

3. GET PERFORMANCE METRICS:
   Input: pco_id=2, period=30
   Query: SELECT performance statistics for last 30 days
   Output: {"reports_period": 15, "approval_rate": 87.5, "avg_completion_hours": 4.2}

4. GET QUICK ACTIONS:
   Input: pco_id=2
   Query: SELECT urgent items needing attention
   Output: List of draft reports, declined reports, overdue services with urgency levels

5. MARK NOTIFICATIONS READ:
   Input: pco_id=2
   Query: UPDATE notifications SET read_at = NOW() WHERE user_id = 2
   Result: All unread notifications marked as read

6. GET SYNC STATUS:
   Input: pco_id=2, last_sync="2025-10-07 10:00:00"
   Query: SELECT data updates since last sync
   Output: Counts of new assignments, chemical updates, report status changes
*/