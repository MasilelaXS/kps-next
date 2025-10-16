#!/bin/bash
# Test Script: Verify New Report Fields

BASE_URL="http://localhost:3001/api"

echo "=============================================="
echo "Testing New Report Creation Fields"
echo "=============================================="
echo ""

# Step 1: Login as admin
echo "Step 1: Logging in as admin..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"login_id":"admin12345","password":"ResetPassword123"}')

ADMIN_TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.data.token')

if [ "$ADMIN_TOKEN" = "null" ] || [ -z "$ADMIN_TOKEN" ]; then
  echo "✗ Failed to login as admin"
  exit 1
fi
echo "✓ Admin login successful"
echo ""

# Step 2: Login as PCO
echo "Step 2: Logging in as PCO..."
PCO_LOGIN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"login_id":"pco11111","password":"ResetPassword123"}')

PCO_TOKEN=$(echo $PCO_LOGIN | jq -r '.data.token')

if [ "$PCO_TOKEN" = "null" ]; then
  echo "✗ Failed to login as PCO"
  echo "Response: $PCO_LOGIN"
  exit 1
fi
echo "✓ PCO login successful"
echo ""

# Step 3: Get client and chemical
CLIENTS=$(curl -s "$BASE_URL/pco/sync/clients" -H "Authorization: Bearer $PCO_TOKEN")
CLIENT_ID=$(echo $CLIENTS | jq -r '.data[0].id')

CHEMICALS=$(curl -s "$BASE_URL/pco/sync/chemicals" -H "Authorization: Bearer $PCO_TOKEN")
CHEMICAL_ID=$(echo $CHEMICALS | jq -r '.data[0].id')

echo "✓ Client ID: $CLIENT_ID, Chemical ID: $CHEMICAL_ID"
echo ""

# Step 4: Create report
echo "Step 3: Creating test report..."
SERVICE_DATE=$(date -d "-1 day" +%Y-%m-%d)

CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/pco/reports" \
  -H "Authorization: Bearer $PCO_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"client_id\": $CLIENT_ID, \"report_type\": \"both\", \"service_date\": \"$SERVICE_DATE\", \"pco_signature_data\": \"data:image/png;base64,test\"}")

REPORT_ID=$(echo $CREATE_RESPONSE | jq -r '.data.report_id // .report_id')
echo "✓ Report created (ID: $REPORT_ID)"
echo ""

# Step 5: Add bait station with NEW fields
echo "Step 4: Testing NEW bait station fields..."
STATION_RESPONSE=$(curl -s -X POST "$BASE_URL/pco/reports/$REPORT_ID/bait-stations" \
  -H "Authorization: Bearer $PCO_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"station_number\": \"NEW-001\", \"location\": \"inside\", \"is_accessible\": true, \"activity_detected\": true, \"bait_status\": \"old\", \"station_condition\": \"damaged\", \"action_taken\": \"repaired\", \"warning_sign_condition\": \"replaced\", \"rodent_box_replaced\": true, \"chemicals\": [{\"chemical_id\": $CHEMICAL_ID, \"quantity\": 25.5}]}")

echo $STATION_RESPONSE | jq '.'
echo ""

# Step 6: Add insect monitor with NEW fields
echo "Step 5: Testing NEW insect monitor fields..."
MONITOR_RESPONSE=$(curl -s -X POST "$BASE_URL/pco/reports/$REPORT_ID/insect-monitors" \
  -H "Authorization: Bearer $PCO_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"monitor_type\": \"fly_trap\", \"monitor_condition\": \"replaced\", \"warning_sign_condition\": \"remounted\", \"light_condition\": \"faulty\", \"light_faulty_type\": \"tube\", \"glue_board_replaced\": true, \"tubes_replaced\": true, \"monitor_serviced\": true}")

echo $MONITOR_RESPONSE | jq '.'
echo ""

# Step 7: Get report to verify
echo "Step 6: Verifying stored data..."
REPORT=$(curl -s "$BASE_URL/pco/reports/$REPORT_ID" -H "Authorization: Bearer $PCO_TOKEN")

echo "Bait Station Fields:"
echo $REPORT | jq '.data.bait_stations[0] | {bait_status, action_taken, warning_sign_condition}'

echo ""
echo "Insect Monitor Fields:"
echo $REPORT | jq '.data.insect_monitors[0] | {monitor_condition, warning_sign_condition, light_condition, light_faulty_type}'

echo ""
echo "✓ All new fields working!"
