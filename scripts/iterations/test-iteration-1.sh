#!/bin/bash

# Test Iteration 1: Frontend Compliance with Zyp Policies
# This script generates a React 19.2.0 app with exact version pinning

echo "================================================"
echo "Testing Iteration 1: Frontend Compliance"
echo "================================================"
echo ""
echo "Generating React app with:"
echo "- React 19.2.0 (exact)"
echo "- Vite 6.0.11 (exact)"
echo "- TypeScript 5.4.5 (exact)"
echo "- No version ranges (^ or ~)"
echo ""

# Generate the app
RESPONSE=$(curl -s -X POST http://localhost:3000/api/v1/workflows \
  -H "Content-Type: application/json" \
  -d '{
    "type": "app",
    "name": "test-frontend-zyp",
    "description": "Test React 19.2.0 with exact versions",
    "priority": "high",
    "requirements": "Simple React app with Zyp compliance. Use React 19.2.0, Vite 6.0.11, TypeScript 5.4.5. All dependencies must use exact versions (no ^ or ~)."
  }')

echo "Response from orchestrator:"
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
echo ""

# Extract workflow ID if possible
WORKFLOW_ID=$(echo "$RESPONSE" | jq -r '.id' 2>/dev/null)

if [ ! -z "$WORKFLOW_ID" ] && [ "$WORKFLOW_ID" != "null" ]; then
    echo "Workflow ID: $WORKFLOW_ID"
    echo ""
    echo "To check the generated app:"
    echo "  cd /tmp/agentic-sdlc-output/$WORKFLOW_ID/test-frontend-zyp"
    echo "  cat package.json | grep -E '\"react\"|\"vite\"|\"typescript\"'"
    echo ""
    echo "To test the app:"
    echo "  npm install"
    echo "  npm run dev"
else
    echo "Failed to extract workflow ID"
fi

echo ""
echo "================================================"
echo "Iteration 1 test submitted"
echo "================================================"