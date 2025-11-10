#!/bin/bash
set -e
echo "═══════════════════════════════════════════════════"
echo "E2E TEST: BOX #15 - ENHANCEMENT AGENT"
echo "═══════════════════════════════════════════════════"
echo ""
output=$(bash scripts/enhancement-agent.sh 2>&1)
grep -q "Enhancement Agent Complete" <<< "$output" || { echo "❌ FAILED"; exit 1; }
enh_dir=$(echo "$output" | grep "ESLint Results:" | awk '{print $3}' | xargs dirname)
[ -d "$enh_dir" ] || { echo "❌ FAILED"; exit 1; }
[ -f "$enh_dir/eslint-results.json" ] || { echo "❌ FAILED"; exit 1; }
[ -f "$enh_dir/quality-report.txt" ] || { echo "❌ FAILED"; exit 1; }
grep -q "quality_score" "$enh_dir/eslint-results.json" || { echo "❌ FAILED"; exit 1; }
rm -rf "$enh_dir"
echo "✅ BOX #15 E2E TEST PASSED"
echo "═══════════════════════════════════════════════════"
