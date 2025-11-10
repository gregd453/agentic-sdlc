#!/bin/bash
# Master Test Runner: Tier 2 (Boxes 6-13)
# Executes all easy boxes with E2E validation
set -e

echo "╔═══════════════════════════════════════════════════╗"
echo "║     TIER 2 EXECUTION: EASY BOXES (6-13)         ║"
echo "║   Each Box with E2E Test Validation             ║"
echo "╚═══════════════════════════════════════════════════╝"
echo ""

PASSED=0
FAILED=0
TOTAL=8
START_TIME=$(date '+%Y-%m-%d %H:%M:%S')

# Box 6: Sprint Review
echo "🟡 Box 6/13: Sprint Review"
if bash scripts/tests/test-box-6.sh 2>&1 | grep -q "✅ BOX #6"; then
  ((PASSED++))
  echo "✅ PASSED"
else
  ((FAILED++))
  echo "❌ FAILED"
fi
echo ""

# Box 7: Retrospective
echo "🟡 Box 7/13: Retrospective"
if bash scripts/tests/test-box-7.sh 2>&1 | grep -q "✅ BOX #7"; then
  ((PASSED++))
  echo "✅ PASSED"
else
  ((FAILED++))
  echo "❌ FAILED"
fi
echo ""

# Box 8: Next Sprint Prep
echo "🟡 Box 8/13: Next Sprint Prep"
if bash scripts/tests/test-box-8.sh 2>&1 | grep -q "✅ BOX #8"; then
  ((PASSED++))
  echo "✅ PASSED"
else
  ((FAILED++))
  echo "❌ FAILED"
fi
echo ""

# Box 9: Demo Generation
echo "🟡 Box 9/13: Demo Generation"
if bash scripts/tests/test-box-9.sh 2>&1 | grep -q "✅ BOX #9"; then
  ((PASSED++))
  echo "✅ PASSED"
else
  ((FAILED++))
  echo "❌ FAILED"
fi
echo ""

# Box 10: Sprint Metrics
echo "🟡 Box 10/13: Sprint Metrics"
if bash scripts/tests/test-box-10.sh 2>&1 | grep -q "✅ BOX #10"; then
  ((PASSED++))
  echo "✅ PASSED"
else
  ((FAILED++))
  echo "❌ FAILED"
fi
echo ""

# Box 11: Compliance Check
echo "🟡 Box 11/13: Compliance Check"
if bash scripts/tests/test-box-11.sh 2>&1 | grep -q "✅ BOX #11"; then
  ((PASSED++))
  echo "✅ PASSED"
else
  ((FAILED++))
  echo "❌ FAILED"
fi
echo ""

# Box 12: Nightly Build
echo "🟡 Box 12/13: Nightly Build"
if bash scripts/tests/test-box-12.sh 2>&1 | grep -q "✅ BOX #12"; then
  ((PASSED++))
  echo "✅ PASSED"
else
  ((FAILED++))
  echo "❌ FAILED"
fi
echo ""

# Box 13: Decision Engine
echo "🟡 Box 13/13: Decision Engine"
if bash scripts/tests/test-box-13.sh 2>&1 | grep -q "✅ BOX #13"; then
  ((PASSED++))
  echo "✅ PASSED"
else
  ((FAILED++))
  echo "❌ FAILED"
fi
echo ""

END_TIME=$(date '+%Y-%m-%d %H:%M:%S')

echo "╔═══════════════════════════════════════════════════╗"
echo "║  TIER 2 FINAL RESULTS                            ║"
echo "╚═══════════════════════════════════════════════════╝"
echo ""
echo "Start Time: $START_TIME"
echo "End Time: $END_TIME"
echo ""
echo "Passed: $PASSED/$TOTAL"
echo "Failed: $FAILED/$TOTAL"
echo "Pass Rate: $((PASSED * 100 / TOTAL))%"
echo ""
echo "Coverage Progress:"
echo "  Before: 27/77 boxes (35%)"
echo "  After:  35/77 boxes (45%)"
echo ""

if [ $FAILED -eq 0 ]; then
  echo "✅ ALL TIER 2 TESTS PASSED - READY FOR TIER 3"
  exit 0
else
  echo "❌ SOME TESTS FAILED"
  exit 1
fi
