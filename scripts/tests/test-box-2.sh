#!/bin/bash
# E2E Test for Box #2: Code Freeze

set -e

echo "═══════════════════════════════════════════════════"
echo "E2E TEST: BOX #2 - CODE FREEZE"
echo "═══════════════════════════════════════════════════"
echo ""

# Clean up from previous run
rm -f .code-freeze-lock

# Run code freeze
echo "Executing code freeze script..."
output=$(bash scripts/code-freeze.sh)

echo "Generated output:"
echo "$output"
echo ""

# Validate lock file was created
echo "🔍 Validating code freeze lock..."
echo ""

echo "  ✓ Checking for lock file..."
if [ ! -f ".code-freeze-lock" ]; then
    echo "  ❌ FAILED: Lock file not created"
    exit 1
fi
echo "    ✅ Lock file exists"

echo "  ✓ Checking lock file content..."
if ! grep -q "CODE FREEZE INITIATED" .code-freeze-lock; then
    echo "  ❌ FAILED: Lock file missing header"
    exit 1
fi
echo "    ✅ Lock file has correct header"

echo "  ✓ Checking for timestamp in lock..."
if ! grep -q "Time:" .code-freeze-lock; then
    echo "  ❌ FAILED: Lock file missing timestamp"
    exit 1
fi
echo "    ✅ Lock file has timestamp"

echo "  ✓ Validating timestamp format..."
timestamp=$(grep "Time:" .code-freeze-lock | grep -o '[0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\} [0-9]\{2\}:[0-9]\{2\}:[0-9]\{2\}')
if [ -z "$timestamp" ]; then
    echo "  ❌ FAILED: Invalid timestamp format"
    exit 1
fi
echo "    ✅ Timestamp format valid: $timestamp"

echo "  ✓ Checking for status indication..."
if ! grep -q "LOCKED" .code-freeze-lock; then
    echo "  ❌ FAILED: Lock file missing status"
    exit 1
fi
echo "    ✅ Lock file shows LOCKED status"

echo "  ✓ Checking for git information..."
if ! grep -q "Branch:" .code-freeze-lock; then
    echo "  ❌ FAILED: Lock file missing git info"
    exit 1
fi
echo "    ✅ Lock file has git information"

echo "  ✓ Checking log file was created..."
if ! ls logs/code-freeze-*.log > /dev/null 2>&1; then
    echo "  ❌ FAILED: Log file not created"
    exit 1
fi
log_file=$(ls -t logs/code-freeze-*.log | head -1)
echo "    ✅ Log file created: $log_file"

# Cleanup
rm -f .code-freeze-lock

echo ""
echo "✅ BOX #2 E2E TEST PASSED"
echo ""
echo "═══════════════════════════════════════════════════"
exit 0
