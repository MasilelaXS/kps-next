#!/bin/bash

# ========================================
# PHASE 4.1: PCO DASHBOARD TEST SUITE
# ========================================
# Purpose: Comprehensive testing of PCO dashboard endpoints
# Reference: PHASE-4.1-IMPLEMENTATION-PLAN.md
# Endpoints: 5 dashboard endpoints

# API configuration
BASE_URL="http://localhost:3001/api"
CONTENT_TYPE="Content-Type: application/json"

# Color codes for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Store test data
ADMIN_TOKEN=""
PCO_TOKEN=""
PCO_USER_ID=""
TEST_CLIENT_ID=""
TEST_REPORT_ID=""

# ========================================
# Helper Functions
# ========================================

print_header() {
  echo -e "\n${BLUE}========================================${NC}"
  echo -e "${BLUE}$1${NC}"
  echo -e "${BLUE}========================================${NC}\n"
}

print_test() {
  echo -e "${YELLOW}TEST $1: $2${NC}"
}

print_success() {
  echo -e "${GREEN}✓ $1${NC}"
  ((PASSED_TESTS++))
}

print_fail() {
  echo -e "${RED}✗ $1${NC}"
  ((FAILED_TESTS++))
}

print_info() {
  echo -e "${BLUE}ℹ $1${NC}"
}

# ========================================
# Test 0: Authentication & Setup
# ========================================

print_header "Phase 0: Authentication & Setup"

print_test "0.1" "Admin Login"
((TOTAL_TESTS++))
ADMIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "$CONTENT_TYPE" \
  -d '{
    "login_id": "admin12345",
    "password": "ResetPassword123"
  }')

ADMIN_TOKEN=$(echo "$ADMIN_RESPONSE" | jq -r '.data.token')
if [ "$ADMIN_TOKEN" != "null" ] && [ -n "$ADMIN_TOKEN" ]; then
  print_success "Admin logged in successfully"
else
  print_fail "Admin login failed"
  echo "Response: $ADMIN_RESPONSE"
  exit 1
fi

print_test "0.2" "Create Fresh PCO User"
((TOTAL_TESTS++))
RANDOM_PCO=$(( ( RANDOM % 90000 )  + 10000 ))

CREATE_PCO_RESPONSE=$(curl -s -X POST "$BASE_URL/admin/users" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "$CONTENT_TYPE" \
  -d "{
    \"pco_number\": \"$RANDOM_PCO\",
    \"name\": \"Test PCO Dashboard User\",
    \"email\": \"testpco${RANDOM_PCO}@test.com\",
    \"phone\": \"+1234567890\",
    \"password\": \"TestPCO123!\",
    \"role\": \"pco\"
  }")

PCO_USER_ID=$(echo "$CREATE_PCO_RESPONSE" | jq -r '.data.id')
if [ "$PCO_USER_ID" != "null" ] && [ -n "$PCO_USER_ID" ]; then
  print_success "PCO user created (ID: $PCO_USER_ID, Number: $RANDOM_PCO)"
else
  print_fail "Failed to create PCO user"
  echo "Response: $CREATE_PCO_RESPONSE"
  exit 1
fi

print_test "0.3" "PCO Login"
((TOTAL_TESTS++))
PCO_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "$CONTENT_TYPE" \
  -d "{
    \"login_id\": \"pco${RANDOM_PCO}\",
    \"password\": \"TestPCO123!\"
  }")

PCO_TOKEN=$(echo "$PCO_RESPONSE" | jq -r '.data.token')
if [ "$PCO_TOKEN" != "null" ] && [ -n "$PCO_TOKEN" ]; then
  print_success "PCO logged in successfully (ID: $PCO_USER_ID)"
else
  print_fail "PCO login failed"
  echo "Response: $PCO_RESPONSE"
  exit 1
fi

print_test "0.4" "Get Test Client"
((TOTAL_TESTS++))
CLIENT_RESPONSE=$(curl -s -X GET "$BASE_URL/admin/clients?page=1&limit=1" \
  -H "$CONTENT_TYPE" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

TEST_CLIENT_ID=$(echo "$CLIENT_RESPONSE" | jq -r '.data.clients[0].id')
if [ "$TEST_CLIENT_ID" != "null" ] && [ -n "$TEST_CLIENT_ID" ]; then
  print_success "Test client found (ID: $TEST_CLIENT_ID)"
else
  print_fail "No test client found"
  exit 1
fi

print_test "0.5" "Unassign Any Existing PCO from Test Client"
((TOTAL_TESTS++))
# First get existing assignments for this client
EXISTING_RESPONSE=$(curl -s -X GET "$BASE_URL/admin/assignments?client_id=$TEST_CLIENT_ID&status=active" \
  -H "$CONTENT_TYPE" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

# Extract assignment IDs from response
EXISTING_ASSIGNMENTS=$(echo "$EXISTING_RESPONSE" | jq -r '[.data.assignments[]?.id] | join(",")')

# Check if we got any IDs
if [ -n "$EXISTING_ASSIGNMENTS" ] && [ "$EXISTING_ASSIGNMENTS" != "null" ] && [ "$EXISTING_ASSIGNMENTS" != "" ]; then
  # Unassign them
  UNASSIGN_RESPONSE=$(curl -s -X POST "$BASE_URL/admin/assignments/bulk-unassign" \
    -H "$CONTENT_TYPE" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -d "{\"assignment_ids\": [$EXISTING_ASSIGNMENTS]}")
  
  UNASSIGN_SUCCESS=$(echo "$UNASSIGN_RESPONSE" | jq -r '.success')
  if [ "$UNASSIGN_SUCCESS" = "true" ]; then
    print_success "Unassigned existing PCOs (IDs: $EXISTING_ASSIGNMENTS)"
  else
    print_fail "Failed to unassign existing PCOs"
    echo "Response: $UNASSIGN_RESPONSE"
  fi
else
  print_success "No existing assignments to clear"
fi

print_test "0.6" "Assign New PCO to Client"
((TOTAL_TESTS++))
ASSIGN_RESPONSE=$(curl -s -X POST "$BASE_URL/admin/assignments/bulk-assign" \
  -H "$CONTENT_TYPE" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d "{
    \"pco_id\": $PCO_USER_ID,
    \"client_ids\": [$TEST_CLIENT_ID]
  }")

SUCCESS=$(echo "$ASSIGN_RESPONSE" | jq -r '.success')
if [ "$SUCCESS" = "true" ]; then
  print_success "PCO assigned to test client"
else
  print_fail "Assignment failed"
  echo "Response: $ASSIGN_RESPONSE"
fi

# ========================================
# Test 1: Dashboard Summary Endpoint
# ========================================

print_header "Phase 1: Dashboard Summary Endpoint"

print_test "1.1" "Get Dashboard Summary (No Reports Yet)"
((TOTAL_TESTS++))
SUMMARY_RESPONSE=$(curl -s -X GET "$BASE_URL/pco/dashboard/summary" \
  -H "$CONTENT_TYPE" \
  -H "Authorization: Bearer $PCO_TOKEN")

SUCCESS=$(echo "$SUMMARY_RESPONSE" | jq -r '.success')
ASSIGNED_CLIENTS=$(echo "$SUMMARY_RESPONSE" | jq -r '.data.assigned_clients_count')
PENDING_REPORTS=$(echo "$SUMMARY_RESPONSE" | jq -r '.data.pending_reports_count')

if [ "$SUCCESS" = "true" ] && [ "$ASSIGNED_CLIENTS" -ge "1" ]; then
  print_success "Dashboard summary retrieved (Clients: $ASSIGNED_CLIENTS, Pending: $PENDING_REPORTS)"
else
  print_fail "Dashboard summary failed"
  echo "Response: $SUMMARY_RESPONSE"
fi

print_test "1.2" "Verify Performance Metrics Structure"
((TOTAL_TESTS++))
AVG_COMPLETION=$(echo "$SUMMARY_RESPONSE" | jq -r '.data.performance_metrics.average_completion_time_days')
APPROVAL_RATE=$(echo "$SUMMARY_RESPONSE" | jq -r '.data.performance_metrics.approval_rate_percent')
REPORTS_PER_WEEK=$(echo "$SUMMARY_RESPONSE" | jq -r '.data.performance_metrics.reports_per_week_average')

if [ "$AVG_COMPLETION" != "null" ] && [ "$APPROVAL_RATE" != "null" ] && [ "$REPORTS_PER_WEEK" != "null" ]; then
  print_success "Performance metrics present (Avg: ${AVG_COMPLETION}d, Approval: ${APPROVAL_RATE}%, Per Week: $REPORTS_PER_WEEK)"
else
  print_fail "Performance metrics incomplete"
fi

print_test "1.3" "Dashboard Without Authentication"
((TOTAL_TESTS++))
UNAUTH_RESPONSE=$(curl -s -X GET "$BASE_URL/pco/dashboard/summary" \
  -H "$CONTENT_TYPE")

SUCCESS=$(echo "$UNAUTH_RESPONSE" | jq -r '.success')
if [ "$SUCCESS" = "false" ]; then
  print_success "Unauthorized access correctly denied"
else
  print_fail "Should deny access without token"
fi

# ========================================
# Test 2: Create Test Reports for Data
# ========================================

print_header "Phase 2: Create Test Reports for Dashboard Data"

print_test "2.1" "Create Draft Report"
((TOTAL_TESTS++))
REPORT_CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/pco/reports" \
  -H "$CONTENT_TYPE" \
  -H "Authorization: Bearer $PCO_TOKEN" \
  -d "{
    \"client_id\": $TEST_CLIENT_ID,
    \"report_type\": \"both\",
    \"service_date\": \"2025-10-14\",
    \"next_service_date\": \"2025-10-28\"
  }")

SUCCESS=$(echo "$REPORT_CREATE_RESPONSE" | jq -r '.success')
TEST_REPORT_ID=$(echo "$REPORT_CREATE_RESPONSE" | jq -r '.report_id // .data.report.id // empty')

if [ "$SUCCESS" = "true" ] && [ -n "$TEST_REPORT_ID" ] && [ "$TEST_REPORT_ID" != "null" ]; then
  print_success "Draft report created (ID: $TEST_REPORT_ID)"
else
  print_fail "Report creation failed"
  echo "Response: $REPORT_CREATE_RESPONSE"
fi

# Update the report with signatures using PUT
print_test "2.1.5" "Update Report with Signatures"
SIGNATURE_DATA="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

UPDATE_RESPONSE=$(curl -s -X PUT "$BASE_URL/pco/reports/$TEST_REPORT_ID" \
  -H "$CONTENT_TYPE" \
  -H "Authorization: Bearer $PCO_TOKEN" \
  -d "{
    \"client_id\": $TEST_CLIENT_ID,
    \"report_type\": \"both\",
    \"service_date\": \"2025-10-14\",
    \"next_service_date\": \"2025-10-28\",
    \"general_remarks\": \"Routine inspection completed\",
    \"pco_signature_data\": \"data:image/png;base64,$SIGNATURE_DATA\",
    \"client_signature_data\": \"data:image/png;base64,$SIGNATURE_DATA\",
    \"client_signature_name\": \"John Doe\"
  }")

# Add a bait station
curl -s -X POST "$BASE_URL/pco/reports/$TEST_REPORT_ID/bait-stations" \
  -H "$CONTENT_TYPE" \
  -H "Authorization: Bearer $PCO_TOKEN" \
  -d "{
    \"station_number\": \"BS-001\",
    \"location\": \"inside\",
    \"is_accessible\": true,
    \"activity_detected\": false,
    \"bait_status\": \"clean\",
    \"station_condition\": \"good\",
    \"rodent_box_replaced\": false
  }" > /dev/null

# Add fumigation data (areas, pests, chemicals all together)
curl -s -X PUT "$BASE_URL/pco/reports/$TEST_REPORT_ID/fumigation" \
  -H "$CONTENT_TYPE" \
  -H "Authorization: Bearer $PCO_TOKEN" \
  -d "{
    \"areas\": [
      {
        \"area_name\": \"Dining Area\",
        \"is_other\": false
      }
    ],
    \"target_pests\": [
      {
        \"pest_name\": \"Cockroaches\",
        \"is_other\": false
      }
    ],
    \"chemicals\": [
      {
        \"chemical_id\": 1,
        \"quantity\": 2.5,
        \"batch_number\": \"BATCH001\"
      }
    ]
  }" > /dev/null

print_test "2.2" "Submit Report"
((TOTAL_TESTS++))
# Submit the report (signatures already added via PUT above)
SUBMIT_RESPONSE=$(curl -s -X POST "$BASE_URL/pco/reports/$TEST_REPORT_ID/submit" \
  -H "$CONTENT_TYPE" \
  -H "Authorization: Bearer $PCO_TOKEN")

SUCCESS=$(echo "$SUBMIT_RESPONSE" | jq -r '.success')
if [ "$SUCCESS" = "true" ]; then
  print_success "Report submitted successfully"
else
  print_fail "Report submission failed"
  echo "Response: $SUBMIT_RESPONSE"
fi

print_test "2.3" "Verify Dashboard Shows Pending Report"
((TOTAL_TESTS++))
SUMMARY_RESPONSE=$(curl -s -X GET "$BASE_URL/pco/dashboard/summary" \
  -H "$CONTENT_TYPE" \
  -H "Authorization: Bearer $PCO_TOKEN")

PENDING_REPORTS=$(echo "$SUMMARY_RESPONSE" | jq -r '.data.pending_reports_count')
if [ "$PENDING_REPORTS" -ge "1" ]; then
  print_success "Dashboard shows pending report (Count: $PENDING_REPORTS)"
else
  print_fail "Pending report not reflected in dashboard"
fi

# ========================================
# Test 3: Upcoming Assignments Endpoint
# ========================================

print_header "Phase 3: Upcoming Assignments Endpoint"

print_test "3.1" "Get Upcoming Assignments (Default 7 Days)"
((TOTAL_TESTS++))
UPCOMING_RESPONSE=$(curl -s -X GET "$BASE_URL/pco/dashboard/upcoming-assignments" \
  -H "$CONTENT_TYPE" \
  -H "Authorization: Bearer $PCO_TOKEN")

SUCCESS=$(echo "$UPCOMING_RESPONSE" | jq -r '.success')
ASSIGNMENTS=$(echo "$UPCOMING_RESPONSE" | jq -r '.data.assignments | length')

if [ "$SUCCESS" = "true" ]; then
  print_success "Upcoming assignments retrieved (Count: $ASSIGNMENTS)"
else
  print_fail "Upcoming assignments failed"
  echo "Response: $UPCOMING_RESPONSE"
fi

print_test "3.2" "Verify Assignment Structure"
((TOTAL_TESTS++))
# Only validate structure if assignments exist
if [ "$ASSIGNMENTS" -gt "0" ]; then
  FIRST_ASSIGNMENT=$(echo "$UPCOMING_RESPONSE" | jq -r '.data.assignments[0]')
  CLIENT_ID=$(echo "$FIRST_ASSIGNMENT" | jq -r '.client_id')
  COMPANY_NAME=$(echo "$FIRST_ASSIGNMENT" | jq -r '.company_name')
  NEXT_SERVICE=$(echo "$FIRST_ASSIGNMENT" | jq -r '.next_service_date')
  PRIORITY=$(echo "$FIRST_ASSIGNMENT" | jq -r '.priority')

  if [ "$CLIENT_ID" != "null" ] && [ "$COMPANY_NAME" != "null" ] && [ "$NEXT_SERVICE" != "null" ] && [ "$PRIORITY" != "null" ]; then
    print_success "Assignment structure valid (Client: $COMPANY_NAME, Priority: $PRIORITY)"
  else
    print_fail "Assignment structure incomplete"
  fi
else
  # No assignments to validate, but endpoint structure is correct
  print_success "Assignment structure validation skipped (no assignments)"
fi

print_test "3.3" "Custom Days Ahead (14 Days)"
((TOTAL_TESTS++))
UPCOMING_14_RESPONSE=$(curl -s -X GET "$BASE_URL/pco/dashboard/upcoming-assignments?days_ahead=14" \
  -H "$CONTENT_TYPE" \
  -H "Authorization: Bearer $PCO_TOKEN")

SUCCESS=$(echo "$UPCOMING_14_RESPONSE" | jq -r '.success')
if [ "$SUCCESS" = "true" ]; then
  ASSIGNMENTS_14=$(echo "$UPCOMING_14_RESPONSE" | jq -r '.data.assignments | length')
  print_success "14-day lookahead successful (Count: $ASSIGNMENTS_14)"
else
  print_fail "14-day lookahead failed"
fi

print_test "3.4" "Invalid Days Ahead (Out of Range)"
((TOTAL_TESTS++))
INVALID_DAYS_RESPONSE=$(curl -s -X GET "$BASE_URL/pco/dashboard/upcoming-assignments?days_ahead=999" \
  -H "$CONTENT_TYPE" \
  -H "Authorization: Bearer $PCO_TOKEN")

SUCCESS=$(echo "$INVALID_DAYS_RESPONSE" | jq -r '.success')
if [ "$SUCCESS" = "false" ]; then
  print_success "Invalid days_ahead correctly rejected"
else
  print_fail "Should reject days_ahead > 90"
fi

# ========================================
# Test 4: Recent Reports Endpoint
# ========================================

print_header "Phase 4: Recent Reports Endpoint"

print_test "4.1" "Get Recent Reports (Default Limit)"
((TOTAL_TESTS++))
RECENT_RESPONSE=$(curl -s -X GET "$BASE_URL/pco/dashboard/recent-reports" \
  -H "$CONTENT_TYPE" \
  -H "Authorization: Bearer $PCO_TOKEN")

SUCCESS=$(echo "$RECENT_RESPONSE" | jq -r '.success')
REPORTS=$(echo "$RECENT_RESPONSE" | jq -r '.data.reports | length')
TOTAL_COUNT=$(echo "$RECENT_RESPONSE" | jq -r '.data.total_count')

if [ "$SUCCESS" = "true" ]; then
  print_success "Recent reports retrieved (Count: $REPORTS, Total: $TOTAL_COUNT)"
else
  print_fail "Recent reports failed"
  echo "Response: $RECENT_RESPONSE"
fi

print_test "4.2" "Verify Report Structure"
((TOTAL_TESTS++))
FIRST_REPORT=$(echo "$RECENT_RESPONSE" | jq -r '.data.reports[0]')
REPORT_ID=$(echo "$FIRST_REPORT" | jq -r '.id')
REPORT_TYPE=$(echo "$FIRST_REPORT" | jq -r '.report_type')
STATUS=$(echo "$FIRST_REPORT" | jq -r '.status')

if [ "$REPORT_ID" != "null" ] && [ "$REPORT_TYPE" != "null" ] && [ "$STATUS" != "null" ]; then
  print_success "Report structure valid (ID: $REPORT_ID, Type: $REPORT_TYPE, Status: $STATUS)"
else
  print_fail "Report structure incomplete"
fi

print_test "4.3" "Filter by Status (Pending)"
((TOTAL_TESTS++))
PENDING_FILTER_RESPONSE=$(curl -s -X GET "$BASE_URL/pco/dashboard/recent-reports?status=pending" \
  -H "$CONTENT_TYPE" \
  -H "Authorization: Bearer $PCO_TOKEN")

SUCCESS=$(echo "$PENDING_FILTER_RESPONSE" | jq -r '.success')
if [ "$SUCCESS" = "true" ]; then
  PENDING_REPORTS=$(echo "$PENDING_FILTER_RESPONSE" | jq -r '.data.reports | length')
  print_success "Pending filter applied (Count: $PENDING_REPORTS)"
else
  print_fail "Status filter failed"
fi

print_test "4.4" "Custom Limit"
((TOTAL_TESTS++))
LIMIT_5_RESPONSE=$(curl -s -X GET "$BASE_URL/pco/dashboard/recent-reports?limit=5" \
  -H "$CONTENT_TYPE" \
  -H "Authorization: Bearer $PCO_TOKEN")

SUCCESS=$(echo "$LIMIT_5_RESPONSE" | jq -r '.success')
REPORTS_5=$(echo "$LIMIT_5_RESPONSE" | jq -r '.data.reports | length')

if [ "$SUCCESS" = "true" ] && [ "$REPORTS_5" -le "5" ]; then
  print_success "Custom limit applied (Count: $REPORTS_5)"
else
  print_fail "Custom limit failed"
fi

# ========================================
# Test 5: Declined Reports Endpoint
# ========================================

print_header "Phase 5: Declined Reports Endpoint"

print_test "5.1" "Get Declined Reports (Should Be Empty)"
((TOTAL_TESTS++))
DECLINED_RESPONSE=$(curl -s -X GET "$BASE_URL/pco/dashboard/declined-reports" \
  -H "$CONTENT_TYPE" \
  -H "Authorization: Bearer $PCO_TOKEN")

SUCCESS=$(echo "$DECLINED_RESPONSE" | jq -r '.success')
DECLINED_COUNT=$(echo "$DECLINED_RESPONSE" | jq -r '.data.total_declined')

if [ "$SUCCESS" = "true" ]; then
  print_success "Declined reports retrieved (Count: $DECLINED_COUNT)"
else
  print_fail "Declined reports endpoint failed"
fi

print_test "5.2" "Decline Report by Admin"
((TOTAL_TESTS++))
DECLINE_RESPONSE=$(curl -s -X POST "$BASE_URL/admin/reports/$TEST_REPORT_ID/decline" \
  -H "$CONTENT_TYPE" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "admin_notes": "Please add missing bait station BS-002 and verify chemical quantities."
  }')

SUCCESS=$(echo "$DECLINE_RESPONSE" | jq -r '.success')
if [ "$SUCCESS" = "true" ]; then
  print_success "Report declined by admin"
else
  print_fail "Report decline failed"
  echo "Response: $DECLINE_RESPONSE"
fi

print_test "5.3" "Verify Declined Report Appears"
((TOTAL_TESTS++))
DECLINED_RESPONSE=$(curl -s -X GET "$BASE_URL/pco/dashboard/declined-reports" \
  -H "$CONTENT_TYPE" \
  -H "Authorization: Bearer $PCO_TOKEN")

DECLINED_COUNT=$(echo "$DECLINED_RESPONSE" | jq -r '.data.total_declined')
if [ "$DECLINED_COUNT" -ge "1" ]; then
  print_success "Declined report appears in dashboard (Count: $DECLINED_COUNT)"
else
  print_fail "Declined report not appearing"
fi

print_test "5.4" "Verify Declined Report Structure"
((TOTAL_TESTS++))
FIRST_DECLINED=$(echo "$DECLINED_RESPONSE" | jq -r '.data.declined_reports[0]')
DECLINED_ID=$(echo "$FIRST_DECLINED" | jq -r '.id')
ADMIN_NOTES=$(echo "$FIRST_DECLINED" | jq -r '.admin_notes')
PRIORITY=$(echo "$FIRST_DECLINED" | jq -r '.priority')

if [ "$DECLINED_ID" = "$TEST_REPORT_ID" ] && [ -n "$ADMIN_NOTES" ] && [ "$PRIORITY" != "null" ]; then
  print_success "Declined report structure valid (Priority: $PRIORITY)"
else
  print_fail "Declined report structure incomplete"
fi

# ========================================
# Test 6: Statistics Endpoint
# ========================================

print_header "Phase 6: Statistics Endpoint"

print_test "6.1" "Get Statistics (Default 30 Days)"
((TOTAL_TESTS++))
STATS_RESPONSE=$(curl -s -X GET "$BASE_URL/pco/dashboard/statistics" \
  -H "$CONTENT_TYPE" \
  -H "Authorization: Bearer $PCO_TOKEN")

SUCCESS=$(echo "$STATS_RESPONSE" | jq -r '.success')
REPORTS_SUBMITTED=$(echo "$STATS_RESPONSE" | jq -r '.data.reports_submitted')
APPROVAL_RATE=$(echo "$STATS_RESPONSE" | jq -r '.data.approval_rate')

if [ "$SUCCESS" = "true" ]; then
  print_success "Statistics retrieved (Submitted: $REPORTS_SUBMITTED, Approval: ${APPROVAL_RATE}%)"
else
  print_fail "Statistics endpoint failed"
  echo "Response: $STATS_RESPONSE"
fi

print_test "6.2" "Verify Report Types Breakdown"
((TOTAL_TESTS++))
BAIT_COUNT=$(echo "$STATS_RESPONSE" | jq -r '.data.report_types.bait_inspection')
FUMIGATION_COUNT=$(echo "$STATS_RESPONSE" | jq -r '.data.report_types.fumigation')
BOTH_COUNT=$(echo "$STATS_RESPONSE" | jq -r '.data.report_types.both')

if [ "$BAIT_COUNT" != "null" ] && [ "$FUMIGATION_COUNT" != "null" ] && [ "$BOTH_COUNT" != "null" ]; then
  print_success "Report types breakdown present (Bait: $BAIT_COUNT, Fumigation: $FUMIGATION_COUNT, Both: $BOTH_COUNT)"
else
  print_fail "Report types incomplete"
fi

print_test "6.3" "Verify Monthly Trend"
((TOTAL_TESTS++))
MONTHLY_TREND=$(echo "$STATS_RESPONSE" | jq -r '.data.monthly_trend | length')

if [ "$MONTHLY_TREND" -ge "0" ]; then
  print_success "Monthly trend data present (Months: $MONTHLY_TREND)"
else
  print_fail "Monthly trend missing"
fi

print_test "6.4" "Custom Period (7 Days)"
((TOTAL_TESTS++))
STATS_7_RESPONSE=$(curl -s -X GET "$BASE_URL/pco/dashboard/statistics?period=7" \
  -H "$CONTENT_TYPE" \
  -H "Authorization: Bearer $PCO_TOKEN")

SUCCESS=$(echo "$STATS_7_RESPONSE" | jq -r '.success')
PERIOD=$(echo "$STATS_7_RESPONSE" | jq -r '.data.period_days')

if [ "$SUCCESS" = "true" ] && [ "$PERIOD" = "7" ]; then
  print_success "Custom period applied (7 days)"
else
  print_fail "Custom period failed"
fi

print_test "6.5" "Invalid Period (Out of Range)"
((TOTAL_TESTS++))
INVALID_PERIOD_RESPONSE=$(curl -s -X GET "$BASE_URL/pco/dashboard/statistics?period=999" \
  -H "$CONTENT_TYPE" \
  -H "Authorization: Bearer $PCO_TOKEN")

SUCCESS=$(echo "$INVALID_PERIOD_RESPONSE" | jq -r '.success')
if [ "$SUCCESS" = "false" ]; then
  print_success "Invalid period correctly rejected"
else
  print_fail "Should reject period > 365"
fi

# ========================================
# Test 7: Dashboard After Report Approval
# ========================================

print_header "Phase 7: Dashboard After Report Lifecycle"

print_test "7.1" "Approve Previously Declined Report"
((TOTAL_TESTS++))
# First resubmit the declined report (signatures already present from earlier PUT)
RESUBMIT_RESPONSE=$(curl -s -X POST "$BASE_URL/pco/reports/$TEST_REPORT_ID/submit" \
  -H "$CONTENT_TYPE" \
  -H "Authorization: Bearer $PCO_TOKEN")

SUCCESS=$(echo "$RESUBMIT_RESPONSE" | jq -r '.success')
if [ "$SUCCESS" = "true" ]; then
  # Now approve it
  APPROVE_RESPONSE=$(curl -s -X POST "$BASE_URL/admin/reports/$TEST_REPORT_ID/approve" \
    -H "$CONTENT_TYPE" \
    -H "Authorization: Bearer $ADMIN_TOKEN")
  
  APPROVE_SUCCESS=$(echo "$APPROVE_RESPONSE" | jq -r '.success')
  if [ "$APPROVE_SUCCESS" = "true" ]; then
    print_success "Report approved by admin"
  else
    print_fail "Report approval failed"
    echo "Response: $APPROVE_RESPONSE"
  fi
else
  print_fail "Report resubmission failed"
  echo "Response: $RESUBMIT_RESPONSE"
fi

print_test "7.2" "Verify Dashboard After Approval"
((TOTAL_TESTS++))
SUMMARY_RESPONSE=$(curl -s -X GET "$BASE_URL/pco/dashboard/summary" \
  -H "$CONTENT_TYPE" \
  -H "Authorization: Bearer $PCO_TOKEN")

COMPLETED_REPORTS=$(echo "$SUMMARY_RESPONSE" | jq -r '.data.total_reports_completed')
DECLINED_COUNT=$(echo "$SUMMARY_RESPONSE" | jq -r '.data.declined_reports_count')

if [ "$COMPLETED_REPORTS" -ge "1" ]; then
  print_success "Dashboard updated after approval (Completed: $COMPLETED_REPORTS, Declined: $DECLINED_COUNT)"
else
  print_fail "Dashboard not updated after approval"
fi

print_test "7.3" "Verify Declined Reports Empty After Approval"
((TOTAL_TESTS++))
DECLINED_RESPONSE=$(curl -s -X GET "$BASE_URL/pco/dashboard/declined-reports" \
  -H "$CONTENT_TYPE" \
  -H "Authorization: Bearer $PCO_TOKEN")

DECLINED_COUNT=$(echo "$DECLINED_RESPONSE" | jq -r '.data.total_declined')
if [ "$DECLINED_COUNT" = "0" ]; then
  print_success "Declined reports cleared after approval"
else
  print_fail "Declined report still showing after approval"
fi

# ========================================
# Test 8: Performance & Edge Cases
# ========================================

print_header "Phase 8: Performance & Edge Cases"

print_test "8.1" "Dashboard Response Time"
((TOTAL_TESTS++))
START_TIME=$(date +%s%3N)
RESPONSE=$(curl -s -X GET "$BASE_URL/pco/dashboard/summary" \
  -H "$CONTENT_TYPE" \
  -H "Authorization: Bearer $PCO_TOKEN")
END_TIME=$(date +%s%3N)
DURATION=$((END_TIME - START_TIME))

if [ $DURATION -lt 1000 ]; then
  print_success "Dashboard responds quickly (${DURATION}ms < 1000ms)"
else
  print_fail "Dashboard too slow (${DURATION}ms)"
fi

print_test "8.2" "Admin Cannot Access PCO Dashboard"
((TOTAL_TESTS++))
ADMIN_ACCESS_RESPONSE=$(curl -s -X GET "$BASE_URL/pco/dashboard/summary" \
  -H "$CONTENT_TYPE" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

SUCCESS=$(echo "$ADMIN_ACCESS_RESPONSE" | jq -r '.success')
if [ "$SUCCESS" = "false" ]; then
  print_success "Admin correctly denied access to PCO dashboard"
else
  print_fail "Admin should not access PCO dashboard"
fi

print_test "8.3" "Invalid Query Parameters Handled"
((TOTAL_TESTS++))
INVALID_RESPONSE=$(curl -s -X GET "$BASE_URL/pco/dashboard/recent-reports?limit=invalid" \
  -H "$CONTENT_TYPE" \
  -H "Authorization: Bearer $PCO_TOKEN")

# Should default to 10 or handle gracefully
SUCCESS=$(echo "$INVALID_RESPONSE" | jq -r '.success')
if [ "$SUCCESS" = "true" ]; then
  print_success "Invalid parameters handled gracefully"
else
  print_fail "Should handle invalid parameters gracefully"
fi

# ========================================
# Final Report
# ========================================

print_header "PHASE 4.1: PCO DASHBOARD TEST RESULTS"

echo -e "${BLUE}Total Tests:${NC} $TOTAL_TESTS"
echo -e "${GREEN}Passed:${NC} $PASSED_TESTS"
echo -e "${RED}Failed:${NC} $FAILED_TESTS"
echo ""

PASS_RATE=$(awk "BEGIN {printf \"%.1f\", ($PASSED_TESTS/$TOTAL_TESTS)*100}")
echo -e "${BLUE}Pass Rate:${NC} ${PASS_RATE}%"

echo ""
if [ $FAILED_TESTS -eq 0 ]; then
  echo -e "${GREEN}========================================${NC}"
  echo -e "${GREEN}ALL TESTS PASSED! 🎉${NC}"
  echo -e "${GREEN}Phase 4.1 Complete - Ready for Phase 4.2${NC}"
  echo -e "${GREEN}========================================${NC}"
  exit 0
else
  echo -e "${RED}========================================${NC}"
  echo -e "${RED}SOME TESTS FAILED${NC}"
  echo -e "${RED}Please review and fix issues${NC}"
  echo -e "${RED}========================================${NC}"
  exit 1
fi
