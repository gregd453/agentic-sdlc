#!/bin/bash
set -e
echo "═══════════════════════════════════════════════════"
echo "E2E TEST: BOX #16 - PERFORMANCE TESTS"
echo "═══════════════════════════════════════════════════"
echo ""
output=$(bash scripts/performance-tests.sh 2>&1)
grep -q "Performance Tests Complete" <<< "$output" || { echo "❌ FAILED"; exit 1; }
perf_dir=$(echo "$output" | grep "Metrics:" | awk '{print $2}' | xargs dirname)
[ -d "$perf_dir" ] || { echo "❌ FAILED"; exit 1; }
[ -f "$perf_dir/performance-metrics.json" ] || { echo "❌ FAILED"; exit 1; }
grep -q "bundle_metrics" "$perf_dir/performance-metrics.json" || { echo "❌ FAILED"; exit 1; }
rm -rf "$perf_dir"
echo "✅ BOX #16 E2E TEST PASSED"
echo "═══════════════════════════════════════════════════"
