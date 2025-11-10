#!/bin/bash
set -e

echo "═══════════════════════════════════════════════════"
echo "E2E TEST: BOX #12 - NIGHTLY BUILD"
echo "═══════════════════════════════════════════════════"
echo ""

output=$(bash scripts/nightly-build.sh 2>&1)
grep -q "Nightly Build Pipeline Scheduled" <<< "$output" || { echo "❌ FAILED"; exit 1; }

nightly_log=$(echo "$output" | grep "Log:" | awk '{print $2}')
[ -f "$nightly_log" ] || { echo "❌ FAILED: Log not created"; exit 1; }

grep -q "PASSED" "$nightly_log" || { echo "❌ FAILED"; exit 1; }
grep -q "E2E Testing" "$nightly_log" || { echo "❌ FAILED"; exit 1; }
grep -q "Compliance Verification" "$nightly_log" || { echo "❌ FAILED"; exit 1; }

rm -f "$nightly_log"

echo "✅ BOX #12 E2E TEST PASSED"
echo "═══════════════════════════════════════════════════"
