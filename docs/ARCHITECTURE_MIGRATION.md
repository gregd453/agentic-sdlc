# Architecture Migration Guide

Guide for migrating existing systems to the Agentic SDLC multi-platform architecture.

## Overview

This guide helps teams transition from single-platform systems to the multi-platform Agentic SDLC architecture while maintaining **100% backward compatibility** and **zero downtime**.

## Key Principle: Legacy-Platform Strategy

The system uses a **legacy-platform** that automatically routes all existing workflows:

```
Existing System → Legacy Platform → Familiar Stage Sequence
    (App, Feature, Bugfix)          (scaffold, validation, e2e, integration, deployment)
                ↓
          New Platforms
     (Web Apps, Data Pipelines, Infrastructure)
```

**This means:** Existing workflows continue working without modification!

## Phase 1: Assessment (2 hours)

### 1.1 Understand Current Workflow Types

Identify your existing workflow types:

```bash
# List all workflows
curl http://localhost:3000/api/v1/workflows

# Analyze workflow types
# Count by type (app, feature, bugfix)
curl http://localhost:3000/api/v1/workflows | jq '.[] | .type' | sort | uniq -c
```

Document:
- ✅ Workflow types currently in use
- ✅ Average workflows per type per day
- ✅ Critical vs. non-critical workflows
- ✅ Custom integrations or dependencies

### 1.2 Identify New Platform Needs

Ask:
- What platforms would benefit from custom workflows?
- What stages are truly platform-specific?
- Which agents need platform scoping?

Example mapping:

```
Current App Type → Future Platforms
├─ "app" → Web Apps (8 stages)
├─ "feature" → Web Apps (5 stages)
├─ "bugfix" → Web Apps (3 stages)
├─ Mobile Workflows → Mobile Platform
└─ Data Jobs → Data Pipelines
```

## Phase 2: Implementation Planning (1 hour)

### 2.1 Migration Timeline

**Option A: Gradual Migration** (Recommended)
- Week 1: Set up new platforms alongside legacy
- Week 2-3: Route 10% of traffic to new platforms
- Week 4: Route 50% of traffic to new platforms
- Week 5: Route 100% to new platforms, keep legacy as fallback

**Option B: Immediate Migration**
- Week 1: Define all platforms
- Week 1: Deploy all platforms
- Week 2: Switch 100% traffic

### 2.2 Rollback Strategy

Always have a rollback plan:

```bash
# If new platform fails, revert to legacy
# 1. Disable platform in config
# 2. All new workflows route to legacy
# 3. Zero downtime due to definition-driven routing
```

## Phase 3: Database Migration (4 hours)

The system adds 3 new tables (non-breaking):

```sql
-- New tables (created automatically by Prisma migration)
CREATE TABLE Platform (
  id UUID PRIMARY KEY,
  name String UNIQUE,
  layer String,
  config JSON,
  created_at DateTime
);

CREATE TABLE WorkflowDefinition (
  id UUID PRIMARY KEY,
  platform_id UUID,
  name String,
  definition JSON,
  created_at DateTime
);

CREATE TABLE PlatformSurface (
  id UUID PRIMARY KEY,
  platform_id UUID,
  surface_type String,
  config JSON,
  created_at DateTime
);

-- Modified tables (new nullable columns)
ALTER TABLE Workflow ADD COLUMN platform_id UUID (nullable);
ALTER TABLE Workflow ADD COLUMN workflow_definition_id UUID (nullable);
ALTER TABLE Workflow ADD COLUMN surface_id UUID (nullable);
ALTER TABLE Workflow ADD COLUMN input_data JSON (nullable);
ALTER TABLE Workflow ADD COLUMN layer String (nullable);

ALTER TABLE AgentTask ADD COLUMN platform_id UUID (nullable);
```

### Migration Steps

```bash
# 1. Backup database
pg_dump production_db > backup.sql

# 2. Run Prisma migration
pnpm db:migrate

# 3. Seed legacy platform
pnpm db:seed

# 4. Verify migration
SELECT COUNT(*) FROM Platform;  -- Should be >= 1

# 5. Test old workflows still work
curl http://localhost:3000/api/v1/workflows --oldest-first
```

## Phase 4: Platform Rollout (1-2 weeks)

### 4.1 Deploy First Platform

```bash
# 1. Create platform config
configs/platforms/my-platform.yml

# 2. Create workflow definitions
definitions/workflows/my-platform-*.yml

# 3. Deploy code changes
git commit -m "feat: Add my-platform"
git push

# 4. Restart services
./scripts/env/stop-dev.sh
./scripts/env/start-dev.sh

# 5. Verify platform loads
curl http://localhost:3000/api/v1/platforms/my-platform

# 6. Test workflow creation
curl -X POST http://localhost:3000/api/v1/workflows \
  -d '{"name":"Test","type":"app","platform_id":"my-platform"}'
```

### 4.2 Route Traffic Incrementally

```typescript
// In SurfaceRouter or PlatformSelector

// Week 1: 0% → new platform, 100% → legacy
const determinePlatform = (input: WorkflowRequest): string => {
  return 'legacy-platform'  // All traffic to legacy
}

// Week 2: 10% → new platform
const determinePlatform = (input: WorkflowRequest): string => {
  if (Math.random() < 0.1 && isCompatible(input)) {
    return 'my-platform'
  }
  return 'legacy-platform'
}

// Week 3: 50% → new platform
const determinePlatform = (input: WorkflowRequest): string => {
  if (Math.random() < 0.5 && isCompatible(input)) {
    return 'my-platform'
  }
  return 'legacy-platform'
}

// Week 4: 100% → new platform
const determinePlatform = (input: WorkflowRequest): string => {
  if (isCompatible(input)) {
    return 'my-platform'
  }
  return 'legacy-platform'  // Only as fallback
}

function isCompatible(input: WorkflowRequest): boolean {
  // Platform compatibility check
  return input.type === 'app'
}
```

### 4.3 Monitor Migration

```bash
# Dashboard monitoring (port 3001)
# - View platform distribution in analytics
# - Monitor success rates by platform
# - Check error rates

# Log monitoring
pnpm pm2:logs | grep -E "platform|routing|error"

# Metrics query
curl http://localhost:3002/api/v1/stats/workflows?by=platform
```

## Phase 5: Agent Migration (Optional)

If you have custom agents that depend on platform-specific logic:

### 5.1 Extend BaseAgent for Platform Context

```typescript
// Update your agents to support platform context

async processTask(envelope: AgentEnvelope): Promise<AgentEnvelope> {
  const platformId = envelope.metadata.platform_id

  if (platformId === 'my-platform') {
    // Platform-specific logic
    return this.processMyPlatform(envelope)
  }

  // Fallback for legacy platform
  return this.processLegacy(envelope)
}
```

### 5.2 Register Platform-Scoped Agents

```typescript
agentRegistry.register({
  name: 'my-platform-scaffold-agent',
  version: '1.0.0',
  type: 'scaffold',
  platform: 'my-platform',  // Platform-scoped!
  instance: agent
})
```

## Phase 6: Validation (1 week)

### 6.1 Test Suite

```bash
# Run comprehensive tests
pnpm test

# Check coverage
pnpm test:coverage

# Verify all platforms work
pnpm test platforms

# Verify migration doesn't break legacy
pnpm test legacy-platform
```

### 6.2 Production Validation

```bash
# 1. Smoke tests in production
curl -X POST http://prod-api.example.com/api/v1/workflows \
  -d '{"name":"Migration Test","type":"app"}'

# 2. Monitor error rates
# Error rate should remain < 0.5%

# 3. Check latency
# p95 latency should be < 500ms

# 4. Verify trace IDs
# All workflows should have unique trace IDs

# 5. Confirm analytics
# Dashboard should show workflow distribution by platform
```

## Migration Checklist

### Pre-Migration
- [ ] Backup production database
- [ ] Document current workflow types
- [ ] Define new platforms to add
- [ ] Create migration timeline
- [ ] Prepare rollback plan

### Database Migration
- [ ] Run Prisma migrations
- [ ] Seed legacy platform
- [ ] Verify migration success
- [ ] Test old workflows still work

### Code Deployment
- [ ] Create platform configs
- [ ] Create workflow definitions
- [ ] Update routing logic
- [ ] Register new agents (if any)
- [ ] Run full test suite
- [ ] Code review and approval

### Production Rollout
- [ ] Deploy to staging environment
- [ ] Run smoke tests in staging
- [ ] Monitor staging metrics
- [ ] Deploy to production (low-traffic first)
- [ ] Monitor production metrics
- [ ] Gradually increase traffic percentage
- [ ] Monitor error rates and latency

### Post-Migration
- [ ] Verify all platforms working
- [ ] Review analytics dashboard
- [ ] Document lessons learned
- [ ] Clean up legacy code (if not needed)
- [ ] Train team on new system

## Common Migration Issues

### Issue 1: Workflows Not Routing to New Platform

**Symptom:** All workflows route to legacy platform

**Solution:**
```bash
# 1. Check platform is loaded
curl http://localhost:3000/api/v1/platforms

# 2. Verify routing logic
# In SurfaceRouter, check determinePlatform() function

# 3. Check workflow type matches
curl http://localhost:3000/api/v1/workflows \
  -X POST \
  -d '{"name":"test","type":"app","platform_id":"my-platform"}'
```

### Issue 2: Agent Not Processing Platform Tasks

**Symptom:** Workflows stuck in `scaffold:started`

**Solution:**
```bash
# 1. Verify agent is registered
curl http://localhost:3000/api/v1/agents | jq '.[] | select(.platform == "my-platform")'

# 2. Check agent logs
pnpm pm2:logs | grep "my-platform-agent"

# 3. Verify message bus connectivity
redis-cli -n 0 KEYS "agent:*"
```

### Issue 3: Database Migration Fails

**Symptom:** `Prisma migration error`

**Solution:**
```bash
# 1. Check Prisma status
pnpm prisma migrate status

# 2. Rollback if needed
pnpm prisma migrate resolve --rolled-back

# 3. Re-run migration
pnpm prisma migrate deploy
```

## Rollback Procedure

If migration causes issues:

```bash
# 1. Disable new platform in config
# Set enabled: false in platform YAML

# 2. Restart services
./scripts/env/stop-dev.sh
./scripts/env/start-dev.sh

# 3. All new workflows route to legacy platform
# (Zero downtime!)

# 4. Fix issues
# ...update code...

# 5. Re-enable platform and re-deploy
```

## Success Criteria

Migration is successful when:

- ✅ All workflows complete successfully
- ✅ Error rate remains < 0.5%
- ✅ Latency remains < 500ms p95
- ✅ Both legacy and new platforms operational
- ✅ All tests passing (100+ tests)
- ✅ Dashboard shows correct metrics
- ✅ Team is trained and confident

## Post-Migration Cleanup

After successful migration:

```bash
# 1. Update documentation
# Reference new platforms in runbooks

# 2. Archive old configs
# git mv legacy-specific configs to archive/

# 3. Monitor for 2 weeks
# No performance degradation should occur

# 4. Team training
# Ensure team knows how to operate new system

# 5. Update on-call runbooks
# Include new platform troubleshooting
```

## Resources

- **Platform Onboarding:** [PLATFORM_ONBOARDING.md](./PLATFORM_ONBOARDING.md)
- **Platform Templates:** [PLATFORM_DEFINITION_TEMPLATE.md](./templates/PLATFORM_DEFINITION_TEMPLATE.md)
- **Strategic Architecture:** [STRATEGIC-ARCHITECTURE.md](../STRATEGIC-ARCHITECTURE.md)
- **System Runbook:** [AGENTIC_SDLC_RUNBOOK.md](../AGENTIC_SDLC_RUNBOOK.md)

## Support

- **Questions?** Check [CLAUDE.md](../CLAUDE.md)
- **Troubleshooting?** See [AGENTIC_SDLC_RUNBOOK.md](../AGENTIC_SDLC_RUNBOOK.md)
- **Architecture Details?** See [STRATEGIC-ARCHITECTURE.md](../STRATEGIC-ARCHITECTURE.md)

---

**Last Updated:** 2025-11-16 | **Status:** Production Ready | **Backward Compatibility:** 100%
