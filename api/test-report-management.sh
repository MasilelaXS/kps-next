#!/bin/bash

# ============================================================================
# KPS Pest Control Management System
# Phase 3.2: Report Management Testing Suite
# ============================================================================
# Tests all 22 Report Management endpoints with comprehensive validation
# 
# Test Coverage:
# - Authentication & Authorization
# - Report CRUD operations
# - Status workflow (draft → pending → approved/declined)
# - Bait Station management
# - Fumigation management
# - Insect Monitor management
# - Pre-fill functionality
# - Business logic: auto-unassign, reassignment
# ============================================================================

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Base URL
BASE_URL="http://localhost:3001/api"

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Auth tokens (will be populated)
ADMIN_TOKEN=""
PCO_TOKEN=""

# Test data IDs (will be populated during tests)
TEST_CLIENT_ID=""
TEST_REPORT_ID=""
TEST_BAIT_STATION_ID=""
TEST_INSECT_MONITOR_ID=""
TEST_CHEMICAL_ID=""

# ============================================================================
# Helper Functions
# ============================================================================

print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

print_test() {
    echo -e "${YELLOW}TEST $1:${NC} $2"
}

print_success() {
    echo -e "${GREEN}✓ PASS:${NC} $1"
    ((PASSED_TESTS++))
    ((TOTAL_TESTS++))
}

print_failure() {
    echo -e "${RED}✗ FAIL:${NC} $1"
    echo -e "${RED}  Response:${NC} $2"
    ((FAILED_TESTS++))
    ((TOTAL_TESTS++))
}

# ============================================================================
# Setup: Authentication
# ============================================================================

print_header "SETUP: Authentication"

print_test "0.1" "Admin Login"
ADMIN_LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "login_id": "admin12345",
    "password": "ResetPassword123"
  }')

ADMIN_TOKEN=$(echo $ADMIN_LOGIN_RESPONSE | jq -r '.data.token')

if [ "$ADMIN_TOKEN" != "null" ] && [ -n "$ADMIN_TOKEN" ]; then
    print_success "Admin authenticated successfully"
else
    print_failure "Admin authentication failed" "$ADMIN_LOGIN_RESPONSE"
    exit 1
fi

# Create a fresh PCO user for testing to avoid lockout issues
print_test "0.2" "Create fresh PCO user for testing"

# Generate random number to avoid conflicts
RANDOM_PCO=$(( ( RANDOM % 90000 )  + 10000 ))

CREATE_PCO_RESPONSE=$(curl -s -X POST "$BASE_URL/admin/users" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"pco_number\": \"$RANDOM_PCO\",
    \"name\": \"Test PCO User\",
    \"email\": \"testpco${RANDOM_PCO}@test.com\",
    \"phone\": \"+1234567890\",
    \"password\": \"TestPCO123!\",
    \"role\": \"pco\"
  }")

PCO_USER_ID=$(echo $CREATE_PCO_RESPONSE | jq -r '.data.id')

if [ "$PCO_USER_ID" != "null" ] && [ -n "$PCO_USER_ID" ]; then
    print_success "PCO user created (ID: $PCO_USER_ID, Number: $RANDOM_PCO)"
else
    print_failure "Failed to create PCO user" "$CREATE_PCO_RESPONSE"
    exit 1
fi

# Login with the new PCO user
print_test "0.3" "PCO Login"
PCO_LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"login_id\": \"pco${RANDOM_PCO}\",
    \"password\": \"TestPCO123!\"
  }")

PCO_TOKEN=$(echo $PCO_LOGIN_RESPONSE | jq -r '.data.token')

if [ "$PCO_TOKEN" != "null" ] && [ -n "$PCO_TOKEN" ]; then
    print_success "PCO authenticated successfully"
else
    print_failure "PCO authentication failed" "$PCO_LOGIN_RESPONSE"
    exit 1
fi

# ============================================================================
# Setup: Test Data
# ============================================================================

print_header "SETUP: Test Data Preparation"

# Get client ID (should be client 1 from sample data)
TEST_CLIENT_ID=1

# Get chemical ID for testing (use admin chemicals list endpoint)
CHEMICAL_RESPONSE=$(curl -s -X GET "$BASE_URL/admin/chemicals?status=active&usage_type=bait_inspection&limit=1" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

TEST_CHEMICAL_ID=$(echo $CHEMICAL_RESPONSE | jq -r '.data.chemicals[0].id // empty')

if [ -z "$TEST_CHEMICAL_ID" ] || [ "$TEST_CHEMICAL_ID" = "null" ]; then
    # Try any active chemical
    CHEMICAL_RESPONSE=$(curl -s -X GET "$BASE_URL/admin/chemicals?status=active&limit=1" \
      -H "Authorization: Bearer $ADMIN_TOKEN")
    TEST_CHEMICAL_ID=$(echo $CHEMICAL_RESPONSE | jq -r '.data.chemicals[0].id // empty')
fi

if [ -n "$TEST_CHEMICAL_ID" ] && [ "$TEST_CHEMICAL_ID" != "null" ]; then
    print_success "Test data prepared (Client: $TEST_CLIENT_ID, Chemical: $TEST_CHEMICAL_ID)"
else
    print_failure "Failed to prepare test data" "No active chemicals found in database"
    exit 1
fi

# Assign PCO to client (first clean up ALL existing assignments)
print_test "0.4" "Assign PCO to Client"

# Get ALL existing assignments for this client and unassign them
ALL_ASSIGNMENTS=$(curl -s -X GET "$BASE_URL/admin/assignments?client_id=$TEST_CLIENT_ID&status=active" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq -r '[.data.assignments[].id] | join(",")')

# Unassign all if any exist
if [ -n "$ALL_ASSIGNMENTS" ] && [ "$ALL_ASSIGNMENTS" != "null" ] && [ "$ALL_ASSIGNMENTS" != "" ]; then
    curl -s -X POST "$BASE_URL/admin/assignments/bulk-unassign" \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"assignment_ids\": [$ALL_ASSIGNMENTS]}" > /dev/null
fi

# Now assign new PCO
ASSIGNMENT_RESPONSE=$(curl -s -X POST "$BASE_URL/admin/assignments/bulk-assign" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"pco_id\": $PCO_USER_ID,
    \"client_ids\": [$TEST_CLIENT_ID]
  }")

if echo "$ASSIGNMENT_RESPONSE" | jq -e '.success == true' > /dev/null; then
    print_success "PCO (ID: $PCO_USER_ID) assigned to Client (ID: $TEST_CLIENT_ID)"
else
    print_failure "Failed to assign PCO to client" "$ASSIGNMENT_RESPONSE"
    exit 1
fi

# ============================================================================
# TEST GROUP 1: Authentication & Authorization
# ============================================================================

print_header "TEST GROUP 1: Authentication & Authorization"

print_test "1.1" "Access without token (should fail)"
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/pco/reports")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "401" ]; then
    print_success "Unauthorized access blocked correctly"
else
    print_failure "Should block unauthorized access" "HTTP $HTTP_CODE: $BODY"
fi

print_test "1.2" "PCO access to own reports endpoint"
RESPONSE=$(curl -s -X GET "$BASE_URL/pco/reports" \
  -H "Authorization: Bearer $PCO_TOKEN")

if echo "$RESPONSE" | jq -e '.success == true' > /dev/null; then
    print_success "PCO can access own reports endpoint"
else
    print_failure "PCO should access own reports" "$RESPONSE"
fi

print_test "1.3" "Admin access to all reports endpoint"
RESPONSE=$(curl -s -X GET "$BASE_URL/admin/reports" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

if echo "$RESPONSE" | jq -e '.success == true' > /dev/null; then
    print_success "Admin can access all reports endpoint"
else
    print_failure "Admin should access all reports" "$RESPONSE"
fi

# ============================================================================
# TEST GROUP 2: Report Creation (Draft)
# ============================================================================

print_header "TEST GROUP 2: Report Creation"

print_test "2.1" "Create draft report"
RESPONSE=$(curl -s -X POST "$BASE_URL/pco/reports" \
  -H "Authorization: Bearer $PCO_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"client_id\": $TEST_CLIENT_ID,
    \"report_type\": \"both\",
    \"service_date\": \"$(date +%Y-%m-%d)\",
    \"next_service_date\": \"$(date -d '+30 days' +%Y-%m-%d)\",
    \"general_remarks\": \"Test report creation\"
  }")

TEST_REPORT_ID=$(echo "$RESPONSE" | jq -r '.report_id')

if [ "$TEST_REPORT_ID" != "null" ] && [ -n "$TEST_REPORT_ID" ] && echo "$RESPONSE" | jq -e '.success == true' > /dev/null; then
    print_success "Draft report created (ID: $TEST_REPORT_ID)"
else
    print_failure "Failed to create draft report" "$RESPONSE"
fi

print_test "2.2" "Attempt to create duplicate draft (should fail)"
RESPONSE=$(curl -s -X POST "$BASE_URL/pco/reports" \
  -H "Authorization: Bearer $PCO_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"client_id\": $TEST_CLIENT_ID,
    \"report_type\": \"both\",
    \"service_date\": \"$(date +%Y-%m-%d)\",
    \"general_remarks\": \"Duplicate draft test\"
  }")

if echo "$RESPONSE" | jq -e '.success == false' > /dev/null && echo "$RESPONSE" | grep -q "draft report already exists"; then
    print_success "Duplicate draft blocked correctly"
else
    print_failure "Should block duplicate drafts" "$RESPONSE"
fi

print_test "2.3" "Create report without PCO assignment (should fail)"
RESPONSE=$(curl -s -X POST "$BASE_URL/pco/reports" \
  -H "Authorization: Bearer $PCO_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"client_id\": 999,
    \"report_type\": \"both\",
    \"service_date\": \"$(date +%Y-%m-%d)\"
  }")

if echo "$RESPONSE" | jq -e '.success == false' > /dev/null && echo "$RESPONSE" | grep -q "not assigned"; then
    print_success "Unassigned client check working"
else
    print_failure "Should check PCO assignment" "$RESPONSE"
fi

# ============================================================================
# TEST GROUP 3: Bait Station Management
# ============================================================================

print_header "TEST GROUP 3: Bait Station Management"

print_test "3.1" "Add bait station with chemicals"
RESPONSE=$(curl -s -X POST "$BASE_URL/pco/reports/$TEST_REPORT_ID/bait-stations" \
  -H "Authorization: Bearer $PCO_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"station_number\": \"TEST-001\",
    \"location\": \"inside\",
    \"is_accessible\": true,
    \"activity_detected\": true,
    \"activity_droppings\": true,
    \"activity_gnawing\": false,
    \"activity_tracks\": false,
    \"activity_other\": false,
    \"bait_status\": \"eaten\",
    \"station_condition\": \"good\",
    \"rodent_box_replaced\": true,
    \"station_remarks\": \"Test station\",
    \"chemicals\": [
      {
        \"chemical_id\": $TEST_CHEMICAL_ID,
        \"quantity\": 25.5,
        \"batch_number\": \"TEST-BATCH-001\"
      }
    ]
  }")

TEST_BAIT_STATION_ID=$(echo "$RESPONSE" | jq -r '.station_id')

if [ "$TEST_BAIT_STATION_ID" != "null" ] && [ -n "$TEST_BAIT_STATION_ID" ]; then
    print_success "Bait station added (ID: $TEST_BAIT_STATION_ID)"
else
    print_failure "Failed to add bait station" "$RESPONSE"
fi

print_test "3.2" "Update bait station"
RESPONSE=$(curl -s -X PUT "$BASE_URL/pco/reports/$TEST_REPORT_ID/bait-stations/$TEST_BAIT_STATION_ID" \
  -H "Authorization: Bearer $PCO_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "bait_status": "clean",
    "station_remarks": "Updated test station"
  }')

if echo "$RESPONSE" | jq -e '.success == true' > /dev/null; then
    print_success "Bait station updated"
else
    print_failure "Failed to update bait station" "$RESPONSE"
fi

print_test "3.3" "Add second bait station (outside)"
RESPONSE=$(curl -s -X POST "$BASE_URL/pco/reports/$TEST_REPORT_ID/bait-stations" \
  -H "Authorization: Bearer $PCO_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"station_number\": \"TEST-002\",
    \"location\": \"outside\",
    \"is_accessible\": false,
    \"inaccessible_reason\": \"Locked gate\",
    \"activity_detected\": false,
    \"bait_status\": \"clean\",
    \"station_condition\": \"good\",
    \"rodent_box_replaced\": false,
    \"chemicals\": []
  }")

if echo "$RESPONSE" | jq -e '.success == true' > /dev/null; then
    print_success "Second bait station added (inaccessible)"
else
    print_failure "Failed to add second bait station" "$RESPONSE"
fi

# ============================================================================
# TEST GROUP 4: Fumigation Management
# ============================================================================

print_header "TEST GROUP 4: Fumigation Management"

print_test "4.1" "Update fumigation data"
RESPONSE=$(curl -s -X PUT "$BASE_URL/pco/reports/$TEST_REPORT_ID/fumigation" \
  -H "Authorization: Bearer $PCO_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"areas\": [
      { \"area_name\": \"Kitchen\", \"is_other\": false },
      { \"area_name\": \"Storage\", \"is_other\": false },
      { \"area_name\": \"Custom Area\", \"is_other\": true, \"other_description\": \"Warehouse section\" }
    ],
    \"target_pests\": [
      { \"pest_name\": \"Cockroaches\", \"is_other\": false },
      { \"pest_name\": \"Ants\", \"is_other\": false }
    ],
    \"chemicals\": [
      {
        \"chemical_id\": $TEST_CHEMICAL_ID,
        \"quantity\": 100.0,
        \"batch_number\": \"FUM-TEST-001\"
      }
    ]
  }")

if echo "$RESPONSE" | jq -e '.success == true' > /dev/null; then
    print_success "Fumigation data updated (3 areas, 2 pests, 1 chemical)"
else
    print_failure "Failed to update fumigation data" "$RESPONSE"
fi

print_test "4.2" "Update fumigation with empty areas (should fail)"
RESPONSE=$(curl -s -X PUT "$BASE_URL/pco/reports/$TEST_REPORT_ID/fumigation" \
  -H "Authorization: Bearer $PCO_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "areas": [],
    "target_pests": [{"pest_name": "Test"}],
    "chemicals": [{"chemical_id": 1, "quantity": 1}]
  }')

if echo "$RESPONSE" | jq -e '.success == false' > /dev/null; then
    print_success "Empty areas validation working"
else
    print_failure "Should require at least one area" "$RESPONSE"
fi

# ============================================================================
# TEST GROUP 5: Insect Monitor Management
# ============================================================================

print_header "TEST GROUP 5: Insect Monitor Management"

print_test "5.1" "Add fly trap insect monitor"
RESPONSE=$(curl -s -X POST "$BASE_URL/pco/reports/$TEST_REPORT_ID/insect-monitors" \
  -H "Authorization: Bearer $PCO_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "monitor_type": "fly_trap",
    "glue_board_replaced": true,
    "tubes_replaced": true,
    "monitor_serviced": true
  }')

TEST_INSECT_MONITOR_ID=$(echo "$RESPONSE" | jq -r '.monitor_id')

if [ "$TEST_INSECT_MONITOR_ID" != "null" ] && [ -n "$TEST_INSECT_MONITOR_ID" ]; then
    print_success "Fly trap monitor added (ID: $TEST_INSECT_MONITOR_ID)"
else
    print_failure "Failed to add insect monitor" "$RESPONSE"
fi

print_test "5.2" "Add box monitor"
RESPONSE=$(curl -s -X POST "$BASE_URL/pco/reports/$TEST_REPORT_ID/insect-monitors" \
  -H "Authorization: Bearer $PCO_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "monitor_type": "box",
    "glue_board_replaced": false,
    "tubes_replaced": null,
    "monitor_serviced": true
  }')

if echo "$RESPONSE" | jq -e '.success == true' > /dev/null; then
    print_success "Box monitor added"
else
    print_failure "Failed to add box monitor" "$RESPONSE"
fi

print_test "5.3" "Update insect monitor"
RESPONSE=$(curl -s -X PUT "$BASE_URL/pco/reports/$TEST_REPORT_ID/insect-monitors/$TEST_INSECT_MONITOR_ID" \
  -H "Authorization: Bearer $PCO_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "glue_board_replaced": false,
    "monitor_serviced": true
  }')

if echo "$RESPONSE" | jq -e '.success == true' > /dev/null; then
    print_success "Insect monitor updated"
else
    print_failure "Failed to update insect monitor" "$RESPONSE"
fi

# ============================================================================
# TEST GROUP 6: Report Retrieval
# ============================================================================

print_header "TEST GROUP 6: Report Retrieval"

print_test "6.1" "Get report by ID with all sub-modules"
RESPONSE=$(curl -s -X GET "$BASE_URL/pco/reports/$TEST_REPORT_ID" \
  -H "Authorization: Bearer $PCO_TOKEN")

BAIT_COUNT=$(echo "$RESPONSE" | jq '.data.bait_stations | length')
AREA_COUNT=$(echo "$RESPONSE" | jq '.data.fumigation.areas | length')
MONITOR_COUNT=$(echo "$RESPONSE" | jq '.data.insect_monitors | length')

if [ "$BAIT_COUNT" -ge "2" ] && [ "$AREA_COUNT" -ge "3" ] && [ "$MONITOR_COUNT" -ge "2" ]; then
    print_success "Complete report retrieved ($BAIT_COUNT bait stations, $AREA_COUNT areas, $MONITOR_COUNT monitors)"
else
    print_failure "Report data incomplete" "Bait: $BAIT_COUNT, Areas: $AREA_COUNT, Monitors: $MONITOR_COUNT"
fi

print_test "6.2" "Get PCO reports list"
RESPONSE=$(curl -s -X GET "$BASE_URL/pco/reports?status=draft" \
  -H "Authorization: Bearer $PCO_TOKEN")

if echo "$RESPONSE" | jq -e '.success == true' > /dev/null; then
    DRAFT_COUNT=$(echo "$RESPONSE" | jq '.data | length')
    print_success "PCO reports list retrieved ($DRAFT_COUNT drafts)"
else
    print_failure "Failed to get PCO reports list" "$RESPONSE"
fi

print_test "6.3" "Admin view should NOT see drafts"
RESPONSE=$(curl -s -X GET "$BASE_URL/admin/reports" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

DRAFT_IN_ADMIN=$(echo "$RESPONSE" | jq '[.data[] | select(.status == "draft")] | length')

if [ "$DRAFT_IN_ADMIN" = "0" ]; then
    print_success "Admin correctly excludes draft reports (critical business rule)"
else
    print_failure "Admin should not see draft reports" "Found $DRAFT_IN_ADMIN drafts"
fi

# ============================================================================
# TEST GROUP 7: Report Update
# ============================================================================

print_header "TEST GROUP 7: Report Update"

print_test "7.1" "Update draft report"
RESPONSE=$(curl -s -X PUT "$BASE_URL/pco/reports/$TEST_REPORT_ID" \
  -H "Authorization: Bearer $PCO_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "general_remarks": "Updated test remarks",
    "client_signature_name": "John Test Client"
  }')

if echo "$RESPONSE" | jq -e '.success == true' > /dev/null; then
    print_success "Draft report updated"
else
    print_failure "Failed to update draft report" "$RESPONSE"
fi

# ============================================================================
# TEST GROUP 7.2: Add Signatures Before Submission
# ============================================================================

print_header "TEST GROUP 7.2: Add Signatures (Required for Submission)"

print_test "7.2" "Add PCO and client signatures"
# Mock signature data (1x1 pixel transparent PNG in base64)
MOCK_SIGNATURE="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

RESPONSE=$(curl -s -X PUT "$BASE_URL/pco/reports/$TEST_REPORT_ID" \
  -H "Authorization: Bearer $PCO_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"pco_signature_data\": \"$MOCK_SIGNATURE\",
    \"client_signature_data\": \"$MOCK_SIGNATURE\",
    \"client_signature_name\": \"John Test Client\",
    \"general_remarks\": \"Test report with signatures\"
  }")

if echo "$RESPONSE" | jq -e '.success == true' > /dev/null; then
    print_success "Signatures added to report"
else
    print_failure "Failed to add signatures" "$RESPONSE"
fi

# ============================================================================
# TEST GROUP 8: Report Submission (CRITICAL)
# ============================================================================

print_header "TEST GROUP 8: Report Submission & Auto-Unassign"

print_test "8.1" "Submit report (should auto-unassign PCO)"
RESPONSE=$(curl -s -X POST "$BASE_URL/pco/reports/$TEST_REPORT_ID/submit" \
  -H "Authorization: Bearer $PCO_TOKEN")

if echo "$RESPONSE" | jq -e '.success == true' > /dev/null; then
    print_success "Report submitted successfully"
else
    print_failure "Failed to submit report" "$RESPONSE"
fi

print_test "8.2" "Verify PCO auto-unassigned from client"
RESPONSE=$(curl -s -X GET "$BASE_URL/admin/assignments?client_id=$TEST_CLIENT_ID&status=active&pco_id=$PCO_USER_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

# Check that OUR specific PCO is NOT assigned (should be 0 assignments for this PCO-client pair)
PCO_ASSIGNED=$(echo "$RESPONSE" | jq '[.data.assignments[] | select(.pco_id == '$PCO_USER_ID')] | length')

if [ "$PCO_ASSIGNED" = "0" ]; then
    print_success "PCO correctly auto-unassigned (critical business rule verified)"
else
    print_failure "PCO should be auto-unassigned after submission" "Found $PCO_ASSIGNED active assignments for PCO $PCO_USER_ID"
fi

print_test "8.3" "Verify report status changed to pending"
RESPONSE=$(curl -s -X GET "$BASE_URL/pco/reports/$TEST_REPORT_ID" \
  -H "Authorization: Bearer $PCO_TOKEN")

REPORT_STATUS=$(echo "$RESPONSE" | jq -r '.data.status')

if [ "$REPORT_STATUS" = "pending" ]; then
    print_success "Report status correctly changed to pending"
else
    print_failure "Report should be in pending status" "Status: $REPORT_STATUS"
fi

# ============================================================================
# TEST GROUP 9: Admin Review - Pending Reports
# ============================================================================

print_header "TEST GROUP 9: Admin Review Workflow"

print_test "9.1" "Get pending reports"
RESPONSE=$(curl -s -X GET "$BASE_URL/admin/reports/pending" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

PENDING_COUNT=$(echo "$RESPONSE" | jq '.data | length')

if [ "$PENDING_COUNT" -ge "1" ]; then
    print_success "Pending reports retrieved ($PENDING_COUNT reports)"
else
    print_failure "Should have at least 1 pending report" "$RESPONSE"
fi

# ============================================================================
# TEST GROUP 10: Admin Decline (CRITICAL)
# ============================================================================

print_header "TEST GROUP 10: Admin Decline & PCO Reassignment"

print_test "10.1" "Decline without admin_notes (should fail)"
RESPONSE=$(curl -s -X POST "$BASE_URL/admin/reports/$TEST_REPORT_ID/decline" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}')

if echo "$RESPONSE" | jq -e '.success == false' > /dev/null && (echo "$RESPONSE" | grep -iq "admin.*notes\|notes.*required"); then
    print_success "Decline validation working (admin_notes required)"
else
    print_failure "Should require admin_notes for decline" "$RESPONSE"
fi

print_test "10.2" "Decline with short admin_notes (should fail)"
RESPONSE=$(curl -s -X POST "$BASE_URL/admin/reports/$TEST_REPORT_ID/decline" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "admin_notes": "Too short"
  }')

if echo "$RESPONSE" | jq -e '.success == false' > /dev/null; then
    print_success "Minimum length validation working (10 chars required)"
else
    print_failure "admin_notes should be at least 10 characters" "$RESPONSE"
fi

print_test "10.3" "Decline report with proper feedback"
RESPONSE=$(curl -s -X POST "$BASE_URL/admin/reports/$TEST_REPORT_ID/decline" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "admin_notes": "Please add more detailed bait station remarks and resubmit. Station TEST-001 needs specific pest identification."
  }')

if echo "$RESPONSE" | jq -e '.success == true' > /dev/null; then
    print_success "Report declined successfully"
else
    print_failure "Failed to decline report" "$RESPONSE"
fi

print_test "10.4" "Verify PCO reassigned to client for revision"
RESPONSE=$(curl -s -X GET "$BASE_URL/admin/assignments?client_id=$TEST_CLIENT_ID&status=active&pco_id=$PCO_USER_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

# Check if OUR PCO is assigned (should be exactly 1 assignment for this PCO-client pair)
PCO_ASSIGNED=$(echo "$RESPONSE" | jq '[.data.assignments[] | select(.pco_id == '$PCO_USER_ID')] | length')

if [ "$PCO_ASSIGNED" = "1" ]; then
    print_success "PCO correctly reassigned after decline (critical business rule verified)"
else
    print_failure "PCO should be reassigned after decline" "Found $PCO_ASSIGNED assignments for PCO $PCO_USER_ID"
fi

print_test "10.5" "Verify report status changed to declined with admin notes"
RESPONSE=$(curl -s -X GET "$BASE_URL/pco/reports/$TEST_REPORT_ID" \
  -H "Authorization: Bearer $PCO_TOKEN")

REPORT_STATUS=$(echo "$RESPONSE" | jq -r '.data.status')
ADMIN_NOTES=$(echo "$RESPONSE" | jq -r '.data.admin_notes')

if [ "$REPORT_STATUS" = "declined" ] && [ "$ADMIN_NOTES" != "null" ]; then
    print_success "Report status changed to declined with admin feedback (per workflow.md)"
else
    print_failure "Report should be declined with admin_notes for revision" "Status: $REPORT_STATUS"
fi

# ============================================================================
# TEST GROUP 11: Resubmit & Approve
# ============================================================================

print_header "TEST GROUP 11: Resubmit & Approval"

print_test "11.1" "Resubmit report after revision"
RESPONSE=$(curl -s -X POST "$BASE_URL/pco/reports/$TEST_REPORT_ID/submit" \
  -H "Authorization: Bearer $PCO_TOKEN")

if echo "$RESPONSE" | jq -e '.success == true' > /dev/null; then
    print_success "Report resubmitted"
else
    print_failure "Failed to resubmit report" "$RESPONSE"
fi

print_test "11.2" "Approve report"
RESPONSE=$(curl -s -X POST "$BASE_URL/admin/reports/$TEST_REPORT_ID/approve" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "admin_notes": "Report approved. Good work."
  }')

if echo "$RESPONSE" | jq -e '.success == true' > /dev/null; then
    print_success "Report approved"
else
    print_failure "Failed to approve report" "$RESPONSE"
fi

print_test "11.3" "Verify report status changed to approved"
RESPONSE=$(curl -s -X GET "$BASE_URL/admin/reports/$TEST_REPORT_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

REPORT_STATUS=$(echo "$RESPONSE" | jq -r '.data.status')
REVIEWED_BY=$(echo "$RESPONSE" | jq -r '.data.reviewed_by')

if [ "$REPORT_STATUS" = "approved" ] && [ "$REVIEWED_BY" != "null" ]; then
    print_success "Report approved with reviewer tracking"
else
    print_failure "Report should be approved with reviewer" "Status: $REPORT_STATUS, Reviewer: $REVIEWED_BY"
fi

# ============================================================================
# TEST GROUP 12: Pre-fill Functionality
# ============================================================================

print_header "TEST GROUP 12: Pre-fill Data"

# Reassign PCO to client for pre-fill test (use bulk-assign)
curl -s -X POST "$BASE_URL/admin/assignments/bulk-assign" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"pco_id\": $PCO_USER_ID, \"client_ids\": [$TEST_CLIENT_ID]}" > /dev/null

print_test "12.1" "Get pre-fill data from last approved report"
RESPONSE=$(curl -s -X GET "$BASE_URL/pco/reports/pre-fill/$TEST_CLIENT_ID" \
  -H "Authorization: Bearer $PCO_TOKEN")

# Check if pre-fill data was retrieved (should have data from the approved report)
SUCCESS=$(echo "$RESPONSE" | jq -r '.success')
PREFILL_BAIT_COUNT=$(echo "$RESPONSE" | jq '.data.bait_stations | length // 0')
PREFILL_AREA_COUNT=$(echo "$RESPONSE" | jq '.data.fumigation.areas | length // 0')

# The report we approved had 2 bait stations and 3 fumigation areas
if [ "$SUCCESS" = "true" ] && [ "$PREFILL_BAIT_COUNT" -ge "2" ] && [ "$PREFILL_AREA_COUNT" -ge "3" ]; then
    print_success "Pre-fill data retrieved ($PREFILL_BAIT_COUNT stations, $PREFILL_AREA_COUNT areas)"
else
    print_failure "Pre-fill data incomplete or not found" "Success: $SUCCESS, Stations: $PREFILL_BAIT_COUNT, Areas: $PREFILL_AREA_COUNT"
fi

# ============================================================================
# TEST GROUP 13: Edit Restrictions
# ============================================================================

print_header "TEST GROUP 13: Edit Restrictions"

print_test "13.1" "Attempt to edit submitted report (should fail)"
RESPONSE=$(curl -s -X PUT "$BASE_URL/pco/reports/$TEST_REPORT_ID" \
  -H "Authorization: Bearer $PCO_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "general_remarks": "Trying to edit submitted report"
  }')

if echo "$RESPONSE" | jq -e '.success == false' > /dev/null; then
    print_success "Non-draft report edit blocked correctly"
else
    print_failure "Should not allow editing submitted reports" "$RESPONSE"
fi

print_test "13.2" "Attempt to delete approved report (should fail)"
RESPONSE=$(curl -s -X DELETE "$BASE_URL/pco/reports/$TEST_REPORT_ID" \
  -H "Authorization: Bearer $PCO_TOKEN")

if echo "$RESPONSE" | jq -e '.success == false' > /dev/null; then
    print_success "Non-draft report deletion blocked correctly"
else
    print_failure "Should only allow deleting draft reports" "$RESPONSE"
fi

# ============================================================================
# TEST GROUP 14: Validation Tests
# ============================================================================

print_header "TEST GROUP 14: Validation Tests"

print_test "14.1" "Create report with future service date (should fail)"
RESPONSE=$(curl -s -X POST "$BASE_URL/pco/reports" \
  -H "Authorization: Bearer $PCO_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"client_id\": $TEST_CLIENT_ID,
    \"report_type\": \"both\",
    \"service_date\": \"2099-12-31\"
  }")

if echo "$RESPONSE" | jq -e '.success == false' > /dev/null && echo "$RESPONSE" | grep -qi "future"; then
    print_success "Future date validation working"
else
    print_failure "Should not allow future service dates" "$RESPONSE"
fi

print_test "14.2" "Add bait station with invalid location (should fail)"
RESPONSE=$(curl -s -X POST "$BASE_URL/pco/reports/$TEST_REPORT_ID/bait-stations" \
  -H "Authorization: Bearer $PCO_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "station_number": "INVALID",
    "location": "invalid_location",
    "is_accessible": true,
    "activity_detected": false,
    "bait_status": "clean",
    "station_condition": "good",
    "rodent_box_replaced": false
  }')

if echo "$RESPONSE" | jq -e '.success == false' > /dev/null; then
    print_success "Location enum validation working"
else
    print_failure "Should validate location enum" "$RESPONSE"
fi

# ============================================================================
# Cleanup
# ============================================================================

print_header "CLEANUP: Delete Test Report"

# Note: Can't delete approved report, so we'll leave it for manual cleanup if needed
echo -e "${YELLOW}Note: Test report ID $TEST_REPORT_ID was approved and cannot be deleted automatically${NC}"

# ============================================================================
# Test Summary
# ============================================================================

print_header "TEST SUMMARY"

echo -e "Total Tests: ${BLUE}$TOTAL_TESTS${NC}"
echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed: ${RED}$FAILED_TESTS${NC}"

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "\n${GREEN}========================================${NC}"
    echo -e "${GREEN}ALL TESTS PASSED! ✓${NC}"
    echo -e "${GREEN}========================================${NC}\n"
    echo -e "${GREEN}Phase 3.2 Report Management is fully operational!${NC}"
    echo -e "${GREEN}Critical Business Rules Verified:${NC}"
    echo -e "  ✓ Auto-unassign PCO on report submission"
    echo -e "  ✓ Reassign PCO when admin declines report"
    echo -e "  ✓ Admin cannot view draft reports"
    echo -e "  ✓ Only draft reports can be edited/deleted"
    echo -e "  ✓ admin_notes required for decline (min 10 chars)"
    echo -e "  ✓ Pre-fill from last approved report"
    exit 0
else
    echo -e "\n${RED}========================================${NC}"
    echo -e "${RED}SOME TESTS FAILED ✗${NC}"
    echo -e "${RED}========================================${NC}\n"
    echo -e "${RED}Please review the failures above${NC}"
    exit 1
fi
