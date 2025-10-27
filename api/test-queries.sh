#!/bin/bash

# Test SQL queries directly using mysql command line
# This uses the same queries as the PDF service

echo "======================================"
echo "KPS Pest Control - SQL Query Testing"
echo "======================================"
echo ""

# Database connection details from .env
DB_HOST="localhost"
DB_NAME="kpspestcontrol_app"
DB_USER="root"
DB_PASS=""

# Test 1: Get recent reports
echo "TEST 1: Recent Reports"
echo "----------------------"
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "
SELECT id, report_type, status, service_date, created_at 
FROM reports 
ORDER BY created_at DESC 
LIMIT 5;
" 2>/dev/null
echo ""

# Get a report ID to test with
REPORT_ID=$(mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -se "SELECT id FROM reports ORDER BY created_at DESC LIMIT 1;" 2>/dev/null)

if [ -z "$REPORT_ID" ]; then
    echo "ERROR: No reports found in database!"
    exit 1
fi

echo "Using Report ID: $REPORT_ID"
echo ""

# Test 2: Report Details (main query from pdfService.ts line ~145)
echo "TEST 2: Report Details Query"
echo "----------------------------"
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "
SELECT 
    r.*,
    c.company_name,
    c.address_line1,
    c.city,
    u.first_name as pco_first_name,
    u.last_name as pco_last_name
FROM reports r
LEFT JOIN clients c ON r.client_id = c.id
LEFT JOIN users u ON r.pco_id = u.id
WHERE r.id = $REPORT_ID;
" 2>/dev/null
echo ""

# Test 3: Bait Stations Query (from pdfService.ts line ~163)
echo "TEST 3: Bait Stations Query"
echo "---------------------------"
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "
SELECT 
    bs.id,
    bs.station_number,
    bs.location,
    bs.is_accessible,
    bs.inaccessible_reason,
    bs.bait_status,
    bs.activity_detected,
    bs.station_condition,
    sc.chemical_id,
    sc.quantity,
    sc.batch_number,
    c.name as chemical_name,
    c.l_number,
    c.quantity_unit
FROM bait_stations bs
LEFT JOIN station_chemicals sc ON bs.id = sc.station_id
LEFT JOIN chemicals c ON sc.chemical_id = c.id
WHERE bs.report_id = $REPORT_ID
ORDER BY bs.location, bs.station_number;
" 2>/dev/null

# Count stations
STATION_COUNT=$(mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -se "SELECT COUNT(*) FROM bait_stations WHERE report_id = $REPORT_ID;" 2>/dev/null)
echo "Total bait stations found: $STATION_COUNT"
echo ""

# Test 4: Station Chemicals (check if the join table has data)
echo "TEST 4: Station Chemicals Table"
echo "-------------------------------"
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "
SELECT sc.*, c.name as chemical_name, c.l_number
FROM station_chemicals sc
LEFT JOIN chemicals c ON sc.chemical_id = c.id
LEFT JOIN bait_stations bs ON sc.station_id = bs.id
WHERE bs.report_id = $REPORT_ID;
" 2>/dev/null

SC_COUNT=$(mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -se "SELECT COUNT(*) FROM station_chemicals sc JOIN bait_stations bs ON sc.station_id = bs.id WHERE bs.report_id = $REPORT_ID;" 2>/dev/null)
echo "Total station_chemicals entries: $SC_COUNT"
echo ""

# Test 5: Insect Monitors Query (from pdfService.ts line ~202)
echo "TEST 5: Insect Monitors Query"
echo "-----------------------------"
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "
SELECT 
    id,
    report_id,
    monitor_number,
    location,
    monitor_type,
    monitor_condition,
    light_condition,
    glue_board_replaced,
    tubes_replaced,
    is_new_addition
FROM insect_monitors
WHERE report_id = $REPORT_ID
ORDER BY location, monitor_number, monitor_type, id;
" 2>/dev/null

IM_COUNT=$(mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -se "SELECT COUNT(*) FROM insect_monitors WHERE report_id = $REPORT_ID;" 2>/dev/null)
echo "Total insect monitors found: $IM_COUNT"
echo ""

# Test 6: Check for NULL monitor_number and location
echo "TEST 6: Insect Monitors with NULL fields"
echo "----------------------------------------"
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "
SELECT 
    id,
    report_id,
    monitor_number,
    location,
    monitor_type
FROM insect_monitors
WHERE report_id = $REPORT_ID 
  AND (monitor_number IS NULL OR location IS NULL);
" 2>/dev/null

NULL_COUNT=$(mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -se "SELECT COUNT(*) FROM insect_monitors WHERE report_id = $REPORT_ID AND (monitor_number IS NULL OR location IS NULL);" 2>/dev/null)
echo "Monitors with NULL monitor_number or location: $NULL_COUNT"
echo ""

# Test 7: Fumigation Chemicals
echo "TEST 7: Fumigation Chemicals Query"
echo "----------------------------------"
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "
SELECT 
    fc.id,
    fc.chemical_id,
    fc.quantity,
    fc.batch_number,
    c.name as chemical_name,
    c.l_number,
    c.quantity_unit
FROM fumigation_chemicals fc
LEFT JOIN chemicals c ON fc.chemical_id = c.id
WHERE fc.report_id = $REPORT_ID;
" 2>/dev/null

FC_COUNT=$(mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -se "SELECT COUNT(*) FROM fumigation_chemicals WHERE report_id = $REPORT_ID;" 2>/dev/null)
echo "Total fumigation chemicals found: $FC_COUNT"
echo ""

# Summary
echo "======================================"
echo "SUMMARY"
echo "======================================"
echo "Report ID: $REPORT_ID"
echo "Bait Stations: $STATION_COUNT"
echo "Station Chemicals: $SC_COUNT"
echo "Insect Monitors: $IM_COUNT"
echo "Monitors with NULL fields: $NULL_COUNT"
echo "Fumigation Chemicals: $FC_COUNT"
echo ""

# Key Issues Check
if [ "$STATION_COUNT" -gt 0 ] && [ "$SC_COUNT" -eq 0 ]; then
    echo "⚠️  WARNING: Bait stations exist but have NO chemical data!"
    echo "   This is why PDFs show stations but no chemical info."
fi

if [ "$IM_COUNT" -gt 0 ] && [ "$NULL_COUNT" -gt 0 ]; then
    echo "⚠️  WARNING: Insect monitors have NULL monitor_number or location!"
    echo "   These fields are required for proper display."
fi

echo ""
echo "Testing complete!"
