# Workflow Migration Guide

**Version:** 1.0.0
**Last Updated:** 2025-11-22
**Target Audience:** Platform developers migrating from hard-coded workflows to workflow definitions

---

## Table of Contents

1. [Why Migrate?](#why-migrate)
2. [Pre-Migration Checklist](#pre-migration-checklist)
3. [Migration Process](#migration-process)
4. [Step-by-Step Guide](#step-by-step-guide)
5. [Testing Migrated Workflows](#testing-migrated-workflows)
6. [Rollback Procedure](#rollback-procedure)
7. [FAQ](#faq)
8. [Troubleshooting](#troubleshooting)

---

## Why Migrate?

### Benefits of Definition-Driven Workflows

**Before (Hard-coded):**
```typescript
// Hard-coded in WorkflowStateMachine
switch (currentStage) {
  case 'scaffold':
    return 'validation';
  case 'validation':
    return 'e2e_test';
  case 'e2e_test':
    return 'deployment';
  case 'deployment':
    return 'END';
}
```

**After (Definition-driven):**
```json
{
  "stages": [
    { "name": "scaffold", "on_success": "validation" },
    { "name": "validation", "on_success": "e2e_test" },
    { "name": "e2e_test", "on_success": "deployment" },
    { "name": "deployment", "on_success": "END" }
  ]
}
```

**Advantages:**
- ✅ **Change workflows without code changes** - Update definitions via API
- ✅ **Platform-specific workflows** - Different workflows for different platforms
- ✅ **A/B testing** - Run multiple workflow variants simultaneously
- ✅ **Versioning** - Track workflow changes over time
- ✅ **Custom routing** - Conditional logic (on_success, on_failure)
- ✅ **Non-developers can modify** - Use dashboard UI to edit workflows
- ✅ **Unlimited agent types** - No enum restrictions

### When to Migrate

**Migrate if:**
- ✅ You need different workflows for different platforms
- ✅ You want to change stage sequences without redeployment
- ✅ You need custom agent types (ml-training, data-validation, etc.)
- ✅ You want conditional routing (skip stages on success/failure)
- ✅ You want to experiment with workflow variants

**Don't migrate if:**
- ❌ You have a single, unchanging workflow
- ❌ Your workflow is extremely simple (1-2 stages)
- ❌ You don't need platform-specific customization

---

## Pre-Migration Checklist

### Before You Begin

**1. Understand Current Workflow**
- [ ] Document current hard-coded stage sequence
- [ ] List all agent types used
- [ ] Note any special routing logic
- [ ] Identify timeout and retry configurations

**2. Verify Platform Setup**
- [ ] Platform exists in database
- [ ] All agents registered in AgentRegistry
- [ ] Agents associated with correct platform
- [ ] API access configured

**3. Backup Current System**
- [ ] Database backup created
- [ ] Current code committed to version control
- [ ] Document current behavior for comparison

**4. Review Dependencies**
- [ ] All agents referenced in workflow exist
- [ ] Agents are enabled and healthy
- [ ] No typos in agent_type names

**5. Plan Testing**
- [ ] Staging environment available
- [ ] Test workflows prepared
- [ ] Success criteria defined

---

## Migration Process

### Overview

```
┌─────────────────────────────────────────────────────────────┐
│ Phase 1: Document Current Workflow                          │
│  → Map hard-coded stages to definition structure            │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ Phase 2: Create Workflow Definition                         │
│  → Convert to JSON/YAML                                     │
│  → Add timeouts, retries, routing                           │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ Phase 3: Test in Staging                                    │
│  → Create definition via API                                │
│  → Run test workflows                                       │
│  → Verify behavior matches legacy                           │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ Phase 4: Deploy to Production                               │
│  → Create definition in production                          │
│  → Gradual rollout (10% → 50% → 100%)                       │
│  → Monitor error rates                                      │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ Phase 5: Cleanup (Optional)                                 │
│  → Remove hard-coded workflow logic                         │
│  → Update documentation                                     │
│  → Deprecate old workflows                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Step-by-Step Guide

### Step 1: Document Current Hard-Coded Workflow

**Find your current workflow logic:**

Typical locations:
- `packages/orchestrator/src/services/workflow-state-machine.service.ts`
- `packages/orchestrator/src/services/workflow.service.ts`
- Custom platform services

**Example hard-coded workflow:**

```typescript
// In WorkflowStateMachineService
private getNextStageLegacy(currentStage: string, outcome: 'success' | 'failure'): string {
  if (outcome === 'failure') {
    return 'fail_workflow';
  }

  switch (currentStage) {
    case 'orchestrator:workflow:created':
      return 'scaffold';
    case 'scaffold':
      return 'validation';
    case 'validation':
      return 'e2e_test';
    case 'e2e_test':
      return 'deployment';
    case 'deployment':
      return 'END';
    default:
      return 'fail_workflow';
  }
}
```

**Document in table format:**

| Current Stage | On Success | On Failure | Agent Type | Timeout | Retries |
|--------------|-----------|-----------|-----------|---------|---------|
| orchestrator:workflow:created | scaffold | fail_workflow | scaffold | 300000 | 3 |
| scaffold | validation | fail_workflow | validation | 300000 | 3 |
| validation | e2e_test | fail_workflow | e2e_test | 600000 | 2 |
| e2e_test | deployment | fail_workflow | deployment | 600000 | 1 |
| deployment | END | fail_workflow | deployment | 900000 | 1 |

---

### Step 2: Convert to Workflow Definition

**Create workflow definition JSON:**

```json
{
  "name": "legacy-workflow",
  "version": "1.0.0",
  "description": "Migrated from hard-coded workflow logic",
  "enabled": true,
  "definition": {
    "name": "legacy-workflow",
    "version": "1.0.0",
    "stages": [
      {
        "name": "scaffold",
        "agent_type": "scaffold",
        "timeout_ms": 300000,
        "max_retries": 3,
        "on_success": "validation",
        "on_failure": "fail_workflow",
        "config": {}
      },
      {
        "name": "validation",
        "agent_type": "validation",
        "timeout_ms": 300000,
        "max_retries": 3,
        "on_success": "e2e_test",
        "on_failure": "fail_workflow",
        "config": {}
      },
      {
        "name": "e2e_test",
        "agent_type": "e2e_test",
        "timeout_ms": 600000,
        "max_retries": 2,
        "on_success": "deployment",
        "on_failure": "fail_workflow",
        "config": {}
      },
      {
        "name": "deployment",
        "agent_type": "deployment",
        "timeout_ms": 900000,
        "max_retries": 1,
        "on_success": "END",
        "on_failure": "fail_workflow",
        "config": {}
      }
    ],
    "metadata": {
      "author": "migration-script",
      "migrated_from": "hard-coded",
      "migration_date": "2025-11-22"
    }
  }
}
```

**Validation checklist:**
- [ ] All stages from hard-coded workflow included
- [ ] Stage names match agent types (lowercase, no prefixes)
- [ ] Timeouts match or exceed original values
- [ ] Retry counts match original configuration
- [ ] Routing logic preserved (on_success, on_failure)
- [ ] First stage is entry point
- [ ] Final stage has `on_success: "END"`

---

### Step 3: Create Definition via API

**Prerequisites:**
- [ ] Orchestrator API running
- [ ] Platform created in database
- [ ] Platform ID obtained

**Create definition:**

```bash
# Set platform ID
export PLATFORM_ID="550e8400-e29b-41d4-a716-446655440000"

# Create workflow definition
curl -X POST http://localhost:3051/api/v1/platforms/${PLATFORM_ID}/workflow-definitions \
  -H "Content-Type: application/json" \
  -d @legacy-workflow.json

# Expected response (201 Created):
{
  "id": "def-abc123",
  "platform_id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "legacy-workflow",
  "version": "1.0.0",
  "enabled": true,
  "created_at": "2025-11-22T10:00:00Z"
}
```

**Verify creation:**

```bash
# List definitions
curl http://localhost:3051/api/v1/platforms/${PLATFORM_ID}/workflow-definitions

# Get specific definition
export DEF_ID="def-abc123"
curl http://localhost:3051/api/v1/workflow-definitions/${DEF_ID}
```

---

### Step 4: Test Migrated Workflow

**Create test workflow:**

```bash
# Create workflow using definition
curl -X POST http://localhost:3051/api/v1/workflows \
  -H "Content-Type: application/json" \
  -d '{
    "platform_id": "'${PLATFORM_ID}'",
    "workflow_type": "feature",
    "workflow_definition_id": "'${DEF_ID}'",
    "metadata": {
      "test": true,
      "description": "Migration test workflow"
    }
  }'

# Expected response:
{
  "id": "wf-test123",
  "workflow_definition_id": "def-abc123",
  "status": "pending",
  "current_stage": "scaffold"
}
```

**Monitor workflow execution:**

```bash
export WORKFLOW_ID="wf-test123"

# Check status
curl http://localhost:3051/api/v1/workflows/${WORKFLOW_ID}

# Watch progress
watch -n 5 "curl -s http://localhost:3051/api/v1/workflows/${WORKFLOW_ID} | jq '.status, .current_stage, .progress'"
```

**Validation criteria:**

- [ ] Workflow starts at correct stage
- [ ] Stages execute in correct order
- [ ] Transitions match legacy workflow
- [ ] Timeouts are respected
- [ ] Retries work correctly
- [ ] Final status is 'completed' or 'failed' (as expected)
- [ ] Progress calculation is accurate

---

### Step 5: Side-by-Side Comparison

**Run both workflows in parallel:**

```bash
# Create legacy workflow (no definition)
curl -X POST http://localhost:3051/api/v1/workflows \
  -d '{
    "platform_id": "'${PLATFORM_ID}'",
    "workflow_type": "feature"
  }'

# Create definition-driven workflow
curl -X POST http://localhost:3051/api/v1/workflows \
  -d '{
    "platform_id": "'${PLATFORM_ID}'",
    "workflow_type": "feature",
    "workflow_definition_id": "'${DEF_ID}'"
  }'

# Compare results
# - Stage sequence should be identical
# - Timing should be similar (± 10%)
# - Final status should match
```

**Comparison checklist:**

| Aspect | Legacy Workflow | Definition Workflow | Match? |
|--------|----------------|---------------------|--------|
| Stage sequence | scaffold → validate → test → deploy | scaffold → validate → test → deploy | ✅ |
| Duration | 15 minutes | 15.2 minutes | ✅ |
| Final status | completed | completed | ✅ |
| Error handling | fail on error | fail on error | ✅ |

---

### Step 6: Gradual Rollout

**Phase 1: 10% Traffic (Day 1)**

```bash
# Create definition-driven workflows for 10% of traffic
# Keep 90% on legacy workflows
# Monitor error rates for 24 hours
```

**Monitoring:**
- [ ] Error rate < 1%
- [ ] No increase in failures
- [ ] Performance acceptable
- [ ] No user complaints

**Phase 2: 50% Traffic (Day 3)**

```bash
# Increase to 50% definition-driven
# Monitor for another 24 hours
```

**Phase 3: 100% Traffic (Day 5)**

```bash
# Switch all workflows to definition-driven
# Keep legacy code as fallback (disabled)
```

---

### Step 7: Cleanup (Optional)

**After successful migration:**

1. **Disable legacy workflow logic:**
   ```typescript
   // In WorkflowDefinitionAdapter.getNextStageWithFallback()
   // Keep getNextStageLegacy() but never call it
   // Or feature-flag it for emergency rollback
   ```

2. **Update documentation:**
   - [ ] Update PLATFORM_ONBOARDING.md
   - [ ] Add migration notes to CHANGELOG.md
   - [ ] Update README with new workflow creation process

3. **Deprecate old workflows:**
   ```bash
   # Mark old workflows as deprecated
   curl -X PATCH http://localhost:3051/api/v1/workflow-definitions/${OLD_DEF_ID}/enabled \
     -d '{"enabled": false}'
   ```

---

## Testing Migrated Workflows

### Test Plan

**1. Unit Tests (Definition Validation)**

```bash
# Test definition structure
curl -X POST http://localhost:3051/api/v1/platforms/${PLATFORM_ID}/workflow-definitions \
  -d @test-definition.json

# Verify validation errors are caught
# - Circular dependencies
# - Invalid agent types
# - Invalid on_success references
```

**2. Integration Tests (Workflow Execution)**

```bash
# Create test workflow
curl -X POST http://localhost:3051/api/v1/workflows \
  -d '{
    "platform_id": "'${PLATFORM_ID}'",
    "workflow_definition_id": "'${DEF_ID}'"
  }'

# Verify execution
# - All stages execute in order
# - Transitions work correctly
# - Error handling is correct
```

**3. Performance Tests**

```bash
# Create 10 parallel workflows
for i in {1..10}; do
  curl -X POST http://localhost:3051/api/v1/workflows \
    -d '{"platform_id": "'${PLATFORM_ID}'", "workflow_definition_id": "'${DEF_ID}'"}' &
done

# Monitor:
# - Average completion time
# - CPU/memory usage
# - Database query performance
```

**4. Failure Tests**

```bash
# Test error handling
# - Agent timeout
# - Agent failure
# - Network errors
# - Database errors

# Verify:
# - Retries work correctly
# - Workflow fails gracefully
# - Error messages are clear
```

---

## Rollback Procedure

### If Migration Fails

**Immediate Rollback:**

```bash
# Option 1: Disable definition
curl -X PATCH http://localhost:3051/api/v1/workflow-definitions/${DEF_ID}/enabled \
  -d '{"enabled": false}'

# Option 2: Delete definition
curl -X DELETE http://localhost:3051/api/v1/workflow-definitions/${DEF_ID}

# Workflows automatically fall back to legacy logic
# (WorkflowDefinitionAdapter.getNextStageLegacy())
```

**Restore Database (if needed):**

```bash
# Stop orchestrator
pnpm pm2:stop orchestrator

# Restore database backup
psql -h localhost -p 5433 -U agentic agentic_sdlc < backup.sql

# Restart orchestrator
pnpm pm2:start orchestrator
```

**Rollback Code Changes (if cleanup was done):**

```bash
# Revert Git commits
git revert <commit-hash>

# Rebuild orchestrator
turbo run build --filter=@agentic-sdlc/orchestrator

# Restart services
./dev restart
```

---

## FAQ

### Q: Will existing workflows be affected?

**A:** No. Active workflows continue using their current routing logic. Only new workflows created after migration use the definition.

---

### Q: Can I run both legacy and definition-driven workflows simultaneously?

**A:** Yes! The platform supports both. Workflows without a `workflow_definition_id` use legacy logic (fallback).

---

### Q: What happens if I delete a workflow definition?

**A:** Active workflows using that definition continue executing. New workflows cannot use the deleted definition.

---

### Q: Can I update a definition while workflows are running?

**A:** Yes, but running workflows use the definition version they started with. Only new workflows use the updated definition.

---

### Q: Do I need to change agent code?

**A:** No. Agents remain unchanged. Only workflow orchestration logic changes.

---

### Q: What if I need to change the workflow mid-execution?

**A:** You can't change a running workflow's definition. Create a new definition and use it for new workflows.

---

### Q: Can I A/B test workflows?

**A:** Yes! Create two definitions (e.g., "workflow-v1", "workflow-v2") and route traffic to each.

---

### Q: How do I version workflow definitions?

**A:** Use semantic versioning in the `version` field (e.g., "1.0.0", "1.1.0"). Create new definitions for major changes.

---

## Troubleshooting

### Issue: Workflow doesn't use definition

**Symptoms:**
- Workflow created with `workflow_definition_id` but uses legacy routing
- Definition ID appears in workflow record but is ignored

**Causes:**
- Definition is disabled
- Definition doesn't exist
- WorkflowDefinitionAdapter not configured

**Solution:**

```bash
# Check definition exists and is enabled
curl http://localhost:3051/api/v1/workflow-definitions/${DEF_ID}

# Enable if disabled
curl -X PATCH http://localhost:3051/api/v1/workflow-definitions/${DEF_ID}/enabled \
  -d '{"enabled": true}'

# Check orchestrator logs
pnpm pm2:logs orchestrator | grep -i "definition"
```

---

### Issue: Stage sequence is wrong

**Symptoms:**
- Workflow executes stages in unexpected order
- Skips stages
- Loops infinitely

**Causes:**
- Incorrect `on_success` references
- Circular dependencies
- Missing stages

**Solution:**

```bash
# Validate definition structure
curl http://localhost:3051/api/v1/workflow-definitions/${DEF_ID}

# Check for:
# - on_success points to existing stage or 'END'
# - No circular references (A → B → A)
# - All required stages present

# Fix definition
curl -X PUT http://localhost:3051/api/v1/workflow-definitions/${DEF_ID} \
  -d @fixed-definition.json
```

---

### Issue: Workflow fails immediately

**Symptoms:**
- Workflow status changes to 'failed' at start
- No tasks created
- Error message about agent not found

**Causes:**
- Invalid `agent_type` in definition
- Agent not registered for platform
- Typo in agent type name

**Solution:**

```bash
# List available agents
curl http://localhost:3051/api/v1/platforms/${PLATFORM_ID}/agents

# Check definition for typos
curl http://localhost:3051/api/v1/workflow-definitions/${DEF_ID} | jq '.definition.stages[].agent_type'

# Fix agent_type in definition
curl -X PUT http://localhost:3051/api/v1/workflow-definitions/${DEF_ID} \
  -d @fixed-definition.json
```

---

### Issue: Progress calculation is wrong

**Symptoms:**
- Progress shows 50% but only 1 of 5 stages complete
- Progress jumps unexpectedly
- Progress never reaches 100%

**Causes:**
- Legacy progress calculation doesn't account for stage count
- Definition has unexpected number of stages

**Solution:**

**Adaptive progress is automatic!** Progress = (completed_stages / total_stages) * 100

No action needed. Verify definition has correct number of stages.

---

## Migration Success Checklist

**Before declaring migration complete:**

- [ ] All test workflows complete successfully
- [ ] Stage sequence matches legacy behavior
- [ ] Error handling works correctly
- [ ] Performance is acceptable (± 10% of legacy)
- [ ] No increase in error rates
- [ ] Monitoring dashboards show healthy metrics
- [ ] Documentation updated
- [ ] Team trained on new workflow creation process
- [ ] Rollback procedure tested and documented
- [ ] Legacy code deprecated or removed

---

## Additional Resources

**Documentation:**
- [Workflow Definition Guide](./WORKFLOW_DEFINITION_GUIDE.md) - Comprehensive guide
- [Platform Onboarding Guide](./PLATFORM_ONBOARDING.md) - Creating platforms
- [Agent Creation Guide](./AGENT_CREATION_GUIDE.md) - Custom agents
- [Surface Architecture V3](./SURFACE-ARCH-V3.md) - Architecture overview

**Templates:**
- [Generic Workflow Template](./templates/workflow-definition.yaml)
- [Web App Workflow Template](./templates/web-app-workflow.yaml)
- [Data Pipeline Workflow Template](./templates/data-pipeline-workflow.yaml)

**API Reference:**
- [Workflow Definition API](./WORKFLOW_DEFINITION_GUIDE.md#api-reference)
- [Orchestrator API](../packages/orchestrator/README.md)

**Support:**
- GitHub Issues: [agentic-sdlc/issues](https://github.com/gregd453/agentic-sdlc/issues)
- Internal Wiki: [Platform Migration](https://wiki.example.com/platform-migration)

---

**END OF MIGRATION GUIDE**

**Version:** 1.0.0
**Last Updated:** 2025-11-22
**Maintained by:** Platform Team

**Migration support:** platform-team@example.com
