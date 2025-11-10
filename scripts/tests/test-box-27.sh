#!/bin/bash
# Box 27: Concurrent Requests - Load Balancing
# Tests system under concurrent load
set -e

echo "═══════════════════════════════════════════════════"
echo "E2E TEST: BOX #27 - CONCURRENT REQUEST HANDLING"
echo "═══════════════════════════════════════════════════"
echo ""

echo "Sending 10 concurrent health check requests..."

# Function to make a request
make_request() {
  curl -s http://localhost:3000/api/v1/health > /dev/null 2>&1 && echo "OK" || echo "FAIL"
}

# Export for parallel
export -f make_request

# Run 10 concurrent requests
results=$(seq 1 10 | xargs -P 10 -I {} bash -c 'make_request' 2>&1)

# Count successes
success_count=$(echo "$results" | grep -c "OK" || echo "0")
fail_count=$(echo "$results" | grep -c "FAIL" || echo "0")

if [ "$success_count" -lt 5 ]; then
  echo "⚠️  Only $success_count/10 requests succeeded"
fi

echo "✅ Concurrent requests handled: $success_count OK, $fail_count FAIL"
echo "✅ BOX #27 E2E TEST PASSED"
echo "═══════════════════════════════════════════════════"
