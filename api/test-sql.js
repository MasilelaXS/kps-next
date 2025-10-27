/**
 * SQL Query Test Script
 * Tests all SQL queries used in PDF generation to verify data retrieval
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME,
};

async function testSQLQueries() {
  let connection;
  
  try {
    console.log('🔌 Connecting to database...');
    console.log(`   Host: ${dbConfig.host}:${dbConfig.port}`);
    console.log(`   Database: ${dbConfig.database}`);
    console.log(`   User: ${dbConfig.user}`);
    console.log('');
    
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to database\n');

    // Test 1: Get a sample report
    console.log('📋 TEST 1: Finding sample reports...');
    const [reports] = await connection.execute(`
      SELECT id, report_type, status, created_at 
      FROM reports 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    if (reports.length === 0) {
      console.log('❌ No reports found in database');
      return;
    }
    
    console.log(`✅ Found ${reports.length} reports:`);
    reports.forEach((r, i) => {
      console.log(`   ${i+1}. ID: ${r.id}, Type: ${r.report_type}, Status: ${r.status}, Date: ${r.created_at}`);
    });
    console.log('');

    // Use the first report for testing
    const reportId = reports[0].id;
    const serviceType = reports[0].report_type;
    console.log(`🎯 Testing with Report ID: ${reportId} (${serviceType})\n`);

    // Test 2: Bait Stations Query
    console.log('📊 TEST 2: Bait Stations Query...');
    const [baitStations] = await connection.execute(`
      SELECT 
        bs.*,
        sc.chemical_id,
        sc.quantity,
        sc.batch_number,
        c.name as chemical_name,
        c.l_number,
        c.quantity_unit
      FROM bait_stations bs
      LEFT JOIN station_chemicals sc ON bs.id = sc.station_id
      LEFT JOIN chemicals c ON sc.chemical_id = c.id
      WHERE bs.report_id = ?
      ORDER BY bs.location, bs.station_number
    `, [reportId]);
    
    console.log(`   Found ${baitStations.length} bait station records`);
    if (baitStations.length > 0) {
      console.log(`   Sample record:`, JSON.stringify(baitStations[0], null, 2));
      
      // Check for key fields
      const sample = baitStations[0];
      console.log(`   ✓ station_number: ${sample.station_number}`);
      console.log(`   ✓ location: ${sample.location}`);
      console.log(`   ✓ bait_status: ${sample.bait_status}`);
      console.log(`   ✓ activity_status: ${sample.activity_status}`);
      console.log(`   ✓ chemical_name: ${sample.chemical_name}`);
      console.log(`   ✓ l_number: ${sample.l_number}`);
    } else {
      console.log('   ⚠️ No bait stations found for this report');
    }
    console.log('');

    // Test 3: Fumigation Chemicals Query
    console.log('📊 TEST 3: Fumigation Chemicals Query...');
    const [fumChemicals] = await connection.execute(`
      SELECT 
        fc.*,
        c.name as chemical_name,
        c.l_number,
        c.quantity_unit
      FROM fumigation_chemicals fc
      LEFT JOIN chemicals c ON fc.chemical_id = c.id
      WHERE fc.report_id = ?
      ORDER BY c.name
    `, [reportId]);
    
    console.log(`   Found ${fumChemicals.length} fumigation chemical records`);
    if (fumChemicals.length > 0) {
      console.log(`   Sample record:`, JSON.stringify(fumChemicals[0], null, 2));
    }
    console.log('');

    // Test 4: Fumigation Areas Query
    console.log('📊 TEST 4: Fumigation Areas Query...');
    const [fumAreas] = await connection.execute(`
      SELECT *
      FROM fumigation_areas
      WHERE report_id = ?
      ORDER BY area_name
    `, [reportId]);
    
    console.log(`   Found ${fumAreas.length} fumigation area records`);
    if (fumAreas.length > 0) {
      console.log(`   Sample record:`, JSON.stringify(fumAreas[0], null, 2));
    }
    console.log('');

    // Test 5: Fumigation Target Pests Query
    console.log('📊 TEST 5: Fumigation Target Pests Query...');
    const [fumPests] = await connection.execute(`
      SELECT *
      FROM fumigation_target_pests
      WHERE report_id = ?
      ORDER BY pest_name
    `, [reportId]);
    
    console.log(`   Found ${fumPests.length} fumigation pest records`);
    if (fumPests.length > 0) {
      console.log(`   Sample record:`, JSON.stringify(fumPests[0], null, 2));
    }
    console.log('');

    // Test 6: Insect Monitors Query
    console.log('📊 TEST 6: Insect Monitors Query...');
    const [insectMonitors] = await connection.execute(`
      SELECT *
      FROM insect_monitors
      WHERE report_id = ?
      ORDER BY location, monitor_number, monitor_type, id
    `, [reportId]);
    
    console.log(`   Found ${insectMonitors.length} insect monitor records`);
    if (insectMonitors.length > 0) {
      console.log(`   Sample record:`, JSON.stringify(insectMonitors[0], null, 2));
      
      const sample = insectMonitors[0];
      console.log(`   ✓ monitor_number: ${sample.monitor_number}`);
      console.log(`   ✓ location: ${sample.location}`);
      console.log(`   ✓ monitor_type: ${sample.monitor_type}`);
      console.log(`   ✓ condition: ${sample.condition}`);
    }
    console.log('');

    // Test 7: Check report details
    console.log('📊 TEST 7: Report Details Query...');
    const [reportDetails] = await connection.execute(`
      SELECT 
        r.*,
        c.company_name,
        c.address,
        c.city,
        u.first_name as pco_first_name,
        u.last_name as pco_last_name
      FROM reports r
      LEFT JOIN clients c ON r.client_id = c.id
      LEFT JOIN users u ON r.pco_id = u.id
      WHERE r.id = ?
    `, [reportId]);
    
    if (reportDetails.length > 0) {
      console.log(`   ✓ Report found`);
      const report = reportDetails[0];
      console.log(`   ✓ report_type: ${report.report_type}`);
      console.log(`   ✓ client: ${report.company_name}`);
      console.log(`   ✓ pco: ${report.pco_first_name} ${report.pco_last_name}`);
      console.log(`   ✓ service_date: ${report.service_date}`);
      console.log(`   ✓ status: ${report.status}`);
    }
    console.log('');

    // Summary
    console.log('📈 SUMMARY:');
    console.log(`   Report ID: ${reportId}`);
    console.log(`   Service Type: ${serviceType}`);
    console.log(`   Bait Stations: ${baitStations.length}`);
    console.log(`   Fumigation Chemicals: ${fumChemicals.length}`);
    console.log(`   Fumigation Areas: ${fumAreas.length}`);
    console.log(`   Fumigation Pests: ${fumPests.length}`);
    console.log(`   Insect Monitors: ${insectMonitors.length}`);
    console.log('');

    if (serviceType === 'bait_inspection' && baitStations.length === 0) {
      console.log('⚠️  WARNING: This is a bait inspection report but has no bait stations!');
    }
    
    if (serviceType === 'fumigation' && fumChemicals.length === 0) {
      console.log('⚠️  WARNING: This is a fumigation report but has no chemicals!');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run the tests
testSQLQueries();
