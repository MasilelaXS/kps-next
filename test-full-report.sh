#!/bin/bash

# Test script for creating a comprehensive report with both bait inspection and fumigation
# This mimics exactly what the frontend does

TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjg3LCJzZXNzaW9uSWQiOiJhYzU1MGJlZjhlZmI0NzY1OGYyODhiZWZlY2I2M2U0OSIsImlhdCI6MTc2MDk0MzkwNiwiZXhwIjoxNzYxMDMwMzA2fQ.iLao3eIIfOvA8iFTT1ewmbu-2LYhKHZJv74Ln9xA0pk"
BASE_URL="http://localhost:3001"

echo "========================================="
echo "STEP 1: Create Report"
echo "========================================="
REPORT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/pco/reports" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "client_id": 1,
    "report_type": "both",
    "service_date": "2025-10-20",
    "next_service_date": "2025-11-20",
    "pco_signature_data": "data:image/png;base64,pcosignature123",
    "general_remarks": "Comprehensive test report with both bait and fumigation services"
  }')

echo "$REPORT_RESPONSE"
REPORT_ID=$(echo "$REPORT_RESPONSE" | grep -o '"report_id":[0-9]*' | grep -o '[0-9]*')

if [ -z "$REPORT_ID" ]; then
  echo "Failed to create report!"
  exit 1
fi

echo ""
echo "Created Report ID: $REPORT_ID"
echo ""

echo "========================================="
echo "STEP 2: Add Bait Station 1"
echo "========================================="
curl -s -X POST "$BASE_URL/api/pco/reports/$REPORT_ID/bait-stations" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "station_number": "BS-001",
    "location": "Kitchen Entry",
    "is_accessible": true,
    "activity_detected": true,
    "activity_droppings": true,
    "activity_gnawing": false,
    "activity_tracks": false,
    "activity_other": false,
    "bait_status": "eaten",
    "station_condition": "good",
    "action_taken": "none",
    "warning_sign_condition": "good",
    "rodent_box_replaced": false,
    "station_remarks": "Active station, bait consumed",
    "chemicals": [
      {"chemical_id": 1, "quantity": 0.5, "batch_number": "BATCH-2025-001"}
    ]
  }'

echo ""
echo ""

echo "========================================="
echo "STEP 3: Add Bait Station 2"
echo "========================================="
curl -s -X POST "$BASE_URL/api/pco/reports/$REPORT_ID/bait-stations" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "station_number": "BS-002",
    "location": "Storage Room Corner",
    "is_accessible": true,
    "activity_detected": false,
    "activity_droppings": false,
    "activity_gnawing": false,
    "activity_tracks": false,
    "activity_other": false,
    "bait_status": "clean",
    "station_condition": "needs_repair",
    "action_taken": "repaired",
    "warning_sign_condition": "replaced",
    "rodent_box_replaced": false,
    "station_remarks": "Station repaired, sign replaced",
    "chemicals": [
      {"chemical_id": 1, "quantity": 0.5, "batch_number": "BATCH-2025-001"}
    ]
  }'

echo ""
echo ""

echo "========================================="
echo "STEP 4: Add Bait Station 3"
echo "========================================="
curl -s -X POST "$BASE_URL/api/pco/reports/$REPORT_ID/bait-stations" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "station_number": "BS-003",
    "location": "Loading Dock",
    "is_accessible": false,
    "inaccessible_reason": "Blocked by pallets",
    "activity_detected": false,
    "bait_status": "clean",
    "station_condition": "good",
    "action_taken": "none",
    "warning_sign_condition": "good",
    "rodent_box_replaced": false,
    "chemicals": []
  }'

echo ""
echo ""

echo "========================================="
echo "STEP 5: Add Fumigation Data"
echo "========================================="
curl -s -X PUT "$BASE_URL/api/pco/reports/$REPORT_ID/fumigation" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "areas": [
      {"area_name": "Kitchen", "is_other": false},
      {"area_name": "Dining Area", "is_other": false},
      {"area_name": "Storage", "is_other": false},
      {"area_name": "Other", "is_other": true, "other_description": "Outdoor patio area"}
    ],
    "target_pests": [
      {"pest_name": "Cockroaches", "is_other": false},
      {"pest_name": "Ants", "is_other": false},
      {"pest_name": "Flies", "is_other": false},
      {"pest_name": "Other", "is_other": true, "other_description": "Silverfish in bathroom"}
    ],
    "chemicals": [
      {"chemical_id": 3, "quantity": 2.5, "batch_number": "BATCH-2025-F001"},
      {"chemical_id": 4, "quantity": 1.0, "batch_number": "BATCH-2025-F002"}
    ]
  }'

echo ""
echo ""

echo "========================================="
echo "STEP 6: Add Insect Monitor 1 (Box Trap)"
echo "========================================="
curl -s -X POST "$BASE_URL/api/pco/reports/$REPORT_ID/insect-monitors" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "monitor_type": "box",
    "monitor_condition": "good",
    "warning_sign_condition": "good",
    "light_condition": "na",
    "light_faulty_type": "na",
    "glue_board_replaced": false,
    "tubes_replaced": null,
    "monitor_serviced": true
  }'

echo ""
echo ""

echo "========================================="
echo "STEP 7: Add Insect Monitor 2 (Fly Trap)"
echo "========================================="
curl -s -X POST "$BASE_URL/api/pco/reports/$REPORT_ID/insect-monitors" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "monitor_type": "fly_trap",
    "monitor_condition": "good",
    "warning_sign_condition": "replaced",
    "light_condition": "good",
    "light_faulty_type": "na",
    "glue_board_replaced": true,
    "tubes_replaced": false,
    "monitor_serviced": true
  }'

echo ""
echo ""

echo "========================================="
echo "STEP 8: Add Insect Monitor 3 (Fly Trap - Faulty)"
echo "========================================="
curl -s -X POST "$BASE_URL/api/pco/reports/$REPORT_ID/insect-monitors" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "monitor_type": "fly_trap",
    "monitor_condition": "replaced",
    "warning_sign_condition": "good",
    "light_condition": "faulty",
    "light_faulty_type": "tube",
    "glue_board_replaced": false,
    "tubes_replaced": true,
    "monitor_serviced": true
  }'

echo ""
echo ""

echo "========================================="
echo "STEP 9: Add Client Signature"
echo "========================================="
curl -s -X PUT "$BASE_URL/api/pco/reports/$REPORT_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "client_signature_data": "data:image/png;base64,clientsignature456",
    "client_signature_name": "John Manager Doe"
  }'

echo ""
echo ""

echo "========================================="
echo "STEP 10: Submit Report"
echo "========================================="
curl -s -X POST "$BASE_URL/api/pco/reports/$REPORT_ID/submit" \
  -H "Authorization: Bearer $TOKEN"

echo ""
echo ""

echo "========================================="
echo "STEP 11: Verify Report (as Admin)"
echo "========================================="
echo "Fetching report as admin..."
ADMIN_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjcsInNlc3Npb25JZCI6IjZlMDllZGRiOWU1NzQ5YTdhMzg2NTQ4NTE2MzE5NzJhIiwiaWF0IjoxNzYwOTQ0MTcyLCJleHAiOjE3NjEwMzA1NzJ9.xsQN-c768Iw-C6v2nFT28KLdAsR41RtuC0N5-38bqO8"

curl -s -X GET "$BASE_URL/api/admin/reports/$REPORT_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | head -c 2000

echo ""
echo ""
echo "========================================="
echo "TEST COMPLETE! Report ID: $REPORT_ID"
echo "========================================="
