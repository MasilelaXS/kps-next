-- =====================================================         OR u.email LIKE CONCAT('%', ?, '%'))
        AND deleted_at IS NULL
    ORDER BY 
        CASE WHEN name LIKE CONCAT(?, '%') THEN 1 ELSE 2 END,===================
-- SEARCH FUNCTIONALITY ENDPOINTS SQL STATEMENTS
-- KPS Pest Control Management System
-- Crea    CASE WHEN ? != '' THEN 
        (c.company_name LIKE CONCAT('%', ?, '%')
         OR c.address_line1 LIKE CONCAT('%', ?, '%'))
    ELSE 1=1 ENDOctober 7, 2025
-- ============================================================================

-- ============================================================================
-- 1. GLOBAL SEARCH ENDPOINTS
-- ============================================================================

-- 1.1 GLOBAL SEARCH (ALL ENTITIES)
-- Description: Search across all major entities in the system
-- Method: GET /api/search/global?q=searchterm&limit=50
-- Required Data: search_term, limit (optional)
-- Returns: Mixed results from clients, users, reports, chemicals

-- Global Search SQL
(
    SELECT 
        'client' as entity_type,
        id as entity_id,
        company_name as title,
        CONCAT(address_line1, ', ', city) as subtitle,
        status,
        created_at,
        'client' as result_type,
        company_name as search_match
    FROM clients 
    WHERE 
        (company_name LIKE CONCAT('%', ?, '%')
         OR address_line1 LIKE CONCAT('%', ?, '%')
         OR city LIKE CONCAT('%', ?, '%'))
        AND deleted_at IS NULL
    ORDER BY 
        CASE WHEN company_name LIKE CONCAT(?, '%') THEN 1 ELSE 2 END,
        company_name
    LIMIT 20
)
UNION ALL
(
    SELECT 
        'user' as entity_type,
        id as entity_id,
        name as title,
        CONCAT(role, ' - ', email) as subtitle,
        status,
        created_at,
        'user' as result_type,
        name as search_match
    FROM users 
    WHERE 
        (name LIKE CONCAT('%', ?, '%')
         OR pco_number LIKE CONCAT('%', ?, '%')
         OR email LIKE CONCAT('%', ?, '%'))
        AND status != 'deleted'
    ORDER BY 
        CASE WHEN name LIKE CONCAT(?, '%') THEN 1 ELSE 2 END,
        name
    LIMIT 15
)
UNION ALL
(
    SELECT 
        'report' as entity_type,
        r.id as entity_id,
        CONCAT('Report #', r.id, ' - ', c.company_name) as title,
        CONCAT(r.report_type, ' on ', DATE_FORMAT(r.service_date, '%Y-%m-%d')) as subtitle,
        r.status,
        r.created_at,
        'report' as result_type,
        c.company_name as search_match
    FROM reports r
    JOIN clients c ON r.client_id = c.id
    WHERE 
        (c.company_name LIKE CONCAT('%', ?, '%')
         OR r.general_remarks LIKE CONCAT('%', ?, '%')
         OR CONCAT('Report #', r.id) LIKE CONCAT('%', ?, '%'))
        AND r.status != 'draft'
    ORDER BY r.service_date DESC
    LIMIT 10
)
UNION ALL
(
    SELECT 
        'chemical' as entity_type,
        id as entity_id,
        name as title,
        usage_type as subtitle,
        status,
        created_at,
        'chemical' as result_type,
        name as search_match
    FROM chemicals 
    WHERE 
        (name LIKE CONCAT('%', ?, '%')
         OR active_ingredients LIKE CONCAT('%', ?, '%'))
        AND deleted_at IS NULL
    ORDER BY 
        CASE WHEN name LIKE CONCAT(?, '%') THEN 1 ELSE 2 END,
        name
    LIMIT 5
)
ORDER BY 
    CASE entity_type
        WHEN 'client' THEN 1
        WHEN 'user' THEN 2  
        WHEN 'report' THEN 3
        WHEN 'chemical' THEN 4
    END,
    CASE WHEN title LIKE CONCAT(?, '%') THEN 1 ELSE 2 END,
    created_at DESC
LIMIT ?;

-- Parameters:
-- ? = search_term (repeated 13 times for different entity searches)
-- ? = limit

-- 1.2 QUICK SEARCH SUGGESTIONS
-- Description: Get quick search suggestions as user types
-- Method: GET /api/search/suggestions?q=partial_term
-- Required Data: partial_term
-- Returns: Top suggestions for autocomplete

-- Search Suggestions SQL
(
    SELECT 
        'client' as type,
        company_name as suggestion,
        id as entity_id
    FROM clients 
    WHERE company_name LIKE CONCAT(?, '%') 
    AND status = 'active'
    ORDER BY company_name
    LIMIT 5
)
UNION ALL
(
    SELECT 
        'user' as type,
        name as suggestion,
        id as entity_id
    FROM users 
    WHERE name LIKE CONCAT(?, '%') 
    AND status = 'active'
    ORDER BY name
    LIMIT 3
)
UNION ALL
(
    SELECT 
        'chemical' as type,
        name as suggestion,
        id as entity_id
    FROM chemicals 
    WHERE name LIKE CONCAT(?, '%') 
    AND status = 'active'
    ORDER BY name
    LIMIT 3
);

-- Parameters:
-- ? = partial_term (repeated 3 times)

-- ============================================================================
-- 2. ENTITY-SPECIFIC SEARCH ENDPOINTS
-- ============================================================================

-- 2.1 CLIENT SEARCH
-- Description: Advanced client search with multiple criteria
-- Method: GET /api/search/clients?q=term&city=&status=active&page=1
-- Required Data: search criteria
-- Returns: Filtered client list

-- Client Search Count
SELECT COUNT(*) as total_count
FROM clients 
WHERE 
    CASE WHEN ? != '' THEN 
        (company_name LIKE CONCAT('%', ?, '%')
         OR address_line1 LIKE CONCAT('%', ?, '%')
         OR contact_person LIKE CONCAT('%', ?, '%'))
    ELSE 1=1 END
    AND CASE WHEN ? != '' THEN city LIKE CONCAT('%', ?, '%') ELSE 1=1 END
    AND CASE WHEN ? != 'all' THEN status = ? ELSE deleted_at IS NULL END;

-- Client Search SQL
SELECT 
    c.id,
    c.company_name,
    c.address_line1,
    c.city,
    c.state,
    c.status,
    c.service_notes,
    (SELECT COUNT(*) FROM reports WHERE client_id = c.id) as total_reports,
    (SELECT MAX(service_date) FROM reports WHERE client_id = c.id) as last_service_date,
    (SELECT u.name FROM client_pco_assignments ca 
     JOIN users u ON ca.pco_id = u.id 
     WHERE ca.client_id = c.id AND ca.status = 'active' 
     LIMIT 1) as assigned_pco_name
FROM clients c
WHERE 
    CASE WHEN ? != '' THEN 
        (c.company_name LIKE CONCAT('%', ?, '%')
         OR c.address_line1 LIKE CONCAT('%', ?, '%'))
    ELSE 1=1 END
    AND CASE WHEN ? != '' THEN c.city LIKE CONCAT('%', ?, '%') ELSE 1=1 END
    AND CASE WHEN ? != 'all' THEN c.status = ? ELSE c.deleted_at IS NULL END
ORDER BY 
    CASE WHEN c.company_name LIKE CONCAT(?, '%') THEN 1 ELSE 2 END,
    c.company_name
LIMIT ? OFFSET ?;

-- Parameters:
-- ? = search_term, city_filter, status_filter (repeated for count and main query)
-- ? = pageSize, offset

-- 2.2 USER SEARCH
-- Description: Search users with role and status filtering
-- Method: GET /api/search/users?q=term&role=all&status=active
-- Required Data: search criteria
-- Returns: Filtered user list

-- User Search SQL
SELECT 
    u.id,
    u.pco_number,
    u.name,
    u.email,
    u.role,
    u.status,
    u.created_at,
    CASE WHEN u.role = 'pco' THEN
        (SELECT COUNT(*) FROM client_pco_assignments 
         WHERE pco_id = u.id AND status = 'active')
    ELSE NULL END as assigned_clients_count,
    CASE WHEN u.role = 'pco' THEN
        (SELECT COUNT(*) FROM reports 
         WHERE pco_id = u.id AND status = 'pending')
    ELSE NULL END as pending_reports_count
FROM users u
WHERE 
    CASE WHEN ? != '' THEN 
        (u.name LIKE CONCAT('%', ?, '%')
         OR u.pco_number LIKE CONCAT('%', ?, '%')
         OR u.email LIKE CONCAT('%', ?, '%'))
    ELSE 1=1 END
    AND CASE WHEN ? != 'all' THEN u.role = ? ELSE u.role != 'super_admin' END
    AND CASE WHEN ? != 'all' THEN u.status = ? ELSE u.deleted_at IS NULL END
ORDER BY 
    CASE u.role
        WHEN 'admin' THEN 1
        WHEN 'pco' THEN 2
    END,
    u.name;

-- Parameters:
-- ? = search_term (repeated 4 times)
-- ? = role_filter, status_filter (repeated twice each)

-- 2.3 REPORT ADVANCED SEARCH
-- Description: Advanced report search with multiple filters
-- Method: GET /api/search/reports?client=&pco=&status=&date_from=&date_to=
-- Required Data: search filters
-- Returns: Filtered report list

-- Report Advanced Search Count
SELECT COUNT(*) as total_count
FROM reports r
JOIN clients c ON r.client_id = c.id
JOIN users u ON r.pco_id = u.id
WHERE 
    CASE WHEN ? != '' THEN c.company_name LIKE CONCAT('%', ?, '%') ELSE 1=1 END
    AND CASE WHEN ? != '' THEN u.name LIKE CONCAT('%', ?, '%') ELSE 1=1 END
    AND CASE WHEN ? != 'all' THEN r.status = ? ELSE r.status != 'draft' END
    AND CASE WHEN ? != '' THEN r.service_date >= ? ELSE 1=1 END
    AND CASE WHEN ? != '' THEN r.service_date <= ? ELSE 1=1 END;

-- Report Advanced Search SQL
SELECT 
    r.id,
    r.report_type,
    r.service_date,
    r.next_service_date,
    r.status,
    r.created_at,
    r.submitted_at,
    c.id as client_id,
    c.company_name,
    c.city,
    u.id as pco_id,
    u.full_name as pco_name,
        c.city,
    u.name as pco_name,
    (SELECT COUNT(*) FROM bait_stations WHERE report_id = r.id) as bait_stations_count,
    CASE WHEN r.client_signature_data IS NOT NULL THEN 1 ELSE 0 END as has_client_signature
FROM reports r
JOIN clients c ON r.client_id = c.id
JOIN users u ON r.pco_id = u.id
WHERE 
    CASE WHEN ? != '' THEN c.company_name LIKE CONCAT('%', ?, '%') ELSE 1=1 END
    AND CASE WHEN ? != '' THEN u.name LIKE CONCAT('%', ?, '%') ELSE 1=1 END
    AND CASE WHEN ? != 'all' THEN r.status = ? ELSE r.status != 'draft' END
    AND CASE WHEN ? != '' THEN r.service_date >= ? ELSE 1=1 END
    AND CASE WHEN ? != '' THEN r.service_date <= ? ELSE 1=1 END
ORDER BY r.service_date DESC, r.created_at DESC
LIMIT ? OFFSET ?;

-- Parameters:
-- ? = client_filter, pco_filter, status_filter, date_from, date_to (repeated for count and main query)
-- ? = pageSize, offset

-- ============================================================================
-- 3. SPECIALIZED SEARCH ENDPOINTS
-- ============================================================================

-- 3.1 CHEMICAL USAGE SEARCH
-- Description: Search for chemical usage across reports
-- Method: GET /api/search/chemical-usage?chemical_id=&date_from=&date_to=
-- Required Data: chemical_id, date range
-- Returns: Reports where specific chemical was used

-- Chemical Usage Search SQL
SELECT 
    r.id as report_id,
    r.service_date,
    r.report_type,
    c.company_name,
    c.city,
    u.full_name as pco_name,
    ch.name as chemical_name,
    'bait' as usage_type,
    sc.quantity,
    sc.batch_number,
    bs.location as usage_location
FROM reports r
JOIN clients c ON r.client_id = c.id
JOIN users u ON r.pco_id = u.id
JOIN bait_stations bs ON r.id = bs.report_id
JOIN station_chemicals sc ON bs.id = sc.station_id
JOIN chemicals ch ON sc.chemical_id = ch.id
WHERE 
    CASE WHEN ? != 'all' THEN ch.id = ? ELSE 1=1 END
    AND CASE WHEN ? != '' THEN r.service_date >= ? ELSE 1=1 END
    AND CASE WHEN ? != '' THEN r.service_date <= ? ELSE 1=1 END
    AND r.status IN ('approved', 'archived')

UNION ALL

SELECT 
    r.id as report_id,
    r.service_date,
    r.report_type,
    c.company_name,
    c.city,
    u.full_name as pco_name,
    ch.name as chemical_name,
    'fumigation' as usage_type,
    fc.quantity,
    fc.batch_number,
    'Fumigation Area' as usage_location
FROM reports r
JOIN clients c ON r.client_id = c.id
JOIN users u ON r.pco_id = u.id
JOIN fumigation_chemicals fc ON r.id = fc.report_id
JOIN chemicals ch ON fc.chemical_id = ch.id
WHERE 
    CASE WHEN ? != 'all' THEN ch.id = ? ELSE 1=1 END
    AND CASE WHEN ? != '' THEN r.service_date >= ? ELSE 1=1 END
    AND CASE WHEN ? != '' THEN r.service_date <= ? ELSE 1=1 END
    AND r.status IN ('approved', 'archived')

ORDER BY service_date DESC, report_id, usage_type;

-- Parameters:
-- ? = chemical_id, date_from, date_to (repeated twice for UNION queries)

-- 3.2 ACTIVITY DETECTION SEARCH
-- Description: Search for reports with specific pest activity
-- Method: GET /api/search/activity?activity_type=droppings&date_from=&date_to=
-- Required Data: activity_type, date range
-- Returns: Reports with detected activity

-- Activity Detection Search SQL
SELECT 
    r.id as report_id,
    r.service_date,
    c.company_name,
    c.city,
    u.full_name as pco_name,
    COUNT(bs.id) as total_stations,
    COUNT(CASE WHEN bs.activity_detected = 1 THEN 1 END) as stations_with_activity,
    COUNT(CASE WHEN ? = 'droppings' AND bs.activity_droppings = 1 THEN 1 END) as specific_activity_count,
    COUNT(CASE WHEN ? = 'gnawing' AND bs.activity_gnawing = 1 THEN 1 END) as specific_activity_count,
    COUNT(CASE WHEN ? = 'tracks' AND bs.activity_tracks = 1 THEN 1 END) as specific_activity_count,
    GROUP_CONCAT(DISTINCT bs.location ORDER BY bs.location SEPARATOR ', ') as affected_locations
FROM reports r
JOIN clients c ON r.client_id = c.id
JOIN users u ON r.pco_id = u.id
JOIN bait_stations bs ON r.id = bs.report_id
WHERE 
    r.status IN ('approved', 'archived')
    AND CASE WHEN ? != '' THEN r.service_date >= ? ELSE 1=1 END
    AND CASE WHEN ? != '' THEN r.service_date <= ? ELSE 1=1 END
    AND (
        CASE 
            WHEN ? = 'droppings' THEN bs.activity_droppings = 1
            WHEN ? = 'gnawing' THEN bs.activity_gnawing = 1
            WHEN ? = 'tracks' THEN bs.activity_tracks = 1
            WHEN ? = 'other' THEN bs.activity_other = 1
            WHEN ? = 'any' THEN bs.activity_detected = 1
            ELSE bs.activity_detected = 1
        END
    )
GROUP BY r.id, r.service_date, c.company_name, c.city, u.full_name
HAVING specific_activity_count > 0 OR ? = 'any'
ORDER BY r.service_date DESC;

-- Parameters:
-- ? = activity_type (repeated multiple times for different conditions)
-- ? = date_from, date_to (repeated)

-- 3.3 LOCATION-BASED SEARCH
-- Description: Search clients and reports by geographic location
-- Method: GET /api/search/location?city=&state=&postal_code=
-- Required Data: location criteria
-- Returns: Clients and recent reports in area

-- Location-Based Search SQL
SELECT 
    'client' as result_type,
    c.id,
    c.company_name as name,
    c.address_line1,
    c.city,
    c.state,
    c.postal_code,
    c.status,
    (SELECT COUNT(*) FROM reports WHERE client_id = c.id) as total_reports,
    (SELECT MAX(service_date) FROM reports WHERE client_id = c.id) as last_service_date,
    NULL as report_id,
    NULL as service_date
FROM clients c
WHERE 
    CASE WHEN ? != '' THEN c.city LIKE CONCAT('%', ?, '%') ELSE 1=1 END
    AND CASE WHEN ? != '' THEN c.state = ? ELSE 1=1 END
    AND CASE WHEN ? != '' THEN c.postal_code LIKE CONCAT(?, '%') ELSE 1=1 END
    AND c.status = 'active'

UNION ALL

SELECT 
    'recent_report' as result_type,
    c.id,
    c.company_name as name,
    c.address_line1,
    c.city,
    c.state,
    c.postal_code,
    r.status,
    NULL as total_reports,
    NULL as last_service_date,
    r.id as report_id,
    r.service_date
FROM reports r
JOIN clients c ON r.client_id = c.id
WHERE 
    CASE WHEN ? != '' THEN c.city LIKE CONCAT('%', ?, '%') ELSE 1=1 END
    AND CASE WHEN ? != '' THEN c.state = ? ELSE 1=1 END
    AND CASE WHEN ? != '' THEN c.postal_code LIKE CONCAT(?, '%') ELSE 1=1 END
    AND r.service_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
    AND r.status IN ('approved', 'archived')

ORDER BY result_type, city, name;

-- Parameters:
-- ? = city, state, postal_code (repeated twice for UNION queries)

-- ============================================================================
-- 4. SEARCH ANALYTICS ENDPOINTS
-- ============================================================================

-- 4.1 POPULAR SEARCH TERMS
-- Description: Get most common search terms (requires search logging)
-- Method: GET /api/search/analytics/popular-terms
-- Required Data: None
-- Returns: Most searched terms

-- Note: This would require a search_logs table to track searches
-- For now, we'll provide entity-based popular items

-- Popular Search Items SQL
SELECT 
    'clients' as category,
    company_name as item,
    COUNT(r.id) as activity_score
FROM clients c
LEFT JOIN reports r ON c.id = r.client_id AND r.service_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
WHERE c.status = 'active'
GROUP BY c.id, c.company_name
ORDER BY activity_score DESC
LIMIT 10

UNION ALL

SELECT 
    'chemicals' as category,
    ch.name as item,
    COUNT(*) as activity_score
FROM chemicals ch
JOIN station_chemicals sc ON ch.id = sc.chemical_id
JOIN bait_stations bs ON sc.station_id = bs.id
JOIN reports r ON bs.report_id = r.id
WHERE r.service_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
GROUP BY ch.id, ch.name
ORDER BY activity_score DESC
LIMIT 5

UNION ALL

SELECT 
    'pcos' as category,
    u.full_name as item,
    COUNT(r.id) as activity_score
FROM users u
LEFT JOIN reports r ON u.id = r.pco_id AND r.service_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
WHERE u.role = 'pco' AND u.status = 'active'
GROUP BY u.id, u.full_name
ORDER BY activity_score DESC
LIMIT 5;

-- Parameters: None

-- 4.2 SEARCH PERFORMANCE METRICS
-- Description: Get search performance statistics
-- Method: GET /api/search/analytics/performance
-- Required Data: None
-- Returns: Search system performance metrics

-- Search Performance Metrics SQL
SELECT 
    (SELECT COUNT(*) FROM clients WHERE deleted_at IS NULL) as total_clients,
    (SELECT COUNT(*) FROM users WHERE deleted_at IS NULL) as total_users,
    (SELECT COUNT(*) FROM reports WHERE status != 'draft') as total_reports,
    (SELECT COUNT(*) FROM chemicals WHERE deleted_at IS NULL) as total_chemicals,
    (SELECT COUNT(*) FROM clients WHERE company_name REGEXP '[0-9]') as clients_with_numbers,
    (SELECT COUNT(*) FROM clients WHERE company_name REGEXP '^[A-E]') as clients_a_to_e,
    (SELECT COUNT(*) FROM clients WHERE company_name REGEXP '^[F-M]') as clients_f_to_m,
    (SELECT COUNT(*) FROM clients WHERE company_name REGEXP '^[N-S]') as clients_n_to_s,
    (SELECT COUNT(*) FROM clients WHERE company_name REGEXP '^[T-Z]') as clients_t_to_z,
    (SELECT COUNT(DISTINCT city) FROM clients WHERE status = 'active') as unique_cities;

-- Parameters: None

-- ============================================================================
-- 5. SAVED SEARCHES AND FILTERS
-- ============================================================================

-- 5.1 SAVE SEARCH FILTER
-- Description: Save frequently used search filters
-- Method: POST /api/search/save-filter
-- Required Data: user_id, filter_name, filter_criteria
-- Returns: Saved filter ID

-- Note: This would require a saved_searches table
-- Table structure would be:
-- saved_searches (id, user_id, filter_name, entity_type, criteria_json, created_at)

-- Save Search Filter SQL (if table exists)
INSERT INTO saved_searches (
    user_id,
    filter_name,
    entity_type,
    criteria_json,
    created_at
) VALUES (
    ?, ?, ?, ?, NOW()
);

-- Get saved filter ID
SELECT LAST_INSERT_ID() as filter_id;

-- Parameters:
-- ? = user_id, filter_name, entity_type, criteria_json

-- 5.2 GET SAVED FILTERS
-- Description: Get user's saved search filters
-- Method: GET /api/search/saved-filters
-- Required Data: user_id
-- Returns: List of saved filters

-- Get Saved Filters SQL (if table exists)
SELECT 
    id,
    filter_name,
    entity_type,
    criteria_json,
    created_at
FROM saved_searches 
WHERE user_id = ?
ORDER BY created_at DESC;

-- Parameters:
-- ? = user_id

-- ============================================================================
-- SAMPLE USAGE EXAMPLES
-- ============================================================================

/*
1. GLOBAL SEARCH:
   Input: q="ABC Company", limit=50
   Query: Multiple UNION queries across clients, users, reports, chemicals
   Output: Mixed results with entity types and relevance scoring

2. CLIENT SEARCH:
   Input: q="restaurant", city="New York", status="active"
   Query: SELECT * FROM clients WHERE company_name LIKE '%restaurant%' AND city LIKE '%New York%' AND status = 'active';
   Output: Filtered client list with assignment and report data

3. CHEMICAL USAGE SEARCH:
   Input: chemical_id=5, date_from="2025-09-01", date_to="2025-10-31"
   Query: UNION of bait and fumigation chemical usage with report details
   Output: All reports using specific chemical in date range

4. ACTIVITY DETECTION:
   Input: activity_type="droppings", date_from="2025-10-01"
   Query: JOIN reports with bait_stations filtering for specific activity type
   Output: Reports with detected rodent droppings and affected locations

5. LOCATION SEARCH:
   Input: city="Chicago", state="IL"
   Query: UNION of active clients and recent reports in geographic area
   Output: Clients and service activity in specified location
*/