-- ============================================================================
-- CLEAR REPORT-RELATED DATA BEFORE MIGRATION
-- Run this first, then run MIGRATE-OLD-DATA.sql
-- ============================================================================

USE kpspestcontrol_app;

-- Disable foreign key checks temporarily
SET FOREIGN_KEY_CHECKS = 0;

-- Clear child tables first
DELETE FROM station_chemicals;
DELETE FROM bait_stations;
DELETE FROM fumigation_chemicals;
DELETE FROM fumigation_target_pests;
DELETE FROM insect_monitors;
DELETE FROM migration_id_map_reports;
DELETE FROM reports;

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

-- Reset auto-increment counters
ALTER TABLE reports AUTO_INCREMENT = 1;
ALTER TABLE bait_stations AUTO_INCREMENT = 1;
ALTER TABLE station_chemicals AUTO_INCREMENT = 1;
ALTER TABLE fumigation_chemicals AUTO_INCREMENT = 1;
ALTER TABLE fumigation_target_pests AUTO_INCREMENT = 1;
ALTER TABLE insect_monitors AUTO_INCREMENT = 1;
ALTER TABLE migration_id_map_reports AUTO_INCREMENT = 1;

SELECT 'Report tables cleared successfully' as status;
