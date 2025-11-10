#!/bin/bash

# Test Iteration 2: Basic Backend Templates
# This script generates a Fastify 5.6.1 API with exact versions

echo "================================================"
echo "Testing Iteration 2: Basic Backend Templates"
echo "================================================"
echo ""
echo "Generating Fastify backend with:"
echo "- Fastify 5.6.1 (exact)"
echo "- TypeScript 5.4.5 (exact)"
echo "- Envelope response pattern"
echo "- Health check endpoint"
echo ""

# Generate the backend
RESPONSE=$(curl -s -X POST http://localhost:3000/api/v1/workflows \
  -H "Content-Type: application/json" \
  -d '{
    "type": "backend",
    "name": "test-backend-zyp",
    "description": "Test Fastify API with exact versions",
    "priority": "high",
    "requirements": "Fastify 5.6.1 API server with health endpoint. Use envelope pattern for responses: { success: true, data: T } or { success: false, error: {...} }. TypeScript 5.4.5. Exact versions only."
  }')

echo "Response from orchestrator:"
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
echo ""

# Extract workflow ID
WORKFLOW_ID=$(echo "$RESPONSE" | jq -r '.id' 2>/dev/null)

if [ ! -z "$WORKFLOW_ID" ] && [ "$WORKFLOW_ID" != "null" ]; then
    echo "Workflow ID: $WORKFLOW_ID"
    echo ""
    echo "To check the generated backend:"
    echo "  cd /tmp/agentic-sdlc-output/$WORKFLOW_ID/test-backend-zyp"
    echo "  cat package.json | grep -E '\"fastify\"|\"typescript\"'"
    echo ""
    echo "To test the backend:"
    echo "  npm install"
    echo "  npm run dev"
    echo ""
    echo "Test health endpoint:"
    echo "  curl http://localhost:3000/api/health"
else
    echo "Failed to extract workflow ID"
fi

echo ""
echo "================================================"
echo "Iteration 2 test submitted"
echo "================================================"