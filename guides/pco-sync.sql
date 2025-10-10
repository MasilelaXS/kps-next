-- ============================================================================
-- PCO DATA SYNCHRONIZATION ENDPOINTS SQL STATEMENTS
-- KPS Pest Control Management System - Mobile App
-- Created: October 7, 2025
-- ============================================================================

-- ============================================================================
-- 1. FULL DATA SYNCHRONIZATION
-- ============================================================================

-- 1.1 FULL DATA SYNC (LOGIN SYNC)
-- Description: Get all data needed for offline operation
-- Method: GET /api/pco/sync/full
-- Required Data: pco_id
-- Returns: Complete offline dataset

-- Use optimized stored procedure for full sync
CALL GetPCOSyncData(?);

-- Alternative individual queries if stored procedure is not available:

-- 1.2 GET ASSIGNED CLIENTS WITH CONTACTS
-- Description: Get all assigned clients with contact information
-- Method: GET /api/pco/sync/clients
-- Required Data: pco_id
-- Returns: Clients with embedded contact data

-- Get Assigned Clients with Contacts SQL
SELECT 
    c.id,
    c.company_name,
    c.address_line1,
    c.address_line2,
    c.city,
    c.state,
    c.postal_code,
    c.status,
    c.service_notes,
    ca.assigned_at,
    -- Embedded contacts as concatenated string for mobile parsing
    GROUP_CONCAT(
        CONCAT(
            COALESCE(cc.name, ''), '|',
            COALESCE(cc.email, ''), '|',
            COALESCE(cc.phone, ''), '|',
            COALESCE(cc.role, ''), '|',
            COALESCE(cc.is_primary, 0)
        ) SEPARATOR '||'
    ) as contacts_data
FROM clients c
JOIN client_pco_assignments ca ON c.id = ca.client_id
LEFT JOIN client_contacts cc ON c.id = cc.client_id AND cc.deleted_at IS NULL
WHERE ca.pco_id = ? AND ca.status = 'active' AND c.deleted_at IS NULL
GROUP BY c.id
ORDER BY ca.assigned_at DESC;

-- Parameters:
-- ? = pco_id

-- 1.3 GET ACTIVE CHEMICALS
-- Description: Get all active chemicals for mobile app
-- Method: GET /api/pco/sync/chemicals
-- Returns: Complete chemical database for offline use

-- Get Active Chemicals SQL
SELECT 
    id,
    name,
    active_ingredients,
    usage_type,
    quantity_unit,
    safety_information,
    created_at,
    updated_at
FROM chemicals 
WHERE status = 'active' AND deleted_at IS NULL
ORDER BY usage_type, name;

-- 1.4 GET RECENT REPORTS FOR PRE-FILLING
-- Description: Get recent reports for pre-filling new reports
-- Method: GET /api/pco/sync/recent-reports
-- Required Data: pco_id
-- Returns: Recent reports with detailed data for pre-filling

-- Get Recent Reports with Details SQL
SELECT 
    r.id,
    r.client_id,
    r.report_type,
    r.service_date,
    r.next_service_date,
    r.general_remarks,
    r.status,
    c.company_name,
    -- Bait stations summary
    (SELECT COUNT(*) FROM bait_stations WHERE report_id = r.id) as bait_stations_count,
    (SELECT GROUP_CONCAT(CONCAT(station_number, ':', location) SEPARATOR '|') 
     FROM bait_stations WHERE report_id = r.id) as bait_stations_summary,
    -- Fumigation areas summary
    (SELECT GROUP_CONCAT(area_name SEPARATOR '|') 
     FROM fumigation_areas WHERE report_id = r.id) as fumigation_areas,
    -- Target pests summary
    (SELECT GROUP_CONCAT(pest_name SEPARATOR '|') 
     FROM fumigation_target_pests WHERE report_id = r.id) as target_pests
FROM reports r
JOIN clients c ON r.client_id = c.id
JOIN (
    SELECT DISTINCT client_id 
    FROM client_pco_assignments 
    WHERE pco_id = ? AND status = 'active'
) active_clients ON r.client_id = active_clients.client_id
WHERE r.pco_id = ? AND r.status IN ('approved', 'archived')
AND r.service_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
ORDER BY r.client_id, r.service_date DESC;

-- Parameters:
-- ? = pco_id (repeated twice)

-- ============================================================================
-- 2. INCREMENTAL SYNCHRONIZATION
-- ============================================================================

-- 2.1 INCREMENTAL SYNC
-- Description: Get updates since last sync timestamp
-- Method: GET /api/pco/sync/incremental?last_sync=timestamp
-- Required Data: pco_id, last_sync_timestamp
-- Returns: Updated data since last sync

-- Get New Assignments SQL
SELECT 
    c.id,
    c.company_name,
    c.address_line1,
    c.city,
    c.status,
    ca.assigned_at,
    'assigned' as sync_action
FROM clients c
JOIN client_pco_assignments ca ON c.id = ca.client_id
WHERE ca.pco_id = ? 
AND ca.status = 'active' 
AND ca.assigned_at > ?
AND c.deleted_at IS NULL;

-- Get Unassigned Clients SQL
SELECT 
    ca.client_id,
    c.company_name,
    ca.unassigned_at,
    'unassigned' as sync_action
FROM client_pco_assignments ca
JOIN clients c ON ca.client_id = c.id
WHERE ca.pco_id = ? 
AND ca.status = 'inactive' 
AND ca.unassigned_at > ?;

-- Get Updated Chemicals SQL
SELECT 
    id,
    name,
    active_ingredients,
    usage_type,
    quantity_unit,
    safety_information,
    status,
    updated_at,
    CASE 
        WHEN deleted_at IS NOT NULL THEN 'deleted'
        WHEN status = 'inactive' THEN 'deactivated'
        ELSE 'updated'
    END as sync_action
FROM chemicals 
WHERE (updated_at > ? OR deleted_at > ?)
AND (status = 'active' OR updated_at > ? OR deleted_at > ?);

-- Get Report Status Updates SQL
SELECT 
    id,
    client_id,
    status,
    admin_notes,
    reviewed_at,
    reviewed_by,
    'status_changed' as sync_action
FROM reports 
WHERE pco_id = ? 
AND (reviewed_at > ? OR (status IN ('approved', 'declined') AND updated_at > ?));

-- Get New Notifications SQL
SELECT 
    id,
    type,
    title,
    message,
    read_at,
    created_at,
    'new_notification' as sync_action
FROM notifications 
WHERE user_id = ? 
AND created_at > ?;

-- Parameters vary based on last_sync_timestamp and pco_id

-- 2.2 CLIENT DATA UPDATES
-- Description: Get updated client information since last sync
-- Method: GET /api/pco/sync/clients/updated?last_sync=timestamp
-- Required Data: pco_id, last_sync_timestamp
-- Returns: Updated client data

-- Get Updated Client Data SQL
SELECT 
    c.id,
    c.company_name,
    c.address_line1,
    c.address_line2,
    c.city,
    c.state,
    c.postal_code,
    c.status,
    c.service_notes,
    c.updated_at,
    CASE 
        WHEN c.deleted_at IS NOT NULL THEN 'deleted'
        WHEN c.status = 'inactive' THEN 'deactivated'
        ELSE 'updated'
    END as sync_action
FROM clients c
JOIN client_pco_assignments ca ON c.id = ca.client_id
WHERE ca.pco_id = ? AND ca.status = 'active'
AND (c.updated_at > ? OR c.deleted_at > ?);

-- Get Updated Contact Information SQL
SELECT 
    cc.id,
    cc.client_id,
    cc.name,
    cc.email,
    cc.phone,
    cc.role,
    cc.is_primary,
    cc.updated_at,
    CASE 
        WHEN cc.deleted_at IS NOT NULL THEN 'deleted'
        ELSE 'updated'
    END as sync_action
FROM client_contacts cc
JOIN client_pco_assignments ca ON cc.client_id = ca.client_id
WHERE ca.pco_id = ? AND ca.status = 'active'
AND (cc.updated_at > ? OR cc.deleted_at > ?);

-- Parameters:
-- ? = pco_id, last_sync_timestamp (for various queries)

-- ============================================================================
-- 3. SELECTIVE SYNC BY ENTITY
-- ============================================================================

-- 3.1 SYNC SPECIFIC CLIENT DATA
-- Description: Get complete data for a specific client
-- Method: GET /api/pco/sync/client/{client_id}
-- Required Data: client_id, pco_id
-- Returns: Complete client data with reports and contacts

-- Verify PCO assignment to client
SELECT 1 FROM client_pco_assignments 
WHERE client_id = ? AND pco_id = ? AND status = 'active';

-- Get Complete Client Data SQL
SELECT 
    c.id,
    c.company_name,
    c.address_line1,
    c.address_line2,
    c.city,
    c.state,
    c.postal_code,
    c.status,
    c.service_notes,
    c.created_at,
    c.updated_at
FROM clients c
WHERE c.id = ? AND c.deleted_at IS NULL;

-- Get Client Contacts SQL
SELECT 
    id,
    name,
    email,
    phone,
    role,
    is_primary,
    created_at,
    updated_at
FROM client_contacts 
WHERE client_id = ? AND deleted_at IS NULL
ORDER BY is_primary DESC, name;

-- Get Client Report History SQL
SELECT 
    id,
    report_type,
    service_date,
    next_service_date,
    status,
    general_remarks,
    client_signature_name,
    created_at,
    submitted_at,
    reviewed_at
FROM reports 
WHERE client_id = ? AND pco_id = ?
ORDER BY service_date DESC
LIMIT 10;

-- Parameters:
-- ? = client_id, pco_id (for verification and all queries)

-- ============================================================================
-- 4. SYNC OPTIMIZATION AND COMPRESSION
-- ============================================================================

-- 4.1 GET COMPRESSED SYNC DATA
-- Description: Get compressed data for bandwidth optimization
-- Method: GET /api/pco/sync/compressed
-- Required Data: pco_id, last_sync_timestamp
-- Returns: Minimal data updates for mobile optimization

-- Get Essential Updates Only SQL
SELECT 
    'client' as entity_type,
    c.id as entity_id,
    CONCAT(c.company_name, '|', c.address_line1, '|', c.city, '|', c.status) as compressed_data,
    ca.assigned_at as sync_timestamp,
    'assigned' as action
FROM clients c
JOIN client_pco_assignments ca ON c.id = ca.client_id
WHERE ca.pco_id = ? AND ca.assigned_at > ? AND ca.status = 'active'

UNION ALL

SELECT 
    'chemical' as entity_type,
    id as entity_id,
    CONCAT(name, '|', usage_type, '|', quantity_unit, '|', status) as compressed_data,
    updated_at as sync_timestamp,
    'updated' as action
FROM chemicals 
WHERE updated_at > ? AND status = 'active'

UNION ALL

SELECT 
    'report' as entity_type,
    id as entity_id,
    CONCAT(client_id, '|', status, '|', COALESCE(admin_notes, '')) as compressed_data,
    COALESCE(reviewed_at, updated_at) as sync_timestamp,
    'status_update' as action
FROM reports 
WHERE pco_id = ? 
AND (reviewed_at > ? OR updated_at > ?)
AND status IN ('approved', 'declined')

ORDER BY sync_timestamp DESC;

-- Parameters:
-- ? = pco_id, last_sync_timestamp (repeated as needed)

-- 4.2 GET SYNC METADATA
-- Description: Get metadata about available updates
-- Method: GET /api/pco/sync/metadata?last_sync=timestamp
-- Required Data: pco_id, last_sync_timestamp
-- Returns: Update counts and timestamps for sync planning

-- Get Sync Metadata SQL
SELECT 
    'assignments' as data_type,
    COUNT(*) as update_count,
    MAX(ca.assigned_at) as latest_timestamp,
    MIN(ca.assigned_at) as earliest_timestamp
FROM client_pco_assignments ca
WHERE ca.pco_id = ? AND ca.assigned_at > ? AND ca.status = 'active'

UNION ALL

SELECT 
    'unassignments' as data_type,
    COUNT(*) as update_count,
    MAX(ca.unassigned_at) as latest_timestamp,
    MIN(ca.unassigned_at) as earliest_timestamp
FROM client_pco_assignments ca
WHERE ca.pco_id = ? AND ca.unassigned_at > ? AND ca.status = 'inactive'

UNION ALL

SELECT 
    'chemicals' as data_type,
    COUNT(*) as update_count,
    MAX(updated_at) as latest_timestamp,
    MIN(updated_at) as earliest_timestamp
FROM chemicals 
WHERE updated_at > ? AND status = 'active'

UNION ALL

SELECT 
    'report_reviews' as data_type,
    COUNT(*) as update_count,
    MAX(reviewed_at) as latest_timestamp,
    MIN(reviewed_at) as earliest_timestamp
FROM reports 
WHERE pco_id = ? AND reviewed_at > ? 

UNION ALL

SELECT 
    'notifications' as data_type,
    COUNT(*) as update_count,
    MAX(created_at) as latest_timestamp,
    MIN(created_at) as earliest_timestamp
FROM notifications 
WHERE user_id = ? AND created_at > ?;

-- Parameters:
-- ? = pco_id, last_sync_timestamp (repeated for different entity types)

-- ============================================================================
-- 5. BATCH SYNC OPERATIONS
-- ============================================================================

-- 5.1 BATCH DOWNLOAD QUEUE
-- Description: Queue data for batch download in chunks
-- Method: GET /api/pco/sync/batch?chunk=1&chunk_size=50
-- Required Data: pco_id, chunk_number, chunk_size
-- Returns: Paginated sync data for large datasets

-- Get Batch Client Data SQL
SELECT 
    c.id,
    c.company_name,
    c.address_line1,
    c.city,
    c.status,
    ca.assigned_at
FROM clients c
JOIN client_pco_assignments ca ON c.id = ca.client_id
WHERE ca.pco_id = ? AND ca.status = 'active' AND c.deleted_at IS NULL
ORDER BY ca.assigned_at DESC
LIMIT ? OFFSET ?;

-- Get Batch Chemical Data SQL
SELECT 
    id,
    name,
    usage_type,
    quantity_unit,
    active_ingredients
FROM chemicals 
WHERE status = 'active' AND deleted_at IS NULL
ORDER BY usage_type, name
LIMIT ? OFFSET ?;

-- Parameters:
-- ? = pco_id, chunk_size, offset
-- ? = chunk_size, offset

-- 5.2 SYNC PROGRESS TRACKING
-- Description: Track sync progress for large datasets
-- Method: GET /api/pco/sync/progress
-- Required Data: pco_id
-- Returns: Total counts for progress indication

-- Get Sync Progress Totals SQL
SELECT 
    (SELECT COUNT(*) FROM client_pco_assignments WHERE pco_id = ? AND status = 'active') as total_clients,
    (SELECT COUNT(*) FROM chemicals WHERE status = 'active') as total_chemicals,
    (SELECT COUNT(*) FROM reports WHERE pco_id = ? AND service_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)) as total_recent_reports,
    (SELECT COUNT(*) FROM notifications WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)) as total_recent_notifications;

-- Parameters:
-- ? = pco_id (repeated 3 times)

-- ============================================================================
-- SAMPLE USAGE EXAMPLES
-- ============================================================================

/*
1. FULL SYNC ON LOGIN:
   Input: pco_id=2
   Query: CALL GetPCOSyncData(2);
   Output: Complete offline dataset including clients, chemicals, recent reports

2. INCREMENTAL SYNC:
   Input: pco_id=2, last_sync="2025-10-07 10:00:00"
   Query: Multiple queries to get updates since timestamp
   Output: Only changed data (new assignments, updated chemicals, report status changes)

3. CLIENT-SPECIFIC SYNC:
   Input: client_id=10, pco_id=2
   Query: Get complete client data with contacts and report history
   Output: Full client profile for detailed offline access

4. COMPRESSED SYNC:
   Input: pco_id=2, last_sync="2025-10-07 10:00:00"
   Query: Get minimal essential updates in compressed format
   Output: Pipe-separated essential data for bandwidth optimization

5. BATCH SYNC:
   Input: pco_id=2, chunk=1, chunk_size=20
   Query: Get paginated client data for large datasets
   Output: First 20 assigned clients for progressive download

6. SYNC METADATA:
   Input: pco_id=2, last_sync="2025-10-07 10:00:00"
   Query: Get update counts per data type
   Output: {"assignments": 3, "chemicals": 1, "report_reviews": 2, "notifications": 0}
*/