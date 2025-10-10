-- ============================================================================
-- CHEMICAL MANAGEMENT ENDPOINTS SQL STATEMENTS
-- KPS Pest Control Management System
-- Created: October 7, 2025
-- ============================================================================

-- ============================================================================
-- 1. CHEMICAL LISTING ENDPOINTS
-- ============================================================================

-- 1.1 GET ALL CHEMICALS (PAGINATED)
-- Description: Get paginated list of all chemicals
-- Method: GET /api/admin/chemicals?page=1&pageSize=25&status=all
-- Required Data: page, pageSize, status (optional)
-- Returns: Paginated chemical list with counts

-- Get Chemicals Count
SELECT COUNT(*) as total_count 
FROM chemicals 
WHERE 
    CASE 
        WHEN ? = 'active' THEN status = 'active'
        WHEN ? = 'inactive' THEN status = 'inactive'
        ELSE 1=1 
    END;

-- Get Chemicals List SQL
SELECT 
    id,
    name,
    active_ingredients,
    usage_type,
    quantity_unit,
    status,
    safety_information,
    created_at,
    updated_at
FROM chemicals 
WHERE 
    CASE 
        WHEN ? = 'active' THEN status = 'active'
        WHEN ? = 'inactive' THEN status = 'inactive'
        ELSE 1=1 
    END
ORDER BY usage_type, name
LIMIT ? OFFSET ?;

-- Parameters:
-- ? = status_filter (for count and query - repeated)
-- ? = pageSize, offset

-- 1.2 GET CHEMICALS BY USAGE TYPE
-- Description: Get chemicals filtered by usage type
-- Method: GET /api/chemicals/type/{usage_type}
-- Required Data: usage_type
-- Returns: Chemicals for specific usage type

-- Get Chemicals by Usage Type SQL
SELECT 
    id,
    name,
    active_ingredients,
    usage_type,
    quantity_unit,
    safety_information
FROM chemicals 
WHERE usage_type = ? AND status = 'active'
ORDER BY name;

-- Parameters:
-- ? = usage_type (bait, fumigation, spray, etc.)

-- 1.3 SEARCH CHEMICALS
-- Description: Search chemicals by name or ingredients
-- Method: GET /api/chemicals/search?q=searchterm
-- Required Data: search_term
-- Returns: Matching chemicals

-- Search Chemicals SQL
SELECT 
    id,
    name,
    active_ingredients,
    usage_type,
    quantity_unit,
    status
FROM chemicals 
WHERE 
    status = 'active'
    AND (
        name LIKE CONCAT('%', ?, '%')
        OR active_ingredients LIKE CONCAT('%', ?, '%')
    )
ORDER BY 
    CASE WHEN name LIKE CONCAT(?, '%') THEN 1 ELSE 2 END,
    name
LIMIT 20;

-- Parameters:
-- ? = search_term (repeated 3 times)

-- ============================================================================
-- 2. CHEMICAL MANAGEMENT ENDPOINTS
-- ============================================================================

-- 2.1 CREATE NEW CHEMICAL
-- Description: Create a new chemical entry
-- Method: POST /api/admin/chemicals
-- Required Data: name, active_ingredients, usage_type, quantity_unit, safety_information
-- Returns: Created chemical ID

-- Check for duplicate chemical name
SELECT id FROM chemicals WHERE name = ? AND deleted_at IS NULL;

-- Create Chemical SQL
INSERT INTO chemicals (
    name,
    active_ingredients,
    usage_type,
    quantity_unit,
    safety_information,
    status
) VALUES (
    ?, ?, ?, ?, ?, 'active'
);

-- Get created chemical ID
SELECT LAST_INSERT_ID() as chemical_id;

-- Parameters:
-- ? = name (for duplicate check)
-- ? = name, active_ingredients, usage_type, quantity_unit, safety_information

-- 2.2 UPDATE CHEMICAL
-- Description: Update existing chemical
-- Method: PUT /api/admin/chemicals/{id}
-- Required Data: chemical_id, updated chemical data
-- Returns: Success message

-- Check chemical exists and not deleted
SELECT id FROM chemicals WHERE id = ? AND deleted_at IS NULL;

-- Check for duplicate name (excluding current chemical)
SELECT id FROM chemicals 
WHERE name = ? AND id != ? AND deleted_at IS NULL;

-- Update Chemical SQL
UPDATE chemicals 
SET 
    name = ?,
    active_ingredients = ?,
    usage_type = ?,
    quantity_unit = ?,
    safety_information = ?,
    updated_at = NOW()
WHERE id = ? AND deleted_at IS NULL;

-- Parameters:
-- ? = chemical_id (for existence check)
-- ? = name, chemical_id (for duplicate check)
-- ? = name, active_ingredients, usage_type, quantity_unit, safety_information, chemical_id

-- 2.3 GET CHEMICAL DETAILS
-- Description: Get detailed chemical information
-- Method: GET /api/admin/chemicals/{id}
-- Required Data: chemical_id
-- Returns: Complete chemical data with usage statistics

-- Get Chemical Details SQL
SELECT 
    id,
    name,
    active_ingredients,
    usage_type,
    quantity_unit,
    safety_information,
    status,
    created_at,
    updated_at
FROM chemicals 
WHERE id = ? AND deleted_at IS NULL;

-- Get Usage Statistics
SELECT 
    (SELECT COUNT(DISTINCT report_id) 
     FROM station_chemicals sc 
     JOIN bait_stations bs ON sc.station_id = bs.id 
     WHERE sc.chemical_id = ?) as bait_usage_count,
    (SELECT COUNT(*) 
     FROM fumigation_chemicals 
     WHERE chemical_id = ?) as fumigation_usage_count,
    (SELECT COUNT(DISTINCT r.pco_id)
     FROM station_chemicals sc 
     JOIN bait_stations bs ON sc.station_id = bs.id
     JOIN reports r ON bs.report_id = r.id
     WHERE sc.chemical_id = ?) as used_by_pcos_count,
    (SELECT MAX(r.service_date)
     FROM station_chemicals sc 
     JOIN bait_stations bs ON sc.station_id = bs.id
     JOIN reports r ON bs.report_id = r.id
     WHERE sc.chemical_id = ?) as last_used_date;

-- Parameters:
-- ? = chemical_id (repeated for all queries)

-- 2.4 ACTIVATE/DEACTIVATE CHEMICAL
-- Description: Change chemical status
-- Method: PUT /api/admin/chemicals/{id}/status
-- Required Data: chemical_id, new_status
-- Returns: Success message

-- Check chemical exists
SELECT id, status FROM chemicals WHERE id = ? AND status != 'deleted';

-- Update Chemical Status SQL
UPDATE chemicals 
SET 
    status = ?,
    updated_at = NOW()
WHERE id = ?;

-- Parameters:
-- ? = chemical_id (for check)
-- ? = new_status, chemical_id

-- 2.5 DELETE CHEMICAL (SOFT DELETE)
-- Description: Soft delete chemical (mark as deleted)
-- Method: DELETE /api/admin/chemicals/{id}
-- Required Data: chemical_id
-- Returns: Success message

-- Check chemical exists and not already deleted
SELECT id FROM chemicals WHERE id = ? AND deleted_at IS NULL;

-- Check if chemical is in use (prevent deletion if actively used)
SELECT 
    (SELECT COUNT(*) FROM station_chemicals sc 
     JOIN bait_stations bs ON sc.station_id = bs.id
     JOIN reports r ON bs.report_id = r.id
     WHERE sc.chemical_id = ? AND r.status IN ('draft', 'pending', 'approved')) +
    (SELECT COUNT(*) FROM fumigation_chemicals fc
     JOIN reports r ON fc.report_id = r.id
     WHERE fc.chemical_id = ? AND r.status IN ('draft', 'pending', 'approved')) as active_usage_count;

-- Soft Delete Chemical SQL
UPDATE chemicals 
SET 
    status = 'inactive',
    deleted_at = NOW(),
    updated_at = NOW()
WHERE id = ?;

-- Parameters:
-- ? = chemical_id (for all checks)

-- ============================================================================
-- 3. CHEMICAL USAGE REPORTING ENDPOINTS
-- ============================================================================

-- 3.1 GET CHEMICAL USAGE REPORT
-- Description: Get usage statistics for chemicals
-- Method: GET /api/admin/chemicals/usage-report?period=last_30_days
-- Required Data: period (last_30_days, last_90_days, last_year, all_time)
-- Returns: Usage statistics per chemical

-- Chemical Usage Report SQL
SELECT 
    c.id,
    c.name,
    c.usage_type,
    COALESCE(bait_usage.usage_count, 0) as bait_usage_count,
    COALESCE(fumigation_usage.usage_count, 0) as fumigation_usage_count,
    (COALESCE(bait_usage.usage_count, 0) + COALESCE(fumigation_usage.usage_count, 0)) as total_usage_count,
    COALESCE(bait_usage.total_quantity, 0) as bait_total_quantity,
    COALESCE(fumigation_usage.total_quantity, 0) as fumigation_total_quantity,
    COALESCE(bait_usage.unique_pcos, 0) as bait_unique_pcos,
    COALESCE(fumigation_usage.unique_pcos, 0) as fumigation_unique_pcos
FROM chemicals c
LEFT JOIN (
    SELECT 
        sc.chemical_id,
        COUNT(*) as usage_count,
        SUM(sc.quantity) as total_quantity,
        COUNT(DISTINCT r.pco_id) as unique_pcos
    FROM station_chemicals sc
    JOIN bait_stations bs ON sc.station_id = bs.id
    JOIN reports r ON bs.report_id = r.id
    WHERE 
        r.status IN ('approved', 'archived')
        AND CASE 
            WHEN ? = 'last_30_days' THEN r.service_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
            WHEN ? = 'last_90_days' THEN r.service_date >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
            WHEN ? = 'last_year' THEN r.service_date >= DATE_SUB(CURDATE(), INTERVAL 1 YEAR)
            ELSE 1=1
        END
    GROUP BY sc.chemical_id
) bait_usage ON c.id = bait_usage.chemical_id
LEFT JOIN (
    SELECT 
        fc.chemical_id,
        COUNT(*) as usage_count,
        SUM(fc.quantity) as total_quantity,
        COUNT(DISTINCT r.pco_id) as unique_pcos
    FROM fumigation_chemicals fc
    JOIN reports r ON fc.report_id = r.id
    WHERE 
        r.status IN ('approved', 'archived')
        AND CASE 
            WHEN ? = 'last_30_days' THEN r.service_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
            WHEN ? = 'last_90_days' THEN r.service_date >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
            WHEN ? = 'last_year' THEN r.service_date >= DATE_SUB(CURDATE(), INTERVAL 1 YEAR)
            ELSE 1=1
        END
    GROUP BY fc.chemical_id
) fumigation_usage ON c.id = fumigation_usage.chemical_id
WHERE c.status = 'active'
ORDER BY total_usage_count DESC, c.name;

-- Parameters:
-- ? = period (repeated 6 times for date filtering)

-- 3.2 GET CHEMICAL USAGE BY PCO
-- Description: Get chemical usage breakdown by PCO
-- Method: GET /api/admin/chemicals/{id}/usage-by-pco
-- Required Data: chemical_id
-- Returns: Usage statistics per PCO for specific chemical

-- Chemical Usage by PCO SQL
SELECT 
    u.id as pco_id,
    u.pco_number as pco_number,
    u.name as pco_name,
    COALESCE(bait_usage.usage_count, 0) as bait_usage_count,
    COALESCE(fumigation_usage.usage_count, 0) as fumigation_usage_count,
    (COALESCE(bait_usage.usage_count, 0) + COALESCE(fumigation_usage.usage_count, 0)) as total_usage_count,
    COALESCE(bait_usage.total_quantity, 0) as bait_total_quantity,
    COALESCE(fumigation_usage.total_quantity, 0) as fumigation_total_quantity,
    COALESCE(GREATEST(bait_usage.last_used, fumigation_usage.last_used), NULL) as last_used_date
FROM users u
LEFT JOIN (
    SELECT 
        r.pco_id,
        COUNT(*) as usage_count,
        SUM(sc.quantity) as total_quantity,
        MAX(r.service_date) as last_used
    FROM station_chemicals sc
    JOIN bait_stations bs ON sc.station_id = bs.id
    JOIN reports r ON bs.report_id = r.id
    WHERE sc.chemical_id = ? AND r.status IN ('approved', 'archived')
    GROUP BY r.pco_id
) bait_usage ON u.id = bait_usage.pco_id
LEFT JOIN (
    SELECT 
        r.pco_id,
        COUNT(*) as usage_count,
        SUM(fc.quantity) as total_quantity,
        MAX(r.service_date) as last_used
    FROM fumigation_chemicals fc
    JOIN reports r ON fc.report_id = r.id
    WHERE fc.chemical_id = ? AND r.status IN ('approved', 'archived')
    GROUP BY r.pco_id
) fumigation_usage ON u.id = fumigation_usage.pco_id
WHERE 
    u.role = 'pco' 
    AND u.status = 'active'
    AND (bait_usage.usage_count > 0 OR fumigation_usage.usage_count > 0)
ORDER BY total_usage_count DESC, u.name;

-- Parameters:
-- ? = chemical_id (repeated twice)

-- 3.3 GET CHEMICAL BATCH TRACKING
-- Description: Get batch number tracking for chemical
-- Method: GET /api/admin/chemicals/{id}/batches
-- Required Data: chemical_id
-- Returns: Batch usage tracking

-- Chemical Batch Tracking SQL
SELECT 
    batch_number,
    MIN(service_date) as first_used_date,
    MAX(service_date) as last_used_date,
    COUNT(DISTINCT r.id) as reports_count,
    COUNT(DISTINCT r.pco_id) as pcos_count,
    SUM(sc.quantity) as total_quantity_used,
    'bait' as usage_context
FROM station_chemicals sc
JOIN bait_stations bs ON sc.station_id = bs.id
JOIN reports r ON bs.report_id = r.id
WHERE sc.chemical_id = ? AND sc.batch_number IS NOT NULL AND sc.batch_number != ''
GROUP BY sc.batch_number

UNION ALL

SELECT 
    batch_number,
    MIN(service_date) as first_used_date,
    MAX(service_date) as last_used_date,
    COUNT(DISTINCT r.id) as reports_count,
    COUNT(DISTINCT r.pco_id) as pcos_count,
    SUM(fc.quantity) as total_quantity_used,
    'fumigation' as usage_context
FROM fumigation_chemicals fc
JOIN reports r ON fc.report_id = r.id
WHERE fc.chemical_id = ? AND fc.batch_number IS NOT NULL AND fc.batch_number != ''
GROUP BY fc.batch_number

ORDER BY first_used_date DESC;

-- Parameters:
-- ? = chemical_id (repeated twice)

-- ============================================================================
-- 4. CHEMICAL INVENTORY ENDPOINTS
-- ============================================================================

-- 4.1 GET LOW STOCK CHEMICALS
-- Description: Get chemicals that may need restocking (based on usage patterns)
-- Method: GET /api/admin/chemicals/low-stock
-- Required Data: None (admin access only)
-- Returns: Chemicals with high recent usage

-- Note: This is a predictive analysis based on usage trends
-- since we don't track actual inventory quantities

-- Low Stock Analysis SQL
SELECT 
    c.id,
    c.name,
    c.usage_type,
    recent_usage.usage_count_30_days,
    recent_usage.total_quantity_30_days,
    recent_usage.unique_pcos_30_days,
    historical_usage.avg_monthly_usage,
    (recent_usage.usage_count_30_days / NULLIF(historical_usage.avg_monthly_usage, 0)) as usage_trend_ratio
FROM chemicals c
JOIN (
    -- Recent 30 days usage
    SELECT 
        chemical_id,
        COUNT(*) as usage_count_30_days,
        SUM(quantity) as total_quantity_30_days,
        COUNT(DISTINCT pco_id) as unique_pcos_30_days
    FROM (
        SELECT sc.chemical_id, sc.quantity, r.pco_id
        FROM station_chemicals sc
        JOIN bait_stations bs ON sc.station_id = bs.id
        JOIN reports r ON bs.report_id = r.id
        WHERE r.service_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        AND r.status IN ('approved', 'archived')
        
        UNION ALL
        
        SELECT fc.chemical_id, fc.quantity, r.pco_id
        FROM fumigation_chemicals fc
        JOIN reports r ON fc.report_id = r.id
        WHERE r.service_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        AND r.status IN ('approved', 'archived')
    ) recent_data
    GROUP BY chemical_id
) recent_usage ON c.id = recent_usage.chemical_id
JOIN (
    -- Historical average monthly usage
    SELECT 
        chemical_id,
        (COUNT(*) / GREATEST(DATEDIFF(MAX(service_date), MIN(service_date)) / 30, 1)) as avg_monthly_usage
    FROM (
        SELECT sc.chemical_id, r.service_date
        FROM station_chemicals sc
        JOIN bait_stations bs ON sc.station_id = bs.id
        JOIN reports r ON bs.report_id = r.id
        WHERE r.status IN ('approved', 'archived')
        AND r.service_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
        
        UNION ALL
        
        SELECT fc.chemical_id, r.service_date
        FROM fumigation_chemicals fc
        JOIN reports r ON fc.report_id = r.id
        WHERE r.status IN ('approved', 'archived')
        AND r.service_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
    ) historical_data
    GROUP BY chemical_id
    HAVING COUNT(*) >= 3  -- Minimum usage to calculate trend
) historical_usage ON c.id = historical_usage.chemical_id
WHERE 
    c.status = 'active'
    AND recent_usage.usage_count_30_days >= 5  -- High recent usage
ORDER BY usage_trend_ratio DESC, recent_usage.total_quantity_30_days DESC;

-- Parameters: None

-- 4.2 GET CHEMICAL SAFETY ALERTS
-- Description: Get chemicals requiring safety attention
-- Method: GET /api/admin/chemicals/safety-alerts
-- Required Data: None
-- Returns: Chemicals with safety considerations

-- Chemical Safety Alerts SQL
SELECT 
    c.id,
    c.name,
    c.active_ingredients,
    c.usage_type,
    c.safety_information,
    recent_usage.recent_usage_count,
    recent_usage.unique_pcos_using,
    'high_usage' as alert_type,
    'Chemical has high recent usage - ensure adequate safety training' as alert_message
FROM chemicals c
JOIN (
    SELECT 
        chemical_id,
        COUNT(*) as recent_usage_count,
        COUNT(DISTINCT pco_id) as unique_pcos_using
    FROM (
        SELECT sc.chemical_id, r.pco_id
        FROM station_chemicals sc
        JOIN bait_stations bs ON sc.station_id = bs.id
        JOIN reports r ON bs.report_id = r.id
        WHERE r.service_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        
        UNION ALL
        
        SELECT fc.chemical_id, r.pco_id
        FROM fumigation_chemicals fc
        JOIN reports r ON fc.report_id = r.id
        WHERE r.service_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
    ) usage_data
    GROUP BY chemical_id
) recent_usage ON c.id = recent_usage.chemical_id
WHERE 
    c.status = 'active'
    AND (
        recent_usage.recent_usage_count >= 10  -- High usage threshold
        OR recent_usage.unique_pcos_using >= 3  -- Multiple PCO usage
        OR c.safety_information LIKE '%WARNING%'
        OR c.safety_information LIKE '%DANGER%'
        OR c.safety_information LIKE '%TOXIC%'
    )
ORDER BY recent_usage.recent_usage_count DESC;

-- Parameters: None

-- ============================================================================
-- 5. BULK OPERATIONS ENDPOINTS
-- ============================================================================

-- 5.1 BULK UPDATE CHEMICAL STATUS
-- Description: Update status for multiple chemicals
-- Method: PUT /api/admin/chemicals/bulk-status
-- Required Data: chemical_ids array, new_status
-- Returns: Success message with count

-- Bulk Update Chemical Status SQL (loop for each ID)
UPDATE chemicals 
SET 
    status = ?,
    updated_at = NOW()
WHERE id IN (?, ?, ?, ?)  -- Expand based on array size
AND status != 'deleted';

-- Get update count
SELECT ROW_COUNT() as updated_count;

-- Parameters:
-- ? = new_status, chemical_ids... (expand based on array)

-- 5.2 EXPORT CHEMICALS DATA
-- Description: Export all chemicals data as CSV-friendly format
-- Method: GET /api/admin/chemicals/export
-- Required Data: format (csv, json)
-- Returns: Complete chemicals dataset

-- Export Chemicals SQL
SELECT 
    c.id,
    c.name,
    c.active_ingredients,
    c.usage_type,
    c.quantity_unit,
    c.status,
    c.safety_information,
    c.created_at,
    c.updated_at,
    COALESCE(usage_stats.total_usage, 0) as total_usage_count,
    COALESCE(usage_stats.last_used, '') as last_used_date
FROM chemicals c
LEFT JOIN (
    SELECT 
        chemical_id,
        COUNT(*) as total_usage,
        MAX(service_date) as last_used
    FROM (
        SELECT sc.chemical_id, r.service_date
        FROM station_chemicals sc
        JOIN bait_stations bs ON sc.station_id = bs.id
        JOIN reports r ON bs.report_id = r.id
        
        UNION ALL
        
        SELECT fc.chemical_id, r.service_date
        FROM fumigation_chemicals fc
        JOIN reports r ON fc.report_id = r.id
    ) all_usage
    GROUP BY chemical_id
) usage_stats ON c.id = usage_stats.chemical_id
WHERE c.deleted_at IS NULL
ORDER BY c.usage_type, c.name;

-- Parameters: None

-- ============================================================================
-- SAMPLE USAGE EXAMPLES
-- ============================================================================

/*
1. GET ACTIVE BAIT CHEMICALS:
   Input: usage_type="bait"
   Query: SELECT id, name FROM chemicals WHERE usage_type = 'bait_inspection' AND status = 'active';
   Output: [{"id": 1, "name": "Rodenticide Bait Block"}, ...]

2. CREATE NEW CHEMICAL:
   Input: {"name": "New Fumigant", "usage_type": "fumigation"}
   Query: INSERT INTO chemicals (name, usage_type, status) VALUES ('New Fumigant', 'fumigation', 'active');
   Output: {"chemical_id": 8}

3. GET USAGE REPORT:
   Input: period="last_30_days"
   Query: Complex join with date filtering for usage statistics
   Output: Usage statistics per chemical with counts and quantities

4. SEARCH CHEMICALS:
   Input: q="rodent"
   Query: SELECT * FROM chemicals WHERE name LIKE '%rodent%' OR active_ingredients LIKE '%rodent%';
   Output: Matching chemical records
*/