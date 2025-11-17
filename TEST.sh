#!/bin/bash

# SIMPLE CLI TEST - Just check if things work

cd "$(dirname "$0")"

echo ""
echo "🧪 Testing Agentic SDLC CLI"
echo "=============================="
echo ""

PASS=0
FAIL=0

# Test 1: Can we call the CLI?
echo "1. Testing CLI availability..."
if node packages/cli/dist/index.js --version 2>/dev/null || node packages/cli/dist/index.js help 2>/dev/null | grep -q "agentic"; then
  echo "   ✓ CLI works"
  ((PASS++))
else
  echo "   ✗ CLI not working"
  ((FAIL++))
fi

# Test 2: Is Orchestrator running?
echo "2. Testing Orchestrator API..."
if curl -s http://localhost:3000/api/v1/health 2>/dev/null | grep -q "healthy"; then
  echo "   ✓ Orchestrator running"
  ((PASS++))
else
  echo "   ✗ Orchestrator not responding"
  ((FAIL++))
fi

# Test 3: Is Dashboard running?
echo "3. Testing Dashboard..."
if curl -s http://localhost:3001 2>/dev/null | grep -q "html"; then
  echo "   ✓ Dashboard running"
  ((PASS++))
else
  echo "   ✗ Dashboard not responding"
  ((FAIL++))
fi

# Test 4: Are agents running?
echo "4. Testing agents..."
COUNT=$(pnpm pm2:status 2>/dev/null | grep "online" | wc -l)
if [ "$COUNT" -ge 5 ]; then
  echo "   ✓ Agents running ($COUNT processes)"
  ((PASS++))
else
  echo "   ✗ Not enough agents running"
  ((FAIL++))
fi

echo ""
echo "=============================="
echo "Results: $PASS passed, $FAIL failed"
echo ""

if [ $FAIL -eq 0 ]; then
  echo "✅ All tests passed!"
  exit 0
else
  echo "⚠️  Some tests failed"
  exit 1
fi
