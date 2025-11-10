#!/bin/bash
# E2E Test for Box #3: Daily Report

set -e

echo "═══════════════════════════════════════════════════"
echo "E2E TEST: BOX #3 - DAILY REPORT"
echo "═══════════════════════════════════════════════════"
echo ""

# Run the daily report generator
echo "Executing daily report generator..."
report_file=$(bash scripts/generate-daily-report.sh | tail -1)

echo ""
echo "Generated report file: $report_file"
echo ""

# Validate report file exists
echo "🔍 Validating daily report..."
echo ""

echo "  ✓ Checking if report file exists..."
if [ ! -f "$report_file" ]; then
    echo "  ❌ FAILED: Report file not created at $report_file"
    exit 1
fi
echo "    ✅ Report file exists"

echo "  ✓ Checking for report header..."
if ! grep -q "DAILY REPORT" "$report_file"; then
    echo "  ❌ FAILED: Missing report header"
    exit 1
fi
echo "    ✅ Found report header"

echo "  ✓ Checking for build information..."
if ! grep -q "BUILD INFORMATION" "$report_file"; then
    echo "  ❌ FAILED: Missing build information"
    exit 1
fi
echo "    ✅ Found build information section"

echo "  ✓ Checking for system info..."
if ! grep -q "System:" "$report_file"; then
    echo "  ❌ FAILED: Missing system information"
    exit 1
fi
echo "    ✅ Found system information"

echo "  ✓ Checking for artifacts section..."
if ! grep -q "ARTIFACTS GENERATED" "$report_file"; then
    echo "  ❌ FAILED: Missing artifacts section"
    exit 1
fi
echo "    ✅ Found artifacts section"

echo "  ✓ Checking for tests executed..."
if ! grep -q "TESTS EXECUTED" "$report_file"; then
    echo "  ❌ FAILED: Missing tests executed section"
    exit 1
fi
echo "    ✅ Found tests executed section"

echo "  ✓ Checking for compliance status..."
if ! grep -q "COMPLIANCE STATUS" "$report_file"; then
    echo "  ❌ FAILED: Missing compliance status"
    exit 1
fi
echo "    ✅ Found compliance status section"

echo "  ✓ Checking for code metrics..."
if ! grep -q "CODE METRICS" "$report_file"; then
    echo "  ❌ FAILED: Missing code metrics"
    exit 1
fi
echo "    ✅ Found code metrics section"

echo "  ✓ Checking for git activity..."
if ! grep -q "GIT ACTIVITY" "$report_file"; then
    echo "  ❌ FAILED: Missing git activity"
    exit 1
fi
echo "    ✅ Found git activity section"

echo "  ✓ Checking for coverage progress..."
if ! grep -q "COVERAGE PROGRESS" "$report_file"; then
    echo "  ❌ FAILED: Missing coverage progress"
    exit 1
fi
echo "    ✅ Found coverage progress section"

echo "  ✓ Validating file size..."
lines=$(wc -l < "$report_file")
if [ "$lines" -lt 30 ]; then
    echo "  ❌ FAILED: Report too short ($lines lines)"
    exit 1
fi
echo "    ✅ Report has sufficient content ($lines lines)"

echo "  ✓ Checking timestamp format..."
if ! grep -q "$(date +%Y-%m-%d)" "$report_file"; then
    echo "  ❌ FAILED: Invalid timestamp"
    exit 1
fi
echo "    ✅ Timestamp format valid"

echo ""
echo "📄 Report Preview (last 20 lines):"
echo "═══════════════════════════════════════════════════"
tail -20 "$report_file"
echo ""

echo "✅ BOX #3 E2E TEST PASSED"
echo ""
echo "═══════════════════════════════════════════════════"
exit 0
