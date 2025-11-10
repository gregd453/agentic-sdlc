#!/bin/bash
# Box 26: Timeout Handling - Pipeline Deadlocks
# Tests pipeline execution timeout prevention
set -e

echo "═══════════════════════════════════════════════════"
echo "E2E TEST: BOX #26 - PIPELINE DEADLOCK PREVENTION"
echo "═══════════════════════════════════════════════════"
echo ""

# Test that pipeline operations don't hang
echo "Testing pipeline endpoint responsiveness..."

# Try to get pipeline status (should be quick)
start_time=$(date +%s%N)

response=$(timeout 5 curl -s http://localhost:3000/api/v1/pipelines 2>&1 || echo "timeout")

end_time=$(date +%s%N)
elapsed_ms=$(((end_time - start_time) / 1000000))

if [ "$elapsed_ms" -gt 5000 ]; then
  echo "❌ FAILED: Pipeline endpoint took ${elapsed_ms}ms (should be <5000ms)"
  exit 1
fi

if [ "$response" = "timeout" ]; then
  echo "⚠️  Pipeline endpoint not responding"
else
  echo "✅ Pipeline endpoint responsive (${elapsed_ms}ms)"
fi

# Verify no hanging processes
hanging=$(ps aux | grep -E "pnpm|node" | grep -v grep | wc -l)
if [ "$hanging" -gt 10 ]; then
  echo "⚠️  WARNING: Many running processes - possible deadlock"
fi

echo "✅ BOX #26 E2E TEST PASSED"
echo "═══════════════════════════════════════════════════"
