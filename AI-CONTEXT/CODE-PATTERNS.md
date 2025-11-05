# CODE PATTERNS FOR AI AGENTS

**Purpose:** Standard code patterns and templates for consistent implementation

---

## Agent Implementation Pattern

### Base Agent Template

```typescript
import { BaseAgent } from '@agentic-sdlc/base-agent';
import { z } from 'zod';
import { logger } from '@agentic-sdlc/shared/logger';
import { metrics } from '@agentic-sdlc/shared/metrics';

// 1. ALWAYS define schemas first
export const TaskSchema = z.object({
  task_id: z.string().uuid(),
  workflow_id: z.string().uuid(),
  type: z.enum(['scaffold', 'validate', 'test']),
  payload: z.record(z.unknown()),
  timeout_ms: z.number().default(300000)
});

export const ResultSchema = z.object({
  status: z.enum(['success', 'failure', 'partial']),
  data: z.record(z.unknown()),
  next_stage: z.string().optional(),
  errors: z.array(z.string()).optional()
});

export type Task = z.infer<typeof TaskSchema>;
export type Result = z.infer<typeof ResultSchema>;

export class MyAgent extends BaseAgent<Task, Result> {
  constructor() {
    super({
      name: 'my-agent',
      version: '1.0.0',
      capabilities: ['capability1', 'capability2']
    });
  }

  async execute(task: Task): Promise<Result> {
    const startTime = Date.now();
    const traceId = this.generateTraceId();

    // ALWAYS validate input
    const validatedTask = TaskSchema.parse(task);

    logger.info('Starting task execution', {
      agent: this.name,
      task_id: validatedTask.task_id,
      trace_id: traceId
    });

    try {
      // Implementation
      const result = await this.processTask(validatedTask);

      // ALWAYS validate output
      const validatedResult = ResultSchema.parse(result);

      // Record metrics
      metrics.recordDuration('agent.execution', Date.now() - startTime, {
        agent: this.name,
        status: validatedResult.status
      });

      return validatedResult;

    } catch (error) {
      logger.error('Task execution failed', {
        agent: this.name,
        task_id: validatedTask.task_id,
        error: error.message,
        trace_id: traceId
      });

      // ALWAYS return structured error
      return {
        status: 'failure',
        data: {},
        errors: [error.message]
      };
    }
  }

  private async processTask(task: Task): Promise<Result> {
    // Implementation logic here
    return {
      status: 'success',
      data: { processed: true },
      next_stage: 'validation'
    };
  }
}
```

---

## API Endpoint Pattern

### RESTful Endpoint Template

```typescript
import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';

// 1. Define request/response schemas
const CreateWorkflowSchema = {
  body: z.object({
    type: z.enum(['app', 'feature', 'bugfix']),
    name: z.string().min(1).max(100),
    description: z.string(),
    priority: z.enum(['low', 'medium', 'high', 'critical'])
  }),
  response: {
    200: z.object({
      workflow_id: z.string().uuid(),
      status: z.string(),
      created_at: z.string().datetime()
    }),
    400: z.object({
      error: z.string(),
      details: z.array(z.string()).optional()
    })
  }
};

// 2. Implement handler with proper error handling
export async function createWorkflowHandler(
  request: FastifyRequest<{ Body: z.infer<typeof CreateWorkflowSchema.body> }>,
  reply: FastifyReply
): Promise<void> {
  try {
    // Validate request
    const validated = CreateWorkflowSchema.body.parse(request.body);

    // Process request
    const workflow = await workflowService.create(validated);

    // Return consistent response
    reply.code(200).send({
      workflow_id: workflow.id,
      status: workflow.status,
      created_at: workflow.createdAt.toISOString()
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      reply.code(400).send({
        error: 'Validation failed',
        details: error.errors.map(e => e.message)
      });
    } else {
      logger.error('Handler error', { error });
      reply.code(500).send({
        error: 'Internal server error'
      });
    }
  }
}

// 3. Register route with schema
export function registerRoutes(app: FastifyInstance): void {
  app.post('/api/v1/workflows', {
    schema: CreateWorkflowSchema,
    handler: createWorkflowHandler
  });
}
```

---

## Database Access Pattern

### Repository Pattern with Prisma

```typescript
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

export class WorkflowRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreateWorkflowData): Promise<Workflow> {
    // ALWAYS use transactions for multiple operations
    return await this.prisma.$transaction(async (tx) => {
      // Create workflow
      const workflow = await tx.workflow.create({
        data: {
          ...data,
          status: 'initiated',
          created_at: new Date()
        }
      });

      // Create initial event
      await tx.workflowEvent.create({
        data: {
          workflow_id: workflow.id,
          event_type: 'WORKFLOW_CREATED',
          payload: data,
          timestamp: new Date()
        }
      });

      return workflow;
    });
  }

  async findById(id: string): Promise<Workflow | null> {
    // Include related data when needed
    return await this.prisma.workflow.findUnique({
      where: { id },
      include: {
        events: {
          orderBy: { timestamp: 'desc' },
          take: 10
        }
      }
    });
  }

  async update(id: string, data: UpdateWorkflowData): Promise<Workflow> {
    // ALWAYS check existence before update
    const existing = await this.findById(id);
    if (!existing) {
      throw new NotFoundError(`Workflow ${id} not found`);
    }

    return await this.prisma.workflow.update({
      where: { id },
      data: {
        ...data,
        updated_at: new Date()
      }
    });
  }
}
```

---

## Event Handling Pattern

### Event Bus Integration

```typescript
import { EventEmitter } from 'events';
import { Redis } from 'ioredis';

export class EventBus {
  private emitter = new EventEmitter();
  private redis: Redis;

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl);
  }

  async publish(event: Event): Promise<void> {
    // Validate event
    const validated = EventSchema.parse(event);

    // Store in Redis for persistence
    await this.redis.xadd(
      `events:${event.type}`,
      '*',
      'data', JSON.stringify(validated)
    );

    // Emit for local subscribers
    this.emitter.emit(event.type, validated);

    logger.info('Event published', {
      type: event.type,
      id: event.id
    });
  }

  async subscribe(
    eventType: string,
    handler: (event: Event) => Promise<void>
  ): Promise<void> {
    // Local subscription
    this.emitter.on(eventType, handler);

    // Redis subscription for distributed events
    const stream = `events:${eventType}`;
    const consumer = `consumer-${process.pid}`;

    // Create consumer group if not exists
    try {
      await this.redis.xgroup('CREATE', stream, consumer, '0');
    } catch (error) {
      // Group already exists
    }

    // Start consuming
    this.consumeStream(stream, consumer, handler);
  }

  private async consumeStream(
    stream: string,
    consumer: string,
    handler: (event: Event) => Promise<void>
  ): Promise<void> {
    while (true) {
      try {
        const messages = await this.redis.xreadgroup(
          'GROUP', consumer, consumer,
          'COUNT', 10,
          'BLOCK', 1000,
          'STREAMS', stream, '>'
        );

        if (messages) {
          for (const [, entries] of messages) {
            for (const [id, fields] of entries) {
              const event = JSON.parse(fields[1]);
              await handler(event);
              await this.redis.xack(stream, consumer, id);
            }
          }
        }
      } catch (error) {
        logger.error('Stream consumption error', { error });
        await this.sleep(5000);
      }
    }
  }
}
```

---

## Error Handling Pattern

### Structured Error Classes

```typescript
export class BaseError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = this.constructor.name;
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details
    };
  }
}

export class ValidationError extends BaseError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', 400, details);
  }
}

export class NotFoundError extends BaseError {
  constructor(message: string) {
    super(message, 'NOT_FOUND', 404);
  }
}

export class ConflictError extends BaseError {
  constructor(message: string) {
    super(message, 'CONFLICT', 409);
  }
}

// Usage in try-catch
try {
  // Some operation
} catch (error) {
  if (error instanceof ValidationError) {
    // Handle validation error
    reply.code(error.statusCode).send(error.toJSON());
  } else if (error instanceof NotFoundError) {
    // Handle not found
    reply.code(404).send(error.toJSON());
  } else {
    // Unknown error
    logger.error('Unexpected error', { error });
    reply.code(500).send({
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred'
    });
  }
}
```

---

## Testing Pattern

### Unit Test Template

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MyAgent } from '../src/agent';

describe('MyAgent', () => {
  let agent: MyAgent;
  let mockService: any;

  beforeEach(() => {
    // Setup mocks
    mockService = {
      process: vi.fn().mockResolvedValue({ success: true })
    };

    agent = new MyAgent(mockService);
  });

  describe('execute', () => {
    it('should successfully execute valid task', async () => {
      // Arrange
      const task = {
        task_id: '123e4567-e89b-12d3-a456-426614174000',
        workflow_id: '123e4567-e89b-12d3-a456-426614174001',
        type: 'scaffold',
        payload: { name: 'test-app' },
        timeout_ms: 5000
      };

      // Act
      const result = await agent.execute(task);

      // Assert
      expect(result.status).toBe('success');
      expect(mockService.process).toHaveBeenCalledWith(task.payload);
    });

    it('should handle errors gracefully', async () => {
      // Arrange
      const task = { /* invalid task */ };

      // Act & Assert
      await expect(agent.execute(task)).rejects.toThrow(ValidationError);
    });

    it('should timeout long-running tasks', async () => {
      // Arrange
      mockService.process.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 10000))
      );

      const task = {
        /* ... */
        timeout_ms: 100
      };

      // Act & Assert
      await expect(agent.execute(task)).rejects.toThrow('Timeout');
    });
  });
});
```

---

## Configuration Pattern

### Environment-based Configuration

```typescript
import { z } from 'zod';

// Define configuration schema
const ConfigSchema = z.object({
  port: z.number().default(3000),
  database: z.object({
    url: z.string().url(),
    poolSize: z.number().default(10)
  }),
  redis: z.object({
    url: z.string().url(),
    ttl: z.number().default(3600)
  }),
  features: z.object({
    sprintAutomation: z.boolean().default(false),
    dailyBuilds: z.boolean().default(false),
    autoRemediation: z.boolean().default(false)
  }),
  limits: z.object({
    maxConcurrentAgents: z.number().default(10),
    taskTimeout: z.number().default(300000),
    retryAttempts: z.number().default(3)
  })
});

export type Config = z.infer<typeof ConfigSchema>;

// Load and validate configuration
export function loadConfig(): Config {
  const raw = {
    port: parseInt(process.env.PORT || '3000'),
    database: {
      url: process.env.DATABASE_URL!,
      poolSize: parseInt(process.env.DB_POOL_SIZE || '10')
    },
    redis: {
      url: process.env.REDIS_URL!,
      ttl: parseInt(process.env.REDIS_TTL || '3600')
    },
    features: {
      sprintAutomation: process.env.ENABLE_SPRINT_AUTOMATION === 'true',
      dailyBuilds: process.env.ENABLE_DAILY_BUILDS === 'true',
      autoRemediation: process.env.ENABLE_AUTO_REMEDIATION === 'true'
    },
    limits: {
      maxConcurrentAgents: parseInt(process.env.MAX_CONCURRENT_AGENTS || '10'),
      taskTimeout: parseInt(process.env.TASK_TIMEOUT || '300000'),
      retryAttempts: parseInt(process.env.RETRY_ATTEMPTS || '3')
    }
  };

  return ConfigSchema.parse(raw);
}
```

---

## State Machine Pattern

### XState Implementation

```typescript
import { createMachine, interpret } from 'xstate';

export const workflowMachine = createMachine({
  id: 'workflow',
  initial: 'initiated',
  states: {
    initiated: {
      on: {
        START_SCAFFOLD: 'scaffolding'
      }
    },
    scaffolding: {
      on: {
        SCAFFOLD_SUCCESS: 'validating',
        SCAFFOLD_FAILURE: 'failed'
      }
    },
    validating: {
      on: {
        VALIDATION_SUCCESS: 'testing',
        VALIDATION_FAILURE: 'failed'
      }
    },
    testing: {
      on: {
        TESTS_PASS: 'deploying',
        TESTS_FAIL: 'failed'
      }
    },
    deploying: {
      on: {
        DEPLOY_SUCCESS: 'completed',
        DEPLOY_FAILURE: 'rollback'
      }
    },
    rollback: {
      on: {
        ROLLBACK_SUCCESS: 'failed',
        ROLLBACK_FAILURE: 'critical'
      }
    },
    completed: {
      type: 'final'
    },
    failed: {
      type: 'final'
    },
    critical: {
      type: 'final'
    }
  }
});

// Usage
const service = interpret(workflowMachine)
  .onTransition((state) => {
    logger.info('State transition', {
      from: state.history?.value,
      to: state.value
    });
  })
  .start();

service.send('START_SCAFFOLD');
```

---

## Retry Pattern

### Exponential Backoff with Circuit Breaker

```typescript
import pRetry from 'p-retry';

export class RetryableOperation {
  private failures = 0;
  private lastFailureTime?: Date;
  private circuitOpen = false;

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    options?: {
      retries?: number;
      minTimeout?: number;
      maxTimeout?: number;
    }
  ): Promise<T> {
    // Check circuit breaker
    if (this.circuitOpen) {
      if (Date.now() - this.lastFailureTime!.getTime() < 60000) {
        throw new Error('Circuit breaker is open');
      }
      this.circuitOpen = false;
    }

    try {
      const result = await pRetry(operation, {
        retries: options?.retries ?? 3,
        minTimeout: options?.minTimeout ?? 1000,
        maxTimeout: options?.maxTimeout ?? 30000,
        onFailedAttempt: (error) => {
          logger.warn('Retry attempt failed', {
            attempt: error.attemptNumber,
            retriesLeft: error.retriesLeft,
            error: error.message
          });
        }
      });

      // Reset on success
      this.failures = 0;
      return result;

    } catch (error) {
      this.failures++;
      this.lastFailureTime = new Date();

      // Open circuit if too many failures
      if (this.failures >= 5) {
        this.circuitOpen = true;
        logger.error('Circuit breaker opened', { failures: this.failures });
      }

      throw error;
    }
  }
}
```

---

## Important Rules for AI Agents

### ALWAYS:
1. ✅ Define Zod schemas first
2. ✅ Validate all inputs and outputs
3. ✅ Use structured logging with context
4. ✅ Record metrics for operations
5. ✅ Handle errors with specific error classes
6. ✅ Use transactions for database operations
7. ✅ Implement retry logic for external calls
8. ✅ Write tests for all code paths

### NEVER:
1. ❌ Use `any` type
2. ❌ Catch errors without logging
3. ❌ Mutate shared state directly
4. ❌ Make synchronous blocking calls
5. ❌ Store secrets in code
6. ❌ Skip input validation
7. ❌ Use magic numbers/strings
8. ❌ Ignore error cases