-- ============================================================================
-- USER MANAGEMENT ENDPOINTS SQL STATEMENTS
-- KPS Pest Control Management System  
-- Created: October 7, 2025
-- ============================================================================

-- ============================================================================
-- 1. USER LISTING ENDPOINTS
-- ============================================================================

-- 1.1 GET ALL USERS (PAGINATED)
-- Description: Get paginated list of users
-- Method: GET /api/admin/users?page=1&pageSize=25&role=all&status=all
-- Required Data: page, pageSize, role_filter, status_filter
-- Returns: Paginated user list

-- Get Users Count SQL
SELECT COUNT(*) as total_count 
FROM users 
WHERE 
    deleted_at IS NULL
    AND CASE WHEN ? != 'all' THEN role = ? ELSE 1=1 END
    AND CASE WHEN ? != 'all' THEN status = ? ELSE 1=1 END;

-- Get Users Paginated SQL
SELECT 
    id,
    pco_number,
    name,
    email,
    phone,
    role,
    status,
    created_at,
    updated_at,
    -- Assignment statistics for PCOs
    CASE WHEN role IN ('pco', 'both') THEN
        (SELECT COUNT(*) FROM client_pco_assignments 
         WHERE pco_id = users.id AND status = 'active')
    ELSE NULL END as active_assignments,
    -- Report statistics for PCOs  
    CASE WHEN role IN ('pco', 'both') THEN
        (SELECT COUNT(*) FROM reports 
         WHERE pco_id = users.id AND status = 'pending')
    ELSE NULL END as pending_reports,
    -- Last login (if tracking)
    NULL as last_login
FROM users 
WHERE 
    deleted_at IS NULL
    AND CASE WHEN ? != 'all' THEN role = ? ELSE 1=1 END
    AND CASE WHEN ? != 'all' THEN status = ? ELSE 1=1 END
ORDER BY 
    CASE role
        WHEN 'admin' THEN 1
        WHEN 'both' THEN 2  
        WHEN 'pco' THEN 3
    END,
    name
LIMIT ? OFFSET ?;

-- Parameters:
-- ? = role_filter, status_filter (for count and main query)
-- ? = pageSize, offset

-- 1.2 SEARCH USERS
-- Description: Search users by name, PCO number, or email
-- Method: GET /api/admin/users/search?q=searchterm
-- Required Data: search_term
-- Returns: Matching users

-- Search Users SQL
SELECT 
    id,
    pco_number,
    name,
    email,
    role,
    status,
    created_at
FROM users 
WHERE 
    deleted_at IS NULL
    AND (
        name LIKE CONCAT('%', ?, '%')
        OR pco_number LIKE CONCAT('%', ?, '%')
        OR email LIKE CONCAT('%', ?, '%')
    )
ORDER BY 
    CASE WHEN name LIKE CONCAT(?, '%') THEN 1 ELSE 2 END,
    name
LIMIT 25;

-- Parameters:
-- ? = search_term (repeated 4 times)

-- ============================================================================
-- 2. USER CRUD OPERATIONS
-- ============================================================================

-- 2.1 GET USER DETAILS
-- Description: Get detailed user information
-- Method: GET /api/admin/users/{id}
-- Required Data: user_id
-- Returns: Complete user data with statistics

-- Verify user exists
SELECT id FROM users WHERE id = ? AND deleted_at IS NULL;

-- Get User Details SQL
SELECT 
    u.id,
    u.pco_number,
    u.name,
    u.email,
    u.phone,
    u.role,
    u.status,
    u.created_at,
    u.updated_at
FROM users u
WHERE u.id = ? AND u.deleted_at IS NULL;

-- Get User Statistics (for PCOs)
SELECT 
    (SELECT COUNT(*) FROM client_pco_assignments 
     WHERE pco_id = ? AND status = 'active') as active_assignments,
    (SELECT COUNT(*) FROM client_pco_assignments 
     WHERE pco_id = ?) as total_assignments,
    (SELECT COUNT(*) FROM reports WHERE pco_id = ?) as total_reports,
    (SELECT COUNT(*) FROM reports 
     WHERE pco_id = ? AND status = 'approved') as approved_reports,
    (SELECT COUNT(*) FROM reports 
     WHERE pco_id = ? AND status = 'pending') as pending_reports,
    (SELECT MAX(service_date) FROM reports WHERE pco_id = ?) as last_service_date;

-- Parameters:
-- ? = user_id (for all queries)

-- 2.2 CREATE NEW USER
-- Description: Create new user (PCO or admin)
-- Method: POST /api/admin/users
-- Required Data: user data
-- Returns: Created user ID

-- Check for duplicate PCO number
SELECT id FROM users WHERE pco_number = ? AND deleted_at IS NULL;

-- Check for duplicate email
SELECT id FROM users WHERE email = ? AND deleted_at IS NULL;

-- Create User SQL
INSERT INTO users (
    pco_number,
    name,
    email,
    phone,
    password_hash,
    role,
    status
) VALUES (
    ?, ?, ?, ?, ?, ?, 'active'
);

-- Get created user ID
SELECT LAST_INSERT_ID() as user_id;

-- Parameters:
-- ? = pco_number (for duplicate check)
-- ? = email (for duplicate check)
-- ? = pco_number, name, email, phone, password_hash, role

-- 2.3 UPDATE USER
-- Description: Update existing user information
-- Method: PUT /api/admin/users/{id}
-- Required Data: user_id, updated user data
-- Returns: Success message

-- Verify user exists
SELECT id FROM users WHERE id = ? AND deleted_at IS NULL;

-- Check for duplicate PCO number (excluding current user)
SELECT id FROM users 
WHERE pco_number = ? AND id != ? AND deleted_at IS NULL;

-- Check for duplicate email (excluding current user)
SELECT id FROM users 
WHERE email = ? AND id != ? AND deleted_at IS NULL;

-- Update User SQL
UPDATE users 
SET 
    pco_number = ?,
    name = ?,
    email = ?,
    phone = ?,
    role = ?,
    updated_at = NOW()
WHERE id = ? AND deleted_at IS NULL;

-- Parameters:
-- ? = user_id (for verification)
-- ? = pco_number, user_id (for duplicate check)
-- ? = email, user_id (for duplicate check)
-- ? = pco_number, name, email, phone, role, user_id

-- 2.4 CHANGE USER STATUS
-- Description: Activate/deactivate user
-- Method: PUT /api/admin/users/{id}/status
-- Required Data: user_id, new_status
-- Returns: Success message

-- Verify user exists
SELECT id, status FROM users WHERE id = ? AND deleted_at IS NULL;

-- Update User Status SQL
UPDATE users 
SET 
    status = ?,
    updated_at = NOW()
WHERE id = ? AND deleted_at IS NULL;

-- If deactivating PCO, unassign from all clients
UPDATE client_pco_assignments 
SET 
    status = 'inactive',
    unassigned_at = NOW()
WHERE pco_id = ? AND status = 'active' AND ? = 'inactive';

-- Parameters:
-- ? = user_id (for verification)
-- ? = new_status, user_id
-- ? = user_id, new_status (for unassignment)

-- 2.5 DELETE USER (SOFT DELETE)
-- Description: Soft delete user
-- Method: DELETE /api/admin/users/{id}
-- Required Data: user_id
-- Returns: Success message

-- Verify user exists and not already deleted
SELECT id, status FROM users WHERE id = ? AND deleted_at IS NULL;

-- Check if user has pending reports (prevent deletion)
SELECT COUNT(*) as pending_count
FROM reports 
WHERE pco_id = ? AND status IN ('draft', 'pending');

-- Soft Delete User SQL
UPDATE users 
SET 
    status = 'inactive',
    deleted_at = NOW(),
    updated_at = NOW()
WHERE id = ? AND deleted_at IS NULL;

-- Unassign from all clients
UPDATE client_pco_assignments 
SET 
    status = 'inactive',
    unassigned_at = NOW()
WHERE pco_id = ? AND status = 'active';

-- Parameters:
-- ? = user_id (for all operations)

-- ============================================================================
-- 3. PASSWORD MANAGEMENT
-- ============================================================================

-- 3.1 RESET USER PASSWORD
-- Description: Reset user password (admin function)
-- Method: PUT /api/admin/users/{id}/reset-password
-- Required Data: user_id, new_password_hash
-- Returns: Success message

-- Verify user exists
SELECT id FROM users WHERE id = ? AND deleted_at IS NULL;

-- Update Password SQL
UPDATE users 
SET 
    password_hash = ?,
    updated_at = NOW()
WHERE id = ? AND deleted_at IS NULL;

-- Create notification for user
INSERT INTO notifications (user_id, type, title, message)
VALUES (?, 'system_update', 'Password Reset', 
        'Your password has been reset by an administrator. Please change it after logging in.');

-- Parameters:
-- ? = user_id (for verification and operations)
-- ? = new_password_hash, user_id

-- ============================================================================
-- 4. USER ASSIGNMENT MANAGEMENT
-- ============================================================================

-- 4.1 GET USER ASSIGNMENTS
-- Description: Get all client assignments for a PCO
-- Method: GET /api/admin/users/{id}/assignments
-- Required Data: user_id
-- Returns: Assignment history and current assignments

-- Verify user is PCO
SELECT id FROM users 
WHERE id = ? AND role IN ('pco', 'both') AND deleted_at IS NULL;

-- Get Current Assignments SQL
SELECT 
    c.id as client_id,
    c.company_name,
    c.address_line1,
    c.city,
    c.status as client_status,
    ca.assigned_at,
    ca.status as assignment_status,
    (SELECT COUNT(*) FROM reports WHERE client_id = c.id AND pco_id = ?) as total_reports,
    (SELECT MAX(service_date) FROM reports WHERE client_id = c.id AND pco_id = ?) as last_service_date
FROM client_pco_assignments ca
JOIN clients c ON ca.client_id = c.id
WHERE ca.pco_id = ? AND ca.status = 'active'
ORDER BY ca.assigned_at DESC;

-- Get Assignment History SQL
SELECT 
    c.company_name,
    ca.assigned_at,
    ca.unassigned_at,
    ca.status,
    assigned_by_user.name as assigned_by_name,
    unassigned_by_user.name as unassigned_by_name
FROM client_pco_assignments ca
JOIN clients c ON ca.client_id = c.id
JOIN users assigned_by_user ON ca.assigned_by = assigned_by_user.id
LEFT JOIN users unassigned_by_user ON ca.unassigned_by = unassigned_by_user.id
WHERE ca.pco_id = ?
ORDER BY ca.assigned_at DESC
LIMIT 20;

-- Parameters:
-- ? = user_id (for all queries)

-- 4.2 BULK UNASSIGN PCO
-- Description: Unassign PCO from all clients
-- Method: POST /api/admin/users/{id}/unassign-all
-- Required Data: user_id, unassigned_by
-- Returns: Count of unassignments

-- Verify user is PCO
SELECT id FROM users 
WHERE id = ? AND role IN ('pco', 'both') AND deleted_at IS NULL;

-- Get count of active assignments
SELECT COUNT(*) as assignment_count
FROM client_pco_assignments 
WHERE pco_id = ? AND status = 'active';

-- Bulk Unassign SQL
UPDATE client_pco_assignments 
SET 
    status = 'inactive',
    unassigned_at = NOW(),
    unassigned_by = ?
WHERE pco_id = ? AND status = 'active';

-- Get unassignment count
SELECT ROW_COUNT() as unassigned_count;

-- Parameters:
-- ? = user_id (for verification and operations)
-- ? = unassigned_by, user_id

-- ============================================================================
-- SAMPLE USAGE EXAMPLES
-- ============================================================================

/*
1. GET ALL USERS:
   Input: page=1, pageSize=25, role="pco", status="active"
   Query: SELECT * FROM users WHERE role = 'pco' AND status = 'active';
   Output: Paginated list of active PCO users with assignment statistics

2. CREATE NEW USER:
   Input: {
     "pco_number": "98765",
     "name": "Jane Smith",
     "email": "jane@kps.com",
     "role": "pco"
   }
   Query: INSERT INTO users (pco_number, name, email, role, status) VALUES ('98765', 'Jane Smith', 'jane@kps.com', 'pco', 'active');
   Output: {"user_id": 25}

3. UPDATE USER STATUS:
   Input: user_id=5, status="inactive"
   Query: UPDATE users SET status = 'inactive' WHERE id = 5;
   Result: User deactivated, all assignments unassigned

4. SEARCH USERS:
   Input: search_term="john"
   Query: SELECT * FROM users WHERE name LIKE '%john%';
   Output: Matching users with "john" in name, PCO number, or email

5. GET USER ASSIGNMENTS:
   Input: user_id=2
   Query: SELECT client assignments and history for PCO
   Output: Current assignments and assignment history for the PCO
*/