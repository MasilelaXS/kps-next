#!/bin/bash

# Migration runner for XAMPP MySQL
# Run this script to apply database changes

MYSQL_PATH="/c/xamppp/mysql/bin/mysql"
DB_NAME="kpspestcontrol_app"
MIGRATION_FILE="migration-safe.sql"

echo "=========================================="
echo "KPS Database Migration"
echo "=========================================="
echo ""

# Check if MySQL exists
if [ ! -f "$MYSQL_PATH" ]; then
    echo "❌ Error: MySQL not found at $MYSQL_PATH"
    echo "Please update MYSQL_PATH in this script"
    exit 1
fi

# Check if migration file exists
if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ Error: Migration file not found: $MIGRATION_FILE"
    exit 1
fi

echo "📋 Migration file: $MIGRATION_FILE"
echo "🗄️  Database: $DB_NAME"
echo ""

# Ask for confirmation
read -p "Continue with migration? (y/n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Migration cancelled"
    exit 0
fi

echo ""
echo "🚀 Running migration..."
echo ""

# Run the migration
"$MYSQL_PATH" -u root "$DB_NAME" < "$MIGRATION_FILE"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Migration completed successfully!"
    echo ""
    echo "📊 Verification Results:"
    echo "----------------------------------------"
    
    # Run verification queries
    "$MYSQL_PATH" -u root "$DB_NAME" -e "
    SELECT 'Bait Stations:' as Info;
    SELECT COUNT(*) as total_records FROM bait_stations;
    
    SELECT 'Insect Monitors:' as Info;
    SELECT COUNT(*) as total_records FROM insect_monitors;
    
    SELECT 'Reports:' as Info;
    SELECT COUNT(*) as total_records FROM reports;
    "
    
else
    echo ""
    echo "❌ Migration failed!"
    echo "Check the error messages above"
    exit 1
fi
