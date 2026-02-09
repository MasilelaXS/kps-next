-- ============================================================================
-- ADD SELF-ASSIGNMENT FEATURE
-- Created: December 13, 2025
-- ============================================================================
-- This script adds support for PCO self-assignment of clients
-- ============================================================================

USE kpspestcontrol_app;

-- Add assignment_type column to track who initiated the assignment
ALTER TABLE client_pco_assignments 
ADD COLUMN assignment_type ENUM('admin', 'self') NOT NULL DEFAULT 'admin' 
AFTER status;

-- Add index for filtering by assignment type
ALTER TABLE client_pco_assignments 
ADD INDEX idx_assignment_type (assignment_type);

-- Add index for common query pattern (status + type)
ALTER TABLE client_pco_assignments 
ADD INDEX idx_status_type (status, assignment_type);

-- Update existing assignments to be 'admin' type (already default, but explicit)
UPDATE client_pco_assignments 
SET assignment_type = 'admin' 
WHERE assignment_type IS NULL;

SELECT 'Self-assignment feature database changes completed successfully!' as status;
