#!/bin/bash

# Create a complete fumigation report with proper monitor data
# This script creates a report with 15 insect monitors with proper numbers and locations

echo "Creating fumigation report with 15 insect monitors..."

# Get PCO token
PCO_TOKEN=$(curl -s -X POST "http://localhost:3001/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"login_id":"pco11111","password":"ResetPassword123"}' | jq -r '.data.token')

if [ "$PCO_TOKEN" == "null" ] || [ -z "$PCO_TOKEN" ]; then
  echo "Failed to get PCO token"
  exit 1
fi

echo "PCO token obtained: ${PCO_TOKEN:0:50}..."

# Create complete report
RESPONSE=$(curl -s -X POST "http://localhost:3001/api/pco/reports/complete" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PCO_TOKEN" \
  -d '{
  "client_id": 1,
  "report_type": "fumigation",
  "service_date": "2025-10-27",
  "next_service_date": "2025-11-27",
  "pco_signature_data": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "client_signature_data": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "client_signature_name": "Jane Smith",
  "general_remarks": "Complete fumigation service with 15 insect monitors",
  "fumigation": {
    "areas": [
      {"area_name": "Kitchen", "is_other": false},
      {"area_name": "Storage", "is_other": false},
      {"area_name": "Production Area", "is_other": false},
      {"area_name": "Warehouse", "is_other": false}
    ],
    "target_pests": [
      {"pest_name": "Cockroaches", "is_other": false},
      {"pest_name": "Flies", "is_other": false},
      {"pest_name": "Ants", "is_other": false}
    ],
    "chemicals": [
      {
        "chemical_id": 1,
        "quantity": 10,
        "batch_number": "BATCH2025-001"
      }
    ],
    "monitors": [
      {
        "monitor_number": "IM-001",
        "location": "Kitchen - East Wall",
        "monitor_type": "light",
        "monitor_condition": "good",
        "warning_sign_condition": "good",
        "light_condition": "good",
        "glue_board_replaced": true,
        "tubes_replaced": false,
        "monitor_serviced": true
      },
      {
        "monitor_number": "IM-002",
        "location": "Kitchen - West Wall",
        "monitor_type": "light",
        "monitor_condition": "good",
        "warning_sign_condition": "good",
        "light_condition": "good",
        "glue_board_replaced": false,
        "tubes_replaced": false,
        "monitor_serviced": true
      },
      {
        "monitor_number": "IM-003",
        "location": "Kitchen - Entry Door",
        "monitor_type": "box",
        "monitor_condition": "replaced",
        "warning_sign_condition": "replaced",
        "light_condition": "na",
        "glue_board_replaced": true,
        "monitor_serviced": true
      },
      {
        "monitor_number": "IM-004",
        "location": "Storage - North Corner",
        "monitor_type": "light",
        "monitor_condition": "good",
        "warning_sign_condition": "good",
        "light_condition": "faulty",
        "light_faulty_type": "tube",
        "glue_board_replaced": true,
        "tubes_replaced": true,
        "monitor_serviced": true
      },
      {
        "monitor_number": "IM-005",
        "location": "Storage - South Corner",
        "monitor_type": "light",
        "monitor_condition": "good",
        "warning_sign_condition": "good",
        "light_condition": "good",
        "glue_board_replaced": false,
        "tubes_replaced": false,
        "monitor_serviced": true
      },
      {
        "monitor_number": "IM-006",
        "location": "Storage - Center Aisle",
        "monitor_type": "box",
        "monitor_condition": "good",
        "warning_sign_condition": "good",
        "light_condition": "na",
        "glue_board_replaced": true,
        "monitor_serviced": true
      },
      {
        "monitor_number": "IM-007",
        "location": "Production - Line 1",
        "monitor_type": "light",
        "monitor_condition": "good",
        "warning_sign_condition": "good",
        "light_condition": "good",
        "glue_board_replaced": true,
        "tubes_replaced": false,
        "monitor_serviced": true
      },
      {
        "monitor_number": "IM-008",
        "location": "Production - Line 2",
        "monitor_type": "light",
        "monitor_condition": "good",
        "warning_sign_condition": "remounted",
        "light_condition": "good",
        "glue_board_replaced": true,
        "tubes_replaced": false,
        "monitor_serviced": true
      },
      {
        "monitor_number": "IM-009",
        "location": "Production - Packaging Area",
        "monitor_type": "box",
        "monitor_condition": "good",
        "warning_sign_condition": "good",
        "light_condition": "na",
        "glue_board_replaced": true,
        "monitor_serviced": true
      },
      {
        "monitor_number": "IM-010",
        "location": "Production - Loading Bay",
        "monitor_type": "box",
        "monitor_condition": "repaired",
        "monitor_condition_other": "Fixed mounting bracket",
        "warning_sign_condition": "good",
        "light_condition": "na",
        "glue_board_replaced": true,
        "monitor_serviced": true
      },
      {
        "monitor_number": "IM-011",
        "location": "Warehouse - Section A",
        "monitor_type": "light",
        "monitor_condition": "good",
        "warning_sign_condition": "good",
        "light_condition": "good",
        "glue_board_replaced": false,
        "tubes_replaced": false,
        "monitor_serviced": true
      },
      {
        "monitor_number": "IM-012",
        "location": "Warehouse - Section B",
        "monitor_type": "light",
        "monitor_condition": "good",
        "warning_sign_condition": "good",
        "light_condition": "good",
        "glue_board_replaced": true,
        "tubes_replaced": false,
        "monitor_serviced": true
      },
      {
        "monitor_number": "IM-013",
        "location": "Warehouse - Section C",
        "monitor_type": "box",
        "monitor_condition": "good",
        "warning_sign_condition": "good",
        "light_condition": "na",
        "glue_board_replaced": true,
        "monitor_serviced": true
      },
      {
        "monitor_number": "IM-014",
        "location": "Warehouse - Receiving Dock",
        "monitor_type": "box",
        "monitor_condition": "good",
        "warning_sign_condition": "good",
        "light_condition": "na",
        "glue_board_replaced": true,
        "monitor_serviced": true
      },
      {
        "monitor_number": "IM-015",
        "location": "Warehouse - Office Entrance",
        "monitor_type": "box",
        "monitor_condition": "good",
        "warning_sign_condition": "good",
        "light_condition": "na",
        "glue_board_replaced": true,
        "monitor_serviced": true
      }
    ]
  }
}')

echo "$RESPONSE" | jq .

# Extract report ID (try both .data.id and .report_id)
REPORT_ID=$(echo "$RESPONSE" | jq -r '.data.id // .report_id')

if [ "$REPORT_ID" != "null" ] && [ -n "$REPORT_ID" ]; then
  echo ""
  echo "✅ Report created successfully!"
  echo "Report ID: $REPORT_ID"
  echo ""
  echo "To generate PDF, run:"
  echo "curl -X GET \"http://localhost:3001/api/admin/reports/$REPORT_ID/download\" \\"
  echo "  -H \"Authorization: Bearer \$ADMIN_TOKEN\" \\"
  echo "  -o \"report_${REPORT_ID}.pdf\""
else
  echo ""
  echo "❌ Failed to create report"
  echo "Response: $RESPONSE"
fi
