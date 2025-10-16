-- ============================================================================
-- Safe Migration Script: Report Creation Enhancements
-- Date: October 15, 2025
-- Description: Add new fields to support enhanced bait station and insect 
--              monitor tracking (only if they don't already exist)
-- ============================================================================

USE kpspestcontrol_app;

-- ============================================================================
-- 1. BAIT STATIONS TABLE - Add new tracking fields (if not exists)
-- ============================================================================

-- Check and add action_taken column
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'kpspestcontrol_app' 
  AND TABLE_NAME = 'bait_stations' 
  AND COLUMN_NAME = 'action_taken';

SET @sql = IF(@col_exists = 0,
  'ALTER TABLE bait_stations ADD COLUMN action_taken ENUM(''repaired'', ''replaced'', ''none'') DEFAULT ''none'' COMMENT ''Action taken if station needs repair/damaged/missing'' AFTER station_condition',
  'SELECT ''Column action_taken already exists in bait_stations'' as status');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check and add warning_sign_condition column
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'kpspestcontrol_app' 
  AND TABLE_NAME = 'bait_stations' 
  AND COLUMN_NAME = 'warning_sign_condition';

SET @sql = IF(@col_exists = 0,
  'ALTER TABLE bait_stations ADD COLUMN warning_sign_condition ENUM(''good'', ''replaced'', ''repaired'', ''remounted'') NOT NULL DEFAULT ''good'' AFTER action_taken',
  'SELECT ''Column warning_sign_condition already exists in bait_stations'' as status');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Update bait_status to include 'old' if not already present
SET @sql = 'ALTER TABLE bait_stations MODIFY bait_status ENUM(''clean'', ''eaten'', ''wet'', ''old'') NOT NULL DEFAULT ''clean''';
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SELECT 'Updated bait_status enum to include old option' as status;

-- ============================================================================
-- 2. INSECT MONITORS TABLE - Add comprehensive monitoring fields
-- ============================================================================

-- Check and add monitor_condition column
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'kpspestcontrol_app' 
  AND TABLE_NAME = 'insect_monitors' 
  AND COLUMN_NAME = 'monitor_condition';

SET @sql = IF(@col_exists = 0,
  'ALTER TABLE insect_monitors ADD COLUMN monitor_condition ENUM(''good'', ''replaced'', ''repaired'', ''other'') NOT NULL DEFAULT ''good'' AFTER monitor_type',
  'SELECT ''Column monitor_condition already exists in insect_monitors'' as status');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check and add monitor_condition_other column
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'kpspestcontrol_app' 
  AND TABLE_NAME = 'insect_monitors' 
  AND COLUMN_NAME = 'monitor_condition_other';

SET @sql = IF(@col_exists = 0,
  'ALTER TABLE insect_monitors ADD COLUMN monitor_condition_other VARCHAR(255) NULL COMMENT ''Description if monitor_condition is other'' AFTER monitor_condition',
  'SELECT ''Column monitor_condition_other already exists in insect_monitors'' as status');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check and add warning_sign_condition column
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'kpspestcontrol_app' 
  AND TABLE_NAME = 'insect_monitors' 
  AND COLUMN_NAME = 'warning_sign_condition';

SET @sql = IF(@col_exists = 0,
  'ALTER TABLE insect_monitors ADD COLUMN warning_sign_condition ENUM(''good'', ''replaced'', ''repaired'', ''remounted'') NOT NULL DEFAULT ''good'' AFTER monitor_condition_other',
  'SELECT ''Column warning_sign_condition already exists in insect_monitors'' as status');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check and add light_condition column
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'kpspestcontrol_app' 
  AND TABLE_NAME = 'insect_monitors' 
  AND COLUMN_NAME = 'light_condition';

SET @sql = IF(@col_exists = 0,
  'ALTER TABLE insect_monitors ADD COLUMN light_condition ENUM(''good'', ''faulty'', ''na'') DEFAULT ''na'' COMMENT ''Only for fly_trap monitors'' AFTER warning_sign_condition',
  'SELECT ''Column light_condition already exists in insect_monitors'' as status');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check and add light_faulty_type column
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'kpspestcontrol_app' 
  AND TABLE_NAME = 'insect_monitors' 
  AND COLUMN_NAME = 'light_faulty_type';

SET @sql = IF(@col_exists = 0,
  'ALTER TABLE insect_monitors ADD COLUMN light_faulty_type ENUM(''starter'', ''tube'', ''cable'', ''electricity'', ''other'', ''na'') DEFAULT ''na'' COMMENT ''If light is faulty'' AFTER light_condition',
  'SELECT ''Column light_faulty_type already exists in insect_monitors'' as status');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check and add light_faulty_other column
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'kpspestcontrol_app' 
  AND TABLE_NAME = 'insect_monitors' 
  AND COLUMN_NAME = 'light_faulty_other';

SET @sql = IF(@col_exists = 0,
  'ALTER TABLE insect_monitors ADD COLUMN light_faulty_other VARCHAR(255) NULL COMMENT ''Description if light_faulty_type is other'' AFTER light_faulty_type',
  'SELECT ''Column light_faulty_other already exists in insect_monitors'' as status');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check and add updated_at column
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'kpspestcontrol_app' 
  AND TABLE_NAME = 'insect_monitors' 
  AND COLUMN_NAME = 'updated_at';

SET @sql = IF(@col_exists = 0,
  'ALTER TABLE insect_monitors ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at',
  'SELECT ''Column updated_at already exists in insect_monitors'' as status');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================================================
-- 3. REPORTS TABLE - Add recommendations field
-- ============================================================================

-- Check and add recommendations column
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'kpspestcontrol_app' 
  AND TABLE_NAME = 'reports' 
  AND COLUMN_NAME = 'recommendations';

SET @sql = IF(@col_exists = 0,
  'ALTER TABLE reports ADD COLUMN recommendations TEXT NULL COMMENT ''Admin-only recommendations for the client'' AFTER general_remarks',
  'SELECT ''Column recommendations already exists in reports'' as status');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================================================
-- 4. VERIFICATION QUERIES
-- ============================================================================

SELECT '========================================' as '';
SELECT 'MIGRATION VERIFICATION' as '';
SELECT '========================================' as '';

-- Verify bait_stations structure
SELECT '' as '';
SELECT '1. BAIT STATIONS TABLE' as '';
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'kpspestcontrol_app' 
  AND TABLE_NAME = 'bait_stations'
  AND COLUMN_NAME IN ('bait_status', 'action_taken', 'warning_sign_condition')
ORDER BY ORDINAL_POSITION;

-- Verify insect_monitors structure
SELECT '' as '';
SELECT '2. INSECT MONITORS TABLE' as '';
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'kpspestcontrol_app' 
  AND TABLE_NAME = 'insect_monitors'
  AND COLUMN_NAME IN ('monitor_condition', 'monitor_condition_other', 'warning_sign_condition', 
                      'light_condition', 'light_faulty_type', 'light_faulty_other', 'updated_at')
ORDER BY ORDINAL_POSITION;

-- Verify reports structure
SELECT '' as '';
SELECT '3. REPORTS TABLE' as '';
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'kpspestcontrol_app' 
  AND TABLE_NAME = 'reports'
  AND COLUMN_NAME IN ('general_remarks', 'recommendations', 'admin_notes')
ORDER BY ORDINAL_POSITION;

-- Data integrity checks
SELECT '' as '';
SELECT '4. DATA INTEGRITY CHECKS' as '';
SELECT 
  'Bait Stations' as table_name,
  COUNT(*) as total_records
FROM bait_stations
UNION ALL
SELECT 
  'Insect Monitors' as table_name,
  COUNT(*) as total_records
FROM insect_monitors
UNION ALL
SELECT 
  'Reports' as table_name,
  COUNT(*) as total_records
FROM reports;

SELECT '' as '';
SELECT '✓ Migration completed successfully!' as status;
SELECT NOW() as completed_at;
