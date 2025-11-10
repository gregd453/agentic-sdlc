#!/bin/bash
# E2E Test for Box #6: Sprint Review
set -e

echo "═══════════════════════════════════════════════════"
echo "E2E TEST: BOX #6 - SPRINT REVIEW"
echo "═══════════════════════════════════════════════════"
echo ""

# Run sprint review generation
echo "Running sprint review generation..."
output=$(bash scripts/sprint-review.sh 2>&1)

echo "✓ Checking sprint review output..."
grep -q "Sprint Review Generated Successfully" <<< "$output" || { echo "❌ FAILED: Missing success message"; exit 1; }

echo "✓ Checking report file generation..."
report_file=$(echo "$output" | grep "Report:" | awk '{print $2}')
[ -f "$report_file" ] || { echo "❌ FAILED: Report file not created"; exit 1; }

echo "✓ Validating report content..."
grep -q "Sprint Review Report" "$report_file" || { echo "❌ FAILED: Missing report header"; exit 1; }
grep -q "Execution Summary" "$report_file" || { echo "❌ FAILED: Missing summary section"; exit 1; }
grep -q "Completed Features" "$report_file" || { echo "❌ FAILED: Missing features section"; exit 1; }
grep -q "Test Results" "$report_file" || { echo "❌ FAILED: Missing test results"; exit 1; }
grep -q "Metrics" "$report_file" || { echo "❌ FAILED: Missing metrics section"; exit 1; }
grep -q "Key Achievements" "$report_file" || { echo "❌ FAILED: Missing achievements"; exit 1; }

echo "✓ Checking demo script generation..."
demo_script=$(echo "$output" | grep "Demo Script:" | awk '{print $3}')
[ -f "$demo_script" ] || { echo "❌ FAILED: Demo script not created"; exit 1; }
[ -x "$demo_script" ] || { echo "❌ FAILED: Demo script not executable"; exit 1; }

echo "✓ Validating demo script content..."
grep -q "SPRINT REVIEW DEMO" "$demo_script" || { echo "❌ FAILED: Missing demo header"; exit 1; }
grep -q "DEMO 1" "$demo_script" || { echo "❌ FAILED: Missing demo 1"; exit 1; }
grep -q "DEMO 2" "$demo_script" || { echo "❌ FAILED: Missing demo 2"; exit 1; }
grep -q "DEMO 3" "$demo_script" || { echo "❌ FAILED: Missing demo 3"; exit 1; }

echo "✓ Verifying report file format..."
lines=$(wc -l < "$report_file")
[ "$lines" -gt 20 ] || { echo "❌ FAILED: Report too short"; exit 1; }

echo "✓ Checking report structure..."
grep -q "PASSED" "$report_file" || { echo "❌ FAILED: Missing status indicator"; exit 1; }

# Cleanup
rm -f "$report_file" "$demo_script"

echo ""
echo "✅ BOX #6 E2E TEST PASSED - All validations successful"
echo "═══════════════════════════════════════════════════"
exit 0
