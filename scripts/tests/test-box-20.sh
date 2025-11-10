#!/bin/bash
set -e
echo "═══════════════════════════════════════════════════"
echo "E2E TEST: BOX #20 - DEBUG AGENT"
echo "═══════════════════════════════════════════════════"
echo ""
output=$(bash scripts/debug-agent.sh 2>&1)
grep -q "Debug Agent Complete" <<< "$output" || { echo "❌ FAILED"; exit 1; }
debug_dir=$(echo "$output" | grep "Report:" | awk '{print $2}' | xargs dirname)
[ -d "$debug_dir" ] || { echo "❌ FAILED"; exit 1; }
[ -f "$debug_dir/debug-report.json" ] || { echo "❌ FAILED"; exit 1; }
grep -q "issues_fixed" "$debug_dir/debug-report.json" || { echo "❌ FAILED"; exit 1; }
rm -rf "$debug_dir"
echo "✅ BOX #20 E2E TEST PASSED"
echo "═══════════════════════════════════════════════════"
