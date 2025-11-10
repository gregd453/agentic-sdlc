#!/bin/bash

# Test Iteration 4: Full-Stack Integration
# This script generates a complete full-stack hello world app

echo "================================================"
echo "Testing Iteration 4: Full-Stack Integration"
echo "================================================"
echo ""
echo "Generating full-stack app with:"
echo "- React 19.2.0 frontend (Vite 6.0.11)"
echo "- Fastify 5.6.1 backend API"
echo "- Prisma 5.14.0 with PostgreSQL"
echo "- Zod 3.23.0 validation"
echo "- API client with envelope pattern"
echo "- Full Zyp policy compliance"
echo ""

# Generate the full-stack app
RESPONSE=$(curl -s -X POST http://localhost:3000/api/v1/workflows \
  -H "Content-Type: application/json" \
  -d '{
    "type": "fullstack",
    "name": "hello-world-zyp",
    "description": "Full-stack hello world app with Zyp compliance",
    "priority": "high",
    "requirements": "Complete full-stack hello world application. Frontend: React 19.2.0 with Vite 6.0.11, displays hello message from API. Backend: Fastify 5.6.1 API with /api/hello endpoint. Database: PostgreSQL with Prisma 5.14.0, HelloMessage model. Validation: Zod 3.23.0 at all API boundaries. Use envelope pattern for API responses. TypeScript 5.4.5 everywhere. Exact version pinning (no ^ or ~). Include docker-compose for PostgreSQL. Frontend should call backend API and display the message."
  }')

echo "Response from orchestrator:"
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
echo ""

# Extract workflow ID
WORKFLOW_ID=$(echo "$RESPONSE" | jq -r '.id' 2>/dev/null)

if [ ! -z "$WORKFLOW_ID" ] && [ "$WORKFLOW_ID" != "null" ]; then
    echo "Workflow ID: $WORKFLOW_ID"
    echo ""
    echo "================================================"
    echo "Setup Instructions:"
    echo "================================================"
    echo ""
    echo "1. Navigate to generated app:"
    echo "   cd /tmp/agentic-sdlc-output/$WORKFLOW_ID/hello-world-zyp"
    echo ""
    echo "2. Start PostgreSQL:"
    echo "   docker-compose up -d"
    echo ""
    echo "3. Setup backend:"
    echo "   cd backend"
    echo "   npm install"
    echo "   npm run db:migrate"
    echo "   npm run dev"
    echo ""
    echo "4. In a new terminal, start frontend:"
    echo "   cd frontend"
    echo "   npm install"
    echo "   npm run dev"
    echo ""
    echo "5. Open browser:"
    echo "   http://localhost:5173"
    echo ""
    echo "6. Test API directly:"
    echo "   curl http://localhost:3000/api/hello"
    echo ""
    echo "================================================"
    echo "Validation Checklist:"
    echo "================================================"
    echo "[ ] Frontend uses React 19.2.0 (exact)"
    echo "[ ] Backend uses Fastify 5.6.1 (exact)"
    echo "[ ] Database uses Prisma 5.14.0 (exact)"
    echo "[ ] All versions are pinned (no ^ or ~)"
    echo "[ ] API returns envelope pattern"
    echo "[ ] Frontend displays message from API"
    echo "[ ] No raw SQL in backend"
    echo "[ ] Zod validation at API boundaries"
else
    echo "Failed to extract workflow ID"
fi

echo ""
echo "================================================"
echo "Iteration 4 test submitted"
echo "================================================"