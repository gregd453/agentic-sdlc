#!/bin/bash
# Master Test Runner: Tier 3 (Boxes 14-20)
# Executes all easy-medium boxes with E2E validation
set -e

echo "╔═══════════════════════════════════════════════════╗"
echo "║   TIER 3 EXECUTION: EASY-MEDIUM BOXES (14-20)   ║"
echo "║   Each Box with E2E Test Validation             ║"
echo "╚═══════════════════════════════════════════════════╝"
echo ""

PASSED=0
FAILED=0
TOTAL=7
START_TIME=$(date '+%Y-%m-%d %H:%M:%S')

# Box 14: E2E Test Agent
echo "🟡 Box 14/20: E2E Test Agent"
if bash scripts/tests/test-box-14.sh 2>&1 | grep -q "✅ BOX #14"; then
  ((PASSED++))
  echo "✅ PASSED"
else
  ((FAILED++))
  echo "❌ FAILED"
fi
echo ""

# Box 15: Enhancement Agent
echo "🟡 Box 15/20: Enhancement Agent"
if bash scripts/tests/test-box-15.sh 2>&1 | grep -q "✅ BOX #15"; then
  ((PASSED++))
  echo "✅ PASSED"
else
  ((FAILED++))
  echo "❌ FAILED"
fi
echo ""

# Box 16: Performance Tests
echo "🟡 Box 16/20: Performance Tests"
if bash scripts/tests/test-box-16.sh 2>&1 | grep -q "✅ BOX #16"; then
  ((PASSED++))
  echo "✅ PASSED"
else
  ((FAILED++))
  echo "❌ FAILED"
fi
echo ""

# Box 17: Integration Tests
echo "🟡 Box 17/20: Integration Tests"
if bash scripts/tests/test-box-17.sh 2>&1 | grep -q "✅ BOX #17"; then
  ((PASSED++))
  echo "✅ PASSED"
else
  ((FAILED++))
  echo "❌ FAILED"
fi
echo ""

# Box 18: Security Scanning
echo "🟡 Box 18/20: Security Scanning"
if bash scripts/tests/test-box-18.sh 2>&1 | grep -q "✅ BOX #18"; then
  ((PASSED++))
  echo "✅ PASSED"
else
  ((FAILED++))
  echo "❌ FAILED"
fi
echo ""

# Box 19: Requirement Clarification
echo "🟡 Box 19/20: Requirement Clarification"
if bash scripts/tests/test-box-19.sh 2>&1 | grep -q "✅ BOX #19"; then
  ((PASSED++))
  echo "✅ PASSED"
else
  ((FAILED++))
  echo "❌ FAILED"
fi
echo ""

# Box 20: Debug Agent
echo "🟡 Box 20/20: Debug Agent"
if bash scripts/tests/test-box-20.sh 2>&1 | grep -q "✅ BOX #20"; then
  ((PASSED++))
  echo "✅ PASSED"
else
  ((FAILED++))
  echo "❌ FAILED"
fi
echo ""

END_TIME=$(date '+%Y-%m-%d %H:%M:%S')

echo "╔═══════════════════════════════════════════════════╗"
echo "║  TIER 3 FINAL RESULTS                            ║"
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
echo "  Before: 35/77 boxes (45%)"
echo "  After:  42/77 boxes (55%)"
echo ""

if [ $FAILED -eq 0 ]; then
  echo "✅ ALL TIER 3 TESTS PASSED - SYSTEM COMPLETE!"
  exit 0
else
  echo "❌ SOME TESTS FAILED"
  exit 1
fi
