#!/bin/bash
set -e

echo "═══════════════════════════════════════════════════"
echo "E2E TEST: BOX #8 - NEXT SPRINT PREP"
echo "═══════════════════════════════════════════════════"
echo ""

output=$(bash scripts/next-sprint-prep.sh 2>&1)
grep -q "Sprint Prep Complete" <<< "$output" || { echo "❌ FAILED"; exit 1; }

prep_file=$(echo "$output" | grep "Checklist:" | awk '{print $2}')
[ -f "$prep_file" ] || { echo "❌ FAILED: Prep file not created"; exit 1; }

grep -q "TEMPLATES READY" "$prep_file" || { echo "❌ FAILED"; exit 1; }
checkmarks=$(grep -c "✅" "$prep_file")
[ "$checkmarks" -gt 20 ] || { echo "❌ FAILED"; exit 1; }
grep -q "✅ READY" "$prep_file" || { echo "❌ FAILED"; exit 1; }

rm -f "$prep_file"

echo "✅ BOX #8 E2E TEST PASSED"
echo "═══════════════════════════════════════════════════"
