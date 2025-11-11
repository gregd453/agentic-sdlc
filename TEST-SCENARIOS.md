# Integration Test Scenarios - Session #44

**Purpose:** Detailed test cases for Agent Integration Testing phase
**Reference:** SESSION-44-PLAN.md
**Created:** 2025-11-11

---

## Test Scenario 1: Happy Path - Calculator Project

### Test ID: TS-001-HAPPY-PATH

### Prerequisites
- All services running (`./scripts/env/start-dev.sh`)
- All 5 agents registered and healthy
- PostgreSQL and Redis operational

### Test Data
```json
{
  "name": "test-calculator",
  "description": "Simple calculator application for basic operations",
  "project_requirements": "Create a TypeScript calculator that supports addition, subtraction, multiplication, and division. Include unit tests with 90%+ coverage. Add input validation for division by zero."
}
```

### Expected Workflow Stages
1. **INITIALIZATION** (10-15s)
   - Parse requirements
   - Create project context
   - Set initial workflow state

2. **SCAFFOLDING** (20-30s)
   - Generate project structure
   - Create TypeScript configuration
   - Generate package.json with dependencies
   - Output: 15-20 files in `/ai.output`

3. **VALIDATION** (15-20s)
   - Compile TypeScript
   - Run ESLint validation
   - Check test coverage requirements
   - Output: Validation report with zero errors

4. **E2E_TESTING** (30-45s)
   - Generate test scenarios
   - Create Playwright tests if applicable
   - Run tests
   - Output: Test results with 90%+ coverage

5. **INTEGRATION** (20-30s)
   - Create feature branch
   - Merge to main
   - Resolve any conflicts
   - Output: Merge summary

6. **DEPLOYMENT** (30-60s)
   - Build Docker image
   - Push to registry
   - Deploy service
   - Output: Deployment manifest

### Expected Outputs

**Stage 1 - Initialization**
```typescript
stage_outputs.initialization = {
  project_name: "test-calculator",
  requirements: "Create a TypeScript calculator...",
  estimated_files: 15,
  complexity: "low",
  dependencies: ["typescript", "jest", "eslint"]
}
```

**Stage 2 - Scaffolding**
```typescript
stage_outputs.scaffolding = {
  files_created: 17,
  directories: ["src", "tests", "dist"],
  main_files: [
    "src/calculator.ts",
    "src/index.ts",
    "tests/calculator.test.ts",
    "package.json",
    "tsconfig.json"
  ],
  total_lines: 450
}
```

**Stage 3 - Validation**
```typescript
stage_outputs.validation = {
  compilation: { status: "success", errors: 0 },
  linting: { errors: 0, warnings: 0 },
  test_coverage: { lines: 95, branches: 92, functions: 100 },
  quality_gates: ["all_passed"],
  timestamp: "2025-11-11T..."
}
```

**Stage 4 - E2E Testing**
```typescript
stage_outputs.e2e_testing = {
  test_count: 12,
  passed: 12,
  failed: 0,
  skipped: 0,
  coverage: 95,
  duration_ms: 8500,
  scenarios: [
    "addition works correctly",
    "subtraction works correctly",
    "division by zero returns error",
    ...
  ]
}
```

**Stage 5 - Integration**
```typescript
stage_outputs.integration = {
  branch_created: "feature/test-calculator",
  commits: 5,
  merge_status: "success",
  conflicts_resolved: 0,
  timestamp: "2025-11-11T..."
}
```

**Stage 6 - Deployment**
```typescript
stage_outputs.deployment = {
  docker_image: "agentic-sdlc/test-calculator:latest",
  registry: "ECR",
  deployment_status: "success",
  service_endpoint: "http://test-calculator.local",
  health_check: "passing"
}
```

### Verification Steps

**Step 1: Create Workflow**
```bash
WORKFLOW_ID=$(curl -s -X POST http://localhost:3000/api/v1/workflows \
  -H "Content-Type: application/json" \
  -d '{...}' | jq -r '.workflow_id')
echo "Created workflow: $WORKFLOW_ID"
```

**Step 2: Monitor Execution**
```bash
# Check status periodically
while true; do
  curl -s http://localhost:3000/api/v1/workflows/$WORKFLOW_ID | jq '.current_stage, .status'
  sleep 5
done
```

**Step 3: Verify Final State**
```bash
curl -s http://localhost:3000/api/v1/workflows/$WORKFLOW_ID | jq '.status, .stage_outputs' | head -50
```

**Step 4: Database Verification**
```sql
SELECT
  id,
  name,
  current_stage,
  status,
  created_at,
  completed_at,
  (completed_at - created_at) as duration
FROM workflow
WHERE id = '{WORKFLOW_ID}';

SELECT workflow_id, jsonb_object_keys(stage_outputs) as stages
FROM workflow
WHERE id = '{WORKFLOW_ID}';
```

### Success Criteria
- [ ] Workflow status: COMPLETED
- [ ] All 6 stages executed in sequence
- [ ] No stage failures
- [ ] Total duration < 3 minutes
- [ ] stage_outputs contains data from all 6 stages
- [ ] Database shows all transitions
- [ ] Agent logs show no errors
- [ ] No circuit breaker triggers

### Pass/Fail Determination
- **PASS:** All criteria met, workflow completed successfully
- **FAIL:** Any stage fails, workflow doesn't reach COMPLETED, or errors in logs

---

## Test Scenario 2: Large Project - E-Commerce Platform

### Test ID: TS-002-LARGE-PROJECT

### Test Data
```json
{
  "name": "test-ecommerce",
  "description": "Full-featured e-commerce platform",
  "project_requirements": "Build a Node.js/React e-commerce platform with:
    - User authentication and authorization
    - Product catalog with search and filtering
    - Shopping cart functionality
    - Payment integration (Stripe)
    - Order management
    - Admin dashboard
    - Email notifications
    - Unit and integration tests (>85% coverage)
    - Proper error handling and logging"
}
```

### Expected Differences from Happy Path
- **Scaffolding:** 50-70 files, higher complexity
- **Validation:** Longer linting and compilation time
- **E2E Testing:** More test scenarios, longer execution (60-90s)
- **Integration:** More commits, potential conflicts
- **Deployment:** Larger Docker image, longer build time (90-120s)

### Expected Total Duration
- 5-8 minutes for full workflow execution

### Success Criteria
- [ ] Workflow completes successfully despite larger scope
- [ ] All quality gates pass
- [ ] No agent timeouts
- [ ] Performance within expected ranges

---

## Test Scenario 3: Invalid Requirements

### Test ID: TS-003-INVALID-REQ

### Test Data
```json
{
  "name": "test-invalid",
  "description": "Test with invalid/empty requirements",
  "project_requirements": ""
}
```

### Expected Behavior
- **Stage 1:** Initialization should detect empty requirements
- **Stage 2:** Scaffolding should fail with validation error
- **Expected Error:** "Project requirements cannot be empty"
- **Workflow Status:** ERROR or FAILED

### Verification
```bash
curl -s http://localhost:3000/api/v1/workflows/$WORKFLOW_ID | jq '.status, .error'
# Expected: status = "ERROR" or "FAILED"
```

### Success Criteria
- [ ] Workflow fails at appropriate stage
- [ ] Error message is descriptive
- [ ] No agent crashes or unhandled exceptions
- [ ] Error properly logged

---

## Test Scenario 4: Circuit Breaker Activation

### Test ID: TS-004-CIRCUIT-BREAKER

### Objective
Test that circuit breaker activates after Claude API failures

### Prerequisites
- Scaffold agent running
- Access to agent logs

### Execution
1. Create normal workflow
2. Monitor for successful Claude API calls
3. Simulate 5 consecutive API failures (mock or force)
4. Verify circuit breaker OPEN state
5. Wait 60 seconds for recovery
6. Verify circuit breaker HALF-OPEN then CLOSED

### Expected Behavior
```
Success → Success → Success → Failure → Failure
→ Failure → Failure → Failure → [CIRCUIT BREAKER OPEN]
→ Wait 60s → [CIRCUIT BREAKER HALF-OPEN] → Success
→ Success → [CIRCUIT BREAKER CLOSED]
```

### Verification
- Check agent logs for circuit breaker state changes
- Monitor metrics for failed API calls
- Verify recovery after wait period

### Success Criteria
- [ ] Circuit breaker activates after 5 failures
- [ ] Open duration is ~60 seconds
- [ ] Automatic recovery after open period
- [ ] No task loss during open period

---

## Test Scenario 5: Redis Connection Loss

### Test ID: TS-005-REDIS-LOSS

### Objective
Test agent resilience when Redis becomes temporarily unavailable

### Prerequisites
- Workflow in progress
- Docker and Redis running

### Execution
1. Start workflow execution
2. During agent processing, disconnect Redis:
   ```bash
   docker pause agentic-sdlc-redis
   ```
3. Monitor agent response for 15-30 seconds
4. Reconnect Redis:
   ```bash
   docker unpause agentic-sdlc-redis
   ```
5. Monitor for automatic recovery and task resumption

### Expected Behavior
- Agent detects Redis disconnection
- Automatic reconnection attempts with exponential backoff
- Task processing resumes after reconnection
- No data loss

### Verification
- Check agent logs for connection errors and reconnection attempts
- Verify workflow continues after Redis recovery
- Confirm task output is stored correctly

### Success Criteria
- [ ] Agent detects disconnection within 5 seconds
- [ ] Reconnection attempts logged
- [ ] Task resumed after Redis available
- [ ] No data loss or corruption

---

## Test Scenario 6: Concurrent Workflows

### Test ID: TS-006-CONCURRENT

### Objective
Test system handling of multiple concurrent workflows

### Prerequisites
- All services running
- PostgreSQL connection pool: 20 connections

### Execution
1. Create 3 test workflows simultaneously:
   ```bash
   for i in {1..3}; do
     curl -s -X POST http://localhost:3000/api/v1/workflows \
       -H "Content-Type: application/json" \
       -d "{...workflow_$i...}" &
   done
   wait
   ```
2. Monitor all 3 workflows to completion
3. Track resource usage during execution

### Expected Behavior
- All 3 workflows execute independently
- No task crosstalk (tasks go to correct agents)
- All complete successfully
- Resources scale linearly

### Monitoring
```bash
# Monitor concurrency
redis-cli -p 6380 MONITOR | grep agent:tasks:

# Check queue depths
redis-cli -p 6380 LLEN agent:tasks:scaffold
redis-cli -p 6380 LLEN agent:tasks:validation

# Resource usage
docker stats --no-stream
```

### Success Criteria
- [ ] All 3 workflows complete successfully
- [ ] No task routing errors
- [ ] Average execution time ≈ sequential time (good parallelization)
- [ ] No resource exhaustion

---

## Test Scenario 7: Timeout Handling

### Test ID: TS-007-TIMEOUT

### Objective
Test graceful handling of agent processing timeout

### Prerequisites
- Ability to inject delays in agent processing

### Execution
1. Create workflow
2. Force agent to timeout during processing (e.g., 2+ minute delay)
3. Monitor system response
4. Verify timeout handling and recovery

### Expected Behavior
- Timeout detected after configured threshold (e.g., 5 minutes)
- Error logged with context
- Task marked as failed
- Next stage attempted or workflow marked ERROR

### Verification
- Check logs for timeout messages
- Verify workflow status transition
- Check stage_outputs for error details

### Success Criteria
- [ ] Timeout detected and logged
- [ ] Graceful degradation (no crashes)
- [ ] Workflow state properly updated
- [ ] Error message is descriptive

---

## Test Scenario 8: Database Connection Pool Exhaustion

### Test ID: TS-008-DB-POOL

### Objective
Test system behavior when database connection pool nears exhaustion

### Prerequisites
- PostgreSQL running with limited connection pool
- Ability to simulate slow queries

### Execution
1. Create 5 concurrent workflows (to stress pool)
2. Introduce slow queries (5+ second duration)
3. Monitor connection pool utilization
4. Verify system handles degradation gracefully

### Expected Behavior
- Queue builds up for database operations
- No crashes when pool reaches max
- Operations succeed once connections available
- Proper logging of pool exhaustion

### Verification
```sql
SELECT count(*) FROM pg_stat_activity;
SELECT datname, count(*) FROM pg_stat_activity GROUP BY datname;
```

### Success Criteria
- [ ] No connection pool crashes
- [ ] Proper queuing of database operations
- [ ] Recovery when pool usage decreases
- [ ] Monitoring/alerting appropriate

---

## Test Scenario 9: Agent Crash and Recovery

### Test ID: TS-009-AGENT-CRASH

### Objective
Test system behavior when an agent crashes during task processing

### Prerequisites
- One workflow in progress
- Ability to kill agent process

### Execution
1. Start workflow
2. Wait for agent to process task (mid-processing)
3. Kill agent: `kill -9 <PID>`
4. Monitor orchestrator response
5. Restart agent: `npm start` in agent directory
6. Verify recovery

### Expected Behavior
- Orchestrator detects agent disconnection (via ping/health check)
- Task timeout after 2-3 minutes
- Task requeued for any healthy agent of same type
- Restarted agent rejoins and processes queued tasks

### Verification
- Check orchestrator logs for disconnection detection
- Verify task requeue
- Confirm recovery and task completion

### Success Criteria
- [ ] Agent disconnection detected
- [ ] Task properly requeued
- [ ] Restarted agent processes task successfully
- [ ] No data loss

---

## Test Scenario 10: Performance Under Load

### Test ID: TS-010-LOAD-TEST

### Objective
Establish performance baselines and identify bottlenecks

### Prerequisites
- All services running
- Monitoring tools ready

### Execution
1. Create 5 identical "Calculator" workflows sequentially
2. Record timing for each workflow
3. Measure resource usage (CPU, memory, I/O)
4. Generate performance report

### Data Collection
```bash
# Per workflow:
- Start time
- End time
- Status
- Error count
- Database queries
- API calls
- Redis operations
```

### Resource Monitoring
```bash
# Before and after each workflow
docker stats --no-stream > metrics_before_$i.txt
docker stats --no-stream > metrics_after_$i.txt

# Database slow queries
SELECT query, mean_exec_time FROM pg_stat_statements
ORDER BY mean_exec_time DESC LIMIT 10;

# Redis memory
redis-cli -p 6380 INFO memory
```

### Metrics to Calculate
```
Execution Times (ms):
- Per stage average
- Per stage range (min-max)
- Total workflow average

Resource Usage:
- Peak CPU %
- Peak Memory MB
- Database connections
- Redis memory usage

Throughput:
- Workflows per minute
- Tasks per minute
- API calls per workflow
```

### Success Criteria
- [ ] 5 workflows complete successfully
- [ ] All timing data collected
- [ ] Resource usage within acceptable bounds
- [ ] Performance report generated
- [ ] Bottlenecks identified

---

## Monitoring Checklist During Tests

### Logs to Monitor
- [ ] `/scripts/logs/orchestrator.log` - Task dispatch and state changes
- [ ] `/scripts/logs/scaffold-agent.log` - Project generation
- [ ] `/scripts/logs/validation-agent.log` - Validation results
- [ ] `/scripts/logs/e2e-agent.log` - Test execution
- [ ] `/scripts/logs/integration-agent.log` - Git operations
- [ ] `/scripts/logs/deployment-agent.log` - Docker/deployment

### Commands to Watch
```bash
# Real-time agent activity
redis-cli -p 6380 MONITOR | grep -E "agent:|orchestrator"

# Task queue depth
watch -n 1 'redis-cli -p 6380 LLEN agent:tasks:scaffold && \
            redis-cli -p 6380 LLEN agent:tasks:validation'

# Agent status
watch -n 5 'curl -s http://localhost:3000/api/v1/health | jq'

# Database activity
watch -n 2 'psql -h localhost -p 5433 -U agentic -d agentic_sdlc \
            -c "SELECT current_stage, COUNT(*) FROM workflow GROUP BY current_stage"'
```

---

## Test Documentation Template

For each test scenario executed, document:

```markdown
## Test Execution: [TEST_ID] - [TEST_NAME]

**Date:** YYYY-MM-DD HH:MM UTC
**Executed by:** [Name]
**Status:** [PASS/FAIL]

### Actual Execution
- Started: [Time]
- Completed: [Time]
- Duration: [X minutes]

### Results
- Workflow Status: [COMPLETED/FAILED/ERROR]
- Stages Completed: [1-6 or subset]
- Errors Encountered: [List any]

### Resource Usage
- Peak CPU: XX%
- Peak Memory: XXX MB
- Database Connections: X

### Observations
[Notes on behavior, performance, issues]

### Attachments
- Logs: [file paths]
- Screenshots: [if applicable]
- Metrics: [if applicable]
```

---

**Test Scenarios Complete**
**Total Scenarios:** 10
**Estimated Duration:** 6-10 hours for full execution
**Reference:** SESSION-44-PLAN.md
