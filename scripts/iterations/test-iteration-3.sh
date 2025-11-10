#!/bin/bash

# Test Iteration 3: Database Integration
# This script generates a backend with Prisma ORM and PostgreSQL

echo "================================================"
echo "Testing Iteration 3: Database Integration"
echo "================================================"
echo ""
echo "Generating backend with database:"
echo "- Fastify 5.6.1 API"
echo "- Prisma 5.14.0 ORM (NO raw SQL)"
echo "- PostgreSQL database"
echo "- Zod 3.23.0 validation"
echo "- HelloMessage model"
echo ""

# Generate the backend with database
RESPONSE=$(curl -s -X POST http://localhost:3000/api/v1/workflows \
  -H "Content-Type: application/json" \
  -d '{
    "type": "backend",
    "name": "test-backend-db-zyp",
    "description": "Fastify API with Prisma and PostgreSQL",
    "priority": "high",
    "requirements": "Fastify 5.6.1 API with Prisma 5.14.0 ORM connected to PostgreSQL. Create a HelloMessage model with id, message, count, createdAt, updatedAt fields. Use Zod 3.23.0 for validation. NO raw SQL allowed - Prisma only. Include docker-compose.yml for PostgreSQL. Exact versions only."
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
    echo "  cd /tmp/agentic-sdlc-output/$WORKFLOW_ID/test-backend-db-zyp"
    echo "  cat package.json | grep -E '\"prisma\"|\"zod\"'"
    echo "  cat prisma/schema.prisma"
    echo ""
    echo "To test the backend with database:"
    echo "  docker-compose up -d  # Start PostgreSQL"
    echo "  npm install"
    echo "  npm run db:migrate    # Run Prisma migrations"
    echo "  npm run dev"
    echo ""
    echo "Test CRUD operations:"
    echo "  curl -X POST http://localhost:3000/api/hello \\"
    echo "    -H 'Content-Type: application/json' \\"
    echo "    -d '{\"message\": \"Hello Zyp!\"}"
else
    echo "Failed to extract workflow ID"
fi

echo ""
echo "================================================"
echo "Iteration 3 test submitted"
echo "================================================"