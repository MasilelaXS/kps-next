-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Oct 16, 2025 at 12:50 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `kpspestcontrol_app`
--

DELIMITER $$
--
-- Procedures
--
CREATE DEFINER=`root`@`localhost` PROCEDURE `AssignPCOToClient` (IN `p_client_id` INT, IN `p_pco_id` INT, IN `p_assigned_by` INT)   BEGIN
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
END$$

CREATE DEFINER=`root`@`localhost` PROCEDURE `GetPCOSyncData` (IN `p_pco_id` INT)   BEGIN
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
END$$

CREATE DEFINER=`root`@`localhost` PROCEDURE `SubmitReport` (IN `p_report_id` INT)   BEGIN
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
    -- The unique_active_assignment constraint only allows one inactive record per client
    DELETE FROM client_pco_assignments 
    WHERE client_id = v_client_id AND status = 'inactive';
    
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
END$$

CREATE DEFINER=`root`@`localhost` PROCEDURE `UpdateDashboardCache` ()   BEGIN
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
END$$

--
-- Functions
--
CREATE DEFINER=`root`@`localhost` FUNCTION `AuthenticateUser` (`p_login_string` VARCHAR(50), `p_password_hash` VARCHAR(255)) RETURNS LONGTEXT CHARSET utf8mb4 COLLATE utf8mb4_bin DETERMINISTIC READS SQL DATA BEGIN
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
END$$

DELIMITER ;

-- --------------------------------------------------------

--
-- Stand-in structure for view `active_client_assignments`
-- (See below for the actual view)
--
CREATE TABLE `active_client_assignments` (
`client_id` int(11)
,`company_name` varchar(200)
,`address_line1` varchar(200)
,`city` varchar(100)
,`pco_id` int(11)
,`pco_name` varchar(100)
,`pco_number` varchar(20)
,`assigned_at` timestamp
);

-- --------------------------------------------------------

--
-- Table structure for table `app_versions`
--

CREATE TABLE `app_versions` (
  `id` int(11) NOT NULL,
  `version` varchar(20) NOT NULL,
  `platform` enum('web','mobile','both') NOT NULL DEFAULT 'both',
  `release_date` timestamp NOT NULL DEFAULT current_timestamp(),
  `force_update` tinyint(1) DEFAULT 1,
  `release_notes` text DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `app_versions`
--

INSERT INTO `app_versions` (`id`, `version`, `platform`, `release_date`, `force_update`, `release_notes`, `is_active`) VALUES
(1, '1.0.0', 'both', '2025-10-10 14:51:21', 1, 'Initial release', 1);

-- --------------------------------------------------------

--
-- Table structure for table `audit_logs`
--

CREATE TABLE `audit_logs` (
  `id` int(11) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `action` varchar(100) NOT NULL,
  `entity_type` varchar(50) NOT NULL,
  `entity_id` int(11) DEFAULT NULL,
  `old_values` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`old_values`)),
  `new_values` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`new_values`)),
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `bait_stations`
--

CREATE TABLE `bait_stations` (
  `id` int(11) NOT NULL,
  `report_id` int(11) NOT NULL,
  `station_number` varchar(20) NOT NULL,
  `location` enum('inside','outside') NOT NULL,
  `is_accessible` tinyint(1) NOT NULL DEFAULT 1,
  `inaccessible_reason` varchar(255) DEFAULT NULL,
  `activity_detected` tinyint(1) NOT NULL DEFAULT 0,
  `activity_droppings` tinyint(1) DEFAULT 0,
  `activity_gnawing` tinyint(1) DEFAULT 0,
  `activity_tracks` tinyint(1) DEFAULT 0,
  `activity_other` tinyint(1) DEFAULT 0,
  `activity_other_description` varchar(255) DEFAULT NULL,
  `bait_status` enum('clean','eaten','wet','old') NOT NULL DEFAULT 'clean',
  `station_condition` enum('good','needs_repair','damaged','missing') NOT NULL DEFAULT 'good',
  `action_taken` enum('repaired','replaced','none') DEFAULT 'none' COMMENT 'Action taken if station needs repair/damaged/missing',
  `warning_sign_condition` enum('good','replaced','repaired','remounted') NOT NULL DEFAULT 'good',
  `rodent_box_replaced` tinyint(1) NOT NULL DEFAULT 0,
  `station_remarks` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `bait_stations`
--

INSERT INTO `bait_stations` (`id`, `report_id`, `station_number`, `location`, `is_accessible`, `inaccessible_reason`, `activity_detected`, `activity_droppings`, `activity_gnawing`, `activity_tracks`, `activity_other`, `activity_other_description`, `bait_status`, `station_condition`, `action_taken`, `warning_sign_condition`, `rodent_box_replaced`, `station_remarks`, `created_at`, `updated_at`) VALUES
(5, 2, 'TEST-001', 'inside', 1, NULL, 1, 1, 0, 0, 0, NULL, 'clean', 'good', 'none', 'good', 1, 'Updated test station', '2025-10-14 08:08:37', '2025-10-14 08:08:37'),
(6, 2, 'TEST-002', 'outside', 0, 'Locked gate', 0, 0, 0, 0, 0, NULL, 'clean', 'good', 'none', 'good', 0, NULL, '2025-10-14 08:08:37', '2025-10-14 08:08:37'),
(7, 3, 'TEST-001', 'inside', 1, NULL, 1, 1, 0, 0, 0, NULL, 'clean', 'good', 'none', 'good', 1, 'Updated test station', '2025-10-14 08:10:44', '2025-10-14 08:10:44'),
(8, 3, 'TEST-002', 'outside', 0, 'Locked gate', 0, 0, 0, 0, 0, NULL, 'clean', 'good', 'none', 'good', 0, NULL, '2025-10-14 08:10:44', '2025-10-14 08:10:44'),
(9, 4, 'TEST-001', 'inside', 1, NULL, 1, 1, 0, 0, 0, NULL, 'clean', 'good', 'none', 'good', 1, 'Updated test station', '2025-10-14 08:19:13', '2025-10-14 08:19:13'),
(10, 4, 'TEST-002', 'outside', 0, 'Locked gate', 0, 0, 0, 0, 0, NULL, 'clean', 'good', 'none', 'good', 0, NULL, '2025-10-14 08:19:13', '2025-10-14 08:19:13'),
(11, 5, 'TEST-001', 'inside', 1, NULL, 1, 1, 0, 0, 0, NULL, 'clean', 'good', 'none', 'good', 1, 'Updated test station', '2025-10-14 08:22:52', '2025-10-14 08:22:52'),
(12, 5, 'TEST-002', 'outside', 0, 'Locked gate', 0, 0, 0, 0, 0, NULL, 'clean', 'good', 'none', 'good', 0, NULL, '2025-10-14 08:22:52', '2025-10-14 08:22:52'),
(13, 24, 'BS-001', 'inside', 1, NULL, 0, 0, 0, 0, 0, NULL, 'clean', 'good', 'none', 'good', 0, NULL, '2025-10-14 12:59:27', '2025-10-14 12:59:27'),
(14, 25, 'BS-001', 'inside', 1, NULL, 0, 0, 0, 0, 0, NULL, 'clean', 'good', 'none', 'good', 0, NULL, '2025-10-14 12:59:49', '2025-10-14 12:59:49'),
(15, 26, 'BS-001', 'inside', 1, NULL, 0, 0, 0, 0, 0, NULL, 'clean', 'good', 'none', 'good', 0, NULL, '2025-10-14 13:16:26', '2025-10-14 13:16:26'),
(16, 27, 'BS-001', 'inside', 1, NULL, 0, 0, 0, 0, 0, NULL, 'clean', 'good', 'none', 'good', 0, NULL, '2025-10-14 13:24:25', '2025-10-14 13:24:25'),
(17, 28, 'BS-001', 'inside', 1, NULL, 0, 0, 0, 0, 0, NULL, 'clean', 'good', 'none', 'good', 0, NULL, '2025-10-14 13:26:26', '2025-10-14 13:26:26'),
(18, 29, 'BS-001', 'inside', 1, NULL, 0, 0, 0, 0, 0, NULL, 'clean', 'good', 'none', 'good', 0, NULL, '2025-10-14 13:27:27', '2025-10-14 13:27:27'),
(19, 30, 'BS-001', 'inside', 1, NULL, 0, 0, 0, 0, 0, NULL, 'clean', 'good', 'none', 'good', 0, NULL, '2025-10-14 13:32:21', '2025-10-14 13:32:21'),
(20, 31, 'BS-001', 'inside', 1, NULL, 0, 0, 0, 0, 0, NULL, 'clean', 'good', 'none', 'good', 0, NULL, '2025-10-14 13:45:41', '2025-10-14 13:45:41'),
(21, 32, 'BS-001', 'inside', 1, NULL, 0, 0, 0, 0, 0, NULL, 'clean', 'good', 'none', 'good', 0, NULL, '2025-10-14 13:46:36', '2025-10-14 13:46:36'),
(22, 33, 'BS-001', 'inside', 1, NULL, 0, 0, 0, 0, 0, NULL, 'clean', 'good', 'none', 'good', 0, NULL, '2025-10-14 13:59:14', '2025-10-14 13:59:14'),
(23, 34, 'BS-001', 'inside', 1, NULL, 0, 0, 0, 0, 0, NULL, 'clean', 'good', 'none', 'good', 0, NULL, '2025-10-14 14:00:04', '2025-10-14 14:00:04'),
(24, 35, 'BS-001', 'inside', 1, NULL, 0, 0, 0, 0, 0, NULL, 'clean', 'good', 'none', 'good', 0, NULL, '2025-10-14 14:01:21', '2025-10-14 14:01:21'),
(25, 36, 'TEST-001', 'inside', 1, NULL, 1, 1, 0, 0, 0, NULL, 'clean', 'good', 'none', 'good', 1, 'Updated test station', '2025-10-14 14:21:03', '2025-10-14 14:21:03'),
(26, 36, 'TEST-002', 'outside', 0, 'Locked gate', 0, 0, 0, 0, 0, NULL, 'clean', 'good', 'none', 'good', 0, NULL, '2025-10-14 14:21:03', '2025-10-14 14:21:03'),
(27, 37, 'TEST-001', 'inside', 1, NULL, 1, 1, 0, 0, 0, NULL, 'clean', 'good', 'none', 'good', 1, 'Updated test station', '2025-10-14 14:26:53', '2025-10-14 14:26:53'),
(28, 37, 'TEST-002', 'outside', 0, 'Locked gate', 0, 0, 0, 0, 0, NULL, 'clean', 'good', 'none', 'good', 0, NULL, '2025-10-14 14:26:53', '2025-10-14 14:26:53'),
(29, 45, 'BS-001', '', 1, NULL, 0, 0, 0, 0, 0, NULL, 'clean', 'good', 'none', 'good', 0, NULL, '2025-10-15 12:51:53', '2025-10-15 12:51:53'),
(30, 48, 'BS-001', '', 1, NULL, 0, 0, 0, 0, 0, NULL, 'clean', 'good', 'none', 'good', 0, NULL, '2025-10-15 12:59:53', '2025-10-15 12:59:53'),
(31, 51, 'BS-001', '', 1, NULL, 0, 0, 0, 0, 0, NULL, 'clean', 'good', 'none', 'good', 0, NULL, '2025-10-15 13:10:10', '2025-10-15 13:10:10'),
(32, 53, 'BS-001', '', 1, NULL, 0, 0, 0, 0, 0, NULL, 'clean', 'good', 'none', 'good', 0, NULL, '2025-10-15 13:12:22', '2025-10-15 13:12:22'),
(33, 56, 'BS-001', '', 1, NULL, 0, 0, 0, 0, 0, NULL, 'clean', 'good', 'none', 'good', 0, NULL, '2025-10-15 13:14:40', '2025-10-15 13:14:40'),
(34, 58, 'ST001', '', 1, NULL, 0, 0, 0, 0, 0, NULL, 'clean', 'good', 'none', 'good', 0, NULL, '2025-10-15 13:26:38', '2025-10-15 13:26:38'),
(35, 59, 'ST002', '', 1, NULL, 0, 0, 0, 0, 0, NULL, 'clean', 'good', 'none', 'good', 0, NULL, '2025-10-15 13:26:38', '2025-10-15 13:26:38'),
(36, 60, 'ST003', '', 1, NULL, 0, 0, 0, 0, 0, NULL, 'clean', 'good', 'none', 'good', 0, NULL, '2025-10-15 13:26:38', '2025-10-15 13:26:38'),
(37, 61, 'BS-001', '', 1, NULL, 0, 0, 0, 0, 0, NULL, 'clean', 'good', 'none', 'good', 0, NULL, '2025-10-15 13:26:44', '2025-10-15 13:26:44'),
(38, 63, 'NEW-001', 'inside', 1, NULL, 1, 0, 0, 0, 0, NULL, 'old', 'damaged', 'repaired', 'replaced', 1, NULL, '2025-10-15 16:02:43', '2025-10-15 16:02:43'),
(39, 65, 'ST001', 'inside', 1, NULL, 0, 0, 0, 0, 0, NULL, 'clean', 'good', 'none', 'good', 0, NULL, '2025-10-15 16:29:10', '2025-10-15 16:29:10'),
(40, 66, 'ST002', 'outside', 1, NULL, 0, 0, 0, 0, 0, NULL, 'clean', 'good', 'none', 'good', 0, NULL, '2025-10-15 16:29:10', '2025-10-15 16:29:10'),
(41, 67, 'ST003', 'inside', 1, NULL, 0, 0, 0, 0, 0, NULL, 'clean', 'good', 'none', 'good', 0, NULL, '2025-10-15 16:29:10', '2025-10-15 16:29:10'),
(42, 68, 'BS-001', 'inside', 1, NULL, 0, 0, 0, 0, 0, NULL, 'clean', 'good', 'none', 'good', 0, NULL, '2025-10-15 16:29:15', '2025-10-15 16:29:15');

-- --------------------------------------------------------

--
-- Table structure for table `chemicals`
--

CREATE TABLE `chemicals` (
  `id` int(11) NOT NULL,
  `name` varchar(200) NOT NULL,
  `active_ingredients` text DEFAULT NULL,
  `usage_type` enum('bait_inspection','fumigation','multi_purpose') NOT NULL,
  `quantity_unit` varchar(20) NOT NULL,
  `safety_information` text DEFAULT NULL,
  `status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `chemicals`
--

INSERT INTO `chemicals` (`id`, `name`, `active_ingredients`, `usage_type`, `quantity_unit`, `safety_information`, `status`, `created_at`, `updated_at`, `deleted_at`) VALUES
(1, 'Baygon Cockroach Bait', 'Fipronil 0.05%', 'bait_inspection', 'grams', 'Keep away from children. Wash hands after use.', 'active', '2025-10-10 14:51:22', '2025-10-10 14:51:22', NULL),
(2, 'Rentokil Rat Bait', 'Brodifacoum 0.005%', 'bait_inspection', 'grams', 'Highly toxic. Use protective gloves.', 'active', '2025-10-10 14:51:22', '2025-10-10 14:51:22', NULL),
(3, 'Pyrethrin Spray', 'Pyrethrin 0.2%', 'fumigation', 'ml', 'Use in well-ventilated areas only.', 'active', '2025-10-10 14:51:22', '2025-10-10 14:51:22', NULL),
(4, 'Multi-Purpose Gel', 'Imidacloprid 2.15%', 'multi_purpose', 'ml', 'Avoid contact with skin and eyes.', 'active', '2025-10-10 14:51:22', '2025-10-10 14:51:22', NULL),
(5, 'Ant Control Powder', 'Boric Acid 99%', 'bait_inspection', 'grams', 'Do not inhale powder.', 'active', '2025-10-10 14:51:22', '2025-10-10 14:51:22', NULL),
(6, 'Maxforce Quantum Gel', 'Imidacloprid 0.03%', 'bait_inspection', 'g', 'Harmful if swallowed. Keep away from food and water. Wash hands after use. Store in cool, dry place away from direct sunlight.', 'active', '2025-10-13 11:01:08', '2025-10-13 11:01:08', NULL),
(7, 'Vikane Gas Fumigant', 'Sulfuryl Fluoride 99.8%', 'fumigation', 'lbs', 'DANGER: Highly toxic. Licensed applicators only. Requires proper protective equipment and ventilation. Store in well-ventilated area. Keep cylinders upright. Temperature controlled storage required.', 'active', '2025-10-13 11:01:09', '2025-10-13 11:01:09', NULL),
(8, 'Termidor SC', 'Fipronil 9.1%', 'multi_purpose', 'ml', 'Harmful if absorbed through skin. Avoid contact with eyes and skin. Wear protective clothing. Store at temperatures above 32�F. Keep container tightly closed.', 'active', '2025-10-13 11:01:09', '2025-10-13 11:01:09', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `clients`
--

CREATE TABLE `clients` (
  `id` int(11) NOT NULL,
  `company_name` varchar(200) NOT NULL,
  `address_line1` varchar(200) NOT NULL,
  `address_line2` varchar(200) DEFAULT NULL,
  `city` varchar(100) NOT NULL,
  `state` varchar(50) NOT NULL,
  `postal_code` varchar(20) NOT NULL,
  `country` varchar(50) NOT NULL DEFAULT 'South Africa',
  `total_bait_stations_inside` int(11) NOT NULL DEFAULT 0,
  `total_bait_stations_outside` int(11) NOT NULL DEFAULT 0,
  `total_insect_monitors_light` int(11) NOT NULL DEFAULT 0,
  `total_insect_monitors_box` int(11) NOT NULL DEFAULT 0,
  `status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `service_notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `clients`
--

INSERT INTO `clients` (`id`, `company_name`, `address_line1`, `address_line2`, `city`, `state`, `postal_code`, `country`, `total_bait_stations_inside`, `total_bait_stations_outside`, `total_insect_monitors_light`, `total_insect_monitors_box`, `status`, `service_notes`, `created_at`, `updated_at`, `deleted_at`) VALUES
(1, 'ABC Restaurant Sdn Bhd (Updated)', '123 Jalan Maju', 'Groblersdal', 'Kuala Lumpur', 'Selangor Edit', '1234', 'South Africa', 0, 0, 0, 0, 'active', NULL, '2025-10-10 14:51:22', '2025-10-16 10:30:11', NULL),
(2, 'XYZ Food Court', '456 Lorong Makanan', NULL, 'Petaling Jaya', 'Selangor', '47000', 'South Africa', 0, 0, 0, 0, 'active', NULL, '2025-10-10 14:51:22', '2025-10-10 14:51:22', NULL),
(3, 'Metro Supermarket', '789 Jalan Besar', NULL, 'Shah Alam', 'Selangor', '40000', 'South Africa', 0, 0, 0, 0, 'inactive', NULL, '2025-10-10 14:51:22', '2025-10-16 10:30:45', '2025-10-16 10:30:45');

-- --------------------------------------------------------

--
-- Table structure for table `client_contacts`
--

CREATE TABLE `client_contacts` (
  `id` int(11) NOT NULL,
  `client_id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `email` varchar(100) NOT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `role` varchar(50) DEFAULT 'Primary Contact',
  `is_primary` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `client_contacts`
--

INSERT INTO `client_contacts` (`id`, `client_id`, `name`, `email`, `phone`, `role`, `is_primary`, `created_at`, `updated_at`) VALUES
(1, 1, 'Ahmad Rahman', 'ahmad@abcrestaurant.com', '+60123456791', 'Manager', 1, '2025-10-10 14:51:22', '2025-10-10 14:51:22'),
(2, 1, 'Siti Nurhaliza', 'siti@abcrestaurant.com', '+60123456792', 'Assistant Manager', 0, '2025-10-10 14:51:22', '2025-10-10 14:51:22'),
(3, 2, 'Lim Wei Ming', 'wm.lim@xyzfoodcourt.com', '+60123456793', 'Owner', 1, '2025-10-10 14:51:22', '2025-10-10 14:51:22'),
(4, 3, 'Rajesh Kumar', 'rajesh@metrosuper.com', '+60123456794', 'Facility Manager', 1, '2025-10-10 14:51:22', '2025-10-10 14:51:22'),
(5, 3, 'Mary Tan', 'mary@metrosuper.com', '+60123456795', 'Operations Manager', 0, '2025-10-10 14:51:22', '2025-10-10 14:51:22'),
(6, 1, 'New Contact Person', 'newcontact@abcrestaurant.com', '+60123456999', 'other', 0, '2025-10-13 06:41:34', '2025-10-13 06:41:34');

-- --------------------------------------------------------

--
-- Table structure for table `client_last_report_cache`
--

CREATE TABLE `client_last_report_cache` (
  `client_id` int(11) NOT NULL,
  `last_report_id` int(11) NOT NULL,
  `last_service_date` date NOT NULL,
  `cache_data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`cache_data`)),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `client_last_report_cache`
--

INSERT INTO `client_last_report_cache` (`client_id`, `last_report_id`, `last_service_date`, `cache_data`, `updated_at`) VALUES
(1, 36, '2025-10-14', '{}', '2025-10-14 14:21:06');

-- --------------------------------------------------------

--
-- Table structure for table `client_pco_assignments`
--

CREATE TABLE `client_pco_assignments` (
  `id` int(11) NOT NULL,
  `client_id` int(11) NOT NULL,
  `pco_id` int(11) NOT NULL,
  `assigned_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `assigned_by` int(11) NOT NULL,
  `unassigned_at` timestamp NULL DEFAULT NULL,
  `unassigned_by` int(11) DEFAULT NULL,
  `status` enum('active','inactive') NOT NULL DEFAULT 'active'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `client_pco_assignments`
--

INSERT INTO `client_pco_assignments` (`id`, `client_id`, `pco_id`, `assigned_at`, `assigned_by`, `unassigned_at`, `unassigned_by`, `status`) VALUES
(9, 3, 8, '2025-10-13 13:50:33', 7, '2025-10-13 14:00:51', 7, 'inactive'),
(89, 2, 98, '2025-10-16 07:58:21', 7, '2025-10-16 07:58:22', 7, 'inactive'),
(91, 1, 100, '2025-10-16 08:27:28', 7, '2025-10-16 08:41:46', 7, 'inactive'),
(92, 1, 101, '2025-10-16 08:41:46', 7, NULL, NULL, 'active');

-- --------------------------------------------------------

--
-- Table structure for table `dashboard_cache`
--

CREATE TABLE `dashboard_cache` (
  `id` int(11) NOT NULL,
  `cache_key` varchar(100) NOT NULL,
  `cache_value` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`cache_value`)),
  `expires_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `file_uploads`
--

CREATE TABLE `file_uploads` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `file_name` varchar(255) NOT NULL,
  `file_type` enum('report_export','report_import') NOT NULL,
  `file_size` int(11) NOT NULL,
  `status` enum('uploaded','processing','completed','failed') NOT NULL DEFAULT 'uploaded',
  `error_message` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `processed_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `fumigation_areas`
--

CREATE TABLE `fumigation_areas` (
  `id` int(11) NOT NULL,
  `report_id` int(11) NOT NULL,
  `area_name` varchar(100) NOT NULL,
  `is_other` tinyint(1) DEFAULT 0,
  `other_description` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `fumigation_areas`
--

INSERT INTO `fumigation_areas` (`id`, `report_id`, `area_name`, `is_other`, `other_description`, `created_at`) VALUES
(4, 2, 'Kitchen', 0, NULL, '2025-10-14 08:08:37'),
(5, 2, 'Storage', 0, NULL, '2025-10-14 08:08:37'),
(6, 2, 'Custom Area', 1, 'Warehouse section', '2025-10-14 08:08:37'),
(7, 3, 'Kitchen', 0, NULL, '2025-10-14 08:10:44'),
(8, 3, 'Storage', 0, NULL, '2025-10-14 08:10:44'),
(9, 3, 'Custom Area', 1, 'Warehouse section', '2025-10-14 08:10:44'),
(10, 4, 'Kitchen', 0, NULL, '2025-10-14 08:19:13'),
(11, 4, 'Storage', 0, NULL, '2025-10-14 08:19:13'),
(12, 4, 'Custom Area', 1, 'Warehouse section', '2025-10-14 08:19:13'),
(13, 5, 'Kitchen', 0, NULL, '2025-10-14 08:22:52'),
(14, 5, 'Storage', 0, NULL, '2025-10-14 08:22:52'),
(15, 5, 'Custom Area', 1, 'Warehouse section', '2025-10-14 08:22:52'),
(16, 26, 'Dining Area', 0, NULL, '2025-10-14 13:16:54'),
(17, 27, 'Dining Area', 0, NULL, '2025-10-14 13:24:25'),
(18, 28, 'Dining Area', 0, NULL, '2025-10-14 13:26:26'),
(19, 29, 'Dining Area', 0, NULL, '2025-10-14 13:27:27'),
(20, 30, 'Dining Area', 0, NULL, '2025-10-14 13:32:21'),
(21, 31, 'Dining Area', 0, NULL, '2025-10-14 13:45:41'),
(22, 32, 'Dining Area', 0, NULL, '2025-10-14 13:46:36'),
(23, 33, 'Dining Area', 0, NULL, '2025-10-14 13:59:14'),
(24, 34, 'Dining Area', 0, NULL, '2025-10-14 14:00:05'),
(25, 35, 'Dining Area', 0, NULL, '2025-10-14 14:01:21'),
(26, 36, 'Kitchen', 0, NULL, '2025-10-14 14:21:04'),
(27, 36, 'Storage', 0, NULL, '2025-10-14 14:21:04'),
(28, 36, 'Custom Area', 1, 'Warehouse section', '2025-10-14 14:21:04'),
(29, 37, 'Kitchen', 0, NULL, '2025-10-14 14:26:53'),
(30, 37, 'Storage', 0, NULL, '2025-10-14 14:26:53'),
(31, 37, 'Custom Area', 1, 'Warehouse section', '2025-10-14 14:26:53'),
(32, 54, 'Kitchen', 0, NULL, '2025-10-15 13:12:23'),
(33, 57, 'Kitchen', 0, NULL, '2025-10-15 13:14:41'),
(34, 62, 'Kitchen', 0, NULL, '2025-10-15 13:26:44'),
(35, 69, 'Kitchen', 0, NULL, '2025-10-15 16:29:16'),
(36, 70, 'Dining Area', 0, NULL, '2025-10-16 07:58:35'),
(37, 71, 'Dining Area', 0, NULL, '2025-10-16 08:27:31'),
(38, 72, 'Dining Area', 0, NULL, '2025-10-16 08:41:48');

-- --------------------------------------------------------

--
-- Table structure for table `fumigation_chemicals`
--

CREATE TABLE `fumigation_chemicals` (
  `id` int(11) NOT NULL,
  `report_id` int(11) NOT NULL,
  `chemical_id` int(11) NOT NULL,
  `quantity` decimal(10,2) NOT NULL,
  `batch_number` varchar(50) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `fumigation_chemicals`
--

INSERT INTO `fumigation_chemicals` (`id`, `report_id`, `chemical_id`, `quantity`, `batch_number`, `created_at`) VALUES
(3, 2, 5, 100.00, 'FUM-TEST-001', '2025-10-14 08:08:37'),
(4, 3, 5, 100.00, 'FUM-TEST-001', '2025-10-14 08:10:44'),
(5, 4, 5, 100.00, 'FUM-TEST-001', '2025-10-14 08:19:13'),
(6, 5, 5, 100.00, 'FUM-TEST-001', '2025-10-14 08:22:52'),
(7, 26, 1, 2.50, 'BATCH001', '2025-10-14 13:16:54'),
(8, 27, 1, 2.50, 'BATCH001', '2025-10-14 13:24:25'),
(9, 28, 1, 2.50, 'BATCH001', '2025-10-14 13:26:26'),
(10, 29, 1, 2.50, 'BATCH001', '2025-10-14 13:27:27'),
(11, 30, 1, 2.50, 'BATCH001', '2025-10-14 13:32:21'),
(12, 31, 1, 2.50, 'BATCH001', '2025-10-14 13:45:41'),
(13, 32, 1, 2.50, 'BATCH001', '2025-10-14 13:46:36'),
(14, 33, 1, 2.50, 'BATCH001', '2025-10-14 13:59:14'),
(15, 34, 1, 2.50, 'BATCH001', '2025-10-14 14:00:05'),
(16, 35, 1, 2.50, 'BATCH001', '2025-10-14 14:01:21'),
(17, 36, 5, 100.00, 'FUM-TEST-001', '2025-10-14 14:21:04'),
(18, 37, 5, 100.00, 'FUM-TEST-001', '2025-10-14 14:26:53'),
(19, 54, 1, 100.00, NULL, '2025-10-15 13:12:23'),
(20, 57, 1, 100.00, NULL, '2025-10-15 13:14:41'),
(21, 62, 1, 100.00, NULL, '2025-10-15 13:26:44'),
(22, 69, 1, 100.00, NULL, '2025-10-15 16:29:16'),
(23, 70, 1, 2.50, 'BATCH001', '2025-10-16 07:58:35'),
(24, 71, 1, 2.50, 'BATCH001', '2025-10-16 08:27:31'),
(25, 72, 1, 2.50, 'BATCH001', '2025-10-16 08:41:48');

-- --------------------------------------------------------

--
-- Table structure for table `fumigation_target_pests`
--

CREATE TABLE `fumigation_target_pests` (
  `id` int(11) NOT NULL,
  `report_id` int(11) NOT NULL,
  `pest_name` varchar(100) NOT NULL,
  `is_other` tinyint(1) DEFAULT 0,
  `other_description` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `fumigation_target_pests`
--

INSERT INTO `fumigation_target_pests` (`id`, `report_id`, `pest_name`, `is_other`, `other_description`, `created_at`) VALUES
(4, 2, 'Cockroaches', 0, NULL, '2025-10-14 08:08:37'),
(5, 2, 'Ants', 0, NULL, '2025-10-14 08:08:37'),
(6, 3, 'Cockroaches', 0, NULL, '2025-10-14 08:10:44'),
(7, 3, 'Ants', 0, NULL, '2025-10-14 08:10:44'),
(8, 4, 'Cockroaches', 0, NULL, '2025-10-14 08:19:13'),
(9, 4, 'Ants', 0, NULL, '2025-10-14 08:19:13'),
(10, 5, 'Cockroaches', 0, NULL, '2025-10-14 08:22:52'),
(11, 5, 'Ants', 0, NULL, '2025-10-14 08:22:52'),
(12, 26, 'Cockroaches', 0, NULL, '2025-10-14 13:16:54'),
(13, 27, 'Cockroaches', 0, NULL, '2025-10-14 13:24:25'),
(14, 28, 'Cockroaches', 0, NULL, '2025-10-14 13:26:26'),
(15, 29, 'Cockroaches', 0, NULL, '2025-10-14 13:27:27'),
(16, 30, 'Cockroaches', 0, NULL, '2025-10-14 13:32:21'),
(17, 31, 'Cockroaches', 0, NULL, '2025-10-14 13:45:41'),
(18, 32, 'Cockroaches', 0, NULL, '2025-10-14 13:46:36'),
(19, 33, 'Cockroaches', 0, NULL, '2025-10-14 13:59:14'),
(20, 34, 'Cockroaches', 0, NULL, '2025-10-14 14:00:05'),
(21, 35, 'Cockroaches', 0, NULL, '2025-10-14 14:01:21'),
(22, 36, 'Cockroaches', 0, NULL, '2025-10-14 14:21:04'),
(23, 36, 'Ants', 0, NULL, '2025-10-14 14:21:04'),
(24, 37, 'Cockroaches', 0, NULL, '2025-10-14 14:26:53'),
(25, 37, 'Ants', 0, NULL, '2025-10-14 14:26:53'),
(26, 54, 'Cockroach', 0, NULL, '2025-10-15 13:12:23'),
(27, 57, 'Cockroach', 0, NULL, '2025-10-15 13:14:41'),
(28, 62, 'Cockroach', 0, NULL, '2025-10-15 13:26:44'),
(29, 69, 'Cockroach', 0, NULL, '2025-10-15 16:29:16'),
(30, 70, 'Cockroaches', 0, NULL, '2025-10-16 07:58:35'),
(31, 71, 'Cockroaches', 0, NULL, '2025-10-16 08:27:31'),
(32, 72, 'Cockroaches', 0, NULL, '2025-10-16 08:41:48');

-- --------------------------------------------------------

--
-- Table structure for table `insect_monitors`
--

CREATE TABLE `insect_monitors` (
  `id` int(11) NOT NULL,
  `report_id` int(11) NOT NULL,
  `monitor_type` enum('box','fly_trap') NOT NULL,
  `monitor_condition` enum('good','replaced','repaired','other') NOT NULL DEFAULT 'good',
  `monitor_condition_other` varchar(255) DEFAULT NULL COMMENT 'Description if monitor_condition is other',
  `warning_sign_condition` enum('good','replaced','repaired','remounted') NOT NULL DEFAULT 'good',
  `light_condition` enum('good','faulty','na') DEFAULT 'na' COMMENT 'Only for fly_trap monitors',
  `light_faulty_type` enum('starter','tube','cable','electricity','other','na') DEFAULT 'na' COMMENT 'If light is faulty',
  `light_faulty_other` varchar(255) DEFAULT NULL COMMENT 'Description if light_faulty_type is other',
  `glue_board_replaced` tinyint(1) NOT NULL DEFAULT 0,
  `tubes_replaced` tinyint(1) DEFAULT NULL COMMENT 'Only for fly_trap monitors',
  `monitor_serviced` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `insect_monitors`
--

INSERT INTO `insect_monitors` (`id`, `report_id`, `monitor_type`, `monitor_condition`, `monitor_condition_other`, `warning_sign_condition`, `light_condition`, `light_faulty_type`, `light_faulty_other`, `glue_board_replaced`, `tubes_replaced`, `monitor_serviced`, `created_at`, `updated_at`) VALUES
(3, 2, 'fly_trap', 'good', NULL, 'good', 'na', 'na', NULL, 0, 1, 1, '2025-10-14 08:08:38', '2025-10-15 14:02:02'),
(4, 2, 'box', 'good', NULL, 'good', 'na', 'na', NULL, 0, NULL, 1, '2025-10-14 08:08:38', '2025-10-15 14:02:02'),
(5, 3, 'fly_trap', 'good', NULL, 'good', 'na', 'na', NULL, 0, 1, 1, '2025-10-14 08:10:45', '2025-10-15 14:02:02'),
(6, 3, 'box', 'good', NULL, 'good', 'na', 'na', NULL, 0, NULL, 1, '2025-10-14 08:10:45', '2025-10-15 14:02:02'),
(7, 4, 'fly_trap', 'good', NULL, 'good', 'na', 'na', NULL, 0, 1, 1, '2025-10-14 08:19:13', '2025-10-15 14:02:02'),
(8, 4, 'box', 'good', NULL, 'good', 'na', 'na', NULL, 0, NULL, 1, '2025-10-14 08:19:14', '2025-10-15 14:02:02'),
(9, 5, 'fly_trap', 'good', NULL, 'good', 'na', 'na', NULL, 0, 1, 1, '2025-10-14 08:22:53', '2025-10-15 14:02:02'),
(10, 5, 'box', 'good', NULL, 'good', 'na', 'na', NULL, 0, NULL, 1, '2025-10-14 08:22:53', '2025-10-15 14:02:02'),
(11, 36, 'fly_trap', 'good', NULL, 'good', 'na', 'na', NULL, 0, 1, 1, '2025-10-14 14:21:04', '2025-10-15 14:02:02'),
(12, 36, 'box', 'good', NULL, 'good', 'na', 'na', NULL, 0, NULL, 1, '2025-10-14 14:21:04', '2025-10-15 14:02:02'),
(13, 37, 'fly_trap', 'good', NULL, 'good', 'na', 'na', NULL, 0, 1, 1, '2025-10-14 14:26:53', '2025-10-15 14:02:02'),
(14, 37, 'box', 'good', NULL, 'good', 'na', 'na', NULL, 0, NULL, 1, '2025-10-14 14:26:54', '2025-10-15 14:02:02'),
(15, 63, 'fly_trap', 'replaced', NULL, 'remounted', 'faulty', 'tube', NULL, 1, 1, 1, '2025-10-15 16:02:43', '2025-10-15 16:02:43');

-- --------------------------------------------------------

--
-- Table structure for table `login_attempts`
--

CREATE TABLE `login_attempts` (
  `id` int(11) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `pco_number` varchar(50) NOT NULL,
  `ip_address` varchar(45) NOT NULL,
  `attempt_time` timestamp NOT NULL DEFAULT current_timestamp(),
  `success` tinyint(1) DEFAULT 0,
  `failure_reason` enum('invalid_credentials','account_locked','account_inactive') DEFAULT NULL,
  `user_agent` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `login_attempts`
--

INSERT INTO `login_attempts` (`id`, `user_id`, `pco_number`, `ip_address`, `attempt_time`, `success`, `failure_reason`, `user_agent`) VALUES
(259, 7, '12345', '::1', '2025-10-15 13:26:23', 1, NULL, 'curl/8.12.1'),
(260, 7, '12345', '::1', '2025-10-15 13:26:36', 1, NULL, 'curl/8.12.1'),
(261, 93, '37484', '::1', '2025-10-15 13:26:36', 1, NULL, 'curl/8.12.1'),
(262, 94, '38906', '::1', '2025-10-15 13:26:37', 1, NULL, 'curl/8.12.1'),
(263, 7, '12345', '::1', '2025-10-15 14:15:51', 1, NULL, 'curl/8.12.1'),
(264, 93, '37484', '::1', '2025-10-15 14:15:51', 1, NULL, 'curl/8.12.1'),
(265, 7, '12345', '::1', '2025-10-15 14:18:40', 1, NULL, 'curl/8.12.1'),
(266, 87, '11111', '::1', '2025-10-15 14:18:40', 0, 'invalid_credentials', 'curl/8.12.1'),
(267, 7, '12345', '::1', '2025-10-15 14:18:56', 1, NULL, 'curl/8.12.1'),
(268, 7, '12345', '::1', '2025-10-15 15:02:44', 1, NULL, 'curl/8.12.1'),
(269, 87, '11111', '::1', '2025-10-15 15:02:44', 0, 'invalid_credentials', 'curl/8.12.1'),
(270, 87, '11111', '::1', '2025-10-15 15:53:23', 0, 'invalid_credentials', 'curl/8.12.1'),
(271, 87, '11111', '::1', '2025-10-15 15:54:15', 1, NULL, 'curl/8.12.1'),
(272, 7, '12345', '::1', '2025-10-15 15:54:25', 1, NULL, 'curl/8.12.1'),
(273, 87, '11111', '::1', '2025-10-15 15:54:26', 1, NULL, 'curl/8.12.1'),
(274, 7, '12345', '::1', '2025-10-15 16:02:41', 1, NULL, 'curl/8.12.1'),
(275, 87, '11111', '::1', '2025-10-15 16:02:42', 1, NULL, 'curl/8.12.1'),
(276, 7, '12345', '::1', '2025-10-15 16:17:03', 1, NULL, 'curl/8.12.1'),
(277, 95, '12563', '::1', '2025-10-15 16:17:03', 1, NULL, 'curl/8.12.1'),
(278, 96, '20104', '::1', '2025-10-15 16:17:04', 1, NULL, 'curl/8.12.1'),
(279, 7, '12345', '::1', '2025-10-15 16:29:07', 1, NULL, 'curl/8.12.1'),
(280, 97, '11376', '::1', '2025-10-15 16:29:08', 1, NULL, 'curl/8.12.1'),
(281, 98, '36765', '::1', '2025-10-15 16:29:09', 1, NULL, 'curl/8.12.1'),
(282, 7, '12345', '::1', '2025-10-15 16:38:12', 1, NULL, 'curl/8.12.1'),
(283, 87, '11111', '::1', '2025-10-15 16:38:12', 1, NULL, 'curl/8.12.1'),
(284, 7, '12345', '::1', '2025-10-15 16:41:38', 1, NULL, 'curl/8.12.1'),
(285, 87, '11111', '::1', '2025-10-15 16:41:39', 1, NULL, 'curl/8.12.1'),
(286, 7, '12345', '::1', '2025-10-15 17:10:23', 1, NULL, 'curl/8.12.1'),
(287, 8, '67890', '::1', '2025-10-15 17:10:24', 0, 'invalid_credentials', 'curl/8.12.1'),
(288, 7, '12345', '::1', '2025-10-15 17:13:47', 1, NULL, 'curl/8.12.1'),
(289, 7, '12345', '::1', '2025-10-15 17:18:41', 1, NULL, 'curl/8.12.1'),
(290, 7, '12345', '::1', '2025-10-15 17:19:03', 1, NULL, 'curl/8.12.1'),
(291, 7, '12345', '::1', '2025-10-15 17:19:37', 1, NULL, 'curl/8.12.1'),
(292, 87, '11111', '::1', '2025-10-15 17:19:38', 0, 'invalid_credentials', 'curl/8.12.1'),
(293, 7, '12345', '::1', '2025-10-15 17:26:23', 1, NULL, 'curl/8.12.1'),
(294, 7, '12345', '::1', '2025-10-16 05:53:26', 1, NULL, 'curl/8.12.1'),
(295, 87, '11111', '::1', '2025-10-16 05:53:26', 0, 'invalid_credentials', 'curl/8.12.1'),
(296, 87, '11111', '::1', '2025-10-16 05:54:04', 0, 'invalid_credentials', 'curl/8.12.1'),
(297, 7, '12345', '::1', '2025-10-16 05:55:17', 1, NULL, 'curl/8.12.1'),
(298, 7, '12345', '::1', '2025-10-16 05:55:57', 1, NULL, 'curl/8.12.1'),
(299, 7, '12345', '::1', '2025-10-16 06:38:11', 1, NULL, 'curl/8.12.1'),
(300, 87, '11111', '::1', '2025-10-16 06:38:12', 1, NULL, 'curl/8.12.1'),
(301, 7, '12345', '::1', '2025-10-16 06:38:33', 1, NULL, 'curl/8.12.1'),
(302, 7, '12345', '::1', '2025-10-16 06:41:34', 1, NULL, 'curl/8.12.1'),
(303, 87, '11111', '::1', '2025-10-16 06:41:35', 1, NULL, 'curl/8.12.1'),
(304, 7, '12345', '::1', '2025-10-16 06:42:07', 1, NULL, 'curl/8.12.1'),
(305, 7, '12345', '::1', '2025-10-16 06:45:08', 1, NULL, 'curl/8.12.1'),
(306, 87, '11111', '::1', '2025-10-16 06:45:08', 1, NULL, 'curl/8.12.1'),
(307, 7, '12345', '::1', '2025-10-16 06:45:45', 1, NULL, 'curl/8.12.1'),
(308, 7, '12345', '::1', '2025-10-16 06:46:21', 1, NULL, 'curl/8.12.1'),
(309, 7, '12345', '::1', '2025-10-16 06:46:51', 1, NULL, 'curl/8.12.1'),
(310, 87, '11111', '::1', '2025-10-16 06:46:52', 1, NULL, 'curl/8.12.1'),
(311, 7, '12345', '::1', '2025-10-16 06:48:12', 1, NULL, 'curl/8.12.1'),
(312, 7, '12345', '::1', '2025-10-16 06:48:28', 1, NULL, 'curl/8.12.1'),
(313, 7, '12345', '::1', '2025-10-16 06:49:21', 1, NULL, 'curl/8.12.1'),
(314, 7, '12345', '::1', '2025-10-16 06:51:16', 1, NULL, 'curl/8.12.1'),
(315, 7, '12345', '::1', '2025-10-16 06:51:23', 1, NULL, 'curl/8.12.1'),
(316, 87, '11111', '::1', '2025-10-16 06:51:24', 1, NULL, 'curl/8.12.1'),
(317, 7, '12345', '::1', '2025-10-16 06:52:38', 1, NULL, 'curl/8.12.1'),
(318, 7, '12345', '::1', '2025-10-16 06:52:46', 1, NULL, 'curl/8.12.1'),
(319, 87, '11111', '::1', '2025-10-16 06:52:47', 1, NULL, 'curl/8.12.1'),
(320, 7, '12345', '::1', '2025-10-16 06:53:27', 1, NULL, 'curl/8.12.1'),
(321, 87, '11111', '::1', '2025-10-16 06:53:28', 1, NULL, 'curl/8.12.1'),
(322, 7, '12345', '::1', '2025-10-16 06:55:39', 1, NULL, 'curl/8.12.1'),
(323, 87, '11111', '::1', '2025-10-16 06:55:39', 1, NULL, 'curl/8.12.1'),
(324, 87, '11111', '::1', '2025-10-16 06:56:00', 1, NULL, 'curl/8.12.1'),
(325, 7, '12345', '::1', '2025-10-16 06:56:13', 1, NULL, 'curl/8.12.1'),
(326, 87, '11111', '::1', '2025-10-16 06:56:29', 1, NULL, 'curl/8.12.1'),
(327, 87, '11111', '::1', '2025-10-16 06:56:55', 1, NULL, 'curl/8.12.1'),
(328, 7, '12345', '::1', '2025-10-16 06:58:10', 1, NULL, 'curl/8.12.1'),
(329, 87, '11111', '::1', '2025-10-16 06:58:10', 1, NULL, 'curl/8.12.1'),
(330, 7, '12345', '::1', '2025-10-16 07:08:57', 1, NULL, 'curl/8.12.1'),
(331, 87, '11111', '::1', '2025-10-16 07:08:57', 1, NULL, 'curl/8.12.1'),
(332, 7, '12345', '::1', '2025-10-16 07:57:43', 1, NULL, 'curl/8.12.1'),
(333, 7, '12345', '::1', '2025-10-16 07:57:53', 1, NULL, 'curl/8.12.1'),
(334, 87, '11111', '::1', '2025-10-16 07:57:53', 1, NULL, 'curl/8.12.1'),
(335, 7, '12345', '::1', '2025-10-16 07:58:17', 1, NULL, 'curl/8.12.1'),
(336, 7, '12345', '::1', '2025-10-16 07:58:32', 1, NULL, 'curl/8.12.1'),
(337, 99, '25880', '::1', '2025-10-16 07:58:33', 1, NULL, 'curl/8.12.1'),
(338, 7, '12345', '::1', '2025-10-16 08:14:32', 1, NULL, 'curl/8.12.1'),
(339, NULL, '12345', '::1', '2025-10-16 08:19:02', 0, 'invalid_credentials', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0'),
(340, 87, '11111', '::1', '2025-10-16 08:20:19', 1, NULL, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0'),
(341, 7, '12345', '::1', '2025-10-16 08:27:26', 1, NULL, 'curl/8.12.1'),
(342, 100, '30648', '::1', '2025-10-16 08:27:27', 1, NULL, 'curl/8.12.1'),
(343, 7, '12345', '::1', '2025-10-16 08:41:44', 1, NULL, 'curl/8.12.1'),
(344, 101, '18239', '::1', '2025-10-16 08:41:45', 1, NULL, 'curl/8.12.1'),
(345, 87, '11111', '::1', '2025-10-16 08:50:51', 1, NULL, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0'),
(346, 87, '11111', '::1', '2025-10-16 08:51:03', 1, NULL, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0'),
(347, 7, '12345', '::1', '2025-10-16 09:22:15', 1, NULL, 'curl/8.12.1'),
(348, 7, '12345', '::1', '2025-10-16 09:23:07', 1, NULL, 'curl/8.12.1'),
(349, 7, '12345', '::1', '2025-10-16 09:25:11', 1, NULL, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'),
(350, 7, '12345', '::1', '2025-10-16 09:53:33', 1, NULL, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'),
(351, 7, '12345', '::1', '2025-10-16 09:53:43', 0, 'invalid_credentials', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'),
(352, 7, '12345', '::1', '2025-10-16 09:53:52', 1, NULL, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'),
(353, 7, '12345', '::1', '2025-10-16 09:58:06', 1, NULL, 'curl/8.12.1'),
(354, NULL, '60004', '::1', '2025-10-16 09:58:42', 0, 'invalid_credentials', 'curl/8.12.1'),
(355, 8, '67890', '::1', '2025-10-16 10:02:32', 0, 'invalid_credentials', 'curl/8.12.1');

-- --------------------------------------------------------

--
-- Table structure for table `notifications`
--

CREATE TABLE `notifications` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `type` enum('assignment','report_declined','report_submitted','system_update') NOT NULL,
  `title` varchar(200) NOT NULL,
  `message` text NOT NULL,
  `read_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `notifications`
--

INSERT INTO `notifications` (`id`, `user_id`, `type`, `title`, `message`, `read_at`, `created_at`) VALUES
(1, 3, 'report_submitted', 'New Report Submitted', 'Test PCO User submitted a report for ABC Restaurant Sdn Bhd (Updated)', NULL, '2025-10-14 08:08:39'),
(2, 10, 'report_declined', 'Report Declined - Revision Required', 'Your report for ABC Restaurant Sdn Bhd (Updated) has been declined. Admin feedback: Please add more detailed bait station remarks and resubmit. Station TEST-001 needs specific pest identification.', NULL, '2025-10-14 08:08:40'),
(3, 3, 'report_submitted', 'New Report Submitted', 'Test PCO User submitted a report for ABC Restaurant Sdn Bhd (Updated)', NULL, '2025-10-14 08:10:46'),
(4, 11, 'report_declined', 'Report Declined - Revision Required', 'Your report for ABC Restaurant Sdn Bhd (Updated) has been declined. Admin feedback: Please add more detailed bait station remarks and resubmit. Station TEST-001 needs specific pest identification.', NULL, '2025-10-14 08:10:48'),
(5, 3, 'report_submitted', 'New Report Submitted', 'Test PCO User submitted a report for ABC Restaurant Sdn Bhd (Updated)', NULL, '2025-10-14 08:19:15'),
(6, 12, 'report_declined', 'Report Declined - Revision Required', 'Your report for ABC Restaurant Sdn Bhd (Updated) has been declined. Admin feedback: Please add more detailed bait station remarks and resubmit. Station TEST-001 needs specific pest identification.', NULL, '2025-10-14 08:19:16'),
(7, 3, 'report_submitted', 'New Report Submitted', 'Test PCO User submitted a report for ABC Restaurant Sdn Bhd (Updated)', NULL, '2025-10-14 08:19:17'),
(8, 3, 'report_submitted', 'New Report Submitted', 'Test PCO User submitted a report for ABC Restaurant Sdn Bhd (Updated)', NULL, '2025-10-14 08:22:55'),
(9, 13, 'report_declined', 'Report Declined - Revision Required', 'Your report for ABC Restaurant Sdn Bhd (Updated) has been declined. Admin feedback: Please add more detailed bait station remarks and resubmit. Station TEST-001 needs specific pest identification.', NULL, '2025-10-14 08:22:56'),
(10, 3, 'report_submitted', 'New Report Submitted', 'Test PCO User submitted a report for ABC Restaurant Sdn Bhd (Updated)', NULL, '2025-10-14 08:22:57'),
(11, 3, 'report_submitted', 'New Report Submitted', 'Manual Test PCO submitted a report for ABC Restaurant Sdn Bhd (Updated)', NULL, '2025-10-14 13:18:27'),
(12, 3, 'report_submitted', 'New Report Submitted', 'Test PCO Dashboard User submitted a report for ABC Restaurant Sdn Bhd (Updated)', NULL, '2025-10-14 13:24:25'),
(13, 38, 'report_declined', 'Report Declined - Revision Required', 'Your report for ABC Restaurant Sdn Bhd (Updated) has been declined. Admin feedback: Please add missing bait station BS-002 and verify chemical quantities.', NULL, '2025-10-14 13:24:29'),
(14, 3, 'report_submitted', 'New Report Submitted', 'Test PCO Dashboard User submitted a report for ABC Restaurant Sdn Bhd (Updated)', NULL, '2025-10-14 13:24:31'),
(15, 3, 'report_submitted', 'New Report Submitted', 'Test PCO Dashboard User submitted a report for ABC Restaurant Sdn Bhd (Updated)', NULL, '2025-10-14 13:26:27'),
(16, 39, 'report_declined', 'Report Declined - Revision Required', 'Your report for ABC Restaurant Sdn Bhd (Updated) has been declined. Admin feedback: Please add missing bait station BS-002 and verify chemical quantities.', NULL, '2025-10-14 13:26:30'),
(17, 3, 'report_submitted', 'New Report Submitted', 'Test PCO Dashboard User submitted a report for ABC Restaurant Sdn Bhd (Updated)', NULL, '2025-10-14 13:26:33'),
(18, 3, 'report_submitted', 'New Report Submitted', 'Test PCO Dashboard User submitted a report for ABC Restaurant Sdn Bhd (Updated)', NULL, '2025-10-14 13:27:27'),
(19, 40, 'report_declined', 'Report Declined - Revision Required', 'Your report for ABC Restaurant Sdn Bhd (Updated) has been declined. Admin feedback: Please add missing bait station BS-002 and verify chemical quantities.', NULL, '2025-10-14 13:27:30'),
(20, 3, 'report_submitted', 'New Report Submitted', 'Test PCO Dashboard User submitted a report for ABC Restaurant Sdn Bhd (Updated)', NULL, '2025-10-14 13:27:32'),
(21, 3, 'report_submitted', 'New Report Submitted', 'Test PCO Dashboard User submitted a report for ABC Restaurant Sdn Bhd (Updated)', NULL, '2025-10-14 13:32:21'),
(22, 41, 'report_declined', 'Report Declined - Revision Required', 'Your report for ABC Restaurant Sdn Bhd (Updated) has been declined. Admin feedback: Please add missing bait station BS-002 and verify chemical quantities.', NULL, '2025-10-14 13:32:25'),
(23, 3, 'report_submitted', 'New Report Submitted', 'Test PCO Dashboard User submitted a report for ABC Restaurant Sdn Bhd (Updated)', NULL, '2025-10-14 13:32:28'),
(24, 3, 'report_submitted', 'New Report Submitted', 'Test PCO Dashboard User submitted a report for ABC Restaurant Sdn Bhd (Updated)', NULL, '2025-10-14 13:45:41'),
(25, 42, 'report_declined', 'Report Declined - Revision Required', 'Your report for ABC Restaurant Sdn Bhd (Updated) has been declined. Admin feedback: Please add missing bait station BS-002 and verify chemical quantities.', NULL, '2025-10-14 13:45:45'),
(26, 3, 'report_submitted', 'New Report Submitted', 'Test PCO Dashboard User submitted a report for ABC Restaurant Sdn Bhd (Updated)', NULL, '2025-10-14 13:45:47'),
(27, 3, 'report_submitted', 'New Report Submitted', 'Test PCO Dashboard User submitted a report for ABC Restaurant Sdn Bhd (Updated)', NULL, '2025-10-14 13:46:36'),
(28, 43, 'report_declined', 'Report Declined - Revision Required', 'Your report for ABC Restaurant Sdn Bhd (Updated) has been declined. Admin feedback: Please add missing bait station BS-002 and verify chemical quantities.', NULL, '2025-10-14 13:46:40'),
(29, 3, 'report_submitted', 'New Report Submitted', 'Test PCO Dashboard User submitted a report for ABC Restaurant Sdn Bhd (Updated)', NULL, '2025-10-14 13:46:42'),
(30, 3, 'report_submitted', 'New Report Submitted', 'Test PCO Dashboard User submitted a report for ABC Restaurant Sdn Bhd (Updated)', NULL, '2025-10-14 13:59:14'),
(31, 44, 'report_declined', 'Report Declined - Revision Required', 'Your report for ABC Restaurant Sdn Bhd (Updated) has been declined. Admin feedback: Please add missing bait station BS-002 and verify chemical quantities.', NULL, '2025-10-14 13:59:18'),
(32, 3, 'report_submitted', 'New Report Submitted', 'Test PCO Dashboard User submitted a report for ABC Restaurant Sdn Bhd (Updated)', NULL, '2025-10-14 13:59:20'),
(33, 3, 'report_submitted', 'New Report Submitted', 'Test PCO Dashboard User submitted a report for ABC Restaurant Sdn Bhd (Updated)', NULL, '2025-10-14 14:00:05'),
(34, 45, 'report_declined', 'Report Declined - Revision Required', 'Your report for ABC Restaurant Sdn Bhd (Updated) has been declined. Admin feedback: Please add missing bait station BS-002 and verify chemical quantities.', NULL, '2025-10-14 14:00:10'),
(35, 3, 'report_submitted', 'New Report Submitted', 'Test PCO Dashboard User submitted a report for ABC Restaurant Sdn Bhd (Updated)', NULL, '2025-10-14 14:00:13'),
(36, 3, 'report_submitted', 'New Report Submitted', 'Test PCO Dashboard User submitted a report for ABC Restaurant Sdn Bhd (Updated)', NULL, '2025-10-14 14:01:21'),
(37, 46, 'report_declined', 'Report Declined - Revision Required', 'Your report for ABC Restaurant Sdn Bhd (Updated) has been declined. Admin feedback: Please add missing bait station BS-002 and verify chemical quantities.', NULL, '2025-10-14 14:01:25'),
(38, 3, 'report_submitted', 'New Report Submitted', 'Test PCO Dashboard User submitted a report for ABC Restaurant Sdn Bhd (Updated)', NULL, '2025-10-14 14:01:28'),
(39, 3, 'report_submitted', 'New Report Submitted', 'Test PCO User submitted a report for ABC Restaurant Sdn Bhd (Updated)', NULL, '2025-10-14 14:21:06'),
(40, 47, 'report_declined', 'Report Declined - Revision Required', 'Your report for ABC Restaurant Sdn Bhd (Updated) has been declined. Admin feedback: Please add more detailed bait station remarks and resubmit. Station TEST-001 needs specific pest identification.', NULL, '2025-10-14 14:21:07'),
(41, 3, 'report_submitted', 'New Report Submitted', 'ABC Restaurant Sdn Bhd (Updated): New report submitted by 48 for review', NULL, '2025-10-14 14:26:55'),
(42, 48, 'report_declined', 'Report Declined - Revision Required', 'Your report for ABC Restaurant Sdn Bhd (Updated) has been declined. Admin feedback: Please add more detailed bait station remarks and resubmit. Station TEST-001 needs specific pest identification.', NULL, '2025-10-14 14:26:56'),
(43, 3, 'report_submitted', 'New Report Submitted', 'ABC Restaurant Sdn Bhd (Updated): New report submitted by 48 for review', NULL, '2025-10-14 14:26:57'),
(44, 12, 'system_update', 'Test Notification', 'This is a test notification from automated testing', NULL, '2025-10-16 06:53:33'),
(45, 4, 'system_update', 'Setup Test Notification', 'This notification is created for testing purposes', NULL, '2025-10-16 06:55:43'),
(46, 4, 'system_update', 'Test Notification', 'This is a test notification from automated testing', NULL, '2025-10-16 06:55:44'),
(47, 4, 'system_update', 'Test', 'Test message', NULL, '2025-10-16 06:56:13'),
(48, 87, 'system_update', 'Setup Test Notification', 'This notification is created for testing purposes', '2025-10-16 06:58:15', '2025-10-16 06:58:14'),
(49, 87, 'system_update', 'Setup Test Notification', 'This notification is created for testing purposes', '2025-10-16 07:09:02', '2025-10-16 07:09:01'),
(50, 87, 'system_update', 'Test Notification', 'This is a test notification from automated testing', '2025-10-16 07:58:03', '2025-10-16 07:09:02'),
(51, 87, 'system_update', 'Setup Test Notification', 'This notification is created for testing purposes', '2025-10-16 07:58:03', '2025-10-16 07:58:01'),
(52, 87, 'system_update', 'Test Notification', 'This is a test notification from automated testing', NULL, '2025-10-16 07:58:03');

-- --------------------------------------------------------

--
-- Table structure for table `password_reset_tokens`
--

CREATE TABLE `password_reset_tokens` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `token` varchar(255) NOT NULL,
  `expires_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `used_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `reports`
--

CREATE TABLE `reports` (
  `id` int(11) NOT NULL,
  `client_id` int(11) NOT NULL,
  `pco_id` int(11) NOT NULL,
  `report_type` enum('bait_inspection','fumigation','both') NOT NULL,
  `service_date` date NOT NULL,
  `next_service_date` date DEFAULT NULL,
  `status` enum('draft','pending','approved','declined','archived') NOT NULL DEFAULT 'draft',
  `pco_signature_data` text DEFAULT NULL,
  `client_signature_data` text DEFAULT NULL,
  `client_signature_name` varchar(100) DEFAULT NULL,
  `general_remarks` text DEFAULT NULL COMMENT 'PCO remarks/notes about the service',
  `recommendations` text DEFAULT NULL COMMENT 'Admin-only recommendations for the client',
  `admin_notes` text DEFAULT NULL COMMENT 'Internal admin notes for PCO (decline reasons, etc.)',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `submitted_at` timestamp NULL DEFAULT NULL,
  `reviewed_at` timestamp NULL DEFAULT NULL,
  `reviewed_by` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `reports`
--

INSERT INTO `reports` (`id`, `client_id`, `pco_id`, `report_type`, `service_date`, `next_service_date`, `status`, `pco_signature_data`, `client_signature_data`, `client_signature_name`, `general_remarks`, `recommendations`, `admin_notes`, `created_at`, `updated_at`, `submitted_at`, `reviewed_at`, `reviewed_by`) VALUES
(2, 1, 10, 'both', '2025-10-14', '2025-11-13', 'declined', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'John Test Client', 'Test report with signatures', NULL, 'Please add more detailed bait station remarks and resubmit. Station TEST-001 needs specific pest identification.', '2025-10-14 08:08:36', '2025-10-14 08:08:40', '2025-10-14 08:08:39', '2025-10-14 08:08:40', 7),
(3, 1, 11, 'both', '2025-10-14', '2025-11-13', 'declined', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'John Test Client', 'Test report with signatures', NULL, 'Please add more detailed bait station remarks and resubmit. Station TEST-001 needs specific pest identification.', '2025-10-14 08:10:43', '2025-10-14 08:10:48', '2025-10-14 08:10:46', '2025-10-14 08:10:48', 7),
(4, 1, 12, 'both', '2025-10-14', '2025-11-13', 'approved', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'John Test Client', 'Test report with signatures', NULL, 'Report approved. Good work.', '2025-10-14 08:19:12', '2025-10-14 08:19:17', '2025-10-14 08:19:17', '2025-10-14 08:19:17', 7),
(5, 1, 13, 'both', '2025-10-14', '2025-11-13', 'approved', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'John Test Client', 'Test report with signatures', NULL, 'Report approved. Good work.', '2025-10-14 08:22:51', '2025-10-14 08:22:57', '2025-10-14 08:22:57', '2025-10-14 08:22:57', 7),
(6, 1, 15, 'both', '2025-10-14', '2025-10-28', 'draft', NULL, NULL, NULL, NULL, NULL, NULL, '2025-10-14 09:28:10', '2025-10-14 09:28:10', NULL, NULL, NULL),
(7, 1, 16, 'both', '2025-10-14', '2025-10-28', 'draft', NULL, NULL, NULL, NULL, NULL, NULL, '2025-10-14 09:44:47', '2025-10-14 09:44:47', NULL, NULL, NULL),
(8, 1, 17, 'both', '2025-10-14', '2025-10-28', 'draft', NULL, NULL, NULL, NULL, NULL, NULL, '2025-10-14 09:50:03', '2025-10-14 09:50:03', NULL, NULL, NULL),
(9, 1, 18, 'both', '2025-10-14', '2025-10-28', 'draft', NULL, NULL, NULL, NULL, NULL, NULL, '2025-10-14 09:56:33', '2025-10-14 09:56:33', NULL, NULL, NULL),
(10, 1, 19, 'both', '2025-10-14', '2025-10-28', 'draft', NULL, NULL, NULL, NULL, NULL, NULL, '2025-10-14 09:58:34', '2025-10-14 09:58:34', NULL, NULL, NULL),
(11, 1, 20, 'both', '2025-10-14', '2025-10-28', 'draft', NULL, NULL, NULL, NULL, NULL, NULL, '2025-10-14 10:01:50', '2025-10-14 10:01:50', NULL, NULL, NULL),
(12, 1, 21, 'both', '2025-10-14', '2025-10-28', 'draft', NULL, NULL, NULL, NULL, NULL, NULL, '2025-10-14 10:03:21', '2025-10-14 10:03:21', NULL, NULL, NULL),
(13, 1, 22, 'both', '2025-10-14', '2025-10-28', 'draft', NULL, NULL, NULL, NULL, NULL, NULL, '2025-10-14 10:05:15', '2025-10-14 10:05:15', NULL, NULL, NULL),
(14, 1, 23, 'both', '2025-10-14', '2025-10-28', 'draft', NULL, NULL, NULL, NULL, NULL, NULL, '2025-10-14 10:12:05', '2025-10-14 10:12:05', NULL, NULL, NULL),
(15, 1, 24, 'both', '2025-10-14', '2025-10-28', 'draft', NULL, NULL, NULL, NULL, NULL, NULL, '2025-10-14 10:52:51', '2025-10-14 10:52:51', NULL, NULL, NULL),
(16, 1, 25, 'both', '2025-10-14', '2025-10-28', 'draft', NULL, NULL, NULL, NULL, NULL, NULL, '2025-10-14 10:53:15', '2025-10-14 10:53:15', NULL, NULL, NULL),
(17, 1, 26, 'both', '2025-10-14', '2025-10-28', 'draft', NULL, NULL, NULL, NULL, NULL, NULL, '2025-10-14 10:54:44', '2025-10-14 10:54:44', NULL, NULL, NULL),
(18, 1, 27, 'both', '2025-10-14', '2025-10-28', 'draft', NULL, NULL, NULL, NULL, NULL, NULL, '2025-10-14 10:56:10', '2025-10-14 10:56:10', NULL, NULL, NULL),
(19, 1, 28, 'both', '2025-10-14', '2025-10-28', 'draft', NULL, NULL, NULL, NULL, NULL, NULL, '2025-10-14 12:32:07', '2025-10-14 12:32:07', NULL, NULL, NULL),
(20, 1, 29, 'both', '2025-10-14', '2025-10-28', 'draft', NULL, NULL, NULL, NULL, NULL, NULL, '2025-10-14 12:36:23', '2025-10-14 12:36:23', NULL, NULL, NULL),
(21, 1, 30, 'both', '2025-10-14', '2025-10-28', 'draft', NULL, NULL, NULL, NULL, NULL, NULL, '2025-10-14 12:38:27', '2025-10-14 12:38:27', NULL, NULL, NULL),
(22, 1, 31, 'both', '2025-10-14', '2025-10-28', 'draft', NULL, NULL, NULL, NULL, NULL, NULL, '2025-10-14 12:39:40', '2025-10-14 12:39:40', NULL, NULL, NULL),
(23, 1, 33, 'both', '2025-10-14', '2025-10-28', 'draft', NULL, NULL, NULL, NULL, NULL, NULL, '2025-10-14 12:51:38', '2025-10-14 12:51:38', NULL, NULL, NULL),
(24, 1, 34, 'both', '2025-10-14', '2025-10-28', 'draft', NULL, NULL, NULL, NULL, NULL, NULL, '2025-10-14 12:59:27', '2025-10-14 12:59:27', NULL, NULL, NULL),
(25, 1, 35, 'both', '2025-10-14', '2025-10-28', 'draft', NULL, NULL, NULL, NULL, NULL, NULL, '2025-10-14 12:59:49', '2025-10-14 12:59:49', NULL, NULL, NULL),
(26, 1, 37, 'both', '2025-10-14', '2025-10-28', 'pending', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'John Doe', 'Test complete', NULL, NULL, '2025-10-14 13:15:27', '2025-10-14 13:18:27', '2025-10-14 13:18:27', NULL, NULL),
(27, 1, 38, 'both', '2025-10-14', '2025-10-28', 'pending', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'John Doe', 'Routine inspection completed', NULL, 'Please add missing bait station BS-002 and verify chemical quantities.', '2025-10-14 13:24:25', '2025-10-14 13:24:31', '2025-10-14 13:24:31', '2025-10-14 13:24:29', 7),
(28, 1, 39, 'both', '2025-10-14', '2025-10-28', 'pending', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'John Doe', 'Routine inspection completed', NULL, 'Please add missing bait station BS-002 and verify chemical quantities.', '2025-10-14 13:26:26', '2025-10-14 13:26:33', '2025-10-14 13:26:33', '2025-10-14 13:26:30', 7),
(29, 1, 40, 'both', '2025-10-14', '2025-10-28', 'pending', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'John Doe', 'Routine inspection completed', NULL, 'Please add missing bait station BS-002 and verify chemical quantities.', '2025-10-14 13:27:26', '2025-10-14 13:27:32', '2025-10-14 13:27:32', '2025-10-14 13:27:30', 7),
(30, 1, 41, 'both', '2025-10-14', '2025-10-28', 'pending', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'John Doe', 'Routine inspection completed', NULL, 'Please add missing bait station BS-002 and verify chemical quantities.', '2025-10-14 13:32:21', '2025-10-14 13:32:28', '2025-10-14 13:32:28', '2025-10-14 13:32:25', 7),
(31, 1, 42, 'both', '2025-10-14', '2025-10-28', 'pending', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'John Doe', 'Routine inspection completed', NULL, 'Please add missing bait station BS-002 and verify chemical quantities.', '2025-10-14 13:45:40', '2025-10-14 13:45:47', '2025-10-14 13:45:47', '2025-10-14 13:45:45', 7),
(32, 1, 43, 'both', '2025-10-14', '2025-10-28', 'pending', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'John Doe', 'Routine inspection completed', NULL, 'Please add missing bait station BS-002 and verify chemical quantities.', '2025-10-14 13:46:35', '2025-10-14 13:46:42', '2025-10-14 13:46:42', '2025-10-14 13:46:40', 7),
(33, 1, 44, 'both', '2025-10-14', '2025-10-28', 'pending', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'John Doe', 'Routine inspection completed', NULL, 'Please add missing bait station BS-002 and verify chemical quantities.', '2025-10-14 13:59:14', '2025-10-14 13:59:20', '2025-10-14 13:59:20', '2025-10-14 13:59:18', 7),
(34, 1, 45, 'both', '2025-10-14', '2025-10-28', 'approved', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'John Doe', 'Routine inspection completed', NULL, NULL, '2025-10-14 14:00:03', '2025-10-14 14:00:13', '2025-10-14 14:00:13', '2025-10-14 14:00:13', 7),
(35, 1, 46, 'both', '2025-10-14', '2025-10-28', 'approved', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'John Doe', 'Routine inspection completed', NULL, NULL, '2025-10-14 14:01:21', '2025-10-14 14:01:28', '2025-10-14 14:01:28', '2025-10-14 14:01:28', 7),
(36, 1, 47, 'both', '2025-10-14', '2025-11-13', 'declined', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'John Test Client', 'Trying to edit submitted report', NULL, 'Please add more detailed bait station remarks and resubmit. Station TEST-001 needs specific pest identification.', '2025-10-14 14:21:02', '2025-10-14 14:21:09', '2025-10-14 14:21:06', '2025-10-14 14:21:07', 7),
(37, 1, 48, 'both', '2025-10-14', '2025-11-13', 'approved', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'John Test Client', 'Test report with signatures', NULL, 'Report approved. Good work.', '2025-10-14 14:26:52', '2025-10-14 14:26:57', '2025-10-14 14:26:57', '2025-10-14 14:26:57', 7),
(38, 1, 57, '', '2025-10-15', NULL, 'draft', 'data:image/png;base64,test', 'data:image/png;base64,test', 'Duplicate Test', NULL, NULL, NULL, '2025-10-15 08:20:38', '2025-10-15 08:20:38', NULL, NULL, NULL),
(39, 1, 59, '', '2025-10-15', NULL, 'draft', 'data:image/png;base64,test', 'data:image/png;base64,test', 'Duplicate Test', NULL, NULL, NULL, '2025-10-15 08:29:01', '2025-10-15 08:29:01', NULL, NULL, NULL),
(40, 1, 61, '', '2025-10-15', NULL, 'draft', 'data:image/png;base64,test', 'data:image/png;base64,test', 'Duplicate Test', NULL, NULL, NULL, '2025-10-15 09:03:25', '2025-10-15 09:03:25', NULL, NULL, NULL),
(41, 1, 63, '', '2025-10-15', NULL, 'draft', 'data:image/png;base64,test', 'data:image/png;base64,test', 'Duplicate Test', NULL, NULL, NULL, '2025-10-15 12:07:33', '2025-10-15 12:07:33', NULL, NULL, NULL),
(42, 1, 65, '', '2025-10-15', NULL, 'draft', 'data:image/png;base64,test', 'data:image/png;base64,test', 'Duplicate Test', NULL, NULL, NULL, '2025-10-15 12:41:52', '2025-10-15 12:41:52', NULL, NULL, NULL),
(43, 1, 67, '', '2025-10-15', NULL, 'draft', 'data:image/png;base64,test', 'data:image/png;base64,test', 'Duplicate Test', NULL, NULL, NULL, '2025-10-15 12:43:52', '2025-10-15 12:43:52', NULL, NULL, NULL),
(44, 1, 70, '', '2025-10-15', NULL, 'draft', 'data:image/png;base64,test', 'data:image/png;base64,test', 'Duplicate Test', NULL, NULL, NULL, '2025-10-15 12:47:24', '2025-10-15 12:47:24', NULL, NULL, NULL),
(45, 1, 72, '', '2025-10-15', NULL, 'draft', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'Test Client', 'Test upload from offline', NULL, NULL, '2025-10-15 12:51:53', '2025-10-15 12:51:53', NULL, NULL, NULL),
(46, 1, 75, 'bait_inspection', '2025-10-14', NULL, 'draft', NULL, NULL, NULL, NULL, NULL, NULL, '2025-10-15 12:56:26', '2025-10-15 12:56:26', NULL, NULL, NULL),
(47, 1, 81, 'bait_inspection', '2025-10-14', NULL, 'draft', NULL, NULL, NULL, NULL, NULL, NULL, '2025-10-15 12:59:48', '2025-10-15 12:59:48', NULL, NULL, NULL),
(48, 1, 81, 'bait_inspection', '2025-10-15', NULL, 'draft', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'Test Client', 'Test upload from offline', NULL, NULL, '2025-10-15 12:59:53', '2025-10-15 12:59:53', NULL, NULL, NULL),
(49, 1, 83, 'bait_inspection', '2025-10-14', NULL, 'draft', NULL, NULL, NULL, NULL, NULL, NULL, '2025-10-15 13:00:07', '2025-10-15 13:00:07', NULL, NULL, NULL),
(50, 1, 85, 'bait_inspection', '2025-10-14', NULL, 'draft', NULL, NULL, NULL, NULL, NULL, NULL, '2025-10-15 13:10:04', '2025-10-15 13:10:04', NULL, NULL, NULL),
(51, 1, 85, 'bait_inspection', '2025-10-15', NULL, 'draft', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'Test Client', 'Test upload from offline', NULL, NULL, '2025-10-15 13:10:10', '2025-10-15 13:10:10', NULL, NULL, NULL),
(52, 1, 88, 'bait_inspection', '2025-10-14', NULL, 'draft', NULL, NULL, NULL, NULL, NULL, NULL, '2025-10-15 13:12:17', '2025-10-15 13:12:17', NULL, NULL, NULL),
(53, 1, 88, 'bait_inspection', '2025-10-15', NULL, 'draft', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'Test Client', 'Test upload from offline', NULL, NULL, '2025-10-15 13:12:22', '2025-10-15 13:12:22', NULL, NULL, NULL),
(54, 2, 88, 'fumigation', '2025-10-13', NULL, 'draft', 'data:image/png;base64,test', 'data:image/png;base64,test', 'Batch Test 2', NULL, NULL, NULL, '2025-10-15 13:12:23', '2025-10-15 13:12:23', NULL, NULL, NULL),
(55, 1, 90, 'bait_inspection', '2025-10-14', NULL, 'draft', NULL, NULL, NULL, NULL, NULL, NULL, '2025-10-15 13:14:35', '2025-10-15 13:14:35', NULL, NULL, NULL),
(56, 1, 90, 'bait_inspection', '2025-10-15', NULL, 'draft', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'Test Client', 'Test upload from offline', NULL, NULL, '2025-10-15 13:14:40', '2025-10-15 13:14:40', NULL, NULL, NULL),
(57, 2, 90, 'fumigation', '2025-10-13', NULL, 'draft', 'data:image/png;base64,test', 'data:image/png;base64,test', 'Batch Test 2', NULL, NULL, NULL, '2025-10-15 13:14:41', '2025-10-15 13:14:41', NULL, NULL, NULL),
(58, 1, 93, 'bait_inspection', '2025-10-14', NULL, 'draft', 'data:image/png;base64,test', 'data:image/png;base64,test', 'Test Client', NULL, NULL, NULL, '2025-10-15 13:26:38', '2025-10-15 13:26:38', NULL, NULL, NULL),
(59, 1, 93, 'bait_inspection', '2025-10-13', NULL, 'draft', 'data:image/png;base64,test', 'data:image/png;base64,test', 'Test Client', NULL, NULL, NULL, '2025-10-15 13:26:38', '2025-10-15 13:26:38', NULL, NULL, NULL),
(60, 1, 93, 'bait_inspection', '2025-10-12', NULL, 'draft', 'data:image/png;base64,test', 'data:image/png;base64,test', 'Test Client', NULL, NULL, NULL, '2025-10-15 13:26:38', '2025-10-15 13:26:38', NULL, NULL, NULL),
(61, 1, 93, 'bait_inspection', '2025-10-15', NULL, 'draft', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'Test Client', 'Test upload from offline', NULL, NULL, '2025-10-15 13:26:44', '2025-10-15 13:26:44', NULL, NULL, NULL),
(62, 2, 93, 'fumigation', '2025-10-13', NULL, 'draft', 'data:image/png;base64,test', 'data:image/png;base64,test', 'Batch Test 2', NULL, NULL, NULL, '2025-10-15 13:26:44', '2025-10-15 13:26:44', NULL, NULL, NULL),
(63, 2, 87, 'both', '2025-10-14', NULL, 'draft', 'data:image/png;base64,test', NULL, NULL, NULL, NULL, NULL, '2025-10-15 16:02:43', '2025-10-15 16:02:43', NULL, NULL, NULL),
(64, 1, 95, 'bait_inspection', '2025-10-15', NULL, 'draft', 'data:image/png;base64,test', 'data:image/png;base64,test', 'Duplicate Test', NULL, NULL, NULL, '2025-10-15 16:17:12', '2025-10-15 16:17:12', NULL, NULL, NULL),
(65, 1, 97, 'bait_inspection', '2025-10-14', NULL, 'draft', 'data:image/png;base64,test', 'data:image/png;base64,test', 'Test Client', NULL, NULL, NULL, '2025-10-15 16:29:10', '2025-10-15 16:29:10', NULL, NULL, NULL),
(66, 1, 97, 'bait_inspection', '2025-10-13', NULL, 'draft', 'data:image/png;base64,test', 'data:image/png;base64,test', 'Test Client', NULL, NULL, NULL, '2025-10-15 16:29:10', '2025-10-15 16:29:10', NULL, NULL, NULL),
(67, 1, 97, 'bait_inspection', '2025-10-12', NULL, 'draft', 'data:image/png;base64,test', 'data:image/png;base64,test', 'Test Client', NULL, NULL, NULL, '2025-10-15 16:29:10', '2025-10-15 16:29:10', NULL, NULL, NULL),
(68, 1, 97, 'bait_inspection', '2025-10-15', NULL, 'draft', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'Test Client', 'Test upload from offline', NULL, NULL, '2025-10-15 16:29:15', '2025-10-15 16:29:15', NULL, NULL, NULL),
(69, 2, 97, 'fumigation', '2025-10-13', NULL, 'draft', 'data:image/png;base64,test', 'data:image/png;base64,test', 'Batch Test 2', NULL, NULL, NULL, '2025-10-15 16:29:16', '2025-10-15 16:29:16', NULL, NULL, NULL),
(70, 1, 99, 'both', '2025-10-14', '2025-10-28', 'draft', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'John Doe', 'Routine inspection completed', NULL, NULL, '2025-10-16 07:58:35', '2025-10-16 07:58:35', NULL, NULL, NULL),
(71, 1, 100, 'both', '2025-10-14', '2025-10-28', 'draft', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'John Doe', 'Routine inspection completed', NULL, NULL, '2025-10-16 08:27:30', '2025-10-16 08:27:30', NULL, NULL, NULL),
(72, 1, 101, 'both', '2025-10-14', '2025-10-28', 'draft', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'John Doe', 'Routine inspection completed', NULL, NULL, '2025-10-16 08:41:47', '2025-10-16 08:41:48', NULL, NULL, NULL);

-- --------------------------------------------------------

--
-- Stand-in structure for view `report_summary`
-- (See below for the actual view)
--
CREATE TABLE `report_summary` (
`id` int(11)
,`service_date` date
,`status` enum('draft','pending','approved','declined','archived')
,`report_type` enum('bait_inspection','fumigation','both')
,`client_name` varchar(200)
,`pco_name` varchar(100)
,`pco_number` varchar(20)
,`created_at` timestamp
,`submitted_at` timestamp
);

-- --------------------------------------------------------

--
-- Table structure for table `report_versions`
--

CREATE TABLE `report_versions` (
  `id` int(11) NOT NULL,
  `report_id` int(11) NOT NULL,
  `version_number` int(11) NOT NULL DEFAULT 1,
  `changed_by` int(11) NOT NULL,
  `changes_summary` text DEFAULT NULL,
  `version_data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`version_data`)),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `station_chemicals`
--

CREATE TABLE `station_chemicals` (
  `id` int(11) NOT NULL,
  `station_id` int(11) NOT NULL,
  `chemical_id` int(11) NOT NULL,
  `quantity` decimal(10,2) NOT NULL,
  `batch_number` varchar(50) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `station_chemicals`
--

INSERT INTO `station_chemicals` (`id`, `station_id`, `chemical_id`, `quantity`, `batch_number`, `created_at`) VALUES
(3, 5, 5, 25.50, 'TEST-BATCH-001', '2025-10-14 08:08:37'),
(4, 7, 5, 25.50, 'TEST-BATCH-001', '2025-10-14 08:10:44'),
(5, 9, 5, 25.50, 'TEST-BATCH-001', '2025-10-14 08:19:13'),
(6, 11, 5, 25.50, 'TEST-BATCH-001', '2025-10-14 08:22:52'),
(7, 25, 5, 25.50, 'TEST-BATCH-001', '2025-10-14 14:21:03'),
(8, 27, 5, 25.50, 'TEST-BATCH-001', '2025-10-14 14:26:53'),
(9, 29, 5, 50.00, 'BATCH001', '2025-10-15 12:51:53'),
(10, 30, 5, 50.00, 'BATCH001', '2025-10-15 12:59:53'),
(11, 31, 5, 50.00, 'BATCH001', '2025-10-15 13:10:10'),
(12, 32, 5, 50.00, 'BATCH001', '2025-10-15 13:12:22'),
(13, 33, 5, 50.00, 'BATCH001', '2025-10-15 13:14:40'),
(14, 37, 5, 50.00, 'BATCH001', '2025-10-15 13:26:44'),
(15, 38, 5, 25.50, NULL, '2025-10-15 16:02:43'),
(16, 42, 5, 50.00, 'BATCH001', '2025-10-15 16:29:15');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `pco_number` varchar(20) NOT NULL,
  `name` varchar(100) NOT NULL,
  `email` varchar(100) NOT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` enum('admin','pco','both') NOT NULL DEFAULT 'pco',
  `status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` timestamp NULL DEFAULT NULL,
  `failed_login_attempts` int(11) DEFAULT 0,
  `locked_until` timestamp NULL DEFAULT NULL,
  `account_locked_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `pco_number`, `name`, `email`, `phone`, `password_hash`, `role`, `status`, `created_at`, `updated_at`, `deleted_at`, `failed_login_attempts`, `locked_until`, `account_locked_at`) VALUES
(3, 'admin12345', 'Admin User', 'admin@kpspest.com', '1234567890', '$2a$12$LbFx8.BSFZixZ3HnU92W1e1C0ne18e82Llv7JinU3KV3gV801liVG', 'admin', 'active', '2025-10-10 16:53:41', '2025-10-10 16:56:40', NULL, 0, NULL, NULL),
(4, 'pco11111', 'PCO User', 'pco@kpspest.com', '0987654321', '$2a$12$LbFx8.BSFZixZ3HnU92W1e1C0ne18e82Llv7JinU3KV3gV801liVG', 'pco', 'active', '2025-10-10 16:53:41', '2025-10-15 07:34:52', NULL, 0, NULL, NULL),
(7, '12345', 'Admin User', 'admin@kpspestcontrol.co.za', '+27123456789', '$2a$12$dE0UqR9S8hXS.BCJUPWv9.SOgpyBn4zFLiNMENbM9hk6GVXcTHiDy', 'admin', 'active', '2025-10-10 17:04:40', '2025-10-16 09:53:52', NULL, 0, NULL, NULL),
(8, '67890', 'John PCO', 'pco@kpspestcontrol.co.za', '+27987654321', '$2a$12$LbFx8.BSFZixZ3HnU92W1e1C0ne18e82Llv7JinU3KV3gV801liVG', 'pco', 'active', '2025-10-10 17:04:40', '2025-10-16 10:02:32', NULL, 2, NULL, NULL),
(9, '447527861', 'Updated Test User', 'testpco@example.com', '555-9999', '$2b$10$tN3.QQX00AbEXWNDL0viROzHNM0xLEV6J/3sBvXN2kWDoi67hIEnG', 'pco', 'inactive', '2025-10-11 10:44:07', '2025-10-11 10:45:33', '2025-10-11 10:45:33', 0, NULL, NULL),
(10, '10865', 'Test PCO User', 'testpco10865@test.com', '+1234567890', '$2b$10$qSeZpYUp9QPGKybfeuVmHusBQtZZ1rIm2nbkAbka.64qJjIAR/B9S', 'pco', 'active', '2025-10-14 08:08:35', '2025-10-14 08:08:35', NULL, 0, NULL, NULL),
(11, '34843', 'Test PCO User', 'testpco34843@test.com', '+1234567890', '$2b$10$muwv0yeITNSe4XH.SKfs2eVw56ZP0NCru.SaqknvCOrdVvmitrXvG', 'pco', 'active', '2025-10-14 08:10:41', '2025-10-14 08:10:41', NULL, 0, NULL, NULL),
(12, '27661', 'Test PCO User', 'testpco27661@test.com', '+1234567890', '$2b$10$72FfucyXhha7vFnxJZ3QA.99CvRCarVZ5xH3DGuVjWepITipQFewi', 'pco', 'active', '2025-10-14 08:19:10', '2025-10-14 08:19:10', NULL, 0, NULL, NULL),
(13, '16615', 'Test PCO User', 'testpco16615@test.com', '+1234567890', '$2b$10$QUaRfYw2Ih2UJM9J8LTZiOg2yg76hEXfihwxkiUKEk8.KnB3Tm0OG', 'pco', 'active', '2025-10-14 08:22:49', '2025-10-14 08:22:49', NULL, 0, NULL, NULL),
(14, '25969', 'Test PCO Dashboard User', 'testpco25969@test.com', '+1234567890', '$2b$10$ltk72I6n4gGLiHAu2Q3zqeb0OdsbZFFg.elQ0IhPvaw4K0tsZIQVS', 'pco', 'active', '2025-10-14 09:14:39', '2025-10-14 09:14:39', NULL, 0, NULL, NULL),
(15, '21976', 'Test PCO Dashboard User', 'testpco21976@test.com', '+1234567890', '$2b$10$Jj.6NWeBYDZXN04YhcJRUuu7OsY8fr8C5rojDOY6rI50c1rN/yS.6', 'pco', 'active', '2025-10-14 09:28:07', '2025-10-14 09:28:07', NULL, 0, NULL, NULL),
(16, '15740', 'Test PCO Dashboard User', 'testpco15740@test.com', '+1234567890', '$2b$10$4131qdkTXHjsVeaIDUuqWeGDW/gCJsn4Nb9fUSVHYkjiEt2KgFXx2', 'pco', 'active', '2025-10-14 09:44:45', '2025-10-14 09:44:45', NULL, 0, NULL, NULL),
(17, '35761', 'Test PCO Dashboard User', 'testpco35761@test.com', '+1234567890', '$2b$10$3OgoxV/28t7YqvfK1NnHjumYxXfLWgmQCQiSCPvhuhJ/FfK5xSmJK', 'pco', 'active', '2025-10-14 09:50:00', '2025-10-14 09:50:00', NULL, 0, NULL, NULL),
(18, '28305', 'Test PCO Dashboard User', 'testpco28305@test.com', '+1234567890', '$2b$10$W7F69OZlcHJcJwnzkGCQFe3FreSgaQFzo40l/0DmSl.jZEd/2NWoS', 'pco', 'active', '2025-10-14 09:56:31', '2025-10-14 09:56:31', NULL, 0, NULL, NULL),
(19, '26447', 'Test PCO Dashboard User', 'testpco26447@test.com', '+1234567890', '$2b$10$iRFHlCqleQmjA3rHPfdAru2jez2lNcdDGOAQ/YeWQSBc.gtEWD3ku', 'pco', 'active', '2025-10-14 09:58:31', '2025-10-14 09:58:31', NULL, 0, NULL, NULL),
(20, '38538', 'Test PCO Dashboard User', 'testpco38538@test.com', '+1234567890', '$2b$10$a7FJpNlJkz34ksHp5Alws.KrnOPIIOraWup8BuvsyoqOSpArDQ8GS', 'pco', 'active', '2025-10-14 10:01:48', '2025-10-14 10:01:48', NULL, 0, NULL, NULL),
(21, '42444', 'Test PCO Dashboard User', 'testpco42444@test.com', '+1234567890', '$2b$10$oXfsImVEldh82C3E5txgAOBCxm9cnFcyUlwBwPjIQtHP2FbaDwfkG', 'pco', 'active', '2025-10-14 10:03:19', '2025-10-14 10:03:19', NULL, 0, NULL, NULL),
(22, '35436', 'Test PCO Dashboard User', 'testpco35436@test.com', '+1234567890', '$2b$10$vB5mF4qGNl4ugGuRJqVMjuCcE9PbHmdGCzCUCoG1OM/4.aX5HkON6', 'pco', 'active', '2025-10-14 10:05:13', '2025-10-14 10:05:13', NULL, 0, NULL, NULL),
(23, '35425', 'Test PCO Dashboard User', 'testpco35425@test.com', '+1234567890', '$2b$10$h4uMouScbo5kLRhr1aOFO.HghBjYWutNmGc4kR6XU43SIWXAyHXfS', 'pco', 'active', '2025-10-14 10:12:02', '2025-10-14 10:12:02', NULL, 0, NULL, NULL),
(24, '10680', 'Test PCO Dashboard User', 'testpco10680@test.com', '+1234567890', '$2b$10$GBlT0dpdz/ptZkkGcj5EpOQjQJZue1dgxkuf.oBo9OAbTOc5H8fhG', 'pco', 'active', '2025-10-14 10:52:49', '2025-10-14 10:52:49', NULL, 0, NULL, NULL),
(25, '13639', 'Test PCO Dashboard User', 'testpco13639@test.com', '+1234567890', '$2b$10$zaNfcU6vRKUeQ37M5qKY7ukkAdxpxUuWorpwpuAgUuau03eRGbZiC', 'pco', 'active', '2025-10-14 10:53:12', '2025-10-14 10:53:12', NULL, 0, NULL, NULL),
(26, '28310', 'Test PCO Dashboard User', 'testpco28310@test.com', '+1234567890', '$2b$10$VCdCZTN5mEwHzfOvudvs6.icEPH6D5t6vuwbOQlodtqpmd0.53lnm', 'pco', 'active', '2025-10-14 10:54:42', '2025-10-14 10:54:42', NULL, 0, NULL, NULL),
(27, '13533', 'Test PCO Dashboard User', 'testpco13533@test.com', '+1234567890', '$2b$10$/B3J9Ooo3ASrNJ.3K2zGEOAgmV.5.uhUapDkh3Koif8LHlUipSIxG', 'pco', 'active', '2025-10-14 10:56:08', '2025-10-14 10:56:08', NULL, 0, NULL, NULL),
(28, '37611', 'Test PCO Dashboard User', 'testpco37611@test.com', '+1234567890', '$2b$10$/GkFIA1rgktCMdapIvQhaeIhuhsSMDpk3aqzlrN9J2aOOXAtAmr7K', 'pco', 'active', '2025-10-14 12:32:05', '2025-10-14 12:32:05', NULL, 0, NULL, NULL),
(29, '36213', 'Test PCO Dashboard User', 'testpco36213@test.com', '+1234567890', '$2b$10$9S8dlr9MyDYZFVIgAmCi8e9kv.ICTIDm6mFznf7RcscAECTIOJSIm', 'pco', 'active', '2025-10-14 12:36:21', '2025-10-14 12:36:21', NULL, 0, NULL, NULL),
(30, '31696', 'Test PCO Dashboard User', 'testpco31696@test.com', '+1234567890', '$2b$10$K613LkXdPviSNBTbr0Kza.8wwpkvYCPrJundgE.MOPDMuVR5dUk3C', 'pco', 'active', '2025-10-14 12:38:25', '2025-10-14 12:38:25', NULL, 0, NULL, NULL),
(31, '13850', 'Test PCO Dashboard User', 'testpco13850@test.com', '+1234567890', '$2b$10$pzBEBHvxthuhHxigXfZO7O9W7lAGfkmW1fwLoPeYqzb5M2sllq5Mq', 'pco', 'active', '2025-10-14 12:39:38', '2025-10-14 12:39:38', NULL, 0, NULL, NULL),
(32, '41463', 'Test PCO Dashboard User', 'testpco41463@test.com', '+1234567890', '$2b$10$wWXfz3A57gifiA.a8OJNtOD0l6adeQBcdfC62JrP43Qu.Z.5kAe4u', 'pco', 'active', '2025-10-14 12:51:14', '2025-10-14 12:51:14', NULL, 0, NULL, NULL),
(33, '30885', 'Test PCO Dashboard User', 'testpco30885@test.com', '+1234567890', '$2b$10$g4laOOA91NPL5AgroaKMvO1ibRkqkOYgJEmlrosQXi2WNhfQoquGO', 'pco', 'active', '2025-10-14 12:51:35', '2025-10-14 12:51:35', NULL, 0, NULL, NULL),
(34, '20133', 'Test PCO Dashboard User', 'testpco20133@test.com', '+1234567890', '$2b$10$3Rli5xzf9Jw6ptLA6..WS.PxBHgKCw/xZeVmslCk7s33.4Ch7NXsa', 'pco', 'active', '2025-10-14 12:59:25', '2025-10-14 12:59:25', NULL, 0, NULL, NULL),
(35, '24200', 'Test PCO Dashboard User', 'testpco24200@test.com', '+1234567890', '$2b$10$YgvmNaKzf5cCtwl5qJVqdOK13veCf4MVIGUPVN/N3mBxKenVTzlim', 'pco', 'active', '2025-10-14 12:59:46', '2025-10-14 12:59:46', NULL, 0, NULL, NULL),
(36, 'TEST999', 'Test PCO Manual', 'testpco999@example.com', '1234567890', '$2b$10$MZk2Mzm74Yyhtn5kxCxxXe8J1Pu6XDZd/WPMKPwq9gqh3iDexhi4C', 'pco', 'active', '2025-10-14 13:09:13', '2025-10-14 13:09:13', NULL, 0, NULL, NULL),
(37, '88888', 'Manual Test PCO', 'manualtest@example.com', '1234567890', '$2b$10$Te9VB6/VHVQkBUOIhHKxjerrLsgY/zzr.inPxIWnSiY7v760Ni43m', 'pco', 'active', '2025-10-14 13:11:05', '2025-10-14 13:11:05', NULL, 0, NULL, NULL),
(38, '27566', 'Test PCO Dashboard User', 'testpco27566@test.com', '+1234567890', '$2b$10$FlGPRUX1TImB7wsaeYdhZu0xvcgSuDyqlkEkN6Wd8jqypqgAVAGxq', 'pco', 'active', '2025-10-14 13:24:23', '2025-10-14 13:24:23', NULL, 0, NULL, NULL),
(39, '20196', 'Test PCO Dashboard User', 'testpco20196@test.com', '+1234567890', '$2b$10$JxrZArMcgQ8bu.1ZhnG5m.koi4v7CogxNLBOcFWwj2/Q7kXB/Ro3q', 'pco', 'active', '2025-10-14 13:26:24', '2025-10-14 13:26:24', NULL, 0, NULL, NULL),
(40, '37755', 'Test PCO Dashboard User', 'testpco37755@test.com', '+1234567890', '$2b$10$ChnnJw0R3alH9ccIvboiBe6LH9x5sY7AAObkMIdUeUmU0EOVyPW8G', 'pco', 'active', '2025-10-14 13:27:24', '2025-10-14 13:27:24', NULL, 0, NULL, NULL),
(41, '11843', 'Test PCO Dashboard User', 'testpco11843@test.com', '+1234567890', '$2b$10$sV7NKb8ciwJR5O/DJ4wVbuB1Jy0C2t/MPdJTwL5UsR9z6qBQc6vbS', 'pco', 'active', '2025-10-14 13:32:18', '2025-10-14 13:32:18', NULL, 0, NULL, NULL),
(42, '28005', 'Test PCO Dashboard User', 'testpco28005@test.com', '+1234567890', '$2b$10$AdvOPxLfemmjmvjmIz6ZDeg7JZP3kxOX4RdWUZz7v9vZ7LkyxI6ZK', 'pco', 'active', '2025-10-14 13:45:35', '2025-10-14 13:48:42', NULL, 2, NULL, NULL),
(43, '40801', 'Test PCO Dashboard User', 'testpco40801@test.com', '+1234567890', '$2b$10$aSJ1OJR.X2Vn/s./lBB.rOubk8De5VXT./DauYQa5J1/Ynr/DoVLS', 'pco', 'active', '2025-10-14 13:46:34', '2025-10-14 13:49:28', NULL, 1, NULL, NULL),
(44, '37309', 'Test PCO Dashboard User', 'testpco37309@test.com', '+1234567890', '$2b$10$tFKBavZZljB/BYXaWGmldemQYxsbQbAMJsJwOywAC7xpXUpT3ACB.', 'pco', 'active', '2025-10-14 13:59:11', '2025-10-14 13:59:11', NULL, 0, NULL, NULL),
(45, '41616', 'Test PCO Dashboard User', 'testpco41616@test.com', '+1234567890', '$2b$10$44416WoYscy8LrNueg3Al.Cl/h6hHkVSNeNDLtS/5W3hrsqysk6m6', 'pco', 'active', '2025-10-14 14:00:00', '2025-10-14 14:00:00', NULL, 0, NULL, NULL),
(46, '40407', 'Test PCO Dashboard User', 'testpco40407@test.com', '+1234567890', '$2b$10$iVWqw1YD4R9YUdIqQ5mi9.E4sZDNAFwkoA4osRfvI5hPpRBRdpyo.', 'pco', 'active', '2025-10-14 14:01:18', '2025-10-14 14:01:18', NULL, 0, NULL, NULL),
(47, '24853', 'Test PCO User', 'testpco24853@test.com', '+1234567890', '$2b$10$pvwFzOyNcyJYeHb2xPqtA.jRLCPVfx.bMEBRU7qaYsnz8BSJBMVP2', 'pco', 'active', '2025-10-14 14:21:00', '2025-10-14 14:21:00', NULL, 0, NULL, NULL),
(48, '42027', 'Test PCO User', 'testpco42027@test.com', '+1234567890', '$2b$10$Q6IPcvQndIJ/ksL7Rd2x8e6kvEQAETtp6f/6nD.vn5hGpzHa.SKCy', 'pco', 'active', '2025-10-14 14:26:50', '2025-10-14 14:26:50', NULL, 0, NULL, NULL),
(49, '11094', 'Test PCO Sync User 1', 'testpco11094@test.com', '+1234567890', '$2b$10$J2NsrSXDEdmJUYzBdi1PsuPke7jQJamx5E3J30ASpo/zD/hKQggy.', 'pco', 'active', '2025-10-15 07:35:47', '2025-10-15 07:35:47', NULL, 0, NULL, NULL),
(50, '11104', 'Test PCO Sync User 2', 'testpco11104@test.com', '+1234567890', '$2b$10$AN/E1rMYNQxFHl452efcPOOunHAoAf7utIC7xksoHljgdBW/Mth5G', 'pco', 'active', '2025-10-15 07:35:49', '2025-10-15 07:35:49', NULL, 0, NULL, NULL),
(51, '14653', 'Test PCO Sync User 1', 'testpco14653@test.com', '+1234567890', '$2b$10$Sqj9FyTC7VJM2eJ8ADp/Cu9b8jNeP8/tpkQ0FmuojqmLzHLMj59fa', 'pco', 'active', '2025-10-15 07:40:46', '2025-10-15 07:40:46', NULL, 0, NULL, NULL),
(52, '38129', 'Test PCO Sync User 2', 'testpco38129@test.com', '+1234567890', '$2b$10$fZkVYSuM/6R2qAAZrQiGFOPYvHmric0ucc/Fwu7I3qemwMOS0WLTW', 'pco', 'active', '2025-10-15 07:40:46', '2025-10-15 07:40:46', NULL, 0, NULL, NULL),
(53, '31827', 'Test PCO Sync User 1', 'testpco31827@test.com', '+1234567890', '$2b$10$SJ0Tc9dCPJW2EkeLlvgjx.VKk7FXHZmW9XaPck3b8Ihh43lS0AdzS', 'pco', 'active', '2025-10-15 08:16:13', '2025-10-15 08:16:13', NULL, 0, NULL, NULL),
(54, '15524', 'Test PCO Sync User 2', 'testpco15524@test.com', '+1234567890', '$2b$10$aOCxxumOKhP0w9egl.zXpOybnjYLzpE.ahtAJwFa/EfkNG0OowKry', 'pco', 'active', '2025-10-15 08:16:13', '2025-10-15 08:16:13', NULL, 0, NULL, NULL),
(55, '31656', 'Test PCO Sync User 1', 'testpco31656@test.com', '+1234567890', '$2b$10$vQa8VeigAEd4/CYZHPQNFeb02WWOnKHhw68360QtwtrpFMr8/NXKW', 'pco', 'active', '2025-10-15 08:18:58', '2025-10-15 08:18:58', NULL, 0, NULL, NULL),
(56, '37561', 'Test PCO Sync User 2', 'testpco37561@test.com', '+1234567890', '$2b$10$8qytO4xT3l/PAdkAVFLx4OWCxFg65yDu.jafYiee9ztaVV/o1BF/C', 'pco', 'active', '2025-10-15 08:18:59', '2025-10-15 08:18:59', NULL, 0, NULL, NULL),
(57, '28632', 'Test PCO Sync User 1', 'testpco28632@test.com', '+1234567890', '$2b$10$gUGgkTlLHq9fgTGbNWyR0uHQv1BL1yiCAtM/M1j55BFUSuMbzGQ86', 'pco', 'active', '2025-10-15 08:20:29', '2025-10-15 08:20:29', NULL, 0, NULL, NULL),
(58, '20079', 'Test PCO Sync User 2', 'testpco20079@test.com', '+1234567890', '$2b$10$9DPbnG87p1grxwC7JjhUouq4TcPOSz3my2jRmwH2dymhjQMYsUZsq', 'pco', 'active', '2025-10-15 08:20:29', '2025-10-15 08:20:29', NULL, 0, NULL, NULL),
(59, '27631', 'Test PCO Sync User 1', 'testpco27631@test.com', '+1234567890', '$2b$10$VKiJPj9zIkWjgAf5PQyv8efWMVkM/AT1V2zlhg4m.8uUMpepjT1jm', 'pco', 'active', '2025-10-15 08:28:51', '2025-10-15 08:28:51', NULL, 0, NULL, NULL),
(60, '27742', 'Test PCO Sync User 2', 'testpco27742@test.com', '+1234567890', '$2b$10$BTyNRDqFoAdyrx/EMU6Fh.xtIOWIHP.H1VVgTZXoH7RFbMYWfbewy', 'pco', 'active', '2025-10-15 08:28:52', '2025-10-15 08:28:52', NULL, 0, NULL, NULL),
(61, '24006', 'Test PCO Sync User 1', 'testpco24006@test.com', '+1234567890', '$2b$10$fjRL9w5wVyzXl7uJt9/uR.rqf9W/MfCXF/0jezwkerQGsHHqdEFcq', 'pco', 'active', '2025-10-15 09:03:13', '2025-10-15 09:03:13', NULL, 0, NULL, NULL),
(62, '28693', 'Test PCO Sync User 2', 'testpco28693@test.com', '+1234567890', '$2b$10$MeYuzjWHupPp61kzMfZ87uI7Q3xF9uPwdnvCdjjIlU7Q6TONRI5Au', 'pco', 'active', '2025-10-15 09:03:14', '2025-10-15 09:03:14', NULL, 0, NULL, NULL),
(63, '21922', 'Test PCO Sync User 1', 'testpco21922@test.com', '+1234567890', '$2b$10$0.xxteLyNcRRe.kdKuJR3uMG8oE3NZY7k3F3UxWfki2w3pcZm1D62', 'pco', 'active', '2025-10-15 12:07:23', '2025-10-15 12:07:23', NULL, 0, NULL, NULL),
(64, '33772', 'Test PCO Sync User 2', 'testpco33772@test.com', '+1234567890', '$2b$10$9vd4sfSbqpIP/EuZYcqOye.CZMVe.G.zMK3Rpzrw.wa9oCwJY01.u', 'pco', 'active', '2025-10-15 12:07:23', '2025-10-15 12:07:23', NULL, 0, NULL, NULL),
(65, '23410', 'Test PCO Sync User 1', 'testpco23410@test.com', '+1234567890', '$2b$10$4yKOECdf8pV1mxip7EzTPOo0X77OpXRjxXhdntmjZyYgf4sL8QsNG', 'pco', 'active', '2025-10-15 12:41:43', '2025-10-15 12:41:43', NULL, 0, NULL, NULL),
(66, '13032', 'Test PCO Sync User 2', 'testpco13032@test.com', '+1234567890', '$2b$10$RUhfXkvr4MQ40KaYQBLgcewy4TtSj08.ngiRZOA7DBHZS.Uwu7s.a', 'pco', 'active', '2025-10-15 12:41:43', '2025-10-15 12:41:43', NULL, 0, NULL, NULL),
(67, '25985', 'Test PCO Sync User 1', 'testpco25985@test.com', '+1234567890', '$2b$10$sxpW93dZryOjJvMUrcAOVOe9rESMRDsyLvBmFB0wiRRaVF5f0eCsO', 'pco', 'active', '2025-10-15 12:43:44', '2025-10-15 12:43:44', NULL, 0, NULL, NULL),
(68, '33222', 'Test PCO Sync User 2', 'testpco33222@test.com', '+1234567890', '$2b$10$J6B8OFv1Abbw20aknzqZP.Yv8GlbhJNw1WssD/C8Fw1XXErcov0rS', 'pco', 'active', '2025-10-15 12:43:44', '2025-10-15 12:43:44', NULL, 0, NULL, NULL),
(69, '55555', 'Test', 'test55555@test.com', '+1234567890', '$2b$10$ChTQMAlfbF52lQ81g5vq3eH5huhtARQ/4G9bvHECYhYkuAj2O2WRK', 'pco', 'active', '2025-10-15 12:44:24', '2025-10-15 12:44:24', NULL, 0, NULL, NULL),
(70, '25208', 'Test PCO Sync User 1', 'testpco25208@test.com', '+1234567890', '$2b$10$xKnY2oteuQ0dOVukYiNxD.JxWb5e1ae1O44bcAm5E58fw1xbev37C', 'pco', 'active', '2025-10-15 12:47:15', '2025-10-15 12:47:15', NULL, 0, NULL, NULL),
(71, '17318', 'Test PCO Sync User 2', 'testpco17318@test.com', '+1234567890', '$2b$10$.5PWpbZSXFmYEYG/sw5uPeGowokXBecLv1ZYBE8pjVY98sPfx94Y.', 'pco', 'active', '2025-10-15 12:47:16', '2025-10-15 12:47:16', NULL, 0, NULL, NULL),
(72, '22467', 'Test PCO Sync User 1', 'testpco22467@test.com', '+1234567890', '$2b$10$OzJ1JUqyJGXOLb1iA42TTeVGbfqFh3JWSjkRFjsaxiCrnc398Xuga', 'pco', 'active', '2025-10-15 12:51:45', '2025-10-15 12:51:45', NULL, 0, NULL, NULL),
(73, '23857', 'Test PCO Sync User 2', 'testpco23857@test.com', '+1234567890', '$2b$10$mCuuKwtbLP8kXptGqxrlXOgDsT6JXrQ9ZQ/M4sLFHcj5kMxZZa4J6', 'pco', 'active', '2025-10-15 12:51:45', '2025-10-15 12:51:45', NULL, 0, NULL, NULL),
(74, '44444', 'Test', 'test44444@test.com', '+1234567890', '$2b$10$ywjt6VccZS68JUCD2oOrree2NxmtstF1GjR5X03yQuHShkaJzjLuC', 'pco', 'active', '2025-10-15 12:53:43', '2025-10-15 12:53:43', NULL, 0, NULL, NULL),
(75, '21825', 'Test PCO Sync User 1', 'testpco21825@test.com', '+1234567890', '$2b$10$PhPNCx8nK5zmzgW4Fn8SNOj.Aq4fO7jqh/jISskRYX0k72up2WJXG', 'pco', 'active', '2025-10-15 12:56:24', '2025-10-15 12:56:24', NULL, 0, NULL, NULL),
(76, '15908', 'Test PCO Sync User 2', 'testpco15908@test.com', '+1234567890', '$2b$10$aFvkfFmGtI1o1HpVcwymE.FW8.yCrzdvhSAosph2fZc9YwML3nHPe', 'pco', 'active', '2025-10-15 12:56:24', '2025-10-15 12:56:24', NULL, 0, NULL, NULL),
(77, '33333', 'Test', 'test33333@test.com', '+1234567890', '$2b$10$RgQw.QA6dC22phxN7UUpkeuu1NUo1MGWhDYMAo/fmHsFTNzwB15su', 'pco', 'active', '2025-10-15 12:57:01', '2025-10-15 12:57:01', NULL, 0, NULL, NULL),
(78, '22222', 'Test', 'test22222@test.com', '+1234567890', '$2b$10$/zk2rpRDlPVYpo7eGX9l6urHSD3vQCTUOZXqrrlumCov1/ZFHTdO6', 'pco', 'active', '2025-10-15 12:57:23', '2025-10-15 12:57:23', NULL, 0, NULL, NULL),
(79, '18098', 'Test PCO Sync User 1', 'testpco18098@test.com', '+1234567890', '$2b$10$v2jWnmSIYtRO03vW5AJ.3utXqo20zeplZf9XH8EuLlf907.K5QcpO', 'pco', 'active', '2025-10-15 12:58:52', '2025-10-15 12:58:52', NULL, 0, NULL, NULL),
(80, '23456', 'Test PCO Sync User 2', 'testpco23456@test.com', '+1234567890', '$2b$10$JdgglH3/NrvF3CUay67dL.iE4ft7peUOKEHzyhaWM272Vcg73sEj6', 'pco', 'active', '2025-10-15 12:58:52', '2025-10-15 12:58:52', NULL, 0, NULL, NULL),
(81, '26389', 'Test PCO Sync User 1', 'testpco26389@test.com', '+1234567890', '$2b$10$X2mcN10HbCNGzWTV14/hf.3kD7wLvry3hOnLcsB.KrlQ7OjEo2H0O', 'pco', 'active', '2025-10-15 12:59:46', '2025-10-15 12:59:46', NULL, 0, NULL, NULL),
(82, '36343', 'Test PCO Sync User 2', 'testpco36343@test.com', '+1234567890', '$2b$10$Gh/QHKi6equtruIZqI4kSeSubTud.sLLsNEyvx2LQNtB3vGxEhfs2', 'pco', 'active', '2025-10-15 12:59:46', '2025-10-15 12:59:46', NULL, 0, NULL, NULL),
(83, '41563', 'Test PCO Sync User 1', 'testpco41563@test.com', '+1234567890', '$2b$10$InyI.IurK/cs5sesUXI5DusLLRoVZlBiApK8AiAykBrN74I18CzT6', 'pco', 'active', '2025-10-15 13:00:05', '2025-10-15 13:00:05', NULL, 0, NULL, NULL),
(84, '23723', 'Test PCO Sync User 2', 'testpco23723@test.com', '+1234567890', '$2b$10$yE7xsEVdjGMzyiFMF/.jZu.1E2XmV/QLqkIcNgGfFvGhqVV/.TUIK', 'pco', 'active', '2025-10-15 13:00:05', '2025-10-15 13:00:05', NULL, 0, NULL, NULL),
(85, '30037', 'Test PCO Sync User 1', 'testpco30037@test.com', '+1234567890', '$2b$10$mwjuYm1HksOX8Kor9akzPO0odpnF/Su9iRjbmzGz5WJoiuMrCW2V.', 'pco', 'active', '2025-10-15 13:10:02', '2025-10-15 13:10:02', NULL, 0, NULL, NULL),
(86, '32711', 'Test PCO Sync User 2', 'testpco32711@test.com', '+1234567890', '$2b$10$jt4EC.Uz1tP2hZYhqPYu9eh6FqALnpilnQSIP505pfE2ryvBqVRYq', 'pco', 'active', '2025-10-15 13:10:02', '2025-10-15 13:10:02', NULL, 0, NULL, NULL),
(87, '11111', 'Test', 'test11111@test.com', '+1234567890', '$2b$12$mT85hvPDhznyCFYPG0LHVuN8ER7sQLRLc0/qYGqqxt4SAXgsrvdJi', 'pco', 'active', '2025-10-15 13:10:46', '2025-10-16 06:38:12', NULL, 0, NULL, NULL),
(88, '26414', 'Test PCO Sync User 1', 'testpco26414@test.com', '+1234567890', '$2b$10$X0BarzCdwnpkSu87ob3oz.nl5cHqHZVQ2Tk4zLZeFLxRXhr8EZcNO', 'pco', 'active', '2025-10-15 13:12:14', '2025-10-15 13:12:14', NULL, 0, NULL, NULL),
(89, '15721', 'Test PCO Sync User 2', 'testpco15721@test.com', '+1234567890', '$2b$10$CQO5.RV3DUZ3U0QmbI/mSOniCHWjvAXTBJI0eqVtwuCxqm5keCQeu', 'pco', 'active', '2025-10-15 13:12:15', '2025-10-15 13:12:15', NULL, 0, NULL, NULL),
(90, '37942', 'Test PCO Sync User 1', 'testpco37942@test.com', '+1234567890', '$2b$10$k0MDfIjVRd5BDH8y4aav9.nH3LzGW8roU9.6AUYl..T5ymUAAPG62', 'pco', 'active', '2025-10-15 13:14:32', '2025-10-15 13:14:32', NULL, 0, NULL, NULL),
(91, '20273', 'Test PCO Sync User 2', 'testpco20273@test.com', '+1234567890', '$2b$10$a5.83aXR0j1iffunGiymBeRUB.aqaRoe1b1iq5ZP1nniQtVYtL9hG', 'pco', 'active', '2025-10-15 13:14:33', '2025-10-15 13:14:33', NULL, 0, NULL, NULL),
(92, '99999', 'Test PCO', 'test99999@test.com', '+1234567890', '$2b$10$NgsPQj2E.6YdKJ0DG1GtweDbWaRKAVEeXFqwUPhYeq.wdt9ic7OzW', 'pco', 'active', '2025-10-15 13:15:56', '2025-10-15 13:15:56', NULL, 0, NULL, NULL),
(93, '37484', 'Test PCO Sync User 1', 'testpco37484@test.com', '+1234567890', '$2b$10$W.lap5vFkja4dg6s/wxCW.vZhD.JqH9PQcIPKckf4uueUoyNE0dgi', 'pco', 'active', '2025-10-15 13:26:36', '2025-10-15 13:26:36', NULL, 0, NULL, NULL),
(94, '38906', 'Test PCO Sync User 2', 'testpco38906@test.com', '+1234567890', '$2b$10$G4fegqjEK1VFOylRDiupw.jz/YjjjMCRPpDJPp1hFKigqGcN1grrC', 'pco', 'active', '2025-10-15 13:26:36', '2025-10-15 13:26:36', NULL, 0, NULL, NULL),
(95, '12563', 'Test PCO Sync User 1', 'testpco12563@test.com', '+1234567890', '$2b$10$jnN09UOjiEAnhgr3vA/9su0P.31XzJam9wRp3a0KuqtIKnVJm.dNu', 'pco', 'active', '2025-10-15 16:17:03', '2025-10-15 16:17:03', NULL, 0, NULL, NULL),
(96, '20104', 'Test PCO Sync User 2', 'testpco20104@test.com', '+1234567890', '$2b$10$YlmQvgywSxzam0Eu.E3H0OvFk4MGOppo0bq.JwveYks7Cr9h867fW', 'pco', 'active', '2025-10-15 16:17:04', '2025-10-15 16:17:04', NULL, 0, NULL, NULL),
(97, '11376', 'Test PCO Sync User 1', 'testpco11376@test.com', '+1234567890', '$2b$10$oa1dMatzr57hodcSGhKr0uWgzVc7iEXVikZsf9rlhZgNiVv4tN3bq', 'pco', 'active', '2025-10-15 16:29:08', '2025-10-15 16:29:08', NULL, 0, NULL, NULL),
(98, '36765', 'Test PCO Sync User 2', 'testpco36765@test.com', '+1234567890', '$2b$10$tYGTIKn7rck/C5z7srsJT.6COPWt/u79Mp3GlKuuxR/N4UxPCgqUC', 'pco', 'active', '2025-10-15 16:29:08', '2025-10-15 16:29:08', NULL, 0, NULL, NULL),
(99, '25880', 'Test PCO Dashboard User', 'testpco25880@test.com', '+1234567890', '$2b$10$jC4K9J2rOwG6sJLUQwinP.J31FWpCRhZ8fJHsX51RlEaHuwXAdu2W', 'pco', 'active', '2025-10-16 07:58:33', '2025-10-16 07:58:33', NULL, 0, NULL, NULL),
(100, '30648', 'Test PCO Dashboard User', 'testpco30648@test.com', '+1234567890', '$2b$10$36BuUup9j/0yotM9uYu.NORtT.RQT5Q0Oveg/W5Dn5DyMYHdZELwy', 'pco', 'active', '2025-10-16 08:27:26', '2025-10-16 08:27:26', NULL, 0, NULL, NULL),
(101, '18239', 'Test PCO Dashboard User', 'testpco18239@test.com', '+1234567890', '$2b$10$zIuvltxFBOXsPDo9TIt3a.n421AHtYmPc/T3OSqbvaQNB370fPSUC', 'pco', 'active', '2025-10-16 08:41:44', '2025-10-16 08:41:44', NULL, 0, NULL, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `user_sessions`
--

CREATE TABLE `user_sessions` (
  `id` varchar(128) NOT NULL,
  `user_id` int(11) NOT NULL,
  `role_context` enum('admin','pco') NOT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `last_activity` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `expires_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `user_sessions`
--

INSERT INTO `user_sessions` (`id`, `user_id`, `role_context`, `ip_address`, `user_agent`, `last_activity`, `expires_at`, `created_at`) VALUES
('03d3d5de27474cbda9137c4bccea91d1', 7, 'admin', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36', '2025-10-16 10:44:18', '2025-10-17 09:53:52', '2025-10-16 09:53:52'),
('07ef99a1866e42b098669f85585efb7b', 87, 'pco', '::1', 'curl/8.12.1', '2025-10-16 07:09:04', '2025-10-17 07:08:57', '2025-10-16 07:08:57'),
('0bd2b645bfe34880b7dd158f4fd7cb98', 7, 'admin', '::1', 'curl/8.12.1', '2025-10-16 08:41:56', '2025-10-17 08:41:44', '2025-10-16 08:41:44'),
('0c0473b231574df697d957751f8b0a28', 7, 'admin', '::1', 'curl/8.12.1', '2025-10-16 08:27:42', '2025-10-17 08:27:26', '2025-10-16 08:27:26'),
('25b3088db2374aeba3a27721ae00b4bd', 7, 'admin', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36', '2025-10-16 09:53:33', '2025-10-17 09:53:33', '2025-10-16 09:53:33'),
('292f69633f944763a482727cbb481dd3', 7, 'admin', '::1', 'curl/8.12.1', '2025-10-16 09:23:07', '2025-10-17 09:23:07', '2025-10-16 09:23:07'),
('39f111b797fe4b97a36c5f79819ceb50', 7, 'admin', '::1', 'curl/8.12.1', '2025-10-16 07:58:04', '2025-10-17 07:57:53', '2025-10-16 07:57:53'),
('3b0a79fd5bf34044a2c4419389422e5e', 7, 'admin', '::1', 'curl/8.12.1', '2025-10-16 07:58:24', '2025-10-17 07:58:17', '2025-10-16 07:58:17'),
('4549ac1b13e84881b297b3066120e357', 7, 'admin', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36', '2025-10-16 09:25:11', '2025-10-17 09:25:11', '2025-10-16 09:25:11'),
('595d3bbcdafe4eb0b10ed1ae07088549', 99, 'pco', '::1', 'curl/8.12.1', '2025-10-16 07:58:41', '2025-10-17 07:58:33', '2025-10-16 07:58:33'),
('6704a14aec7d432ea69a471c24ccb181', 101, 'pco', '::1', 'curl/8.12.1', '2025-10-16 08:41:56', '2025-10-17 08:41:45', '2025-10-16 08:41:45'),
('729eda8b866048a5bf0c50a4ff0b43dd', 100, 'pco', '::1', 'curl/8.12.1', '2025-10-16 08:27:42', '2025-10-17 08:27:27', '2025-10-16 08:27:27'),
('7960499ceb984ef5a0d95f6de17fdd73', 7, 'admin', '::1', 'curl/8.12.1', '2025-10-16 07:09:03', '2025-10-17 07:08:57', '2025-10-16 07:08:57'),
('821c4a220e274d19929313381ee146b2', 7, 'admin', '::1', 'curl/8.12.1', '2025-10-16 09:22:15', '2025-10-17 09:22:15', '2025-10-16 09:22:15'),
('b60e8611753948caa2950f87268e987f', 7, 'admin', '::1', 'curl/8.12.1', '2025-10-16 09:58:15', '2025-10-17 09:58:06', '2025-10-16 09:58:06'),
('b6bc355155004952a1f61ce6c8131f0c', 7, 'admin', '::1', 'curl/8.12.1', '2025-10-16 07:58:39', '2025-10-17 07:58:32', '2025-10-16 07:58:32'),
('b702201e050947519fd7e1f6450a186b', 7, 'admin', '::1', 'curl/8.12.1', '2025-10-16 07:57:44', '2025-10-17 07:57:43', '2025-10-16 07:57:43'),
('c72588047bab48508b0c4b6508cf17ff', 87, 'pco', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0', '2025-10-16 08:51:03', '2025-10-17 08:51:03', '2025-10-16 08:51:03'),
('d34855a6002f4bc6ab34bbebb2f66dd4', 7, 'admin', '::1', 'curl/8.12.1', '2025-10-16 08:14:32', '2025-10-17 08:14:32', '2025-10-16 08:14:32'),
('e9b5c0143fd248cd9bed19dff3cb33bb', 87, 'pco', '::1', 'curl/8.12.1', '2025-10-16 07:58:06', '2025-10-17 07:57:53', '2025-10-16 07:57:53'),
('edb82f1a88984be283b81d2de43acb4a', 87, 'pco', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0', '2025-10-16 08:50:51', '2025-10-17 08:50:51', '2025-10-16 08:50:51'),
('ee10040b1c1d45a8a7a6f1e6282f4b1e', 87, 'pco', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0', '2025-10-16 08:20:18', '2025-10-17 08:20:18', '2025-10-16 08:20:18');

-- --------------------------------------------------------

--
-- Structure for view `active_client_assignments`
--
DROP TABLE IF EXISTS `active_client_assignments`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `active_client_assignments`  AS SELECT `c`.`id` AS `client_id`, `c`.`company_name` AS `company_name`, `c`.`address_line1` AS `address_line1`, `c`.`city` AS `city`, `u`.`id` AS `pco_id`, `u`.`name` AS `pco_name`, `u`.`pco_number` AS `pco_number`, `ca`.`assigned_at` AS `assigned_at` FROM ((`clients` `c` join `client_pco_assignments` `ca` on(`c`.`id` = `ca`.`client_id`)) join `users` `u` on(`ca`.`pco_id` = `u`.`id`)) WHERE `ca`.`status` = 'active' AND `c`.`status` = 'active' AND `u`.`status` = 'active' ;

-- --------------------------------------------------------

--
-- Structure for view `report_summary`
--
DROP TABLE IF EXISTS `report_summary`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `report_summary`  AS SELECT `r`.`id` AS `id`, `r`.`service_date` AS `service_date`, `r`.`status` AS `status`, `r`.`report_type` AS `report_type`, `c`.`company_name` AS `client_name`, `u`.`name` AS `pco_name`, `u`.`pco_number` AS `pco_number`, `r`.`created_at` AS `created_at`, `r`.`submitted_at` AS `submitted_at` FROM ((`reports` `r` join `clients` `c` on(`r`.`client_id` = `c`.`id`)) join `users` `u` on(`r`.`pco_id` = `u`.`id`)) ORDER BY `r`.`created_at` DESC ;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `app_versions`
--
ALTER TABLE `app_versions`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `audit_logs`
--
ALTER TABLE `audit_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_audit_user_created` (`user_id`,`created_at`),
  ADD KEY `idx_audit_entity` (`entity_type`,`entity_id`),
  ADD KEY `idx_audit_action_created` (`action`,`created_at`);

--
-- Indexes for table `bait_stations`
--
ALTER TABLE `bait_stations`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_station_per_report` (`report_id`,`location`,`station_number`),
  ADD KEY `idx_stations_report` (`report_id`),
  ADD KEY `idx_stations_location` (`report_id`,`location`),
  ADD KEY `idx_stations_number_location` (`station_number`,`location`);

--
-- Indexes for table `chemicals`
--
ALTER TABLE `chemicals`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_chemicals_usage_status` (`usage_type`,`status`),
  ADD KEY `idx_chemicals_name_status` (`name`,`status`),
  ADD KEY `idx_chemicals_status_created` (`status`,`created_at`);

--
-- Indexes for table `clients`
--
ALTER TABLE `clients`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_clients_status` (`status`),
  ADD KEY `idx_clients_company_name` (`company_name`),
  ADD KEY `idx_clients_city_state` (`city`,`state`),
  ADD KEY `idx_clients_search_text` (`company_name`,`city`,`state`);

--
-- Indexes for table `client_contacts`
--
ALTER TABLE `client_contacts`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_client_email` (`client_id`,`email`),
  ADD KEY `idx_contacts_client_primary` (`client_id`,`is_primary`),
  ADD KEY `idx_contacts_email` (`email`),
  ADD KEY `idx_contacts_name` (`name`);

--
-- Indexes for table `client_last_report_cache`
--
ALTER TABLE `client_last_report_cache`
  ADD PRIMARY KEY (`client_id`),
  ADD KEY `last_report_id` (`last_report_id`),
  ADD KEY `idx_last_service_date` (`last_service_date`);

--
-- Indexes for table `client_pco_assignments`
--
ALTER TABLE `client_pco_assignments`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_active_assignment` (`client_id`,`status`),
  ADD KEY `assigned_by` (`assigned_by`),
  ADD KEY `unassigned_by` (`unassigned_by`),
  ADD KEY `idx_assignments_pco_active` (`pco_id`,`status`),
  ADD KEY `idx_assignments_client_active` (`client_id`,`status`),
  ADD KEY `idx_assignments_status_assigned` (`status`,`assigned_at`);

--
-- Indexes for table `dashboard_cache`
--
ALTER TABLE `dashboard_cache`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_cache_key` (`cache_key`),
  ADD KEY `idx_expires` (`expires_at`);

--
-- Indexes for table `file_uploads`
--
ALTER TABLE `file_uploads`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_user_status` (`user_id`,`status`),
  ADD KEY `idx_created_at` (`created_at`);

--
-- Indexes for table `fumigation_areas`
--
ALTER TABLE `fumigation_areas`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_fumigation_areas_report` (`report_id`);

--
-- Indexes for table `fumigation_chemicals`
--
ALTER TABLE `fumigation_chemicals`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_fumigation_chemicals_report` (`report_id`),
  ADD KEY `idx_fumigation_chemicals_chemical` (`chemical_id`);

--
-- Indexes for table `fumigation_target_pests`
--
ALTER TABLE `fumigation_target_pests`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_fumigation_pests_report` (`report_id`);

--
-- Indexes for table `insect_monitors`
--
ALTER TABLE `insect_monitors`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_monitors_report` (`report_id`),
  ADD KEY `idx_monitors_type` (`report_id`,`monitor_type`);

--
-- Indexes for table `login_attempts`
--
ALTER TABLE `login_attempts`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_pco_number` (`pco_number`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_ip_address` (`ip_address`),
  ADD KEY `idx_attempt_time` (`attempt_time`);

--
-- Indexes for table `notifications`
--
ALTER TABLE `notifications`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_notifications_user_read` (`user_id`,`read_at`),
  ADD KEY `idx_notifications_user_created` (`user_id`,`created_at`),
  ADD KEY `idx_notifications_type_created` (`type`,`created_at`);

--
-- Indexes for table `password_reset_tokens`
--
ALTER TABLE `password_reset_tokens`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `idx_token` (`token`),
  ADD KEY `idx_expires` (`expires_at`);

--
-- Indexes for table `reports`
--
ALTER TABLE `reports`
  ADD PRIMARY KEY (`id`),
  ADD KEY `reviewed_by` (`reviewed_by`),
  ADD KEY `idx_reports_client_pco` (`client_id`,`pco_id`),
  ADD KEY `idx_reports_status_date` (`status`,`service_date`),
  ADD KEY `idx_reports_pco_status` (`pco_id`,`status`),
  ADD KEY `idx_reports_client_status` (`client_id`,`status`),
  ADD KEY `idx_reports_type_date` (`report_type`,`service_date`),
  ADD KEY `idx_reports_created_status` (`created_at`,`status`),
  ADD KEY `idx_reports_next_service` (`next_service_date`,`status`),
  ADD KEY `idx_reports_submitted_date` (`submitted_at`);

--
-- Indexes for table `report_versions`
--
ALTER TABLE `report_versions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_report_version` (`report_id`,`version_number`),
  ADD KEY `changed_by` (`changed_by`),
  ADD KEY `idx_report_version` (`report_id`,`version_number`);

--
-- Indexes for table `station_chemicals`
--
ALTER TABLE `station_chemicals`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_station_chemicals_station` (`station_id`),
  ADD KEY `idx_station_chemicals_chemical` (`chemical_id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `pco_number` (`pco_number`),
  ADD UNIQUE KEY `email` (`email`),
  ADD KEY `idx_users_pco_number` (`pco_number`),
  ADD KEY `idx_users_role_status` (`role`,`status`),
  ADD KEY `idx_users_email` (`email`),
  ADD KEY `idx_users_status_created` (`status`,`created_at`);

--
-- Indexes for table `user_sessions`
--
ALTER TABLE `user_sessions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_user_role` (`user_id`,`role_context`),
  ADD KEY `idx_expires` (`expires_at`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `app_versions`
--
ALTER TABLE `app_versions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `audit_logs`
--
ALTER TABLE `audit_logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `bait_stations`
--
ALTER TABLE `bait_stations`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=43;

--
-- AUTO_INCREMENT for table `chemicals`
--
ALTER TABLE `chemicals`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `clients`
--
ALTER TABLE `clients`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `client_contacts`
--
ALTER TABLE `client_contacts`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `client_pco_assignments`
--
ALTER TABLE `client_pco_assignments`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=93;

--
-- AUTO_INCREMENT for table `dashboard_cache`
--
ALTER TABLE `dashboard_cache`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `file_uploads`
--
ALTER TABLE `file_uploads`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `fumigation_areas`
--
ALTER TABLE `fumigation_areas`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=39;

--
-- AUTO_INCREMENT for table `fumigation_chemicals`
--
ALTER TABLE `fumigation_chemicals`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=26;

--
-- AUTO_INCREMENT for table `fumigation_target_pests`
--
ALTER TABLE `fumigation_target_pests`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=33;

--
-- AUTO_INCREMENT for table `insect_monitors`
--
ALTER TABLE `insect_monitors`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=16;

--
-- AUTO_INCREMENT for table `login_attempts`
--
ALTER TABLE `login_attempts`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=356;

--
-- AUTO_INCREMENT for table `notifications`
--
ALTER TABLE `notifications`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=53;

--
-- AUTO_INCREMENT for table `password_reset_tokens`
--
ALTER TABLE `password_reset_tokens`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `reports`
--
ALTER TABLE `reports`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=73;

--
-- AUTO_INCREMENT for table `report_versions`
--
ALTER TABLE `report_versions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `station_chemicals`
--
ALTER TABLE `station_chemicals`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=17;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=102;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `audit_logs`
--
ALTER TABLE `audit_logs`
  ADD CONSTRAINT `audit_logs_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `bait_stations`
--
ALTER TABLE `bait_stations`
  ADD CONSTRAINT `bait_stations_ibfk_1` FOREIGN KEY (`report_id`) REFERENCES `reports` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `client_contacts`
--
ALTER TABLE `client_contacts`
  ADD CONSTRAINT `client_contacts_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `client_last_report_cache`
--
ALTER TABLE `client_last_report_cache`
  ADD CONSTRAINT `client_last_report_cache_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `client_last_report_cache_ibfk_2` FOREIGN KEY (`last_report_id`) REFERENCES `reports` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `client_pco_assignments`
--
ALTER TABLE `client_pco_assignments`
  ADD CONSTRAINT `client_pco_assignments_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `client_pco_assignments_ibfk_2` FOREIGN KEY (`pco_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `client_pco_assignments_ibfk_3` FOREIGN KEY (`assigned_by`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `client_pco_assignments_ibfk_4` FOREIGN KEY (`unassigned_by`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `file_uploads`
--
ALTER TABLE `file_uploads`
  ADD CONSTRAINT `file_uploads_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `fumigation_areas`
--
ALTER TABLE `fumigation_areas`
  ADD CONSTRAINT `fumigation_areas_ibfk_1` FOREIGN KEY (`report_id`) REFERENCES `reports` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `fumigation_chemicals`
--
ALTER TABLE `fumigation_chemicals`
  ADD CONSTRAINT `fumigation_chemicals_ibfk_1` FOREIGN KEY (`report_id`) REFERENCES `reports` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fumigation_chemicals_ibfk_2` FOREIGN KEY (`chemical_id`) REFERENCES `chemicals` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `fumigation_target_pests`
--
ALTER TABLE `fumigation_target_pests`
  ADD CONSTRAINT `fumigation_target_pests_ibfk_1` FOREIGN KEY (`report_id`) REFERENCES `reports` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `insect_monitors`
--
ALTER TABLE `insect_monitors`
  ADD CONSTRAINT `insect_monitors_ibfk_1` FOREIGN KEY (`report_id`) REFERENCES `reports` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `login_attempts`
--
ALTER TABLE `login_attempts`
  ADD CONSTRAINT `login_attempts_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `notifications`
--
ALTER TABLE `notifications`
  ADD CONSTRAINT `notifications_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `password_reset_tokens`
--
ALTER TABLE `password_reset_tokens`
  ADD CONSTRAINT `password_reset_tokens_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `reports`
--
ALTER TABLE `reports`
  ADD CONSTRAINT `reports_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `reports_ibfk_2` FOREIGN KEY (`pco_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `reports_ibfk_3` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `report_versions`
--
ALTER TABLE `report_versions`
  ADD CONSTRAINT `report_versions_ibfk_1` FOREIGN KEY (`report_id`) REFERENCES `reports` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `report_versions_ibfk_2` FOREIGN KEY (`changed_by`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `station_chemicals`
--
ALTER TABLE `station_chemicals`
  ADD CONSTRAINT `station_chemicals_ibfk_1` FOREIGN KEY (`station_id`) REFERENCES `bait_stations` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `station_chemicals_ibfk_2` FOREIGN KEY (`chemical_id`) REFERENCES `chemicals` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `user_sessions`
--
ALTER TABLE `user_sessions`
  ADD CONSTRAINT `user_sessions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
