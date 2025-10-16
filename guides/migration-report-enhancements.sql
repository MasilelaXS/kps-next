-- ============================================================================
-- Migration Script: Report Creation Enhancements
-- Date: October 15, 2025
-- Description: Add new fields to support enhanced bait station and insect 
--              monitor tracking according to workflow requirements
-- ============================================================================

USE kpspestcontrol_app;

-- ============================================================================
-- 1. BAIT STATIONS TABLE - Add new tracking fields
-- ============================================================================

ALTER TABLE bait_stations 
  -- Add 'old' option to bait_status (for no poison/default status)
  MODIFY bait_status ENUM('clean', 'eaten', 'wet', 'old') NOT NULL DEFAULT 'clean',
  
  -- Add action taken when station needs repair/damaged/missing
  ADD COLUMN action_taken ENUM('repaired', 'replaced', 'none') DEFAULT 'none' 
    COMMENT 'Action taken if station needs repair/damaged/missing' 
    AFTER station_condition,
  
  -- Add warning sign condition tracking
  ADD COLUMN warning_sign_condition ENUM('good', 'replaced', 'repaired', 'remounted') 
    NOT NULL DEFAULT 'good' 
    AFTER action_taken;

-- ============================================================================
-- 2. INSECT MONITORS TABLE - Add comprehensive monitoring fields
-- ============================================================================

ALTER TABLE insect_monitors
  -- Add monitor condition tracking
  ADD COLUMN monitor_condition ENUM('good', 'replaced', 'repaired', 'other') 
    NOT NULL DEFAULT 'good' 
    AFTER monitor_type,
  
  -- Add description field for 'other' monitor condition
  ADD COLUMN monitor_condition_other VARCHAR(255) NULL 
    COMMENT 'Description if monitor_condition is other' 
    AFTER monitor_condition,
  
  -- Add warning sign condition tracking
  ADD COLUMN warning_sign_condition ENUM('good', 'replaced', 'repaired', 'remounted') 
    NOT NULL DEFAULT 'good' 
    AFTER monitor_condition_other,
  
  -- Add light condition tracking (for fly trap monitors)
  ADD COLUMN light_condition ENUM('good', 'faulty', 'na') DEFAULT 'na' 
    COMMENT 'Only for fly_trap monitors' 
    AFTER warning_sign_condition,
  
  -- Add light fault type identification
  ADD COLUMN light_faulty_type ENUM('starter', 'tube', 'cable', 'electricity', 'other', 'na') 
    DEFAULT 'na' 
    COMMENT 'If light is faulty' 
    AFTER light_condition,
  
  -- Add description for 'other' light fault type
  ADD COLUMN light_faulty_other VARCHAR(255) NULL 
    COMMENT 'Description if light_faulty_type is other' 
    AFTER light_faulty_type,
  
  -- Add updated_at timestamp for tracking modifications
  ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP 
    ON UPDATE CURRENT_TIMESTAMP 
    AFTER created_at,
  
  -- Add comment to existing tubes_replaced field
  MODIFY tubes_replaced TINYINT(1) NULL 
    COMMENT 'Only for fly_trap monitors';

-- ============================================================================
-- 3. REPORTS TABLE - Add recommendations field and clarify existing fields
-- ============================================================================

ALTER TABLE reports
  -- Add recommendations field (admin-only, for clients)
  ADD COLUMN recommendations TEXT NULL 
    COMMENT 'Admin-only recommendations for the client' 
    AFTER general_remarks,
  
  -- Update comments on existing fields for clarity
  MODIFY general_remarks TEXT NULL 
    COMMENT 'PCO remarks/notes about the service',
  
  MODIFY admin_notes TEXT NULL 
    COMMENT 'Internal admin notes for PCO (decline reasons, etc.)';

-- ============================================================================
-- 4. VERIFICATION QUERIES
-- ============================================================================

-- Verify bait_stations structure
SELECT 
  'bait_stations' as table_name,
  COLUMN_NAME, 
  COLUMN_TYPE, 
  IS_NULLABLE, 
  COLUMN_DEFAULT,
  COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'kpspestcontrol_app' 
  AND TABLE_NAME = 'bait_stations'
  AND COLUMN_NAME IN ('bait_status', 'action_taken', 'warning_sign_condition')
ORDER BY ORDINAL_POSITION;

-- Verify insect_monitors structure
SELECT 
  'insect_monitors' as table_name,
  COLUMN_NAME, 
  COLUMN_TYPE, 
  IS_NULLABLE, 
  COLUMN_DEFAULT,
  COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'kpspestcontrol_app' 
  AND TABLE_NAME = 'insect_monitors'
  AND COLUMN_NAME IN ('monitor_condition', 'monitor_condition_other', 'warning_sign_condition', 
                      'light_condition', 'light_faulty_type', 'light_faulty_other', 'updated_at')
ORDER BY ORDINAL_POSITION;

-- Verify reports structure
SELECT 
  'reports' as table_name,
  COLUMN_NAME, 
  COLUMN_TYPE, 
  IS_NULLABLE, 
  COLUMN_DEFAULT,
  COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'kpspestcontrol_app' 
  AND TABLE_NAME = 'reports'
  AND COLUMN_NAME IN ('general_remarks', 'recommendations', 'admin_notes')
ORDER BY ORDINAL_POSITION;

-- ============================================================================
-- 5. DATA INTEGRITY CHECKS
-- ============================================================================

-- Check existing bait_stations records (should all have default values)
SELECT 
  COUNT(*) as total_stations,
  SUM(CASE WHEN action_taken IS NULL THEN 1 ELSE 0 END) as null_action_taken,
  SUM(CASE WHEN warning_sign_condition IS NULL THEN 1 ELSE 0 END) as null_warning_sign
FROM bait_stations;

-- Check existing insect_monitors records (should all have default values)
SELECT 
  COUNT(*) as total_monitors,
  SUM(CASE WHEN monitor_condition IS NULL THEN 1 ELSE 0 END) as null_monitor_condition,
  SUM(CASE WHEN warning_sign_condition IS NULL THEN 1 ELSE 0 END) as null_warning_sign,
  SUM(CASE WHEN light_condition IS NULL THEN 1 ELSE 0 END) as null_light_condition
FROM insect_monitors;

-- Check existing reports records
SELECT 
  COUNT(*) as total_reports,
  SUM(CASE WHEN recommendations IS NOT NULL THEN 1 ELSE 0 END) as with_recommendations,
  SUM(CASE WHEN general_remarks IS NOT NULL THEN 1 ELSE 0 END) as with_remarks,
  SUM(CASE WHEN admin_notes IS NOT NULL THEN 1 ELSE 0 END) as with_admin_notes
FROM reports;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

SELECT 'Migration completed successfully!' as status,
       NOW() as completed_at;
