#!/bin/bash
# E2E Test for Box #7: Retrospective
set -e

echo "═══════════════════════════════════════════════════"
echo "E2E TEST: BOX #7 - RETROSPECTIVE"
echo "═══════════════════════════════════════════════════"
echo ""

# Run retrospective
echo "Running retrospective generation..."
output=$(bash scripts/retrospective.sh 2>&1)

echo "✓ Checking retrospective output..."
grep -q "Retrospective Generated Successfully" <<< "$output" || { echo "❌ FAILED: Missing success message"; exit 1; }

echo "✓ Checking retrospective file..."
retro_file=$(echo "$output" | grep "Report:" | awk '{print $2}')
[ -f "$retro_file" ] || { echo "❌ FAILED: Retrospective file not created"; exit 1; }

echo "✓ Validating retrospective content..."
grep -q "Sprint Retrospective Report" "$retro_file" || { echo "❌ FAILED: Missing report header"; exit 1; }
grep -q "Sprint Metrics" "$retro_file" || { echo "❌ FAILED: Missing metrics section"; exit 1; }
grep -q "What Went Well" "$retro_file" || { echo "❌ FAILED: Missing wins section"; exit 1; }
grep -q "Areas for Improvement" "$retro_file" || { echo "❌ FAILED: Missing improvements section"; exit 1; }
grep -q "Metrics Comparison" "$retro_file" || { echo "❌ FAILED: Missing comparison"; exit 1; }
grep -q "Next Sprint Goals" "$retro_file" || { echo "❌ FAILED: Missing goals"; exit 1; }

echo "✓ Checking quality metrics..."
grep -q "100%" "$retro_file" || { echo "❌ FAILED: Missing quality metrics"; exit 1; }
grep -q "Test" "$retro_file" || { echo "❌ FAILED: Missing test info"; exit 1; }
grep -q "Coverage" "$retro_file" || { echo "❌ FAILED: Missing coverage"; exit 1; }

echo "✓ Validating metrics table..."
grep -q "Productivity" "$retro_file" || { echo "❌ FAILED: Missing productivity section"; exit 1; }
grep -q "Velocity" "$retro_file" || { echo "❌ FAILED: Missing velocity metrics"; exit 1; }

echo "✓ Checking action items..."
grep -q "Action Items" "$retro_file" || { echo "❌ FAILED: Missing action items"; exit 1; }
grep -q "Owner" "$retro_file" || { echo "❌ FAILED: Missing responsibility tracking"; exit 1; }

echo "✓ Verifying report quality..."
lines=$(wc -l < "$retro_file")
[ "$lines" -gt 100 ] || { echo "❌ FAILED: Report too short"; exit 1; }

echo "✓ Checking status indicator..."
grep -q "✅ COMPLETE" "$retro_file" || { echo "❌ FAILED: Missing completion status"; exit 1; }

# Cleanup
rm -f "$retro_file"

echo ""
echo "✅ BOX #7 E2E TEST PASSED - All validations successful"
echo "═══════════════════════════════════════════════════"
exit 0
