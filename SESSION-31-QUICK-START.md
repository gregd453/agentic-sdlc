# SESSION #31 QUICK START GUIDE

**🚀 Copy-Paste Commands for Session #31**

---

## 1. Environment Startup (Terminal 1)

```bash
cd /Users/Greg/Projects/apps/zyp/agent-sdlc
./scripts/env/start-dev.sh

# Verify infrastructure
docker ps | grep -E "postgres|redis"
```

---

## 2. Start Orchestrator (Terminal 2)

```bash
cd /Users/Greg/Projects/apps/zyp/agent-sdlc
pnpm --filter @agentic-sdlc/orchestrator dev
```

---

## 3. Start Scaffold Agent (Terminal 3)

```bash
cd /Users/Greg/Projects/apps/zyp/agent-sdlc
pnpm --filter @agentic-sdlc/agents/scaffold-agent dev
```

---

## 4. Start Validation Agent (Terminal 4)

```bash
cd /Users/Greg/Projects/apps/zyp/agent-sdlc
pnpm --filter @agentic-sdlc/agents/validation-agent dev
```

---

## 5. Start E2E Agent (Terminal 5)

```bash
cd /Users/Greg/Projects/apps/zyp/agent-sdlc
pnpm --filter @agentic-sdlc/agents/e2e-agent dev
```

---

## 6. Create Test Workflow (Terminal 6)

```bash
cd /Users/Greg/Projects/apps/zyp/agent-sdlc

# Test 1: Validation Agent Test
curl -X POST http://localhost:3000/api/v1/workflows \
  -H "Content-Type: application/json" \
  -d '{
    "type": "app",
    "name": "validation-test",
    "description": "Test validation agent file discovery and execution",
    "requirements": "Simple calculator app with basic operations",
    "priority": "high"
  }' | jq .

# Save the workflow ID from response
export WF_ID="<paste-workflow-id-here>"
```

---

## 7. Monitor Workflow Progress

```bash
# Watch workflow status (run every 10 seconds)
watch -n 10 "curl -s http://localhost:3000/api/v1/workflows/$WF_ID | jq '.current_stage, .status, .progress_percentage'"

# OR: Single check
curl -s http://localhost:3000/api/v1/workflows/$WF_ID | jq .
```

---

## 8. Check Stage Outputs (After Each Stage)

```bash
# View stored context from previous stages
curl -s http://localhost:3000/api/v1/workflows/$WF_ID | jq '.stage_outputs'

# OR: Direct database query
psql $DATABASE_URL -c "
  SELECT jsonb_pretty(stage_outputs)
  FROM \"Workflow\"
  WHERE id = '$WF_ID';
"
```

---

## 9. Monitor Logs (Terminal 7)

```bash
cd /Users/Greg/Projects/apps/zyp/agent-sdlc

# Watch orchestrator logs
tail -f scripts/logs/orchestrator.log | grep -E "SESSION #30|SESSION #31|Stage output|Task created"

# OR: Watch validation agent logs
tail -f scripts/logs/validation-agent.log | grep -E "VALIDATION|working_directory|ERROR"

# OR: Watch e2e agent logs
tail -f scripts/logs/e2e-agent.log | grep -E "E2E|PLAYWRIGHT|test_results"
```

---

## 10. Database Queries

```bash
# Check workflow state
psql $DATABASE_URL -c "
  SELECT
    id,
    name,
    type,
    current_stage,
    status,
    progress_percentage,
    created_at
  FROM \"Workflow\"
  WHERE name LIKE '%validation-test%'
  ORDER BY created_at DESC
  LIMIT 5;
"

# Check task history
psql $DATABASE_URL -c "
  SELECT
    id,
    workflow_id,
    type,
    status,
    created_at,
    completed_at
  FROM \"Task\"
  WHERE workflow_id = '$WF_ID'
  ORDER BY created_at;
"

# Check stage outputs (formatted JSON)
psql $DATABASE_URL -c "
  SELECT jsonb_pretty(stage_outputs) AS context
  FROM \"Workflow\"
  WHERE id = '$WF_ID';
"
```

---

## 11. Test E2E Pipeline (After Validation Works)

```bash
# Create second test workflow
curl -X POST http://localhost:3000/api/v1/workflows \
  -H "Content-Type: application/json" \
  -d '{
    "type": "app",
    "name": "e2e-pipeline-test",
    "description": "Full pipeline test through e2e stage",
    "requirements": "Todo list app with add/delete/complete functionality",
    "priority": "high"
  }' | jq .

# Save new workflow ID
export WF_ID_E2E="<paste-workflow-id-here>"

# Monitor progression
watch -n 10 "curl -s http://localhost:3000/api/v1/workflows/$WF_ID_E2E | jq '.current_stage, .status, .progress_percentage'"
```

---

## 12. Check Generated Files

```bash
# List generated files from scaffold stage
ls -la /Users/Greg/Projects/apps/zyp/agent-sdlc/ai.output/$WF_ID/*/

# Check if validation agent can find them
ls -la /Users/Greg/Projects/apps/zyp/agent-sdlc/ai.output/$WF_ID/*/src/
ls -la /Users/Greg/Projects/apps/zyp/agent-sdlc/ai.output/$WF_ID/*/package.json
```

---

## 13. Debugging Commands

```bash
# Check agent registration
psql $DATABASE_URL -c "SELECT * FROM \"Agent\";"

# Check Redis connection
redis-cli ping

# Check task dispatch
psql $DATABASE_URL -c "
  SELECT id, type, status, agent_id, created_at
  FROM \"Task\"
  WHERE workflow_id = '$WF_ID'
  ORDER BY created_at DESC;
"

# Check for errors in orchestrator
grep -i "error\|fail\|exception" scripts/logs/orchestrator.log | tail -20

# Check for errors in validation agent
grep -i "error\|fail\|exception" scripts/logs/validation-agent.log | tail -20
```

---

## 14. Cleanup (After Session)

```bash
# Stop all services
./scripts/env/stop-dev.sh

# OR: Manual cleanup
docker-compose down
pkill -f "pnpm --filter"

# Optional: Clear test data
psql $DATABASE_URL -c "DELETE FROM \"Workflow\" WHERE name LIKE '%test%';"
```

---

## 🎯 EXPECTED RESULTS

### After Initialization Stage
```json
{
  "current_stage": "scaffolding",
  "status": "processing",
  "progress_percentage": 14,
  "stage_outputs": {
    "initialization": {
      "output_path": "/path/to/ai.output/...",
      "completed_at": "2025-11-10T..."
    }
  }
}
```

### After Scaffolding Stage
```json
{
  "current_stage": "validation",
  "status": "processing",
  "progress_percentage": 28,
  "stage_outputs": {
    "initialization": {...},
    "scaffolding": {
      "output_path": "/path/to/ai.output/...",
      "files_generated": ["src/index.ts", "package.json", ...],
      "structure": {...},
      "entry_points": ["src/index.ts"],
      "completed_at": "2025-11-10T..."
    }
  }
}
```

### After Validation Stage (TARGET)
```json
{
  "current_stage": "e2e_testing",
  "status": "processing",
  "progress_percentage": 42,
  "stage_outputs": {
    "initialization": {...},
    "scaffolding": {...},
    "validation": {
      "overall_status": "passed",
      "passed_checks": ["typescript", "eslint"],
      "failed_checks": [],
      "quality_gates": {...},
      "completed_at": "2025-11-10T..."
    }
  }
}
```

---

## 🚨 COMMON ISSUES & FIXES

### Issue: Workflow stuck at initialization
```bash
# Check if scaffold agent is running
ps aux | grep scaffold-agent

# Check if task was created
psql $DATABASE_URL -c "SELECT * FROM \"Task\" WHERE workflow_id = '$WF_ID';"

# Check orchestrator logs
tail -100 scripts/logs/orchestrator.log | grep -E "Task created|dispatch"
```

### Issue: Validation agent can't find files
```bash
# Check working_directory in task payload
psql $DATABASE_URL -c "
  SELECT jsonb_pretty(parameters)
  FROM \"Task\"
  WHERE workflow_id = '$WF_ID'
  AND type = 'validation'
  LIMIT 1;
"

# Verify files exist at that path
ls -la <working_directory_path>
```

### Issue: Stage transitions skip validation
```bash
# Check state machine logs
grep "nextStage" scripts/logs/orchestrator.log | tail -20

# Check stage outputs for missing context
curl -s http://localhost:3000/api/v1/workflows/$WF_ID | jq '.stage_outputs'
```

---

## ✅ SESSION #31 SUCCESS CHECKLIST

- [ ] All 5 terminals running (orchestrator + 4 agents)
- [ ] Test workflow created (validation-test)
- [ ] Workflow progresses: initialization → scaffolding
- [ ] Validation agent receives working_directory
- [ ] Validation checks execute (pass or fail)
- [ ] Validation result stored in stage_outputs
- [ ] Second test workflow created (e2e-pipeline-test)
- [ ] Workflow progresses to e2e_testing stage
- [ ] E2E agent generates test files
- [ ] All issues documented for Session #32

---

**Start with Command #1, work through sequentially.**
**Expect 3-4 hours total for complete testing.**
