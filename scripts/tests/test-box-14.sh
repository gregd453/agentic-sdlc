#!/bin/bash
set -e

echo "═══════════════════════════════════════════════════"
echo "E2E TEST: BOX #14 - E2E TEST AGENT"
echo "═══════════════════════════════════════════════════"
echo ""

output=$(bash scripts/e2e-test-agent.sh 2>&1)
grep -q "E2E Test Agent Complete" <<< "$output" || { echo "❌ FAILED"; exit 1; }

test_dir=$(echo "$output" | grep "Test Results:" | awk '{print $3}' | xargs dirname)
[ -d "$test_dir" ] || { echo "❌ FAILED: Test dir not created"; exit 1; }

[ -f "$test_dir/test-results.json" ] || { echo "❌ FAILED: JSON not created"; exit 1; }
[ -f "$test_dir/test-report.md" ] || { echo "❌ FAILED: Report not created"; exit 1; }

grep -q "PASSED" "$test_dir/test-results.json" || { echo "❌ FAILED"; exit 1; }
grep -q "36" "$test_dir/test-results.json" || { echo "❌ FAILED"; exit 1; }
grep -q "Chromium" "$test_dir/test-report.md" || { echo "❌ FAILED"; exit 1; }
grep -q "Firefox" "$test_dir/test-report.md" || { echo "❌ FAILED"; exit 1; }
grep -q "WebKit" "$test_dir/test-report.md" || { echo "❌ FAILED"; exit 1; }

rm -rf "$test_dir"

echo "✅ BOX #14 E2E TEST PASSED"
echo "═══════════════════════════════════════════════════"
