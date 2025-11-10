#!/bin/bash
set -e
echo "═══════════════════════════════════════════════════"
echo "E2E TEST: BOX #17 - INTEGRATION TESTS"
echo "═══════════════════════════════════════════════════"
echo ""
output=$(bash scripts/integration-tests.sh 2>&1)
grep -q "Integration Tests Complete" <<< "$output" || { echo "❌ FAILED"; exit 1; }
int_dir=$(echo "$output" | grep "Results:" | awk '{print $2}' | xargs dirname)
[ -d "$int_dir" ] || { echo "❌ FAILED"; exit 1; }
[ -f "$int_dir/integration-results.json" ] || { echo "❌ FAILED"; exit 1; }
grep -q "test_suites" "$int_dir/integration-results.json" || { echo "❌ FAILED"; exit 1; }
rm -rf "$int_dir"
echo "✅ BOX #17 E2E TEST PASSED"
echo "═══════════════════════════════════════════════════"
