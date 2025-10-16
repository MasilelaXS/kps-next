#!/bin/bash

# ============================================================================
# KPS API Testing Suite - Phase 5.1: Admin Dashboard
# ============================================================================
# Tests 5 admin dashboard endpoints for metrics, analytics, and monitoring
# Target: 25-30 tests covering metrics, activity, stats, performance, caching
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

# Variables
ADMIN_TOKEN=""
PCO_TOKEN=""

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

# ============================================================================
# PHASE 0: AUTHENTICATION
# ============================================================================

print_header "PHASE 0: AUTHENTICATION"

# Test 0.1: Admin login
print_test "0.1: Admin login"
ADMIN_LOGIN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"login_id":"admin12345","password":"ResetPassword123"}')

ADMIN_TOKEN=$(echo $ADMIN_LOGIN | jq -r '.data.token')

if [ "$ADMIN_TOKEN" != "null" ] && [ -n "$ADMIN_TOKEN" ]; then
    print_success "Admin authenticated successfully"
else
    print_failure "Admin login failed"
    exit 1
fi

# Test 0.2: PCO login (for negative tests)
print_test "0.2: PCO login"
PCO_LOGIN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"login_id":"pco11111","password":"ResetPassword123"}')

PCO_TOKEN=$(echo $PCO_LOGIN | jq -r '.data.token')

if [ "$PCO_TOKEN" != "null" ] && [ -n "$PCO_TOKEN" ]; then
    print_success "PCO authenticated successfully"
else
    print_failure "PCO login failed"
fi

# ============================================================================
# PHASE 1: DASHBOARD METRICS TESTS
# ============================================================================

print_header "PHASE 1: DASHBOARD METRICS TESTS"

# Test 1.1: Get dashboard metrics
print_test "1.1: Get dashboard metrics"
METRICS_RESPONSE=$(curl -s -X GET "$BASE_URL/admin/dashboard/metrics" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

METRICS_SUCCESS=$(echo $METRICS_RESPONSE | jq -r '.success')
USERS_TOTAL=$(echo $METRICS_RESPONSE | jq -r '.data.users.total')
CLIENTS_TOTAL=$(echo $METRICS_RESPONSE | jq -r '.data.clients.total')
REPORTS_TOTAL=$(echo $METRICS_RESPONSE | jq -r '.data.reports.total')

if [ "$METRICS_SUCCESS" = "true" ] && [ "$USERS_TOTAL" != "null" ]; then
    print_success "Metrics retrieved (Users: $USERS_TOTAL, Clients: $CLIENTS_TOTAL, Reports: $REPORTS_TOTAL)"
else
    print_failure "Failed to retrieve metrics"
fi

# Test 1.2: Metrics include user breakdown
print_test "1.2: Metrics include user breakdown"
PCO_COUNT=$(echo $METRICS_RESPONSE | jq -r '.data.users.pco.total')
ADMIN_COUNT=$(echo $METRICS_RESPONSE | jq -r '.data.users.admin.total')

if [ "$PCO_COUNT" != "null" ] && [ "$ADMIN_COUNT" != "null" ]; then
    print_success "User breakdown included (PCO: $PCO_COUNT, Admin: $ADMIN_COUNT)"
else
    print_failure "User breakdown missing"
fi

# Test 1.3: Metrics include client breakdown
print_test "1.3: Metrics include client status breakdown"
ACTIVE_CLIENTS=$(echo $METRICS_RESPONSE | jq -r '.data.clients.active')
INACTIVE_CLIENTS=$(echo $METRICS_RESPONSE | jq -r '.data.clients.inactive')

if [ "$ACTIVE_CLIENTS" != "null" ]; then
    print_success "Client breakdown included (Active: $ACTIVE_CLIENTS, Inactive: $INACTIVE_CLIENTS)"
else
    print_failure "Client breakdown missing"
fi

# Test 1.4: Metrics include report breakdown
print_test "1.4: Metrics include report status breakdown"
PENDING_REPORTS=$(echo $METRICS_RESPONSE | jq -r '.data.reports.pending')
APPROVED_REPORTS=$(echo $METRICS_RESPONSE | jq -r '.data.reports.approved')

if [ "$PENDING_REPORTS" != "null" ] && [ "$APPROVED_REPORTS" != "null" ]; then
    print_success "Report breakdown included (Pending: $PENDING_REPORTS, Approved: $APPROVED_REPORTS)"
else
    print_failure "Report breakdown missing"
fi

# Test 1.5: Metrics include recent activity
print_test "1.5: Metrics include 24-hour activity"
RECENT_REPORTS=$(echo $METRICS_RESPONSE | jq -r '.data.recent_activity.reports_24h')

if [ "$RECENT_REPORTS" != "null" ]; then
    print_success "Recent activity included (Reports 24h: $RECENT_REPORTS)"
else
    print_failure "Recent activity missing"
fi

# Test 1.6: Metrics include cache info
print_test "1.6: Metrics include cache information"
CACHE_TTL=$(echo $METRICS_RESPONSE | jq -r '.data.cache_info.ttl_minutes')

if [ "$CACHE_TTL" = "15" ]; then
    print_success "Cache info included (TTL: $CACHE_TTL minutes)"
else
    print_failure "Cache info missing or incorrect"
fi

# Test 1.7: PCO cannot access metrics
print_test "1.7: PCO access denied to metrics"
PCO_METRICS_RESPONSE=$(curl -s -X GET "$BASE_URL/admin/dashboard/metrics" \
  -H "Authorization: Bearer $PCO_TOKEN")

PCO_METRICS_SUCCESS=$(echo $PCO_METRICS_RESPONSE | jq -r '.success')

if [ "$PCO_METRICS_SUCCESS" = "false" ]; then
    print_success "PCO correctly denied access to metrics"
else
    print_failure "PCO should not access metrics"
fi

# ============================================================================
# PHASE 2: ACTIVITY LOG TESTS
# ============================================================================

print_header "PHASE 2: ACTIVITY LOG TESTS"

# Test 2.1: Get recent activity (default)
print_test "2.1: Get recent activity with defaults"
ACTIVITY_RESPONSE=$(curl -s -X GET "$BASE_URL/admin/dashboard/activity" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

ACTIVITY_SUCCESS=$(echo $ACTIVITY_RESPONSE | jq -r '.success')
ACTIVITY_COUNT=$(echo $ACTIVITY_RESPONSE | jq -r '.data.count')

if [ "$ACTIVITY_SUCCESS" = "true" ] && [ "$ACTIVITY_COUNT" != "null" ]; then
    print_success "Activity log retrieved ($ACTIVITY_COUNT activities)"
else
    print_failure "Failed to retrieve activity log"
fi

# Test 2.2: Activity includes different types
print_test "2.2: Activity includes various event types"
FIRST_TYPE=$(echo $ACTIVITY_RESPONSE | jq -r '.data.activities[0].type')

if [ "$FIRST_TYPE" != "null" ]; then
    print_success "Activity types included (First: $FIRST_TYPE)"
else
    print_failure "Activity types missing"
fi

# Test 2.3: Filter activity by type (reports)
print_test "2.3: Filter activity by type (reports only)"
REPORTS_ACTIVITY=$(curl -s -X GET "$BASE_URL/admin/dashboard/activity?activity_type=reports&limit=10" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

REPORTS_ACTIVITY_COUNT=$(echo $REPORTS_ACTIVITY | jq -r '.data.count')
REPORTS_FILTER=$(echo $REPORTS_ACTIVITY | jq -r '.data.filter')

if [ "$REPORTS_FILTER" = "reports" ] && [ "$REPORTS_ACTIVITY_COUNT" != "null" ]; then
    print_success "Activity filtered by reports ($REPORTS_ACTIVITY_COUNT entries)"
else
    print_failure "Activity filtering failed"
fi

# Test 2.4: Limit parameter works
print_test "2.4: Limit parameter restricts results"
LIMITED_ACTIVITY=$(curl -s -X GET "$BASE_URL/admin/dashboard/activity?limit=5" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

LIMITED_COUNT=$(echo $LIMITED_ACTIVITY | jq -r '.data.count')

if [ "$LIMITED_COUNT" -le "5" ]; then
    print_success "Limit parameter working (Returned: $LIMITED_COUNT)"
else
    print_failure "Limit parameter not working correctly"
fi

# Test 2.5: Activity is sorted by timestamp
print_test "2.5: Activity sorted by most recent first"
FIRST_TIMESTAMP=$(echo $ACTIVITY_RESPONSE | jq -r '.data.activities[0].timestamp')
SECOND_TIMESTAMP=$(echo $ACTIVITY_RESPONSE | jq -r '.data.activities[1].timestamp')

if [[ "$FIRST_TIMESTAMP" > "$SECOND_TIMESTAMP" ]] || [[ "$FIRST_TIMESTAMP" == "$SECOND_TIMESTAMP" ]]; then
    print_success "Activity properly sorted by timestamp"
else
    print_failure "Activity sorting incorrect"
fi

# ============================================================================
# PHASE 3: STATISTICS TESTS
# ============================================================================

print_header "PHASE 3: STATISTICS TESTS"

# Test 3.1: Get statistics (default 30d)
print_test "3.1: Get statistics with default period (30d)"
STATS_RESPONSE=$(curl -s -X GET "$BASE_URL/admin/dashboard/stats" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

STATS_SUCCESS=$(echo $STATS_RESPONSE | jq -r '.success')
STATS_PERIOD=$(echo $STATS_RESPONSE | jq -r '.data.period.label')

if [ "$STATS_SUCCESS" = "true" ] && [ "$STATS_PERIOD" = "30d" ]; then
    print_success "Statistics retrieved (Period: $STATS_PERIOD)"
else
    print_failure "Failed to retrieve statistics"
fi

# Test 3.2: Statistics include approval rates
print_test "3.2: Statistics include approval rates"
APPROVAL_RATE=$(echo $STATS_RESPONSE | jq -r '.data.approval_stats.approval_rate')
TOTAL_REVIEWED=$(echo $STATS_RESPONSE | jq -r '.data.approval_stats.total_reviewed')

if [ "$APPROVAL_RATE" != "null" ]; then
    print_success "Approval stats included (Rate: $APPROVAL_RATE%, Reviewed: $TOTAL_REVIEWED)"
else
    print_failure "Approval stats missing"
fi

# Test 3.3: Statistics include turnaround time
print_test "3.3: Statistics include turnaround time metrics"
AVG_HOURS=$(echo $STATS_RESPONSE | jq -r '.data.turnaround_time.avg_hours')

if [ "$AVG_HOURS" != "null" ]; then
    print_success "Turnaround time included (Avg: $AVG_HOURS hours)"
else
    print_failure "Turnaround time missing"
fi

# Test 3.4: Statistics include top PCOs
print_test "3.4: Statistics include top PCO performers"
TOP_PCOS=$(echo $STATS_RESPONSE | jq -r '.data.top_pcos | length')

if [ "$TOP_PCOS" != "null" ]; then
    print_success "Top PCOs included ($TOP_PCOS PCOs)"
else
    print_failure "Top PCOs missing"
fi

# Test 3.5: Statistics include top clients
print_test "3.5: Statistics include top clients by activity"
TOP_CLIENTS=$(echo $STATS_RESPONSE | jq -r '.data.top_clients | length')

if [ "$TOP_CLIENTS" != "null" ]; then
    print_success "Top clients included ($TOP_CLIENTS clients)"
else
    print_failure "Top clients missing"
fi

# Test 3.6: Statistics with 7d period
print_test "3.6: Statistics with 7-day period"
STATS_7D=$(curl -s -X GET "$BASE_URL/admin/dashboard/stats?period=7d" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

STATS_7D_PERIOD=$(echo $STATS_7D | jq -r '.data.period.label')
STATS_7D_DAYS=$(echo $STATS_7D | jq -r '.data.period.days')

if [ "$STATS_7D_PERIOD" = "7d" ] && [ "$STATS_7D_DAYS" = "7" ]; then
    print_success "7-day period stats retrieved"
else
    print_failure "7-day period stats failed"
fi

# Test 3.7: Statistics include cache info
print_test "3.7: Statistics include cache information"
STATS_CACHE_TTL=$(echo $STATS_RESPONSE | jq -r '.data.cache_info.ttl_minutes')

if [ "$STATS_CACHE_TTL" = "60" ]; then
    print_success "Stats cache info included (TTL: $STATS_CACHE_TTL minutes)"
else
    print_failure "Stats cache info missing or incorrect"
fi

# ============================================================================
# PHASE 4: PERFORMANCE METRICS TESTS
# ============================================================================

print_header "PHASE 4: PERFORMANCE METRICS TESTS"

# Test 4.1: Get performance metrics
print_test "4.1: Get system performance metrics"
PERF_RESPONSE=$(curl -s -X GET "$BASE_URL/admin/dashboard/performance" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

PERF_SUCCESS=$(echo $PERF_RESPONSE | jq -r '.success')
ACTIVE_SESSIONS=$(echo $PERF_RESPONSE | jq -r '.data.sessions.active')

if [ "$PERF_SUCCESS" = "true" ] && [ "$ACTIVE_SESSIONS" != "null" ]; then
    print_success "Performance metrics retrieved (Active sessions: $ACTIVE_SESSIONS)"
else
    print_failure "Failed to retrieve performance metrics"
fi

# Test 4.2: Performance includes security metrics
print_test "4.2: Performance includes security metrics"
FAILED_LOGINS=$(echo $PERF_RESPONSE | jq -r '.data.security.failed_logins_24h')
LOCKED_ACCOUNTS=$(echo $PERF_RESPONSE | jq -r '.data.security.locked_accounts')

if [ "$FAILED_LOGINS" != "null" ] && [ "$LOCKED_ACCOUNTS" != "null" ]; then
    print_success "Security metrics included (Failed logins: $FAILED_LOGINS, Locked: $LOCKED_ACCOUNTS)"
else
    print_failure "Security metrics missing"
fi

# Test 4.3: Performance includes database info
print_test "4.3: Performance includes database information"
DB_TABLES=$(echo $PERF_RESPONSE | jq -r '.data.database.tables | length')

if [ "$DB_TABLES" != "null" ] && [ "$DB_TABLES" -gt "0" ]; then
    print_success "Database info included ($DB_TABLES tables tracked)"
else
    print_failure "Database info missing"
fi

# Test 4.4: Performance includes processing stats
print_test "4.4: Performance includes report processing stats"
PROCESSING_STATS=$(echo $PERF_RESPONSE | jq -r '.data.processing | length')

if [ "$PROCESSING_STATS" != "null" ]; then
    print_success "Processing stats included ($PROCESSING_STATS status groups)"
else
    print_failure "Processing stats missing"
fi

# Test 4.5: Performance includes cache info
print_test "4.5: Performance includes cache information"
PERF_CACHE_TTL=$(echo $PERF_RESPONSE | jq -r '.data.cache_info.ttl_minutes')

if [ "$PERF_CACHE_TTL" = "30" ]; then
    print_success "Performance cache info included (TTL: $PERF_CACHE_TTL minutes)"
else
    print_failure "Performance cache info missing or incorrect"
fi

# ============================================================================
# PHASE 5: CACHE MANAGEMENT TESTS
# ============================================================================

print_header "PHASE 5: CACHE MANAGEMENT TESTS"

# Test 5.1: Refresh cache
print_test "5.1: Manual cache refresh"
REFRESH_RESPONSE=$(curl -s -X POST "$BASE_URL/admin/dashboard/refresh-cache" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json")

REFRESH_SUCCESS=$(echo $REFRESH_RESPONSE | jq -r '.success')
ENTRIES_CLEARED=$(echo $REFRESH_RESPONSE | jq -r '.data.entries_cleared')

if [ "$REFRESH_SUCCESS" = "true" ] && [ "$ENTRIES_CLEARED" != "null" ]; then
    print_success "Cache refreshed successfully ($ENTRIES_CLEARED entries cleared)"
else
    print_failure "Cache refresh failed"
fi

# Test 5.2: Verify data refreshes after cache clear
print_test "5.2: Verify fresh data after cache refresh"
sleep 1
METRICS_AFTER=$(curl -s -X GET "$BASE_URL/admin/dashboard/metrics" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

METRICS_AFTER_SUCCESS=$(echo $METRICS_AFTER | jq -r '.success')

if [ "$METRICS_AFTER_SUCCESS" = "true" ]; then
    print_success "Fresh data loaded after cache refresh"
else
    print_failure "Failed to load data after cache refresh"
fi

# Test 5.3: PCO cannot refresh cache
print_test "5.3: PCO denied cache refresh"
PCO_REFRESH=$(curl -s -X POST "$BASE_URL/admin/dashboard/refresh-cache" \
  -H "Authorization: Bearer $PCO_TOKEN" \
  -H "Content-Type: application/json")

PCO_REFRESH_SUCCESS=$(echo $PCO_REFRESH | jq -r '.success')

if [ "$PCO_REFRESH_SUCCESS" = "false" ]; then
    print_success "PCO correctly denied cache refresh"
else
    print_failure "PCO should not refresh cache"
fi

# ============================================================================
# PHASE 6: ERROR HANDLING & VALIDATION
# ============================================================================

print_header "PHASE 6: ERROR HANDLING & VALIDATION"

# Test 6.1: Invalid period parameter
print_test "6.1: Handle invalid period parameter gracefully"
INVALID_PERIOD=$(curl -s -X GET "$BASE_URL/admin/dashboard/stats?period=invalid" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

INVALID_PERIOD_DATA=$(echo $INVALID_PERIOD | jq -r '.data.period.label')

if [ "$INVALID_PERIOD_DATA" = "30d" ]; then
    print_success "Invalid period defaults to 30d"
else
    print_failure "Invalid period not handled correctly"
fi

# Test 6.2: Invalid activity_type parameter
print_test "6.2: Handle invalid activity_type gracefully"
INVALID_TYPE=$(curl -s -X GET "$BASE_URL/admin/dashboard/activity?activity_type=invalid" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

INVALID_TYPE_SUCCESS=$(echo $INVALID_TYPE | jq -r '.success')

if [ "$INVALID_TYPE_SUCCESS" = "true" ]; then
    print_success "Invalid activity_type handled gracefully"
else
    print_failure "Invalid activity_type caused error"
fi

# Test 6.3: Unauthorized access without token
print_test "6.3: Unauthorized access blocked"
NO_AUTH=$(curl -s -X GET "$BASE_URL/admin/dashboard/metrics")

NO_AUTH_SUCCESS=$(echo $NO_AUTH | jq -r '.success')

if [ "$NO_AUTH_SUCCESS" = "false" ]; then
    print_success "Unauthorized access properly blocked"
else
    print_failure "Unauthorized access should be blocked"
fi

# ============================================================================
# TEST SUMMARY
# ============================================================================

print_header "TEST SUMMARY"

TOTAL=$((PASSED + FAILED))
echo "Total Tests: $TOTAL"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"

print_header "$([ $FAILED -eq 0 ] && echo 'ALL TESTS PASSED! ✓' || echo 'SOME TESTS FAILED')"

exit $([ $FAILED -eq 0 ] && echo 0 || echo 1)
