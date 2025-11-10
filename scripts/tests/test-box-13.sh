#!/bin/bash
set -e

echo "═══════════════════════════════════════════════════"
echo "E2E TEST: BOX #13 - DECISION ENGINE"
echo "═══════════════════════════════════════════════════"
echo ""

output=$(bash scripts/decision-engine.sh 2>&1)
grep -q "Decision Engine Complete" <<< "$output" || { echo "❌ FAILED"; exit 1; }

decision_json=$(echo "$output" | grep "JSON Report:" | awk '{print $3}')
[ -f "$decision_json" ] || { echo "❌ FAILED: JSON not created"; exit 1; }

decision_txt="${decision_json%.json}.txt"
[ -f "$decision_txt" ] || { echo "❌ FAILED: TXT not created"; exit 1; }

grep -q "decision" "$decision_json" || { echo "❌ FAILED"; exit 1; }
grep -q "confidence" "$decision_json" || { echo "❌ FAILED"; exit 1; }
grep -q "criteria" "$decision_json" || { echo "❌ FAILED"; exit 1; }

rm -f "$decision_json" "$decision_txt"

echo "✅ BOX #13 E2E TEST PASSED"
echo "═══════════════════════════════════════════════════"
