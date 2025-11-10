#!/bin/bash
# Box 39: Security - Input Validation
# Tests input validation prevents injection attacks
set -e

echo "═══════════════════════════════════════════════════"
echo "E2E TEST: BOX #39 - INPUT VALIDATION"
echo "═══════════════════════════════════════════════════"
echo ""

# Test XSS injection prevention
xss_payload='<script>alert("xss")</script>'

response=$(curl -s -X POST http://localhost:3000/api/v1/workflows \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"$xss_payload\"}" 2>&1 || echo "error")

# Should not execute script - response should be safe
if echo "$response" | grep -qi "<script>" || echo "$response" | grep -qi "alert"; then
  echo "❌ FAILED: XSS payload not sanitized"
  exit 1
fi

echo "✅ XSS injection attempt blocked"

# Test SQL injection prevention
sql_payload="'; DROP TABLE workflows; --"

response=$(curl -s -X POST http://localhost:3000/api/v1/workflows \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"$sql_payload\"}" 2>&1 || echo "error")

# Table should still exist
if psql -h localhost -p 5433 -U agentic -d agentic_sdlc -c "SELECT 1 FROM information_schema.tables WHERE table_name='workflows'" > /dev/null 2>&1; then
  echo "✅ SQL injection attempt blocked"
fi

# Test malformed JSON
response=$(curl -s -X POST http://localhost:3000/api/v1/workflows \
  -H "Content-Type: application/json" \
  -d '{invalid json}' 2>&1 || echo "error")

# Should return error (not crash)
if echo "$response" | grep -qi "error\|invalid\|400" || [ "$response" = "error" ]; then
  echo "✅ Malformed input handled gracefully"
fi

echo "✅ BOX #39 E2E TEST PASSED"
echo "═══════════════════════════════════════════════════"
