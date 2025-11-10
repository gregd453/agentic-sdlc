#!/bin/bash
set -e

echo "═══════════════════════════════════════════════════"
echo "E2E TEST: BOX #9 - DEMO GENERATION"
echo "═══════════════════════════════════════════════════"
echo ""

output=$(bash scripts/demo-generation.sh 2>&1)
grep -q "Demo Generation Complete" <<< "$output" || { echo "❌ FAILED"; exit 1; }

demo_dir=$(echo "$output" | grep "Setup Guide:" | awk -F': ' '{print $2}' | sed 's|/SETUP-GUIDE.md||')
[ -d "$demo_dir" ] || { echo "❌ FAILED: Demo dir not created"; exit 1; }

[ -f "$demo_dir/SETUP-GUIDE.md" ] || { echo "❌ FAILED: Setup guide not created"; exit 1; }
[ -f "$demo_dir/run-demo.sh" ] || { echo "❌ FAILED: Demo script not created"; exit 1; }

grep -q "Prerequisites" "$demo_dir/SETUP-GUIDE.md" || { echo "❌ FAILED"; exit 1; }
grep -q "Quick Start" "$demo_dir/SETUP-GUIDE.md" || { echo "❌ FAILED"; exit 1; }
grep -q "Test Scenarios" "$demo_dir/SETUP-GUIDE.md" || { echo "❌ FAILED"; exit 1; }

[ -x "$demo_dir/run-demo.sh" ] || { echo "❌ FAILED: Demo script not executable"; exit 1; }

rm -rf "$demo_dir"

echo "✅ BOX #9 E2E TEST PASSED"
echo "═══════════════════════════════════════════════════"
