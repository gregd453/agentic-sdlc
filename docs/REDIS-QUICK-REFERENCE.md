# Redis Framework - Quick Reference

## 5 Core Components

| Component | Location | Purpose | Exports |
|-----------|----------|---------|---------|
| **RobustRedisSubscriber** | `packages/shared/utils/src/redis-subscription.ts` | Reliable pub/sub with reconnect | `@agentic-sdlc/shared-utils` |
| **EventBus** | `packages/orchestrator/src/events/event-bus.ts` | Event streaming (streams + pub/sub) | Local (orchestrator) |
| **AgentDispatcher** | `packages/orchestrator/src/services/agent-dispatcher.service.ts` | Task distribution & result collection | Local (orchestrator) |
| **BaseAgent** | `packages/agents/base-agent/src/base-agent.ts` | Task consumer & result reporter | `@agentic-sdlc/base-agent` |
| **Constants** | `packages/shared/types/src/constants/pipeline.constants.ts` | Channel names & agent types | `@agentic-sdlc/shared-types` |

---

## Channel Reference

```
orchestrator:results      ← Agents publish results here
agent:scaffold:tasks      ← Orchestrator publishes scaffold tasks
agent:validation:tasks    ← Orchestrator publishes validation tasks
agent:e2e:tasks           ← Orchestrator publishes E2E tasks
agent:integration:tasks   ← Orchestrator publishes integration tasks
agent:deployment:tasks    ← Orchestrator publishes deployment tasks
agent:registry            ← Agents register/heartbeat here
event:STAGE_COMPLETE      ← Workflow events stream
events:STAGE_COMPLETE     ← Workflow events persist here (stream)
```

---

## Code Snippets

### Creating Two Separate Redis Clients (REQUIRED)
```typescript
import Redis from 'ioredis';

const redisUrl = 'redis://localhost:6380';

// Publisher for sending messages
const publisher = new Redis(redisUrl);

// Subscriber for receiving messages
const subscriber = new Redis(redisUrl);

// publisher: Can do ANY operation (publish, set, hgetall, etc)
// subscriber: ONLY subscribe/unsubscribe/message operations
```

### Using RobustRedisSubscriber
```typescript
import { RobustRedisSubscriber } from '@agentic-sdlc/shared-utils';

const subscriber = new Redis('redis://localhost:6380');
const robust = new RobustRedisSubscriber(logger);

await robust.subscribe(subscriber, {
  channels: ['agent:scaffold:tasks'],
  onMessage: async (channel, message) => {
    const task = JSON.parse(message);
    await handleScaffoldTask(task);
  },
  onError: (error) => logger.error('Sub error', error),
  healthCheckIntervalMs: 30000
});
```

### Publishing Event
```typescript
import { REDIS_CHANNELS } from '@agentic-sdlc/shared-types';

const message = {
  id: 'msg-123',
  type: 'task',
  payload: { task_id: 'task-456', ... },
  timestamp: new Date().toISOString(),
  trace_id: 'trace-789'
};

const channel = REDIS_CHANNELS.AGENT_TASKS('scaffold');
await publisher.publish(channel, JSON.stringify(message));
```

### Dispatching Task (Full Example)
```typescript
import { AgentDispatcher } from '@agentic-sdlc/orchestrator';

const dispatcher = new AgentDispatcher(redisUrl);

// Listen for results from this workflow
dispatcher.onResult(workflowId, (result) => {
  console.log('Task completed:', result.status);
  updateWorkflowDatabase(workflowId, result);
});

// Send task to agent
const task = {
  task_id: 'task-123',
  workflow_id: workflowId,
  agent_type: 'validation',
  status: 'pending',
  priority: 'high',
  payload: { file_paths: [...], working_directory: '/path' },
  retry_count: 0,
  max_retries: 3,
  timeout_ms: 300000
};

await dispatcher.dispatchTask(task, 'validation');
```

### Creating Custom Agent
```typescript
import { BaseAgent, TaskAssignment, TaskResult } from '@agentic-sdlc/base-agent';

export class MyAgent extends BaseAgent {
  constructor() {
    super({
      type: 'myagent',
      version: '1.0.0',
      capabilities: ['feature1']
    });
  }

  async execute(task: TaskAssignment): Promise<TaskResult> {
    try {
      const result = await doWork(task);
      return {
        task_id: task.task_id,
        workflow_id: task.workflow_id,
        status: 'success',
        output: result
      };
    } catch (error) {
      return {
        task_id: task.task_id,
        workflow_id: task.workflow_id,
        status: 'failure',
        error: { code: 'ERROR', message: error.message }
      };
    }
  }
}

// Start it
const agent = new MyAgent();
await agent.initialize();
// Listens for tasks, processes, reports results automatically
```

---

## Message Format

### Task Message (Orchestrator → Agent)
```json
{
  "id": "msg-abc123",
  "type": "task",
  "agent_id": "",
  "workflow_id": "wf-123",
  "stage": "initialization",
  "payload": {
    "task_id": "task-456",
    "workflow_id": "wf-123",
    "type": "scaffold",
    "name": "my-app",
    "description": "Test app",
    "context": {
      "task_id": "task-456",
      "workflow_id": "wf-123",
      "payload": { ... actual envelope ... }
    }
  },
  "timestamp": "2025-11-11T19:00:00Z",
  "trace_id": "trace-xyz"
}
```

### Result Message (Agent → Orchestrator)
```json
{
  "id": "result-123",
  "type": "result",
  "agent_id": "agent-scaffold-1",
  "workflow_id": "wf-123",
  "stage": "initialization",
  "payload": {
    "task_id": "task-456",
    "workflow_id": "wf-123",
    "status": "success",
    "output": { "files": [...] }
  },
  "timestamp": "2025-11-11T19:00:05Z",
  "trace_id": "trace-xyz"
}
```

---

## Known Issues & Fixes

| Issue | Session | Status | Fix |
|-------|---------|--------|-----|
| IORedis callback subscribe unreliable | #18 | ✅ Fixed | Use RobustRedisSubscriber |
| Messages delivered 3× (Redis quirk) | #24 | ✅ Fixed | Add eventId + dedup guard |
| Validation can't see generated code | #30 | ✅ Fixed | Envelope wrapping |
| Schema mismatch between agents | #36 | ✅ Fixed | AgentEnvelope system |
| Envelope extraction wrong location | #37 | ✅ Fixed | Extract from `.context?.payload` |

---

## Quick Debugging

### Check if message was published
```bash
# Terminal 1: Listen for messages
redis-cli
> SUBSCRIBE agent:scaffold:tasks

# Terminal 2: Publish test message
redis-cli
> PUBLISH agent:scaffold:tasks '{"test": "message"}'
```

### Check agent registration
```bash
redis-cli
> HGETALL agent:registry
# Should show all registered agents
```

### Monitor all events
```bash
redis-cli
> MONITOR
# Shows all commands in real-time
```

### Check event streams
```bash
redis-cli
> XLEN events:STAGE_COMPLETE
> XRANGE events:STAGE_COMPLETE - +
```

---

## Environment Variables

```bash
# Redis connection
REDIS_URL=redis://localhost:6380

# Optional overrides
REDIS_PUBLISHER_HOST=localhost
REDIS_PUBLISHER_PORT=6380
REDIS_SUBSCRIBER_HOST=localhost
REDIS_SUBSCRIBER_PORT=6380

# Debug mode
DEBUG=agentic-sdlc:*
```

---

## File Reference

| File | Lines | Purpose |
|------|-------|---------|
| `redis-subscription.ts` | 240 | Reliable pub/sub utility |
| `event-bus.ts` | 220 | Event streaming system |
| `agent-dispatcher.service.ts` | 300 | Task distribution service |
| `base-agent.ts` | 400 | Agent base class |
| `pipeline.constants.ts` | 350 | Channel & type constants |
| `redis.mock.ts` | 240 | Test doubles |

---

## Critical Rules

1. ✅ **Always use two separate Redis clients** (publisher + subscriber)
2. ✅ **Always await .subscribe()** before publishing
3. ✅ **Use RobustRedisSubscriber** for production reliability
4. ✅ **Validate messages** with Zod schemas
5. ✅ **Include trace_id** for debugging multi-service flows
6. ✅ **Handle both success and error** cases in agents
7. ✅ **Clean up connections** on shutdown

❌ **Never:** Mix pub/sub and regular ops on same client
❌ **Never:** Use callback-based subscribe API directly
❌ **Never:** Hardcode channel names (use constants)
❌ **Never:** Publish before subscribing listener ready
❌ **Never:** Forget error handler in subscriptions

---

## Performance Tips

1. **Use streams for large payloads** (event-bus)
2. **Use pub/sub for real-time** (tasks, results)
3. **Keep message size < 100KB** (Redis limits)
4. **Batch operations when possible** (use pipelines)
5. **Monitor Redis memory** (can run out quickly)
6. **Use connection pooling** (IORedis does this automatically)

---

**Framework Complete & Production Ready** ✅
See `REDIS-FRAMEWORK-REFERENCE.md` for complete documentation.
