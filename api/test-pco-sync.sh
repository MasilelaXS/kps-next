#!/bin/bash

# ============================================================================
# KPS API Testing Suite - Phase 4.2: PCO Sync & Offline Data
# ============================================================================
# Tests 6-7 sync endpoints for mobile offline support
# Target: 25-30 tests covering full sync, incremental sync, upload, export
# ============================================================================

BASE_URL="http://localhost:3001/api"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0

# Variables to store tokens and IDs
ADMIN_TOKEN=""
PCO1_TOKEN=""
PCO2_TOKEN=""
PCO1_ID=""
PCO2_ID=""
CLIENT1_ID=""
CLIENT2_ID=""
CHEMICAL1_ID=""
CHEMICAL2_ID=""
REPORT1_ID=""
REPORT2_ID=""

# ============================================================================
# Helper Functions
# ============================================================================

print_header() {
    echo -e "${BLUE}"
    echo "============================================================================"
    echo "$1"
    echo "============================================================================"
    echo -e "${NC}"
}

print_test() {
    echo -e "${YELLOW}TEST: $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ PASS: $1${NC}"
    ((PASSED++))
}

print_failure() {
    echo -e "${RED}✗ FAIL: $1${NC}"
    if [ -n "$2" ]; then
        echo -e "${RED}  Details: $2${NC}"
    fi
    ((FAILED++))
}

print_summary() {
    echo ""
    echo -e "${BLUE}============================================================================${NC}"
    echo -e "${BLUE}TEST SUMMARY${NC}"
    echo -e "${BLUE}============================================================================${NC}"
    echo -e "Total Tests: $((PASSED + FAILED))"
    echo -e "${GREEN}Passed: $PASSED${NC}"
    echo -e "${RED}Failed: $FAILED${NC}"
    
    if [ $FAILED -eq 0 ]; then
        echo -e "${GREEN}============================================================================${NC}"
        echo -e "${GREEN}ALL TESTS PASSED! ✓${NC}"
        echo -e "${GREEN}============================================================================${NC}"
        exit 0
    else
        echo -e "${RED}============================================================================${NC}"
        echo -e "${RED}SOME TESTS FAILED${NC}"
        echo -e "${RED}============================================================================${NC}"
        exit 1
    fi
}

# ============================================================================
# PHASE 0: Authentication & Setup
# ============================================================================

print_header "PHASE 0: AUTHENTICATION & SETUP"

# Test 0.1: Admin Login
print_test "0.1: Admin login"
ADMIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"login_id":"admin12345","password":"ResetPassword123"}')

ADMIN_TOKEN=$(echo $ADMIN_RESPONSE | jq -r '.data.token')

if [ "$ADMIN_TOKEN" != "null" ] && [ -n "$ADMIN_TOKEN" ]; then
    print_success "Admin authenticated successfully"
else
    print_failure "Admin authentication failed"
    echo "Response: $ADMIN_RESPONSE"
    exit 1
fi

# Test 0.2: Create PCO1 User
print_test "0.2: Create PCO1 user"
RANDOM_PCO1=$(( ( RANDOM % 90000 )  + 10000 ))

CREATE_PCO1_RESPONSE=$(curl -s -X POST "$BASE_URL/admin/users" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"pco_number\": \"$RANDOM_PCO1\",
    \"name\": \"Test PCO Sync User 1\",
    \"email\": \"testpco${RANDOM_PCO1}@test.com\",
    \"phone\": \"+1234567890\",
    \"password\": \"TestPCO123!\",
    \"role\": \"pco\"
  }")

PCO1_ID=$(echo $CREATE_PCO1_RESPONSE | jq -r '.data.id')

if [ "$PCO1_ID" != "null" ] && [ -n "$PCO1_ID" ]; then
    print_success "PCO1 user created (ID: $PCO1_ID, Number: $RANDOM_PCO1)"
else
    print_failure "Failed to create PCO1 user"
    echo "Response: $CREATE_PCO1_RESPONSE"
    exit 1
fi

# Test 0.3: PCO1 Login
print_test "0.3: PCO1 login"
PCO1_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"login_id\": \"pco${RANDOM_PCO1}\",
    \"password\": \"TestPCO123!\"
  }")

PCO1_TOKEN=$(echo $PCO1_RESPONSE | jq -r '.data.token')

if [ "$PCO1_TOKEN" != "null" ] && [ -n "$PCO1_TOKEN" ]; then
    print_success "PCO1 authenticated successfully"
else
    print_failure "PCO1 authentication failed"
    echo "Response: $PCO1_RESPONSE"
    exit 1
fi

# Test 0.4: Create PCO2 User
print_test "0.4: Create PCO2 user"
RANDOM_PCO2=$(( ( RANDOM % 90000 )  + 10000 ))

CREATE_PCO2_RESPONSE=$(curl -s -X POST "$BASE_URL/admin/users" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"pco_number\": \"$RANDOM_PCO2\",
    \"name\": \"Test PCO Sync User 2\",
    \"email\": \"testpco${RANDOM_PCO2}@test.com\",
    \"phone\": \"+1234567890\",
    \"password\": \"TestPCO123!\",
    \"role\": \"pco\"
  }")

PCO2_ID=$(echo $CREATE_PCO2_RESPONSE | jq -r '.data.id')

if [ "$PCO2_ID" != "null" ] && [ -n "$PCO2_ID" ]; then
    print_success "PCO2 user created (ID: $PCO2_ID, Number: $RANDOM_PCO2)"
else
    print_failure "Failed to create PCO2 user"
    echo "Response: $CREATE_PCO2_RESPONSE"
    exit 1
fi

# Test 0.5: PCO2 Login
print_test "0.5: PCO2 login"
PCO2_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"login_id\": \"pco${RANDOM_PCO2}\",
    \"password\": \"TestPCO123!\"
  }")

PCO2_TOKEN=$(echo $PCO2_RESPONSE | jq -r '.data.token')

if [ "$PCO2_TOKEN" != "null" ] && [ -n "$PCO2_TOKEN" ]; then
    print_success "PCO2 authenticated successfully"
else
    print_failure "PCO2 authentication failed"
    echo "Response: $PCO2_RESPONSE"
    exit 1
fi

# ============================================================================
# PHASE 1: Setup Test Data
# ============================================================================

print_header "PHASE 1: SETUP TEST DATA"

# Test 1.1: Get existing test clients
print_test "1.1: Get existing test clients from database"
CLIENTS_RESPONSE=$(curl -s -X GET "$BASE_URL/admin/clients?page=1&limit=2" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

CLIENT1_ID=$(echo $CLIENTS_RESPONSE | jq -r '.data.clients[0].id')
CLIENT2_ID=$(echo $CLIENTS_RESPONSE | jq -r '.data.clients[1].id // .data.clients[0].id')

if [ "$CLIENT1_ID" != "null" ] && [ -n "$CLIENT1_ID" ]; then
    print_success "Test clients found (Client1: $CLIENT1_ID, Client2: $CLIENT2_ID)"
else
    print_failure "No test clients found in database"
    exit 1
fi

# Test 1.2: Unassign any existing PCO from clients using bulk unassign
print_test "1.2: Unassign any existing PCO from test clients"

# Get all active assignment IDs for both clients
ASSIGNMENT_IDS=$(curl -s -X GET "$BASE_URL/admin/assignments?status=active&page=1&limit=100" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq -r ".data.assignments[] | select(.client_id == $CLIENT1_ID or .client_id == $CLIENT2_ID) | .id" | tr '\n' ',' | sed 's/,$//')

if [ -n "$ASSIGNMENT_IDS" ] && [ "$ASSIGNMENT_IDS" != "" ]; then
    # Convert comma-separated to JSON array
    IDS_ARRAY="[${ASSIGNMENT_IDS}]"
    UNASSIGN_RESPONSE=$(curl -s -X POST "$BASE_URL/admin/assignments/bulk-unassign" \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"assignment_ids\":$IDS_ARRAY}")
    UNASSIGN_SUCCESS=$(echo $UNASSIGN_RESPONSE | jq -r '.success')
    if [ "$UNASSIGN_SUCCESS" = "true" ]; then
        print_success "Existing assignments cleared"
    else
        print_failure "Failed to clear assignments"
        echo "Response: $UNASSIGN_RESPONSE"
        exit 1
    fi
else
    print_success "No existing assignments to clear"
fi

# Test 1.3: Assign both clients to PCO1
print_test "1.3: Assign both clients to PCO1"
ASSIGN_RESPONSE=$(curl -s -X POST "$BASE_URL/admin/assignments/bulk-assign" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"pco_id\":$PCO1_ID,\"client_ids\":[$CLIENT1_ID,$CLIENT2_ID]}")

ASSIGN_SUCCESS=$(echo $ASSIGN_RESPONSE | jq -r '.success')

if [ "$ASSIGN_SUCCESS" = "true" ]; then
    print_success "Both clients assigned to PCO1"
else
    print_failure "Failed to assign clients"
    echo "Response: $ASSIGN_RESPONSE"
    exit 1
fi

# Test 1.4: Get chemical IDs
print_test "1.4: Get chemical IDs for testing"
CHEMICALS_RESPONSE=$(curl -s -X GET "$BASE_URL/pco/sync/chemicals" \
  -H "Authorization: Bearer $PCO1_TOKEN")

CHEMICAL1_ID=$(echo $CHEMICALS_RESPONSE | jq -r '.data[0].id')
CHEMICAL2_ID=$(echo $CHEMICALS_RESPONSE | jq -r '.data[1].id // .data[0].id')

if [ "$CHEMICAL1_ID" != "null" ] && [ -n "$CHEMICAL1_ID" ]; then
    print_success "Chemical IDs retrieved (Chem1: $CHEMICAL1_ID, Chem2: $CHEMICAL2_ID)"
else
    print_failure "Failed to retrieve chemical IDs"
fi

# Test 1.5: Create test reports (using sync upload endpoint since it works)
print_test "1.5: Create 3 test reports for client 1"
REPORT_DATES=()
for i in {1..3}; do
    SERVICE_DATE=$(date -d "-${i} days" +%Y-%m-%d 2>/dev/null || date -v "-${i}d" +%Y-%m-%d)
    REPORT_DATES+=("$SERVICE_DATE")
done

BULK_CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/pco/sync/upload" \
  -H "Authorization: Bearer $PCO1_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"reports\": [
      {
        \"local_id\": \"test_setup_1\",
        \"client_id\": $CLIENT1_ID,
        \"report_type\": \"bait_inspection\",
        \"service_date\": \"${REPORT_DATES[0]}\",
        \"pco_signature_data\": \"data:image/png;base64,test\",
        \"client_signature_data\": \"data:image/png;base64,test\",
        \"client_signature_name\": \"Test Client\",
        \"bait_stations\": [{\"station_number\": \"ST001\", \"location\": \"inside\"}]
      },
      {
        \"local_id\": \"test_setup_2\",
        \"client_id\": $CLIENT1_ID,
        \"report_type\": \"bait_inspection\",
        \"service_date\": \"${REPORT_DATES[1]}\",
        \"pco_signature_data\": \"data:image/png;base64,test\",
        \"client_signature_data\": \"data:image/png;base64,test\",
        \"client_signature_name\": \"Test Client\",
        \"bait_stations\": [{\"station_number\": \"ST002\", \"location\": \"outside\"}]
      },
      {
        \"local_id\": \"test_setup_3\",
        \"client_id\": $CLIENT1_ID,
        \"report_type\": \"bait_inspection\",
        \"service_date\": \"${REPORT_DATES[2]}\",
        \"pco_signature_data\": \"data:image/png;base64,test\",
        \"client_signature_data\": \"data:image/png;base64,test\",
        \"client_signature_name\": \"Test Client\",
        \"bait_stations\": [{\"station_number\": \"ST003\", \"location\": \"inside\"}]
      }
    ]
  }")

SETUP_SUCCESS=$(echo $BULK_CREATE_RESPONSE | jq -r '.success')
SETUP_SUCCESSFUL=$(echo $BULK_CREATE_RESPONSE | jq -r '.summary.successful')
REPORT1_ID=$(echo $BULK_CREATE_RESPONSE | jq -r '.results[0].server_id')

if [ "$SETUP_SUCCESS" = "true" ] && [ "$SETUP_SUCCESSFUL" -ge "1" ]; then
    print_success "Test reports created ($SETUP_SUCCESSFUL reports)"
else
    print_failure "Failed to create test reports"
fi

# ============================================================================
# PHASE 2: Full Sync Tests
# ============================================================================

print_header "PHASE 2: FULL SYNC TESTS"

# Test 2.1: Full sync with authenticated PCO
print_test "2.1: Full sync returns complete dataset"
FULL_SYNC_RESPONSE=$(curl -s -X GET "$BASE_URL/pco/sync/full" \
  -H "Authorization: Bearer $PCO1_TOKEN")

SYNC_SUCCESS=$(echo $FULL_SYNC_RESPONSE | jq -r '.success')
SYNC_CLIENTS=$(echo $FULL_SYNC_RESPONSE | jq -r '.data.clients | length')
SYNC_CHEMICALS=$(echo $FULL_SYNC_RESPONSE | jq -r '.data.chemicals | length')
SYNC_REPORTS=$(echo $FULL_SYNC_RESPONSE | jq -r '.data.reports | length')

if [ "$SYNC_SUCCESS" = "true" ] && [ "$SYNC_CLIENTS" -ge 2 ]; then
    print_success "Full sync successful (Clients: $SYNC_CLIENTS, Chemicals: $SYNC_CHEMICALS, Reports: $SYNC_REPORTS)"
else
    print_failure "Full sync failed or returned incomplete data" "Success: $SYNC_SUCCESS, Clients: $SYNC_CLIENTS"
fi

# Test 2.2: Verify user profile in sync
print_test "2.2: Full sync includes user profile"
SYNC_USER_ID=$(echo $FULL_SYNC_RESPONSE | jq -r '.data.user.id')
SYNC_USER_PCO=$(echo $FULL_SYNC_RESPONSE | jq -r '.data.user.pco_number')

if [ "$SYNC_USER_ID" = "$PCO1_ID" ] && [ "$SYNC_USER_PCO" != "null" ]; then
    print_success "User profile included in sync (PCO: $SYNC_USER_PCO)"
else
    print_failure "User profile missing or incorrect"
fi

# Test 2.3: Verify client contacts included
print_test "2.3: Full sync includes client contacts"
FIRST_CLIENT_CONTACTS=$(echo $FULL_SYNC_RESPONSE | jq -r '.data.clients[0].contacts')

if [ "$FIRST_CLIENT_CONTACTS" != "null" ]; then
    print_success "Client contacts included in sync"
else
    print_failure "Client contacts missing"
fi

# Test 2.4: Verify report sub-modules structure (MariaDB 10.4 returns empty arrays)
print_test "2.4: Full sync includes report sub-modules"
FIRST_REPORT=$(echo $FULL_SYNC_RESPONSE | jq -r '.data.reports[0]')
if [ "$FIRST_REPORT" = "null" ]; then
    print_success "No reports yet (will check structure when reports exist)"
else
    HAS_BAIT_STATIONS=$(echo $FIRST_REPORT | jq -r 'has("bait_stations")')
    HAS_FUMIGATION=$(echo $FIRST_REPORT | jq -r 'has("fumigation")')
    HAS_MONITORS=$(echo $FIRST_REPORT | jq -r 'has("insect_monitors")')
    
    if [ "$HAS_BAIT_STATIONS" = "true" ] && [ "$HAS_FUMIGATION" = "true" ] && [ "$HAS_MONITORS" = "true" ]; then
        print_success "Report sub-modules structure included (empty for MariaDB 10.4)"
    else
        print_failure "Report sub-modules missing" "Bait: $HAS_BAIT_STATIONS, Fum: $HAS_FUMIGATION, Mon: $HAS_MONITORS"
    fi
fi

# Test 2.5: Verify sync timestamp
print_test "2.5: Full sync includes sync timestamp"
SYNC_TIMESTAMP=$(echo $FULL_SYNC_RESPONSE | jq -r '.sync_timestamp')

if [ "$SYNC_TIMESTAMP" != "null" ] && [ -n "$SYNC_TIMESTAMP" ]; then
    print_success "Sync timestamp included: $SYNC_TIMESTAMP"
else
    print_failure "Sync timestamp missing"
fi

# Test 2.6: Unauthorized access blocked
print_test "2.6: Full sync blocks unauthorized access"
UNAUTH_RESPONSE=$(curl -s -X GET "$BASE_URL/pco/sync/full")
UNAUTH_SUCCESS=$(echo $UNAUTH_RESPONSE | jq -r '.success')

if [ "$UNAUTH_SUCCESS" = "false" ] || [ "$UNAUTH_SUCCESS" = "null" ]; then
    print_success "Unauthorized access blocked"
else
    print_failure "Unauthorized access not blocked properly"
fi

# ============================================================================
# PHASE 3: Incremental Sync Tests
# ============================================================================

print_header "PHASE 3: INCREMENTAL SYNC TESTS"

# Get current timestamp for incremental tests
SYNC_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
sleep 2

# Test 3.1: Client sync without timestamp (all clients)
print_test "3.1: Client sync without timestamp returns all clients"
CLIENT_SYNC_RESPONSE=$(curl -s -X GET "$BASE_URL/pco/sync/clients" \
  -H "Authorization: Bearer $PCO1_TOKEN")

CLIENT_SYNC_SUCCESS=$(echo $CLIENT_SYNC_RESPONSE | jq -r '.success')
CLIENT_SYNC_COUNT=$(echo $CLIENT_SYNC_RESPONSE | jq -r '.count')

if [ "$CLIENT_SYNC_SUCCESS" = "true" ] && [ "$CLIENT_SYNC_COUNT" -ge 2 ]; then
    print_success "Client sync returned $CLIENT_SYNC_COUNT clients"
else
    print_failure "Client sync failed" "Success: $CLIENT_SYNC_SUCCESS, Count: $CLIENT_SYNC_COUNT"
fi

# Test 3.2: Client sync with timestamp (recent assignments included)
print_test "3.2: Client sync with recent timestamp includes new assignments"
CLIENT_SYNC_RECENT=$(curl -s -X GET "$BASE_URL/pco/sync/clients?since=$SYNC_TIME" \
  -H "Authorization: Bearer $PCO1_TOKEN")

CLIENT_SYNC_RECENT_COUNT=$(echo $CLIENT_SYNC_RECENT | jq -r '.count')

# Clients just assigned should appear in incremental sync (assigned_at is recent)
if [ "$CLIENT_SYNC_RECENT_COUNT" -ge 1 ]; then
    print_success "Recent assignments included in sync ($CLIENT_SYNC_RECENT_COUNT clients)"
else
    print_failure "Client sync should include recently assigned clients" "Count: $CLIENT_SYNC_RECENT_COUNT"
fi

# Test 3.3: Chemical sync without timestamp
print_test "3.3: Chemical sync without timestamp returns all chemicals"
CHEM_SYNC_RESPONSE=$(curl -s -X GET "$BASE_URL/pco/sync/chemicals" \
  -H "Authorization: Bearer $PCO1_TOKEN")

CHEM_SYNC_SUCCESS=$(echo $CHEM_SYNC_RESPONSE | jq -r '.success')
CHEM_SYNC_COUNT=$(echo $CHEM_SYNC_RESPONSE | jq -r '.count')

if [ "$CHEM_SYNC_SUCCESS" = "true" ] && [ "$CHEM_SYNC_COUNT" -gt 0 ]; then
    print_success "Chemical sync returned $CHEM_SYNC_COUNT chemicals"
else
    print_failure "Chemical sync failed" "Success: $CHEM_SYNC_SUCCESS, Count: $CHEM_SYNC_COUNT"
fi

# Test 3.4: Chemical sync with timestamp
print_test "3.4: Chemical sync with recent timestamp returns no chemicals"
CHEM_SYNC_RECENT=$(curl -s -X GET "$BASE_URL/pco/sync/chemicals?since=$SYNC_TIME" \
  -H "Authorization: Bearer $PCO1_TOKEN")

CHEM_SYNC_RECENT_COUNT=$(echo $CHEM_SYNC_RECENT | jq -r '.count')

if [ "$CHEM_SYNC_RECENT_COUNT" = "0" ]; then
    print_success "No chemicals returned for recent timestamp (correct)"
else
    print_failure "Chemical sync should return 0 for recent timestamp" "Count: $CHEM_SYNC_RECENT_COUNT"
fi

# Test 3.5: Report sync without timestamp
print_test "3.5: Report sync without timestamp returns all reports"
REPORT_SYNC_RESPONSE=$(curl -s -X GET "$BASE_URL/pco/sync/reports" \
  -H "Authorization: Bearer $PCO1_TOKEN")

REPORT_SYNC_SUCCESS=$(echo $REPORT_SYNC_RESPONSE | jq -r '.success')
REPORT_SYNC_COUNT=$(echo $REPORT_SYNC_RESPONSE | jq -r '.count')

if [ "$REPORT_SYNC_SUCCESS" = "true" ] && [ "$REPORT_SYNC_COUNT" -ge 1 ]; then
    print_success "Report sync returned $REPORT_SYNC_COUNT reports"
else
    print_failure "Report sync failed" "Success: $REPORT_SYNC_SUCCESS, Count: $REPORT_SYNC_COUNT"
fi

# Test 3.6: Report sync with client filter
print_test "3.6: Report sync filters by client_id"
REPORT_SYNC_FILTERED=$(curl -s -X GET "$BASE_URL/pco/sync/reports?client_id=$CLIENT1_ID" \
  -H "Authorization: Bearer $PCO1_TOKEN")

REPORT_SYNC_FILTERED_COUNT=$(echo $REPORT_SYNC_FILTERED | jq -r '.count')
FIRST_FILTERED_CLIENT=$(echo $REPORT_SYNC_FILTERED | jq -r '.data[0].client_id')

if [ "$FIRST_FILTERED_CLIENT" = "$CLIENT1_ID" ]; then
    print_success "Report sync filtered by client correctly ($REPORT_SYNC_FILTERED_COUNT reports)"
else
    print_failure "Report sync client filter not working" "Expected: $CLIENT1_ID, Got: $FIRST_FILTERED_CLIENT"
fi

# ============================================================================
# PHASE 4: Report Upload Tests
# ============================================================================

print_header "PHASE 4: REPORT UPLOAD TESTS"

# Test 4.1: Upload single report
print_test "4.1: Upload single offline report"
UPLOAD_DATE=$(date +%Y-%m-%d)
UPLOAD_RESPONSE=$(curl -s -X POST "$BASE_URL/pco/sync/upload" \
  -H "Authorization: Bearer $PCO1_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"reports\": [{
      \"local_id\": \"local_001\",
      \"client_id\": $CLIENT1_ID,
      \"report_type\": \"bait_inspection\",
      \"service_date\": \"$UPLOAD_DATE\",
      \"pco_signature_data\": \"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==\",
      \"client_signature_data\": \"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==\",
      \"client_signature_name\": \"Test Client\",
      \"general_remarks\": \"Test upload from offline\",
      \"bait_stations\": [{
        \"station_number\": \"BS-001\",
        \"location\": \"inside\",
        \"bait_status\": \"clean\",
        \"station_condition\": \"good\",
        \"chemicals\": [{
          \"chemical_id\": $CHEMICAL1_ID,
          \"quantity\": 50,
          \"batch_number\": \"BATCH001\"
        }]
      }]
    }]
  }")

UPLOAD_SUCCESS=$(echo $UPLOAD_RESPONSE | jq -r '.success')
UPLOAD_SUCCESSFUL_COUNT=$(echo $UPLOAD_RESPONSE | jq -r '.summary.successful')
UPLOAD_SERVER_ID=$(echo $UPLOAD_RESPONSE | jq -r '.results[0].server_id')

if [ "$UPLOAD_SUCCESS" = "true" ] && [ "$UPLOAD_SUCCESSFUL_COUNT" = "1" ] && [ "$UPLOAD_SERVER_ID" != "null" ]; then
    print_success "Single report uploaded successfully (Server ID: $UPLOAD_SERVER_ID)"
else
    print_failure "Failed to upload single report" "Success: $UPLOAD_SUCCESS, Server ID: $UPLOAD_SERVER_ID"
fi

# Test 4.2: Upload batch of reports
print_test "4.2: Upload batch of multiple reports"
BATCH_DATE1=$(date -d "-1 day" +%Y-%m-%d 2>/dev/null || date -v "-1d" +%Y-%m-%d)
BATCH_DATE2=$(date -d "-2 days" +%Y-%m-%d 2>/dev/null || date -v "-2d" +%Y-%m-%d)

BATCH_UPLOAD_RESPONSE=$(curl -s -X POST "$BASE_URL/pco/sync/upload" \
  -H "Authorization: Bearer $PCO1_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"reports\": [
      {
        \"local_id\": \"local_002\",
        \"client_id\": $CLIENT1_ID,
        \"report_type\": \"bait_inspection\",
        \"service_date\": \"$BATCH_DATE1\",
        \"pco_signature_data\": \"data:image/png;base64,test\",
        \"client_signature_data\": \"data:image/png;base64,test\",
        \"client_signature_name\": \"Batch Test 1\",
        \"bait_stations\": [{
          \"station_number\": \"ST001\",
          \"location\": \"outside\"
        }]
      },
      {
        \"local_id\": \"local_003\",
        \"client_id\": $CLIENT2_ID,
        \"report_type\": \"fumigation\",
        \"service_date\": \"$BATCH_DATE2\",
        \"pco_signature_data\": \"data:image/png;base64,test\",
        \"client_signature_data\": \"data:image/png;base64,test\",
        \"client_signature_name\": \"Batch Test 2\",
        \"fumigation\": {
          \"areas\": [{\"area_name\": \"Kitchen\"}],
          \"target_pests\": [{\"pest_name\": \"Cockroach\"}],
          \"chemicals\": [{\"chemical_id\": $CHEMICAL2_ID, \"quantity\": 100}]
        }
      }
    ]
  }")

BATCH_SUCCESS=$(echo $BATCH_UPLOAD_RESPONSE | jq -r '.success')
BATCH_SUCCESSFUL=$(echo $BATCH_UPLOAD_RESPONSE | jq -r '.summary.successful')
BATCH_FAILED=$(echo $BATCH_UPLOAD_RESPONSE | jq -r '.summary.failed')

if [ "$BATCH_SUCCESS" = "true" ] && [ "$BATCH_SUCCESSFUL" -ge "1" ]; then
    print_success "Batch upload processed ($BATCH_SUCCESSFUL uploaded, $BATCH_FAILED failed)"
else
    print_failure "Batch upload failed" "Success: $BATCH_SUCCESS, Uploaded: $BATCH_SUCCESSFUL, Failed: $BATCH_FAILED"
fi

# Test 4.3: Upload duplicate report (should fail)
print_test "4.3: Upload duplicate report rejected"
DUPLICATE_RESPONSE=$(curl -s -X POST "$BASE_URL/pco/sync/upload" \
  -H "Authorization: Bearer $PCO1_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"reports\": [{
      \"local_id\": \"local_004\",
      \"client_id\": $CLIENT1_ID,
      \"report_type\": \"bait_inspection\",
      \"service_date\": \"$UPLOAD_DATE\",
      \"pco_signature_data\": \"data:image/png;base64,test\",
      \"client_signature_data\": \"data:image/png;base64,test\",
      \"client_signature_name\": \"Duplicate Test\"
    }]
  }")

DUP_ERRORS=$(echo $DUPLICATE_RESPONSE | jq -r '.errors | length')

if [ "$DUP_ERRORS" -gt 0 ]; then
    print_success "Duplicate report rejected (error count: $DUP_ERRORS)"
else
    print_failure "Duplicate report should be rejected"
fi

# Test 4.4: Upload with unassigned client (should fail)
print_test "4.4: Upload to unassigned client rejected"
UNASSIGNED_RESPONSE=$(curl -s -X POST "$BASE_URL/pco/sync/upload" \
  -H "Authorization: Bearer $PCO2_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"reports\": [{
      \"local_id\": \"local_005\",
      \"client_id\": $CLIENT1_ID,
      \"report_type\": \"bait_inspection\",
      \"service_date\": \"$(date +%Y-%m-%d)\",
      \"pco_signature_data\": \"data:image/png;base64,test\",
      \"client_signature_data\": \"data:image/png;base64,test\",
      \"client_signature_name\": \"Unassigned Test\"
    }]
  }")

UNASSIGNED_ERRORS=$(echo $UNASSIGNED_RESPONSE | jq -r '.errors | length' 2>/dev/null || echo "0")
UNASSIGNED_SUCCESS=$(echo $UNASSIGNED_RESPONSE | jq -r '.success')

if [ "$UNASSIGNED_SUCCESS" = "false" ] || [ "$UNASSIGNED_ERRORS" -gt 0 ]; then
    print_success "Unassigned client upload rejected"
else
    print_failure "Unassigned client upload should be rejected" "Success: $UNASSIGNED_SUCCESS"
fi

# Test 4.5: Upload with missing required fields (should fail)
print_test "4.5: Upload with missing required fields rejected"
INVALID_RESPONSE=$(curl -s -X POST "$BASE_URL/pco/sync/upload" \
  -H "Authorization: Bearer $PCO1_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"reports\": [{
      \"local_id\": \"local_006\",
      \"client_id\": $CLIENT1_ID,
      \"report_type\": \"baiting\"
    }]
  }")

INVALID_SUCCESS=$(echo $INVALID_RESPONSE | jq -r '.success')

if [ "$INVALID_SUCCESS" = "false" ] || [[ $(echo $INVALID_RESPONSE | jq -r '.errors | length') -gt 0 ]]; then
    print_success "Invalid report rejected"
else
    print_failure "Invalid report should be rejected"
fi

# Test 4.6: Verify local_id to server_id mapping
print_test "4.6: Upload returns local_id to server_id mapping"
MAPPING_CHECK=$(echo $UPLOAD_RESPONSE | jq -r '.results[0]')
HAS_LOCAL_ID=$(echo $MAPPING_CHECK | jq -r 'has("local_id")')
HAS_SERVER_ID=$(echo $MAPPING_CHECK | jq -r 'has("server_id")')

if [ "$HAS_LOCAL_ID" = "true" ] && [ "$HAS_SERVER_ID" = "true" ]; then
    print_success "Upload provides local_id to server_id mapping"
else
    print_failure "Upload missing ID mapping" "Local: $HAS_LOCAL_ID, Server: $HAS_SERVER_ID"
fi

# ============================================================================
# PHASE 5: Data Export Tests
# ============================================================================

print_header "PHASE 5: DATA EXPORT TESTS"

# Test 5.1: Export complete dataset
print_test "5.1: Export complete dataset"
EXPORT_RESPONSE=$(curl -s -X GET "$BASE_URL/pco/data/export" \
  -H "Authorization: Bearer $PCO1_TOKEN")

EXPORT_SUCCESS=$(echo $EXPORT_RESPONSE | jq -r '.success')
EXPORT_HAS_DATA=$(echo $EXPORT_RESPONSE | jq -r 'has("data")')
EXPORT_DATE=$(echo $EXPORT_RESPONSE | jq -r '.data.export_date')

if [ "$EXPORT_SUCCESS" = "true" ] && [ "$EXPORT_HAS_DATA" = "true" ] && [ "$EXPORT_DATE" != "null" ]; then
    print_success "Data export successful (Date: $EXPORT_DATE)"
else
    print_failure "Data export failed" "Success: $EXPORT_SUCCESS, Has Data: $EXPORT_HAS_DATA"
fi

# Test 5.2: Verify export structure
print_test "5.2: Export includes all required sections"
HAS_PCO=$(echo $EXPORT_RESPONSE | jq -r '.data | has("pco")')
HAS_CLIENTS=$(echo $EXPORT_RESPONSE | jq -r '.data | has("clients")')
HAS_CHEMICALS=$(echo $EXPORT_RESPONSE | jq -r '.data | has("chemicals")')
HAS_REPORTS=$(echo $EXPORT_RESPONSE | jq -r '.data | has("reports")')
HAS_METADATA=$(echo $EXPORT_RESPONSE | jq -r '.data | has("metadata")')

if [ "$HAS_PCO" = "true" ] && [ "$HAS_CLIENTS" = "true" ] && [ "$HAS_CHEMICALS" = "true" ] && [ "$HAS_REPORTS" = "true" ] && [ "$HAS_METADATA" = "true" ]; then
    print_success "Export structure complete (pco, clients, chemicals, reports, metadata)"
else
    print_failure "Export structure incomplete" "PCO:$HAS_PCO Clients:$HAS_CLIENTS Chems:$HAS_CHEMICALS Reports:$HAS_REPORTS Meta:$HAS_METADATA"
fi

# Test 5.3: Verify export metadata
print_test "5.3: Export metadata includes counts"
EXPORT_META_CLIENTS=$(echo $EXPORT_RESPONSE | jq -r '.data.metadata.total_clients')
EXPORT_META_CHEMS=$(echo $EXPORT_RESPONSE | jq -r '.data.metadata.total_chemicals')
EXPORT_META_REPORTS=$(echo $EXPORT_RESPONSE | jq -r '.data.metadata.total_reports')

if [ "$EXPORT_META_CLIENTS" != "null" ] && [ "$EXPORT_META_CHEMS" != "null" ] && [ "$EXPORT_META_REPORTS" != "null" ]; then
    print_success "Export metadata complete (Clients: $EXPORT_META_CLIENTS, Chemicals: $EXPORT_META_CHEMS, Reports: $EXPORT_META_REPORTS)"
else
    print_failure "Export metadata missing counts"
fi

# ============================================================================
# PHASE 6: Performance & Edge Cases
# ============================================================================

print_header "PHASE 6: PERFORMANCE & EDGE CASES"

# Test 6.1: Full sync response time
print_test "6.1: Full sync completes within 3 seconds"
START_TIME=$(date +%s)
PERF_SYNC=$(curl -s -X GET "$BASE_URL/pco/sync/full" -H "Authorization: Bearer $PCO1_TOKEN")
END_TIME=$(date +%s)
SYNC_DURATION=$((END_TIME - START_TIME))

if [ $SYNC_DURATION -le 3 ]; then
    print_success "Full sync completed in ${SYNC_DURATION}s (target: <3s)"
else
    print_failure "Full sync too slow: ${SYNC_DURATION}s (target: <3s)"
fi

# Test 6.2: Incremental sync response time
print_test "6.2: Incremental sync completes within 1 second"
START_TIME=$(date +%s)
PERF_INC=$(curl -s -X GET "$BASE_URL/pco/sync/reports?since=$SYNC_TIME" -H "Authorization: Bearer $PCO1_TOKEN")
END_TIME=$(date +%s)
INC_DURATION=$((END_TIME - START_TIME))

if [ $INC_DURATION -le 1 ]; then
    print_success "Incremental sync completed in ${INC_DURATION}s (target: <1s)"
else
    print_failure "Incremental sync too slow: ${INC_DURATION}s (target: <1s)"
fi

# Test 6.3: Empty reports array rejected
print_test "6.3: Empty reports array rejected"
EMPTY_RESPONSE=$(curl -s -X POST "$BASE_URL/pco/sync/upload" \
  -H "Authorization: Bearer $PCO1_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reports":[]}')

EMPTY_SUCCESS=$(echo $EMPTY_RESPONSE | jq -r '.success')

if [ "$EMPTY_SUCCESS" = "false" ]; then
    print_success "Empty reports array rejected"
else
    print_failure "Empty reports array should be rejected"
fi

# Test 6.4: PCO isolation (PCO2 can't see PCO1's data)
print_test "6.4: PCO data isolation enforced"
PCO2_SYNC=$(curl -s -X GET "$BASE_URL/pco/sync/full" -H "Authorization: Bearer $PCO2_TOKEN")
PCO2_CLIENTS=$(echo $PCO2_SYNC | jq -r '.data.clients | length')

if [ "$PCO2_CLIENTS" = "0" ]; then
    print_success "PCO2 correctly sees 0 clients (not assigned to any)"
else
    print_failure "PCO data isolation broken" "PCO2 should see 0 clients, saw: $PCO2_CLIENTS"
fi

# ============================================================================
# Print Final Summary
# ============================================================================

print_summary
