# Next Session Plan - Session #53: Phase 1 Implementation

## Objective
Replace `AgentDispatcherService` with `OrchestratorContainer` - the first step toward event-driven architecture.

**Estimated Duration:** 1 hour
**Complexity:** Low (isolated bootstrap changes)
**Risk Level:** Low (no impact on agents or core logic)

---

## What We're Doing

### Current State (Callback-Based)
```
server.ts
  └─ new AgentDispatcherService(redisUrl)
  └─ new WorkflowService(..., agentDispatcher)
     └─ agentDispatcher.onResult() per workflow
     └─ Handler deleted after first result
     └─ Workflows hang at stage 2+
```

### Target State (Container-Based)
```
server.ts
  └─ new OrchestratorContainer({...})
  └─ await container.initialize()
  └─ const messageBus = container.getBus()
  └─ const kvStore = container.getKV()
  └─ new WorkflowService(..., messageBus)
     └─ Single subscription to 'agent:results'
     └─ Handlers persist lifetime
     └─ Workflows complete all 6 stages
```

---

## Exact Changes Required

### File 1: `packages/orchestrator/src/server.ts`

**Find this section (~line 40-50):**
```typescript
const agentDispatcher = new AgentDispatcherService(redisUrl);

const workflowService = new WorkflowService(
  workflowRepository,
  eventBus,
  stateMachineService,
  agentDispatcher
);
```

**Replace with:**
```typescript
import { OrchestratorContainer } from './hexagonal';

// Initialize container
const container = new OrchestratorContainer({
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6380',
  redisNamespace: 'agentic-sdlc',
  redisDefaultTtl: 86400,
  coordinators: { plan: true }
});

await container.initialize();
logger.info('✅ OrchestratorContainer initialized');

const messageBus = container.getBus();
const kvStore = container.getKV();

const workflowService = new WorkflowService(
  workflowRepository,
  eventBus,
  stateMachineService,
  messageBus  // ← Changed from agentDispatcher
);

logger.info('✅ WorkflowService initialized with message bus');
```

**Also add shutdown hook:**
```typescript
// Add to fastify close hook
fastify.addHook('onClose', async () => {
  logger.info('Shutting down OrchestratorContainer...');
  await container.shutdown();
  logger.info('OrchestratorContainer shut down');
});
```

### File 2: `packages/orchestrator/src/services/workflow.service.ts`

**Update constructor (~line 20):**
```typescript
// BEFORE:
constructor(
  private repository: WorkflowRepository,
  private eventBus: EventBus,
  private stateMachineService: WorkflowStateMachineService,
  private agentDispatcher?: AgentDispatcherService,  // ← Remove
  redisUrl: string = process.env.REDIS_URL || 'redis://127.0.0.1:6379'
)

// AFTER:
constructor(
  private repository: WorkflowRepository,
  private eventBus: EventBus,
  private stateMachineService: WorkflowStateMachineService,
  private messageBus: IMessageBus,  // ← Changed from agentDispatcher
  redisUrl: string = process.env.REDIS_URL || 'redis://127.0.0.1:6379'
)
```

**Update imports to add:**
```typescript
import { IMessageBus } from '../hexagonal/ports/message-bus.port';
```

**Remove import:**
```typescript
// DELETE this line:
import { AgentDispatcherService } from './agent-dispatcher.service';
```

### File 3: Update type signature in `createTaskForStage()`

**Find:** (~line 350-360)
```typescript
if (this.agentDispatcher) {
  this.agentDispatcher.onResult(workflowId, async (result) => {
    await this.handleAgentResult(result);
  });

  await this.agentDispatcher.dispatchTask(envelope, workflowData);
}
```

**Replace with:**
```typescript
// For now, still use dispatcher to publish task
// (Phase 3 will change this to messageBus.publish)
// We'll update this in Phase 3
await this.messageBus.publish(
  `agent:tasks:${agentType}`,
  envelope
);
```

**Note:** The actual message bus publishing of tasks will happen in Phase 3. For Phase 1, we're just replacing the initialization.

---

## What Will Still Be There (Not Touching Yet)

✅ **Agent publishing** - Agents still publish via redis.publish() (Phase 3)
✅ **State machine** - Still manually invoked (Phase 4)
✅ **Handler callbacks** - Still used to process results (Phase 2)
✅ **Validation** - Still at both boundaries (Phase 5 enhancement)

**We're ONLY changing the bootstrap/initialization in Phase 1.**

---

## Testing Checklist

After making changes, verify:

```bash
# 1. Build succeeds
npm run build
# Expected: All 12 packages successful

# 2. Start development server
npm run dev
# Expected:
#   ✓ OrchestratorContainer initialized
#   ✓ Message bus health: OK
#   ✓ KV store health: OK
#   ✓ WorkflowService initialized with message bus
#   ✓ Server listening on port 3000

# 3. Create a workflow
curl -X POST http://localhost:3000/api/v1/workflows \
  -H "Content-Type: application/json" \
  -d '{"type":"app","name":"Test","description":"Test workflow"}'

# Expected:
#   ✓ Workflow created
#   ✓ Response includes workflow_id

# 4. Verify initialization logs
# Look for these in terminal:
#   "OrchestratorContainer initialized"
#   "WorkflowService initialized with message bus"
#   "Agent listening for tasks"
```

---

## If Something Goes Wrong

### Error: "Cannot find module OrchestratorContainer"
**Solution:** Check import path:
```typescript
import { OrchestratorContainer } from './hexagonal';
// or
import { OrchestratorContainer } from './hexagonal/orchestrator.container';
```

### Error: "messageBus is not defined in WorkflowService"
**Solution:** Ensure it's passed in constructor AND type signature updated:
```typescript
constructor(
  ...,
  private messageBus: IMessageBus  // ← Make sure this is here
)
```

### Error: "No handler found for workflow"
**Solution:** This is expected in Phase 1. Handlers are registered in Phase 2.
- If workflow doesn't progress past first stage, that's normal for Phase 1
- We'll fix this in Phase 2

### Workflow creates but doesn't progress
**Solution:** This is expected. Phase 1 is just initialization.
- Actual message bus subscription happens in Phase 2
- For now, results aren't being processed

---

## Success Criteria

- ✅ Build completes without errors
- ✅ Server starts without errors
- ✅ OrchestratorContainer initializes
- ✅ Health checks show bus and KV store healthy
- ✅ Can create workflow via API
- ✅ No AgentDispatcherService in bootstrap code
- ✅ WorkflowService receives messageBus parameter

**You'll know Phase 1 is complete when:**
The application starts, container initializes, and health checks pass - even if workflows don't fully progress yet (that's Phase 2).

---

## Rollback Plan

If Phase 1 causes problems:

1. Revert `server.ts` to use AgentDispatcherService
2. Revert `workflow.service.ts` constructor back to agentDispatcher
3. Restart server
4. Analyze issue before re-attempting

**Git restore command:**
```bash
git checkout packages/orchestrator/src/server.ts
git checkout packages/orchestrator/src/services/workflow.service.ts
```

---

## Dependencies

- ✅ Patch complete (AgentResultSchema compliant)
- ✅ Build passing
- ✅ OrchestratorContainer exists and works
- ✅ IMessageBus interface defined
- ✅ IKVStore interface defined

**No blockers - ready to proceed immediately.**

---

## Time Breakdown

- Understanding scope: 5 min
- Making code changes: 15 min
- Testing: 20 min
- Troubleshooting: 15 min
- Documentation: 5 min

**Total: ~1 hour**

---

## Session #53 Deliverables

1. ✅ OrchestratorContainer wired to bootstrap
2. ✅ AgentDispatcherService removed from initialization
3. ✅ WorkflowService uses messageBus
4. ✅ Health checks passing
5. ✅ Updated CLAUDE.md with Session #53 status
6. ✅ Committed changes to git

---

## Next Steps After Phase 1

- **Phase 2 (Session #54):** Subscribe WorkflowService to message bus
- **Phase 3 (Session #55):** Agents publish to message bus
- **Phase 4 (Session #56):** State machine autonomy
- **Phase 5 (Session #57):** SchemaRegistry integration
- **Phase 6 (Session #58):** Persistence & recovery

---

## Quick Reference: Files to Edit

| File | Lines | Change |
|------|-------|--------|
| `packages/orchestrator/src/server.ts` | 40-50 | Replace AgentDispatcher initialization |
| `packages/orchestrator/src/services/workflow.service.ts` | 20 (constructor) | Change parameter type |
| `packages/orchestrator/src/services/workflow.service.ts` | 6 (imports) | Update imports |
| `packages/orchestrator/src/services/workflow.service.ts` | 350-360 | Update task dispatch call |

**Total lines to change: ~30 lines**
**Total files to modify: 1 (server.ts) + 1 (workflow.service.ts)**

---

**Ready to proceed with Phase 1? ✅**

If you have questions before starting, review:
- `STRATEGIC-DESIGN-REDIS-API-INTEGRATION.md` (Phase 1 section)
- `STRATEGIC-IMPLEMENTATION-ROADMAP.md` (detailed context)
- Architecture diagrams in ARCHITECTURE-JOURNEY-MAP.md

**Start with the exact code changes above - they're ready to implement.**
