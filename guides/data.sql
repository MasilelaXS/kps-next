-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Oct 14, 2025 at 03:50 PM
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

INSERT INTO `bait_stations` (`id`, `report_id`, `station_number`, `location`, `is_accessible`, `inaccessible_reason`, `activity_detected`, `activity_droppings`, `activity_gnawing`, `activity_tracks`, `activity_other`, `activity_other_description`, `bait_status`, `station_condition`, `rodent_box_replaced`, `station_remarks`, `created_at`, `updated_at`) VALUES
(5, 2, 'TEST-001', 'inside', 1, NULL, 1, 1, 0, 0, 0, NULL, 'clean', 'good', 1, 'Updated test station', '2025-10-14 08:08:37', '2025-10-14 08:08:37'),
(6, 2, 'TEST-002', 'outside', 0, 'Locked gate', 0, 0, 0, 0, 0, NULL, 'clean', 'good', 0, NULL, '2025-10-14 08:08:37', '2025-10-14 08:08:37'),
(7, 3, 'TEST-001', 'inside', 1, NULL, 1, 1, 0, 0, 0, NULL, 'clean', 'good', 1, 'Updated test station', '2025-10-14 08:10:44', '2025-10-14 08:10:44'),
(8, 3, 'TEST-002', 'outside', 0, 'Locked gate', 0, 0, 0, 0, 0, NULL, 'clean', 'good', 0, NULL, '2025-10-14 08:10:44', '2025-10-14 08:10:44'),
(9, 4, 'TEST-001', 'inside', 1, NULL, 1, 1, 0, 0, 0, NULL, 'clean', 'good', 1, 'Updated test station', '2025-10-14 08:19:13', '2025-10-14 08:19:13'),
(10, 4, 'TEST-002', 'outside', 0, 'Locked gate', 0, 0, 0, 0, 0, NULL, 'clean', 'good', 0, NULL, '2025-10-14 08:19:13', '2025-10-14 08:19:13'),
(11, 5, 'TEST-001', 'inside', 1, NULL, 1, 1, 0, 0, 0, NULL, 'clean', 'good', 1, 'Updated test station', '2025-10-14 08:22:52', '2025-10-14 08:22:52'),
(12, 5, 'TEST-002', 'outside', 0, 'Locked gate', 0, 0, 0, 0, 0, NULL, 'clean', 'good', 0, NULL, '2025-10-14 08:22:52', '2025-10-14 08:22:52'),
(13, 24, 'BS-001', 'inside', 1, NULL, 0, 0, 0, 0, 0, NULL, 'clean', 'good', 0, NULL, '2025-10-14 12:59:27', '2025-10-14 12:59:27'),
(14, 25, 'BS-001', 'inside', 1, NULL, 0, 0, 0, 0, 0, NULL, 'clean', 'good', 0, NULL, '2025-10-14 12:59:49', '2025-10-14 12:59:49'),
(15, 26, 'BS-001', 'inside', 1, NULL, 0, 0, 0, 0, 0, NULL, 'clean', 'good', 0, NULL, '2025-10-14 13:16:26', '2025-10-14 13:16:26'),
(16, 27, 'BS-001', 'inside', 1, NULL, 0, 0, 0, 0, 0, NULL, 'clean', 'good', 0, NULL, '2025-10-14 13:24:25', '2025-10-14 13:24:25'),
(17, 28, 'BS-001', 'inside', 1, NULL, 0, 0, 0, 0, 0, NULL, 'clean', 'good', 0, NULL, '2025-10-14 13:26:26', '2025-10-14 13:26:26'),
(18, 29, 'BS-001', 'inside', 1, NULL, 0, 0, 0, 0, 0, NULL, 'clean', 'good', 0, NULL, '2025-10-14 13:27:27', '2025-10-14 13:27:27'),
(19, 30, 'BS-001', 'inside', 1, NULL, 0, 0, 0, 0, 0, NULL, 'clean', 'good', 0, NULL, '2025-10-14 13:32:21', '2025-10-14 13:32:21'),
(20, 31, 'BS-001', 'inside', 1, NULL, 0, 0, 0, 0, 0, NULL, 'clean', 'good', 0, NULL, '2025-10-14 13:45:41', '2025-10-14 13:45:41'),
(21, 32, 'BS-001', 'inside', 1, NULL, 0, 0, 0, 0, 0, NULL, 'clean', 'good', 0, NULL, '2025-10-14 13:46:36', '2025-10-14 13:46:36');

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
  `status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `service_notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `clients`
--

INSERT INTO `clients` (`id`, `company_name`, `address_line1`, `address_line2`, `city`, `state`, `postal_code`, `country`, `status`, `service_notes`, `created_at`, `updated_at`, `deleted_at`) VALUES
(1, 'ABC Restaurant Sdn Bhd (Updated)', '123 Jalan Maju', NULL, 'Kuala Lumpur', 'Selangor', '50001', 'South Africa', 'active', NULL, '2025-10-10 14:51:22', '2025-10-13 06:37:41', NULL),
(2, 'XYZ Food Court', '456 Lorong Makanan', NULL, 'Petaling Jaya', 'Selangor', '47000', 'South Africa', 'active', NULL, '2025-10-10 14:51:22', '2025-10-10 14:51:22', NULL),
(3, 'Metro Supermarket', '789 Jalan Besar', NULL, 'Shah Alam', 'Selangor', '40000', 'South Africa', 'active', NULL, '2025-10-10 14:51:22', '2025-10-10 14:51:22', NULL);

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
(1, 32, '2025-10-14', '{}', '2025-10-14 13:46:42');

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
(13, 2, 8, '2025-10-13 14:00:52', 7, '2025-10-13 14:00:53', 7, 'inactive'),
(46, 1, 43, '2025-10-14 13:46:40', 7, '2025-10-14 13:46:42', NULL, 'inactive');

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
(22, 32, 'Dining Area', 0, NULL, '2025-10-14 13:46:36');

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
(13, 32, 1, 2.50, 'BATCH001', '2025-10-14 13:46:36');

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
(18, 32, 'Cockroaches', 0, NULL, '2025-10-14 13:46:36');

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

INSERT INTO `insect_monitors` (`id`, `report_id`, `monitor_type`, `glue_board_replaced`, `tubes_replaced`, `monitor_serviced`, `created_at`) VALUES
(3, 2, 'fly_trap', 0, 1, 1, '2025-10-14 08:08:38'),
(4, 2, 'box', 0, NULL, 1, '2025-10-14 08:08:38'),
(5, 3, 'fly_trap', 0, 1, 1, '2025-10-14 08:10:45'),
(6, 3, 'box', 0, NULL, 1, '2025-10-14 08:10:45'),
(7, 4, 'fly_trap', 0, 1, 1, '2025-10-14 08:19:13'),
(8, 4, 'box', 0, NULL, 1, '2025-10-14 08:19:14'),
(9, 5, 'fly_trap', 0, 1, 1, '2025-10-14 08:22:53'),
(10, 5, 'box', 0, NULL, 1, '2025-10-14 08:22:53');

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
(7, 8, '67890', '::1', '2025-10-10 17:26:22', 1, NULL, 'curl/8.12.1'),
(10, 8, '67890', '::1', '2025-10-10 17:27:44', 0, 'invalid_credentials', 'curl/8.12.1'),
(11, 8, '67890', '::1', '2025-10-10 17:27:45', 0, 'invalid_credentials', 'curl/8.12.1'),
(12, 8, '67890', '::1', '2025-10-10 17:27:45', 0, 'invalid_credentials', 'curl/8.12.1'),
(13, 8, '67890', '::1', '2025-10-10 17:27:46', 0, 'invalid_credentials', 'curl/8.12.1'),
(14, 8, '67890', '::1', '2025-10-10 17:27:46', 0, 'invalid_credentials', 'curl/8.12.1'),
(15, 7, '12345', '::1', '2025-10-10 17:28:47', 1, NULL, 'curl/8.12.1'),
(16, NULL, '67890', '::1', '2025-10-10 17:29:14', 0, 'account_locked', 'curl/8.12.1'),
(17, 7, '12345', '::1', '2025-10-10 17:55:41', 0, 'invalid_credentials', 'curl/8.12.1'),
(18, 7, '12345', '::1', '2025-10-11 06:10:16', 0, 'invalid_credentials', 'curl/8.12.1'),
(19, 7, '12345', '::1', '2025-10-11 06:11:09', 1, NULL, 'curl/8.12.1'),
(20, 7, '12345', '::1', '2025-10-11 10:43:54', 1, NULL, 'curl/8.12.1'),
(21, 7, '12345', '::1', '2025-10-11 10:57:19', 1, NULL, 'curl/8.12.1'),
(22, 7, '12345', '::1', '2025-10-13 06:35:34', 1, NULL, 'curl/8.12.1'),
(23, 7, '12345', '::1', '2025-10-13 10:50:57', 0, 'invalid_credentials', 'curl/8.12.1'),
(24, 7, '12345', '::1', '2025-10-13 10:53:13', 1, NULL, 'curl/8.12.1'),
(25, 7, '12345', '::1', '2025-10-13 10:56:00', 1, NULL, 'curl/8.12.1'),
(26, 7, '12345', '::1', '2025-10-13 10:56:16', 1, NULL, 'curl/8.12.1'),
(27, 7, '12345', '::1', '2025-10-13 11:00:08', 1, NULL, 'curl/8.12.1'),
(28, 7, '12345', '::1', '2025-10-13 11:01:08', 1, NULL, 'curl/8.12.1'),
(29, 7, '12345', '::1', '2025-10-13 11:01:44', 1, NULL, 'curl/8.12.1'),
(30, 7, '12345', '::1', '2025-10-13 11:03:09', 1, NULL, 'curl/8.12.1'),
(31, 7, '12345', '::1', '2025-10-13 13:18:45', 0, 'invalid_credentials', 'curl/8.12.1'),
(32, 7, '12345', '::1', '2025-10-13 13:25:40', 1, NULL, 'curl/8.12.1'),
(33, 7, '12345', '::1', '2025-10-13 13:26:01', 1, NULL, 'curl/8.12.1'),
(34, 7, '12345', '::1', '2025-10-13 13:27:54', 1, NULL, 'curl/8.12.1'),
(35, 7, '12345', '::1', '2025-10-13 13:28:09', 1, NULL, 'curl/8.12.1'),
(36, 7, '12345', '::1', '2025-10-13 13:28:43', 1, NULL, 'curl/8.12.1'),
(37, 7, '12345', '::1', '2025-10-13 13:29:20', 1, NULL, 'curl/8.12.1'),
(38, 7, '12345', '::1', '2025-10-13 13:29:29', 1, NULL, 'curl/8.12.1'),
(39, 7, '12345', '::1', '2025-10-13 13:29:39', 1, NULL, 'curl/8.12.1'),
(40, 7, '12345', '::1', '2025-10-13 13:29:51', 1, NULL, 'curl/8.12.1'),
(41, 7, '12345', '::1', '2025-10-13 13:31:08', 1, NULL, 'curl/8.12.1'),
(42, 7, '12345', '::ffff:127.0.0.1', '2025-10-13 13:32:28', 1, NULL, 'curl/8.12.1'),
(43, 7, '12345', '::1', '2025-10-13 13:32:40', 1, NULL, 'curl/8.12.1'),
(44, 7, '12345', '::1', '2025-10-13 13:32:57', 1, NULL, 'curl/8.12.1'),
(45, 7, '12345', '::1', '2025-10-13 13:43:40', 1, NULL, 'curl/8.12.1'),
(46, 7, '12345', '::1', '2025-10-13 13:44:58', 1, NULL, 'curl/8.12.1'),
(47, 7, '12345', '::1', '2025-10-13 13:46:01', 1, NULL, 'curl/8.12.1'),
(48, 7, '12345', '::1', '2025-10-13 13:47:46', 1, NULL, 'curl/8.12.1'),
(49, 7, '12345', '::1', '2025-10-13 13:49:02', 1, NULL, 'curl/8.12.1'),
(50, 7, '12345', '::1', '2025-10-13 13:50:03', 1, NULL, 'curl/8.12.1'),
(51, 7, '12345', '::1', '2025-10-13 13:50:33', 1, NULL, 'curl/8.12.1'),
(52, 7, '12345', '::1', '2025-10-13 13:50:36', 1, NULL, 'curl/8.12.1'),
(53, 7, '12345', '::1', '2025-10-13 13:57:14', 1, NULL, 'curl/8.12.1'),
(54, 7, '12345', '::1', '2025-10-13 14:00:48', 1, NULL, 'curl/8.12.1'),
(55, 7, '12345', '::1', '2025-10-14 06:03:33', 0, 'invalid_credentials', 'curl/8.12.1'),
(56, 7, '12345', '::1', '2025-10-14 06:04:22', 1, NULL, 'curl/8.12.1'),
(57, 8, '67890', '::1', '2025-10-14 06:04:23', 0, 'invalid_credentials', 'curl/8.12.1'),
(58, 7, '12345', '::1', '2025-10-14 06:05:10', 1, NULL, 'curl/8.12.1'),
(59, 7, '12345', '::1', '2025-10-14 06:13:33', 1, NULL, 'curl/8.12.1'),
(60, NULL, '99999', '::1', '2025-10-14 06:13:34', 0, 'invalid_credentials', 'curl/8.12.1'),
(61, 7, '12345', '::1', '2025-10-14 06:23:28', 1, NULL, 'curl/8.12.1'),
(62, NULL, '99999', '::1', '2025-10-14 06:23:28', 0, 'invalid_credentials', 'curl/8.12.1'),
(63, 7, '12345', '::1', '2025-10-14 06:25:07', 1, NULL, 'curl/8.12.1'),
(64, 8, '67890', '::1', '2025-10-14 06:25:07', 0, 'invalid_credentials', 'curl/8.12.1'),
(65, NULL, '99999', '::1', '2025-10-14 06:25:08', 0, 'invalid_credentials', 'curl/8.12.1'),
(66, 7, '12345', '::1', '2025-10-14 06:25:19', 1, NULL, 'curl/8.12.1'),
(67, 7, '12345', '::1', '2025-10-14 08:08:34', 1, NULL, 'curl/8.12.1'),
(68, 10, '10865', '::1', '2025-10-14 08:08:35', 1, NULL, 'curl/8.12.1'),
(69, 7, '12345', '::1', '2025-10-14 08:10:41', 1, NULL, 'curl/8.12.1'),
(70, 11, '34843', '::1', '2025-10-14 08:10:41', 1, NULL, 'curl/8.12.1'),
(71, 7, '12345', '::1', '2025-10-14 08:19:10', 1, NULL, 'curl/8.12.1'),
(72, 12, '27661', '::1', '2025-10-14 08:19:10', 1, NULL, 'curl/8.12.1'),
(73, 7, '12345', '::1', '2025-10-14 08:22:49', 1, NULL, 'curl/8.12.1'),
(74, 13, '16615', '::1', '2025-10-14 08:22:50', 1, NULL, 'curl/8.12.1'),
(75, 7, '12345', '::1', '2025-10-14 09:13:30', 0, 'invalid_credentials', 'curl/8.12.1'),
(76, 7, '12345', '::1', '2025-10-14 09:14:39', 1, NULL, 'curl/8.12.1'),
(77, 14, '25969', '::1', '2025-10-14 09:14:40', 1, NULL, 'curl/8.12.1'),
(78, 7, '12345', '::1', '2025-10-14 09:28:07', 1, NULL, 'curl/8.12.1'),
(79, 15, '21976', '::1', '2025-10-14 09:28:07', 1, NULL, 'curl/8.12.1'),
(80, 7, '12345', '::1', '2025-10-14 09:44:45', 1, NULL, 'curl/8.12.1'),
(81, 16, '15740', '::1', '2025-10-14 09:44:45', 1, NULL, 'curl/8.12.1'),
(82, 7, '12345', '::1', '2025-10-14 09:50:00', 1, NULL, 'curl/8.12.1'),
(83, 17, '35761', '::1', '2025-10-14 09:50:01', 1, NULL, 'curl/8.12.1'),
(84, 7, '12345', '::1', '2025-10-14 09:56:31', 1, NULL, 'curl/8.12.1'),
(85, 18, '28305', '::1', '2025-10-14 09:56:31', 1, NULL, 'curl/8.12.1'),
(86, 7, '12345', '::1', '2025-10-14 09:57:47', 1, NULL, 'curl/8.12.1'),
(87, 7, '12345', '::1', '2025-10-14 09:58:31', 1, NULL, 'curl/8.12.1'),
(88, 19, '26447', '::1', '2025-10-14 09:58:31', 1, NULL, 'curl/8.12.1'),
(89, 7, '12345', '::1', '2025-10-14 10:01:47', 1, NULL, 'curl/8.12.1'),
(90, 20, '38538', '::1', '2025-10-14 10:01:48', 1, NULL, 'curl/8.12.1'),
(91, 7, '12345', '::1', '2025-10-14 10:03:19', 1, NULL, 'curl/8.12.1'),
(92, 21, '42444', '::1', '2025-10-14 10:03:20', 1, NULL, 'curl/8.12.1'),
(93, 7, '12345', '::1', '2025-10-14 10:05:12', 1, NULL, 'curl/8.12.1'),
(94, 22, '35436', '::1', '2025-10-14 10:05:13', 1, NULL, 'curl/8.12.1'),
(95, 7, '12345', '::1', '2025-10-14 10:12:02', 1, NULL, 'curl/8.12.1'),
(96, 23, '35425', '::1', '2025-10-14 10:12:03', 1, NULL, 'curl/8.12.1'),
(97, 7, '12345', '::1', '2025-10-14 10:52:13', 1, NULL, 'curl/8.12.1'),
(98, 7, '12345', '::1', '2025-10-14 10:52:48', 1, NULL, 'curl/8.12.1'),
(99, 24, '10680', '::1', '2025-10-14 10:52:49', 1, NULL, 'curl/8.12.1'),
(100, 7, '12345', '::1', '2025-10-14 10:53:12', 1, NULL, 'curl/8.12.1'),
(101, 25, '13639', '::1', '2025-10-14 10:53:13', 1, NULL, 'curl/8.12.1'),
(102, 7, '12345', '::1', '2025-10-14 10:54:42', 1, NULL, 'curl/8.12.1'),
(103, 26, '28310', '::1', '2025-10-14 10:54:42', 1, NULL, 'curl/8.12.1'),
(104, 7, '12345', '::1', '2025-10-14 10:56:07', 1, NULL, 'curl/8.12.1'),
(105, 27, '13533', '::1', '2025-10-14 10:56:08', 1, NULL, 'curl/8.12.1'),
(106, 7, '12345', '::1', '2025-10-14 12:32:05', 1, NULL, 'curl/8.12.1'),
(107, 28, '37611', '::1', '2025-10-14 12:32:06', 1, NULL, 'curl/8.12.1'),
(108, 7, '12345', '::1', '2025-10-14 12:36:20', 1, NULL, 'curl/8.12.1'),
(109, 29, '36213', '::1', '2025-10-14 12:36:21', 1, NULL, 'curl/8.12.1'),
(110, 7, '12345', '::1', '2025-10-14 12:38:24', 1, NULL, 'curl/8.12.1'),
(111, 30, '31696', '::1', '2025-10-14 12:38:25', 1, NULL, 'curl/8.12.1'),
(112, 7, '12345', '::1', '2025-10-14 12:39:38', 1, NULL, 'curl/8.12.1'),
(113, 31, '13850', '::1', '2025-10-14 12:39:39', 1, NULL, 'curl/8.12.1'),
(114, 7, '12345', '::1', '2025-10-14 12:51:14', 1, NULL, 'curl/8.12.1'),
(115, 32, '41463', '::1', '2025-10-14 12:51:15', 1, NULL, 'curl/8.12.1'),
(116, 7, '12345', '::1', '2025-10-14 12:51:34', 1, NULL, 'curl/8.12.1'),
(117, 33, '30885', '::1', '2025-10-14 12:51:35', 1, NULL, 'curl/8.12.1'),
(118, 7, '12345', '::1', '2025-10-14 12:59:24', 1, NULL, 'curl/8.12.1'),
(119, 34, '20133', '::1', '2025-10-14 12:59:25', 1, NULL, 'curl/8.12.1'),
(120, 7, '12345', '::1', '2025-10-14 12:59:46', 1, NULL, 'curl/8.12.1'),
(121, 35, '24200', '::1', '2025-10-14 12:59:47', 1, NULL, 'curl/8.12.1'),
(122, 7, '12345', '::1', '2025-10-14 13:07:28', 1, NULL, 'curl/8.12.1'),
(123, 7, '12345', '::1', '2025-10-14 13:08:52', 1, NULL, 'curl/8.12.1'),
(124, 7, '12345', '::1', '2025-10-14 13:09:11', 1, NULL, 'curl/8.12.1'),
(125, 7, '12345', '::1', '2025-10-14 13:09:43', 1, NULL, 'curl/8.12.1'),
(126, 7, '12345', '::1', '2025-10-14 13:11:03', 1, NULL, 'curl/8.12.1'),
(127, 37, '88888', '::1', '2025-10-14 13:11:27', 1, NULL, 'curl/8.12.1'),
(128, 37, '88888', '::1', '2025-10-14 13:11:44', 1, NULL, 'curl/8.12.1'),
(129, 37, '88888', '::1', '2025-10-14 13:12:04', 1, NULL, 'curl/8.12.1'),
(130, 37, '88888', '::1', '2025-10-14 13:12:22', 1, NULL, 'curl/8.12.1'),
(131, 37, '88888', '::1', '2025-10-14 13:12:40', 1, NULL, 'curl/8.12.1'),
(132, 37, '88888', '::1', '2025-10-14 13:12:58', 1, NULL, 'curl/8.12.1'),
(133, 7, '12345', '::1', '2025-10-14 13:13:18', 1, NULL, 'curl/8.12.1'),
(134, 7, '12345', '::1', '2025-10-14 13:13:37', 1, NULL, 'curl/8.12.1'),
(135, 7, '12345', '::1', '2025-10-14 13:14:00', 1, NULL, 'curl/8.12.1'),
(136, 7, '12345', '::1', '2025-10-14 13:14:33', 1, NULL, 'curl/8.12.1'),
(137, 7, '12345', '::1', '2025-10-14 13:15:06', 1, NULL, 'curl/8.12.1'),
(138, 37, '88888', '::1', '2025-10-14 13:15:26', 1, NULL, 'curl/8.12.1'),
(139, 37, '88888', '::1', '2025-10-14 13:15:45', 1, NULL, 'curl/8.12.1'),
(140, 37, '88888', '::1', '2025-10-14 13:16:25', 1, NULL, 'curl/8.12.1'),
(141, 37, '88888', '::1', '2025-10-14 13:16:52', 1, NULL, 'curl/8.12.1'),
(142, 37, '88888', '::1', '2025-10-14 13:17:05', 1, NULL, 'curl/8.12.1'),
(143, 37, '88888', '::1', '2025-10-14 13:17:23', 1, NULL, 'curl/8.12.1'),
(144, 37, '88888', '::1', '2025-10-14 13:17:38', 1, NULL, 'curl/8.12.1'),
(145, 37, '88888', '::1', '2025-10-14 13:18:12', 1, NULL, 'curl/8.12.1'),
(146, 37, '88888', '::1', '2025-10-14 13:18:26', 1, NULL, 'curl/8.12.1'),
(147, 37, '88888', '::1', '2025-10-14 13:18:40', 1, NULL, 'curl/8.12.1'),
(148, 7, '12345', '::1', '2025-10-14 13:24:23', 1, NULL, 'curl/8.12.1'),
(149, 38, '27566', '::1', '2025-10-14 13:24:23', 1, NULL, 'curl/8.12.1'),
(150, 7, '12345', '::1', '2025-10-14 13:26:23', 1, NULL, 'curl/8.12.1'),
(151, 39, '20196', '::1', '2025-10-14 13:26:24', 1, NULL, 'curl/8.12.1'),
(152, 7, '12345', '::1', '2025-10-14 13:27:23', 1, NULL, 'curl/8.12.1'),
(153, 40, '37755', '::1', '2025-10-14 13:27:24', 1, NULL, 'curl/8.12.1'),
(154, 7, '12345', '::1', '2025-10-14 13:32:18', 1, NULL, 'curl/8.12.1'),
(155, 41, '11843', '::1', '2025-10-14 13:32:19', 1, NULL, 'curl/8.12.1'),
(156, 7, '12345', '::1', '2025-10-14 13:32:48', 1, NULL, 'curl/8.12.1'),
(157, 7, '12345', '::1', '2025-10-14 13:45:34', 1, NULL, 'curl/8.12.1'),
(158, 42, '28005', '::1', '2025-10-14 13:45:35', 1, NULL, 'curl/8.12.1'),
(159, 7, '12345', '::1', '2025-10-14 13:46:33', 1, NULL, 'curl/8.12.1'),
(160, 43, '40801', '::1', '2025-10-14 13:46:34', 1, NULL, 'curl/8.12.1'),
(161, 42, '28005', '::1', '2025-10-14 13:48:22', 0, 'invalid_credentials', 'curl/8.12.1'),
(162, 42, '28005', '::1', '2025-10-14 13:48:42', 0, 'invalid_credentials', 'curl/8.12.1'),
(163, 7, '12345', '::1', '2025-10-14 13:49:02', 1, NULL, 'curl/8.12.1'),
(164, 43, '40801', '::1', '2025-10-14 13:49:28', 0, 'invalid_credentials', 'curl/8.12.1');

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
(29, 3, 'report_submitted', 'New Report Submitted', 'Test PCO Dashboard User submitted a report for ABC Restaurant Sdn Bhd (Updated)', NULL, '2025-10-14 13:46:42');

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

--
-- Dumping data for table `password_reset_tokens`
--

INSERT INTO `password_reset_tokens` (`id`, `user_id`, `token`, `expires_at`, `used_at`, `created_at`) VALUES
(1, 7, '843b967b24974c3594370181318c9abc', '2025-10-10 18:17:43', NULL, '2025-10-10 17:17:43'),
(2, 7, '0bfa18b468184206b59c7d28f6139354', '2025-10-10 18:18:45', '2025-10-10 17:18:59', '2025-10-10 17:18:45');

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

INSERT INTO `reports` (`id`, `client_id`, `pco_id`, `report_type`, `service_date`, `next_service_date`, `status`, `pco_signature_data`, `client_signature_data`, `client_signature_name`, `general_remarks`, `admin_notes`, `created_at`, `updated_at`, `submitted_at`, `reviewed_at`, `reviewed_by`) VALUES
(2, 1, 10, 'both', '2025-10-14', '2025-11-13', 'declined', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'John Test Client', 'Test report with signatures', 'Please add more detailed bait station remarks and resubmit. Station TEST-001 needs specific pest identification.', '2025-10-14 08:08:36', '2025-10-14 08:08:40', '2025-10-14 08:08:39', '2025-10-14 08:08:40', 7),
(3, 1, 11, 'both', '2025-10-14', '2025-11-13', 'declined', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'John Test Client', 'Test report with signatures', 'Please add more detailed bait station remarks and resubmit. Station TEST-001 needs specific pest identification.', '2025-10-14 08:10:43', '2025-10-14 08:10:48', '2025-10-14 08:10:46', '2025-10-14 08:10:48', 7),
(4, 1, 12, 'both', '2025-10-14', '2025-11-13', 'approved', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'John Test Client', 'Test report with signatures', 'Report approved. Good work.', '2025-10-14 08:19:12', '2025-10-14 08:19:17', '2025-10-14 08:19:17', '2025-10-14 08:19:17', 7),
(5, 1, 13, 'both', '2025-10-14', '2025-11-13', 'approved', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'John Test Client', 'Test report with signatures', 'Report approved. Good work.', '2025-10-14 08:22:51', '2025-10-14 08:22:57', '2025-10-14 08:22:57', '2025-10-14 08:22:57', 7),
(6, 1, 15, 'both', '2025-10-14', '2025-10-28', 'draft', NULL, NULL, NULL, NULL, NULL, '2025-10-14 09:28:10', '2025-10-14 09:28:10', NULL, NULL, NULL),
(7, 1, 16, 'both', '2025-10-14', '2025-10-28', 'draft', NULL, NULL, NULL, NULL, NULL, '2025-10-14 09:44:47', '2025-10-14 09:44:47', NULL, NULL, NULL),
(8, 1, 17, 'both', '2025-10-14', '2025-10-28', 'draft', NULL, NULL, NULL, NULL, NULL, '2025-10-14 09:50:03', '2025-10-14 09:50:03', NULL, NULL, NULL),
(9, 1, 18, 'both', '2025-10-14', '2025-10-28', 'draft', NULL, NULL, NULL, NULL, NULL, '2025-10-14 09:56:33', '2025-10-14 09:56:33', NULL, NULL, NULL),
(10, 1, 19, 'both', '2025-10-14', '2025-10-28', 'draft', NULL, NULL, NULL, NULL, NULL, '2025-10-14 09:58:34', '2025-10-14 09:58:34', NULL, NULL, NULL),
(11, 1, 20, 'both', '2025-10-14', '2025-10-28', 'draft', NULL, NULL, NULL, NULL, NULL, '2025-10-14 10:01:50', '2025-10-14 10:01:50', NULL, NULL, NULL),
(12, 1, 21, 'both', '2025-10-14', '2025-10-28', 'draft', NULL, NULL, NULL, NULL, NULL, '2025-10-14 10:03:21', '2025-10-14 10:03:21', NULL, NULL, NULL),
(13, 1, 22, 'both', '2025-10-14', '2025-10-28', 'draft', NULL, NULL, NULL, NULL, NULL, '2025-10-14 10:05:15', '2025-10-14 10:05:15', NULL, NULL, NULL),
(14, 1, 23, 'both', '2025-10-14', '2025-10-28', 'draft', NULL, NULL, NULL, NULL, NULL, '2025-10-14 10:12:05', '2025-10-14 10:12:05', NULL, NULL, NULL),
(15, 1, 24, 'both', '2025-10-14', '2025-10-28', 'draft', NULL, NULL, NULL, NULL, NULL, '2025-10-14 10:52:51', '2025-10-14 10:52:51', NULL, NULL, NULL),
(16, 1, 25, 'both', '2025-10-14', '2025-10-28', 'draft', NULL, NULL, NULL, NULL, NULL, '2025-10-14 10:53:15', '2025-10-14 10:53:15', NULL, NULL, NULL),
(17, 1, 26, 'both', '2025-10-14', '2025-10-28', 'draft', NULL, NULL, NULL, NULL, NULL, '2025-10-14 10:54:44', '2025-10-14 10:54:44', NULL, NULL, NULL),
(18, 1, 27, 'both', '2025-10-14', '2025-10-28', 'draft', NULL, NULL, NULL, NULL, NULL, '2025-10-14 10:56:10', '2025-10-14 10:56:10', NULL, NULL, NULL),
(19, 1, 28, 'both', '2025-10-14', '2025-10-28', 'draft', NULL, NULL, NULL, NULL, NULL, '2025-10-14 12:32:07', '2025-10-14 12:32:07', NULL, NULL, NULL),
(20, 1, 29, 'both', '2025-10-14', '2025-10-28', 'draft', NULL, NULL, NULL, NULL, NULL, '2025-10-14 12:36:23', '2025-10-14 12:36:23', NULL, NULL, NULL),
(21, 1, 30, 'both', '2025-10-14', '2025-10-28', 'draft', NULL, NULL, NULL, NULL, NULL, '2025-10-14 12:38:27', '2025-10-14 12:38:27', NULL, NULL, NULL),
(22, 1, 31, 'both', '2025-10-14', '2025-10-28', 'draft', NULL, NULL, NULL, NULL, NULL, '2025-10-14 12:39:40', '2025-10-14 12:39:40', NULL, NULL, NULL),
(23, 1, 33, 'both', '2025-10-14', '2025-10-28', 'draft', NULL, NULL, NULL, NULL, NULL, '2025-10-14 12:51:38', '2025-10-14 12:51:38', NULL, NULL, NULL),
(24, 1, 34, 'both', '2025-10-14', '2025-10-28', 'draft', NULL, NULL, NULL, NULL, NULL, '2025-10-14 12:59:27', '2025-10-14 12:59:27', NULL, NULL, NULL),
(25, 1, 35, 'both', '2025-10-14', '2025-10-28', 'draft', NULL, NULL, NULL, NULL, NULL, '2025-10-14 12:59:49', '2025-10-14 12:59:49', NULL, NULL, NULL),
(26, 1, 37, 'both', '2025-10-14', '2025-10-28', 'pending', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'John Doe', 'Test complete', NULL, '2025-10-14 13:15:27', '2025-10-14 13:18:27', '2025-10-14 13:18:27', NULL, NULL),
(27, 1, 38, 'both', '2025-10-14', '2025-10-28', 'pending', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'John Doe', 'Routine inspection completed', 'Please add missing bait station BS-002 and verify chemical quantities.', '2025-10-14 13:24:25', '2025-10-14 13:24:31', '2025-10-14 13:24:31', '2025-10-14 13:24:29', 7),
(28, 1, 39, 'both', '2025-10-14', '2025-10-28', 'pending', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'John Doe', 'Routine inspection completed', 'Please add missing bait station BS-002 and verify chemical quantities.', '2025-10-14 13:26:26', '2025-10-14 13:26:33', '2025-10-14 13:26:33', '2025-10-14 13:26:30', 7),
(29, 1, 40, 'both', '2025-10-14', '2025-10-28', 'pending', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'John Doe', 'Routine inspection completed', 'Please add missing bait station BS-002 and verify chemical quantities.', '2025-10-14 13:27:26', '2025-10-14 13:27:32', '2025-10-14 13:27:32', '2025-10-14 13:27:30', 7),
(30, 1, 41, 'both', '2025-10-14', '2025-10-28', 'pending', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'John Doe', 'Routine inspection completed', 'Please add missing bait station BS-002 and verify chemical quantities.', '2025-10-14 13:32:21', '2025-10-14 13:32:28', '2025-10-14 13:32:28', '2025-10-14 13:32:25', 7),
(31, 1, 42, 'both', '2025-10-14', '2025-10-28', 'pending', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'John Doe', 'Routine inspection completed', 'Please add missing bait station BS-002 and verify chemical quantities.', '2025-10-14 13:45:40', '2025-10-14 13:45:47', '2025-10-14 13:45:47', '2025-10-14 13:45:45', 7),
(32, 1, 43, 'both', '2025-10-14', '2025-10-28', 'pending', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'John Doe', 'Routine inspection completed', 'Please add missing bait station BS-002 and verify chemical quantities.', '2025-10-14 13:46:35', '2025-10-14 13:46:42', '2025-10-14 13:46:42', '2025-10-14 13:46:40', 7);

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
(6, 11, 5, 25.50, 'TEST-BATCH-001', '2025-10-14 08:22:52');

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
(4, 'pco67890', 'PCO User', 'pco@kpspest.com', '0987654321', '$2a$12$sWJbfwFX9dA4M9l8ONdPh.Dd2RsJV1wpV4XaGrYVyq2SpTGrTrltm', 'pco', 'active', '2025-10-10 16:53:41', '2025-10-10 16:56:40', NULL, 0, NULL, NULL),
(7, '12345', 'Admin User', 'admin@kpspestcontrol.co.za', '+27123456789', '$2a$12$dE0UqR9S8hXS.BCJUPWv9.SOgpyBn4zFLiNMENbM9hk6GVXcTHiDy', 'admin', 'active', '2025-10-10 17:04:40', '2025-10-14 09:14:39', NULL, 0, NULL, NULL),
(8, '67890', 'John PCO', 'pco@kpspestcontrol.co.za', '+27987654321', '$2y$12$MgzljKBIHMCFxzRu1X.dt.N59Bra7rWyb5KlgmjTDVeOAG63maUmC', 'pco', 'active', '2025-10-10 17:04:40', '2025-10-14 13:06:28', NULL, 0, NULL, NULL),
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
(43, '40801', 'Test PCO Dashboard User', 'testpco40801@test.com', '+1234567890', '$2b$10$aSJ1OJR.X2Vn/s./lBB.rOubk8De5VXT./DauYQa5J1/Ynr/DoVLS', 'pco', 'active', '2025-10-14 13:46:34', '2025-10-14 13:49:28', NULL, 1, NULL, NULL);

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
('1afcc542ed504754b588fd31b35b34bc', 7, 'admin', '::1', 'curl/8.12.1', '2025-10-14 13:49:03', '2025-10-15 13:49:02', '2025-10-14 13:49:02'),
('6df7b87a82e2479283aea6e40ef5a1a4', 42, 'pco', '::1', 'curl/8.12.1', '2025-10-14 13:45:48', '2025-10-15 13:45:35', '2025-10-14 13:45:35'),
('b111c292588c465ea92628f5398590eb', 7, 'admin', '::1', 'curl/8.12.1', '2025-10-14 13:45:48', '2025-10-15 13:45:34', '2025-10-14 13:45:34'),
('ccb7227f6ef2430383cc433a9c62d40e', 7, 'admin', '::1', 'curl/8.12.1', '2025-10-14 13:46:43', '2025-10-15 13:46:33', '2025-10-14 13:46:33'),
('da105ac99c594dc5881e4b9ba73ffdf6', 43, 'pco', '::1', 'curl/8.12.1', '2025-10-14 13:46:44', '2025-10-15 13:46:34', '2025-10-14 13:46:34');

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
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=22;

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
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=47;

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
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=23;

--
-- AUTO_INCREMENT for table `fumigation_chemicals`
--
ALTER TABLE `fumigation_chemicals`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=14;

--
-- AUTO_INCREMENT for table `fumigation_target_pests`
--
ALTER TABLE `fumigation_target_pests`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=19;

--
-- AUTO_INCREMENT for table `insect_monitors`
--
ALTER TABLE `insect_monitors`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `login_attempts`
--
ALTER TABLE `login_attempts`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=165;

--
-- AUTO_INCREMENT for table `notifications`
--
ALTER TABLE `notifications`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=30;

--
-- AUTO_INCREMENT for table `password_reset_tokens`
--
ALTER TABLE `password_reset_tokens`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `reports`
--
ALTER TABLE `reports`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=33;

--
-- AUTO_INCREMENT for table `report_versions`
--
ALTER TABLE `report_versions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `station_chemicals`
--
ALTER TABLE `station_chemicals`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=44;

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
