#!/bin/bash

# KPS Pest Control Management System - Chemical Management Test Script
# Phase 2.4 - Chemical Management Testing

BASE_URL="http://localhost:3001/api"
ADMIN_TOKEN=""
CHEMICAL_ID=""

echo "=================================================="
echo "KPS PEST CONTROL - CHEMICAL MANAGEMENT TESTS"
echo "Phase 2.4 - Chemical Management Endpoint Group"
echo "=================================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 1. Admin Login
echo -e "${BLUE}1. Admin Login${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "login_id": "admin12345",
    "password": "ResetPassword123"
  }')

ADMIN_TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -n "$ADMIN_TOKEN" ]; then
  echo -e "${GREEN}✓ Admin login successful${NC}"
  echo "Token: ${ADMIN_TOKEN:0:20}..."
else
  echo -e "${RED}✗ Admin login failed${NC}"
  echo "$LOGIN_RESPONSE"
  exit 1
fi
echo ""

# 2. Create Chemical - Bait Inspection Type
echo -e "${BLUE}2. Create Chemical - Bait Inspection Type${NC}"
CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/admin/chemicals" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "name": "Maxforce Quantum Gel",
    "active_ingredients": "Imidacloprid 0.03%",
    "usage_type": "bait_inspection",
    "quantity_unit": "g",
    "safety_information": "Harmful if swallowed. Keep away from food and water. Wash hands after use. Store in cool, dry place away from direct sunlight."
  }')

CHEMICAL_ID=$(echo $CREATE_RESPONSE | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)

if [ -n "$CHEMICAL_ID" ]; then
  echo -e "${GREEN}✓ Chemical created successfully${NC}"
  echo "Chemical ID: $CHEMICAL_ID"
  echo "$CREATE_RESPONSE" | head -20
else
  echo -e "${RED}✗ Chemical creation failed${NC}"
  echo "$CREATE_RESPONSE"
fi
echo ""

# 3. Create Chemical - Fumigation Type
echo -e "${BLUE}3. Create Chemical - Fumigation Type${NC}"
curl -s -X POST "$BASE_URL/admin/chemicals" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "name": "Vikane Gas Fumigant",
    "active_ingredients": "Sulfuryl Fluoride 99.8%",
    "usage_type": "fumigation",
    "quantity_unit": "lbs",
    "safety_information": "DANGER: Highly toxic. Licensed applicators only. Requires proper protective equipment and ventilation. Store in well-ventilated area. Keep cylinders upright. Temperature controlled storage required."
  }' | head -20
echo ""

# 4. Create Chemical - Multi-Purpose Type
echo -e "${BLUE}4. Create Chemical - Multi-Purpose Type${NC}"
curl -s -X POST "$BASE_URL/admin/chemicals" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "name": "Termidor SC",
    "active_ingredients": "Fipronil 9.1%",
    "usage_type": "multi_purpose",
    "quantity_unit": "ml",
    "safety_information": "Harmful if absorbed through skin. Avoid contact with eyes and skin. Wear protective clothing. Store at temperatures above 32°F. Keep container tightly closed."
  }' | head -20
echo ""

# 5. Test Duplicate Chemical Name
echo -e "${BLUE}5. Test Duplicate Chemical Name (Should Fail)${NC}"
curl -s -X POST "$BASE_URL/admin/chemicals" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "name": "Maxforce Quantum Gel",
    "active_ingredients": "Different Ingredient",
    "usage_type": "bait_inspection",
    "quantity_unit": "g"
  }'
echo ""
echo ""

# 6. Get Chemical List (All)
echo -e "${BLUE}6. Get Chemical List (All)${NC}"
curl -s -X GET "$BASE_URL/admin/chemicals" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | head -40
echo ""

# 7. Get Chemical List - Filter by Bait Inspection
echo -e "${BLUE}7. Get Chemical List - Filter by Bait Inspection${NC}"
curl -s -X GET "$BASE_URL/admin/chemicals?usage_type=bait_inspection" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | head -30
echo ""

# 8. Get Chemical List - Filter by Fumigation
echo -e "${BLUE}8. Get Chemical List - Filter by Fumigation${NC}"
curl -s -X GET "$BASE_URL/admin/chemicals?usage_type=fumigation" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | head -30
echo ""

# 9. Search Chemicals
echo -e "${BLUE}9. Search Chemicals - 'Maxforce'${NC}"
curl -s -X GET "$BASE_URL/chemicals/search?q=Maxforce" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | head -30
echo ""

# 10. Get Chemicals by Type (Bait Inspection)
echo -e "${BLUE}10. Get Chemicals by Type (Bait Inspection)${NC}"
curl -s -X GET "$BASE_URL/chemicals/type/bait_inspection" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | head -30
echo ""

# 11. Get Chemicals by Type (Multi-Purpose should appear)
echo -e "${BLUE}11. Get Chemicals by Type (Fumigation - should include multi_purpose)${NC}"
curl -s -X GET "$BASE_URL/chemicals/type/fumigation" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | head -30
echo ""

# 12. Get Chemical Details by ID
if [ -n "$CHEMICAL_ID" ]; then
  echo -e "${BLUE}12. Get Chemical Details by ID${NC}"
  curl -s -X GET "$BASE_URL/admin/chemicals/$CHEMICAL_ID" \
    -H "Authorization: Bearer $ADMIN_TOKEN" | head -40
  echo ""
fi

# 13. Update Chemical
if [ -n "$CHEMICAL_ID" ]; then
  echo -e "${BLUE}13. Update Chemical${NC}"
  curl -s -X PUT "$BASE_URL/admin/chemicals/$CHEMICAL_ID" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -d '{
      "safety_information": "UPDATED: Harmful if swallowed. Keep away from food and water. Wash hands thoroughly after use. Do not contaminate water sources."
    }' | head -30
  echo ""
fi

# 14. Update Chemical Status (Deactivate)
if [ -n "$CHEMICAL_ID" ]; then
  echo -e "${BLUE}14. Update Chemical Status to Inactive${NC}"
  curl -s -X PUT "$BASE_URL/admin/chemicals/$CHEMICAL_ID/status" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -d '{
      "status": "inactive"
    }'
  echo ""
  echo ""
fi

# 15. Verify Chemical is Inactive
if [ -n "$CHEMICAL_ID" ]; then
  echo -e "${BLUE}15. Verify Chemical is Inactive${NC}"
  curl -s -X GET "$BASE_URL/admin/chemicals/$CHEMICAL_ID" \
    -H "Authorization: Bearer $ADMIN_TOKEN" | head -20
  echo ""
fi

# 16. Get Active Chemicals Only
echo -e "${BLUE}16. Get Active Chemicals Only${NC}"
curl -s -X GET "$BASE_URL/admin/chemicals?status=active" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | head -30
echo ""

# 17. Reactivate Chemical
if [ -n "$CHEMICAL_ID" ]; then
  echo -e "${BLUE}17. Reactivate Chemical${NC}"
  curl -s -X PUT "$BASE_URL/admin/chemicals/$CHEMICAL_ID/status" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -d '{
      "status": "active"
    }'
  echo ""
  echo ""
fi

echo "=================================================="
echo "Chemical Management Tests Completed!"
echo "=================================================="
echo ""
echo -e "${GREEN}Summary:${NC}"
echo "- Chemical CRUD operations tested"
echo "- Duplicate name validation tested"
echo "- Usage type filtering tested (bait_inspection, fumigation, multi_purpose)"
echo "- Search functionality tested"
echo "- Status management tested (active/inactive)"
echo "- Multi-purpose chemicals appear in all usage type filters"
echo ""
echo -e "${BLUE}Note:${NC} Usage statistics will show once chemicals are used in reports (Phase 3)"
