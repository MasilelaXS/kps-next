-- ============================================================================
-- CLIENT MANAGEMENT ENDPOINTS SQL STATEMENTS
-- KPS Pest Control Management System  
-- Created: October 7, 2025
-- ============================================================================

-- ============================================================================
-- 1. CLIENT LISTING ENDPOINTS
-- ============================================================================

-- 1.1 GET ALL CLIENTS (PAGINATED)
-- Description: Get paginated list of clients with filtering
-- Method: GET /api/admin/clients?page=1&pageSize=25&status=all&pco_id=all
-- Required Data: page, pageSize, status_filter, pco_filter
-- Returns: Paginated client list with PCO assignments

-- Get Clients Count SQL
SELECT COUNT(*) as total_count 
FROM clients 
WHERE 
    deleted_at IS NULL
    AND CASE WHEN ? != 'all' THEN status = ? ELSE 1=1 END
    AND CASE WHEN ? != 'all' THEN 
        EXISTS(SELECT 1 FROM client_pco_assignments 
               WHERE client_id = clients.id AND pco_id = ? AND status = 'active')
    ELSE 1=1 END;

-- Get Clients Paginated SQL
SELECT 
    c.id,
    c.company_name,
    c.address_line1,
    c.address_line2,
    c.city,
    c.state,
    c.postal_code,
    c.phone,
    c.email,
    c.status,
    c.created_at,
    -- PCO Assignment info
    pco.name as assigned_pco_name,
    pco.pco_number as assigned_pco_number,
    ca.assigned_at,
    -- Service statistics
    (SELECT COUNT(*) FROM reports 
     WHERE client_id = c.id) as total_reports,
    (SELECT MAX(service_date) FROM reports 
     WHERE client_id = c.id) as last_service_date,
    (SELECT COUNT(*) FROM reports 
     WHERE client_id = c.id AND status = 'pending') as pending_reports
FROM clients c
LEFT JOIN client_pco_assignments ca ON c.id = ca.client_id AND ca.status = 'active'
LEFT JOIN users pco ON ca.pco_id = pco.id
WHERE 
    c.deleted_at IS NULL
    AND CASE WHEN ? != 'all' THEN c.status = ? ELSE 1=1 END
    AND CASE WHEN ? != 'all' THEN ca.pco_id = ? ELSE 1=1 END
ORDER BY 
    CASE c.status
        WHEN 'active' THEN 1
        WHEN 'suspended' THEN 2
        WHEN 'inactive' THEN 3
    END,
    c.company_name
LIMIT ? OFFSET ?;

-- Parameters:
-- ? = status_filter, pco_filter (for count)
-- ? = status_filter, pco_filter (for main query)
-- ? = pageSize, offset

-- 1.2 SEARCH CLIENTS
-- Description: Search clients by company name, address, or contact info
-- Method: GET /api/admin/clients/search?q=searchterm
-- Required Data: search_term
-- Returns: Matching clients

-- Search Clients SQL
SELECT 
    c.id,
    c.company_name,
    c.address_line1,
    c.city,
    c.phone,
    c.status,
    pco.name as assigned_pco_name
FROM clients c
LEFT JOIN client_pco_assignments ca ON c.id = ca.client_id AND ca.status = 'active'
LEFT JOIN users pco ON ca.pco_id = pco.id
WHERE 
    c.deleted_at IS NULL
    AND (
        c.company_name LIKE CONCAT('%', ?, '%')
        OR c.address_line1 LIKE CONCAT('%', ?, '%')
        OR c.city LIKE CONCAT('%', ?, '%')
        OR c.phone LIKE CONCAT('%', ?, '%')
        OR c.email LIKE CONCAT('%', ?, '%')
    )
ORDER BY 
    CASE WHEN c.company_name LIKE CONCAT(?, '%') THEN 1 ELSE 2 END,
    c.company_name
LIMIT 25;

-- Parameters:
-- ? = search_term (repeated 6 times)

-- ============================================================================
-- 2. CLIENT CRUD OPERATIONS
-- ============================================================================

-- 2.1 GET CLIENT DETAILS
-- Description: Get detailed client information with full service history
-- Method: GET /api/admin/clients/{id}
-- Required Data: client_id
-- Returns: Complete client data with service history

-- Verify client exists
SELECT id FROM clients WHERE id = ? AND deleted_at IS NULL;

-- Get Client Details SQL
SELECT 
    c.id,
    c.company_name,
    c.address_line1,
    c.address_line2,
    c.city,
    c.state,
    c.postal_code,
    c.phone,
    c.email,
    c.status,
    c.created_at,
    c.updated_at
FROM clients c
WHERE c.id = ? AND c.deleted_at IS NULL;

-- Get Current PCO Assignment
SELECT 
    pco.id as pco_id,
    pco.name as pco_name,
    pco.pco_number,
    pco.phone as pco_phone,
    ca.assigned_at,
    assigned_by_user.name as assigned_by_name
FROM client_pco_assignments ca
JOIN users pco ON ca.pco_id = pco.id
JOIN users assigned_by_user ON ca.assigned_by = assigned_by_user.id
WHERE ca.client_id = ? AND ca.status = 'active';

-- Get Client Contact Persons
SELECT 
    id,
    name,
    role,
    phone,
    email,
    is_primary,
    created_at
FROM client_contacts 
WHERE client_id = ? AND deleted_at IS NULL
ORDER BY is_primary DESC, name;

-- Get Service Statistics
SELECT 
    (SELECT COUNT(*) FROM reports WHERE client_id = ?) as total_reports,
    (SELECT COUNT(*) FROM reports WHERE client_id = ? AND status = 'approved') as approved_reports,
    (SELECT COUNT(*) FROM reports WHERE client_id = ? AND status = 'pending') as pending_reports,
    (SELECT MAX(service_date) FROM reports WHERE client_id = ?) as last_service_date,
    (SELECT MIN(service_date) FROM reports WHERE client_id = ?) as first_service_date;

-- Parameters:
-- ? = client_id (for all queries)

-- 2.2 CREATE NEW CLIENT
-- Description: Create new client with primary contact
-- Method: POST /api/admin/clients
-- Required Data: client data, optional contact data
-- Returns: Created client ID

-- Check for duplicate company name in same city
SELECT id FROM clients 
WHERE company_name = ? AND city = ? AND deleted_at IS NULL;

-- Create Client SQL
INSERT INTO clients (
    company_name,
    address_line1,
    address_line2,
    city,
    state,
    postal_code,
    phone,
    email,
    status
) VALUES (
    ?, ?, ?, ?, ?, ?, ?, ?, 'active'
);

-- Get created client ID
SELECT LAST_INSERT_ID() as client_id;

-- Optional: Create Primary Contact Person
INSERT INTO client_contacts (
    client_id,
    name,
    role,
    phone,
    email,
    is_primary
) VALUES (
    ?, ?, ?, ?, ?, 1
);

-- Parameters:
-- ? = company_name, city (for duplicate check)
-- ? = company_name, address_line1, address_line2, city, state, postal_code, phone, email
-- ? = client_id, contact_name, role, contact_phone, contact_email (for contact)

-- 2.3 UPDATE CLIENT
-- Description: Update existing client information
-- Method: PUT /api/admin/clients/{id}
-- Required Data: client_id, updated client data
-- Returns: Success message

-- Verify client exists
SELECT id FROM clients WHERE id = ? AND deleted_at IS NULL;

-- Check for duplicate company name (excluding current client)
SELECT id FROM clients 
WHERE company_name = ? AND city = ? AND id != ? AND deleted_at IS NULL;

-- Update Client SQL
UPDATE clients 
SET 
    company_name = ?,
    address_line1 = ?,
    address_line2 = ?,
    city = ?,
    state = ?,
    postal_code = ?,
    phone = ?,
    email = ?,
    updated_at = NOW()
WHERE id = ? AND deleted_at IS NULL;

-- Parameters:
-- ? = client_id (for verification)
-- ? = company_name, city, client_id (for duplicate check)
-- ? = company_name, address_line1, address_line2, city, state, postal_code, phone, email, client_id

-- 2.4 CHANGE CLIENT STATUS
-- Description: Activate/suspend/deactivate client
-- Method: PUT /api/admin/clients/{id}/status
-- Required Data: client_id, new_status, reason (optional)
-- Returns: Success message

-- Verify client exists
SELECT id, status FROM clients WHERE id = ? AND deleted_at IS NULL;

-- Update Client Status SQL
UPDATE clients 
SET 
    status = ?,
    updated_at = NOW()
WHERE id = ? AND deleted_at IS NULL;

-- If suspending/deactivating, unassign PCO
UPDATE client_pco_assignments 
SET 
    status = 'inactive',
    unassigned_at = NOW()
WHERE client_id = ? AND status = 'active' AND ? IN ('suspended', 'inactive');

-- Create status change notification
INSERT INTO notifications (user_id, type, title, message)
SELECT 
    pco_id,
    'client_status_change',
    CONCAT('Client Status Changed: ', c.company_name),
    CONCAT('Client status changed to: ', ?)
FROM client_pco_assignments ca
JOIN clients c ON ca.client_id = c.id
WHERE ca.client_id = ? AND ca.status = 'active';

-- Parameters:
-- ? = client_id (for verification)
-- ? = new_status, client_id
-- ? = client_id, new_status (for unassignment check)
-- ? = new_status, client_id (for notification)

-- 2.5 DELETE CLIENT (SOFT DELETE)
-- Description: Soft delete client
-- Method: DELETE /api/admin/clients/{id}
-- Required Data: client_id
-- Returns: Success message

-- Verify client exists and not already deleted
SELECT id, status FROM clients WHERE id = ? AND deleted_at IS NULL;

-- Check if client has pending reports (prevent deletion)
SELECT COUNT(*) as pending_count
FROM reports 
WHERE client_id = ? AND status IN ('draft', 'pending');

-- Soft Delete Client SQL
UPDATE clients 
SET 
    status = 'inactive',
    deleted_at = NOW(),
    updated_at = NOW()
WHERE id = ? AND deleted_at IS NULL;

-- Unassign from PCO
UPDATE client_pco_assignments 
SET 
    status = 'inactive',
    unassigned_at = NOW()
WHERE client_id = ? AND status = 'active';

-- Soft delete client contacts
UPDATE client_contacts 
SET 
    deleted_at = NOW()
WHERE client_id = ? AND deleted_at IS NULL;

-- Parameters:
-- ? = client_id (for all operations)

-- ============================================================================
-- 3. CLIENT CONTACT MANAGEMENT
-- ============================================================================

-- 3.1 GET CLIENT CONTACTS
-- Description: Get all contact persons for a client
-- Method: GET /api/admin/clients/{id}/contacts
-- Required Data: client_id
-- Returns: List of contact persons

-- Get Client Contacts SQL
SELECT 
    id,
    name,
    role,
    phone,
    email,
    is_primary,
    created_at,
    updated_at
FROM client_contacts 
WHERE client_id = ? AND deleted_at IS NULL
ORDER BY is_primary DESC, name;

-- Parameters:
-- ? = client_id

-- 3.2 ADD CLIENT CONTACT
-- Description: Add new contact person to client
-- Method: POST /api/admin/clients/{id}/contacts
-- Required Data: client_id, contact data
-- Returns: Created contact ID

-- Verify client exists
SELECT id FROM clients WHERE id = ? AND deleted_at IS NULL;

-- If setting as primary, unset other primary contacts
UPDATE client_contacts 
SET is_primary = 0 
WHERE client_id = ? AND is_primary = 1 AND ? = 1;

-- Create Contact SQL
INSERT INTO client_contacts (
    client_id,
    name,
    role,
    phone,
    email,
    is_primary
) VALUES (
    ?, ?, ?, ?, ?, ?
);

-- Get created contact ID
SELECT LAST_INSERT_ID() as contact_id;

-- Parameters:
-- ? = client_id (for verification and operations)
-- ? = client_id, is_primary (for primary contact update)
-- ? = client_id, name, role, phone, email, is_primary

-- 3.3 UPDATE CLIENT CONTACT
-- Description: Update existing contact person
-- Method: PUT /api/admin/clients/{client_id}/contacts/{contact_id}
-- Required Data: client_id, contact_id, updated contact data
-- Returns: Success message

-- Verify contact exists for this client
SELECT id FROM client_contacts 
WHERE id = ? AND client_id = ? AND deleted_at IS NULL;

-- If setting as primary, unset other primary contacts
UPDATE client_contacts 
SET is_primary = 0 
WHERE client_id = ? AND is_primary = 1 AND id != ? AND ? = 1;

-- Update Contact SQL
UPDATE client_contacts 
SET 
    name = ?,
    role = ?,
    phone = ?,
    email = ?,
    is_primary = ?,
    updated_at = NOW()
WHERE id = ? AND client_id = ? AND deleted_at IS NULL;

-- Parameters:
-- ? = contact_id, client_id (for verification)
-- ? = client_id, contact_id, is_primary (for primary contact update)
-- ? = name, role, phone, email, is_primary, contact_id, client_id

-- 3.4 DELETE CLIENT CONTACT
-- Description: Delete client contact person
-- Method: DELETE /api/admin/clients/{client_id}/contacts/{contact_id}
-- Required Data: client_id, contact_id
-- Returns: Success message

-- Verify contact exists and not primary
SELECT id, is_primary FROM client_contacts 
WHERE id = ? AND client_id = ? AND deleted_at IS NULL;

-- Soft Delete Contact SQL (only if not primary)
UPDATE client_contacts 
SET 
    deleted_at = NOW()
WHERE id = ? AND client_id = ? AND is_primary = 0 AND deleted_at IS NULL;

-- Parameters:
-- ? = contact_id, client_id (for verification and deletion)

-- ============================================================================
-- 4. CLIENT ASSIGNMENT MANAGEMENT
-- ============================================================================

-- 4.1 GET CLIENT ASSIGNMENT HISTORY
-- Description: Get full assignment history for a client
-- Method: GET /api/admin/clients/{id}/assignments
-- Required Data: client_id
-- Returns: Assignment history with PCO details

-- Get Assignment History SQL
SELECT 
    pco.name as pco_name,
    pco.pco_number,
    ca.assigned_at,
    ca.unassigned_at,
    ca.status,
    assigned_by_user.name as assigned_by_name,
    unassigned_by_user.name as unassigned_by_name,
    (SELECT COUNT(*) FROM reports 
     WHERE client_id = ca.client_id AND pco_id = ca.pco_id) as reports_count
FROM client_pco_assignments ca
JOIN users pco ON ca.pco_id = pco.id
JOIN users assigned_by_user ON ca.assigned_by = assigned_by_user.id
LEFT JOIN users unassigned_by_user ON ca.unassigned_by = unassigned_by_user.id
WHERE ca.client_id = ?
ORDER BY ca.assigned_at DESC;

-- Parameters:
-- ? = client_id

-- 4.2 ASSIGN PCO TO CLIENT
-- Description: Assign a PCO to handle client services
-- Method: POST /api/admin/clients/{id}/assign
-- Required Data: client_id, pco_id, assigned_by
-- Returns: Success message

-- Verify client exists and is active
SELECT id, status FROM clients 
WHERE id = ? AND status IN ('active') AND deleted_at IS NULL;

-- Verify PCO exists and is active
SELECT id, name FROM users 
WHERE id = ? AND role IN ('pco', 'both') AND status = 'active' AND deleted_at IS NULL;

-- Check if client already has active assignment
SELECT id FROM client_pco_assignments 
WHERE client_id = ? AND status = 'active';

-- Unassign existing PCO if any
UPDATE client_pco_assignments 
SET 
    status = 'inactive',
    unassigned_at = NOW(),
    unassigned_by = ?
WHERE client_id = ? AND status = 'active';

-- Create New Assignment SQL
INSERT INTO client_pco_assignments (
    client_id,
    pco_id,
    assigned_by,
    assigned_at,
    status
) VALUES (
    ?, ?, ?, NOW(), 'active'
);

-- Create notification for PCO
INSERT INTO notifications (user_id, type, title, message)
SELECT 
    ?,
    'assignment_new',
    CONCAT('New Client Assignment: ', c.company_name),
    CONCAT('You have been assigned to handle services for: ', c.company_name, ', ', c.address_line1, ', ', c.city)
FROM clients c
WHERE c.id = ?;

-- Parameters:
-- ? = client_id (for verification and operations)
-- ? = pco_id (for verification and operations)
-- ? = assigned_by, client_id (for unassignment)
-- ? = client_id, pco_id, assigned_by
-- ? = pco_id, client_id (for notification)

-- 4.3 UNASSIGN PCO FROM CLIENT
-- Description: Remove PCO assignment from client
-- Method: DELETE /api/admin/clients/{id}/assign
-- Required Data: client_id, unassigned_by
-- Returns: Success message

-- Verify client has active assignment
SELECT ca.id, pco.name as pco_name
FROM client_pco_assignments ca
JOIN users pco ON ca.pco_id = pco.id
WHERE ca.client_id = ? AND ca.status = 'active';

-- Unassign PCO SQL
UPDATE client_pco_assignments 
SET 
    status = 'inactive',
    unassigned_at = NOW(),
    unassigned_by = ?
WHERE client_id = ? AND status = 'active';

-- Create notification for PCO
INSERT INTO notifications (user_id, type, title, message)
SELECT 
    ca.pco_id,
    'assignment_removed',
    CONCAT('Client Assignment Removed: ', c.company_name),
    CONCAT('Your assignment to ', c.company_name, ' has been removed.')
FROM client_pco_assignments ca
JOIN clients c ON ca.client_id = c.id
WHERE ca.client_id = ? AND ca.status = 'inactive' AND ca.unassigned_at > DATE_SUB(NOW(), INTERVAL 1 MINUTE);

-- Parameters:
-- ? = client_id (for verification and operations)
-- ? = unassigned_by, client_id
-- ? = client_id (for notification)

-- ============================================================================
-- 5. CLIENT FILTERING AND REPORTING
-- ============================================================================

-- 5.1 GET UNASSIGNED CLIENTS
-- Description: Get clients without active PCO assignments
-- Method: GET /api/admin/clients/unassigned
-- Returns: Clients needing PCO assignment

-- Unassigned Clients SQL
SELECT 
    c.id,
    c.company_name,
    c.address_line1,
    c.city,
    c.phone,
    c.created_at,
    (SELECT MAX(unassigned_at) FROM client_pco_assignments 
     WHERE client_id = c.id) as last_unassigned_at
FROM clients c
WHERE 
    c.deleted_at IS NULL 
    AND c.status = 'active'
    AND NOT EXISTS (
        SELECT 1 FROM client_pco_assignments 
        WHERE client_id = c.id AND status = 'active'
    )
ORDER BY c.created_at DESC;

-- 5.2 GET CLIENTS BY PCO
-- Description: Get all clients assigned to a specific PCO
-- Method: GET /api/admin/clients/by-pco/{pco_id}
-- Required Data: pco_id
-- Returns: Clients assigned to the PCO

-- Clients by PCO SQL
SELECT 
    c.id,
    c.company_name,
    c.address_line1,
    c.city,
    c.phone,
    c.status,
    ca.assigned_at,
    (SELECT COUNT(*) FROM reports 
     WHERE client_id = c.id AND pco_id = ?) as total_reports,
    (SELECT MAX(service_date) FROM reports 
     WHERE client_id = c.id AND pco_id = ?) as last_service_date
FROM clients c
JOIN client_pco_assignments ca ON c.id = ca.client_id
WHERE 
    ca.pco_id = ? 
    AND ca.status = 'active' 
    AND c.deleted_at IS NULL
ORDER BY ca.assigned_at DESC;

-- Parameters:
-- ? = pco_id (repeated 3 times)

-- ============================================================================
-- SAMPLE USAGE EXAMPLES
-- ============================================================================

/*
1. GET ALL CLIENTS:
   Input: page=1, pageSize=25, status="active", pco_id="all"
   Query: SELECT clients with PCO assignments and service statistics
   Output: Paginated list of active clients with assigned PCOs

2. CREATE NEW CLIENT:
   Input: {
     "company_name": "ABC Restaurant",
     "address_line1": "123 Main St",
     "city": "Toronto",
     "phone": "416-555-1234",
     "contact_name": "John Doe",
     "contact_position": "Manager"
   }
   Query: INSERT client and primary contact
   Output: {"client_id": 15}

3. ASSIGN PCO TO CLIENT:
   Input: client_id=10, pco_id=5, assigned_by=1
   Query: Create assignment and notify PCO
   Result: PCO assigned, notification sent

4. SEARCH CLIENTS:
   Input: search_term="restaurant"
   Query: SELECT * FROM clients WHERE company_name LIKE '%restaurant%'
   Output: Matching clients with assignment info

5. GET CLIENT DETAILS:
   Input: client_id=10
   Query: SELECT client, contacts, assignments, service statistics
   Output: Complete client profile with service history
*/