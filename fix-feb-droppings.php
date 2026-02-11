<?php
/**
 * Fix Activity Droppings Data for Feb 10-11, 2026 Reports
 * 
 * This script updates bait_stations for reports with service_date of 2026-02-10 or 2026-02-11
 * to set activity_droppings = 0.
 * 
 * USAGE:
 * 1. Set $dryRun = true to preview changes
 * 2. Set $dryRun = false to execute the update
 * 3. Run: php fix-feb-droppings.php
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

// DRY RUN MODE: Set to false to actually execute the UPDATE
$dryRun = false;

// Database connection settings - UPDATE THESE FOR YOUR PRODUCTION DATABASE
$dbHost = 'localhost';
$dbName = 'kpspestcontrol_app';
$dbUser = 'kpspestcontrol_admin';      // UPDATE THIS
$dbPass = 'Dannel@2024!';   // UPDATE THIS

// Target service dates
$targetDates = ['2026-02-10', '2026-02-11'];

// ============================================================================
// SCRIPT START
// ============================================================================

echo "================================================================================\n";
echo "Fix Activity Droppings Data for Feb 10-11, 2026\n";
echo "================================================================================\n";
echo "Mode: " . ($dryRun ? "DRY RUN (no changes will be made)" : "LIVE UPDATE") . "\n";
echo "Target Dates: " . implode(', ', $targetDates) . "\n";
echo "================================================================================\n\n";

try {
    // Connect to database
    echo "Connecting to database...\n";
    $pdo = new PDO(
        "mysql:host=$dbHost;dbname=$dbName;charset=utf8mb4",
        $dbUser,
        $dbPass,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
        ]
    );
    echo "✓ Connected successfully\n\n";

    // Start transaction for safety
    $pdo->beginTransaction();

    // Step 1: Find affected reports
    echo "Step 1: Finding reports with service_date in (" . implode(', ', $targetDates) . ")...\n";
    $placeholders = implode(',', array_fill(0, count($targetDates), '?'));
    $sqlFindReports = "
        SELECT id, client_id, service_date, status
        FROM reports
        WHERE service_date IN ($placeholders)
        ORDER BY id
    ";
    
    $stmt = $pdo->prepare($sqlFindReports);
    $stmt->execute($targetDates);
    $reports = $stmt->fetchAll();

    if (empty($reports)) {
        echo "⚠ No reports found with the specified dates\n";
        $pdo->rollBack();
        exit(0);
    }

    echo "✓ Found " . count($reports) . " report(s):\n";
    foreach ($reports as $report) {
        echo "  - Report ID: {$report['id']}, Client ID: {$report['client_id']}, Date: {$report['service_date']}, Status: {$report['status']}\n";
    }
    echo "\n";

    // Step 2: Find affected bait_stations
    $reportIds = array_column($reports, 'id');
    $placeholders = implode(',', array_fill(0, count($reportIds), '?'));
    
    echo "Step 2: Finding bait_stations for these reports...\n";
    $sqlFindStations = "
        SELECT 
            id, 
            report_id, 
            station_number, 
            location,
            activity_detected,
            activity_droppings,
            activity_gnawing,
            activity_tracks,
            activity_other
        FROM bait_stations
        WHERE report_id IN ($placeholders)
        ORDER BY report_id, CAST(station_number AS UNSIGNED)
    ";
    
    $stmt = $pdo->prepare($sqlFindStations);
    $stmt->execute($reportIds);
    $stations = $stmt->fetchAll();

    if (empty($stations)) {
        echo "⚠ No bait_stations found for these reports\n";
        $pdo->rollBack();
        exit(0);
    }

    echo "✓ Found " . count($stations) . " bait_station(s)\n\n";

    // Step 3: Show current state
    echo "Step 3: Current bait_stations state:\n";
    echo str_repeat("-", 120) . "\n";
    printf("%-8s %-12s %-15s %-18s %-10s %-10s %-10s %-10s %-10s\n",
        "ID", "Report ID", "Station #", "Location", "Detected", "Droppings", "Gnawing", "Tracks", "Other");
    echo str_repeat("-", 120) . "\n";
    
    $stationsNeedingUpdate = 0;
    foreach ($stations as $station) {
        printf("%-8s %-12s %-15s %-18s %-10s %-10s %-10s %-10s %-10s\n",
            $station['id'],
            $station['report_id'],
            $station['station_number'],
            $station['location'],
            $station['activity_detected'],
            $station['activity_droppings'] ?? '0',
            $station['activity_gnawing'] ?? '0',
            $station['activity_tracks'] ?? '0',
            $station['activity_other'] ?? '0'
        );
        
        // Check if this station needs updating
        if ($station['activity_detected'] == 1 || 
            ($station['activity_droppings'] ?? 0) == 1 || 
            ($station['activity_gnawing'] ?? 0) == 1 || 
            ($station['activity_tracks'] ?? 0) == 1 || 
            ($station['activity_other'] ?? 0) == 1) {
            $stationsNeedingUpdate++;
        }
    }
    echo str_repeat("-", 120) . "\n";
    echo "Stations needing update: $stationsNeedingUpdate\n\n";

    // Step 4: Update bait_stations
    if (!$dryRun) {
        echo "Step 4: Updating bait_stations (setting droppings to 0)...\n";
        
        $sqlUpdate = "
            UPDATE bait_stations
            SET 
                activity_droppings = 0,
                updated_at = NOW()
            WHERE report_id IN ($placeholders)
        ";
        
        $stmt = $pdo->prepare($sqlUpdate);
        $stmt->execute($reportIds);
        $updatedCount = $stmt->rowCount();
        
        echo "✓ Updated $updatedCount bait_station record(s)\n\n";
        
        // Commit transaction
        $pdo->commit();
        echo "✓ Transaction committed successfully\n";
    } else {
        echo "Step 4: DRY RUN - No changes made\n";
        echo "To execute the update, set \$dryRun = false and run again\n";
        $pdo->rollBack();
    }

    echo "\n================================================================================\n";
    echo "Script completed successfully\n";
    echo "================================================================================\n";

} catch (PDOException $e) {
    if ($pdo && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    echo "\n❌ ERROR: " . $e->getMessage() . "\n";
    echo "No changes were made to the database\n";
    exit(1);
} catch (Exception $e) {
    if ($pdo && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    echo "\n❌ ERROR: " . $e->getMessage() . "\n";
    exit(1);
}
