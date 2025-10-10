-- ============================================================================
-- AUTHENTICATION ENDPOINTS SQL STATEMENTS
-- KPS Pest Control Management System
-- Created: October 7, 2025
-- ============================================================================

-- ============================================================================
-- 1. LOGIN ENDPOINT
-- ============================================================================
-- Description: Authenticate user with login string and password
-- Method: POST /api/auth/login
-- Required Data: login_string (admin12345 or pco67890), password
-- Returns: User data with JWT token information

-- Login SQL Query
SELECT 
    u.id,
    u.pco_number,
    u.name,
    u.email,
    u.role,
    u.status,
    CASE 
        WHEN LEFT(?, 5) = 'admin' THEN 'admin'
        WHEN LEFT(?, 3) = 'pco' THEN 'pco'
        ELSE NULL 
    END as role_context
FROM users u 
WHERE u.pco_number = CASE 
    WHEN LEFT(?, 5) = 'admin' THEN SUBSTRING(?, 6)
    WHEN LEFT(?, 3) = 'pco' THEN SUBSTRING(?, 4)
    ELSE NULL 
END
AND u.password_hash = ?
AND u.status = 'active'
AND (
    (LEFT(?, 5) = 'admin' AND u.role IN ('admin', 'both'))
    OR 
    (LEFT(?, 3) = 'pco' AND u.role IN ('pco', 'both'))
);

-- Alternative using stored function (recommended)
SELECT AuthenticateUser(?, ?) as auth_result;

-- Parameters:
-- ? = login_string (e.g., "admin12345" or "pco67890")
-- ? = password_hash (bcrypt hash)

-- ============================================================================
-- 2. CREATE SESSION ENDPOINT
-- ============================================================================
-- Description: Create new session after successful login
-- Method: POST /api/auth/session
-- Required Data: user_id, role_context, ip_address, user_agent
-- Returns: session_id

-- Create Session SQL
INSERT INTO user_sessions (
    id, user_id, role_context, ip_address, user_agent, expires_at
) VALUES (
    ?, -- session_id (UUID)
    ?, -- user_id
    ?, -- role_context ('admin' or 'pco')
    ?, -- ip_address
    ?, -- user_agent
    DATE_ADD(NOW(), INTERVAL 24 HOUR) -- expires in 24 hours
);

-- Parameters:
-- ? = session_id (UUID string)
-- ? = user_id (from login result)
-- ? = role_context ('admin' or 'pco')
-- ? = ip_address
-- ? = user_agent

-- ============================================================================
-- 3. VALIDATE SESSION ENDPOINT
-- ============================================================================
-- Description: Validate existing session and get user data
-- Method: GET /api/auth/validate
-- Required Data: session_id
-- Returns: User data if session valid

-- Validate Session SQL
SELECT 
    s.user_id,
    s.role_context,
    s.expires_at,
    u.pco_number,
    u.name,
    u.email,
    u.role,
    u.status
FROM user_sessions s
JOIN users u ON s.user_id = u.id
WHERE s.id = ?
AND s.expires_at > NOW()
AND u.status = 'active';

-- Update last activity
UPDATE user_sessions 
SET last_activity = NOW() 
WHERE id = ? AND expires_at > NOW();

-- Parameters:
-- ? = session_id

-- ============================================================================
-- 4. LOGOUT ENDPOINT
-- ============================================================================
-- Description: Logout user and invalidate session
-- Method: POST /api/auth/logout
-- Required Data: session_id
-- Returns: Success message

-- Logout SQL
DELETE FROM user_sessions 
WHERE id = ?;

-- Parameters:
-- ? = session_id

-- ============================================================================
-- 5. FORGOT PASSWORD ENDPOINT
-- ============================================================================
-- Description: Generate password reset token
-- Method: POST /api/auth/forgot-password
-- Required Data: pco_number
-- Returns: Success message (token sent via email)

-- Check if user exists
SELECT id, email, name 
FROM users 
WHERE pco_number = ? AND status = 'active';

-- Generate reset token
INSERT INTO password_reset_tokens (
    user_id, token, expires_at
) VALUES (
    ?, -- user_id
    ?, -- reset_token (UUID)
    DATE_ADD(NOW(), INTERVAL 1 HOUR) -- expires in 1 hour
);

-- Parameters:
-- ? = pco_number
-- ? = user_id
-- ? = reset_token (UUID)

-- ============================================================================
-- 6. VERIFY RESET TOKEN ENDPOINT
-- ============================================================================
-- Description: Verify password reset token validity
-- Method: GET /api/auth/verify-reset-token
-- Required Data: token
-- Returns: Token validity status

-- Verify Reset Token SQL
SELECT 
    prt.user_id,
    prt.expires_at,
    u.pco_number,
    u.name,
    u.email
FROM password_reset_tokens prt
JOIN users u ON prt.user_id = u.id
WHERE prt.token = ?
AND prt.expires_at > NOW()
AND prt.used_at IS NULL
AND u.status = 'active';

-- Parameters:
-- ? = reset_token

-- ============================================================================
-- 7. RESET PASSWORD ENDPOINT
-- ============================================================================
-- Description: Reset password using valid token
-- Method: POST /api/auth/reset-password
-- Required Data: token, new_password
-- Returns: Success message

-- Reset Password SQL
UPDATE users 
SET password_hash = ?, updated_at = NOW()
WHERE id = (
    SELECT user_id FROM password_reset_tokens 
    WHERE token = ? 
    AND expires_at > NOW() 
    AND used_at IS NULL
);

-- Mark token as used
UPDATE password_reset_tokens 
SET used_at = NOW() 
WHERE token = ?;

-- Parameters:
-- ? = new_password_hash (bcrypt)
-- ? = reset_token
-- ? = reset_token (for marking as used)

-- ============================================================================
-- 8. CHANGE PASSWORD ENDPOINT
-- ============================================================================
-- Description: Change password for authenticated user
-- Method: POST /api/auth/change-password
-- Required Data: user_id, current_password, new_password
-- Returns: Success message

-- Verify current password
SELECT id FROM users 
WHERE id = ? 
AND password_hash = ? 
AND status = 'active';

-- Update password
UPDATE users 
SET password_hash = ?, updated_at = NOW() 
WHERE id = ?;

-- Parameters:
-- ? = user_id
-- ? = current_password_hash
-- ? = new_password_hash
-- ? = user_id

-- ============================================================================
-- 9. GET USER PROFILE ENDPOINT
-- ============================================================================
-- Description: Get current user profile data
-- Method: GET /api/auth/profile
-- Required Data: user_id
-- Returns: User profile information

-- Get User Profile SQL
SELECT 
    id,
    pco_number,
    name,
    email,
    phone,
    role,
    status,
    created_at,
    updated_at
FROM users 
WHERE id = ? AND status = 'active';

-- Parameters:
-- ? = user_id

-- ============================================================================
-- 10. UPDATE USER PROFILE ENDPOINT
-- ============================================================================
-- Description: Update user profile information
-- Method: PUT /api/auth/profile
-- Required Data: user_id, name, email, phone
-- Returns: Updated profile data

-- Update User Profile SQL
UPDATE users 
SET 
    name = ?,
    email = ?,
    phone = ?,
    updated_at = NOW()
WHERE id = ? AND status = 'active';

-- Get updated profile
SELECT 
    id,
    pco_number,
    name,
    email,
    phone,
    role,
    status,
    updated_at
FROM users 
WHERE id = ?;

-- Parameters:
-- ? = name
-- ? = email  
-- ? = phone
-- ? = user_id
-- ? = user_id (for select)

-- ============================================================================
-- 11. CLEANUP EXPIRED SESSIONS ENDPOINT
-- ============================================================================
-- Description: Clean up expired sessions (background job)
-- Method: Internal cleanup job
-- Required Data: None
-- Returns: Number of cleaned sessions

-- Cleanup Expired Sessions SQL
DELETE FROM user_sessions 
WHERE expires_at < NOW();

-- Cleanup Expired Reset Tokens SQL  
DELETE FROM password_reset_tokens 
WHERE expires_at < NOW();

-- ============================================================================
-- SAMPLE USAGE EXAMPLES
-- ============================================================================

/*
1. LOGIN EXAMPLE:
   Input: login_string="admin12345", password="admin123"
   Query: SELECT AuthenticateUser('admin12345', '$2b$10$8K1p...');
   Output: {"success": true, "user_id": 1, "name": "System Administrator", ...}

2. CREATE SESSION EXAMPLE:
   Input: session_id="sess_abc123", user_id=1, role_context="admin"
   Query: INSERT INTO user_sessions VALUES ('sess_abc123', 1, 'admin', '192.168.1.1', 'Mozilla/5.0...', NOW() + INTERVAL 24 HOUR);

3. VALIDATE SESSION EXAMPLE:
   Input: session_id="sess_abc123"  
   Query: SELECT s.user_id, u.name FROM user_sessions s JOIN users u ON s.user_id = u.id WHERE s.id = 'sess_abc123';
   Output: Returns user data if session valid, empty if invalid

4. FORGOT PASSWORD EXAMPLE:
   Input: pco_number="12345"
   Query: SELECT id FROM users WHERE pco_number = '12345';
   Then: INSERT INTO password_reset_tokens VALUES (1, 'reset_abc123', NOW() + INTERVAL 1 HOUR);
*/