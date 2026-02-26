-- Migration: Aerosol Units Feature
-- v1.0.33 — Add aerosol units equipment type and glue board quantity
-- Run date: 2025

-- 1. Change glue_board_replaced from boolean to quantity (0-8)
ALTER TABLE insect_monitors 
  MODIFY COLUMN glue_board_replaced TINYINT(3) UNSIGNED NOT NULL DEFAULT 0;

-- 2. Add aerosol unit baseline count to clients
ALTER TABLE clients 
  ADD COLUMN total_aerosol_units INT NOT NULL DEFAULT 0;

-- 3. Add new aerosol units count to reports
ALTER TABLE reports 
  ADD COLUMN new_aerosol_units_count INT NOT NULL DEFAULT 0;

-- 4. Create aerosol_units tracking table
CREATE TABLE IF NOT EXISTS aerosol_units (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  report_id INT NOT NULL,
  unit_number VARCHAR(20) NOT NULL,
  action_taken ENUM('battery_changed','aerosol_changed','aerosol_changed and battery_changed','unit_replaced') NOT NULL,
  chemical_id INT NULL,
  chemical_quantity DECIMAL(10,2) NULL,
  chemical_batch_number VARCHAR(100) NULL,
  is_new_addition TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
  FOREIGN KEY (chemical_id) REFERENCES chemicals(id)
);
