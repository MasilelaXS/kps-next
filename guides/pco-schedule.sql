-- ============================================================================
-- PCO SCHEDULE & HISTORY ENDPOINTS SQL STATEMENTS
-- KPS Pest Control Management System - Mobile App
-- Created: October 7, 2025
-- ============================================================================

-- ============================================================================
-- 1. SCHEDULE MANAGEMENT
-- ============================================================================

-- 1.1 GET ASSIGNED CLIENTS SCHEDULE
-- Description: Get list of assigned clients for PCO schedule
-- Method: GET /api/pco/schedule
-- Required Data: pco_id
-- Returns: List of assigned clients with service status

-- Get Assigned Clients SQL
SELECT 
    c.id,
    c.company_name,
    c.address_line1,
    c.address_line2,
    c.city,
    c.state,
    c.postal_code,
    c.phone,
    c.status,
    ca.assigned_at,
    -- Service indicators
    (SELECT COUNT(*) FROM reports WHERE client_id = c.id AND pco_id = ?) as total_reports,
    (SELECT MAX(service_date) FROM reports WHERE client_id = c.id AND pco_id = ?) as last_service_date,
    (SELECT COUNT(*) FROM reports WHERE client_id = c.id AND pco_id = ? AND status = 'draft') as draft_reports,
    (SELECT COUNT(*) FROM reports WHERE client_id = c.id AND pco_id = ? AND status = 'pending') as pending_reports,
    -- Priority calculation
    CASE 
        WHEN (SELECT COUNT(*) FROM reports WHERE client_id = c.id AND pco_id = ? AND status = 'draft') > 0 THEN 'has_draft'
        WHEN (SELECT MAX(service_date) FROM reports WHERE client_id = c.id AND pco_id = ?) IS NULL THEN 'never_serviced'
        WHEN (SELECT MAX(service_date) FROM reports WHERE client_id = c.id AND pco_id = ?) < DATE_SUB(CURDATE(), INTERVAL 45 DAY) THEN 'overdue'
        WHEN (SELECT MAX(service_date) FROM reports WHERE client_id = c.id AND pco_id = ?) < DATE_SUB(CURDATE(), INTERVAL 21 DAY) THEN 'due_soon'
        ELSE 'current'
    END as service_priority,
    -- Days since last service
    CASE 
        WHEN (SELECT MAX(service_date) FROM reports WHERE client_id = c.id AND pco_id = ?) IS NOT NULL 
        THEN DATEDIFF(CURDATE(), (SELECT MAX(service_date) FROM reports WHERE client_id = c.id AND pco_id = ?))
        ELSE DATEDIFF(CURDATE(), DATE(ca.assigned_at))
    END as days_since_service
FROM clients c
JOIN client_pco_assignments ca ON c.id = ca.client_id
WHERE ca.pco_id = ? 
AND ca.status = 'active'
AND c.deleted_at IS NULL
ORDER BY 
    -- Priority order: drafts first, then never serviced, overdue, due soon, current
    CASE 
        WHEN (SELECT COUNT(*) FROM reports WHERE client_id = c.id AND pco_id = ? AND status = 'draft') > 0 THEN 1
        WHEN (SELECT MAX(service_date) FROM reports WHERE client_id = c.id AND pco_id = ?) IS NULL THEN 2
        WHEN (SELECT MAX(service_date) FROM reports WHERE client_id = c.id AND pco_id = ?) < DATE_SUB(CURDATE(), INTERVAL 45 DAY) THEN 3
        WHEN (SELECT MAX(service_date) FROM reports WHERE client_id = c.id AND pco_id = ?) < DATE_SUB(CURDATE(), INTERVAL 21 DAY) THEN 4
        ELSE 5
    END,
    ca.assigned_at DESC;

-- Parameters:
-- ? = pco_id (repeated multiple times for calculations)

-- 1.2 GET CLIENT DETAILS FOR REPORT PREPARATION
-- Description: Get client details when starting a new report
-- Method: GET /api/pco/clients/{id}/details
-- Required Data: client_id, pco_id
-- Returns: Client details with contacts and last report data for pre-filling

-- Verify PCO assignment to client
SELECT 1 FROM client_pco_assignments 
WHERE client_id = ? AND pco_id = ? AND status = 'active';

-- Get Client Details SQL
SELECT 
    c.id,
    c.company_name,
    c.address_line1,
    c.address_line2,
    c.city,
    c.state,
    c.postal_code,
    c.phone,
    c.email,
    c.status,
    c.service_notes
FROM clients c
WHERE c.id = ? AND c.deleted_at IS NULL;

-- Get Client Contacts SQL
SELECT 
    id,
    name,
    email,
    phone,
    role,
    is_primary
FROM client_contacts 
WHERE client_id = ? AND deleted_at IS NULL
ORDER BY is_primary DESC, name;

-- Get Last Report for Pre-filling SQL
SELECT 
    r.id,
    r.report_type,
    r.service_date,
    r.next_service_date,
    r.general_remarks,
    r.status,
    -- Pre-fill data for new report
    GROUP_CONCAT(DISTINCT CONCAT(bs.station_number, ':', bs.location) SEPARATOR '|') as previous_stations,
    GROUP_CONCAT(DISTINCT fa.area_name SEPARATOR '|') as previous_areas,
    GROUP_CONCAT(DISTINCT ftp.pest_name SEPARATOR '|') as previous_pests
FROM reports r
LEFT JOIN bait_stations bs ON r.id = bs.report_id
LEFT JOIN fumigation_areas fa ON r.id = fa.report_id
LEFT JOIN fumigation_target_pests ftp ON r.id = ftp.report_id
WHERE r.client_id = ? 
AND r.pco_id = ?
AND r.status IN ('approved', 'archived')
GROUP BY r.id
ORDER BY r.service_date DESC
LIMIT 1;

-- Parameters:
-- ? = client_id, pco_id (for verification)
-- ? = client_id (for details and contacts)
-- ? = client_id, pco_id (for last report)

-- 1.3 GET SERVICE HISTORY FOR CLIENT
-- Description: Get service history for specific client
-- Method: GET /api/pco/clients/{id}/history
-- Required Data: client_id, pco_id
-- Returns: Service history with report summaries

-- Verify PCO assignment (current or historical)
SELECT 1 FROM client_pco_assignments 
WHERE client_id = ? AND pco_id = ?;

-- Get Service History SQL
SELECT 
    r.id,
    r.report_type,
    r.service_date,
    r.next_service_date,
    r.status,
    r.general_remarks,
    r.client_signature_name,
    r.created_at,
    r.submitted_at,
    r.reviewed_at,
    -- Summary statistics
    (SELECT COUNT(*) FROM bait_stations WHERE report_id = r.id) as bait_stations_count,
    (SELECT COUNT(*) FROM fumigation_areas WHERE report_id = r.id) as fumigation_areas_count,
    (SELECT COUNT(DISTINCT chemical_id) FROM station_chemicals sc 
     JOIN bait_stations bs ON sc.station_id = bs.id 
     WHERE bs.report_id = r.id) as bait_chemicals_count,
    (SELECT COUNT(DISTINCT chemical_id) FROM fumigation_chemicals WHERE report_id = r.id) as fumigation_chemicals_count
FROM reports r
WHERE r.client_id = ? AND r.pco_id = ?
ORDER BY r.service_date DESC
LIMIT 20;

-- Parameters:
-- ? = client_id, pco_id (for verification and main query)

-- ============================================================================
-- 2. REPORT HISTORY AND STATUS
-- ============================================================================

-- 2.1 GET PCO REPORT HISTORY
-- Description: Get all reports created by PCO with pagination
-- Method: GET /api/pco/reports/history?page=1&pageSize=25&status=all
-- Required Data: pco_id, page, pageSize, status_filter
-- Returns: Paginated report history

-- Get Reports Count SQL
SELECT COUNT(*) as total_count 
FROM reports 
WHERE pco_id = ?
AND CASE WHEN ? != 'all' THEN status = ? ELSE 1=1 END;

-- Get Reports History SQL
SELECT 
    r.id,
    r.report_type,
    r.service_date,
    r.next_service_date,
    r.status,
    r.created_at,
    r.submitted_at,
    r.reviewed_at,
    c.company_name,
    c.city,
    -- Status-specific information
    CASE 
        WHEN r.status = 'declined' THEN r.admin_notes 
        ELSE NULL 
    END as admin_notes,
    CASE 
        WHEN r.status = 'draft' THEN DATEDIFF(CURDATE(), DATE(r.created_at))
        ELSE NULL
    END as days_in_draft,
    -- Assignment status at time of report
    CASE 
        WHEN r.status = 'pending' THEN 'unassigned_pending_review'
        WHEN r.status IN ('approved', 'archived') THEN 'completed'
        WHEN r.status = 'declined' THEN 'needs_revision'
        ELSE 'in_progress'
    END as assignment_status
FROM reports r
JOIN clients c ON r.client_id = c.id
WHERE r.pco_id = ?
AND CASE WHEN ? != 'all' THEN r.status = ? ELSE 1=1 END
ORDER BY r.created_at DESC
LIMIT ? OFFSET ?;

-- Parameters:
-- ? = pco_id, status_filter (for count)
-- ? = pco_id, status_filter (for main query)
-- ? = pageSize, offset

-- 2.2 GET REPORT DETAILS WITH COMPLETE DATA
-- Description: Get complete report details for viewing/editing
-- Method: GET /api/pco/reports/{id}
-- Required Data: report_id, pco_id
-- Returns: Complete report data with all components

-- Verify report ownership
SELECT id FROM reports 
WHERE id = ? AND pco_id = ?;

-- Get Report Basic Info SQL
SELECT 
    r.id,
    r.client_id,
    r.report_type,
    r.service_date,
    r.next_service_date,
    r.status,
    r.general_remarks,
    r.pco_signature_data,
    r.client_signature_data,
    r.client_signature_name,
    r.admin_notes,
    r.created_at,
    r.submitted_at,
    r.reviewed_at,
    c.company_name,
    c.address_line1,
    c.city
FROM reports r
JOIN clients c ON r.client_id = c.id
WHERE r.id = ?;

-- Get Bait Stations with Chemicals SQL
SELECT 
    bs.id as station_id,
    bs.station_number,
    bs.location,
    bs.is_accessible,
    bs.inaccessible_reason,
    bs.activity_detected,
    bs.activity_droppings,
    bs.activity_gnawing,
    bs.activity_tracks,
    bs.activity_other,
    bs.activity_other_description,
    bs.bait_status,
    bs.station_condition,
    bs.rodent_box_replaced,
    bs.station_remarks,
    -- Chemicals used in this station
    GROUP_CONCAT(
        CONCAT(c.name, ':', sc.quantity, ':', COALESCE(sc.batch_number, ''))
        SEPARATOR '|'
    ) as chemicals_used
FROM bait_stations bs
LEFT JOIN station_chemicals sc ON bs.id = sc.station_id
LEFT JOIN chemicals c ON sc.chemical_id = c.id
WHERE bs.report_id = ?
GROUP BY bs.id
ORDER BY bs.location, bs.station_number;

-- Get Fumigation Data SQL  
SELECT 
    (SELECT GROUP_CONCAT(area_name SEPARATOR '|') FROM fumigation_areas WHERE report_id = ?) as areas,
    (SELECT GROUP_CONCAT(pest_name SEPARATOR '|') FROM fumigation_target_pests WHERE report_id = ?) as target_pests,
    (SELECT GROUP_CONCAT(CONCAT(c.name, ':', fc.quantity, ':', COALESCE(fc.batch_number, '')) SEPARATOR '|')
     FROM fumigation_chemicals fc 
     JOIN chemicals c ON fc.chemical_id = c.id 
     WHERE fc.report_id = ?) as chemicals_used;

-- Get Insect Monitors SQL
SELECT 
    id as monitor_id,
    monitor_type,
    glue_board_replaced,
    tubes_replaced,
    monitor_serviced
FROM insect_monitors 
WHERE report_id = ?
ORDER BY monitor_type;

-- Parameters:
-- ? = report_id, pco_id (for verification)
-- ? = report_id (for all detail queries)

-- ============================================================================
-- 3. WORK STATISTICS AND PERFORMANCE
-- ============================================================================

-- 3.1 GET PCO WORK STATISTICS
-- Description: Get work statistics for PCO performance tracking
-- Method: GET /api/pco/stats?period=30
-- Required Data: pco_id, period (days, optional)
-- Returns: Work performance statistics

-- Get Work Statistics SQL
SELECT 
    -- Current assignments
    (SELECT COUNT(*) FROM client_pco_assignments WHERE pco_id = ? AND status = 'active') as current_assignments,
    
    -- Report statistics for period
    COUNT(CASE WHEN r.created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY) THEN 1 END) as reports_created_period,
    COUNT(CASE WHEN r.submitted_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY) THEN 1 END) as reports_submitted_period,
    COUNT(CASE WHEN r.status = 'approved' AND r.reviewed_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY) THEN 1 END) as reports_approved_period,
    COUNT(CASE WHEN r.status = 'declined' AND r.reviewed_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY) THEN 1 END) as reports_declined_period,
    
    -- Current status counts
    COUNT(CASE WHEN r.status = 'draft' THEN 1 END) as current_drafts,
    COUNT(CASE WHEN r.status = 'pending' THEN 1 END) as reports_pending_review,
    COUNT(CASE WHEN r.status = 'declined' THEN 1 END) as reports_needing_revision,
    
    -- Performance metrics
    AVG(CASE WHEN r.submitted_at IS NOT NULL AND r.submitted_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
             THEN TIMESTAMPDIFF(HOUR, r.created_at, r.submitted_at) END) as avg_completion_hours,
    
    -- Service frequency
    COUNT(DISTINCT CASE WHEN r.service_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY) 
                        THEN r.client_id END) as unique_clients_served_period,
    
    -- Approval rate
    CASE 
        WHEN COUNT(CASE WHEN r.reviewed_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY) THEN 1 END) > 0
        THEN (COUNT(CASE WHEN r.status = 'approved' AND r.reviewed_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY) THEN 1 END) * 100.0 /
              COUNT(CASE WHEN r.reviewed_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY) THEN 1 END))
        ELSE NULL
    END as approval_rate_percent
    
FROM reports r
WHERE r.pco_id = ?;

-- Parameters:
-- ? = pco_id, period (repeated multiple times)

-- 3.2 GET MONTHLY PERFORMANCE TRENDS
-- Description: Get monthly performance trends for PCO
-- Method: GET /api/pco/stats/trends?months=6
-- Required Data: pco_id, months (optional, default 6)
-- Returns: Monthly statistics for trend analysis

-- Get Monthly Trends SQL
SELECT 
    DATE_FORMAT(r.service_date, '%Y-%m') as month,
    COUNT(*) as total_services,
    COUNT(CASE WHEN r.status = 'approved' THEN 1 END) as approved_services,
    COUNT(CASE WHEN r.status = 'declined' THEN 1 END) as declined_services,
    COUNT(DISTINCT r.client_id) as unique_clients_served,
    AVG(TIMESTAMPDIFF(HOUR, r.created_at, r.submitted_at)) as avg_completion_hours,
    -- Service type breakdown
    COUNT(CASE WHEN r.report_type = 'bait_inspection' THEN 1 END) as bait_only_services,
    COUNT(CASE WHEN r.report_type = 'fumigation' THEN 1 END) as fumigation_only_services,
    COUNT(CASE WHEN r.report_type = 'both' THEN 1 END) as combined_services
FROM reports r
WHERE r.pco_id = ? 
AND r.service_date >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
AND r.service_date IS NOT NULL
GROUP BY DATE_FORMAT(r.service_date, '%Y-%m')
ORDER BY month DESC;

-- Parameters:
-- ? = pco_id, months

-- ============================================================================
-- 4. CLIENT RELATIONSHIP TRACKING
-- ============================================================================

-- 4.1 GET CLIENT SERVICE PATTERNS
-- Description: Get service patterns for each assigned client
-- Method: GET /api/pco/clients/patterns
-- Required Data: pco_id
-- Returns: Service patterns and client relationship data

-- Get Client Service Patterns SQL
SELECT 
    c.id,
    c.company_name,
    c.city,
    ca.assigned_at,
    -- Service statistics
    COUNT(r.id) as total_services,
    MIN(r.service_date) as first_service_date,
    MAX(r.service_date) as last_service_date,
    AVG(DATEDIFF(
        LEAD(r.service_date) OVER (PARTITION BY r.client_id ORDER BY r.service_date),
        r.service_date
    )) as avg_days_between_services,
    -- Service type preferences
    COUNT(CASE WHEN r.report_type = 'bait_inspection' THEN 1 END) as bait_services,
    COUNT(CASE WHEN r.report_type = 'fumigation' THEN 1 END) as fumigation_services,
    COUNT(CASE WHEN r.report_type = 'both' THEN 1 END) as combined_services,
    -- Quality indicators
    COUNT(CASE WHEN r.status = 'approved' THEN 1 END) as approved_reports,
    COUNT(CASE WHEN r.status = 'declined' THEN 1 END) as declined_reports,
    -- Current status
    CASE 
        WHEN MAX(r.service_date) < DATE_SUB(CURDATE(), INTERVAL 45 DAY) THEN 'overdue'
        WHEN MAX(r.service_date) < DATE_SUB(CURDATE(), INTERVAL 21 DAY) THEN 'due_soon'
        WHEN COUNT(CASE WHEN r.status = 'draft' THEN 1 END) > 0 THEN 'has_draft'
        ELSE 'current'
    END as service_status
FROM clients c
JOIN client_pco_assignments ca ON c.id = ca.client_id
LEFT JOIN reports r ON c.id = r.client_id AND r.pco_id = ca.pco_id
WHERE ca.pco_id = ? AND ca.status = 'active' AND c.deleted_at IS NULL
GROUP BY c.id, c.company_name, c.city, ca.assigned_at
ORDER BY 
    CASE 
        WHEN COUNT(CASE WHEN r.status = 'draft' THEN 1 END) > 0 THEN 1
        WHEN MAX(r.service_date) < DATE_SUB(CURDATE(), INTERVAL 45 DAY) THEN 2
        WHEN MAX(r.service_date) < DATE_SUB(CURDATE(), INTERVAL 21 DAY) THEN 3
        ELSE 4
    END,
    ca.assigned_at DESC;

-- Parameters:
-- ? = pco_id

-- ============================================================================
-- 5. OFFLINE DATA MANAGEMENT
-- ============================================================================

-- 5.1 GET DRAFT REPORTS FOR OFFLINE EDITING
-- Description: Get all draft reports for offline editing capability
-- Method: GET /api/pco/drafts
-- Required Data: pco_id
-- Returns: Complete draft reports with all components

-- Get Draft Reports with Complete Data SQL
SELECT 
    r.id,
    r.client_id,
    r.report_type,
    r.service_date,
    r.next_service_date,
    r.general_remarks,
    r.pco_signature_data,
    r.client_signature_data,
    r.client_signature_name,
    r.created_at,
    r.updated_at,
    c.company_name,
    c.address_line1,
    c.city,
    -- Days since creation (for priority)
    DATEDIFF(CURDATE(), DATE(r.created_at)) as days_since_created
FROM reports r
JOIN clients c ON r.client_id = c.id
WHERE r.pco_id = ? AND r.status = 'draft'
ORDER BY r.created_at DESC;

-- For each draft report, also get associated data:
-- (This would be called for each draft report ID)

-- Get Draft Report Bait Stations SQL
SELECT 
    bs.id,
    bs.station_number,
    bs.location,
    bs.is_accessible,
    bs.activity_detected,
    bs.bait_status,
    bs.station_condition,
    bs.rodent_box_replaced,
    bs.station_remarks,
    GROUP_CONCAT(CONCAT(c.name, ':', sc.quantity) SEPARATOR '|') as chemicals
FROM bait_stations bs
LEFT JOIN station_chemicals sc ON bs.id = sc.station_id
LEFT JOIN chemicals c ON sc.chemical_id = c.id
WHERE bs.report_id = ?
GROUP BY bs.id
ORDER BY bs.location, bs.station_number;

-- Parameters:
-- ? = pco_id (for draft reports)
-- ? = report_id (for each draft's components)

-- ============================================================================
-- SAMPLE USAGE EXAMPLES
-- ============================================================================

/*
1. GET SCHEDULE:
   Input: pco_id=2
   Query: SELECT clients with service priority indicators
   Output: List of assigned clients with priority flags and service history

2. GET CLIENT DETAILS FOR NEW REPORT:
   Input: client_id=10, pco_id=2
   Query: SELECT client info, contacts, and last report for pre-filling
   Output: Complete client profile with previous service data

3. GET REPORT HISTORY:
   Input: pco_id=2, page=1, pageSize=25, status="all"
   Query: SELECT paginated report history with client information
   Output: {"total": 45, "reports": [...], "page": 1}

4. GET PERFORMANCE STATISTICS:
   Input: pco_id=2, period=30
   Query: SELECT work statistics for last 30 days
   Output: {"reports_created": 12, "approval_rate": 87.5, "avg_completion_hours": 4.2}

5. GET CLIENT SERVICE PATTERNS:
   Input: pco_id=2
   Query: SELECT service patterns for all assigned clients
   Output: Client list with service frequency and quality metrics

6. GET DRAFT REPORTS:
   Input: pco_id=2
   Query: SELECT all draft reports with complete data for offline editing
   Output: List of drafts with all components for mobile app offline capability
*/