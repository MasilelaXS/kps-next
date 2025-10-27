-- Add email tracking to reports table
-- This allows tracking when reports are emailed to clients

ALTER TABLE reports 
ADD COLUMN emailed_at TIMESTAMP NULL DEFAULT NULL COMMENT 'When the report was last emailed to the client';

-- Index for querying emailed reports
CREATE INDEX idx_reports_emailed_at ON reports(emailed_at);
