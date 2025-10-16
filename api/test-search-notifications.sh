#!/bin/bash

# KPS Backend API - Phase 5.2: Search & Notifications Test Script
# Tests all 8 search and notification endpoints

BASE_URL="http://localhost:3001/api"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Tokens
ADMIN_TOKEN=""
PCO_TOKEN=""

# Test notification ID
TEST_NOTIFICATION_ID=""

# Function to print test header
print_header() {
    echo -e "\n${BLUE}================================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}================================================${NC}\n"
}

# Function to print test result
print_result() {
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    if [ "$1" == "PASS" ]; then
        PASSED_TESTS=$((PASSED_TESTS + 1))
        echo -e "${GREEN}✓ PASS${NC} - $2"
    else
        FAILED_TESTS=$((FAILED_TESTS + 1))
        echo -e "${RED}✗ FAIL${NC} - $2"
        if [ ! -z "$3" ]; then
            echo -e "${RED}  Error: $3${NC}"
        fi
    fi
}

# Function to make API request
api_request() {
    local method=$1
    local endpoint=$2
    local token=$3
    local data=$4
    
    if [ -z "$data" ]; then
        curl -s -X "$method" "$BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $token"
    else
        curl -s -X "$method" "$BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $token" \
            -d "$data"
    fi
}

# ============================================================
# Phase 0: Authentication Setup
# ============================================================
print_header "Phase 0: Authentication Setup"

# Test 0.1: Admin Login
echo "Test 0.1: Admin login..."
ADMIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"login_id":"admin12345","password":"ResetPassword123"}')

ADMIN_TOKEN=$(echo $ADMIN_RESPONSE | jq -r '.data.token // empty')

if [ ! -z "$ADMIN_TOKEN" ]; then
    print_result "PASS" "Admin authentication successful"
else
    print_result "FAIL" "Admin authentication failed" "No token received"
    exit 1
fi

# Test 0.2: PCO Login
echo "Test 0.2: PCO login..."
PCO_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"login_id":"pco11111","password":"ResetPassword123"}')

PCO_TOKEN=$(echo $PCO_RESPONSE | jq -r '.data.token // empty')

if [ -z "$PCO_TOKEN" ]; then
    print_result "FAIL" "PCO authentication failed" "No token received"
    echo "Response: $PCO_RESPONSE"
    exit 1
fi

if [ ! -z "$PCO_TOKEN" ]; then
    print_result "PASS" "PCO authentication successful"
else
    print_result "FAIL" "PCO authentication failed" "No token received"
fi

# ============================================================
# Phase 1: Global Search Tests
# ============================================================
print_header "Phase 1: Global Search Tests"

# Test 1.1: Global search with valid query
echo "Test 1.1: Global search for 'test'..."
RESPONSE=$(api_request "GET" "/search/global?q=test" "$ADMIN_TOKEN")
if echo "$RESPONSE" | grep -q '"success":true'; then
    print_result "PASS" "Global search returned results"
else
    print_result "FAIL" "Global search failed" "$RESPONSE"
fi

# Test 1.2: Global search with limit
echo "Test 1.2: Global search with limit..."
RESPONSE=$(api_request "GET" "/search/global?q=abc&limit=5" "$ADMIN_TOKEN")
if echo "$RESPONSE" | grep -q '"success":true'; then
    print_result "PASS" "Global search with limit successful"
else
    print_result "FAIL" "Global search with limit failed" "$RESPONSE"
fi

# Test 1.3: Global search without query (should fail)
echo "Test 1.3: Global search without query parameter..."
RESPONSE=$(api_request "GET" "/search/global" "$ADMIN_TOKEN")
if echo "$RESPONSE" | grep -q '"success":false'; then
    print_result "PASS" "Global search correctly rejected missing query"
else
    print_result "FAIL" "Global search should require query parameter"
fi

# Test 1.4: Global search with empty query (should fail)
echo "Test 1.4: Global search with empty query..."
RESPONSE=$(api_request "GET" "/search/global?q=" "$ADMIN_TOKEN")
if echo "$RESPONSE" | grep -q '"success":false'; then
    print_result "PASS" "Global search correctly rejected empty query"
else
    print_result "FAIL" "Global search should reject empty query"
fi

# ============================================================
# Phase 2: Report Search Tests
# ============================================================
print_header "Phase 2: Report Search Tests"

# Test 2.1: Search reports by query
echo "Test 2.1: Search reports by query..."
RESPONSE=$(api_request "GET" "/search/reports?q=abc" "$ADMIN_TOKEN")
if echo "$RESPONSE" | grep -q '"success":true'; then
    print_result "PASS" "Report search by query successful"
else
    print_result "FAIL" "Report search failed" "$RESPONSE"
fi

# Test 2.2: Search reports by status
echo "Test 2.2: Search reports by status..."
RESPONSE=$(api_request "GET" "/search/reports?status=approved" "$ADMIN_TOKEN")
if echo "$RESPONSE" | grep -q '"success":true'; then
    print_result "PASS" "Report search by status successful"
else
    print_result "FAIL" "Report search by status failed"
fi

# Test 2.3: Search reports with date range
echo "Test 2.3: Search reports with date range..."
RESPONSE=$(api_request "GET" "/search/reports?date_from=2024-01-01&date_to=2024-12-31" "$ADMIN_TOKEN")
if echo "$RESPONSE" | grep -q '"success":true'; then
    print_result "PASS" "Report search with date range successful"
else
    print_result "FAIL" "Report search with date range failed"
fi

# Test 2.4: Search reports with multiple filters
echo "Test 2.4: Search reports with multiple filters..."
RESPONSE=$(api_request "GET" "/search/reports?q=abc&status=pending&limit=10" "$ADMIN_TOKEN")
if echo "$RESPONSE" | grep -q '"success":true'; then
    print_result "PASS" "Report search with multiple filters successful"
else
    print_result "FAIL" "Report search with multiple filters failed"
fi

# ============================================================
# Phase 3: User Search Tests
# ============================================================
print_header "Phase 3: User Search Tests"

# Test 3.1: Search users by name
echo "Test 3.1: Search users by name..."
RESPONSE=$(api_request "GET" "/search/users?q=test" "$ADMIN_TOKEN")
if echo "$RESPONSE" | grep -q '"success":true'; then
    print_result "PASS" "User search by name successful"
else
    print_result "FAIL" "User search failed" "$RESPONSE"
fi

# Test 3.2: Search users by role
echo "Test 3.2: Search users by role..."
RESPONSE=$(api_request "GET" "/search/users?role=pco" "$ADMIN_TOKEN")
if echo "$RESPONSE" | grep -q '"success":true'; then
    print_result "PASS" "User search by role successful"
else
    print_result "FAIL" "User search by role failed"
fi

# Test 3.3: Search active users only
echo "Test 3.3: Search active users..."
RESPONSE=$(api_request "GET" "/search/users?is_active=true" "$ADMIN_TOKEN")
if echo "$RESPONSE" | grep -q '"success":true'; then
    print_result "PASS" "Active user search successful"
else
    print_result "FAIL" "Active user search failed"
fi

# Test 3.4: Search users with combined filters
echo "Test 3.4: Search users with combined filters..."
RESPONSE=$(api_request "GET" "/search/users?role=pco&is_active=true&limit=5" "$ADMIN_TOKEN")
if echo "$RESPONSE" | grep -q '"success":true'; then
    print_result "PASS" "User search with combined filters successful"
else
    print_result "FAIL" "User search with combined filters failed"
fi

# ============================================================
# Phase 4: Client Search Tests
# ============================================================
print_header "Phase 4: Client Search Tests"

# Test 4.1: Search clients by company name
echo "Test 4.1: Search clients by company name..."
RESPONSE=$(api_request "GET" "/search/clients?q=restaurant" "$ADMIN_TOKEN")
if echo "$RESPONSE" | grep -q '"success":true'; then
    print_result "PASS" "Client search by name successful"
else
    print_result "FAIL" "Client search failed" "$RESPONSE"
fi

# Test 4.2: Search active clients
echo "Test 4.2: Search active clients..."
RESPONSE=$(api_request "GET" "/search/clients?is_active=true" "$ADMIN_TOKEN")
if echo "$RESPONSE" | grep -q '"success":true'; then
    print_result "PASS" "Active client search successful"
else
    print_result "FAIL" "Active client search failed"
fi

# Test 4.3: Search clients with filters
echo "Test 4.3: Search clients with multiple filters..."
RESPONSE=$(api_request "GET" "/search/clients?q=test&is_active=true" "$ADMIN_TOKEN")
if echo "$RESPONSE" | grep -q '"success":true'; then
    print_result "PASS" "Client search with multiple filters successful"
else
    print_result "FAIL" "Client search with multiple filters failed"
fi

# ============================================================
# Phase 5: Chemical Search Tests
# ============================================================
print_header "Phase 5: Chemical Search Tests"

# Test 5.1: Search chemicals by product name
echo "Test 5.1: Search chemicals by product name..."
RESPONSE=$(api_request "GET" "/search/chemicals?q=bait" "$ADMIN_TOKEN")
if echo "$RESPONSE" | grep -q '"success":true'; then
    print_result "PASS" "Chemical search by name successful"
else
    print_result "FAIL" "Chemical search failed" "$RESPONSE"
fi

# Test 5.2: Search chemicals by usage type
echo "Test 5.2: Search chemicals by usage type..."
RESPONSE=$(api_request "GET" "/search/chemicals?usage_type=bait_inspection" "$ADMIN_TOKEN")
if echo "$RESPONSE" | grep -q '"success":true'; then
    print_result "PASS" "Chemical search by usage type successful"
else
    print_result "FAIL" "Chemical search by usage type failed"
fi

# Test 5.3: Search active chemicals
echo "Test 5.3: Search active chemicals..."
RESPONSE=$(api_request "GET" "/search/chemicals?is_active=true" "$ADMIN_TOKEN")
if echo "$RESPONSE" | grep -q '"success":true'; then
    print_result "PASS" "Active chemical search successful"
else
    print_result "FAIL" "Active chemical search failed"
fi

# ============================================================
# Phase 6: Notification Management Tests
# ============================================================
print_header "Phase 6: Notification Management Tests"

# Setup: Create a test notification for the PCO user
echo "Setup: Creating test notification for PCO..."
PCO_USER_ID=$(echo $PCO_RESPONSE | jq -r '.data.user.id')
api_request "POST" "/notifications/send" "$ADMIN_TOKEN" "{
    \"user_id\": $PCO_USER_ID,
    \"type\": \"system_update\",
    \"title\": \"Setup Test Notification\",
    \"message\": \"This notification is created for testing purposes\"
}" > /dev/null 2>&1

# Test 6.1: Get all notifications for user
echo "Test 6.1: Get all notifications..."
RESPONSE=$(api_request "GET" "/notifications" "$PCO_TOKEN")
if echo "$RESPONSE" | grep -q '"success":true'; then
    # Extract first notification ID for later tests
    TEST_NOTIFICATION_ID=$(echo $RESPONSE | jq -r '.data.notifications[0].id // empty')
    print_result "PASS" "Get notifications successful (ID: $TEST_NOTIFICATION_ID)"
else
    print_result "FAIL" "Get notifications failed" "$RESPONSE"
fi

# Test 6.2: Get unread notifications only
echo "Test 6.2: Get unread notifications..."
RESPONSE=$(api_request "GET" "/notifications?unread_only=true" "$PCO_TOKEN")
if echo "$RESPONSE" | grep -q '"success":true'; then
    print_result "PASS" "Get unread notifications successful"
else
    print_result "FAIL" "Get unread notifications failed"
fi

# Test 6.3: Get notifications with pagination
echo "Test 6.3: Get notifications with pagination..."
RESPONSE=$(api_request "GET" "/notifications?limit=5&offset=0" "$PCO_TOKEN")
if echo "$RESPONSE" | grep -q '"success":true'; then
    print_result "PASS" "Notifications pagination successful"
else
    print_result "FAIL" "Notifications pagination failed"
fi

# Test 6.4: Mark notification as read
if [ ! -z "$TEST_NOTIFICATION_ID" ]; then
    echo "Test 6.4: Mark notification as read..."
    RESPONSE=$(api_request "PUT" "/notifications/$TEST_NOTIFICATION_ID/read" "$PCO_TOKEN")
    if echo "$RESPONSE" | grep -q '"success":true'; then
        print_result "PASS" "Mark notification as read successful"
    else
        print_result "FAIL" "Mark notification as read failed" "$RESPONSE"
    fi
else
    print_result "FAIL" "Mark notification as read skipped" "No notification ID available"
fi

# Test 6.5: Mark all notifications as read
echo "Test 6.5: Mark all notifications as read..."
RESPONSE=$(api_request "PUT" "/notifications/mark-all-read" "$PCO_TOKEN")
if echo "$RESPONSE" | grep -q '"success":true'; then
    print_result "PASS" "Mark all as read successful"
else
    print_result "FAIL" "Mark all as read failed" "$RESPONSE"
fi

# Test 6.6: Admin sends notification
echo "Test 6.6: Admin sends notification..."
RESPONSE=$(api_request "POST" "/notifications/send" "$ADMIN_TOKEN" "{
    \"user_id\": $PCO_USER_ID,
    \"type\": \"system_update\",
    \"title\": \"Test Notification\",
    \"message\": \"This is a test notification from automated testing\"
}")
if echo "$RESPONSE" | grep -q '"success":true'; then
    print_result "PASS" "Admin send notification successful"
else
    print_result "FAIL" "Admin send notification failed" "$RESPONSE"
fi

# Test 6.7: PCO cannot send notification (should fail)
echo "Test 6.7: PCO cannot send notification..."
RESPONSE=$(api_request "POST" "/notifications/send" "$PCO_TOKEN" '{
    "user_id": 12,
    "type": "system_update",
    "title": "Unauthorized Test",
    "message": "This should fail"
}')
if echo "$RESPONSE" | grep -q '"success":false'; then
    print_result "PASS" "PCO correctly denied from sending notifications"
else
    print_result "FAIL" "PCO should not be able to send notifications"
fi

# ============================================================
# Phase 7: Notification Validation Tests
# ============================================================
print_header "Phase 7: Notification Validation Tests"

# Test 7.1: Send notification with missing fields
echo "Test 7.1: Send notification with missing fields..."
RESPONSE=$(api_request "POST" "/notifications/send" "$ADMIN_TOKEN" '{
    "user_id": 12,
    "type": "system_update"
}')
if echo "$RESPONSE" | grep -q '"success":false'; then
    print_result "PASS" "Missing fields correctly rejected"
else
    print_result "FAIL" "Should reject missing fields"
fi

# Test 7.2: Send notification with invalid type
echo "Test 7.2: Send notification with invalid type..."
RESPONSE=$(api_request "POST" "/notifications/send" "$ADMIN_TOKEN" '{
    "user_id": 12,
    "type": "invalid_type",
    "title": "Test",
    "message": "Test message"
}')
if echo "$RESPONSE" | grep -q '"success":false'; then
    print_result "PASS" "Invalid notification type correctly rejected"
else
    print_result "FAIL" "Should reject invalid notification type"
fi

# Test 7.3: Send notification to non-existent user
echo "Test 7.3: Send notification to non-existent user..."
RESPONSE=$(api_request "POST" "/notifications/send" "$ADMIN_TOKEN" '{
    "user_id": 99999,
    "type": "system_update",
    "title": "Test",
    "message": "Test message"
}')
if echo "$RESPONSE" | grep -q '"success":false'; then
    print_result "PASS" "Non-existent user correctly rejected"
else
    print_result "FAIL" "Should reject non-existent user"
fi

# Test 7.4: Mark non-existent notification as read
echo "Test 7.4: Mark non-existent notification as read..."
RESPONSE=$(api_request "PUT" "/notifications/99999/read" "$PCO_TOKEN")
if echo "$RESPONSE" | grep -q '"success":false'; then
    print_result "PASS" "Non-existent notification correctly rejected"
else
    print_result "FAIL" "Should reject non-existent notification"
fi

# ============================================================
# Phase 8: Access Control Tests
# ============================================================
print_header "Phase 8: Access Control Tests"

# Test 8.1: Search without authentication
echo "Test 8.1: Search without authentication..."
RESPONSE=$(curl -s -X GET "$BASE_URL/search/global?q=test")
if echo "$RESPONSE" | grep -q '"success":false\|No token provided'; then
    print_result "PASS" "Unauthenticated search correctly rejected"
else
    print_result "FAIL" "Should require authentication" "$RESPONSE"
fi

# Test 8.2: Notifications without authentication
echo "Test 8.2: Get notifications without authentication..."
RESPONSE=$(curl -s -X GET "$BASE_URL/notifications")
if echo "$RESPONSE" | grep -q '"success":false\|No token provided'; then
    print_result "PASS" "Unauthenticated notifications correctly rejected"
else
    print_result "FAIL" "Should require authentication" "$RESPONSE"
fi

# Test 8.3: PCO can search (authorization check)
echo "Test 8.3: PCO can perform searches..."
RESPONSE=$(api_request "GET" "/search/global?q=test" "$PCO_TOKEN")
if echo "$RESPONSE" | grep -q '"success":true'; then
    print_result "PASS" "PCO search access granted"
else
    print_result "FAIL" "PCO should have search access"
fi

# ============================================================
# Final Summary
# ============================================================
print_header "Test Summary"

echo -e "Total Tests: ${BLUE}$TOTAL_TESTS${NC}"
echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed: ${RED}$FAILED_TESTS${NC}"

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "\n${GREEN}================================================${NC}"
    echo -e "${GREEN}ALL TESTS PASSED! ✓${NC}"
    echo -e "${GREEN}Phase 5.2 - Search & Notifications: 100%${NC}"
    echo -e "${GREEN}================================================${NC}\n"
    exit 0
else
    echo -e "\n${RED}================================================${NC}"
    echo -e "${RED}SOME TESTS FAILED ✗${NC}"
    echo -e "${RED}Please review the failures above${NC}"
    echo -e "${RED}================================================${NC}\n"
    exit 1
fi
