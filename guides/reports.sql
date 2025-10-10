-- ============================================================================
-- REPORT MANAGEMENT ENDPOINTS SQL STATEMENTS
-- KPS Pest Control Management System
-- Created: October 7, 2025
-- ============================================================================

-- ============================================================================
-- 1. REPORT LISTING AND FILTERING ENDPOINTS
-- ============================================================================

-- 1.1 GET ALL REPORTS (ADMIN VIEW)
-- Description: Get paginated list of all reports with filtering
-- Method: GET /api/admin/reports?page=1&pageSize=25&status=all&pco_id=all
-- Required Data: page, pageSize, status_filter, pco_filter
-- Returns: Paginated report list with client and PCO details

-- Get Reports Count
SELECT COUNT(*) as total_count 
FROM reports r
JOIN clients c ON r.client_id = c.id
JOIN users u ON r.pco_id = u.id
WHERE 
    CASE 
        WHEN ? = 'pending' THEN r.status = 'pending'
        WHEN ? = 'approved' THEN r.status = 'approved'
        WHEN ? = 'declined' THEN r.status = 'declined'
        WHEN ? = 'draft' THEN r.status = 'draft'
        WHEN ? = 'archived' THEN r.status = 'archived'
        ELSE 1=1 
    END
    AND CASE 
        WHEN ? != 'all' THEN r.pco_id = ?
        ELSE 1=1 
    END;

-- Get Reports List SQL
SELECT 
    r.id,
    r.report_type,
    r.service_date,
    r.next_service_date,
    r.status,
    r.created_at,
    r.submitted_at,
    r.reviewed_at,
    c.id as client_id,
    c.company_name,
    c.city,
    u.id as pco_id,
    u.name as pco_name,
    u.pco_number as pco_number,
    CASE WHEN r.status = 'declined' THEN r.admin_notes ELSE NULL END as admin_notes,
    -- Count bait stations
    (SELECT COUNT(*) FROM bait_stations WHERE report_id = r.id) as bait_stations_count,
    -- Count fumigation areas
    (SELECT COUNT(*) FROM fumigation_areas WHERE report_id = r.id) as fumigation_areas_count,
    -- Check for signatures
    CASE WHEN r.pco_signature_data IS NOT NULL THEN 1 ELSE 0 END as has_pco_signature,
    CASE WHEN r.client_signature_data IS NOT NULL THEN 1 ELSE 0 END as has_client_signature
FROM reports r
JOIN clients c ON r.client_id = c.id
JOIN users u ON r.pco_id = u.id
WHERE 
    CASE 
        WHEN ? = 'pending' THEN r.status = 'pending'
        WHEN ? = 'approved' THEN r.status = 'approved'
        WHEN ? = 'declined' THEN r.status = 'declined'
        WHEN ? = 'draft' THEN r.status = 'draft'
        WHEN ? = 'archived' THEN r.status = 'archived'
        ELSE 1=1 
    END
    AND CASE 
        WHEN ? != 'all' THEN r.pco_id = ?
        ELSE 1=1 
    END
ORDER BY 
    CASE r.status 
        WHEN 'pending' THEN 1
        WHEN 'declined' THEN 2
        WHEN 'draft' THEN 3
        WHEN 'approved' THEN 4
        WHEN 'archived' THEN 5
    END,
    r.submitted_at DESC,
    r.created_at DESC
LIMIT ? OFFSET ?;

-- Parameters:
-- ? = status_filter (repeated for count and main query)
-- ? = pco_filter, pco_id (for PCO filtering)
-- ? = pageSize, offset

-- 1.2 GET PENDING REPORTS (PRIORITY VIEW)
-- Description: Get reports pending admin review
-- Method: GET /api/admin/reports/pending
-- Required Data: None
-- Returns: Reports awaiting review with priority sorting

-- Get Pending Reports SQL
SELECT 
    r.id,
    r.report_type,
    r.service_date,
    r.submitted_at,
    c.company_name,
    c.city,
    u.name as pco_name,
    DATEDIFF(NOW(), r.submitted_at) as days_pending,
    -- Count bait stations
    (SELECT COUNT(*) FROM bait_stations WHERE report_id = r.id) as bait_stations_count,
    -- Count fumigation areas  
    (SELECT COUNT(*) FROM fumigation_areas WHERE report_id = r.id) as fumigation_areas_count,
    -- Priority score (older submissions get higher priority)
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
    DATEDIFF(NOW(), r.submitted_at) DESC,  -- Oldest first
    r.submitted_at ASC;

-- Parameters: None

-- 1.3 SEARCH REPORTS
-- Description: Search reports by various criteria
-- Method: GET /api/reports/search?q=searchterm&type=client_name
-- Required Data: search_term, search_type
-- Returns: Matching reports

-- Search Reports SQL
SELECT 
    r.id,
    r.report_type,
    r.service_date,
    r.status,
    c.company_name,
    u.name as pco_name,
    r.created_at
FROM reports r
JOIN clients c ON r.client_id = c.id
JOIN users u ON r.pco_id = u.id
WHERE 
    CASE 
        WHEN ? = 'client_name' THEN c.company_name LIKE CONCAT('%', ?, '%')
        WHEN ? = 'pco_name' THEN u.name LIKE CONCAT('%', ?, '%')
        WHEN ? = 'report_id' THEN r.id = ?
        WHEN ? = 'city' THEN c.city LIKE CONCAT('%', ?, '%')
        WHEN ? = 'general' THEN (
            c.company_name LIKE CONCAT('%', ?, '%')
            OR u.name LIKE CONCAT('%', ?, '%')
            OR r.general_remarks LIKE CONCAT('%', ?, '%')
        )
        ELSE 1=1
    END
    AND r.status != 'draft'  -- Don't include drafts in search
ORDER BY r.service_date DESC
LIMIT 50;

-- Parameters:
-- ? = search_type, search_term (repeated based on type)

-- ============================================================================
-- 2. REPORT REVIEW AND APPROVAL ENDPOINTS
-- ============================================================================

-- 2.1 GET REPORT DETAILS FOR REVIEW
-- Description: Get complete report details for admin review
-- Method: GET /api/admin/reports/{id}/review
-- Required Data: report_id
-- Returns: Complete report data for review

-- Verify report exists and is pending
SELECT id, status FROM reports WHERE id = ? AND status = 'pending';

-- Get Report Header SQL
SELECT 
    r.*,
    c.company_name,
    c.address_line1,
    c.address_line2,
    c.city,
    c.state,
    c.postal_code,
    u.name as pco_name,
    u.pco_number as pco_number,
    u.email as pco_email
FROM reports r
JOIN clients c ON r.client_id = c.id
JOIN users u ON r.pco_id = u.id
WHERE r.id = ?;

-- Get Client Contacts
SELECT 
    name,
    email,
    phone,
    role,
    is_primary
FROM client_contacts 
WHERE client_id = (SELECT client_id FROM reports WHERE id = ?)
ORDER BY is_primary DESC, name;

-- Get Bait Stations with Chemicals
SELECT 
    bs.id,
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
    GROUP_CONCAT(
        CONCAT(ch.name, '|', sc.quantity, '|', COALESCE(sc.batch_number, '')) 
        ORDER BY ch.name
        SEPARATOR '||'
    ) as chemicals
FROM bait_stations bs
LEFT JOIN station_chemicals sc ON bs.id = sc.station_id
LEFT JOIN chemicals ch ON sc.chemical_id = ch.id
WHERE bs.report_id = ?
GROUP BY bs.id
ORDER BY bs.location, bs.station_number;

-- Get Fumigation Areas
SELECT area_name, is_other, other_description
FROM fumigation_areas 
WHERE report_id = ?
ORDER BY area_name;

-- Get Fumigation Target Pests
SELECT pest_name, is_other, other_description
FROM fumigation_target_pests 
WHERE report_id = ?
ORDER BY pest_name;

-- Get Fumigation Chemicals
SELECT 
    ch.name,
    fc.quantity,
    fc.batch_number,
    ch.active_ingredients,
    ch.safety_information
FROM fumigation_chemicals fc
JOIN chemicals ch ON fc.chemical_id = ch.id
WHERE fc.report_id = ?
ORDER BY ch.name;

-- Get Insect Monitors
SELECT 
    monitor_type,
    glue_board_replaced,
    tubes_replaced,
    monitor_serviced
FROM insect_monitors 
WHERE report_id = ?
ORDER BY monitor_type;

-- Parameters:
-- ? = report_id (for all queries)

-- 2.2 APPROVE REPORT
-- Description: Approve a pending report
-- Method: PUT /api/admin/reports/{id}/approve
-- Required Data: report_id, admin_id, admin_notes (optional)
-- Returns: Success message

-- Verify report is pending
SELECT id FROM reports WHERE id = ? AND status = 'pending';

-- Use stored procedure for approval
CALL ApproveReport(?, ?, ?);

-- Parameters:
-- ? = report_id (for verification)
-- ? = report_id, admin_id, admin_notes

-- 2.3 DECLINE REPORT
-- Description: Decline a pending report with feedback
-- Method: PUT /api/admin/reports/{id}/decline
-- Required Data: report_id, admin_id, admin_notes (required)
-- Returns: Success message

-- Verify report is pending
SELECT id FROM reports WHERE id = ? AND status = 'pending';

-- Decline Report SQL
UPDATE reports 
SET 
    status = 'declined',
    admin_notes = ?,
    reviewed_by = ?,
    reviewed_at = NOW(),
    updated_at = NOW()
WHERE id = ? AND status = 'pending';

-- Reassign PCO to client
UPDATE client_pco_assignments 
SET status = 'active', assigned_at = NOW()
WHERE client_id = (SELECT client_id FROM reports WHERE id = ?) 
AND pco_id = (SELECT pco_id FROM reports WHERE id = ?);

-- Create notification for PCO
INSERT INTO notifications (user_id, type, title, message) 
SELECT 
    pco_id,
    'report_declined',
    'Report Declined - Revision Required',
    CONCAT('Your report for ', c.company_name, ' has been declined. Please review the feedback and resubmit.')
FROM reports r
JOIN clients c ON r.client_id = c.id
WHERE r.id = ?;

-- Parameters:
-- ? = report_id (for verification)
-- ? = admin_notes, admin_id, report_id
-- ? = report_id (repeated for reassignment and notification)

-- ============================================================================
-- 3. REPORT ANALYTICS ENDPOINTS
-- ============================================================================

-- 3.1 GET REPORTS DASHBOARD METRICS
-- Description: Get report statistics for admin dashboard
-- Method: GET /api/admin/reports/metrics
-- Required Data: None
-- Returns: Report statistics and trends

-- Report Metrics SQL
SELECT 
    (SELECT COUNT(*) FROM reports WHERE status = 'pending') as pending_reports,
    (SELECT COUNT(*) FROM reports WHERE status = 'approved') as approved_reports,
    (SELECT COUNT(*) FROM reports WHERE status = 'declined') as declined_reports,
    (SELECT COUNT(*) FROM reports WHERE DATE(created_at) = CURDATE()) as reports_today,
    (SELECT COUNT(*) FROM reports WHERE DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)) as reports_this_week,
    (SELECT COUNT(*) FROM reports WHERE DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)) as reports_this_month,
    (SELECT AVG(DATEDIFF(reviewed_at, submitted_at)) 
     FROM reports 
     WHERE reviewed_at IS NOT NULL AND submitted_at IS NOT NULL) as avg_review_time_days,
    (SELECT COUNT(*) FROM reports 
     WHERE status = 'pending' AND DATEDIFF(NOW(), submitted_at) >= 3) as overdue_reviews;

-- Parameters: None

-- 3.2 GET REPORTS BY DATE RANGE
-- Description: Get report statistics for specific date range
-- Method: GET /api/admin/reports/analytics?start_date=2025-10-01&end_date=2025-10-31
-- Required Data: start_date, end_date
-- Returns: Report analytics for date range

-- Reports Analytics SQL
SELECT 
    DATE(service_date) as report_date,
    COUNT(*) as total_reports,
    SUM(CASE WHEN report_type = 'bait_inspection' THEN 1 ELSE 0 END) as bait_reports,
    SUM(CASE WHEN report_type = 'fumigation' THEN 1 ELSE 0 END) as fumigation_reports,
    SUM(CASE WHEN report_type = 'both' THEN 1 ELSE 0 END) as combined_reports,
    COUNT(DISTINCT pco_id) as active_pcos,
    COUNT(DISTINCT client_id) as clients_served
FROM reports 
WHERE 
    service_date >= ? 
    AND service_date <= ?
    AND status IN ('approved', 'archived')
GROUP BY DATE(service_date)
ORDER BY report_date DESC;

-- Parameters:
-- ? = start_date, end_date

-- 3.3 GET PCO PERFORMANCE METRICS
-- Description: Get performance statistics per PCO
-- Method: GET /api/admin/reports/pco-performance
-- Required Data: None
-- Returns: PCO performance metrics

-- PCO Performance Metrics SQL
SELECT 
    u.id,
    u.name,
    u.pco_number,
    COUNT(r.id) as total_reports,
    SUM(CASE WHEN r.status = 'approved' THEN 1 ELSE 0 END) as approved_reports,
    SUM(CASE WHEN r.status = 'declined' THEN 1 ELSE 0 END) as declined_reports,
    SUM(CASE WHEN r.status = 'pending' THEN 1 ELSE 0 END) as pending_reports,
    ROUND(
        (SUM(CASE WHEN r.status = 'approved' THEN 1 ELSE 0 END) * 100.0) / 
        NULLIF(COUNT(r.id), 0), 2
    ) as approval_rate,
    AVG(DATEDIFF(r.reviewed_at, r.submitted_at)) as avg_review_time,
    COUNT(DISTINCT r.client_id) as unique_clients_served,
    MAX(r.service_date) as last_report_date
FROM users u
LEFT JOIN reports r ON u.id = r.pco_id AND r.status != 'draft'
WHERE u.role = 'pco' AND u.status = 'active'
GROUP BY u.id, u.name, u.pco_number
HAVING COUNT(r.id) > 0
ORDER BY approval_rate DESC, total_reports DESC;

-- Parameters: None

-- ============================================================================
-- 4. REPORT EXPORT ENDPOINTS
-- ============================================================================

-- 4.1 EXPORT REPORT DATA
-- Description: Export complete report data for external analysis
-- Method: GET /api/admin/reports/{id}/export?format=pdf
-- Required Data: report_id, format
-- Returns: Complete report data formatted for export

-- Verify report exists and is approved/archived
SELECT id FROM reports WHERE id = ? AND status IN ('approved', 'archived');

-- Export Report Data SQL - Same as review endpoint but includes all data
-- Use the report review queries from section 2.1

-- Additional data for export
SELECT 
    'export_metadata' as data_type,
    NOW() as exported_at,
    ? as exported_by,
    r.status,
    DATEDIFF(CURDATE(), r.service_date) as days_since_service
FROM reports r
WHERE r.id = ?;

-- Parameters:
-- ? = report_id (for verification)
-- ? = admin_id, report_id (for metadata)

-- 4.2 BULK EXPORT REPORTS
-- Description: Export multiple reports as CSV/Excel data
-- Method: POST /api/admin/reports/bulk-export
-- Required Data: report_ids array, format
-- Returns: Bulk report data

-- Bulk Export Reports SQL
SELECT 
    r.id,
    r.report_type,
    r.service_date,
    r.next_service_date,
    r.status,
    r.general_remarks,
    c.company_name,
    c.address_line1,
    c.city,
    c.state,
    u.name as pco_name,
    r.created_at,
    r.submitted_at,
    r.reviewed_at,
    -- Bait station summary
    (SELECT COUNT(*) FROM bait_stations WHERE report_id = r.id) as total_bait_stations,
    (SELECT COUNT(*) FROM bait_stations WHERE report_id = r.id AND activity_detected = 1) as stations_with_activity,
    -- Chemical usage summary
    (SELECT COUNT(DISTINCT sc.chemical_id) 
     FROM station_chemicals sc 
     JOIN bait_stations bs ON sc.station_id = bs.id 
     WHERE bs.report_id = r.id) as unique_chemicals_used,
    -- Fumigation summary
    (SELECT COUNT(*) FROM fumigation_areas WHERE report_id = r.id) as fumigation_areas_count,
    -- Signature status
    CASE WHEN r.client_signature_data IS NOT NULL THEN 'Yes' ELSE 'No' END as client_signed
FROM reports r
JOIN clients c ON r.client_id = c.id
JOIN users u ON r.pco_id = u.id
WHERE r.id IN (?, ?, ?, ?)  -- Expand based on array size
ORDER BY r.service_date DESC;

-- Parameters:
-- ? = report_ids (expand based on array size)

-- ============================================================================
-- 5. REPORT ARCHIVING ENDPOINTS
-- ============================================================================

-- 5.1 ARCHIVE OLD REPORTS
-- Description: Archive reports older than specified period
-- Method: PUT /api/admin/reports/archive
-- Required Data: cutoff_date, admin_id
-- Returns: Count of archived reports

-- Get reports to archive
SELECT COUNT(*) as reports_to_archive
FROM reports 
WHERE 
    status = 'approved' 
    AND service_date < ?
    AND status != 'archived';

-- Archive Reports SQL
UPDATE reports 
SET 
    status = 'archived',
    updated_at = NOW()
WHERE 
    status = 'approved' 
    AND service_date < ?;

-- Get archived count
SELECT ROW_COUNT() as archived_count;

-- Parameters:
-- ? = cutoff_date (repeated)

-- 5.2 GET ARCHIVED REPORTS
-- Description: Get list of archived reports
-- Method: GET /api/admin/reports/archived?page=1&pageSize=25
-- Required Data: page, pageSize
-- Returns: Paginated archived reports

-- Get Archived Reports Count
SELECT COUNT(*) FROM reports WHERE status = 'archived';

-- Get Archived Reports SQL
SELECT 
    r.id,
    r.report_type,
    r.service_date,
    r.reviewed_at,
    c.company_name,
    u.name as pco_name,
    DATEDIFF(CURDATE(), r.service_date) as days_old
FROM reports r
JOIN clients c ON r.client_id = c.id
JOIN users u ON r.pco_id = u.id
WHERE r.status = 'archived'
ORDER BY r.service_date DESC
LIMIT ? OFFSET ?;

-- Parameters:
-- ? = pageSize, offset

-- ============================================================================
-- SAMPLE USAGE EXAMPLES
-- ============================================================================

/*
1. GET PENDING REPORTS:
   Query: SELECT COUNT(*) FROM reports WHERE status = 'pending';
   Output: {"pending_reports": 5}

2. APPROVE REPORT:
   Input: report_id=15, admin_id=1, notes="Good work"
   Query: CALL ApproveReport(15, 1, 'Good work');
   Result: Report approved, PCO unassigned, notifications sent

3. SEARCH REPORTS BY CLIENT:
   Input: search_type="client_name", search_term="ABC Company"
   Query: SELECT * FROM reports r JOIN clients c ON r.client_id = c.id WHERE c.company_name LIKE '%ABC Company%';
   Output: Matching report records

4. GET PERFORMANCE METRICS:
   Query: Complex join calculating approval rates and statistics per PCO
   Output: Performance statistics for all active PCOs

5. EXPORT REPORT:
   Input: report_id=15, admin_id=1
   Query: Multiple queries to gather complete report data for export
   Output: Complete report dataset ready for PDF/Excel generation
*/