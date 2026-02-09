-- ============================================================================
-- MIGRATION SCRIPT: kpspestcontrol_forms → kpspestcontrol_app
-- Created: December 12, 2025
-- ============================================================================
-- This script migrates data from the old database structure to the new one
-- with necessary schema transformations.
-- 
-- IMPORTANT: 
-- 1. Run CLEAR-REPORTS.sql FIRST to clear existing data
-- 2. Then run this script to migrate data from old to new database
-- ============================================================================

START TRANSACTION;

-- ============================================================================
-- STEP 1: MIGRATE REPORTS
-- ============================================================================
-- Maps old BIGINT report IDs to new INT sequential IDs
-- Handles column renames and report_type changes

INSERT INTO reports (
    client_id,
    pco_id,
    service_date,
    report_type,
    next_service_date,
    recommendations,
    client_signature_data,
    client_signature_name,
    pco_signature_data,
    status,
    new_bait_stations_count,
    new_insect_monitors_count,
    emailed_at,
    created_at,
    updated_at
)
SELECT 
    -- Map old client_id to new client_id using migration_id_map_clients (REQUIRED)
    c_map.new_id as client_id,
    
    -- Map old pco_id to new pco_id using migration_id_map_users (REQUIRED)
    u_map.new_id as pco_id,
    
    -- Column renames
    old_r.date_of_service as service_date,
    
    -- Report type transformation: 'inspection' → 'bait_inspection'
    CASE 
        WHEN old_r.report_type = 'inspection' THEN 'bait_inspection'
        WHEN old_r.report_type = 'fumigation' THEN 'fumigation'
        WHEN old_r.report_type = 'both' THEN 'both'
        ELSE 'bait_inspection' -- fallback
    END as report_type,
    
    old_r.next_service_date,
    old_r.recommendations,
    
    -- Signature column renames (old doesn't have timestamp columns, will be NULL)
    old_r.client_signature as client_signature_data,
    old_r.client_name as client_signature_name,
    old_r.pco_signature as pco_signature_data,
    
    old_r.status,
    
    -- New columns - default to 0
    0 as new_bait_stations_count,
    0 as new_insect_monitors_count,
    
    -- emailed_at - default to NULL
    NULL as emailed_at,
    
    old_r.created_at,
    old_r.updated_at

FROM kpspestcontrol_forms.reports old_r
INNER JOIN migration_id_map_clients c_map ON old_r.client_id = c_map.old_id
INNER JOIN migration_id_map_users u_map ON old_r.pco_id = u_map.old_id
ORDER BY old_r.id; -- Ensure consistent ordering for mapping

-- Store old→new report ID mappings using a temp table approach
-- Handle duplicate old_id values by using MIN(id) or adding uniqueness
CREATE TEMPORARY TABLE temp_report_mapping AS
SELECT DISTINCT
    old_r.id as old_id,
    (@row_num := @row_num + 1) as row_num
FROM kpspestcontrol_forms.reports old_r
INNER JOIN migration_id_map_clients c_map ON old_r.client_id = c_map.old_id
INNER JOIN migration_id_map_users u_map ON old_r.pco_id = u_map.old_id
CROSS JOIN (SELECT @row_num := 0) r
GROUP BY old_r.id, old_r.date_of_service, old_r.client_id, old_r.pco_id, old_r.created_at
ORDER BY old_r.id;

-- Map old IDs to new IDs based on insertion order
INSERT INTO migration_id_map_reports (old_id, new_id, migrated_at)
SELECT 
    tmp.old_id,
    tmp.row_num as new_id,
    NOW() as migrated_at
FROM temp_report_mapping tmp;

DROP TEMPORARY TABLE temp_report_mapping;

-- ============================================================================
-- STEP 2: MIGRATE BAIT STATIONS (inspection_stations → bait_stations)
-- ============================================================================
-- MAJOR transformations:
-- - JSON station_condition → ENUM
-- - Single activity_type ENUM → multiple boolean flags
-- - Bait status value mapping
-- - station_number truncation (varchar 50 → 20)

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
    action_taken,
    warning_sign_condition,
    rodent_box_replaced,
    station_remarks,
    is_new_addition,
    created_at,
    updated_at
)
SELECT 
    -- Map old report_id to new report_id (REQUIRED - must exist in migration map)
    r_map.new_id as report_id,
    
    -- Truncate station_number if needed (varchar 50 → 20)
    LEFT(old_s.station_number, 20) as station_number,
    
    old_s.location,
    old_s.is_accessible,
    old_s.access_reason as inaccessible_reason,
    
    -- Activity detected overall flag
    old_s.has_activity as activity_detected,
    
    -- Transform single activity_type ENUM → multiple boolean flags
    CASE WHEN old_s.activity_type = 'droppings' THEN 1 ELSE 0 END as activity_droppings,
    CASE WHEN old_s.activity_type = 'gnawing' THEN 1 ELSE 0 END as activity_gnawing,
    CASE WHEN old_s.activity_type = 'tracks' THEN 1 ELSE 0 END as activity_tracks,
    CASE WHEN old_s.activity_type = 'other' THEN 1 ELSE 0 END as activity_other,
    old_s.activity_type_other as activity_other_description,
    
    -- Bait status mapping
    CASE 
        WHEN old_s.bait_status = 'partially_eaten' THEN 'eaten'
        WHEN old_s.bait_status = 'moldy' THEN 'wet'
        WHEN old_s.bait_status = 'untouched' THEN 'clean'
        WHEN old_s.bait_status IN ('clean', 'eaten', 'wet') THEN old_s.bait_status
        ELSE 'clean' -- fallback
    END as bait_status,
    
    -- Transform JSON station_condition to ENUM (take first value from array)
    CASE 
        WHEN old_s.station_condition LIKE '%"good"%' THEN 'good'
        WHEN old_s.station_condition LIKE '%"needs_repair"%' OR old_s.station_condition LIKE '%"needs repair"%' THEN 'needs repair'
        WHEN old_s.station_condition LIKE '%"damaged"%' THEN 'damaged'
        WHEN old_s.station_condition LIKE '%"missing"%' THEN 'missing'
        ELSE 'good' -- fallback
    END as station_condition,
    
    -- New fields - defaults
    'none' as action_taken,
    'good' as warning_sign_condition,
    0 as rodent_box_replaced,
    old_s.station_remarks as station_remarks,
    0 as is_new_addition,
    
    old_s.created_at,
    old_s.created_at as updated_at -- old table only has created_at

FROM kpspestcontrol_forms.inspection_stations old_s
INNER JOIN migration_id_map_reports r_map ON old_s.report_id = r_map.old_id;

-- ============================================================================
-- STEP 3: MIGRATE STATION CHEMICALS
-- ============================================================================
-- Extract chemicals from JSON array in old inspection_stations.chemicals_used
-- and create individual records in station_chemicals table

-- NOTE: JSON_TABLE not supported in MariaDB 10.4
-- TODO: Implement alternative JSON parsing or upgrade to MariaDB 10.6+
-- For now, skip this migration step

/*
-- Will need custom script to parse JSON arrays and insert chemicals
-- Example old data: chemicals_used: '[{"chemical_id": 17, "quantity": 5.00, "batch_number": "1234"}]'
-- Need to extract each array element and insert into station_chemicals
*/

-- ============================================================================
-- STEP 4: MIGRATE INSECT MONITORS
-- ============================================================================
-- Transform insect monitors with field mappings and type conversions

INSERT INTO insect_monitors (
    report_id,
    monitor_number,
    location,
    monitor_type,
    monitor_condition,
    monitor_condition_other,
    warning_sign_condition,
    light_condition,
    light_faulty_type,
    light_faulty_other,
    glue_board_replaced,
    tubes_replaced,
    monitor_serviced,
    is_new_addition,
    created_at,
    updated_at
)
SELECT 
    -- Map old report_id to new report_id (REQUIRED - must exist in migration map)
    r_map.new_id as report_id,
    
    -- Truncate monitor_number (varchar 50 → 20)
    LEFT(old_m.monitor_number, 20) as monitor_number,
    
    -- Map location_description (text) to location (varchar 100)
    LEFT(COALESCE(old_m.location_description, ''), 100) as location,
    
    old_m.monitor_type,
    
    -- Monitor condition mapping
    CASE 
        WHEN old_m.monitor_condition = 'good' THEN 'good'
        WHEN old_m.monitor_condition = 'replaced' THEN 'replaced'
        WHEN old_m.monitor_condition = 'damaged' THEN 'repaired' -- closest match
        ELSE 'good'
    END as monitor_condition,
    
    NULL as monitor_condition_other,
    
    -- New fields - defaults
    'good' as warning_sign_condition,
    'na' as light_condition,
    'na' as light_faulty_type,
    NULL as light_faulty_other,
    
    -- Boolean mappings
    old_m.glue_board as glue_board_replaced,
    
    -- Convert boolean tubes to int count (1→1, 0→0, NULL→NULL)
    CASE 
        WHEN old_m.tubes = 1 THEN 1
        WHEN old_m.tubes = 0 THEN 0
        ELSE NULL
    END as tubes_replaced,
    
    old_m.serviced as monitor_serviced,
    
    -- New fields
    0 as is_new_addition,
    
    old_m.created_at,
    old_m.updated_at

FROM kpspestcontrol_forms.insect_monitors old_m
INNER JOIN migration_id_map_reports r_map ON old_m.report_id = r_map.old_id;

-- ============================================================================
-- STEP 5: MIGRATE FUMIGATION CHEMICALS
-- ============================================================================
-- Map through fumigation_treatments to get report_id

INSERT INTO fumigation_chemicals (
    report_id,
    chemical_id,
    quantity,
    batch_number,
    created_at
)
SELECT 
    -- Map old report_id through fumigation_treatments (REQUIRED)
    r_map.new_id as report_id,
    
    -- Map chemical_id if migration_id_map_chemicals exists
    COALESCE(c_map.new_id, old_fc.chemical_id) as chemical_id,
    
    old_fc.quantity,
    old_fc.batch_number,
    
    -- Use fumigation_treatment created_at or current timestamp
    COALESCE(old_ft.created_at, NOW()) as created_at

FROM kpspestcontrol_forms.fumigation_chemicals old_fc
INNER JOIN kpspestcontrol_forms.fumigation_treatments old_ft 
    ON old_fc.treatment_id = old_ft.id
INNER JOIN migration_id_map_reports r_map 
    ON old_ft.report_id = r_map.old_id
LEFT JOIN migration_id_map_chemicals c_map 
    ON old_fc.chemical_id = c_map.old_id;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these after migration to verify data integrity

-- Check report counts
SELECT 
    'OLD reports' as source,
    COUNT(*) as count
FROM kpspestcontrol_forms.reports
UNION ALL
SELECT 
    'NEW reports' as source,
    COUNT(*) as count
FROM reports;

-- Check bait stations counts
SELECT 
    'OLD inspection_stations' as source,
    COUNT(*) as count
FROM kpspestcontrol_forms.inspection_stations
UNION ALL
SELECT 
    'NEW bait_stations' as source,
    COUNT(*) as count
FROM bait_stations;

-- Check insect monitors counts
SELECT 
    'OLD insect_monitors' as source,
    COUNT(*) as count
FROM kpspestcontrol_forms.insect_monitors
UNION ALL
SELECT 
    'NEW insect_monitors' as source,
    COUNT(*) as count
FROM insect_monitors;

-- Check station chemicals counts
SELECT 
    'OLD chemicals_used (JSON arrays)' as source,
    COUNT(*) as count
FROM kpspestcontrol_forms.inspection_stations
WHERE chemicals_used IS NOT NULL 
  AND chemicals_used != '[]'
  AND chemicals_used != ''
UNION ALL
SELECT 
    'NEW station_chemicals' as source,
    COUNT(*) as count
FROM station_chemicals;

-- Check fumigation chemicals counts
SELECT 
    'OLD fumigation_chemicals' as source,
    COUNT(*) as count
FROM kpspestcontrol_forms.fumigation_chemicals
UNION ALL
SELECT 
    'NEW fumigation_chemicals' as source,
    COUNT(*) as count
FROM fumigation_chemicals;

-- Check ID mapping counts
SELECT 
    'migration_id_map_reports' as mapping_table,
    COUNT(*) as count
FROM migration_id_map_reports;

-- Sample verification: Check random report migration
SELECT 
    old_r.id as old_id,
    r_map.new_id,
    old_r.date_of_service,
    new_r.service_date,
    old_r.report_type as old_type,
    new_r.report_type as new_type,
    old_r.client_id as old_client_id,
    new_r.client_id as new_client_id
FROM kpspestcontrol_forms.reports old_r
INNER JOIN migration_id_map_reports r_map ON old_r.id = r_map.old_id
INNER JOIN reports new_r ON r_map.new_id = new_r.id
LIMIT 10;

-- ============================================================================
-- COMMIT OR ROLLBACK
-- ============================================================================
-- Review verification queries above before committing!
-- If everything looks good:
COMMIT;

-- If there are issues:
-- ROLLBACK;
