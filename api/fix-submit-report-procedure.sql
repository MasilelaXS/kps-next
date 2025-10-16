-- Fix SubmitReport Stored Procedure
-- Issue: unique_active_assignment constraint prevents multiple inactive assignments per client
-- Solution: Delete old inactive assignments before creating new ones

USE kpspestcontrol_app;

DROP PROCEDURE IF EXISTS SubmitReport;

DELIMITER //

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
    
    -- FIX: Delete old inactive assignments for this client to avoid unique constraint violation
    DELETE FROM client_pco_assignments 
    WHERE client_id = v_client_id AND status = 'inactive';
    
    -- Auto-unassign PCO from client (set to inactive)
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

DELIMITER ;

SELECT 'SubmitReport procedure updated successfully' AS status;
