-- Fix activity_droppings for Feb 10-11, 2026 reports
-- Run this directly in your MySQL/MariaDB database

-- Update bait_stations for reports with service_date = 2026-02-10 or 2026-02-11
UPDATE bait_stations
SET activity_droppings = 0
WHERE report_id IN (
    SELECT id 
    FROM reports 
    WHERE service_date IN ('2026-02-10', '2026-02-11')
);

-- Verify the changes
SELECT COUNT(*) as updated_count
FROM bait_stations
WHERE report_id IN (
    SELECT id 
    FROM reports 
    WHERE service_date IN ('2026-02-10', '2026-02-11')
);
