# Implementation Code Guide: Redis & API Layer Integration
**Companion to:** STRATEGIC-DESIGN-REDIS-API-INTEGRATION.md
**Version:** 1.0
**Date:** 2025-11-12

---

## Phase 1: Initialize Hexagonal Architecture

### Step 1.1: Update server.ts

**File:** `packages/orchestrator/src/server.ts`

```typescript
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { prisma } from './db/client';
import { EventBus } from './events/event-bus';
import { WorkflowRepository } from './repositories/workflow.repository';
import { WorkflowService } from './services/workflow.service';
import { WorkflowStateMachineService } from './state-machine/workflow-state-machine';
import { GracefulShutdownService } from './services/graceful-shutdown.service';
import { workflowRoutes } from './api/routes/workflow.routes';
import { healthRoutes } from './api/routes/health.routes';
import { logger } from './utils/logger';

// NEW: Import hexagonal architecture
import {
  OrchestratorContainer,
  type IMessageBus,
  type IKVStore
} from './hexagonal';

export async function createServer() {
  const fastify = Fastify({
    logger: false,
    requestIdLogLabel: 'request_id',
    disableRequestLogging: false,
    requestIdHeader: 'x-request-id',
    trustProxy: true
  });

  // Register plugins
  await fastify.register(cors, {
    origin: process.env.NODE_ENV === 'production'
      ? process.env.ALLOWED_ORIGINS?.split(',') || []
      : true,
    credentials: true
  });

  // NEW: Initialize hexagonal container
  logger.info('Initializing Hexagonal Architecture Container...');

  const container = new OrchestratorContainer({
    redisUrl: process.env.REDIS_URL || 'redis://127.0.0.1:6380',
    redisNamespace: 'agentic-sdlc',
    redisDefaultTtl: 86400, // 24 hours
    coordinators: { plan: true }
  });

  await container.initialize();
  logger.info('Container initialized successfully');

  // Get message bus and KV store from container
  const messageBus = container.getBus();
  const kvStore = container.getKV();

  // Verify health
  const busHealth = await messageBus.health();
  const kvHealth = await kvStore.health?.();

  if (!busHealth.ok) {
    logger.warn('Message bus health check failed', { busHealth });
  }
  if (!kvHealth) {
    logger.warn('KV store health check failed');
  }

  // Initialize services
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const eventBus = new EventBus(redisUrl);
  const workflowRepository = new WorkflowRepository(prisma);
  const stateMachineService = new WorkflowStateMachineService(
    workflowRepository,
    eventBus
  );

  // CHANGED: Pass messageBus instead of agentDispatcher
  const workflowService = new WorkflowService(
    workflowRepository,
    eventBus,
    stateMachineService,
    messageBus  // ← Use hexagonal bus instead of AgentDispatcherService
  );

  // Register routes
  await workflowRoutes(fastify, { workflowService });
  await healthRoutes(fastify);

  // NEW: Add graceful shutdown hook
  const shutdownService = new GracefulShutdownService();

  fastify.addHook('onClose', async () => {
    logger.info('Server closing, initiating graceful shutdown...');

    // Shutdown workflow service subscriptions
    await workflowService.cleanup();

    // Shutdown container
    await container.shutdown();

    logger.info('Graceful shutdown complete');
  });

  return fastify;
}

export async function startServer() {
  const fastify = await createServer();

  const port = parseInt(process.env.PORT || '3000', 10);
  const host = process.env.HOST || '127.0.0.1';

  await fastify.listen({ port, host });

  logger.info(`Orchestrator API running on http://${host}:${port}`);
}

if (require.main === module) {
  startServer().catch((error) => {
    logger.error('Failed to start server', { error });
    process.exit(1);
  });
}
```

### Step 1.2: Update WorkflowService type signature

**File:** `packages/orchestrator/src/services/workflow.service.ts`

```typescript
import { IMessageBus } from '../hexagonal'; // NEW: Import interface

export class WorkflowService {
  private decisionGateService: DecisionGateService;
  private processedTasks: Set<string> = new Set();
  private redisClient: Redis;

  // CHANGED: messageBus instead of agentDispatcher
  constructor(
    private repository: WorkflowRepository,
    private eventBus: EventBus,
    private stateMachineService: WorkflowStateMachineService,
    private messageBus: IMessageBus  // ← Changed type
  ) {
    logger.info('[WF:CONSTRUCTOR:START] WorkflowService instance created');
    this.decisionGateService = new DecisionGateService();
    this.redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    this.setupEventHandlers();
  }

  // ... rest of the class
}
```

---

## Phase 2: Subscribe to Message Bus

### Step 2.1: Add bus subscription to WorkflowService

**File:** `packages/orchestrator/src/services/workflow.service.ts`

```typescript
export class WorkflowService {
  // ... existing code ...

  private setupEventHandlers(): void {
    logger.info('[WF:SETUP_HANDLERS] Registering message bus handlers');

    // NEW: Subscribe to agent results from message bus
    (async () => {
      try {
        await this.messageBus.subscribe(
          'agent:results',
          async (result: any) => {
            await this.handleAgentResultFromBus(result);
          },
          { key: 'workflow-service' }
        );

        logger.info('[WF:SUBSCRIBED] Successfully subscribed to agent:results', {
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error('[WF:SUBSCRIPTION_ERROR] Failed to subscribe to agent results', {
          error: (error as any)?.message,
          timestamp: new Date().toISOString()
        });
      }
    })();

    // ... keep existing EventBus subscriptions ...
  }

  // NEW: Handle agent results from message bus
  private async handleAgentResultFromBus(result: any): Promise<void> {
    const { workflow_id, stage, status, output, errors } = result;

    logger.info('[WF:RESULT_FROM_BUS] Received agent result', {
      workflow_id,
      stage,
      status,
      timestamp: new Date().toISOString()
    });

    try {
      // Load workflow
      const workflow = await this.repository.findById(workflow_id);
      if (!workflow) {
        logger.error('[WF:WORKFLOW_NOT_FOUND] Workflow not found', {
          workflow_id
        });
        return;
      }

      // Validate result (use schema registry)
      const validatedResult = {
        workflow_id,
        stage,
        status,
        output: output || {},
        errors: errors || []
      };

      logger.info('[WF:RESULT_VALIDATED] Result validated', {
        workflow_id,
        stage,
        status
      });

      // Store stage output in database
      if (status === 'success') {
        await this.storeStageOutput(workflow_id, stage, output);
      }

      // Publish STAGE_COMPLETE event to EventBus
      // This triggers state machine transition
      await this.eventBus.publish({
        id: `event-${Date.now()}`,
        type: 'STAGE_COMPLETE',
        workflow_id,
        payload: {
          stage,
          status,
          output,
          errors
        },
        timestamp: new Date().toISOString(),
        trace_id: generateTraceId()
      });

      logger.info('[WF:EVENT_PUBLISHED] STAGE_COMPLETE event published', {
        workflow_id,
        stage,
        timestamp: new Date().toISOString()
      });

      // State machine handles automatic transition
      // (No longer need to manually create next task)

    } catch (error) {
      logger.error('[WF:RESULT_PROCESSING_ERROR] Error processing agent result', {
        workflow_id,
        error: (error as any)?.message,
        stack: (error as any)?.stack
      });
    }
  }

  // DELETE ALL OF THIS:
  // ❌ agentDispatcher.onResult() registration
  // ❌ handler lifecycle code
  // ❌ resultHandlers Map
  // ❌ handlerTimeouts Map
  // ❌ Handler cleanup logic
  // (Keep only the bus.subscribe() call above)

  // KEEP: Everything else (createWorkflow, storeStageOutput, etc.)
}
```

---

## Phase 3: Update Agents

### Step 3.1: Update BaseAgent

**File:** `packages/agents/base-agent/src/base-agent.ts`

```typescript
import { IMessageBus } from '@agentic-sdlc/orchestrator/hexagonal';

export abstract class BaseAgent {
  protected readonly redisPublisher: any;
  protected readonly redisSubscriber: any;
  protected readonly agentId: string = randomUUID();
  protected readonly messageBus: IMessageBus;  // NEW

  constructor(messageBus: IMessageBus) {  // CHANGED signature
    this.messageBus = messageBus;
    this.logger.info('BaseAgent initialized', {
      agentId: this.agentId,
      agentType: this.capabilities.type
    });
  }

  // NEW: Report result using message bus instead of raw Redis
  async reportResult(result: TaskResult, workflowStage?: string): Promise<void> {
    // Validate result
    const validatedResult = TaskResultSchema.parse(result);

    const stage = workflowStage || this.capabilities.type;

    // Use message bus to publish result
    // BEFORE:
    // await this.redisPublisher.publish(
    //   REDIS_CHANNELS.ORCHESTRATOR_RESULTS,
    //   JSON.stringify({...})
    // );

    // AFTER: Use hexagonal message bus
    await this.messageBus.publish(
      'agent:results',  // Topic
      {
        workflow_id: validatedResult.workflow_id,
        task_id: validatedResult.task_id,
        stage: stage,
        status: validatedResult.status,
        output: validatedResult.output,
        errors: validatedResult.errors,
        timestamp: new Date().toISOString()
      },
      {
        key: validatedResult.workflow_id,  // Correlation key
        mirrorToStream: 'agent:results:stream'  // Durability
      }
    );

    this.logger.info('Result published to message bus', {
      task_id: validatedResult.task_id,
      status: validatedResult.status,
      workflow_stage: stage
    });
  }
}
```

### Step 3.2: Update ScaffoldAgent run-agent.ts

**File:** `packages/agents/scaffold-agent/src/run-agent.ts`

```typescript
import { ScaffoldAgent } from './scaffold-agent';
import { REDIS_CHANNELS } from '@agentic-sdlc/shared-types';
import { logger } from '@agentic-sdlc/shared-utils';

// NEW: Import hexagonal container
import { OrchestratorContainer } from '@agentic-sdlc/orchestrator/hexagonal';

async function main() {
  try {
    logger.info('[SCAFFOLD] Starting Scaffold Agent...');

    // NEW: Initialize hexagonal container
    const container = new OrchestratorContainer({
      redisUrl: process.env.REDIS_URL || 'redis://localhost:6380',
      redisNamespace: 'agentic-sdlc'
    });

    await container.initialize();
    logger.info('[SCAFFOLD] Container initialized');

    // Get message bus from container
    const messageBus = container.getBus();

    // Create agent with message bus
    const agent = new ScaffoldAgent(messageBus);  // ← Pass message bus

    // Subscribe to tasks for scaffold agent
    const taskChannel = REDIS_CHANNELS.AGENT_TASKS('scaffold');
    logger.info('[SCAFFOLD] Subscribing to task channel', { channel: taskChannel });

    await messageBus.subscribe(
      taskChannel,
      async (task) => {
        logger.info('[SCAFFOLD] Task received', {
          task_id: task.task_id,
          workflow_id: task.workflow_id
        });

        try {
          await agent.execute(task);
        } catch (error) {
          logger.error('[SCAFFOLD] Task execution failed', {
            task_id: task.task_id,
            error: (error as any)?.message
          });
        }
      }
    );

    logger.info('[SCAFFOLD] Agent ready and listening for tasks');

    // Graceful shutdown on signals
    process.on('SIGTERM', async () => {
      logger.info('[SCAFFOLD] Received SIGTERM, shutting down gracefully...');
      await container.shutdown();
      process.exit(0);
    });

  } catch (error) {
    logger.error('[SCAFFOLD] Agent initialization failed', {
      error: (error as any)?.message,
      stack: (error as any)?.stack
    });
    process.exit(1);
  }
}

main().catch((error) => {
  logger.error('[SCAFFOLD] Uncaught error', { error });
  process.exit(1);
});
```

### Step 3.3: Update All Other Agents

**Files:**
- `packages/agents/validation-agent/src/run-agent.ts`
- `packages/agents/e2e-agent/src/run-agent.ts`
- `packages/agents/integration-agent/src/run-agent.ts`
- `packages/agents/deployment-agent/src/run-agent.ts`

Use the same pattern as scaffold-agent above, just changing:
- Import statement (ValidationAgent, E2EAgent, etc.)
- Agent class instantiation
- Task channel name
- Log prefix

```typescript
// Pattern for all agents:

import { OrchestratorContainer } from '@agentic-sdlc/orchestrator/hexagonal';

const container = new OrchestratorContainer({ redisUrl, namespace });
await container.initialize();

const messageBus = container.getBus();
const agent = new YourAgent(messageBus);  // ← Pass message bus

await messageBus.subscribe(
  REDIS_CHANNELS.AGENT_TASKS('your-agent-type'),
  async (task) => {
    await agent.execute(task);
  }
);
```

---

## Phase 4: State Machine Integration

### Step 4.1: Verify EventBus subscription in StateMachine

**File:** `packages/orchestrator/src/state-machine/workflow-state-machine.ts`

```typescript
export class WorkflowStateMachineService {
  private stateMachines: Map<string, StateMachine<any, any>> = new Map();

  constructor(
    private repository: WorkflowRepository,
    private eventBus: EventBus
  ) {
    logger.info('[SM:CONSTRUCTOR] WorkflowStateMachineService initialized');

    // Subscribe to STAGE_COMPLETE events
    (async () => {
      try {
        await this.eventBus.subscribe('STAGE_COMPLETE', async (event) => {
          await this.handleStageComplete(event);
        });

        logger.info('[SM:SUBSCRIBED] Subscribed to STAGE_COMPLETE events');
      } catch (error) {
        logger.error('[SM:SUBSCRIPTION_ERROR] Failed to subscribe', { error });
      }
    })();
  }

  private async handleStageComplete(event: any): Promise<void> {
    const { workflow_id, payload } = event;
    const { stage, status, output } = payload;

    logger.info('[SM:STAGE_COMPLETE] Received STAGE_COMPLETE event', {
      workflow_id,
      stage,
      status
    });

    // Get state machine for this workflow
    const stateMachine = this.getStateMachine(workflow_id);
    if (!stateMachine) {
      logger.warn('[SM:NO_MACHINE] No state machine found for workflow', {
        workflow_id
      });
      return;
    }

    // Send event to state machine
    const result = stateMachine.send({
      type: 'STAGE_COMPLETE',
      stage,
      status,
      output
    });

    logger.info('[SM:TRANSITION] State machine transition executed', {
      workflow_id,
      from_stage: stage,
      to_stage: result.value,
      status: result.status
    });

    // Update workflow in database with new stage
    const nextStage = result.value;
    if (nextStage && nextStage !== stage) {
      await this.repository.update(workflow_id, {
        current_stage: nextStage,
        progress: this.calculateProgress(nextStage),
        updated_at: new Date()
      });

      logger.info('[SM:DATABASE_UPDATED] Workflow stage updated', {
        workflow_id,
        new_stage: nextStage
      });
    }
  }

  private calculateProgress(stage: string): number {
    const stages = [
      'initialization',
      'scaffolding',
      'validation',
      'e2e',
      'integration',
      'deployment'
    ];
    const index = stages.indexOf(stage);
    return Math.round(((index + 1) / stages.length) * 100);
  }
}
```

---

## Phase 5: Contract Validation

### Step 5.1: Add schema validation

**File:** `packages/orchestrator/src/services/workflow.service.ts`

```typescript
import { SchemaRegistry } from '@agentic-sdlc/shared-types';

export class WorkflowService {
  // ... existing code ...

  private async handleAgentResultFromBus(result: any): Promise<void> {
    const { workflow_id, stage, status, output, errors } = result;

    // NEW: Validate result against schema
    try {
      const schema = SchemaRegistry.get('agent.result');
      if (schema) {
        const validatedResult = schema.parse({
          workflow_id,
          task_id: result.task_id,
          stage,
          status,
          output,
          errors
        });
        logger.info('[WF:SCHEMA_VALID] Result passed schema validation', {
          workflow_id,
          stage
        });
      }
    } catch (error) {
      logger.error('[WF:SCHEMA_INVALID] Result failed validation', {
        workflow_id,
        error: (error as any)?.message
      });
      // Publish validation failed event
      await this.eventBus.publish({
        id: `event-${Date.now()}`,
        type: 'VALIDATION_FAILED',
        workflow_id,
        payload: { stage, error: (error as any)?.message },
        timestamp: new Date().toISOString(),
        trace_id: generateTraceId()
      });
      return;
    }

    // Continue with rest of processing...
  }
}
```

---

## Phase 6: Persistence

### Step 6.1: Store workflow state

**File:** `packages/orchestrator/src/services/workflow.service.ts`

```typescript
export class WorkflowService {
  // ... existing code ...

  private async storeStateSnapshot(workflowId: string, state: any): Promise<void> {
    try {
      // NEW: Use KV store to persist workflow state
      const kvStore = this.container.getKV();  // Get from container

      await kvStore.set(
        `workflow:${workflowId}:state`,
        {
          current_stage: state.value,
          progress: state.context.progress,
          stage_outputs: state.context.outputs,
          updated_at: new Date().toISOString()
        },
        3600 // 1 hour TTL
      );

      logger.info('[WF:STATE_PERSISTED] Workflow state persisted to KV', {
        workflow_id: workflowId,
        stage: state.value
      });
    } catch (error) {
      logger.error('[WF:PERSISTENCE_ERROR] Failed to persist state', {
        workflow_id: workflowId,
        error: (error as any)?.message
      });
    }
  }
}
```

---

## Testing Examples

### Unit Test Example

```typescript
import { OrchestratorContainer } from '@agentic-sdlc/orchestrator/hexagonal';

describe('WorkflowService with Message Bus', () => {
  let container: OrchestratorContainer;
  let messageBus: IMessageBus;
  let workflowService: WorkflowService;

  beforeAll(async () => {
    // Initialize container
    container = new OrchestratorContainer({
      redisUrl: 'redis://localhost:6380',
      redisNamespace: 'test'
    });
    await container.initialize();
    messageBus = container.getBus();

    // Create service with real message bus
    workflowService = new WorkflowService(
      mockRepository,
      mockEventBus,
      mockStateMachine,
      messageBus
    );
  });

  afterAll(async () => {
    await container.shutdown();
  });

  it('should handle agent results from message bus', async () => {
    // Publish a result to message bus
    await messageBus.publish('agent:results', {
      workflow_id: 'wf_test-123',
      stage: 'scaffolding',
      status: 'success',
      output: { files: [...] }
    });

    // Wait for handler
    await new Promise(r => setTimeout(r, 500));

    // Verify state machine received event
    expect(mockStateMachine.send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'STAGE_COMPLETE',
        stage: 'scaffolding'
      })
    );
  });
});
```

### E2E Test Example

```typescript
describe('Full Workflow through Message Bus', () => {
  it('should complete all stages', async () => {
    // Create workflow
    const response = await api.post('/api/v1/workflows', {
      type: 'app',
      name: 'E2E Test App',
      requirements: 'Build a test app'
    });

    const workflowId = response.body.workflow_id;

    // Simulate each agent completing
    const stages = ['scaffolding', 'validation', 'e2e', 'integration', 'deployment'];

    for (const stage of stages) {
      // Publish result
      await messageBus.publish('agent:results', {
        workflow_id: workflowId,
        stage,
        status: 'success',
        output: { /* stage-specific output */ }
      });

      // Wait for processing
      await new Promise(r => setTimeout(r, 500));

      // Check workflow progressed
      const workflow = await api.get(`/api/v1/workflows/${workflowId}`);
      expect(workflow.body.current_stage).toBe(stage);
    }

    // Final check
    const final = await api.get(`/api/v1/workflows/${workflowId}`);
    expect(final.body.status).toBe('completed');
    expect(final.body.progress_percentage).toBe(100);
  });
});
```

---

**Next Step:** Proceed with Phase 1 implementation
