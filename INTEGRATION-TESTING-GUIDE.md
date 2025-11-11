# Integration Testing Quick Reference Guide

**Purpose:** Fast reference for monitoring, debugging, and troubleshooting during Agent Integration Testing
**Session:** #44
**Updated:** 2025-11-11

---

## 🚀 Quick Start

### 1. Start All Services (One Command)
```bash
./scripts/env/start-dev.sh
# Expected output: All 5 agents started + 2 Docker services running
```

### 2. Verify Startup
```bash
./scripts/env/check-health.sh --verbose
# Expected: 8/8 services healthy (PostgreSQL, Redis, Orchestrator, 5 agents)
```

### 3. Monitor Real-Time
```bash
# Open 6 terminal windows:
# 1. Redis activity: redis-cli -p 6380 MONITOR
# 2. Orchestrator: tail -f ./scripts/logs/orchestrator.log
# 3. Agents: for agent in scaffold validation e2e integration deployment; do
#              tail -f ./scripts/logs/$agent-agent.log &
#            done

# Or use this all-in-one monitoring dashboard (Terminal 1)
watch -n 1 'echo "=== AGENT ACTIVITY ==="; \
redis-cli -p 6380 DBSIZE; \
redis-cli -p 6380 LLEN agent:tasks:scaffold; \
redis-cli -p 6380 LLEN agent:tasks:validation; \
echo "=== WORKFLOW STATUS ==="; \
curl -s http://localhost:3000/api/v1/workflows | jq ".workflows[] | {id: .id, stage: .current_stage, status: .status}"'
```

---

## 📊 Live Monitoring Dashboards

### Dashboard 1: Agent Status (Terminal)
```bash
watch -n 2 'redis-cli -p 6380 HGETALL agent:registry | head -20'
# Shows: agent types, connection status, last heartbeat
```

### Dashboard 2: Task Queue (Terminal)
```bash
watch -n 1 'echo "SCAFFOLD: $(redis-cli -p 6380 LLEN agent:tasks:scaffold)"; \
            echo "VALIDATION: $(redis-cli -p 6380 LLEN agent:tasks:validation)"; \
            echo "E2E: $(redis-cli -p 6380 LLEN agent:tasks:e2e)"; \
            echo "INTEGRATION: $(redis-cli -p 6380 LLEN agent:tasks:integration)"; \
            echo "DEPLOYMENT: $(redis-cli -p 6380 LLEN agent:tasks:deployment)"'
```

### Dashboard 3: Workflow Progress (Terminal)
```bash
watch -n 5 'curl -s http://localhost:3000/api/v1/workflows | jq ".workflows | map({name: .name, stage: .current_stage, status: .status})"'
# Shows: all workflows, current stages, statuses
```

### Dashboard 4: System Resources (Terminal)
```bash
watch -n 2 'docker stats --no-stream'
# Shows: CPU, Memory, Network I/O for all containers
```

---

## 🔍 Debugging Commands

### View Agent Registration
```bash
redis-cli -p 6380
HGETALL agent:registry
# Returns: agent types, last heartbeat, status
```

### Check Task Queue
```bash
# List all pending tasks
redis-cli -p 6380 LRANGE agent:tasks:scaffold 0 -1

# Check queue depth
redis-cli -p 6380 LLEN agent:tasks:scaffold
redis-cli -p 6380 LLEN agent:tasks:validation
redis-cli -p 6380 LLEN agent:tasks:e2e
redis-cli -p 6380 LLEN agent:tasks:integration
redis-cli -p 6380 LLEN agent:tasks:deployment
```

### Monitor Results Channel
```bash
redis-cli -p 6380
SUBSCRIBE orchestrator:results
# Watch for real-time result messages from agents
```

### Check Workflow Status
```bash
# List all workflows
curl -s http://localhost:3000/api/v1/workflows | jq '.workflows'

# Get specific workflow
curl -s http://localhost:3000/api/v1/workflows/{WORKFLOW_ID} | jq '.'

# Get workflow with stage outputs
curl -s http://localhost:3000/api/v1/workflows/{WORKFLOW_ID} | jq '.stage_outputs'
```

### Database Queries
```bash
psql -h localhost -p 5433 -U agentic -d agentic_sdlc

# List all workflows
SELECT id, name, current_stage, status, created_at FROM workflow ORDER BY created_at DESC;

# Get specific workflow with outputs
SELECT id, name, current_stage, status, stage_outputs FROM workflow WHERE id = '{WORKFLOW_ID}' \G

# Check recent errors
SELECT id, name, status, error FROM workflow WHERE status IN ('ERROR', 'FAILED') ORDER BY created_at DESC;

# Stage transition timeline
SELECT id, current_stage, updated_at FROM workflow WHERE id = '{WORKFLOW_ID}' ORDER BY updated_at;
```

### View Agent Logs
```bash
# Scaffold agent
tail -f ./scripts/logs/scaffold-agent.log | grep -E "ERROR|SUCCESS|task|error"

# Validation agent
tail -f ./scripts/logs/validation-agent.log | grep -E "ERROR|validation|report"

# All agents simultaneously
for agent in scaffold validation e2e integration deployment; do
  echo "=== $agent-agent ==="
  tail -n 20 ./scripts/logs/$agent-agent.log
done

# Search logs for errors
grep -h ERROR ./scripts/logs/*.log | tail -20
```

### Check Orchestrator API
```bash
# Health check
curl http://localhost:3000/api/v1/health | jq '.'

# Create test workflow
curl -X POST http://localhost:3000/api/v1/workflows \
  -H "Content-Type: application/json" \
  -d '{
    "name": "test",
    "description": "test",
    "project_requirements": "simple calculator"
  }' | jq '.'

# List all workflows
curl -s http://localhost:3000/api/v1/workflows | jq '.workflows | length'

# Get specific workflow details
curl -s http://localhost:3000/api/v1/workflows/{WORKFLOW_ID} | jq '.stage_outputs | keys'
```

---

## ⚠️ Common Issues & Fixes

### Issue 1: Agent Not Receiving Tasks
**Symptoms:** Task stays in queue, agent logs show no processing

**Debug Steps:**
```bash
# 1. Check agent is registered
redis-cli -p 6380 HGETALL agent:registry | grep scaffold

# 2. Check task is in queue
redis-cli -p 6380 LRANGE agent:tasks:scaffold 0 -1

# 3. Check agent subscribed to channel
grep "subscribing\|Subscribed" ./scripts/logs/scaffold-agent.log | tail -5

# 4. Check for errors
grep ERROR ./scripts/logs/scaffold-agent.log | tail -10

# 5. Restart agent
cd packages/agents/scaffold-agent && npm start
```

### Issue 2: Workflow Stuck in Stage
**Symptoms:** Workflow doesn't transition to next stage

**Debug Steps:**
```bash
# 1. Check current stage
curl -s http://localhost:3000/api/v1/workflows/{WORKFLOW_ID} | jq '.current_stage'

# 2. Check for errors in stage_outputs
curl -s http://localhost:3000/api/v1/workflows/{WORKFLOW_ID} | jq '.stage_outputs'

# 3. Check agent logs for processing errors
grep ERROR ./scripts/logs/*-agent.log | grep {WORKFLOW_ID}

# 4. Check orchestrator logs
grep {WORKFLOW_ID} ./scripts/logs/orchestrator.log | tail -20

# 5. Check if result was published
redis-cli -p 6380
SUBSCRIBE orchestrator:results
# Check for messages with matching workflow_id
```

### Issue 3: Redis Connection Issues
**Symptoms:** "Connection refused" or "ECONNREFUSED" errors

**Debug Steps:**
```bash
# 1. Check Redis is running
docker ps | grep redis

# 2. Test Redis connectivity
redis-cli -p 6380 PING
# Expected: PONG

# 3. Check Redis logs
docker logs agentic-sdlc-redis | tail -20

# 4. Check if port 6380 is in use
netstat -an | grep 6380

# 5. Restart Redis
docker restart agentic-sdlc-redis

# 6. Reconnect agents
kill -9 $(pgrep -f "scaffold-agent\|validation-agent\|e2e-agent\|integration-agent\|deployment-agent")
./scripts/env/start-dev.sh
```

### Issue 4: PostgreSQL Connection Issues
**Symptoms:** "FATAL: database..." or "Connection refused" errors

**Debug Steps:**
```bash
# 1. Check PostgreSQL is running
docker ps | grep postgres

# 2. Test connectivity
psql -h localhost -p 5433 -U agentic -d agentic_sdlc -c "SELECT 1"

# 3. Check logs
docker logs agentic-sdlc-postgres | tail -20

# 4. Check database exists
psql -h localhost -p 5433 -U agentic -c "\l"

# 5. Restart PostgreSQL
docker restart agentic-sdlc-postgres
sleep 5
./scripts/env/start-dev.sh
```

### Issue 5: Circuit Breaker Open
**Symptoms:** "Circuit breaker is OPEN" in agent logs

**Debug Steps:**
```bash
# 1. Check circuit breaker state
grep "Circuit breaker" ./scripts/logs/*-agent.log

# 2. Check for API errors that triggered breaker
grep "ANTHROPIC_API_KEY\|Claude API\|error" ./scripts/logs/*-agent.log

# 3. Verify API key is set
echo $ANTHROPIC_API_KEY
# Should not be empty

# 4. Wait 60 seconds for circuit breaker to attempt recovery
sleep 60

# 5. Monitor recovery
tail -f ./scripts/logs/scaffold-agent.log | grep "Circuit"

# 6. If still open, restart agent
kill -9 $(pgrep -f "scaffold-agent")
cd packages/agents/scaffold-agent && npm start
```

---

## 🔧 Performance Tuning

### Check Database Query Performance
```sql
-- Enable query logging
ALTER SYSTEM SET log_statement = 'all';
ALTER SYSTEM SET log_duration = 'on';
SELECT pg_reload_conf();

-- View slow queries
SELECT query, calls, mean_exec_time, max_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC LIMIT 10;

-- Find missing indexes
SELECT schemaname, tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public' ORDER BY tablename;
```

### Monitor Redis Memory
```bash
redis-cli -p 6380
INFO memory
# Check: used_memory, used_memory_peak, fragmentation_ratio

# Check top keys by memory
redis-cli -p 6380 --bigkeys
# Shows keys taking most memory

# Clear old data if needed
redis-cli -p 6380 FLUSHDB
# WARNING: Clears all data!
```

### CPU and Memory Usage
```bash
# Per-process breakdown
ps aux | grep -E "postgres|redis|node|npm" | grep -v grep

# Real-time monitoring
top -p $(pgrep -f "postgres|redis" | tr '\n' ',')$(pgrep -f "node" | head -1)

# Docker container stats
docker stats agentic-sdlc-postgres agentic-sdlc-redis
```

---

## 📝 Test Execution Checklist

### Pre-Test
- [ ] All services started (`./scripts/env/start-dev.sh`)
- [ ] Health check passed (`./scripts/env/check-health.sh --verbose`)
- [ ] All 5 agents registered in Redis
- [ ] Monitoring tools ready (logs, dashboards)
- [ ] Test data prepared

### During Test
- [ ] Monitor task queues in real-time
- [ ] Watch for agent errors in logs
- [ ] Track workflow stage transitions
- [ ] Note timing for each stage
- [ ] Record any anomalies

### Post-Test
- [ ] Verify workflow reached COMPLETED state
- [ ] Check stage_outputs for all stages
- [ ] Document any errors or warnings
- [ ] Calculate total execution time
- [ ] Backup logs for analysis

---

## 📊 Quick Performance Snapshot

```bash
#!/bin/bash
# Save this as check-performance.sh

echo "=== SERVICES STATUS ==="
./scripts/env/check-health.sh

echo ""
echo "=== AGENT REGISTRATION ==="
redis-cli -p 6380 HGETALL agent:registry | grep -E "type|heartbeat" | head -10

echo ""
echo "=== TASK QUEUES ==="
echo "Scaffold: $(redis-cli -p 6380 LLEN agent:tasks:scaffold)"
echo "Validation: $(redis-cli -p 6380 LLEN agent:tasks:validation)"
echo "E2E: $(redis-cli -p 6380 LLEN agent:tasks:e2e)"
echo "Integration: $(redis-cli -p 6380 LLEN agent:tasks:integration)"
echo "Deployment: $(redis-cli -p 6380 LLEN agent:tasks:deployment)"

echo ""
echo "=== WORKFLOW COUNT ==="
curl -s http://localhost:3000/api/v1/workflows | jq '.workflows | length'

echo ""
echo "=== RESOURCE USAGE ==="
docker stats --no-stream | awk 'NR>1 {printf "%s: CPU=%s, MEM=%s\n", $1, $3, $4}'

echo ""
echo "=== DATABASE SIZE ==="
psql -h localhost -p 5433 -U agentic -d agentic_sdlc -c \
  "SELECT 'workflows' as table, COUNT(*) as count FROM workflow UNION \
   SELECT 'tasks', COUNT(*) FROM task;"

echo ""
echo "=== REDIS MEMORY ==="
redis-cli -p 6380 INFO memory | grep used_memory_human
```

---

## 🎯 Testing Workflow

### Happy Path Test
```bash
# 1. Create workflow
WORKFLOW_ID=$(curl -s -X POST http://localhost:3000/api/v1/workflows \
  -H "Content-Type: application/json" \
  -d '{
    "name": "integration-test",
    "description": "Integration testing",
    "project_requirements": "Create a simple TypeScript calculator"
  }' | jq -r '.workflow_id')

echo "Created workflow: $WORKFLOW_ID"

# 2. Monitor execution
while true; do
  STATUS=$(curl -s http://localhost:3000/api/v1/workflows/$WORKFLOW_ID | jq -r '.status')
  STAGE=$(curl -s http://localhost:3000/api/v1/workflows/$WORKFLOW_ID | jq -r '.current_stage')
  echo "$(date '+%H:%M:%S') - Status: $STATUS, Stage: $STAGE"

  if [ "$STATUS" = "COMPLETED" ] || [ "$STATUS" = "FAILED" ]; then
    break
  fi
  sleep 5
done

# 3. Final verification
curl -s http://localhost:3000/api/v1/workflows/$WORKFLOW_ID | jq '{status, current_stage, stage_outputs: (.stage_outputs | keys)}'
```

---

## 📞 Emergency Procedures

### If Everything Breaks
```bash
# Full restart
./scripts/env/stop-dev.sh
sleep 10
./scripts/cleanup-test-env.sh --all
sleep 5
./scripts/env/start-dev.sh
```

### If Database is Corrupted
```bash
# Reset database
docker exec agentic-sdlc-postgres dropdb -U agentic agentic_sdlc
docker exec agentic-sdlc-postgres createdb -U agentic agentic_sdlc
# Migrations will run on next startup
./scripts/env/start-dev.sh
```

### If Need to Debug Agent Communication
```bash
# Monitor all Redis activity
redis-cli -p 6380 MONITOR

# Filter by pattern
redis-cli -p 6380 MONITOR | grep "agent:"
redis-cli -p 6380 MONITOR | grep "orchestrator:"

# In another terminal, trigger action
curl -X POST http://localhost:3000/api/v1/workflows ...
```

---

**This guide is your companion during Session #44 integration testing**
**Keep it open in one terminal window for quick reference**
**Last Updated:** 2025-11-11
