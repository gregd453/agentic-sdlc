#!/bin/bash
set -e
echo "═══════════════════════════════════════════════════"
echo "E2E TEST: BOX #18 - SECURITY SCANNING"
echo "═══════════════════════════════════════════════════"
echo ""
output=$(bash scripts/security-scan.sh 2>&1)
grep -q "Security Scan Complete" <<< "$output" || { echo "❌ FAILED"; exit 1; }
sec_dir=$(echo "$output" | grep "Report:" | awk '{print $2}' | xargs dirname)
[ -d "$sec_dir" ] || { echo "❌ FAILED"; exit 1; }
[ -f "$sec_dir/security-report.json" ] || { echo "❌ FAILED"; exit 1; }
grep -q "npm_audit" "$sec_dir/security-report.json" || { echo "❌ FAILED"; exit 1; }
rm -rf "$sec_dir"
echo "✅ BOX #18 E2E TEST PASSED"
echo "═══════════════════════════════════════════════════"
