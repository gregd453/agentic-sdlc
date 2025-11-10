#!/bin/bash
set -e
echo "═══════════════════════════════════════════════════"
echo "E2E TEST: BOX #19 - REQUIREMENT CLARIFICATION"
echo "═══════════════════════════════════════════════════"
echo ""
output=$(bash scripts/requirement-clarification.sh 2>&1)
grep -q "Requirement Clarification Complete" <<< "$output" || { echo "❌ FAILED"; exit 1; }
clarify_dir=$(echo "$output" | grep "Questions:" | awk '{print $2}' | xargs dirname)
[ -d "$clarify_dir" ] || { echo "❌ FAILED"; exit 1; }
[ -f "$clarify_dir/clarification-questions.json" ] || { echo "❌ FAILED"; exit 1; }
grep -q "questions" "$clarify_dir/clarification-questions.json" || { echo "❌ FAILED"; exit 1; }
rm -rf "$clarify_dir"
echo "✅ BOX #19 E2E TEST PASSED"
echo "═══════════════════════════════════════════════════"
