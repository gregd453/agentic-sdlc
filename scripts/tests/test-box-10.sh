#!/bin/bash
set -e

echo "═══════════════════════════════════════════════════"
echo "E2E TEST: BOX #10 - SPRINT METRICS"
echo "═══════════════════════════════════════════════════"
echo ""

output=$(bash scripts/sprint-metrics.sh 2>&1)
grep -q "Metrics Generated Successfully" <<< "$output" || { echo "❌ FAILED"; exit 1; }

metrics_json=$(echo "$output" | grep "JSON:" | awk '{print $2}')
[ -f "$metrics_json" ] || { echo "❌ FAILED: JSON not created"; exit 1; }

metrics_txt="${metrics_json%.json}.txt"
[ -f "$metrics_txt" ] || { echo "❌ FAILED: TXT not created"; exit 1; }

grep -q "artifacts" "$metrics_json" || { echo "❌ FAILED"; exit 1; }
grep -q "tests" "$metrics_json" || { echo "❌ FAILED"; exit 1; }
grep -q "100" "$metrics_txt" || { echo "❌ FAILED"; exit 1; }

rm -f "$metrics_json" "$metrics_txt"

echo "✅ BOX #10 E2E TEST PASSED"
echo "═══════════════════════════════════════════════════"
