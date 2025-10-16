-- ============================================================================
-- DATABASE SCHEMA VERIFICATION FOR PHASE 3.2 REPORT MANAGEMENT
-- KPS Pest Control Management System
-- Created: October 13, 2025
-- ============================================================================

USE kpspestcontrol_app;

-- Verify all required tables exist
SELECT 
    'reports' as table_name,
    COUNT(*) as exists_check
FROM information_schema.tables 
WHERE table_schema = 'kpspestcontrol_app' 
AND table_name = 'reports'

UNION ALL

SELECT 
    'bait_stations' as table_name,
    COUNT(*) as exists_check
FROM information_schema.tables 
WHERE table_schema = 'kpspestcontrol_app' 
AND table_name = 'bait_stations'

UNION ALL

SELECT 
    'station_chemicals' as table_name,
    COUNT(*) as exists_check
FROM information_schema.tables 
WHERE table_schema = 'kpspestcontrol_app' 
AND table_name = 'station_chemicals'

UNION ALL

SELECT 
    'fumigation_areas' as table_name,
    COUNT(*) as exists_check
FROM information_schema.tables 
WHERE table_schema = 'kpspestcontrol_app' 
AND table_name = 'fumigation_areas'

UNION ALL

SELECT 
    'fumigation_target_pests' as table_name,
    COUNT(*) as exists_check
FROM information_schema.tables 
WHERE table_schema = 'kpspestcontrol_app' 
AND table_name = 'fumigation_target_pests'

UNION ALL

SELECT 
    'fumigation_chemicals' as table_name,
    COUNT(*) as exists_check
FROM information_schema.tables 
WHERE table_schema = 'kpspestcontrol_app' 
AND table_name = 'fumigation_chemicals'

UNION ALL

SELECT 
    'insect_monitors' as table_name,
    COUNT(*) as exists_check
FROM information_schema.tables 
WHERE table_schema = 'kpspestcontrol_app' 
AND table_name = 'insect_monitors'

UNION ALL

SELECT 
    'notifications' as table_name,
    COUNT(*) as exists_check
FROM information_schema.tables 
WHERE table_schema = 'kpspestcontrol_app' 
AND table_name = 'notifications';

-- Verify reports table columns
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE,
    COLUMN_DEFAULT,
    COLUMN_TYPE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'kpspestcontrol_app'
AND TABLE_NAME = 'reports'
ORDER BY ORDINAL_POSITION;

-- Verify stored procedures exist
SELECT 
    ROUTINE_NAME,
    ROUTINE_TYPE
FROM information_schema.ROUTINES
WHERE ROUTINE_SCHEMA = 'kpspestcontrol_app'
AND ROUTINE_NAME IN ('SubmitReport', 'AssignPCOToClient', 'UpdateDashboardCache', 'GetPCOSyncData');

-- Check sample data
SELECT 'reports' as table_name, COUNT(*) as record_count FROM reports
UNION ALL
SELECT 'bait_stations', COUNT(*) FROM bait_stations
UNION ALL
SELECT 'fumigation_areas', COUNT(*) FROM fumigation_areas
UNION ALL
SELECT 'insect_monitors', COUNT(*) FROM insect_monitors
UNION ALL
SELECT 'notifications', COUNT(*) FROM notifications;
