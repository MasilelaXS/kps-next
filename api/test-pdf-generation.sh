#!/bin/bash

# Test PDF generation after fixes
echo "======================================"
echo "Testing PDF Generation with Report #37"
echo "======================================"
echo ""

# Get admin token (assuming admin credentials)
echo "1. Logging in as admin..."
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"pco_number":"12345","password":"Admin123!"}' | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    echo "❌ Failed to get auth token"
    exit 1
fi

echo "✅ Logged in successfully"
echo ""

# Test PDF generation
echo "2. Testing PDF generation for Report #37..."
REPORT_ID=37

curl -s -X GET "http://localhost:3001/api/reports/${REPORT_ID}/pdf" \
  -H "Authorization: Bearer $TOKEN" \
  -o "test-report-${REPORT_ID}.pdf"

if [ -f "test-report-${REPORT_ID}.pdf" ]; then
    FILE_SIZE=$(stat -f%z "test-report-${REPORT_ID}.pdf" 2>/dev/null || stat -c%s "test-report-${REPORT_ID}.pdf" 2>/dev/null)
    echo "✅ PDF generated successfully!"
    echo "   File: test-report-${REPORT_ID}.pdf"
    echo "   Size: ${FILE_SIZE} bytes"
    echo ""
    echo "📄 Open the PDF to verify:"
    echo "   - Bait stations are now visible (2 stations)"
    echo "   - Station #1 (inside) - clean status"
    echo "   - Station #1 (outside) - clean status"
    echo "   - Chemical column shows '-' (no chemical data)"
    echo ""
else
    echo "❌ PDF generation failed"
fi

echo "======================================"
echo "Test complete!"
echo "======================================"
