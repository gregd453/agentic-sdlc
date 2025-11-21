# Redis Adapter & Core Framework Reference

**Last Updated:** 2025-11-11
**Framework Version:** 1.0.0
**Status:** Production Ready

---

## Overview

Your pipeline has a **complete, production-grade Redis framework** built on top of IORedis (v5.3.2+). It handles bidirectional agent-orchestrator communication, event streaming, and reliability features like automatic reconnection and health checking.

---

## Core Components

### 1. RobustRedisSubscriber (Reliability Layer)
**Location:** `packages/shared/utils/src/redis-subscription.ts` (240 lines)
**Exported from:** `@agentic-sdlc/shared-utils`

**Purpose:** Handles reliable Redis pub/sub subscriptions with automatic reconnection and health checks.

**Key Features:**
- Promise-based subscribe API (IORedis v5.3.2 compatible)
- Automatic reconnection on connection loss
- Health check mechanism (default: every 30s)
- Message timeout detection (default: 60s)
- Comprehensive debug logging with timestamps
- Graceful error handling with optional error callbacks

**Configuration Interface:**
```typescript
export interface RedisSubscriptionConfig {
  channels: string | string[];                    // Single or multiple channels
  onMessage: (channel: string, message: string) => void | Promise<void>;
  onError?: (error: Error) => void;              // Optional error handler
  onConnect?: () => void;                        // Connection callback
  healthCheckIntervalMs?: number;                // Default: 30000ms
  messageTimeoutMs?: number;                     // Default: 60000ms
  reconnectDelayMs?: number;                     // Default: 2000ms
  logger?: pino.Logger;                          // Custom logger
}
```

**Usage Example:**
```typescript
import { RobustRedisSubscriber } from '@agentic-sdlc/shared-utils';

const subscriber = new RobustRedisSubscriber(logger);
await subscriber.subscribe(redisClient, {
  channels: ['agent:scaffold:tasks', 'agent:validation:tasks'],
  onMessage: async (channel, message) => {
    const task = JSON.parse(message);
    await handleTask(task);
  },
  onError: (error) => {
    logger.error('Subscription error', error);
  },
  healthCheckIntervalMs: 30000
});
```

**Critical Session #18 Fix:** This utility was created to fix IORedis callback-based subscribe API bugs. Always use the promise-based pattern, NOT `subscriber.on('message', ...)`.

---

### 2. EventBus (Event Streaming)
**Location:** `packages/orchestrator/src/events/event-bus.ts` (220 lines)
**Purpose:** Centralized event system using Redis streams for persistence + pub/sub for immediate delivery.

**Architecture:**
- **Two separate Redis clients:** Publisher and Subscriber (required by IORedis subscription mode)
- **Dual storage:** Redis streams (`events:{type}`) for persistence + pub/sub (`event:{type}`) for real-time
- **Validation:** Zod schema validation on all events
- **Type safety:** Full TypeScript support with `Event` type

**Key Methods:**
```typescript
// Publish event to both stream and pub/sub
async publish(event: Event | WorkflowEvent): Promise<void>

// Subscribe handler to event type
async subscribe(
  eventType: string,
  handler: (event: Event) => Promise<void>
): Promise<void>

// Consume from stream (for recovery/replay)
async consume(eventType: string, groupId: string): Promise<Event[]>

// Cleanup
async disconnect(): Promise<void>
```

**Event Schema:**
```typescript
{
  id: string;                    // Unique event ID
  type: string;                  // Event type (e.g., "STAGE_COMPLETE")
  workflow_id?: string;          // Optional workflow reference
  payload: Record<string, any>;  // Event data
  timestamp: ISO8601 string;     // When event occurred
  trace_id: string;              // Trace correlation ID
}
```

**Channel Design:**
- **Pub/Sub:** `event:{type}` → Real-time delivery to subscribers
- **Streams:** `events:{type}` → Persistent log for recovery

**Session #24 Fix:** Removed double-invocation by using ONLY Redis pub/sub (no local emitter.emit). This was causing handlers to be called twice.

---

### 3. Agent Dispatcher Service (Task Distribution)
**Location:** `packages/orchestrator/src/services/agent-dispatcher.service.ts` (~300 lines)
**Purpose:** Orchestrates bidirectional agent communication - dispatches tasks, receives results.

**Architecture:**
```
Orchestrator                    Redis                           Agent
    |                            |                               |
    |--dispatchTask----------->  |--publish to agent:type:tasks->|
    |                            |                               |
    |                            |<--publish to orchestrator:results--|
    |<--onResult listening-------|                               |
```

**Key Methods:**
```typescript
// Send task to agent
async dispatchTask(
  task: AgentTask,
  agentType: string
): Promise<void>

// Register handler for results
onResult(workflowId: string, handler: (result: any) => void): void

// Get registered agents from registry
async getRegisteredAgents(): Promise<any[]>

// Clean up handlers
offResult(workflowId: string): void
```

**Channel Mapping:**
```typescript
const OUTBOUND = 'agent:{agentType}:tasks'      // Task dispatch
const INBOUND = 'orchestrator:results'          // Result collection
const REGISTRY = 'agent:registry'               // Agent discovery
```

**Session #36-37 Fix:** Tasks are now wrapped in AgentEnvelope format:
```typescript
// What dispatcher sends:
{
  id: string,
  type: 'task',
  payload: {
    task_id, workflow_id, type, name, description,
    context: task              // Envelope in context!
  }
}

// Agent receives (task as any).context.payload to get envelope
```

---

### 4. Base Agent (Task Consumer)
**Location:** `packages/agents/base-agent/src/base-agent.ts` (~400 lines)
**Purpose:** Abstract base class for all agents - handles task reception and result reporting.

**Architecture:**
```
Redis Channel (agent:type:tasks)
          |
          v
BaseAgent.subscribe()
          |
          v
execute() [implemented by subclass]
          |
          v
reportResult() -> Redis Channel (orchestrator:results)
```

**Key Methods:**
```typescript
// Initialize agent (start listening)
async initialize(): Promise<void>

// Execute task (overridden by subclasses)
abstract execute(task: TaskAssignment): Promise<TaskResult>

// Report task result back
async reportResult(result: TaskResult, workflowStage?: string): Promise<void>

// Graceful cleanup
async cleanup(): Promise<void>
```

**Agent Lifecycle:**
1. Agent starts and initializes
2. Subscribes to `agent:{type}:tasks` Redis channel
3. Registers with orchestrator (heartbeat to `agent:registry`)
4. Waits for tasks
5. On task: calls `execute()`
6. Reports result via `reportResult()`
7. Listens for next task

**Session #37 Fix:** Base agent now correctly extracts envelope from `(message.payload as any).context`.

---

### 5. Redis Channel Constants (Single Source of Truth)
**Location:** `packages/shared/types/src/constants/pipeline.constants.ts` (350 lines)
**Exported from:** `@agentic-sdlc/shared-types`

**Channel Naming Convention:**
```typescript
export const REDIS_CHANNELS = {
  // Orchestrator receives agent results
  ORCHESTRATOR_RESULTS: 'orchestrator:results',

  // Agents listen for tasks (function for dynamic agent type)
  AGENT_TASKS: (agentType: string) => `agent:${agentType}:tasks`,

  // Agent registry for discovery
  AGENT_REGISTRY: 'agent:registry',

  // Workflow event stream
  WORKFLOW_EVENTS: 'workflow:events',
};
```

**Agent Types (Constants):**
```typescript
export const AGENT_TYPES = {
  SCAFFOLD: 'scaffold',
  VALIDATION: 'validation',
  E2E: 'e2e',
  INTEGRATION: 'integration',
  DEPLOYMENT: 'deployment',
  MONITORING: 'monitoring',
  DEBUG: 'debug',
  BASE: 'base',
};
```

**Workflow Stages (Constants):**
```typescript
export const WORKFLOW_STAGES = {
  INITIALIZATION: 'initialization',
  SCAFFOLDING: 'scaffolding',
  VALIDATION: 'validation',
  E2E_TESTING: 'e2e_testing',
  INTEGRATION: 'integration',
  DEPLOYMENT: 'deployment',
  // ... more
};
```

---

## Data Structures

### TaskAssignment (Task Payload)
```typescript
{
  task_id: string;                    // Unique task ID
  workflow_id: string;                // Workflow this belongs to
  agent_type: string;                 // Which agent handles it
  status: 'pending' | 'running' | ... // Current status
  priority: 'critical' | 'high' | 'medium' | 'low';
  payload: any;                       // Agent-specific data
  context?: any;                      // Stage context for multi-stage workflows
  retry_count: number;                // How many times retried
  max_retries: number;                // Retry limit
  timeout_ms: number;                 // Execution timeout
  assigned_at: ISO8601 string;        // When assigned
  created_at: ISO8601 string;         // When created
}
```

### TaskResult (Task Completion)
```typescript
{
  task_id: string;                    // Which task completed
  workflow_id: string;                // Which workflow
  status: 'success' | 'failure';      // Result status
  output: {
    files_generated?: string[];       // For scaffold agent
    quality_score?: number;           // For validation agent
    // ... agent-specific outputs
  };
  metrics?: {
    duration_ms: number;              // How long it took
    tokens_used: number;              // API tokens (if applicable)
    api_calls: number;                // API call count
  };
  error?: {
    code: string;
    message: string;
    stack?: string;
  };
}
```

### AgentMessage (Redis Message Format)
```typescript
{
  id: string;                         // Message ID
  type: 'task' | 'result';            // What this is
  agent_id: string;                   // Sending agent
  workflow_id: string;                // Workflow ID
  stage: string;                      // Current stage
  payload: any;                       // Message data
  timestamp: ISO8601 string;          // When sent
  trace_id: string;                   // Trace correlation
}
```

---

## Critical Architectural Patterns

### Pattern 1: Separate Pub/Sub Clients (REQUIRED)
**Why:** IORedis doesn't allow mixing pub/sub and regular operations on same client.

```typescript
// ✅ CORRECT
const redisPublisher = new Redis(redisUrl);
const redisSubscriber = new Redis(redisUrl);

// Publisher: regular operations only
await redisPublisher.publish(channel, message);
await redisPublisher.hgetall(key);

// Subscriber: subscription operations only
await redisSubscriber.subscribe(channel);
redisSubscriber.on('message', handler);

// ❌ WRONG - DON'T DO THIS
const redis = new Redis(redisUrl);
await redis.publish(channel, message);
await redis.subscribe(channel);  // ERROR: already in subscriber mode!
```

### Pattern 2: Promise-Based Subscribe API
**Why:** Callback-based API had bugs in IORedis v5.3.2 (Session #18 fix).

```typescript
// ✅ CORRECT (Promise-based)
await redisSubscriber.subscribe(channel);
redisSubscriber.on('message', (channel, message) => {
  // Handle message
});

// Via RobustRedisSubscriber:
await robustSubscriber.subscribe(redisClient, {
  channels: [channel],
  onMessage: (channel, message) => { }
});

// ❌ WRONG (Callback-based subscribe)
redisSubscriber.subscribe(channel, (error, count) => {
  // This pattern had bugs in Session #18
});
```

### Pattern 3: Envelope Wrapping for Context Passing
**Why:** Multi-stage workflows need context from previous stages (Session #30-37).

```typescript
// Orchestrator creates envelope with workflow context
const envelope: AgentEnvelope = {
  task_id, workflow_id, agent_type,
  payload: { ... agent-specific fields ... },
  workflow_context: { current_stage, stage_outputs },
  priority, retry_count, max_retries
};

// Dispatcher wraps it in message
const message = {
  payload: {
    task_id, workflow_id,
    context: envelope  // Nested!
  }
};

// Agent extracts from correct location
const taskContext = (task as any).context;
const envelopeData = taskContext?.payload || taskContext;
const envelope = validateEnvelope(envelopeData);
```

### Pattern 4: Event Deduplication
**Why:** Redis can redeliver messages (at-least-once semantics).

```typescript
// Track seen event IDs in Redis SET with TTL
const seenKey = `seen:${taskId}`;
const isNew = await redis.sadd(seenKey, eventId);
await redis.expire(seenKey, 3600);  // 1 hour TTL

if (isNew === 0) {
  // Already processed, skip
  return;
}
// Process event
```

---

## Implementation Guide

### Adding a New Agent

```typescript
// 1. Create agent class extending BaseAgent
import { BaseAgent } from '@agentic-sdlc/base-agent';

export class MyCustomAgent extends BaseAgent {
  constructor() {
    super({
      type: 'mycustom',
      version: '1.0.0',
      capabilities: ['feature1', 'feature2']
    });
  }

  async execute(task: TaskAssignment): Promise<TaskResult> {
    try {
      // Do work
      const output = await doWork(task);

      return {
        task_id: task.task_id,
        workflow_id: task.workflow_id,
        status: 'success',
        output
      };
    } catch (error) {
      return {
        task_id: task.task_id,
        workflow_id: task.workflow_id,
        status: 'failure',
        error: {
          code: 'EXECUTION_ERROR',
          message: error.message
        }
      };
    }
  }
}

// 2. Start agent
const agent = new MyCustomAgent();
await agent.initialize();
```

### Subscribing to Events

```typescript
import { EventBus } from '@agentic-sdlc/orchestrator';

const eventBus = new EventBus(redisUrl);

// Subscribe to workflow events
await eventBus.subscribe('WORKFLOW_COMPLETE', async (event) => {
  console.log('Workflow completed:', event.workflow_id);
  // Handle event
});

// Publish event
await eventBus.publish({
  id: 'evt-123',
  type: 'WORKFLOW_COMPLETE',
  workflow_id: 'wf-456',
  payload: { result: 'success' },
  timestamp: new Date().toISOString(),
  trace_id: 'trace-789'
});
```

### Dispatching Tasks to Agents

```typescript
import { AgentDispatcher } from '@agentic-sdlc/orchestrator';

const dispatcher = new AgentDispatcher(redisUrl);

// Register handler for results
dispatcher.onResult(workflowId, (result) => {
  console.log('Task completed:', result);
});

// Dispatch task
await dispatcher.dispatchTask(
  {
    task_id: 'task-123',
    workflow_id: 'wf-456',
    agent_type: 'validation',
    // ... other fields
  },
  'validation'
);

// Results will come via Redis orchestrator:results channel
```

---

## Session History & Evolution

### Session #18 - IORedis Subscribe API Fix
**Problem:** Callback-based subscribe had reliability issues
**Solution:** Created RobustRedisSubscriber with promise-based API
**Impact:** All services now use reliable subscription pattern

### Session #24 - Event Deduplication
**Problem:** Redis was delivering messages multiple times (3x)
**Solution:** Added eventId tracking and deduplication guard
**Impact:** No more duplicate handler invocations

### Session #30 - Context Passing
**Problem:** Multi-agent workflows had no context from previous stages
**Solution:** Added envelope wrapping with stage_outputs
**Impact:** Validation agent can now access generated code from scaffold agent

### Session #36 - AgentEnvelope System
**Problem:** Adapters were used to bridge schema gaps
**Solution:** Created standardized AgentEnvelope with discriminated unions
**Impact:** Type-safe agent communication across the pipeline

### Session #37 - Envelope Extraction Fix
**Problem:** Agents extracting envelope from wrong location
**Solution:** Fixed base-agent and validation-agent extraction logic
**Impact:** Session #36 envelope system now fully operational

---

## Testing

### Using Redis Mock
```typescript
import { createRedisMock } from '@agentic-sdlc/shared-test-utils';

const mockRedis = createRedisMock();
await mockRedis.set('key', 'value');
expect(await mockRedis.get('key')).toBe('value');
```

### Testing Agents
```typescript
import { BaseAgent } from '@agentic-sdlc/base-agent';
import { createRedisMock } from '@agentic-sdlc/shared-test-utils';

const redis = createRedisMock();
const dispatcher = new AgentDispatcher(redis);

// Simulate task dispatch
const message = {
  type: 'task',
  payload: { task_id: 'test-1', ... }
};
await redis.publish('agent:scaffold:tasks', JSON.stringify(message));

// Verify agent processes it
```

---

## Troubleshooting

### Connection Issues
```
Error: Cannot use redis client for subscribe when it is already used for publish
```
**Solution:** You're using the same Redis client for both pub/sub and regular ops. Create separate clients.

### Message Not Received
```
No handlers triggered for published message
```
**Solution:**
1. Check subscription happened BEFORE publish: `await redis.subscribe(channel)`
2. Verify channel name matches exactly
3. Check Redis is running: `redis-cli ping`
4. Enable debug logging to see messages

### Out of Memory
```
Error: Out of memory
```
**Solution:**
1. Check event streams aren't growing indefinitely: `XLEN events:*`
2. Clean old streams: `DEL events:old-type`
3. Monitor Redis memory: `INFO memory`
4. Set max memory policy: `CONFIG SET maxmemory-policy allkeys-lru`

---

## Performance Characteristics

| Operation | Latency | Notes |
|-----------|---------|-------|
| Pub/Sub publish | ~1ms | Single message, no persistence |
| Stream append | ~5ms | Persistent log, can replay |
| Agent dispatch | ~50ms | Includes validation, retry logic |
| Task completion | 3-5s | Depends on task complexity |

---

## Security Considerations

1. **No authentication:** Current setup assumes trusted Redis instance
2. **No encryption:** Messages in plaintext over network
3. **No access control:** Any client can publish to any channel
4. **Recommended for production:**
   - Enable Redis AUTH
   - Use TLS/SSL for Redis connections
   - Implement ACL for sensitive channels
   - Validate message signatures

---

## Future Enhancements

1. **Redis Cluster support** - For horizontal scaling
2. **Message encryption** - For sensitive data
3. **Rate limiting** - Prevent channel flooding
4. **Dead letter queue** - Capture failed messages
5. **Message versioning** - For backward compatibility
6. **Metrics & monitoring** - Grafana dashboards for Redis performance

---

**Framework Status:** ✅ Production Ready
**Last Session Update:** Session #37 (Envelope Extraction Fixed)
**Next Review:** Session #39 (Full E2E test pass)
