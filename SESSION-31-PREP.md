# SESSION #31 PREPARATION - Multi-Agent Pipeline Testing

**Date:** 2025-11-10
**Previous Session:** #30 - Workflow Context Passing ✅ COMPLETE
**Current Status:** Ready for Production Testing
**Time Estimate:** 3-4 hours

---

## 📊 SYSTEM STATE OVERVIEW

### What's Working (Verified in Session #30)

| Component | Status | Last Tested | Evidence |
|-----------|--------|-------------|----------|
| **Scaffold Agent** | ✅ OPERATIONAL | Session #30 | Generated files in ai.output/ |
| **Validation Agent** | ✅ BUILT | Session #29 | 4000+ lines, comprehensive checks |
| **E2E Agent** | ✅ BUILT | Session #29 | Playwright integration ready |
| **Database Context** | ✅ WORKING | Session #30 | stage_outputs field populated |
| **Context Passing** | ✅ WORKING | Session #30 | working_directory passed to validation |
| **Stage Transitions** | ✅ WORKING | Session #30 | init → scaffold → validation |
| **Redis Messaging** | ✅ WORKING | Session #24 | Dedup prevents triple-fire |
| **Agent Registration** | ✅ WORKING | Session #29 | All agents register with orchestrator |

### What Needs Testing (Session #31 Focus)

| Test Area | Description | Expected Result | Risk Level |
|-----------|-------------|-----------------|------------|
| **Validation Execution** | Does validation actually validate files? | Pass/fail checks executed | Medium |
| **E2E Pipeline** | Full workflow through e2e_testing stage | Test generation + execution | High |
| **Integration Stage** | API integration tests | Integration checks complete | Medium |
| **Deployment Stage** | Container deployment | Deployment URL returned | Low |
| **Error Recovery** | What happens when validation fails? | Graceful error handling | High |

---

## 🎯 SESSION #31 PRIMARY OBJECTIVES

### Objective 1: Verify Validation Agent Execution (60 mins)
**Goal:** Confirm validation agent can find and validate generated files

**Test Steps:**
1. Create test workflow: "validation-test"
2. Wait for scaffold → validation transition
3. Verify validation agent receives `working_directory` parameter
4. Check validation agent logs for file discovery
5. Confirm validation checks execute (TypeScript, ESLint, etc.)
6. Verify validation result returned to orchestrator

**Success Criteria:**
- ✅ Validation agent finds generated files at `working_directory`
- ✅ Validation checks execute (pass OR fail, doesn't matter)
- ✅ Validation result includes: overall_status, passed_checks, failed_checks
- ✅ Stage transitions validation → e2e_testing (if passed)

**Failure Modes:**
- ❌ Validation can't find files → Check path construction in buildStagePayload()
- ❌ Validation checks don't run → Check validation-agent.ts execute() method
- ❌ No result returned → Check Redis pub/sub in validation agent

### Objective 2: Test E2E Agent Pipeline (90 mins)
**Goal:** Verify complete workflow through e2e_testing stage

**Test Steps:**
1. Create test workflow: "e2e-pipeline-test"
2. Monitor progression: init → scaffold → validation → e2e_testing
3. Verify e2e agent receives:
   - working_directory
   - entry_points
   - validation_passed: true
4. Check e2e agent generates Playwright tests
5. Verify test execution (may fail, that's OK)
6. Confirm result includes: tests_generated, test_results

**Success Criteria:**
- ✅ Workflow progresses to e2e_testing stage
- ✅ E2E agent generates test files
- ✅ Tests execute (pass/fail doesn't matter for now)
- ✅ Result returned with test_results field

**Failure Modes:**
- ❌ Stage skips e2e → Check stage progression logic
- ❌ E2E agent doesn't start → Check agent registration
- ❌ Tests don't generate → Check e2e-agent.ts prompt logic

### Objective 3: Identify Integration Gaps (60 mins)
**Goal:** Document any missing context or integration issues

**Analysis Areas:**
1. **Context Completeness:** Are all required fields present in each stage payload?
2. **Error Propagation:** Do errors bubble up correctly?
3. **State Consistency:** Does database match state machine?
4. **Agent Communication:** Are all messages delivered?

**Deliverables:**
- List of missing context fields
- Error handling gaps
- Recommendations for Session #32

---

## 🔧 TESTING INFRASTRUCTURE

### Environment Setup
```bash
# Start infrastructure
cd /Users/Greg/Projects/apps/zyp/agent-sdlc
./scripts/env/start-dev.sh

# In separate terminals:
# Terminal 1: Orchestrator
pnpm --filter @agentic-sdlc/orchestrator dev

# Terminal 2: Scaffold Agent
pnpm --filter @agentic-sdlc/agents/scaffold-agent dev

# Terminal 3: Validation Agent
pnpm --filter @agentic-sdlc/agents/validation-agent dev

# Terminal 4: E2E Agent
pnpm --filter @agentic-sdlc/agents/e2e-agent dev
```

### Test Workflow Creation
```bash
# Create test workflow
curl -X POST http://localhost:3000/api/v1/workflows \
  -H "Content-Type: application/json" \
  -d '{
    "type": "app",
    "name": "session-31-test",
    "description": "Test validation and e2e agent execution",
    "requirements": "Simple calculator app for agent testing",
    "priority": "high"
  }'

# Save workflow ID, then monitor:
curl http://localhost:3000/api/v1/workflows/{workflow_id}
```

### Log Monitoring
```bash
# Real-time logs with grep
tail -f scripts/logs/orchestrator.log | grep "SESSION #30\|SESSION #31"
tail -f scripts/logs/validation-agent.log | grep "VALIDATION\|ERROR"
tail -f scripts/logs/e2e-agent.log | grep "E2E\|PLAYWRIGHT"
```

### Database Inspection
```bash
# Check workflow state
psql $DATABASE_URL -c "
  SELECT id, name, type, current_stage, status, progress_percentage
  FROM \"Workflow\"
  WHERE name LIKE '%session-31%'
  ORDER BY created_at DESC
  LIMIT 5;
"

# Check stage outputs
psql $DATABASE_URL -c "
  SELECT stage_outputs
  FROM \"Workflow\"
  WHERE id = '{workflow_id}';
" | jq .
```

---

## 📋 SESSION #31 EXECUTION CHECKLIST

### Pre-Session Setup (10 mins)
- [ ] Review Session #30 CLAUDE.md notes
- [ ] Read this SESSION-31-PREP.md file
- [ ] Verify infrastructure is running (postgres, redis)
- [ ] Check all agents compile (pnpm build)
- [ ] Clear old test data from database

### Phase 1: Validation Agent Testing (60 mins)
- [ ] Create "validation-test" workflow
- [ ] Monitor init → scaffold → validation progression
- [ ] Verify working_directory in validation task payload
- [ ] Check validation agent logs for file discovery
- [ ] Confirm validation checks execute
- [ ] Verify validation result structure
- [ ] Document any issues found

### Phase 2: E2E Agent Testing (90 mins)
- [ ] Create "e2e-pipeline-test" workflow
- [ ] Monitor full pipeline progression
- [ ] Verify context passing through all stages
- [ ] Check e2e agent receives correct payload
- [ ] Confirm test file generation
- [ ] Verify test execution logs
- [ ] Document test results

### Phase 3: Gap Analysis & Documentation (60 mins)
- [ ] Review all agent logs for errors
- [ ] List missing context fields
- [ ] Document error handling gaps
- [ ] Create Session #32 recommendations
- [ ] Update CLAUDE.md with findings
- [ ] Commit any fixes made during testing

---

## 🔍 KNOWN ISSUES & WORKAROUNDS

### Issue 1: JSON Parsing Errors (Session #28)
**Status:** Non-blocking, fallback to templates works
**Workaround:** Multi-strategy parser handles most cases
**Monitor:** Watch for parse failures in logs

### Issue 2: Stage Progression Logic (Session #22)
**Status:** Partially resolved, may still skip stages
**Workaround:** Enhanced logging tracks transitions
**Monitor:** Check nextStage computation in logs

### Issue 3: Redis Triple-Fire (Session #24)
**Status:** Fixed via event deduplication
**Workaround:** N/A (fixed)
**Monitor:** Should not see duplicate stage transitions

---

## 📊 SUCCESS METRICS

### Minimum Success Criteria (Must Achieve)
- ✅ Validation agent executes checks on generated files
- ✅ Workflow progresses to at least validation stage
- ✅ Context passing works (working_directory present)
- ✅ No TypeScript compilation errors

### Target Success Criteria (Should Achieve)
- ✅ Workflow progresses to e2e_testing stage
- ✅ E2E agent generates test files
- ✅ All stage transitions logged correctly
- ✅ Error handling works gracefully

### Stretch Goals (Nice to Have)
- ✅ Complete pipeline: init → scaffold → validation → e2e → integration → deploy
- ✅ All agents execute successfully
- ✅ Generated code passes validation
- ✅ Tests execute (even if some fail)

---

## 🎓 KEY LEARNINGS FROM SESSION #30

### What Worked Well
1. **Database-backed context:** stage_outputs JSONB field is flexible and queryable
2. **Stage-specific extraction:** extractStageOutput() handles different stage types cleanly
3. **Payload building:** buildStagePayload() creates proper context for each stage
4. **Incremental approach:** Small, testable changes with verification at each step

### What to Watch For
1. **Path construction:** Ensure working_directory matches actual filesystem paths
2. **Context completeness:** Check all agents have required fields
3. **Error scenarios:** Test what happens when validation fails
4. **State consistency:** Verify database matches state machine state

### Technical Decisions
1. **JSONB for outputs:** Flexible, queryable, no schema changes needed per stage
2. **Centralized extraction:** Single method handles all stage types
3. **Defensive coding:** Check for missing fields, log warnings
4. **Progressive testing:** Test each stage independently before full pipeline

---

## 🚀 SESSION #31 EXECUTION PLAN

### Timeline (3-4 hours)
```
00:00 - 00:10  Setup & review
00:10 - 01:10  Phase 1: Validation agent testing
01:10 - 02:40  Phase 2: E2E pipeline testing
02:40 - 03:40  Phase 3: Gap analysis & documentation
03:40 - 04:00  Wrap-up & CLAUDE.md update
```

### Decision Points
1. **If validation fails to find files:** Debug path construction, may need Session #32
2. **If e2e never triggers:** Check stage progression logic, may need fixes
3. **If tests found, move to integration:** Continue pipeline testing
4. **If tests blocked, stop here:** Focus on fixing validation → e2e handoff

---

## 📝 SESSION #32 PLANNING (Tentative)

### If Session #31 Succeeds
**Focus:** Integration and deployment stages
**Estimate:** 2-3 hours
**Goals:**
- Test integration agent execution
- Verify deployment agent container creation
- Complete full pipeline end-to-end

### If Session #31 Partially Succeeds
**Focus:** Fix identified gaps
**Estimate:** 3-4 hours
**Goals:**
- Fix validation agent issues
- Improve context passing
- Enhance error handling

### If Session #31 Reveals Major Issues
**Focus:** Architectural fixes
**Estimate:** 4-6 hours
**Goals:**
- Refactor context passing mechanism
- Improve agent communication patterns
- Add comprehensive error recovery

---

## 🔗 REFERENCE LINKS

### Code Files
- **Orchestrator:** `/Users/Greg/Projects/apps/zyp/agent-sdlc/packages/orchestrator/src/services/workflow.service.ts`
- **State Machine:** `/Users/Greg/Projects/apps/zyp/agent-sdlc/packages/orchestrator/src/state-machine/workflow-state-machine.ts`
- **Validation Agent:** `/Users/Greg/Projects/apps/zyp/agent-sdlc/packages/agents/validation-agent/src/validation-agent.ts`
- **E2E Agent:** `/Users/Greg/Projects/apps/zyp/agent-sdlc/packages/agents/e2e-agent/src/e2e-agent.ts`

### Documentation
- **CLAUDE.md:** Main session tracking file
- **SESSION-30 Notes:** Context passing implementation details
- **SESSION-29 Notes:** Multi-agent integration findings
- **PIPELINE-TESTING-FRAMEWORK.md:** Test infrastructure guide

### Database Schema
```sql
-- Workflow table (relevant fields)
CREATE TABLE "Workflow" (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  current_stage TEXT NOT NULL,
  status TEXT NOT NULL,
  progress_percentage INTEGER DEFAULT 0,
  stage_outputs JSONB DEFAULT '{}'::JSONB,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## ✅ READY TO START SESSION #31

**All prerequisites complete:**
- ✅ Infrastructure documented and ready
- ✅ Test plan created with clear objectives
- ✅ Success criteria defined
- ✅ Failure modes identified
- ✅ Commands prepared for execution
- ✅ Database queries ready for debugging
- ✅ Log monitoring commands prepared

**Start Session #31 by running:**
```bash
cd /Users/Greg/Projects/apps/zyp/agent-sdlc
./scripts/env/start-dev.sh
# Then start agents in separate terminals
```

**Questions to answer during session:**
1. Does validation agent successfully find generated files?
2. Do validation checks execute correctly?
3. Does workflow progress to e2e_testing stage?
4. Does e2e agent generate test files?
5. What context is missing between stages?
6. How should errors be handled?

---

**END OF SESSION #31 PREP**
