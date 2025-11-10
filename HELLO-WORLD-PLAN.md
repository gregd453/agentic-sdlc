# Hello World React SPA - Progressive Testing Plan

**Version:** 1.0
**Date:** 2025-11-09
**Purpose:** First end-to-end validation of Agentic SDLC system with a real application

---

## 🎯 Objective

Build a simple React "Hello World" SPA using the Agentic SDLC system for the first time, progressively validating each component and identifying gaps in the production-ready architecture.

---

## 🔍 System Review - Critical Gaps Identified

### ✅ What Exists
- ✅ Orchestrator with REST API and pipeline execution
- ✅ All 6 agent types (Scaffold, Validation, E2E, Integration, Deployment, Base)
- ✅ PostgreSQL database with Prisma ORM
- ✅ Redis pub/sub event bus
- ✅ Docker Compose infrastructure
- ✅ PM2 production deployment
- ✅ 421+ passing unit/integration tests
- ✅ Quality gates and policy framework
- ✅ Health checks and graceful shutdown
- ✅ Monitoring and observability

### ❌ Critical Gaps Discovered
1. **No Templates** - `/packages/agents/scaffold-agent/templates/` is EMPTY
2. **No User CLI** - `/packages/cli/src/` has no implementation
3. **No React Template** - No Handlebars templates for React apps
4. **No Output Directory** - Unclear where generated code should go
5. **No User Workflow** - No documented way to submit "create React app" request
6. **Untested File Generation** - File creation has never been tested end-to-end
7. **No Example Request** - No sample payload showing how to request an app

---

## 📋 Progressive Testing Plan - 5 Phases

### **Phase 0: Pre-Flight Validation** ⏱️ ~15 minutes
> Verify infrastructure is working before attempting application generation

**Goal:** Confirm all services are healthy and communicating

**Tasks:**
1. ✅ Start PostgreSQL and Redis via Docker Compose
2. ✅ Verify database connectivity (`psma db:migrate`)
3. ✅ Verify Redis connectivity (`redis-cli ping`)
4. ✅ Start orchestrator in dev mode
5. ✅ Verify health endpoints (`/health`, `/health/ready`, `/health/detailed`)
6. ✅ Check Swagger docs at `http://localhost:3000/documentation`

**Success Criteria:**
- ✅ All Docker containers running
- ✅ PostgreSQL accepting connections
- ✅ Redis accepting connections
- ✅ Orchestrator API responding
- ✅ Health endpoints returning 200 OK
- ✅ No errors in orchestrator logs

**Commands:**
```bash
# Start infrastructure
docker-compose up -d postgres redis

# Check services
docker ps
pg_isready -h localhost -p 5433 -U agentic
redis-cli -p 6380 ping

# Run migrations
cd packages/orchestrator
pnpm prisma migrate deploy

# Start orchestrator
pnpm --filter @agentic-sdlc/orchestrator dev

# Test health (in another terminal)
curl http://localhost:3000/health | jq
curl http://localhost:3000/health/ready | jq
curl http://localhost:3000/health/detailed | jq
```

**Expected Output:**
```json
{
  "status": "healthy",
  "timestamp": "2025-11-09T...",
  "uptime_seconds": 5,
  "dependencies": {
    "database": "healthy",
    "redis": "healthy"
  }
}
```

---

### **Phase 1: Manual Workflow Creation** ⏱️ ~20 minutes
> Test workflow creation without agents, validate orchestrator APIs

**Goal:** Create a workflow manually via REST API and verify database persistence

**Tasks:**
1. ✅ Create workflow via POST `/api/v1/workflows`
2. ✅ Verify workflow in database
3. ✅ Query workflow status via GET `/api/v1/workflows/:id`
4. ✅ Verify state machine transitions
5. ✅ Check Redis event publication

**Success Criteria:**
- ✅ Workflow created with status `initiated`
- ✅ Workflow persisted in PostgreSQL
- ✅ API returns valid workflow_id
- ✅ GET endpoint returns workflow details
- ✅ Events published to Redis

**Request Payload:**
```json
{
  "type": "app",
  "name": "Hello World React SPA",
  "description": "Simple React single-page application with Hello World component",
  "priority": "medium",
  "requirements": "Create a React app with:\n- Single Hello World component\n- Displays 'Hello, World!' message\n- Uses Vite for bundling\n- Includes basic styling\n- Has npm scripts for dev and build"
}
```

**Commands:**
```bash
# Create workflow
curl -X POST http://localhost:3000/api/v1/workflows \
  -H "Content-Type: application/json" \
  -d '{
    "type": "app",
    "name": "Hello World React SPA",
    "description": "Simple React SPA",
    "priority": "medium",
    "requirements": "Create a React app with Hello World component"
  }' | jq

# Capture workflow_id from response
WORKFLOW_ID="<uuid-from-response>"

# Query workflow
curl http://localhost:3000/api/v1/workflows/$WORKFLOW_ID | jq

# Monitor Redis events (in another terminal)
redis-cli -p 6380 SUBSCRIBE "workflow:events"
```

**Expected Database State:**
```sql
SELECT id, status, current_stage, name, created_at
FROM workflows
WHERE name = 'Hello World React SPA';

-- Should return:
-- | id (uuid) | status: initiated | current_stage: initialization | ...
```

---

### **Phase 2: Template Creation & Scaffold Agent Testing** ⏱️ ~45 minutes
> Create React template and test scaffold agent in isolation

**Goal:** Build template infrastructure and validate code generation without full pipeline

**Tasks:**
1. ✅ Create React app template structure in `/packages/agents/scaffold-agent/templates/`
2. ✅ Create Handlebars templates for React components
3. ✅ Test scaffold agent in isolation (no orchestrator)
4. ✅ Verify Claude API integration
5. ✅ Validate generated file structure
6. ✅ Test template rendering with Handlebars

**Template Structure to Create:**
```
templates/
├── app/
│   └── react-spa/
│       ├── package.json.hbs
│       ├── vite.config.ts.hbs
│       ├── tsconfig.json.hbs
│       ├── index.html.hbs
│       ├── src/
│       │   ├── main.tsx.hbs
│       │   ├── App.tsx.hbs
│       │   ├── App.css.hbs
│       │   └── vite-env.d.ts.hbs
│       └── README.md.hbs
```

**Minimal React Template (App.tsx.hbs):**
```typescript
import React from 'react';
import './App.css';

function App() {
  return (
    <div className="App">
      <h1>{{message}}</h1>
      <p>Generated by Agentic SDLC</p>
    </div>
  );
}

export default App;
```

**Success Criteria:**
- ✅ Templates directory populated with React files
- ✅ Handlebars templates render with test data
- ✅ Scaffold agent can load templates
- ✅ Claude API returns valid code suggestions
- ✅ Files generated in output directory
- ✅ Generated code is syntactically valid

**Commands:**
```bash
# Test scaffold agent in isolation
cd packages/agents/scaffold-agent

# Create test task payload
cat > test-task.json <<EOF
{
  "task_id": "test-001",
  "workflow_id": "test-wf-001",
  "agent_type": "scaffold",
  "action": "generate",
  "priority": "medium",
  "payload": {
    "scaffold_type": "app",
    "app_type": "react-spa",
    "name": "hello-world",
    "requirements": "Simple Hello World React app"
  },
  "created_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "version": "1.0.0"
}
EOF

# Run scaffold agent with test task
node dist/run-agent.js test-task.json

# Verify output
ls -la ./output/hello-world/
cat ./output/hello-world/src/App.tsx
```

**Validation:**
```bash
# Check generated files exist
test -f ./output/hello-world/package.json && echo "✅ package.json"
test -f ./output/hello-world/src/App.tsx && echo "✅ App.tsx"
test -f ./output/hello-world/vite.config.ts && echo "✅ vite.config"

# Validate TypeScript syntax
cd ./output/hello-world
npm install
npm run build  # Should compile without errors
```

---

### **Phase 3: Agent Registration & Communication** ⏱️ ~30 minutes
> Start agents and verify orchestrator-agent communication

**Goal:** Validate Redis pub/sub, agent registration, and task dispatching

**Tasks:**
1. ✅ Start scaffold agent in dev mode
2. ✅ Verify agent registration in Redis
3. ✅ Verify agent heartbeat
4. ✅ Test task dispatching from orchestrator
5. ✅ Verify result publication back to orchestrator
6. ✅ Monitor Redis channels for messages

**Success Criteria:**
- ✅ Agent registers with orchestrator
- ✅ Heartbeat messages sent every 30s
- ✅ Agent listening on `agent:scaffold:tasks` channel
- ✅ Orchestrator listening on `orchestrator:results` channel
- ✅ Task dispatched and received by agent
- ✅ Result published and received by orchestrator

**Commands:**
```bash
# Terminal 1: Start orchestrator
pnpm --filter @agentic-sdlc/orchestrator dev

# Terminal 2: Start scaffold agent
pnpm --filter @agentic-sdlc/scaffold-agent dev

# Terminal 3: Monitor Redis
redis-cli -p 6380 MONITOR

# Terminal 4: Test dispatch
curl -X POST http://localhost:3000/api/v1/workflows \
  -H "Content-Type: application/json" \
  -d '{
    "type": "app",
    "name": "Hello World Test",
    "requirements": "React Hello World"
  }'
```

**Redis Monitoring:**
```bash
# Subscribe to all agent channels
redis-cli -p 6380
> SUBSCRIBE agent:registration agent:heartbeat agent:scaffold:tasks orchestrator:results

# Expected messages:
# 1. Agent registration
# 2. Heartbeat (every 30s)
# 3. Task assignment
# 4. Task result
```

**Validation:**
```bash
# Check agent registration in database
psql -h localhost -p 5433 -U agentic -d agentic_sdlc -c \
  "SELECT agent_id, type, status, capabilities FROM agents;"

# Should show scaffold agent with status 'ready'
```

---

### **Phase 4: End-to-End Workflow Execution** ⏱️ ~60 minutes
> Run complete workflow with scaffold, validation, and e2e agents

**Goal:** Execute full pipeline from workflow creation to code validation

**Tasks:**
1. ✅ Start all required agents (scaffold, validation, e2e)
2. ✅ Create workflow via API
3. ✅ Monitor pipeline execution
4. ✅ Verify stage transitions (scaffold → validate → test)
5. ✅ Check quality gates pass
6. ✅ Verify final output artifacts
7. ✅ Test WebSocket real-time updates

**Success Criteria:**
- ✅ All agents running and registered
- ✅ Workflow progresses through all stages
- ✅ Scaffold stage generates code
- ✅ Validation stage passes (TypeScript, ESLint, coverage)
- ✅ E2E stage generates Playwright tests
- ✅ Quality gates pass (80% coverage, 0 critical vulns)
- ✅ Final status: `completed`
- ✅ Artifacts stored in database

**Commands:**
```bash
# Start all agents (use PM2 or separate terminals)
pm2 start ecosystem.config.js --only scaffold-agent,validation-agent,e2e-agent

# Monitor PM2 logs
pm2 logs

# Create workflow
curl -X POST http://localhost:3000/api/v1/workflows \
  -H "Content-Type: application/json" \
  -d '{
    "type": "app",
    "name": "Hello World React SPA - Full Test",
    "description": "End-to-end test with all agents",
    "priority": "high",
    "requirements": "Create a React Hello World app with:\n- Vite bundler\n- TypeScript\n- Single component\n- Basic tests\n- ESLint config"
  }' | jq

# Get workflow ID
WORKFLOW_ID=$(curl -s http://localhost:3000/api/v1/workflows | jq -r '.[0].id')

# Poll workflow status
watch -n 5 "curl -s http://localhost:3000/api/v1/workflows/$WORKFLOW_ID | jq '.status, .current_stage, .progress_percentage'"

# WebSocket monitoring (using wscat)
npm install -g wscat
wscat -c ws://localhost:3000/ws/pipelines/$WORKFLOW_ID
```

**Expected Pipeline Flow:**
```
1. [initialization] → workflow created
2. [scaffolding]    → scaffold agent generates React code
3. [validation]     → validation agent checks TypeScript, ESLint, tests
4. [testing]        → e2e agent generates Playwright tests
5. [quality_gates]  → quality gate service validates metrics
6. [completed]      → workflow successful
```

**Quality Gate Validation:**
```bash
# Check quality gates from policy.yaml
# Expected:
# - line_coverage >= 80%
# - critical_vulns == 0
# - api_breaking_changes == 0

# Query workflow results
psql -h localhost -p 5433 -U agentic -d agentic_sdlc -c \
  "SELECT workflow_id, stage, metrics, passed
   FROM pipeline_executions
   WHERE workflow_id = '$WORKFLOW_ID';"
```

**Verify Generated App:**
```bash
# Find output directory
cd /tmp/agentic-sdlc-output/$WORKFLOW_ID  # Or configured output path

# Check structure
tree -L 2

# Install dependencies
npm install

# Run development server
npm run dev

# Open browser to http://localhost:5173
# Should see "Hello, World!" message

# Run tests
npm run test

# Build production
npm run build
```

---

### **Phase 5: Real Application Validation** ⏱️ ~30 minutes
> Manually test the generated React app as an end user

**Goal:** Verify the generated application works as a real, usable React app

**Tasks:**
1. ✅ Navigate to generated project directory
2. ✅ Install dependencies (`npm install`)
3. ✅ Start dev server (`npm run dev`)
4. ✅ Open browser and verify UI
5. ✅ Run test suite (`npm test`)
6. ✅ Build production bundle (`npm run build`)
7. ✅ Serve production build
8. ✅ Run Playwright E2E tests

**Success Criteria:**
- ✅ npm install succeeds without errors
- ✅ Dev server starts on http://localhost:5173
- ✅ Browser shows "Hello, World!" message
- ✅ Page has basic styling (CSS loaded)
- ✅ No console errors in browser
- ✅ Tests run and pass (Vitest + Playwright)
- ✅ Production build completes successfully
- ✅ Production bundle is optimized (<200KB)

**Commands:**
```bash
# Navigate to generated project
cd /tmp/agentic-sdlc-output/$WORKFLOW_ID

# Install dependencies
npm install

# Start dev server
npm run dev
# Expected: Server running on http://localhost:5173

# In browser: http://localhost:5173
# Should see: <h1>Hello, World!</h1>

# Run unit tests (in another terminal)
npm run test
# Expected: All tests pass

# Run E2E tests
npm run test:e2e
# Expected: Playwright tests pass

# Build for production
npm run build
# Expected: Build succeeds, dist/ directory created

# Preview production build
npm run preview
# Expected: Production server on http://localhost:4173

# Check bundle size
du -sh dist/
ls -lh dist/assets/
# Expected: JS bundle < 200KB
```

**Manual Browser Testing:**
```
1. Navigate to http://localhost:5173
2. Check page title: "Hello World React SPA"
3. Check heading: "Hello, World!"
4. Check subtext: "Generated by Agentic SDLC"
5. Open DevTools → Console: No errors
6. Open DevTools → Network: All assets load (200 OK)
7. Check responsive design (resize window)
8. Verify CSS styling applied
```

**Performance Validation:**
```bash
# Check Lighthouse score (if lighthouse CLI installed)
lighthouse http://localhost:4173 --only-categories=performance --view

# Expected scores:
# - Performance: >90
# - First Contentful Paint: <1.5s
# - Time to Interactive: <2.5s
```

---

## 📦 Deliverables

### After Phase 5 Completion:

1. **Generated React App** ✅
   - Location: `/tmp/agentic-sdlc-output/<workflow-id>/`
   - Structure: Standard Vite + React + TypeScript
   - Tests: Vitest unit tests + Playwright E2E
   - Build: Production-optimized bundle

2. **Test Report** 📊
   - Workflow execution log
   - Agent communication trace
   - Quality gate results
   - Performance metrics

3. **Gap Analysis Document** 📝
   - Issues encountered
   - Missing features
   - Configuration problems
   - Recommendations for improvements

4. **Updated Templates** 🎨
   - React SPA template (Handlebars)
   - package.json template
   - Vite config template
   - TypeScript config template

---

## 🚨 Known Risks & Mitigation

### Risk 1: Empty Templates Directory
**Impact:** Scaffold agent cannot generate code
**Mitigation:** Create minimal React template in Phase 2
**Status:** ❌ Blocking issue - must fix before Phase 3

### Risk 2: No User CLI
**Impact:** Must use curl/Postman for API calls
**Mitigation:** Use REST API directly, build CLI later
**Status:** ⚠️ Workaround available

### Risk 3: Undefined Output Directory
**Impact:** Generated files may not be saved
**Mitigation:** Configure output path in scaffold agent
**Status:** ⚠️ Need to verify configuration

### Risk 4: Claude API Rate Limits
**Impact:** Scaffold agent may fail on complex requirements
**Mitigation:** Use simple Hello World for first test, cache responses
**Status:** ⚠️ Monitor during testing

### Risk 5: Quality Gates Too Strict
**Impact:** Simple Hello World may fail coverage thresholds
**Mitigation:** Lower thresholds temporarily or add basic tests
**Status:** ⚠️ May need policy adjustment

---

## 🛠️ Troubleshooting Guide

### Issue: Orchestrator won't start
```bash
# Check PostgreSQL connection
psql -h localhost -p 5433 -U agentic -d agentic_sdlc -c "\l"

# Check Redis connection
redis-cli -p 6380 ping

# Check environment variables
cat .env | grep -E "DATABASE_URL|REDIS_URL|ANTHROPIC_API_KEY"

# Run migrations
cd packages/orchestrator
pnpm prisma migrate deploy
```

### Issue: Agent not registering
```bash
# Check Redis subscription
redis-cli -p 6380
> SUBSCRIBE agent:registration
> SUBSCRIBE agent:heartbeat

# Check agent logs
pm2 logs scaffold-agent

# Manually publish registration
redis-cli -p 6380
> PUBLISH agent:registration '{"agent_id":"test-scaffold","type":"scaffold","status":"ready"}'
```

### Issue: Workflow stuck in "initiated"
```bash
# Check workflow status
curl http://localhost:3000/api/v1/workflows/$WORKFLOW_ID | jq

# Check events table
psql -h localhost -p 5433 -U agentic -d agentic_sdlc -c \
  "SELECT * FROM events WHERE workflow_id = '$WORKFLOW_ID' ORDER BY timestamp DESC LIMIT 10;"

# Manually trigger state transition (last resort)
psql -h localhost -p 5433 -U agentic -d agentic_sdlc -c \
  "UPDATE workflows SET status = 'in_progress', current_stage = 'scaffolding' WHERE id = '$WORKFLOW_ID';"
```

### Issue: Generated files missing
```bash
# Check scaffold agent configuration
cat packages/agents/scaffold-agent/.env

# Check file generator logs
grep "createFiles" packages/agents/scaffold-agent/logs/*.log

# Check output directory permissions
ls -la /tmp/agentic-sdlc-output/
```

---

## 📈 Success Metrics

| Phase | Duration | Pass Criteria | Status |
|-------|----------|---------------|--------|
| Phase 0 | 15 min | All services healthy | ⏳ Pending |
| Phase 1 | 20 min | Workflow created in DB | ⏳ Pending |
| Phase 2 | 45 min | Templates render, files generated | ⏳ Pending |
| Phase 3 | 30 min | Agents registered, tasks dispatched | ⏳ Pending |
| Phase 4 | 60 min | Full pipeline completes | ⏳ Pending |
| Phase 5 | 30 min | App runs in browser | ⏳ Pending |
| **Total** | **3.3 hrs** | **React app deployed** | ⏳ Pending |

---

## 🎓 Lessons Learned (Post-Test)

### What Worked Well
- _To be filled after testing_

### What Didn't Work
- _To be filled after testing_

### Gaps Identified
- _To be filled after testing_

### Recommendations
- _To be filled after testing_

---

## 📚 References

- [Orchestrator API Documentation](packages/orchestrator/README.md)
- [Scaffold Agent Implementation](packages/agents/scaffold-agent/README.md)
- [E2E Test Example](packages/orchestrator/tests/e2e/full-workflow.test.ts)
- [Policy Configuration](ops/agentic/backlog/policy.yaml)
- [CLAUDE.md Session History](CLAUDE.md)

---

**Next Steps After Completion:**
1. Document all issues encountered
2. Create GitHub issues for blocking problems
3. Update CLAUDE.md with test results
4. Create templates for common app types (Next.js, Express API, etc.)
5. Build user-friendly CLI for workflow submission
6. Add monitoring dashboard for real-time pipeline visualization
