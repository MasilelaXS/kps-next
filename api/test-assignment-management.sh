#!/bin/bash

# KPS Pest Control Management System - Assignment Management Test Script
# Phase 3.1: Assignment Management Testing
# Comprehensive test suite for all 5 endpoints

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
API_BASE="http://localhost:3001/api"
ADMIN_TOKEN=""

# Counters
TOTAL_TESTS=0
PASSED_TESTS=0

# Test results array
declare -a TEST_RESULTS

# Helper functions
print_header() {
    echo ""
    echo -e "${BLUE}============================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}============================================${NC}"
}

print_test() {
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓ PASS${NC}: $2"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        TEST_RESULTS+=("PASS: $2")
    else
        echo -e "${RED}✗ FAIL${NC}: $2"
        TEST_RESULTS+=("FAIL: $2")
    fi
}

validate_json() {
    echo "$1" | jq . > /dev/null 2>&1
    return $?
}

print_header "KPS ASSIGNMENT MANAGEMENT TESTS"
echo "Testing Phase 3.1: Assignment Management"
echo "Date: $(date)"
echo ""

# ============================================
# TEST 1: AUTHENTICATION
# ============================================
print_header "TEST 1: AUTHENTICATION"

echo "Attempting admin login..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"login_id":"admin12345","password":"ResetPassword123"}')

ADMIN_TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.data.token')

if [ "$ADMIN_TOKEN" != "null" ] && [ ! -z "$ADMIN_TOKEN" ]; then
    print_test 0 "Admin authentication successful"
    echo "Token obtained: ${ADMIN_TOKEN:0:30}..."
else
    print_test 1 "Admin authentication failed"
    echo "Response: $LOGIN_RESPONSE"
    exit 1
fi

# ============================================
# TEST 2: GET ASSIGNMENT LIST (Empty/Initial)
# ============================================
print_header "TEST 2: GET ASSIGNMENT LIST"

echo "Fetching assignment list..."
LIST_RESPONSE=$(curl -s -X GET "$API_BASE/admin/assignments" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

validate_json "$LIST_RESPONSE"
if [ $? -eq 0 ]; then
    SUCCESS=$(echo $LIST_RESPONSE | jq -r '.success')
    if [ "$SUCCESS" = "true" ]; then
        print_test 0 "Get assignment list endpoint works"
        TOTAL=$(echo $LIST_RESPONSE | jq -r '.data.pagination.total_assignments')
        echo "Total assignments in system: $TOTAL"
    else
        print_test 1 "Get assignment list returned success=false"
    fi
else
    print_test 1 "Get assignment list returned invalid JSON"
fi

# ============================================
# TEST 3: PAGINATION - Page 1
# ============================================
print_header "TEST 3: PAGINATION - PAGE 1"

echo "Testing pagination (page=1, limit=5)..."
PAGE1=$(curl -s -X GET "$API_BASE/admin/assignments?page=1&limit=5" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

validate_json "$PAGE1"
if [ $? -eq 0 ]; then
    PAGE_NUM=$(echo $PAGE1 | jq -r '.data.pagination.current_page')
    PER_PAGE=$(echo $PAGE1 | jq -r '.data.pagination.per_page')
    RETURNED=$(echo $PAGE1 | jq -r '.data.assignments | length')
    
    if [ "$PAGE_NUM" = "1" ] && [ "$PER_PAGE" = "5" ] && [ "$RETURNED" -le 5 ]; then
        print_test 0 "Pagination works correctly"
        echo "Page: $PAGE_NUM, Per page: $PER_PAGE, Returned: $RETURNED"
    else
        print_test 1 "Pagination parameters incorrect"
        echo "Expected page=1, per_page=5, got page=$PAGE_NUM, per_page=$PER_PAGE, returned=$RETURNED"
    fi
else
    print_test 1 "Pagination returned invalid JSON"
fi

# ============================================
# TEST 4: FILTER BY STATUS - Active
# ============================================
print_header "TEST 4: FILTER BY STATUS"

echo "Filtering active assignments..."
FILTER_ACTIVE=$(curl -s -X GET "$API_BASE/admin/assignments?status=active" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

validate_json "$FILTER_ACTIVE"
if [ $? -eq 0 ]; then
    FILTER_STATUS=$(echo $FILTER_ACTIVE | jq -r '.data.filters.status')
    if [ "$FILTER_STATUS" = "active" ]; then
        print_test 0 "Filter by status works"
        ACTIVE_COUNT=$(echo $FILTER_ACTIVE | jq -r '.data.pagination.total_assignments')
        echo "Active assignments: $ACTIVE_COUNT"
    else
        print_test 1 "Filter status not applied correctly"
    fi
else
    print_test 1 "Filter by status returned invalid JSON"
fi

# ============================================
# TEST 5: GET ASSIGNMENT STATISTICS
# ============================================
print_header "TEST 5: GET ASSIGNMENT STATISTICS"

echo "Fetching assignment statistics..."
STATS=$(curl -s -X GET "$API_BASE/admin/assignments/stats" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

validate_json "$STATS"
if [ $? -eq 0 ]; then
    SUCCESS=$(echo $STATS | jq -r '.success')
    if [ "$SUCCESS" = "true" ]; then
        print_test 0 "Get assignment statistics works"
        
        TOTAL_ACTIVE=$(echo $STATS | jq -r '.data.summary.total_active_assignments')
        UNASSIGNED=$(echo $STATS | jq -r '.data.summary.unassigned_clients')
        AVG_CLIENTS=$(echo $STATS | jq -r '.data.summary.average_clients_per_pco')
        
        echo "Statistics:"
        echo "  Active assignments: $TOTAL_ACTIVE"
        echo "  Unassigned clients: $UNASSIGNED"
        echo "  Average clients per PCO: $AVG_CLIENTS"
        
        echo ""
        echo "PCO Workload:"
        echo $STATS | jq -r '.data.pco_workload[] | "  - \(.pco_name): \(.client_count) clients"' | head -5
    else
        print_test 1 "Get statistics returned success=false"
    fi
else
    print_test 1 "Get statistics returned invalid JSON"
fi

# ============================================
# TEST 6: GET WORKLOAD BALANCE SUGGESTIONS
# ============================================
print_header "TEST 6: GET WORKLOAD BALANCE"

echo "Fetching workload balance suggestions..."
BALANCE=$(curl -s -X GET "$API_BASE/admin/assignments/workload-balance" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

validate_json "$BALANCE"
if [ $? -eq 0 ]; then
    SUCCESS=$(echo $BALANCE | jq -r '.success')
    if [ "$SUCCESS" = "true" ]; then
        print_test 0 "Get workload balance works"
        
        IDEAL=$(echo $BALANCE | jq -r '.data.summary.ideal_clients_per_pco')
        TOTAL_PCOS=$(echo $BALANCE | jq -r '.data.summary.total_pcos')
        
        echo "Balance Analysis:"
        echo "  Total PCOs: $TOTAL_PCOS"
        echo "  Ideal clients per PCO: $IDEAL"
    else
        print_test 1 "Get workload balance returned success=false"
    fi
else
    print_test 1 "Get workload balance returned invalid JSON"
fi

# ============================================
# TEST 7: SETUP - UNASSIGN CLIENTS FOR TESTING
# ============================================
print_header "TEST 7: TEST SETUP - CREATE UNASSIGNED CLIENTS"

echo "Setting up test data by unassigning some clients..."
SETUP_IDS=$(curl -s -X GET "$API_BASE/admin/assignments?status=active&limit=2" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq -r '[.data.assignments[].id] | .[:2]')

SETUP_COUNT=$(echo $SETUP_IDS | jq '. | length')

if [ "$SETUP_COUNT" -gt 0 ]; then
    SETUP_UNASSIGN=$(curl -s -X POST "$API_BASE/admin/assignments/bulk-unassign" \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"assignment_ids\": $SETUP_IDS}")
    
    SETUP_SUCCESS=$(echo $SETUP_UNASSIGN | jq -r '.success')
    if [ "$SETUP_SUCCESS" = "true" ]; then
        print_test 0 "Test setup: Created unassigned clients for testing"
        echo "Unassigned $SETUP_COUNT client(s)"
    else
        print_test 1 "Test setup failed"
        echo "Response: $SETUP_UNASSIGN"
    fi
else
    print_test 0 "Test setup: Database already has unassigned clients"
fi

# ============================================
# TEST 8: BULK ASSIGN - Valid Request
# ============================================
print_header "TEST 8: BULK ASSIGN CLIENTS"

echo "Finding unassigned clients and PCO..."
UNASSIGNED_IDS=$(curl -s -X GET "$API_BASE/admin/clients?status=active" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | \
  jq -r '[.data.clients[] | select(.assigned_pco_name == null) | .id] | .[:2]')

PCO_ID=$(curl -s -X GET "$API_BASE/admin/users?role=pco&status=active" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | \
  jq -r '.data.users[] | select(.role == "pco") | .id' | head -1)

UNASSIGNED_COUNT=$(echo $UNASSIGNED_IDS | jq '. | length')

echo "Found $UNASSIGNED_COUNT unassigned client(s), PCO ID: $PCO_ID"

if [ "$UNASSIGNED_COUNT" -gt 0 ] && [ ! -z "$PCO_ID" ]; then
    echo "Assigning clients to PCO..."
    ASSIGN=$(curl -s -X POST "$API_BASE/admin/assignments/bulk-assign" \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"pco_id\": $PCO_ID, \"client_ids\": $UNASSIGNED_IDS}")
    
    validate_json "$ASSIGN"
    if [ $? -eq 0 ]; then
        SUCCESS=$(echo $ASSIGN | jq -r '.success')
        if [ "$SUCCESS" = "true" ]; then
            print_test 0 "Bulk assign clients works"
            ASSIGNED=$(echo $ASSIGN | jq -r '.data.assigned_count')
            echo "Successfully assigned: $ASSIGNED client(s)"
        else
            print_test 1 "Bulk assign returned success=false"
            echo "Response: $ASSIGN"
        fi
    else
        print_test 1 "Bulk assign returned invalid JSON"
    fi
else
    print_test 1 "Bulk assign test skipped - no test data available"
fi

# ============================================
# TEST 9: BULK ASSIGN - Duplicate Detection
# ============================================
print_header "TEST 9: BULK ASSIGN - DUPLICATE DETECTION"

if [ "$UNASSIGNED_COUNT" -gt 0 ] && [ ! -z "$PCO_ID" ]; then
    echo "Attempting to assign already assigned clients..."
    DUPLICATE=$(curl -s -X POST "$API_BASE/admin/assignments/bulk-assign" \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"pco_id\": $PCO_ID, \"client_ids\": $UNASSIGNED_IDS}")
    
    SKIPPED=$(echo $DUPLICATE | jq -r '.data.skipped_count')
    if [ "$SKIPPED" -gt 0 ]; then
        print_test 0 "Duplicate assignment detection works"
        echo "Correctly skipped $SKIPPED already assigned client(s)"
    else
        print_test 1 "Duplicate detection not working"
        echo "Response: $DUPLICATE"
    fi
else
    print_test 1 "Duplicate test skipped - no test data"
fi

# ============================================
# TEST 10: FILTER BY PCO
# ============================================
print_header "TEST 10: FILTER ASSIGNMENTS BY PCO"

if [ ! -z "$PCO_ID" ]; then
    echo "Filtering assignments for PCO $PCO_ID..."
    FILTER_PCO=$(curl -s -X GET "$API_BASE/admin/assignments?pco_id=$PCO_ID" \
      -H "Authorization: Bearer $ADMIN_TOKEN")
    
    validate_json "$FILTER_PCO"
    if [ $? -eq 0 ]; then
        FILTER_ID=$(echo $FILTER_PCO | jq -r '.data.filters.pco_id')
        if [ "$FILTER_ID" = "$PCO_ID" ]; then
            print_test 0 "Filter by PCO works"
            COUNT=$(echo $FILTER_PCO | jq -r '.data.pagination.total_assignments')
            echo "Found $COUNT assignment(s) for PCO $PCO_ID"
        else
            print_test 1 "PCO filter not applied correctly"
        fi
    else
        print_test 1 "Filter by PCO returned invalid JSON"
    fi
else
    print_test 1 "Filter by PCO test skipped"
fi

# ============================================
# TEST 11: BULK UNASSIGN - Valid Request
# ============================================
print_header "TEST 11: BULK UNASSIGN CLIENTS"

echo "Getting assignment IDs to unassign..."
UNASSIGN_IDS=$(curl -s -X GET "$API_BASE/admin/assignments?status=active&limit=2" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | \
  jq -r '[.data.assignments[].id] | .[:2]')

UNASSIGN_COUNT=$(echo $UNASSIGN_IDS | jq '. | length')

if [ "$UNASSIGN_COUNT" -gt 0 ]; then
    echo "Unassigning $UNASSIGN_COUNT client(s)..."
    UNASSIGN=$(curl -s -X POST "$API_BASE/admin/assignments/bulk-unassign" \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"assignment_ids\": $UNASSIGN_IDS}")
    
    validate_json "$UNASSIGN"
    if [ $? -eq 0 ]; then
        SUCCESS=$(echo $UNASSIGN | jq -r '.success')
        if [ "$SUCCESS" = "true" ]; then
            print_test 0 "Bulk unassign clients works"
            UNASSIGNED=$(echo $UNASSIGN | jq -r '.data.unassigned_count')
            echo "Successfully unassigned: $UNASSIGNED assignment(s)"
            
            echo ""
            echo "Unassigned clients:"
            echo $UNASSIGN | jq -r '.data.assignments[] | "  - \(.client_name) from \(.pco_name)"'
        else
            print_test 1 "Bulk unassign returned success=false"
            echo "Response: $UNASSIGN"
        fi
    else
        print_test 1 "Bulk unassign returned invalid JSON"
    fi
else
    print_test 1 "Bulk unassign test skipped - no active assignments"
fi

# ============================================
# TEST 12: VALIDATION - Invalid PCO ID
# ============================================
print_header "TEST 12: VALIDATION - INVALID PCO ID"

echo "Testing with invalid PCO ID..."
INVALID_PCO=$(curl -s -X POST "$API_BASE/admin/assignments/bulk-assign" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"pco_id": -1, "client_ids": [1, 2]}')

ERROR=$(echo $INVALID_PCO | jq -r '.message')
if [ "$ERROR" = "Validation failed" ]; then
    print_test 0 "Validation: Invalid PCO ID rejected"
else
    print_test 1 "Validation: Invalid PCO ID not rejected"
    echo "Response: $INVALID_PCO"
fi

# ============================================
# TEST 13: VALIDATION - Empty Client IDs
# ============================================
print_header "TEST 13: VALIDATION - EMPTY CLIENT IDS"

echo "Testing with empty client_ids array..."
EMPTY_CLIENTS=$(curl -s -X POST "$API_BASE/admin/assignments/bulk-assign" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"pco_id": 1, "client_ids": []}')

ERROR=$(echo $EMPTY_CLIENTS | jq -r '.message')
if [ "$ERROR" = "Validation failed" ]; then
    print_test 0 "Validation: Empty client_ids rejected"
else
    print_test 1 "Validation: Empty client_ids not rejected"
    echo "Response: $EMPTY_CLIENTS"
fi

# ============================================
# TEST 14: VALIDATION - Invalid Page Number
# ============================================
print_header "TEST 14: VALIDATION - INVALID PAGE"

echo "Testing with invalid page number..."
INVALID_PAGE=$(curl -s -X GET "$API_BASE/admin/assignments?page=0" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

ERROR=$(echo $INVALID_PAGE | jq -r '.message')
if [ "$ERROR" = "Validation failed" ]; then
    print_test 0 "Validation: Invalid page number rejected"
else
    print_test 1 "Validation: Invalid page number not rejected"
    echo "Response: $INVALID_PAGE"
fi

# ============================================
# TEST 15: VALIDATION - Invalid Status Value
# ============================================
print_header "TEST 15: VALIDATION - INVALID STATUS"

echo "Testing with invalid status value..."
INVALID_STATUS=$(curl -s -X GET "$API_BASE/admin/assignments?status=invalid" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

ERROR=$(echo $INVALID_STATUS | jq -r '.message')
if [ "$ERROR" = "Validation failed" ]; then
    print_test 0 "Validation: Invalid status value rejected"
else
    print_test 1 "Validation: Invalid status value not rejected"
    echo "Response: $INVALID_STATUS"
fi

# ============================================
# TEST 16: VALIDATION - Too Many Client IDs
# ============================================
print_header "TEST 16: VALIDATION - TOO MANY CLIENTS"

echo "Testing with more than 100 client IDs..."
MANY_IDS=$(seq 1 101 | jq -s '.')
TOO_MANY=$(curl -s -X POST "$API_BASE/admin/assignments/bulk-assign" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"pco_id\": 1, \"client_ids\": $MANY_IDS}")

ERROR=$(echo $TOO_MANY | jq -r '.message')
if [ "$ERROR" = "Validation failed" ]; then
    print_test 0 "Validation: Too many client IDs rejected"
else
    print_test 1 "Validation: Too many client IDs not rejected"
    echo "Response: $TOO_MANY"
fi

# ============================================
# TEST 17: AUTHENTICATION - No Token
# ============================================
print_header "TEST 17: AUTHENTICATION - NO TOKEN"

echo "Testing without authentication token..."
NO_TOKEN=$(curl -s -X GET "$API_BASE/admin/assignments")

ERROR=$(echo $NO_TOKEN | jq -r '.message')
if [[ "$ERROR" == *"token"* ]] || [[ "$ERROR" == *"authentication"* ]]; then
    print_test 0 "Authentication: No token rejected"
else
    print_test 1 "Authentication: No token not rejected"
    echo "Response: $NO_TOKEN"
fi

# ============================================
# TEST 18: AUTHENTICATION - Invalid Token
# ============================================
print_header "TEST 18: AUTHENTICATION - INVALID TOKEN"

echo "Testing with invalid token..."
INVALID_TOKEN=$(curl -s -X GET "$API_BASE/admin/assignments" \
  -H "Authorization: Bearer invalid_token_xyz123")

ERROR=$(echo $INVALID_TOKEN | jq -r '.message')
if [[ "$ERROR" == *"token"* ]] || [[ "$ERROR" == *"authentication"* ]]; then
    print_test 0 "Authentication: Invalid token rejected"
else
    print_test 1 "Authentication: Invalid token not rejected"
    echo "Response: $INVALID_TOKEN"
fi

# ============================================
# FINAL SUMMARY
# ============================================
print_header "TEST SUMMARY"

echo ""
echo "Total Tests: $TOTAL_TESTS"
echo "Passed: $PASSED_TESTS"
echo "Failed: $((TOTAL_TESTS - PASSED_TESTS))"
echo ""

if [ $PASSED_TESTS -eq $TOTAL_TESTS ]; then
    echo -e "${GREEN}✓ ALL TESTS PASSED${NC}"
    echo ""
    echo "Phase 3.1 Assignment Management is complete and fully functional!"
    echo ""
    echo "Endpoints tested:"
    echo "  ✓ GET  /api/admin/assignments (with pagination & filters)"
    echo "  ✓ GET  /api/admin/assignments/stats"
    echo "  ✓ GET  /api/admin/assignments/workload-balance"
    echo "  ✓ POST /api/admin/assignments/bulk-assign"
    echo "  ✓ POST /api/admin/assignments/bulk-unassign"
else
    echo -e "${YELLOW}⚠ SOME TESTS FAILED${NC}"
    echo ""
    echo "Failed tests:"
    for result in "${TEST_RESULTS[@]}"; do
        if [[ $result == FAIL* ]]; then
            echo -e "  ${RED}$result${NC}"
        fi
    done
fi

echo ""
echo "Test completed: $(date)"
