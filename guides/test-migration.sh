#!/bin/bash
# ============================================================================
# Test Script for Database Migration
# ============================================================================

echo "==============================================="
echo "Starting Database Migration Test"
echo "==============================================="
echo ""

# Database credentials
DB_NAME="kpspestcontrol_app"
DB_USER="root"

echo "Step 1: Checking current database structure..."
echo "-----------------------------------------------"

# Check if tables exist
echo "Checking if tables exist..."
mysql -u $DB_USER -e "USE $DB_NAME; SHOW TABLES LIKE 'bait_stations';" 2>&1
mysql -u $DB_USER -e "USE $DB_NAME; SHOW TABLES LIKE 'insect_monitors';" 2>&1
mysql -u $DB_USER -e "USE $DB_NAME; SHOW TABLES LIKE 'reports';" 2>&1

echo ""
echo "Step 2: Checking current bait_stations structure..."
echo "-----------------------------------------------"
mysql -u $DB_USER -e "USE $DB_NAME; DESCRIBE bait_stations;" 2>&1

echo ""
echo "Step 3: Checking current insect_monitors structure..."
echo "-----------------------------------------------"
mysql -u $DB_USER -e "USE $DB_NAME; DESCRIBE insect_monitors;" 2>&1

echo ""
echo "Step 4: Checking current reports structure..."
echo "-----------------------------------------------"
mysql -u $DB_USER -e "USE $DB_NAME; DESCRIBE reports;" 2>&1

echo ""
echo "Step 5: Running migration script..."
echo "-----------------------------------------------"
mysql -u $DB_USER $DB_NAME < migration-report-enhancements.sql 2>&1

if [ $? -eq 0 ]; then
    echo "✓ Migration script executed successfully!"
else
    echo "✗ Migration script failed!"
    exit 1
fi

echo ""
echo "Step 6: Verifying bait_stations new fields..."
echo "-----------------------------------------------"
mysql -u $DB_USER -e "USE $DB_NAME; SHOW COLUMNS FROM bait_stations WHERE Field IN ('bait_status', 'action_taken', 'warning_sign_condition');" 2>&1

echo ""
echo "Step 7: Verifying insect_monitors new fields..."
echo "-----------------------------------------------"
mysql -u $DB_USER -e "USE $DB_NAME; SHOW COLUMNS FROM insect_monitors WHERE Field IN ('monitor_condition', 'monitor_condition_other', 'warning_sign_condition', 'light_condition', 'light_faulty_type', 'light_faulty_other', 'updated_at');" 2>&1

echo ""
echo "Step 8: Verifying reports new fields..."
echo "-----------------------------------------------"
mysql -u $DB_USER -e "USE $DB_NAME; SHOW COLUMNS FROM reports WHERE Field IN ('general_remarks', 'recommendations', 'admin_notes');" 2>&1

echo ""
echo "Step 9: Testing data integrity..."
echo "-----------------------------------------------"

# Count records and check for nulls
echo "Checking bait_stations data..."
mysql -u $DB_USER -e "USE $DB_NAME; SELECT COUNT(*) as total_stations FROM bait_stations;" 2>&1

echo ""
echo "Checking insect_monitors data..."
mysql -u $DB_USER -e "USE $DB_NAME; SELECT COUNT(*) as total_monitors FROM insect_monitors;" 2>&1

echo ""
echo "Checking reports data..."
mysql -u $DB_USER -e "USE $DB_NAME; SELECT COUNT(*) as total_reports FROM reports;" 2>&1

echo ""
echo "==============================================="
echo "Migration Test Complete!"
echo "==============================================="
