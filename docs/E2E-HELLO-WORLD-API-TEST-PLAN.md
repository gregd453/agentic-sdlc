# 🚀 E2E Hello World API Test Plan - Interactive Guide

**Objective:** Complete end-to-end validation of the Agentic SDLC system by generating, deploying, and testing a hello-world application with a Fastify API backend.

**Duration:** 2-3 hours
**Date:** Session #15

---

## 📋 Pre-Flight Checklist

### Prerequisites Verification (5 minutes)

```bash
# Run this checklist first:
echo "=== INFRASTRUCTURE CHECK ==="

# 1. Docker Services
docker-compose ps | grep -E "postgres|redis"
# Expected: Both services "Up (healthy)"

# 2. Database Connectivity
psql -h localhost -p 5433 -U agentic -d agentic_sdlc -c "SELECT 1" 2>&1
# Expected: "?column? 1"

# 3. Redis Connectivity
redis-cli -p 6380 PING
# Expected: "PONG"

# 4. Node.js Version
node --version
# Expected: v20.x.x or higher

# 5. pnpm Installed
pnpm --version
# Expected: 8.x.x or higher

# 6. Build Status
pnpm build
# Expected: All packages built successfully
```

**✅ CHECKPOINT 1:** All prerequisites passing before proceeding

---

## 🎯 Phase 1: System Initialization (15 minutes)

### Step 1.1: Start Infrastructure

```bash
# Terminal 1: Start Docker services
cd /Users/Greg/Projects/apps/zyp/agent-sdlc
docker-compose down  # Clean slate
docker-compose up -d postgres redis

# Wait for health checks
sleep 10
docker-compose ps

# Verify healthy status
```

### Step 1.2: Start Orchestrator

```bash
# Terminal 2: Start orchestrator in development mode
cd /Users/Greg/Projects/apps/zyp/agent-sdlc
pnpm --filter @agentic-sdlc/orchestrator dev

# Wait for:
# "🚀 Orchestrator API running on http://localhost:3000"
# "✅ Database connected"
# "✅ Redis connected"
```

### Step 1.3: Start All Agents

```bash
# Terminal 3-8: Start each agent (separate terminals recommended)

# Terminal 3: Scaffold Agent
cd packages/agents/scaffold-agent
pnpm dev
# Wait for: "✅ Scaffold Agent connected to Redis"

# Terminal 4: Validation Agent
cd packages/agents/validation-agent
pnpm dev
# Wait for: "✅ Validation Agent connected to Redis"

# Terminal 5: E2E Agent
cd packages/agents/e2e-agent
pnpm dev
# Wait for: "✅ E2E Agent connected to Redis"

# Terminal 6: Integration Agent
cd packages/agents/integration-agent
pnpm dev
# Wait for: "✅ Integration Agent connected to Redis"

# Terminal 7: Deployment Agent
cd packages/agents/deployment-agent
pnpm dev
# Wait for: "✅ Deployment Agent connected to Redis"

# Terminal 8: (Optional) Decision Agent
cd packages/agents/decision-agent
pnpm dev
# Wait for: "✅ Decision Agent connected to Redis"
```

### Step 1.4: Verify System Ready

```bash
# Terminal 9: Verification terminal
cd /Users/Greg/Projects/apps/zyp/agent-sdlc

# Check orchestrator health
curl http://localhost:3000/api/v1/health
# Expected: {"status":"healthy","timestamp":"..."}

# Check registered agents
curl http://localhost:3000/api/v1/agents
# Expected: List of 5-6 agents with "status":"ready"

# Check workflow endpoint
curl http://localhost:3000/api/v1/workflows
# Expected: [] or list of previous workflows
```

**✅ CHECKPOINT 2:** All services running and healthy

---

## 🏗️ Phase 2: Generate Hello World with API (30 minutes)

### Step 2.1: Submit Workflow Request

```bash
# Create workflow request file
cat > hello-world-api-request.json << 'EOF'
{
  "type": "fullstack",
  "name": "hello-world-api",
  "description": "Full-stack hello world with API",
  "priority": "high",
  "requirements": {
    "frontend": {
      "framework": "React 19.2.0",
      "bundler": "Vite 6.0.11",
      "typescript": "5.4.5",
      "features": ["API client", "Health check display", "Data CRUD UI"]
    },
    "backend": {
      "framework": "Fastify 5.6.1",
      "database": "PostgreSQL with Prisma 5.14.0",
      "features": [
        "Health endpoint (/health)",
        "CRUD API for messages",
        "Database schema with messages table",
        "Error handling middleware",
        "Graceful shutdown",
        "Request logging"
      ]
    },
    "deployment": {
      "docker": true,
      "dockerCompose": true,
      "environment": "development"
    },
    "testing": {
      "e2e": true,
      "framework": "Playwright",
      "coverage": ["API endpoints", "UI interactions", "Database operations"]
    }
  }
}
EOF

# Submit workflow
WORKFLOW_RESPONSE=$(curl -X POST http://localhost:3000/api/v1/workflows \
  -H "Content-Type: application/json" \
  -d @hello-world-api-request.json)

# Extract workflow ID
WORKFLOW_ID=$(echo $WORKFLOW_RESPONSE | jq -r '.workflow_id')
echo "Workflow ID: $WORKFLOW_ID"

# Save for reference
echo $WORKFLOW_ID > current-workflow-id.txt
```

### Step 2.2: Monitor Workflow Progress

```bash
# Watch workflow status (run in loop)
while true; do
  clear
  echo "=== WORKFLOW STATUS ==="
  curl -s http://localhost:3000/api/v1/workflows/$WORKFLOW_ID | jq '.'

  # Check agent execution
  echo -e "\n=== RECENT EVENTS ==="
  curl -s http://localhost:3000/api/v1/workflows/$WORKFLOW_ID/events | jq -r '.[] | "\(.timestamp) | \(.agent_type) | \(.event_type)"' | head -10

  sleep 5
done

# Expected progression:
# 1. initiated → scaffolding (Scaffold Agent)
# 2. scaffolding → validating (Validation Agent)
# 3. validating → testing (E2E Agent)
# 4. testing → integrating (Integration Agent)
# 5. integrating → deploying (Deployment Agent)
# 6. deploying → completed ✅
```

### Step 2.3: Verify Generated Output

```bash
# Check generated files
OUTPUT_DIR="/tmp/agentic-sdlc-output/$WORKFLOW_ID/hello-world-api"
ls -la $OUTPUT_DIR

# Expected structure:
# frontend/
#   ├── src/
#   │   ├── App.tsx
#   │   ├── api/
#   │   └── components/
#   ├── package.json
#   └── vite.config.ts
# backend/
#   ├── src/
#   │   ├── server.ts
#   │   ├── routes/
#   │   └── services/
#   ├── prisma/
#   │   └── schema.prisma
#   ├── package.json
#   └── Dockerfile
# e2e-tests/
#   ├── tests/
#   │   ├── api.spec.ts
#   │   └── ui.spec.ts
#   ├── playwright.config.ts
#   └── package.json
# docker-compose.yml
```

**✅ CHECKPOINT 3:** Workflow completed successfully with all files generated

---

## 🚀 Phase 3: Deploy Generated Application (20 minutes)

### Step 3.1: Navigate to Generated App

```bash
cd $OUTPUT_DIR
pwd  # Confirm location

# Review generated docker-compose.yml
cat docker-compose.yml

# Review backend API structure
tree backend/src -L 2

# Review frontend structure
tree frontend/src -L 2
```

### Step 3.2: Install Dependencies & Build

```bash
# Backend setup
cd backend
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run build

# Frontend setup
cd ../frontend
npm install
npm run build

# E2E tests setup
cd ../e2e-tests
npm install
npx playwright install
```

### Step 3.3: Start Application Stack

```bash
# Return to app root
cd $OUTPUT_DIR

# Start with Docker Compose (if available)
docker-compose up -d

# OR start manually:

# Terminal A: Start backend
cd backend
npm run dev
# Wait for: "Server listening on http://localhost:3001"

# Terminal B: Start frontend
cd frontend
npm run dev
# Wait for: "Local: http://localhost:5173"
```

### Step 3.4: Verify Deployment

```bash
# Test backend health
curl http://localhost:3001/health
# Expected: {"status":"healthy","timestamp":"...","database":"connected"}

# Test API endpoints
# Create a message
curl -X POST http://localhost:3001/api/messages \
  -H "Content-Type: application/json" \
  -d '{"content":"Hello from API test!"}'

# Get all messages
curl http://localhost:3001/api/messages

# Test frontend
open http://localhost:5173
# OR
echo "Frontend running at: http://localhost:5173"
```

**✅ CHECKPOINT 4:** Application deployed and responding

---

## 🧪 Phase 4: Run E2E Playwright Tests (20 minutes)

### Step 4.1: Configure Test Environment

```bash
cd $OUTPUT_DIR/e2e-tests

# Set test environment variables
cat > .env.test << EOF
API_URL=http://localhost:3001
FRONTEND_URL=http://localhost:5173
TEST_TIMEOUT=30000
EOF

# Review test configuration
cat playwright.config.ts
```

### Step 4.2: Run API Tests

```bash
# Run API-specific tests
npx playwright test tests/api.spec.ts --reporter=list

# Expected tests:
# ✓ Health endpoint returns 200
# ✓ Can create a message via API
# ✓ Can retrieve messages
# ✓ Can update a message
# ✓ Can delete a message
# ✓ Handles errors gracefully
```

### Step 4.3: Run UI Tests

```bash
# Run UI tests with browser
npx playwright test tests/ui.spec.ts --headed

# Expected tests:
# ✓ Homepage loads successfully
# ✓ Health status displays
# ✓ Can add a message through UI
# ✓ Messages list updates
# ✓ Can delete message from UI
# ✓ Error states handled properly
```

### Step 4.4: Run Full Test Suite

```bash
# Run all tests with HTML report
npx playwright test --reporter=html

# View test report
npx playwright show-report

# Generate test artifacts
mkdir -p test-results
npx playwright test --reporter=json > test-results/results.json
```

**✅ CHECKPOINT 5:** All E2E tests passing

---

## 📊 Phase 5: Validate Complete Workflow (15 minutes)

### Step 5.1: Database Validation

```bash
# Connect to database
psql -h localhost -p 5433 -U agentic -d agentic_sdlc

# Check workflow completion
SELECT workflow_id, current_state, created_at, updated_at
FROM workflows
WHERE workflow_id = '[YOUR_WORKFLOW_ID]';

# Check agent execution events
SELECT agent_type, event_type, created_at
FROM events
WHERE workflow_id = '[YOUR_WORKFLOW_ID]'
ORDER BY created_at;

# Exit psql
\q
```

### Step 5.2: Agent Execution Verification

```bash
# Verify each agent executed
curl -s http://localhost:3000/api/v1/workflows/$WORKFLOW_ID/events | jq '.[] | select(.agent_type) | .agent_type' | sort -u

# Expected output:
# "scaffold"
# "validation"
# "e2e"
# "integration"
# "deployment"
```

### Step 5.3: Performance Metrics

```bash
# Get workflow metrics
curl -s http://localhost:3000/api/v1/workflows/$WORKFLOW_ID/metrics

# Check generation time
START_TIME=$(curl -s http://localhost:3000/api/v1/workflows/$WORKFLOW_ID | jq -r '.created_at')
END_TIME=$(curl -s http://localhost:3000/api/v1/workflows/$WORKFLOW_ID | jq -r '.updated_at')
echo "Total execution time: from $START_TIME to $END_TIME"

# Check orchestrator metrics
curl http://localhost:3000/metrics | grep workflow
```

**✅ CHECKPOINT 6:** Complete workflow validation successful

---

## 🔒 Phase 6: Error Handling & Edge Cases (15 minutes)

### Step 6.1: Test API Error Handling

```bash
# Test invalid request
curl -X POST http://localhost:3001/api/messages \
  -H "Content-Type: application/json" \
  -d '{"invalid":"data"}'
# Expected: 400 Bad Request with error message

# Test non-existent endpoint
curl http://localhost:3001/api/nonexistent
# Expected: 404 Not Found

# Test method not allowed
curl -X DELETE http://localhost:3001/health
# Expected: 405 Method Not Allowed
```

### Step 6.2: Test Graceful Shutdown

```bash
# Send shutdown signal to backend
# In backend terminal: Ctrl+C

# Observe logs for:
# - "Gracefully shutting down..."
# - "Closing database connections..."
# - "Server stopped"

# Restart backend
cd $OUTPUT_DIR/backend
npm run dev
```

### Step 6.3: Test Database Resilience

```bash
# Create multiple messages rapidly
for i in {1..10}; do
  curl -X POST http://localhost:3001/api/messages \
    -H "Content-Type: application/json" \
    -d "{\"content\":\"Message $i\"}" &
done
wait

# Verify all created
curl http://localhost:3001/api/messages | jq '. | length'
# Expected: 10+ messages
```

**✅ CHECKPOINT 7:** Error handling and edge cases validated

---

## 📝 Phase 7: Documentation & Cleanup (10 minutes)

### Step 7.1: Generate Test Report

```bash
cd /Users/Greg/Projects/apps/zyp/agent-sdlc

# Create test report
cat > E2E-TEST-RESULTS-$(date +%Y%m%d).md << EOF
# E2E Hello World API Test Results

**Date:** $(date)
**Workflow ID:** $WORKFLOW_ID

## Test Summary

### ✅ Infrastructure
- PostgreSQL: Healthy
- Redis: Healthy
- Orchestrator: Running
- All Agents: Connected

### ✅ Workflow Execution
- Workflow submitted: SUCCESS
- Scaffold Agent: Completed
- Validation Agent: Completed
- E2E Agent: Completed
- Integration Agent: Completed
- Deployment Agent: Completed
- Total Time: [CALCULATE FROM TIMESTAMPS]

### ✅ Generated Application
- Frontend: React + Vite + TypeScript
- Backend: Fastify + Prisma + PostgreSQL
- Database: Schema created, migrations applied
- Docker: Compose file generated
- E2E Tests: Playwright tests generated

### ✅ Deployment
- Backend API: Running on port 3001
- Frontend UI: Running on port 5173
- Database: Connected and operational

### ✅ E2E Test Results
- API Tests: X/X passing
- UI Tests: X/X passing
- Total Tests: X/X passing
- Test Duration: Xs

### ✅ API Validation
- Health endpoint: Working
- CRUD operations: Working
- Error handling: Working
- Graceful shutdown: Working

## Artifacts Location
- Generated App: $OUTPUT_DIR
- Test Results: $OUTPUT_DIR/e2e-tests/test-results/
- Workflow Data: Database record $WORKFLOW_ID

## Conclusion
E2E test completed successfully. System validated for production use.
EOF

echo "Test report created!"
```

### Step 7.2: Cleanup (Optional)

```bash
# Stop generated application
cd $OUTPUT_DIR
docker-compose down  # If using Docker
# OR manually stop backend and frontend servers (Ctrl+C)

# Stop agents (in each agent terminal: Ctrl+C)

# Keep orchestrator running for analysis
# Keep database/Redis running for data retention

# Archive generated application
cd /tmp/agentic-sdlc-output
tar -czf hello-world-api-$WORKFLOW_ID.tar.gz $WORKFLOW_ID/
echo "Application archived to: hello-world-api-$WORKFLOW_ID.tar.gz"
```

**✅ CHECKPOINT 8:** Documentation complete, system ready for next test

---

## 🎯 Success Criteria Summary

All checkpoints must pass for successful E2E validation:

1. ✅ **Infrastructure:** All services healthy
2. ✅ **System Ready:** Orchestrator and agents connected
3. ✅ **Workflow:** Completed successfully with files generated
4. ✅ **Deployment:** Application running and responding
5. ✅ **E2E Tests:** All Playwright tests passing
6. ✅ **Validation:** Complete workflow verified in database
7. ✅ **Error Handling:** Edge cases handled gracefully
8. ✅ **Documentation:** Results documented and archived

---

## 🚨 Troubleshooting Guide

### If workflow fails:
```bash
# Check orchestrator logs
docker-compose logs orchestrator | tail -50

# Check specific agent logs
# In agent terminal, look for ERROR messages

# Check database for error events
psql -h localhost -p 5433 -U agentic -d agentic_sdlc -c "SELECT * FROM events WHERE workflow_id='$WORKFLOW_ID' AND event_type='error';"
```

### If tests fail:
```bash
# Run tests in debug mode
cd $OUTPUT_DIR/e2e-tests
DEBUG=pw:api npx playwright test --debug

# Check test screenshots
ls -la test-results/
```

### If deployment fails:
```bash
# Check port availability
lsof -i :3001  # Backend
lsof -i :5173  # Frontend

# Check Docker logs if using Docker
docker-compose logs
```

---

## 📋 Quick Command Reference

```bash
# Start everything
docker-compose up -d postgres redis
pnpm --filter @agentic-sdlc/orchestrator dev
# Start all agents...

# Submit workflow
curl -X POST http://localhost:3000/api/v1/workflows -H "Content-Type: application/json" -d @hello-world-api-request.json

# Check status
curl http://localhost:3000/api/v1/workflows/$WORKFLOW_ID

# Navigate to output
cd /tmp/agentic-sdlc-output/$WORKFLOW_ID/hello-world-api

# Run application
docker-compose up -d
# OR
cd backend && npm run dev
cd frontend && npm run dev

# Run tests
cd e2e-tests && npx playwright test

# Cleanup
docker-compose down
```

---

**Time Estimate:** 2-3 hours for complete E2E validation
**Recommendation:** Run phases 1-5 first, then phases 6-7 if time permits

---

## Ready to Start?

Begin with Phase 1: System Initialization and work through each phase systematically. Each checkpoint ensures you're ready for the next phase.

Good luck with your E2E validation! 🚀