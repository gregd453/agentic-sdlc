#!/bin/bash

echo "==================================================================="
echo "                    TEST SUMMARY REPORT"
echo "==================================================================="
echo ""

packages=(
  "@agentic-sdlc/ops"
  "@agentic-sdlc/contracts"
  "@agentic-sdlc/base-agent"
  "@agentic-sdlc/scaffold-agent"
  "@agentic-sdlc/validation-agent"
  "@agentic-sdlc/e2e-agent"
  "@agentic-sdlc/integration-agent"
  "@agentic-sdlc/deployment-agent"
  "@agentic-sdlc/orchestrator"
)

total_passed=0
total_failed=0
failed_packages=()

for pkg in "${packages[@]}"; do
  echo "-------------------------------------------------------------------"
  echo "Testing: $pkg"
  echo "-------------------------------------------------------------------"

  # Run test and capture output
  if output=$(pnpm --filter "$pkg" test 2>&1); then
    # Extract test counts
    if echo "$output" | grep -q "Test Files.*passed"; then
      passed=$(echo "$output" | grep "Tests" | grep -o "[0-9]* passed" | grep -o "[0-9]*" | head -1)
      total_passed=$((total_passed + passed))
      echo "✅ PASSED: $passed tests"
    fi
  else
    # Test failed
    failed_packages+=("$pkg")
    total_failed=$((total_failed + 1))

    # Try to extract error info
    if echo "$output" | grep -q "FAIL"; then
      echo "❌ FAILED"
      echo "$output" | grep -A 3 "FAIL\|Error:" | head -10
    elif echo "$output" | grep -q "failed"; then
      failed_count=$(echo "$output" | grep "failed" | grep -o "[0-9]* failed" | grep -o "[0-9]*" | head -1)
      echo "❌ FAILED: $failed_count tests"
      echo "$output" | grep -E "❯|→" | head -10
    fi
  fi
  echo ""
done

echo "==================================================================="
echo "                    FINAL SUMMARY"
echo "==================================================================="
echo "Total tests passed: $total_passed"
echo "Packages with failures: ${#failed_packages[@]}"
if [ ${#failed_packages[@]} -gt 0 ]; then
  echo ""
  echo "Failed packages:"
  for pkg in "${failed_packages[@]}"; do
    echo "  - $pkg"
  done
fi
echo "==================================================================="
