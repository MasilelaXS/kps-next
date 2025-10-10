-- ============================================================================
-- PCO REPORT MANAGEMENT ENDPOINTS SQL STATEMENTS
-- KPS Pest Control Management System - Mobile App
-- Created: October 7, 2025
-- ============================================================================

-- ============================================================================
-- 1. REPORT CREATION AND MANAGEMENT
-- ============================================================================

-- 1.1 CREATE NEW REPORT
-- Description: Create new report (draft)
-- Method: POST /api/pco/reports
-- Required Data: client_id, pco_id, report_type, service_date, pco_signature_data
-- Returns: Created report ID

-- Verify PCO assignment to client
SELECT 1 FROM client_pco_assignments 
WHERE client_id = ? AND pco_id = ? AND status = 'active';

-- Verify no existing draft report for this client
SELECT id FROM reports 
WHERE client_id = ? AND pco_id = ? AND status = 'draft';

-- Create Report SQL
INSERT INTO reports (
    client_id, 
    pco_id, 
    report_type, 
    service_date, 
    next_service_date,
    pco_signature_data, 
    status
) VALUES (
    ?, ?, ?, ?, ?, ?, 'draft'
);

-- Get created report ID
SELECT LAST_INSERT_ID() as report_id;

-- Parameters:
-- ? = client_id, pco_id (for verification)
-- ? = client_id, pco_id (for duplicate check)
-- ? = client_id, pco_id, report_type, service_date, next_service_date, pco_signature_data

-- 1.2 UPDATE REPORT BASIC INFO
-- Description: Update draft report basic information
-- Method: PUT /api/pco/reports/{id}
-- Required Data: report_id, pco_id, updated report data
-- Returns: Success message

-- Verify report ownership and draft status
SELECT id, client_id FROM reports 
WHERE id = ? AND pco_id = ? AND status = 'draft';

-- Update Report Basic Info SQL
UPDATE reports 
SET 
    report_type = ?,
    service_date = ?,
    next_service_date = ?,
    general_remarks = ?,
    pco_signature_data = ?,
    updated_at = NOW()
WHERE id = ? AND pco_id = ? AND status = 'draft';

-- Parameters:
-- ? = report_id, pco_id (for verification)
-- ? = report_type, service_date, next_service_date, general_remarks, pco_signature_data, report_id, pco_id

-- 1.3 DELETE DRAFT REPORT
-- Description: Delete draft report completely
-- Method: DELETE /api/pco/reports/{id}
-- Required Data: report_id, pco_id
-- Returns: Success message

-- Verify report ownership and draft status
SELECT id FROM reports 
WHERE id = ? AND pco_id = ? AND status = 'draft';

-- Delete related data first (cascade should handle this, but explicit for clarity)
DELETE FROM station_chemicals WHERE station_id IN (SELECT id FROM bait_stations WHERE report_id = ?);
DELETE FROM bait_stations WHERE report_id = ?;
DELETE FROM fumigation_areas WHERE report_id = ?;
DELETE FROM fumigation_target_pests WHERE report_id = ?;
DELETE FROM fumigation_chemicals WHERE report_id = ?;
DELETE FROM insect_monitors WHERE report_id = ?;

-- Delete Report SQL
DELETE FROM reports WHERE id = ? AND pco_id = ? AND status = 'draft';

-- Parameters:
-- ? = report_id, pco_id (for verification)
-- ? = report_id (repeated for deletions)

-- ============================================================================
-- 2. BAIT STATION MANAGEMENT
-- ============================================================================

-- 2.1 ADD BAIT STATION
-- Description: Add bait station to report
-- Method: POST /api/pco/reports/{id}/bait-stations
-- Required Data: report_id, station data
-- Returns: Created station ID

-- Verify report ownership and draft status
SELECT id FROM reports 
WHERE id = ? AND pco_id = ? AND status = 'draft';

-- Check for duplicate station number per location
SELECT id FROM bait_stations 
WHERE report_id = ? AND location = ? AND station_number = ?;

-- Add Bait Station SQL
INSERT INTO bait_stations (
    report_id, 
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
    rodent_box_replaced, 
    station_remarks
) VALUES (
    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
);

-- Get created station ID
SELECT LAST_INSERT_ID() as station_id;

-- Parameters:
-- ? = report_id, pco_id (for verification)
-- ? = report_id, location, station_number (for duplicate check)
-- ? = all station fields

-- 2.2 UPDATE BAIT STATION
-- Description: Update existing bait station
-- Method: PUT /api/pco/reports/bait-stations/{station_id}
-- Required Data: station_id, pco_id, updated station data
-- Returns: Success message

-- Verify station ownership through report
SELECT bs.id FROM bait_stations bs
JOIN reports r ON bs.report_id = r.id
WHERE bs.id = ? AND r.pco_id = ? AND r.status = 'draft';

-- Update Bait Station SQL
UPDATE bait_stations 
SET 
    station_number = ?,
    location = ?,
    is_accessible = ?,
    inaccessible_reason = ?,
    activity_detected = ?,
    activity_droppings = ?,
    activity_gnawing = ?,
    activity_tracks = ?,
    activity_other = ?,
    activity_other_description = ?,
    bait_status = ?,
    station_condition = ?,
    rodent_box_replaced = ?,
    station_remarks = ?,
    updated_at = NOW()
WHERE id = ?;

-- Parameters:
-- ? = station_id, pco_id (for verification)
-- ? = all station update fields, station_id

-- 2.3 DELETE BAIT STATION
-- Description: Delete bait station from report
-- Method: DELETE /api/pco/reports/bait-stations/{station_id}
-- Required Data: station_id, pco_id
-- Returns: Success message

-- Verify station ownership through report
SELECT bs.id FROM bait_stations bs
JOIN reports r ON bs.report_id = r.id
WHERE bs.id = ? AND r.pco_id = ? AND r.status = 'draft';

-- Delete Station Chemicals first
DELETE FROM station_chemicals WHERE station_id = ?;

-- Delete Bait Station SQL
DELETE FROM bait_stations WHERE id = ?;

-- Parameters:
-- ? = station_id, pco_id (for verification)
-- ? = station_id (for deletions)

-- 2.4 ADD STATION CHEMICALS
-- Description: Add chemicals to bait station
-- Method: POST /api/pco/reports/bait-stations/{station_id}/chemicals
-- Required Data: station_id, pco_id, chemical_id, quantity, batch_number
-- Returns: Success message

-- Verify station ownership through report
SELECT bs.id FROM bait_stations bs
JOIN reports r ON bs.report_id = r.id
WHERE bs.id = ? AND r.pco_id = ? AND r.status = 'draft';

-- Verify chemical is active and suitable for bait stations
SELECT id FROM chemicals 
WHERE id = ? AND status = 'active' AND usage_type IN ('bait_inspection', 'multi_purpose');

-- Add Station Chemical SQL
INSERT INTO station_chemicals (
    station_id, 
    chemical_id, 
    quantity, 
    batch_number
) VALUES (
    ?, ?, ?, ?
);

-- Parameters:
-- ? = station_id, pco_id (for verification)
-- ? = chemical_id (for chemical verification)
-- ? = station_id, chemical_id, quantity, batch_number

-- 2.5 GET BAIT STATIONS FOR REPORT
-- Description: Get all bait stations for a report
-- Method: GET /api/pco/reports/{id}/bait-stations
-- Required Data: report_id, pco_id
-- Returns: List of bait stations with chemicals

-- Verify report ownership
SELECT id FROM reports 
WHERE id = ? AND pco_id = ?;

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
    -- Chemical information
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

-- Parameters:
-- ? = report_id, pco_id (for verification)
-- ? = report_id

-- ============================================================================
-- 3. FUMIGATION MANAGEMENT
-- ============================================================================

-- 3.1 ADD FUMIGATION AREAS
-- Description: Add fumigation areas to report
-- Method: POST /api/pco/reports/{id}/fumigation/areas
-- Required Data: report_id, pco_id, areas array
-- Returns: Success message

-- Verify report ownership and draft status
SELECT id FROM reports 
WHERE id = ? AND pco_id = ? AND status = 'draft';

-- Clear existing areas for this report
DELETE FROM fumigation_areas WHERE report_id = ?;

-- Add Fumigation Areas SQL (loop for each area)
INSERT INTO fumigation_areas (
    report_id, 
    area_name, 
    is_other, 
    other_description
) VALUES (
    ?, ?, ?, ?
);

-- Parameters:
-- ? = report_id, pco_id (for verification)
-- ? = report_id (for clearing)
-- ? = report_id, area_name, is_other, other_description (for each area)

-- 3.2 ADD FUMIGATION TARGET PESTS
-- Description: Add target pests to report
-- Method: POST /api/pco/reports/{id}/fumigation/pests
-- Required Data: report_id, pco_id, pests array
-- Returns: Success message

-- Verify report ownership and draft status
SELECT id FROM reports 
WHERE id = ? AND pco_id = ? AND status = 'draft';

-- Clear existing target pests for this report
DELETE FROM fumigation_target_pests WHERE report_id = ?;

-- Add Fumigation Target Pests SQL (loop for each pest)
INSERT INTO fumigation_target_pests (
    report_id, 
    pest_name, 
    is_other, 
    other_description
) VALUES (
    ?, ?, ?, ?
);

-- Parameters:
-- ? = report_id, pco_id (for verification)
-- ? = report_id (for clearing)
-- ? = report_id, pest_name, is_other, other_description (for each pest)

-- 3.3 ADD FUMIGATION CHEMICALS
-- Description: Add fumigation chemicals to report
-- Method: POST /api/pco/reports/{id}/fumigation/chemicals
-- Required Data: report_id, pco_id, chemicals array
-- Returns: Success message

-- Verify report ownership and draft status
SELECT id FROM reports 
WHERE id = ? AND pco_id = ? AND status = 'draft';

-- Clear existing fumigation chemicals for this report
DELETE FROM fumigation_chemicals WHERE report_id = ?;

-- Add Fumigation Chemicals SQL (loop for each chemical)
INSERT INTO fumigation_chemicals (
    report_id, 
    chemical_id, 
    quantity, 
    batch_number
) VALUES (
    ?, ?, ?, ?
);

-- Parameters:
-- ? = report_id, pco_id (for verification)
-- ? = report_id (for clearing)
-- ? = report_id, chemical_id, quantity, batch_number (for each chemical)

-- 3.4 GET FUMIGATION DATA FOR REPORT
-- Description: Get all fumigation data for a report
-- Method: GET /api/pco/reports/{id}/fumigation
-- Required Data: report_id, pco_id
-- Returns: Fumigation areas, pests, and chemicals

-- Verify report ownership
SELECT id FROM reports 
WHERE id = ? AND pco_id = ?;

-- Get Fumigation Areas SQL
SELECT 
    area_name,
    is_other,
    other_description
FROM fumigation_areas 
WHERE report_id = ?
ORDER BY is_other, area_name;

-- Get Target Pests SQL
SELECT 
    pest_name,
    is_other,
    other_description
FROM fumigation_target_pests 
WHERE report_id = ?
ORDER BY is_other, pest_name;

-- Get Fumigation Chemicals SQL
SELECT 
    fc.quantity,
    fc.batch_number,
    c.name as chemical_name,
    c.active_ingredients,
    c.safety_information
FROM fumigation_chemicals fc
JOIN chemicals c ON fc.chemical_id = c.id
WHERE fc.report_id = ?
ORDER BY c.name;

-- Parameters:
-- ? = report_id, pco_id (for verification)
-- ? = report_id (for all queries)

-- ============================================================================
-- 4. INSECT MONITORS MANAGEMENT
-- ============================================================================

-- 4.1 ADD INSECT MONITORS
-- Description: Add insect monitors to report
-- Method: POST /api/pco/reports/{id}/monitors
-- Required Data: report_id, pco_id, monitors array
-- Returns: Success message

-- Verify report ownership and draft status
SELECT id FROM reports 
WHERE id = ? AND pco_id = ? AND status = 'draft';

-- Clear existing monitors for this report
DELETE FROM insect_monitors WHERE report_id = ?;

-- Add Insect Monitors SQL (loop for each monitor)
INSERT INTO insect_monitors (
    report_id, 
    monitor_type, 
    glue_board_replaced, 
    tubes_replaced, 
    monitor_serviced
) VALUES (
    ?, ?, ?, ?, ?
);

-- Parameters:
-- ? = report_id, pco_id (for verification)
-- ? = report_id (for clearing)
-- ? = report_id, monitor_type, glue_board_replaced, tubes_replaced, monitor_serviced (for each monitor)

-- 4.2 GET INSECT MONITORS FOR REPORT
-- Description: Get all insect monitors for a report
-- Method: GET /api/pco/reports/{id}/monitors
-- Required Data: report_id, pco_id
-- Returns: List of insect monitors

-- Verify report ownership
SELECT id FROM reports 
WHERE id = ? AND pco_id = ?;

-- Get Insect Monitors SQL
SELECT 
    id as monitor_id,
    monitor_type,
    glue_board_replaced,
    tubes_replaced,
    monitor_serviced,
    created_at
FROM insect_monitors 
WHERE report_id = ?
ORDER BY monitor_type, created_at;

-- Parameters:
-- ? = report_id, pco_id (for verification)
-- ? = report_id

-- ============================================================================
-- 5. CLIENT SIGNATURE AND SUBMISSION
-- ============================================================================

-- 5.1 ADD CLIENT SIGNATURE
-- Description: Add client signature to report
-- Method: PUT /api/pco/reports/{id}/signature
-- Required Data: report_id, pco_id, client_signature_data, client_signature_name
-- Returns: Success message

-- Verify report ownership and draft status
SELECT id FROM reports 
WHERE id = ? AND pco_id = ? AND status = 'draft';

-- Add Client Signature SQL
UPDATE reports 
SET 
    client_signature_data = ?,
    client_signature_name = ?,
    updated_at = NOW()
WHERE id = ? AND pco_id = ? AND status = 'draft';

-- Parameters:
-- ? = report_id, pco_id (for verification)
-- ? = client_signature_data, client_signature_name, report_id, pco_id

-- 5.2 VALIDATE REPORT FOR SUBMISSION
-- Description: Check if report is complete and ready for submission
-- Method: GET /api/pco/reports/{id}/validate
-- Required Data: report_id, pco_id
-- Returns: Validation status and missing requirements

-- Get Report Validation Status SQL
SELECT 
    r.id,
    r.report_type,
    r.client_signature_data IS NOT NULL as has_client_signature,
    r.client_signature_name IS NOT NULL as has_client_signature_name,
    r.pco_signature_data IS NOT NULL as has_pco_signature,
    -- Validate bait inspection requirements
    CASE 
        WHEN r.report_type IN ('bait_inspection', 'both') THEN 
            (SELECT COUNT(*) FROM bait_stations WHERE report_id = r.id) > 0
        ELSE TRUE 
    END as has_bait_data,
    -- Validate fumigation requirements
    CASE 
        WHEN r.report_type IN ('fumigation', 'both') THEN 
            (SELECT COUNT(*) FROM fumigation_areas WHERE report_id = r.id) > 0 AND
            (SELECT COUNT(*) FROM fumigation_target_pests WHERE report_id = r.id) > 0
        ELSE TRUE 
    END as has_fumigation_data,
    -- Overall validation
    (r.client_signature_data IS NOT NULL AND 
     r.client_signature_name IS NOT NULL AND 
     r.pco_signature_data IS NOT NULL AND
     CASE 
         WHEN r.report_type IN ('bait_inspection', 'both') THEN 
             (SELECT COUNT(*) FROM bait_stations WHERE report_id = r.id) > 0
         ELSE TRUE 
     END AND
     CASE 
         WHEN r.report_type IN ('fumigation', 'both') THEN 
             (SELECT COUNT(*) FROM fumigation_areas WHERE report_id = r.id) > 0 AND
             (SELECT COUNT(*) FROM fumigation_target_pests WHERE report_id = r.id) > 0
         ELSE TRUE 
     END) as is_valid_for_submission
FROM reports r
WHERE r.id = ? AND r.pco_id = ? AND r.status = 'draft';

-- Parameters:
-- ? = report_id, pco_id

-- 5.3 SUBMIT REPORT
-- Description: Submit report for admin review
-- Method: POST /api/pco/reports/{id}/submit
-- Required Data: report_id, pco_id
-- Returns: Success message

-- Final validation before submission
SELECT 
    r.id,
    r.client_signature_data,
    r.client_signature_name,
    r.pco_signature_data,
    CASE 
        WHEN r.report_type IN ('bait_inspection', 'both') THEN 
            (SELECT COUNT(*) FROM bait_stations WHERE report_id = r.id)
        ELSE 1 
    END as has_bait_data,
    CASE 
        WHEN r.report_type IN ('fumigation', 'both') THEN 
            (SELECT COUNT(*) FROM fumigation_areas WHERE report_id = r.id)
        ELSE 1 
    END as has_fumigation_data
FROM reports r
WHERE r.id = ? AND r.pco_id = ? AND r.status = 'draft';

-- Use stored procedure for submission (handles PCO unassignment and notifications)
CALL SubmitReport(?);

-- Alternative manual submission if stored procedure not available:
UPDATE reports 
SET 
    status = 'pending',
    submitted_at = NOW(),
    updated_at = NOW()
WHERE id = ? AND pco_id = ? AND status = 'draft';

-- Unassign PCO from client after successful submission
UPDATE client_pco_assignments 
SET 
    status = 'inactive',
    unassigned_at = NOW()
WHERE client_id = (SELECT client_id FROM reports WHERE id = ?) 
AND pco_id = ? 
AND status = 'active';

-- Parameters:
-- ? = report_id, pco_id (for validation)
-- ? = report_id (for stored procedure)
-- ? = report_id, pco_id (for manual submission)
-- ? = report_id, pco_id (for unassignment)

-- ============================================================================
-- SAMPLE USAGE EXAMPLES
-- ============================================================================

/*
1. CREATE NEW REPORT:
   Input: client_id=1, pco_id=2, report_type="both", service_date="2025-10-07"
   Query: INSERT INTO reports (client_id, pco_id, report_type, service_date, status) VALUES (1, 2, 'both', '2025-10-07', 'draft');
   Output: {"report_id": 15}

2. ADD BAIT STATION:
   Input: report_id=15, station_number="1", location="outside", activity_detected=true
   Query: INSERT INTO bait_stations (...) VALUES (...);
   Output: {"station_id": 45}

3. ADD STATION CHEMICALS:
   Input: station_id=45, chemical_id=2, quantity=25.5, batch_number="RK2025001"
   Query: INSERT INTO station_chemicals (...) VALUES (...);
   Result: Chemical added to bait station

4. VALIDATE REPORT:
   Input: report_id=15, pco_id=2
   Query: Comprehensive validation check
   Output: {"is_valid_for_submission": true, "has_client_signature": true, "has_bait_data": true}

5. SUBMIT REPORT:
   Input: report_id=15, pco_id=2
   Query: CALL SubmitReport(15);
   Result: Report submitted, PCO unassigned, admin notified

6. GET COMPLETE REPORT DATA:
   Input: report_id=15, pco_id=2
   Query: Multiple queries to get all report components
   Output: Complete report with bait stations, fumigation data, monitors
*/