#!/bin/bash
set -e

echo "═══════════════════════════════════════════════════"
echo "E2E TEST: BOX #11 - COMPLIANCE CHECK"
echo "═══════════════════════════════════════════════════"
echo ""

output=$(bash scripts/compliance-check.sh 2>&1)
grep -q "Compliance Check Complete" <<< "$output" || { echo "❌ FAILED"; exit 1; }

compliance_file=$(echo "$output" | grep "Report:" | awk '{print $2}')
[ -f "$compliance_file" ] || { echo "❌ FAILED: Compliance file not created"; exit 1; }

grep -q "FULLY COMPLIANT" "$compliance_file" || { echo "❌ FAILED"; exit 1; }
grep -q "12/12" "$compliance_file" || { echo "❌ FAILED"; exit 1; }
grep -q "React" "$compliance_file" || { echo "❌ FAILED"; exit 1; }
grep -q "Fastify" "$compliance_file" || { echo "❌ FAILED"; exit 1; }
grep -q "Prisma" "$compliance_file" || { echo "❌ FAILED"; exit 1; }

rm -f "$compliance_file"

echo "✅ BOX #11 E2E TEST PASSED"
echo "═══════════════════════════════════════════════════"
