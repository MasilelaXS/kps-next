-- KPS Pest Control Management System - Database Schema and Default Data
-- Created: October 7, 2025

-- ============================================================================
-- DATABASE SCHEMA
-- ============================================================================

-- Users Table
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    pco_number VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(20),
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin', 'pco', 'both') NOT NULL DEFAULT 'pco',
    status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL DEFAULT NULL
);

-- Clients Table
CREATE TABLE clients (
    id INT PRIMARY KEY AUTO_INCREMENT,
    company_name VARCHAR(200) NOT NULL,
    address_line1 VARCHAR(200) NOT NULL,
    address_line2 VARCHAR(200),
    city VARCHAR(100) NOT NULL,
    state VARCHAR(50) NOT NULL,
    postal_code VARCHAR(20) NOT NULL,
    country VARCHAR(50) NOT NULL DEFAULT 'South Africa',
    status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
    service_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL DEFAULT NULL
);

-- Client Contacts Table
CREATE TABLE client_contacts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    client_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    role VARCHAR(50) DEFAULT 'Primary Contact',
    is_primary TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    UNIQUE KEY unique_client_email (client_id, email)
);

-- Client PCO Assignments Table
CREATE TABLE client_pco_assignments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    client_id INT NOT NULL,
    pco_id INT NOT NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_by INT NOT NULL,
    unassigned_at TIMESTAMP NULL DEFAULT NULL,
    unassigned_by INT NULL DEFAULT NULL,
    status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    FOREIGN KEY (pco_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (unassigned_by) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_active_assignment (client_id, status)
);

-- Chemicals Table
CREATE TABLE chemicals (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(200) NOT NULL,
    active_ingredients TEXT,
    usage_type ENUM('bait_inspection', 'fumigation', 'multi_purpose') NOT NULL,
    quantity_unit VARCHAR(20) NOT NULL,
    safety_information TEXT,
    status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL DEFAULT NULL
);

-- Reports Table
CREATE TABLE reports (
    id INT PRIMARY KEY AUTO_INCREMENT,
    client_id INT NOT NULL,
    pco_id INT NOT NULL,
    report_type ENUM('bait_inspection', 'fumigation', 'both') NOT NULL,
    service_date DATE NOT NULL,
    next_service_date DATE,
    status ENUM('draft', 'pending', 'approved', 'declined', 'archived') NOT NULL DEFAULT 'draft',
    pco_signature_data TEXT,
    client_signature_data TEXT,
    client_signature_name VARCHAR(100),
    general_remarks TEXT,
    admin_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    submitted_at TIMESTAMP NULL DEFAULT NULL,
    reviewed_at TIMESTAMP NULL DEFAULT NULL,
    reviewed_by INT NULL DEFAULT NULL,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    FOREIGN KEY (pco_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Bait Stations Table
CREATE TABLE bait_stations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    report_id INT NOT NULL,
    station_number VARCHAR(20) NOT NULL,
    location ENUM('inside', 'outside') NOT NULL,
    is_accessible TINYINT(1) NOT NULL DEFAULT 1,
    inaccessible_reason VARCHAR(255),
    activity_detected TINYINT(1) NOT NULL DEFAULT 0,
    activity_droppings TINYINT(1) DEFAULT 0,
    activity_gnawing TINYINT(1) DEFAULT 0,
    activity_tracks TINYINT(1) DEFAULT 0,
    activity_other TINYINT(1) DEFAULT 0,
    activity_other_description VARCHAR(255),
    bait_status ENUM('clean', 'eaten', 'wet') NOT NULL DEFAULT 'clean',
    station_condition ENUM('good', 'needs_repair', 'damaged', 'missing') NOT NULL DEFAULT 'good',
    rodent_box_replaced TINYINT(1) NOT NULL DEFAULT 0,
    station_remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
    UNIQUE KEY unique_station_per_report (report_id, location, station_number)
);

-- Station Chemicals Table
CREATE TABLE station_chemicals (
    id INT PRIMARY KEY AUTO_INCREMENT,
    station_id INT NOT NULL,
    chemical_id INT NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    batch_number VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (station_id) REFERENCES bait_stations(id) ON DELETE CASCADE,
    FOREIGN KEY (chemical_id) REFERENCES chemicals(id) ON DELETE CASCADE
);

-- Fumigation Areas Table
CREATE TABLE fumigation_areas (
    id INT PRIMARY KEY AUTO_INCREMENT,
    report_id INT NOT NULL,
    area_name VARCHAR(100) NOT NULL,
    is_other TINYINT(1) DEFAULT 0,
    other_description VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE
);

-- Fumigation Target Pests Table
CREATE TABLE fumigation_target_pests (
    id INT PRIMARY KEY AUTO_INCREMENT,
    report_id INT NOT NULL,
    pest_name VARCHAR(100) NOT NULL,
    is_other TINYINT(1) DEFAULT 0,
    other_description VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE
);

-- Fumigation Chemicals Table
CREATE TABLE fumigation_chemicals (
    id INT PRIMARY KEY AUTO_INCREMENT,
    report_id INT NOT NULL,
    chemical_id INT NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    batch_number VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
    FOREIGN KEY (chemical_id) REFERENCES chemicals(id) ON DELETE CASCADE
);

-- Insect Monitors Table
CREATE TABLE insect_monitors (
    id INT PRIMARY KEY AUTO_INCREMENT,
    report_id INT NOT NULL,
    monitor_type ENUM('box', 'fly_trap') NOT NULL,
    glue_board_replaced TINYINT(1) NOT NULL DEFAULT 0,
    tubes_replaced TINYINT(1) DEFAULT NULL,
    monitor_serviced TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE
);

-- Notifications Table
CREATE TABLE notifications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    type ENUM('assignment', 'report_declined', 'report_submitted', 'system_update') NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    read_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Audit Log Table
CREATE TABLE audit_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INT,
    old_values JSON,
    new_values JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================================
-- PERFORMANCE OPTIMIZED INDEXES
-- ============================================================================

-- Users indexes (optimized for authentication)
CREATE INDEX idx_users_pco_number ON users(pco_number);
CREATE INDEX idx_users_role_status ON users(role, status);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status_created ON users(status, created_at DESC);

-- Clients indexes (optimized for search and assignment)
CREATE INDEX idx_clients_status ON clients(status);
CREATE INDEX idx_clients_company_name ON clients(company_name);
CREATE INDEX idx_clients_city_state ON clients(city, state);
CREATE INDEX idx_clients_search_text ON clients(company_name, city, state);

-- Client contacts indexes (optimized for search)
CREATE INDEX idx_contacts_client_primary ON client_contacts(client_id, is_primary);
CREATE INDEX idx_contacts_email ON client_contacts(email);
CREATE INDEX idx_contacts_name ON client_contacts(name);

-- Reports indexes (heavily optimized for queries)
CREATE INDEX idx_reports_client_pco ON reports(client_id, pco_id);
CREATE INDEX idx_reports_status_date ON reports(status, service_date DESC);
CREATE INDEX idx_reports_pco_status ON reports(pco_id, status);
CREATE INDEX idx_reports_client_status ON reports(client_id, status);
CREATE INDEX idx_reports_type_date ON reports(report_type, service_date DESC);
CREATE INDEX idx_reports_created_status ON reports(created_at DESC, status);
CREATE INDEX idx_reports_next_service ON reports(next_service_date, status);
CREATE INDEX idx_reports_submitted_date ON reports(submitted_at DESC);

-- Assignments indexes (optimized for active lookups)
CREATE INDEX idx_assignments_pco_active ON client_pco_assignments(pco_id, status);
CREATE INDEX idx_assignments_client_active ON client_pco_assignments(client_id, status);
CREATE INDEX idx_assignments_status_assigned ON client_pco_assignments(status, assigned_at DESC);

-- Chemicals indexes (optimized for mobile sync)
CREATE INDEX idx_chemicals_usage_status ON chemicals(usage_type, status);
CREATE INDEX idx_chemicals_name_status ON chemicals(name, status);
CREATE INDEX idx_chemicals_status_created ON chemicals(status, created_at DESC);

-- Bait stations indexes (optimized for report queries)
CREATE INDEX idx_stations_report ON bait_stations(report_id);
CREATE INDEX idx_stations_location ON bait_stations(report_id, location);
CREATE INDEX idx_stations_number_location ON bait_stations(station_number, location);

-- Station chemicals indexes
CREATE INDEX idx_station_chemicals_station ON station_chemicals(station_id);
CREATE INDEX idx_station_chemicals_chemical ON station_chemicals(chemical_id);

-- Fumigation indexes (optimized for report building)
CREATE INDEX idx_fumigation_areas_report ON fumigation_areas(report_id);
CREATE INDEX idx_fumigation_pests_report ON fumigation_target_pests(report_id);
CREATE INDEX idx_fumigation_chemicals_report ON fumigation_chemicals(report_id);
CREATE INDEX idx_fumigation_chemicals_chemical ON fumigation_chemicals(chemical_id);

-- Insect monitors indexes
CREATE INDEX idx_monitors_report ON insect_monitors(report_id);
CREATE INDEX idx_monitors_type ON insect_monitors(report_id, monitor_type);

-- Notifications indexes (optimized for real-time queries)
CREATE INDEX idx_notifications_user_read ON notifications(user_id, read_at);
CREATE INDEX idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_type_created ON notifications(type, created_at DESC);

-- Audit logs indexes (optimized for tracking)
CREATE INDEX idx_audit_user_created ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_action_created ON audit_logs(action, created_at DESC);

-- ============================================================================
-- DEFAULT DATA
-- ============================================================================

-- Password Reset Tokens Table (for forgot password functionality)
CREATE TABLE password_reset_tokens (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    token VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_token (token),
    INDEX idx_expires (expires_at)
);

-- User Sessions Table (for better authentication management)
CREATE TABLE user_sessions (
    id VARCHAR(128) PRIMARY KEY,
    user_id INT NOT NULL,
    role_context ENUM('admin', 'pco') NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_role (user_id, role_context),
    INDEX idx_expires (expires_at)
);

-- File Uploads Table (for JSON import/export tracking)
CREATE TABLE file_uploads (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_type ENUM('report_export', 'report_import') NOT NULL,
    file_size INT NOT NULL,
    status ENUM('uploaded', 'processing', 'completed', 'failed') NOT NULL DEFAULT 'uploaded',
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP NULL DEFAULT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_status (user_id, status),
    INDEX idx_created_at (created_at)
);

-- Report Versions Table (for admin edits tracking)
CREATE TABLE report_versions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    report_id INT NOT NULL,
    version_number INT NOT NULL DEFAULT 1,
    changed_by INT NOT NULL,
    changes_summary TEXT,
    version_data JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
    FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_report_version (report_id, version_number),
    INDEX idx_report_version (report_id, version_number DESC)
);

-- ============================================================================
-- PERFORMANCE OPTIMIZATION TABLES
-- ============================================================================

-- Cache table for dashboard metrics (prevents expensive real-time calculations)
CREATE TABLE dashboard_cache (
    id INT PRIMARY KEY AUTO_INCREMENT,
    cache_key VARCHAR(100) NOT NULL,
    cache_value JSON NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_cache_key (cache_key),
    INDEX idx_expires (expires_at)
);

-- Pre-fill data cache (for mobile app performance)
CREATE TABLE client_last_report_cache (
    client_id INT PRIMARY KEY,
    last_report_id INT NOT NULL,
    last_service_date DATE NOT NULL,
    cache_data JSON NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    FOREIGN KEY (last_report_id) REFERENCES reports(id) ON DELETE CASCADE,
    INDEX idx_last_service_date (last_service_date DESC)
);

-- ============================================================================
-- DEFAULT DATA
-- ============================================================================

-- Default Admin User
INSERT INTO users (pco_number, name, email, phone, password_hash, role, status) VALUES
('12345', 'System Administrator', 'admin@kps.com', '+60123456789', '$2b$10$8K1p/a9Y8mz7NtX1Z4Wz0.rX9Vz0Y8mK1p/a9Y8mz7NtX1Z4Wz0rX9', 'admin', 'active');

-- Default PCO User  
INSERT INTO users (pco_number, name, email, phone, password_hash, role, status) VALUES
('67890', 'John Technician', 'pco@kps.com', '+60123456790', '$2b$10$7J0o/b8X7ly6MsW0Y3Vy0.qW8Uy0X7lJ0o/b8X7ly6MsW0Y3Vy0qW8', 'pco', 'active');

-- Sample Clients
INSERT INTO clients (company_name, address_line1, city, state, postal_code, status) VALUES
('ABC Restaurant Sdn Bhd', '123 Jalan Maju', 'Kuala Lumpur', 'Selangor', '50000', 'active'),
('XYZ Food Court', '456 Lorong Makanan', 'Petaling Jaya', 'Selangor', '47000', 'active'),
('Metro Supermarket', '789 Jalan Besar', 'Shah Alam', 'Selangor', '40000', 'active');

-- Sample Client Contacts
INSERT INTO client_contacts (client_id, name, email, phone, role, is_primary) VALUES
(1, 'Ahmad Rahman', 'ahmad@abcrestaurant.com', '+60123456791', 'Manager', 1),
(1, 'Siti Nurhaliza', 'siti@abcrestaurant.com', '+60123456792', 'Assistant Manager', 0),
(2, 'Lim Wei Ming', 'wm.lim@xyzfoodcourt.com', '+60123456793', 'Owner', 1),
(3, 'Rajesh Kumar', 'rajesh@metrosuper.com', '+60123456794', 'Facility Manager', 1),
(3, 'Mary Tan', 'mary@metrosuper.com', '+60123456795', 'Operations Manager', 0);

-- Sample Chemicals
INSERT INTO chemicals (name, active_ingredients, usage_type, quantity_unit, safety_information, status) VALUES
('Baygon Cockroach Bait', 'Fipronil 0.05%', 'bait_inspection', 'grams', 'Keep away from children. Wash hands after use.', 'active'),
('Rentokil Rat Bait', 'Brodifacoum 0.005%', 'bait_inspection', 'grams', 'Highly toxic. Use protective gloves.', 'active'),
('Pyrethrin Spray', 'Pyrethrin 0.2%', 'fumigation', 'ml', 'Use in well-ventilated areas only.', 'active'),
('Multi-Purpose Gel', 'Imidacloprid 2.15%', 'multi_purpose', 'ml', 'Avoid contact with skin and eyes.', 'active'),
('Ant Control Powder', 'Boric Acid 99%', 'bait_inspection', 'grams', 'Do not inhale powder.', 'active');

-- Sample Assignment (PCO assigned to first client)
INSERT INTO client_pco_assignments (client_id, pco_id, assigned_by, status) VALUES
(1, 2, 1, 'active');

-- ============================================================================
-- SAMPLE REPORT DATA
-- ============================================================================

-- Sample Report
INSERT INTO reports (client_id, pco_id, report_type, service_date, next_service_date, status, client_signature_name, general_remarks, submitted_at) VALUES
(1, 2, 'both', '2025-10-01', '2025-11-01', 'approved', 'Ahmad Rahman', 'Regular maintenance completed. No major issues found.', '2025-10-01 16:30:00');

-- Sample Bait Stations for the report
INSERT INTO bait_stations (report_id, station_number, location, is_accessible, activity_detected, bait_status, station_condition, rodent_box_replaced, station_remarks) VALUES
(1, '1', 'outside', 1, 0, 'clean', 'good', 0, 'Station in good condition'),
(1, '2', 'outside', 1, 1, 'eaten', 'good', 1, 'Evidence of rodent activity'),
(1, '1', 'inside', 1, 0, 'clean', 'good', 0, 'Kitchen area - clean'),
(1, '2', 'inside', 1, 0, 'clean', 'needs_repair', 0, 'Station cover loose');

-- Sample Station Chemicals
INSERT INTO station_chemicals (station_id, chemical_id, quantity, batch_number) VALUES
(2, 2, 25.5, 'RK2025001'),
(4, 1, 15.0, 'BC2025002');

-- Sample Fumigation Areas
INSERT INTO fumigation_areas (report_id, area_name, is_other) VALUES
(1, 'Kitchen', FALSE),
(1, 'Storage Room', FALSE),
(1, 'Dining Area', FALSE);

-- Sample Target Pests
INSERT INTO fumigation_target_pests (report_id, pest_name, is_other) VALUES
(1, 'Cockroaches', FALSE),
(1, 'Ants', FALSE),
(1, 'Flies', FALSE);

-- Sample Fumigation Chemicals
INSERT INTO fumigation_chemicals (report_id, chemical_id, quantity, batch_number) VALUES
(1, 3, 150.0, 'PYR2025001'),
(1, 4, 75.5, 'MPG2025001');

-- Sample Insect Monitors
INSERT INTO insect_monitors (report_id, monitor_type, glue_board_replaced, tubes_replaced, monitor_serviced) VALUES
(1, 'fly_trap', 1, 1, 1),
(1, 'box', 1, NULL, 1);

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- Active Client Assignments View
CREATE VIEW active_client_assignments AS
SELECT 
    c.id as client_id,
    c.company_name,
    c.address_line1,
    c.city,
    u.id as pco_id,
    u.name as pco_name,
    u.pco_number,
    ca.assigned_at
FROM clients c
JOIN client_pco_assignments ca ON c.id = ca.client_id
JOIN users u ON ca.pco_id = u.id
WHERE ca.status = 'active' AND c.status = 'active' AND u.status = 'active';

-- Report Summary View
CREATE VIEW report_summary AS
SELECT 
    r.id,
    r.service_date,
    r.status,
    r.report_type,
    c.company_name as client_name,
    u.name as pco_name,
    u.pco_number,
    r.created_at,
    r.submitted_at
FROM reports r
JOIN clients c ON r.client_id = c.id
JOIN users u ON r.pco_id = u.id
ORDER BY r.created_at DESC;

-- ============================================================================
-- STORED PROCEDURES
-- ============================================================================

DELIMITER //

-- Authentication function for login validation
CREATE FUNCTION AuthenticateUser(
    p_login_string VARCHAR(50),
    p_password_hash VARCHAR(255)
) RETURNS JSON
READS SQL DATA
DETERMINISTIC
BEGIN
    DECLARE v_pco_number VARCHAR(20);
    DECLARE v_role_context VARCHAR(10);
    DECLARE v_user_data JSON;
    
    -- Parse login string (admin12345 or pco12345)
    IF LEFT(p_login_string, 5) = 'admin' THEN
        SET v_pco_number = SUBSTRING(p_login_string, 6);
        SET v_role_context = 'admin';
    ELSEIF LEFT(p_login_string, 3) = 'pco' THEN
        SET v_pco_number = SUBSTRING(p_login_string, 4);
        SET v_role_context = 'pco';
    ELSE
        RETURN JSON_OBJECT('success', false, 'error', 'Invalid login format');
    END IF;
    
    -- Validate user credentials and role
    SELECT JSON_OBJECT(
        'success', true,
        'user_id', id,
        'pco_number', pco_number,
        'name', name,
        'email', email,
        'role', role,
        'role_context', v_role_context,
        'status', status
    ) INTO v_user_data
    FROM users 
    WHERE pco_number = v_pco_number 
    AND password_hash = p_password_hash
    AND status = 'active'
    AND (
        (v_role_context = 'admin' AND role IN ('admin', 'both'))
        OR 
        (v_role_context = 'pco' AND role IN ('pco', 'both'))
    );
    
    RETURN COALESCE(v_user_data, JSON_OBJECT('success', false, 'error', 'Invalid credentials'));
END//

-- Assign PCO to Client with notifications
CREATE PROCEDURE AssignPCOToClient(
    IN p_client_id INT,
    IN p_pco_id INT,
    IN p_assigned_by INT
)
BEGIN
    DECLARE v_client_name VARCHAR(200);
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    
    START TRANSACTION;
    
    -- Get client name for notification
    SELECT company_name INTO v_client_name FROM clients WHERE id = p_client_id;
    
    -- Unassign any existing PCO for this client
    UPDATE client_pco_assignments 
    SET status = 'inactive', 
        unassigned_at = NOW(),
        unassigned_by = p_assigned_by
    WHERE client_id = p_client_id AND status = 'active';
    
    -- Assign new PCO
    INSERT INTO client_pco_assignments (client_id, pco_id, assigned_by, status)
    VALUES (p_client_id, p_pco_id, p_assigned_by, 'active');
    
    -- Send notification to PCO
    INSERT INTO notifications (user_id, type, title, message)
    VALUES (p_pco_id, 'assignment', 'New Client Assignment', 
            CONCAT('You have been assigned to client: ', v_client_name));
    
    COMMIT;
END//

-- Submit Report with cache update
CREATE PROCEDURE SubmitReport(
    IN p_report_id INT
)
BEGIN
    DECLARE v_client_id INT;
    DECLARE v_pco_id INT;
    DECLARE v_service_date DATE;
    DECLARE v_admin_id INT;
    DECLARE v_pco_name VARCHAR(100);
    DECLARE v_client_name VARCHAR(200);
    
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    
    START TRANSACTION;
    
    -- Get report info
    SELECT r.client_id, r.pco_id, r.service_date, c.company_name, u.name
    INTO v_client_id, v_pco_id, v_service_date, v_client_name, v_pco_name
    FROM reports r
    JOIN clients c ON r.client_id = c.id  
    JOIN users u ON r.pco_id = u.id
    WHERE r.id = p_report_id AND r.status = 'draft';
    
    -- Update report status
    UPDATE reports 
    SET status = 'pending', submitted_at = NOW()
    WHERE id = p_report_id;
    
    -- Auto-unassign PCO from client
    UPDATE client_pco_assignments 
    SET status = 'inactive', unassigned_at = NOW()
    WHERE client_id = v_client_id AND pco_id = v_pco_id AND status = 'active';
    
    -- Update pre-fill cache
    INSERT INTO client_last_report_cache (client_id, last_report_id, last_service_date, cache_data)
    VALUES (v_client_id, p_report_id, v_service_date, '{}')
    ON DUPLICATE KEY UPDATE 
        last_report_id = p_report_id, 
        last_service_date = v_service_date,
        updated_at = NOW();
    
    -- Notify admin users about new report
    SELECT id INTO v_admin_id FROM users WHERE role IN ('admin', 'both') AND status = 'active' LIMIT 1;
    
    IF v_admin_id IS NOT NULL THEN
        INSERT INTO notifications (user_id, type, title, message)
        VALUES (v_admin_id, 'report_submitted', 'New Report Submitted', 
                CONCAT(v_pco_name, ' submitted a report for ', v_client_name));
    END IF;
    
    COMMIT;
END//

-- Update dashboard cache
CREATE PROCEDURE UpdateDashboardCache()
BEGIN
    -- Cache dashboard metrics
    INSERT INTO dashboard_cache (cache_key, cache_value, expires_at)
    VALUES 
    ('active_clients_count', 
     JSON_OBJECT('count', (SELECT COUNT(*) FROM clients WHERE status = 'active')),
     DATE_ADD(NOW(), INTERVAL 1 HOUR))
    ON DUPLICATE KEY UPDATE 
        cache_value = VALUES(cache_value),
        expires_at = VALUES(expires_at);
        
    INSERT INTO dashboard_cache (cache_key, cache_value, expires_at)
    VALUES 
    ('pending_reports_count',
     JSON_OBJECT('count', (SELECT COUNT(*) FROM reports WHERE status = 'pending')),
     DATE_ADD(NOW(), INTERVAL 15 MINUTE))
    ON DUPLICATE KEY UPDATE 
        cache_value = VALUES(cache_value),
        expires_at = VALUES(expires_at);
        
    INSERT INTO dashboard_cache (cache_key, cache_value, expires_at)
    VALUES 
    ('reports_today_count',
     JSON_OBJECT('count', (SELECT COUNT(*) FROM reports WHERE DATE(created_at) = CURDATE())),
     DATE_ADD(NOW(), INTERVAL 30 MINUTE))
    ON DUPLICATE KEY UPDATE 
        cache_value = VALUES(cache_value),
        expires_at = VALUES(expires_at);
END//

-- Get PCO sync data (optimized for mobile app)
CREATE PROCEDURE GetPCOSyncData(
    IN p_pco_id INT
)
BEGIN
    -- Get assigned clients
    SELECT 
        c.id, c.company_name, c.address_line1, c.city, c.status,
        GROUP_CONCAT(CONCAT(cc.name, ':', cc.phone) SEPARATOR '|') as contacts
    FROM clients c
    JOIN client_pco_assignments ca ON c.id = ca.client_id
    LEFT JOIN client_contacts cc ON c.id = cc.client_id
    WHERE ca.pco_id = p_pco_id AND ca.status = 'active' AND c.status = 'active'
    GROUP BY c.id;
    
    -- Get active chemicals
    SELECT id, name, usage_type, quantity_unit, active_ingredients
    FROM chemicals 
    WHERE status = 'active'
    ORDER BY usage_type, name;
    
    -- Get last reports for pre-fill (MariaDB compatible version)
    SELECT r.*, c.company_name as client_name,
           ROW_NUMBER() OVER (PARTITION BY r.client_id ORDER BY r.service_date DESC) as rn
    FROM reports r
    JOIN clients c ON r.client_id = c.id
    JOIN (
        SELECT DISTINCT client_id 
        FROM client_pco_assignments 
        WHERE pco_id = p_pco_id AND status = 'active'
    ) ca ON c.id = ca.client_id
    WHERE c.status = 'active'
    HAVING rn <= 3
    ORDER BY r.client_id, r.service_date DESC;
END//

DELIMITER ;

-- ============================================================================
-- PASSWORD HASH EXPLANATION
-- ============================================================================

/*
AUTHENTICATION SYSTEM EXPLANATION:
================================
Login Format:
- Admin: admin12345 (password: admin123)
- PCO: pco67890 (password: tech123)

The AuthenticateUser() function handles login parsing:
1. Extracts prefix (admin/pco) to determine role context
2. Extracts PCO number (12345 for admin, 67890 for PCO)  
3. Validates against user table with proper role permissions
4. Returns JSON with user data and role context for session

Password Hashes (bcrypt format):
- Admin (12345): $2b$10$8K1p/a9Y8mz7NtX1Z4Wz0.rX9Vz0Y8mK1p/a9Y8mz7NtX1Z4Wz0rX9
- PCO (67890): $2b$10$7J0o/b8X7ly6MsW0Y3Vy0.qW8Uy0X7lJ0o/b8X7ly6MsW0Y3Vy0qW8

PERFORMANCE OPTIMIZATIONS:
==========================
1. Composite indexes for fast multi-column queries
2. Cached dashboard metrics (updated every 15-60 minutes)
3. Pre-fill cache for mobile app (updated on report submission)
4. Optimized stored procedures for complex operations
5. Session management for better authentication control

MOBILE APP SYNC STRATEGY:
========================
- GetPCOSyncData() procedure provides all data needed offline
- client_last_report_cache table enables instant pre-filling
- Minimized data transfer with targeted queries
- Background cache updates prevent real-time calculation delays
*/

-- ============================================================================
-- INITIAL DATA VERIFICATION
-- ============================================================================

-- Verify default users
SELECT 
    pco_number,
    name,
    email,
    role,
    status,
    created_at
FROM users;

-- Verify sample clients
SELECT 
    company_name,
    city,
    status,
    (SELECT COUNT(*) FROM client_contacts WHERE client_id = clients.id) as contact_count
FROM clients;

-- Verify active assignments
SELECT * FROM active_client_assignments;

-- Verify chemicals
SELECT name, usage_type, quantity_unit, status FROM chemicals;