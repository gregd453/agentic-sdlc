#!/bin/bash
# E2E Test for Box #1: Daily Standup

set -e

echo "═══════════════════════════════════════════════════"
echo "E2E TEST: BOX #1 - DAILY STANDUP"
echo "═══════════════════════════════════════════════════"
echo ""

# Run the daily standup
echo "Executing daily standup script..."
output=$(bash scripts/daily-standup.sh)

echo "Generated output:"
echo "$output"
echo ""

# Validate output contains required elements
echo "🔍 Validating standup report..."
echo ""

# Check for required sections
echo "  ✓ Checking for standup header..."
if ! grep -q "DAILY STANDUP REPORT" <<< "$output"; then
    echo "  ❌ FAILED: Missing standup header"
    exit 1
fi
echo "    ✅ Found standup header"

echo "  ✓ Checking for date/time..."
if ! grep -q "Date/Time:" <<< "$output"; then
    echo "  ❌ FAILED: Missing date/time"
    exit 1
fi
echo "    ✅ Found date/time"

echo "  ✓ Checking for completed tasks section..."
if ! grep -q "Completed Tasks:" <<< "$output"; then
    echo "  ❌ FAILED: Missing completed tasks section"
    exit 1
fi
echo "    ✅ Found completed tasks section"

echo "  ✓ Checking for repository status..."
if ! grep -q "Repository Status:" <<< "$output"; then
    echo "  ❌ FAILED: Missing repository status"
    exit 1
fi
echo "    ✅ Found repository status"

echo "  ✓ Checking for test status..."
if ! grep -q "Test Status:" <<< "$output"; then
    echo "  ❌ FAILED: Missing test status"
    exit 1
fi
echo "    ✅ Found test status"

echo "  ✓ Checking for status indicator..."
if ! grep -q "Status:" <<< "$output"; then
    echo "  ❌ FAILED: Missing status indicator"
    exit 1
fi
echo "    ✅ Found status indicator"

echo "  ✓ Checking for timestamp..."
if ! grep -q "Timestamp:" <<< "$output"; then
    echo "  ❌ FAILED: Missing timestamp"
    exit 1
fi
echo "    ✅ Found timestamp"

echo "  ✓ Validating timestamp format..."
timestamp=$(grep "Timestamp:" <<< "$output" | grep -o '[0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\} [0-9]\{2\}:[0-9]\{2\}:[0-9]\{2\}' | head -1)
if [ -z "$timestamp" ]; then
    echo "  ❌ FAILED: Invalid timestamp format"
    exit 1
fi
echo "    ✅ Timestamp format valid: $timestamp"

echo ""
echo "✅ BOX #1 E2E TEST PASSED"
echo ""
echo "═══════════════════════════════════════════════════"
exit 0
