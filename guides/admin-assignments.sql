-- ============================================================================
-- ASSIGNMENT MANAGEMENT ENDPOINTS SQL STATEMENTS
-- KPS Pest Control Management System  
-- Created: October 7, 2025
-- ============================================================================

-- ============================================================================
-- 1. ASSIGNMENT OVERVIEW ENDPOINTS
-- ============================================================================

-- 1.1 GET ALL ASSIGNMENTS (PAGINATED)
-- Description: Get paginated list of all PCO-client assignments
-- Method: GET /api/admin/assignments?page=1&pageSize=25&status=all&pco_id=all
-- Required Data: page, pageSize, status_filter, pco_filter
-- Returns: Paginated assignment list with details

-- Get Assignments Count SQL
SELECT COUNT(*) as total_count 
FROM client_pco_assignments ca
JOIN clients c ON ca.client_id = c.id
JOIN users pco ON ca.pco_id = pco.id
WHERE 
    c.deleted_at IS NULL
    AND pco.deleted_at IS NULL
    AND CASE WHEN ? != 'all' THEN ca.status = ? ELSE 1=1 END
    AND CASE WHEN ? != 'all' THEN ca.pco_id = ? ELSE 1=1 END;

-- Get Assignments Paginated SQL
SELECT 
    ca.id as assignment_id,
    ca.client_id,
    ca.pco_id,
    ca.assigned_at,
    ca.unassigned_at,
    ca.status as assignment_status,
    -- Client details
    c.company_name,
    c.address_line1,
    c.city,
    c.phone as client_phone,
    c.status as client_status,
    -- PCO details
    pco.name as pco_name,
    pco.pco_number,
    pco.phone as pco_phone,
    pco.status as pco_status,
    -- Assignment management
    assigned_by_user.name as assigned_by_name,
    unassigned_by_user.name as unassigned_by_name,
    -- Service statistics
    (SELECT COUNT(*) FROM reports 
     WHERE client_id = ca.client_id AND pco_id = ca.pco_id) as total_reports,
    (SELECT COUNT(*) FROM reports 
     WHERE client_id = ca.client_id AND pco_id = ca.pco_id AND status = 'pending') as pending_reports,
    (SELECT MAX(service_date) FROM reports 
     WHERE client_id = ca.client_id AND pco_id = ca.pco_id) as last_service_date
FROM client_pco_assignments ca
JOIN clients c ON ca.client_id = c.id
JOIN users pco ON ca.pco_id = pco.id
JOIN users assigned_by_user ON ca.assigned_by = assigned_by_user.id
LEFT JOIN users unassigned_by_user ON ca.unassigned_by = unassigned_by_user.id
WHERE 
    c.deleted_at IS NULL
    AND pco.deleted_at IS NULL
    AND CASE WHEN ? != 'all' THEN ca.status = ? ELSE 1=1 END
    AND CASE WHEN ? != 'all' THEN ca.pco_id = ? ELSE 1=1 END
ORDER BY 
    CASE ca.status
        WHEN 'active' THEN 1
        WHEN 'inactive' THEN 2
    END,
    ca.assigned_at DESC
LIMIT ? OFFSET ?;

-- Parameters:
-- ? = status_filter, pco_filter (for count)
-- ? = status_filter, pco_filter (for main query)
-- ? = pageSize, offset

-- 1.2 GET ASSIGNMENT STATISTICS
-- Description: Get overall assignment statistics for dashboard
-- Method: GET /api/admin/assignments/stats
-- Returns: Assignment statistics and metrics

-- Assignment Statistics SQL
SELECT 
    (SELECT COUNT(*) FROM client_pco_assignments 
     WHERE status = 'active') as active_assignments,
    (SELECT COUNT(*) FROM clients c 
     WHERE c.deleted_at IS NULL AND c.status = 'active' 
     AND NOT EXISTS(SELECT 1 FROM client_pco_assignments 
                   WHERE client_id = c.id AND status = 'active')) as unassigned_clients,
    (SELECT COUNT(*) FROM users 
     WHERE role IN ('pco', 'both') AND status = 'active' AND deleted_at IS NULL) as available_pcos,
    (SELECT COUNT(*) FROM users u
     WHERE u.role IN ('pco', 'both') AND u.status = 'active' AND u.deleted_at IS NULL
     AND NOT EXISTS(SELECT 1 FROM client_pco_assignments 
                   WHERE pco_id = u.id AND status = 'active')) as unassigned_pcos,
    (SELECT AVG(assignment_count) FROM 
        (SELECT COUNT(*) as assignment_count 
         FROM client_pco_assignments 
         WHERE status = 'active' 
         GROUP BY pco_id) as pco_assignments) as avg_assignments_per_pco,
    (SELECT COUNT(*) FROM client_pco_assignments 
     WHERE assigned_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)) as assignments_last_30_days;

-- ============================================================================
-- 2. BULK ASSIGNMENT OPERATIONS
-- ============================================================================

-- 2.1 BULK ASSIGN CLIENTS TO PCO
-- Description: Assign multiple clients to a single PCO
-- Method: POST /api/admin/assignments/bulk-assign
-- Required Data: pco_id, client_ids[], assigned_by
-- Returns: Count of successful assignments

-- Verify PCO exists and is active
SELECT id, name FROM users 
WHERE id = ? AND role IN ('pco', 'both') AND status = 'active' AND deleted_at IS NULL;

-- Check PCO current assignment count
SELECT COUNT(*) as current_assignments
FROM client_pco_assignments 
WHERE pco_id = ? AND status = 'active';

-- Verify clients exist and are available (prepare for each client_id)
SELECT 
    c.id,
    c.company_name,
    CASE WHEN EXISTS(SELECT 1 FROM client_pco_assignments 
                    WHERE client_id = c.id AND status = 'active') 
         THEN 1 ELSE 0 END as already_assigned
FROM clients c 
WHERE c.id IN (?, ?, ?) -- Repeat ? for each client_id
AND c.status = 'active' AND c.deleted_at IS NULL;

-- Unassign existing PCOs for these clients (if forcing reassignment)
UPDATE client_pco_assignments 
SET 
    status = 'inactive',
    unassigned_at = NOW(),
    unassigned_by = ?
WHERE client_id IN (?, ?, ?) -- Repeat ? for each client_id
AND status = 'active';

-- Bulk Create Assignments SQL
INSERT INTO client_pco_assignments (
    client_id,
    pco_id,
    assigned_by,
    assigned_at,
    status
) VALUES
(?, ?, ?, NOW(), 'active'),
(?, ?, ?, NOW(), 'active'),
(?, ?, ?, NOW(), 'active'); -- Repeat for each client

-- Get assignment count
SELECT ROW_COUNT() as assignments_created;

-- Create notifications for PCO
INSERT INTO notifications (user_id, type, title, message)
SELECT 
    ? as user_id,
    'bulk_assignment' as type,
    CONCAT('New Bulk Assignment - ', COUNT(*), ' clients') as title,
    CONCAT('You have been assigned to handle services for ', COUNT(*), ' new clients. Please check your assignment list.') as message
FROM client_pco_assignments ca
WHERE ca.pco_id = ? AND ca.assigned_at > DATE_SUB(NOW(), INTERVAL 1 MINUTE);

-- Parameters vary based on number of clients being assigned

-- 2.2 BULK UNASSIGN CLIENTS FROM PCO
-- Description: Remove multiple clients from a PCO
-- Method: POST /api/admin/assignments/bulk-unassign
-- Required Data: pco_id, client_ids[], unassigned_by
-- Returns: Count of successful unassignments

-- Verify assignments exist
SELECT 
    ca.client_id,
    c.company_name
FROM client_pco_assignments ca
JOIN clients c ON ca.client_id = c.id
WHERE ca.pco_id = ? AND ca.client_id IN (?, ?, ?) -- Repeat ? for each client_id
AND ca.status = 'active';

-- Bulk Unassign SQL
UPDATE client_pco_assignments 
SET 
    status = 'inactive',
    unassigned_at = NOW(),
    unassigned_by = ?
WHERE pco_id = ? AND client_id IN (?, ?, ?) -- Repeat ? for each client_id
AND status = 'active';

-- Get unassignment count
SELECT ROW_COUNT() as unassignments_count;

-- Create notification for PCO
INSERT INTO notifications (user_id, type, title, message)
VALUES (?, 'bulk_unassignment', 
        CONCAT('Bulk Unassignment - ', ROW_COUNT(), ' clients'), 
        CONCAT('You have been unassigned from ', ROW_COUNT(), ' clients. Please check your assignment list.'));

-- Parameters vary based on number of clients being unassigned

-- 2.3 REASSIGN ALL CLIENTS FROM ONE PCO TO ANOTHER
-- Description: Transfer all assignments from one PCO to another
-- Method: POST /api/admin/assignments/transfer
-- Required Data: from_pco_id, to_pco_id, transferred_by
-- Returns: Count of transferred assignments

-- Verify source PCO exists
SELECT id, name FROM users 
WHERE id = ? AND role IN ('pco', 'both') AND deleted_at IS NULL;

-- Verify target PCO exists and is active
SELECT id, name FROM users 
WHERE id = ? AND role IN ('pco', 'both') AND status = 'active' AND deleted_at IS NULL;

-- Get current assignments from source PCO
SELECT 
    ca.client_id,
    c.company_name
FROM client_pco_assignments ca
JOIN clients c ON ca.client_id = c.id
WHERE ca.pco_id = ? AND ca.status = 'active';

-- Unassign from source PCO
UPDATE client_pco_assignments 
SET 
    status = 'inactive',
    unassigned_at = NOW(),
    unassigned_by = ?
WHERE pco_id = ? AND status = 'active';

-- Create new assignments to target PCO
INSERT INTO client_pco_assignments (
    client_id,
    pco_id,
    assigned_by,
    assigned_at,
    status
)
SELECT 
    ca.client_id,
    ? as pco_id,
    ? as assigned_by,
    NOW() as assigned_at,
    'active' as status
FROM client_pco_assignments ca
WHERE ca.pco_id = ? AND ca.status = 'inactive' 
AND ca.unassigned_at > DATE_SUB(NOW(), INTERVAL 1 MINUTE);

-- Get transfer count
SELECT ROW_COUNT() as transferred_count;

-- Create notifications
INSERT INTO notifications (user_id, type, title, message)
VALUES 
(?, 'assignment_transfer_from', 'All Assignments Transferred', 
 'All your client assignments have been transferred to another PCO.'),
(?, 'assignment_transfer_to', 'New Assignment Transfer', 
 CONCAT('You have received ', ROW_COUNT(), ' client assignments from another PCO.'));

-- Parameters:
-- ? = from_pco_id, to_pco_id (for verification)
-- ? = from_pco_id (for getting assignments)
-- ? = transferred_by, from_pco_id (for unassignment)
-- ? = to_pco_id, transferred_by, from_pco_id (for new assignments)
-- ? = from_pco_id, to_pco_id (for notifications)

-- ============================================================================
-- 3. ASSIGNMENT OPTIMIZATION
-- ============================================================================

-- 3.1 GET WORKLOAD DISTRIBUTION
-- Description: Analyze PCO workload for optimal assignment distribution
-- Method: GET /api/admin/assignments/workload
-- Returns: PCO workload analysis and recommendations

-- PCO Workload Analysis SQL
SELECT 
    pco.id as pco_id,
    pco.name as pco_name,
    pco.pco_number,
    pco.phone,
    pco.status,
    -- Assignment counts
    COALESCE(active_assignments.count, 0) as active_assignments,
    COALESCE(total_assignments.count, 0) as total_assignments_ever,
    -- Service statistics
    COALESCE(report_stats.total_reports, 0) as total_reports,
    COALESCE(report_stats.pending_reports, 0) as pending_reports,
    COALESCE(report_stats.avg_reports_per_client, 0) as avg_reports_per_client,
    -- Performance metrics
    report_stats.last_report_date,
    -- Workload assessment
    CASE 
        WHEN COALESCE(active_assignments.count, 0) = 0 THEN 'available'
        WHEN COALESCE(active_assignments.count, 0) <= 5 THEN 'light'
        WHEN COALESCE(active_assignments.count, 0) <= 10 THEN 'moderate'
        WHEN COALESCE(active_assignments.count, 0) <= 15 THEN 'heavy'
        ELSE 'overloaded'
    END as workload_status
FROM users pco
LEFT JOIN (
    SELECT pco_id, COUNT(*) as count
    FROM client_pco_assignments 
    WHERE status = 'active'
    GROUP BY pco_id
) active_assignments ON pco.id = active_assignments.pco_id
LEFT JOIN (
    SELECT pco_id, COUNT(*) as count
    FROM client_pco_assignments 
    GROUP BY pco_id
) total_assignments ON pco.id = total_assignments.pco_id
LEFT JOIN (
    SELECT 
        pco_id,
        COUNT(*) as total_reports,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_reports,
        AVG(reports_per_client.count) as avg_reports_per_client,
        MAX(service_date) as last_report_date
    FROM reports r
    JOIN (
        SELECT pco_id, client_id, COUNT(*) as count
        FROM reports 
        GROUP BY pco_id, client_id
    ) reports_per_client ON r.pco_id = reports_per_client.pco_id
    GROUP BY pco_id
) report_stats ON pco.id = report_stats.pco_id
WHERE 
    pco.role IN ('pco', 'both') 
    AND pco.deleted_at IS NULL
ORDER BY 
    CASE pco.status WHEN 'active' THEN 1 ELSE 2 END,
    active_assignments.count ASC;

-- 3.2 GET ASSIGNMENT RECOMMENDATIONS
-- Description: Get recommendations for optimal client-PCO assignments
-- Method: GET /api/admin/assignments/recommendations
-- Returns: Suggested assignments based on location, workload, etc.

-- Assignment Recommendations SQL
SELECT 
    c.id as client_id,
    c.company_name,
    c.city as client_city,
    c.address_line1,
    -- Recommended PCOs (top 3)
    recommended_pcos.pco_id as recommended_pco_id,
    recommended_pcos.pco_name,
    recommended_pcos.pco_number,
    recommended_pcos.current_assignments,
    recommended_pcos.same_city_count,
    recommended_pcos.distance_score,
    -- Recommendation reasons
    CASE 
        WHEN recommended_pcos.same_city_count > 0 THEN 'Same city experience'
        WHEN recommended_pcos.current_assignments <= 5 THEN 'Low workload'
        WHEN recommended_pcos.distance_score <= 2 THEN 'Geographic proximity'
        ELSE 'Available capacity'
    END as recommendation_reason
FROM clients c
CROSS JOIN (
    SELECT 
        pco.id as pco_id,
        pco.name as pco_name,
        pco.pco_number,
        COALESCE(ca_count.assignments, 0) as current_assignments,
        COALESCE(same_city.count, 0) as same_city_count,
        -- Simple distance score based on city match
        CASE WHEN same_city.count > 0 THEN 1 ELSE 3 END as distance_score,
        -- Overall recommendation score
        (
            (CASE WHEN same_city.count > 0 THEN 20 ELSE 0 END) + -- City bonus
            (CASE WHEN COALESCE(ca_count.assignments, 0) <= 5 THEN 15 ELSE 5 END) + -- Workload bonus
            (CASE WHEN pco.status = 'active' THEN 10 ELSE 0 END) -- Status bonus
        ) as recommendation_score
    FROM users pco
    LEFT JOIN (
        SELECT pco_id, COUNT(*) as assignments
        FROM client_pco_assignments 
        WHERE status = 'active'
        GROUP BY pco_id
    ) ca_count ON pco.id = ca_count.pco_id
    LEFT JOIN (
        SELECT 
            ca.pco_id,
            c.city,
            COUNT(*) as count
        FROM client_pco_assignments ca
        JOIN clients c ON ca.client_id = c.id
        WHERE ca.status = 'active'
        GROUP BY ca.pco_id, c.city
    ) same_city ON pco.id = same_city.pco_id AND same_city.city = c.city
    WHERE 
        pco.role IN ('pco', 'both')
        AND pco.status = 'active'
        AND pco.deleted_at IS NULL
    ORDER BY recommendation_score DESC
    LIMIT 3
) recommended_pcos
WHERE 
    c.deleted_at IS NULL
    AND c.status = 'active'
    AND NOT EXISTS (
        SELECT 1 FROM client_pco_assignments 
        WHERE client_id = c.id AND status = 'active'
    )
ORDER BY 
    c.created_at ASC,
    recommended_pcos.recommendation_score DESC;

-- ============================================================================
-- 4. ASSIGNMENT HISTORY AND REPORTING
-- ============================================================================

-- 4.1 GET ASSIGNMENT ACTIVITY LOG
-- Description: Get recent assignment activities for audit trail
-- Method: GET /api/admin/assignments/activity?days=30
-- Required Data: days (optional, default 30)
-- Returns: Recent assignment changes

-- Assignment Activity Log SQL
SELECT 
    'assignment' as activity_type,
    ca.assigned_at as activity_date,
    c.company_name as client_name,
    pco.name as pco_name,
    assigned_by_user.name as performed_by,
    'assigned' as action,
    CONCAT(pco.name, ' assigned to ', c.company_name) as description
FROM client_pco_assignments ca
JOIN clients c ON ca.client_id = c.id
JOIN users pco ON ca.pco_id = pco.id
JOIN users assigned_by_user ON ca.assigned_by = assigned_by_user.id
WHERE ca.assigned_at >= DATE_SUB(NOW(), INTERVAL ? DAY)

UNION ALL

SELECT 
    'unassignment' as activity_type,
    ca.unassigned_at as activity_date,
    c.company_name as client_name,
    pco.name as pco_name,
    unassigned_by_user.name as performed_by,
    'unassigned' as action,
    CONCAT(pco.name, ' unassigned from ', c.company_name) as description
FROM client_pco_assignments ca
JOIN clients c ON ca.client_id = c.id
JOIN users pco ON ca.pco_id = pco.id
JOIN users unassigned_by_user ON ca.unassigned_by = unassigned_by_user.id
WHERE ca.unassigned_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
AND ca.unassigned_at IS NOT NULL

ORDER BY activity_date DESC
LIMIT 100;

-- Parameters:
-- ? = days (repeated twice)

-- 4.2 GET ASSIGNMENT PERFORMANCE METRICS
-- Description: Get performance metrics for assignments
-- Method: GET /api/admin/assignments/metrics?period=30
-- Required Data: period (days)
-- Returns: Assignment performance statistics

-- Assignment Performance Metrics SQL
SELECT 
    -- Assignment counts by period
    COUNT(DISTINCT ca.id) as total_assignments_period,
    COUNT(DISTINCT CASE WHEN ca.assigned_at >= DATE_SUB(NOW(), INTERVAL ? DAY) THEN ca.id END) as new_assignments,
    COUNT(DISTINCT CASE WHEN ca.unassigned_at >= DATE_SUB(NOW(), INTERVAL ? DAY) THEN ca.id END) as ended_assignments,
    
    -- Average assignment duration
    AVG(CASE WHEN ca.unassigned_at IS NOT NULL 
             THEN DATEDIFF(ca.unassigned_at, ca.assigned_at) 
             ELSE DATEDIFF(NOW(), ca.assigned_at) END) as avg_assignment_duration_days,
    
    -- Service performance
    AVG(reports_per_assignment.report_count) as avg_reports_per_assignment,
    AVG(reports_per_assignment.avg_days_between_reports) as avg_days_between_services,
    
    -- Client satisfaction (based on report approvals)
    (COUNT(CASE WHEN reports_summary.approval_rate >= 0.8 THEN 1 END) * 100.0 / COUNT(*)) as high_performance_assignments_pct,
    
    -- PCO utilization
    COUNT(DISTINCT ca.pco_id) as active_pcos,
    (COUNT(*) * 1.0 / COUNT(DISTINCT ca.pco_id)) as avg_assignments_per_pco

FROM client_pco_assignments ca
LEFT JOIN (
    SELECT 
        client_id,
        pco_id,
        COUNT(*) as report_count,
        AVG(DATEDIFF(
            LEAD(service_date) OVER (PARTITION BY client_id, pco_id ORDER BY service_date),
            service_date
        )) as avg_days_between_reports
    FROM reports
    WHERE service_date >= DATE_SUB(NOW(), INTERVAL ? DAY)
    GROUP BY client_id, pco_id
) reports_per_assignment ON ca.client_id = reports_per_assignment.client_id 
                        AND ca.pco_id = reports_per_assignment.pco_id
LEFT JOIN (
    SELECT 
        client_id,
        pco_id,
        (COUNT(CASE WHEN status = 'approved' THEN 1 END) * 1.0 / COUNT(*)) as approval_rate
    FROM reports
    WHERE service_date >= DATE_SUB(NOW(), INTERVAL ? DAY)
    GROUP BY client_id, pco_id
) reports_summary ON ca.client_id = reports_summary.client_id 
                  AND ca.pco_id = reports_summary.pco_id
WHERE 
    (ca.assigned_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
     OR ca.status = 'active');

-- Parameters:
-- ? = period (repeated 5 times)

-- ============================================================================
-- SAMPLE USAGE EXAMPLES
-- ============================================================================

/*
1. GET ALL ASSIGNMENTS:
   Input: page=1, pageSize=25, status="active", pco_id="all"
   Query: SELECT assignments with client and PCO details
   Output: Paginated list of active assignments with service statistics

2. BULK ASSIGN CLIENTS:
   Input: pco_id=5, client_ids=[10,15,20], assigned_by=1
   Query: Create multiple assignments and notify PCO
   Result: 3 clients assigned to PCO, notification sent

3. GET WORKLOAD DISTRIBUTION:
   Input: No parameters
   Query: Analyze PCO workloads and capacity
   Output: List of PCOs with assignment counts and workload status

4. TRANSFER ALL ASSIGNMENTS:
   Input: from_pco_id=3, to_pco_id=7, transferred_by=1
   Query: Unassign from source, assign to target
   Result: All assignments transferred, both PCOs notified

5. GET ASSIGNMENT RECOMMENDATIONS:
   Input: No parameters  
   Query: Match unassigned clients with optimal PCOs
   Output: Recommended client-PCO pairs with reasoning

6. GET ASSIGNMENT ACTIVITY:
   Input: days=30
   Query: Recent assignment/unassignment activities
   Output: Audit trail of assignment changes in last 30 days
*/