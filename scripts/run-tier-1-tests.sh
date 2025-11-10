#!/bin/bash
# Master Test Runner: Tier 1 (Boxes 1-5)
# Executes all trivial boxes with E2E validation

set -e

echo "╔═══════════════════════════════════════════════════╗"
echo "║     TIER 1 EXECUTION: TRIVIAL BOXES (1-5)       ║"
echo "║   Each Box with E2E Test Validation             ║"
echo "╚═══════════════════════════════════════════════════╝"
echo ""

START_TIME=$(date +%s)
PASSED=0
FAILED=0

# Box 1: Daily Standup
echo ""
echo "┌──────────────────────────────────────────────────┐"
echo "│ BOX #1: DAILY STANDUP                           │"
echo "└──────────────────────────────────────────────────┘"
echo ""
if bash scripts/tests/test-box-1.sh; then
  ((PASSED++))
  echo "✅ Box #1 PASSED"
else
  ((FAILED++))
  echo "❌ Box #1 FAILED"
  exit 1
fi

# Box 2: Code Freeze
echo ""
echo "┌──────────────────────────────────────────────────┐"
echo "│ BOX #2: CODE FREEZE                             │"
echo "└──────────────────────────────────────────────────┘"
echo ""
if bash scripts/tests/test-box-2.sh; then
  ((PASSED++))
  echo "✅ Box #2 PASSED"
else
  ((FAILED++))
  echo "❌ Box #2 FAILED"
  exit 1
fi

# Box 3: Daily Report
echo ""
echo "┌──────────────────────────────────────────────────┐"
echo "│ BOX #3: DAILY REPORT                            │"
echo "└──────────────────────────────────────────────────┘"
echo ""
if bash scripts/tests/test-box-3.sh; then
  ((PASSED++))
  echo "✅ Box #3 PASSED"
else
  ((FAILED++))
  echo "❌ Box #3 FAILED"
  exit 1
fi

# Box 4: Sprint Completion Handler
echo ""
echo "┌──────────────────────────────────────────────────┐"
echo "│ BOX #4: SPRINT COMPLETION HANDLER               │"
echo "└──────────────────────────────────────────────────┘"
echo ""
if bash scripts/tests/test-box-4.sh; then
  ((PASSED++))
  echo "✅ Box #4 PASSED"
else
  ((FAILED++))
  echo "❌ Box #4 FAILED"
  exit 1
fi

# Box 5: Release Candidate
echo ""
echo "┌──────────────────────────────────────────────────┐"
echo "│ BOX #5: RELEASE CANDIDATE                       │"
echo "└──────────────────────────────────────────────────┘"
echo ""
if bash scripts/tests/test-box-5.sh; then
  ((PASSED++))
  echo "✅ Box #5 PASSED"
else
  ((FAILED++))
  echo "❌ Box #5 FAILED"
  exit 1
fi

# Calculate execution time
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
MINUTES=$((DURATION / 60))
SECONDS=$((DURATION % 60))

# Final Summary
echo ""
echo "╔═══════════════════════════════════════════════════╗"
echo "║            TIER 1 EXECUTION SUMMARY              ║"
echo "╚═══════════════════════════════════════════════════╝"
echo ""
echo "📊 Results:"
echo "   ✅ Passed: $PASSED/5"
echo "   ❌ Failed: $FAILED/5"
echo "   ⏱️  Duration: ${MINUTES}m ${SECONDS}s"
echo ""
echo "📈 Progress:"
echo "   Coverage: 22/77 → 27/77 boxes"
echo "   Coverage %: 29% → 35%"
echo "   Tier Completion: 100% (5/5 boxes)"
echo ""
echo "✅ ARTIFACTS GENERATED:"
echo "   • Standup Report"
echo "   • Code Freeze Lock"
echo "   • Daily Report (logs/)"
echo "   • Sprint Completion (logs/)"
echo "   • Release Candidate (releases/)"
echo ""
echo "🎯 Next Steps:"
echo "   → Tier 2: Boxes 6-13 (Easy boxes)"
echo "   → Expected time: ~2-3 hours per box"
echo "   → Target: 35% → 45% coverage"
echo ""

if [ $FAILED -eq 0 ]; then
  echo "🎉 ALL TIER 1 BOXES PASSED!"
  exit 0
else
  echo "❌ SOME TESTS FAILED"
  exit 1
fi
