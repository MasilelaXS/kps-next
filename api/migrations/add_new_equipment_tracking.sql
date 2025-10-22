-- Migration: Add tracking for newly added bait stations and insect monitors
-- Purpose: Track new equipment additions for invoicing and reporting
-- Date: 2025-10-22

-- Add is_new_addition column to bait_stations table
ALTER TABLE bait_stations 
ADD COLUMN is_new_addition TINYINT(1) NOT NULL DEFAULT 0 
COMMENT 'Indicates if this station was newly added' 
AFTER rodent_box_replaced;

-- Add is_new_addition column to insect_monitors table
ALTER TABLE insect_monitors 
ADD COLUMN is_new_addition TINYINT(1) NOT NULL DEFAULT 0 
COMMENT 'Indicates if this monitor was newly added' 
AFTER monitor_serviced;

-- Add index for better query performance
CREATE INDEX idx_new_additions ON bait_stations(report_id, is_new_addition);
CREATE INDEX idx_new_additions_monitors ON insect_monitors(report_id, is_new_addition);

-- Add summary columns to reports table for quick access
ALTER TABLE reports
ADD COLUMN new_bait_stations_count INT(11) NOT NULL DEFAULT 0 
COMMENT 'Count of newly added bait stations in this report'
AFTER next_service_date;

ALTER TABLE reports
ADD COLUMN new_insect_monitors_count INT(11) NOT NULL DEFAULT 0 
COMMENT 'Count of newly added insect monitors in this report'
AFTER new_bait_stations_count;
