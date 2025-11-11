# SESSION #44 - Agent Integration Testing Plan

**Status:** Ready for Execution
**Target Date:** 2025-11-11
**Expected Duration:** 8-12 hours (4 phases)
**Success Criteria:** Full workflow execution end-to-end with all stages completing successfully

---

## 🎯 Session Objectives

### Primary Goals
1. **Agent Integration Testing** - Verify all 5 agents deploy correctly and receive tasks
2. **Full Workflow Execution** - Monitor workflow progression through all 5 stages (initialization → deployment)
3. **Error Handling Validation** - Test failure scenarios and retry logic
4. **Performance Baseline** - Measure execution times and resource usage

### Expected Outcomes
- ✅ All 5 agents operational and responding to tasks
- ✅ Complete workflow execution: initialization → scaffolding → validation → e2e → integration → deployment
- ✅ Stage transitions validated with context passing
- ✅ Error scenarios tested and handled gracefully
- ✅ Performance metrics baseline established

---

## 📋 Phase 1: Agent Deployment & Verification (1-2 hours)

### Objectives
- Start full environment (PostgreSQL, Redis, Orchestrator, 5 Agents)
- Verify all agents register and become operational
- Establish baseline health checks

### Tasks

**1.1: Start Development Environment**
```bash
./scripts/env/start-dev.sh
# Expected: PostgreSQL, Redis, Orchestrator, 5 agents all running
# Verify: All .pids files created, all services logging
```

**1.2: Verify Agent Registration**
- Check Redis registry: `redis-cli -p 6380 KEYS agent:*`
- Verify 5 agents registered with correct types
- Check agent:registry hash for each agent metadata

**1.3: Health Check Baseline**
- Run: `./scripts/env/check-health.sh --verbose`
- Verify:
  - PostgreSQL responding (pg_isready)
  - Redis responding (redis-cli ping)
  - Orchestrator health endpoint (GET /api/v1/health)
  - All 5 Node processes running
- Collect baseline metrics: uptime, error count = 0

**1.4: Create Test Workflow**
```bash
# Create workflow for "Calculator" project (simple test case)
curl -X POST http://localhost:3000/api/v1/workflows \
  -H "Content-Type: application/json" \
  -d '{
    "name": "test-calculator",
    "description": "Calculator project for integration testing",
    "project_requirements": "Simple calculator with add/subtract/multiply functions"
  }'
# Expected: 201 response with workflow_id
```

### Success Criteria
- [ ] All 5 agents registered in Redis
- [ ] All agents report healthy status (error_count = 0)
- [ ] Orchestrator API responding (health = OK)
- [ ] PostgreSQL and Redis healthy
- [ ] Test workflow created with valid UUID

### Files to Monitor
- `/scripts/logs/orchestrator.log` - Orchestrator startup
- `/scripts/logs/scaffold-agent.log` - Agent initialization
- `/scripts/logs/validation-agent.log`
- `/scripts/logs/e2e-agent.log`
- `/scripts/logs/integration-agent.log`
- `/scripts/logs/deployment-agent.log`

---

## 📋 Phase 2: Full Workflow Execution Testing (2-3 hours)

### Objectives
- Execute complete workflow through all stages
- Monitor task dispatch and agent processing
- Verify stage output storage and context passing
- Validate state machine transitions

### Tasks

**2.1: Stage 1 - Initialization**
- Monitor: Agent dispatcher should create initialization task
- Verify: Task appears in `agent:tasks:scaffold` channel
- Expected payload: Project requirements, context with empty stage_outputs
- Success condition: Agent processes, stores outputs in database

**2.2: Stage 2 - Scaffolding**
- Monitor: After initialization completes, scaffold task created
- Verify: Scaffold agent receives task with initialization context
- Output validation: Generated project files exist in memory
- Expected: stage_outputs.scaffolding populated with file paths/structure
- Success condition: Database updated with stage outputs

**2.3: Stage 3 - Validation**
- Monitor: Validation task created after scaffolding
- Verify: Validation agent receives task with both initialization and scaffolding context
- Output validation: Validation report generated
- Expected: Quality metrics, linting results stored
- Success condition: stage_outputs.validation contains validation results

**2.4: Stage 4 - E2E Testing**
- Monitor: E2E task created after validation passes
- Verify: E2E agent receives full context
- Output validation: Test scenarios generated and executed
- Expected: Test results, coverage metrics stored
- Success condition: stage_outputs.e2e_testing contains test results

**2.5: Stage 5 - Integration**
- Monitor: Integration task created after E2E tests pass
- Verify: Integration agent receives full workflow context
- Output validation: Branch integration, merge strategy
- Expected: Integration logs, conflict resolution results
- Success condition: stage_outputs.integration contains merge results

**2.6: Stage 6 - Deployment**
- Monitor: Deployment task created after integration
- Verify: Deployment agent receives all previous context
- Output validation: Docker build, registry push, deployment manifest
- Expected: Deployment logs, service endpoints
- Success condition: Workflow reaches COMPLETED state

### Monitoring Strategy
- **Redis Pub/Sub**: Monitor `orchestrator:results` for stage completion events
- **Logs**: Tail agent logs in real-time to track processing
- **Database**: Query workflow table to verify state transitions
- **Metrics**: Track task duration, token usage, API calls

### Success Criteria
- [ ] Workflow state transitions: PENDING → INITIALIZED → SCAFFOLDING → VALIDATING → TESTING → INTEGRATING → DEPLOYING → COMPLETED
- [ ] All 6 stages complete successfully with no manual intervention
- [ ] stage_outputs contains data from all completed stages
- [ ] No agent errors or circuit breaker triggers
- [ ] Total execution time < 10 minutes for simple test case

### Expected Workflow Duration
- Initialization: 10-15 seconds
- Scaffolding: 20-30 seconds (Claude API calls)
- Validation: 15-20 seconds (compilation, linting)
- E2E Testing: 30-45 seconds (Playwright)
- Integration: 20-30 seconds (Git operations)
- Deployment: 30-60 seconds (Docker build)
- **Total: ~2-3 minutes for complete workflow**

---

## 📋 Phase 3: Error Handling & Failure Scenarios (2-3 hours)

### Objectives
- Test failure scenarios and recovery
- Verify retry logic and circuit breaker
- Validate error messages and logging

### Test Scenarios

**3.1: Invalid Project Requirements**
```json
{
  "name": "test-invalid",
  "description": "Test invalid requirements",
  "project_requirements": ""  // Empty requirements
}
```
- Expected: Validation error at scaffolding stage
- Action: Agent should fail gracefully with descriptive error
- Verify: Error stored in database, workflow transitions to ERROR state

**3.2: Claude API Failure Simulation**
- Inject circuit breaker test: Force API failure
- Expected: Agent retries up to failure threshold
- After 5 failures: Circuit breaker OPEN
- After 60 seconds: Attempt to close circuit
- Verify: Proper logging and metrics

**3.3: Redis Connection Loss**
- Disconnect Redis temporarily during task processing
- Expected: Agent detects disconnection
- Action: Automatic reconnect with exponential backoff
- Verify: Task resumed after reconnection

**3.4: Agent Timeout**
- Create task with very long processing requirement
- Monitor: Task processing time exceeds normal bounds
- Expected: Graceful timeout handling
- Action: Error logged, next stage skipped or retried

**3.5: Concurrent Task Dispatch**
- Send multiple workflows simultaneously
- Expected: All tasks routed to correct agent types
- Verify: No message crosstalk or task loss
- Metrics: Measure queue depth and processing concurrency

### Success Criteria
- [ ] All error scenarios handled gracefully
- [ ] No unhandled exceptions or service crashes
- [ ] Proper error logging with context
- [ ] Retry logic functions correctly
- [ ] Circuit breaker triggers and recovers properly

### Monitoring
- Check agent logs for error messages
- Monitor Redis queue depth
- Verify database error records
- Review circuit breaker state transitions

---

## 📋 Phase 4: Performance Baseline & Monitoring (1-2 hours)

### Objectives
- Establish performance baselines
- Measure resource utilization
- Create performance monitoring framework

### Metrics to Collect

**Execution Time Metrics**
```
Per Agent:
- Task receive latency
- Processing time
- Result publish latency
- Total end-to-end time

Per Workflow:
- Time per stage
- Total workflow duration
- Queue wait times
```

**Resource Metrics**
```
CPU Usage:
- Orchestrator
- Each agent
- PostgreSQL
- Redis

Memory Usage:
- Orchestrator
- Each agent
- PostgreSQL
- Redis

I/O:
- Database connections
- Redis commands
- Network latency
```

**API Metrics**
```
Claude API:
- API call count per workflow
- Token usage per stage
- API latency
- Timeout/retry counts

Database:
- Query count
- Slow queries (>100ms)
- Connection pool utilization
```

### Collection Strategy

**4.1: Instrumentation Setup**
- Add timing decorators to agent execute() methods
- Enable query logging in PostgreSQL
- Monitor Redis command latency
- Track API token usage per stage

**4.2: Test Runs**
Run 5 identical "Calculator" workflows sequentially:
```
1. Baseline run (empty system)
2. Run 2-5: Under normal load
Calculate: Mean, min, max, std deviation
```

**4.3: Metrics Capture**
```bash
# Before each workflow
docker stats --no-stream > metrics-before.txt
redis-cli INFO stats > redis-before.txt

# After workflow completion
docker stats --no-stream > metrics-after.txt
redis-cli INFO stats > redis-after.txt

# Parse: CPU%, Memory%, Network I/O
```

**4.4: Report Generation**
Create `PERFORMANCE-BASELINE.md`:
```
Agent Execution Times (ms):
- Scaffold Agent: mean=XXX, min=XXX, max=XXX
- Validation Agent: mean=XXX, min=XXX, max=XXX
- E2E Agent: mean=XXX, min=XXX, max=XXX
- Integration Agent: mean=XXX, min=XXX, max=XXX
- Deployment Agent: mean=XXX, min=XXX, max=XXX

Resource Usage:
- Peak CPU: XX%
- Peak Memory: XXX MB
- Database connections: X/20
- Redis memory: XXX MB

API Usage:
- Claude API calls per workflow: X
- Tokens per workflow: XXXX
- Average API latency: XXX ms
```

### Success Criteria
- [ ] All timing data collected for 5 runs
- [ ] Resource utilization baselines established
- [ ] No performance regressions vs. expected values
- [ ] Scalability targets identified (10x, 100x workflows)
- [ ] Performance report documented

### Optimization Opportunities
- Identify slow agents (> expected time)
- Find database query bottlenecks
- Optimize Redis usage patterns
- Cache frequently-accessed data

---

## 🔧 Tools & Commands

### Environment Management
```bash
# Start all services
./scripts/env/start-dev.sh

# Check health
./scripts/env/check-health.sh --verbose

# Stop services
./scripts/env/stop-dev.sh

# View logs
tail -f ./scripts/logs/orchestrator.log
tail -f ./scripts/logs/scaffold-agent.log
tail -f ./scripts/logs/validation-agent.log

# Clean up
./scripts/cleanup-test-env.sh --all
```

### Redis Monitoring
```bash
# Connect to Redis
redis-cli -p 6380

# Monitor channel activity
SUBSCRIBE orchestrator:results
PSUBSCRIBE agent:tasks:*

# Check agent registry
KEYS agent:*
HGETALL agent:registry

# Check queue depth
LLEN agent:tasks:scaffold
LLEN agent:tasks:validation
```

### Database Inspection
```bash
# PostgreSQL connection
psql -h localhost -p 5433 -U agentic -d agentic_sdlc

# Check workflows
SELECT id, name, current_stage, status FROM workflow;

# Check stage outputs
SELECT workflow_id, stage_outputs FROM workflow WHERE id = 'UUID';

# Monitor queries
EXPLAIN ANALYZE <query>;
```

### API Testing
```bash
# Create workflow
curl -X POST http://localhost:3000/api/v1/workflows \
  -H "Content-Type: application/json" \
  -d '{"name":"test","description":"test","project_requirements":"test"}'

# Get workflow status
curl http://localhost:3000/api/v1/workflows/{workflow_id}

# List all workflows
curl http://localhost:3000/api/v1/workflows

# Health check
curl http://localhost:3000/api/v1/health
```

---

## 📊 Expected Results

### Test Workflow Completion
```
Workflow: test-calculator
├─ Stage 1: INITIALIZATION (10-15s)
│  └─ Output: Requirements parsed, project name confirmed
├─ Stage 2: SCAFFOLDING (20-30s)
│  └─ Output: 15-20 files generated, TypeScript config, package.json
├─ Stage 3: VALIDATION (15-20s)
│  └─ Output: TypeScript compilation passed, ESLint 0 errors, test count
├─ Stage 4: E2E TESTING (30-45s)
│  └─ Output: Test scenarios generated, 10+ tests, 95%+ coverage
├─ Stage 5: INTEGRATION (20-30s)
│  └─ Output: Branch created, files merged, conflicts resolved
└─ Stage 6: DEPLOYMENT (30-60s)
   └─ Output: Docker image built, pushed to registry, deployed

Total Duration: ~2-3 minutes
Agent Success Rate: 100% (5/5 agents complete tasks)
Error Rate: 0 (no failures or retries)
```

### Performance Baselines
```
Agent Processing (per task):
- Scaffold: 20-30 seconds
- Validation: 15-20 seconds
- E2E: 30-45 seconds
- Integration: 20-30 seconds
- Deployment: 30-60 seconds

System Resource Usage:
- CPU: 30-50% during peak processing
- Memory: 1.2-1.5 GB total
- Database: 50-100 queries per workflow
- Redis: < 50 MB memory usage
```

---

## 📝 Documentation to Create

### Phase 1: Deployment Verification
- [ ] `AGENT-DEPLOYMENT-REPORT.md` - Agent registration status
- [ ] `HEALTH-CHECK-BASELINE.md` - Initial system health metrics

### Phase 2: Workflow Execution
- [ ] `WORKFLOW-EXECUTION-LOGS.md` - Step-by-step execution trace
- [ ] `STAGE-OUTPUT-VALIDATION.md` - Verify all stage outputs
- [ ] `CONTEXT-PASSING-VERIFICATION.md` - Confirm context flows between stages

### Phase 3: Error Handling
- [ ] `ERROR-SCENARIO-TESTING.md` - Test results for all failure cases
- [ ] `RECOVERY-VERIFICATION.md` - Confirm retry and recovery logic

### Phase 4: Performance
- [ ] `PERFORMANCE-BASELINE.md` - Metrics and analysis
- [ ] `SCALABILITY-ASSESSMENT.md` - 10x, 100x projections

### Final
- [ ] `SESSION-44-COMPLETION.md` - Session summary and achievements

---

## 🚨 Contingency Plans

### If Agent Fails to Start
1. Check logs for startup errors
2. Verify Redis connectivity in agent init
3. Verify ANTHROPIC_API_KEY environment variable
4. Check port availability (agents use dynamic ports)
5. Restart with: `npm start` in agent directory

### If Workflow Stalls
1. Check agent logs for errors
2. Verify Redis subscription is active
3. Check database for stage_outputs
4. Monitor circuit breaker state
5. Check orchestrator logs for task dispatch errors

### If Performance is Poor
1. Check CPU/memory usage with `docker stats`
2. Monitor PostgreSQL slow query log
3. Check Redis memory with `INFO memory`
4. Verify no network issues (latency)
5. Profile Claude API calls

---

## ✅ Success Criteria Summary

**Phase 1:** Agent Deployment
- [ ] 5/5 agents registered and healthy
- [ ] All services responsive
- [ ] Test workflow created

**Phase 2:** Full Execution
- [ ] Workflow reaches COMPLETED state
- [ ] All 6 stages complete in sequence
- [ ] No agent errors
- [ ] Duration < 3 minutes

**Phase 3:** Error Handling
- [ ] 5+ error scenarios tested
- [ ] No unhandled exceptions
- [ ] Proper error logging
- [ ] Graceful recovery

**Phase 4:** Performance
- [ ] Baseline metrics collected
- [ ] 5 test runs completed
- [ ] Performance report generated
- [ ] No regressions detected

---

## 📅 Timeline

| Phase | Task | Duration | Target Time |
|-------|------|----------|-------------|
| 1 | Agent Deployment | 1-2h | 08:00-10:00 |
| 2 | Workflow Execution | 2-3h | 10:00-13:00 |
| 3 | Error Handling | 2-3h | 13:00-16:00 |
| 4 | Performance | 1-2h | 16:00-18:00 |
| **Total** | **Complete Session** | **6-10h** | **08:00-18:00** |

---

## 🎯 Next Phase (Session #45)

After Session #44 completes:
1. Review performance baselines
2. Identify optimization opportunities
3. Load testing with 10x+ concurrent workflows
4. Stress testing with failure injection
5. Production readiness assessment

---

**Prepared for Session #44**
**Status:** Ready to Execute
**Last Updated:** 2025-11-11 21:50 UTC
