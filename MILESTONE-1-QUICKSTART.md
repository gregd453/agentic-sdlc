# Milestone 1 Quick Start Guide - Happy Path Implementation

## 🚀 Hour-by-Hour Implementation Guide

### ⏱️ Hour 1: Setup Shared Types Package

```bash
# Create the package structure
mkdir -p packages/shared/types/src/{core,agents,registry}
cd packages/shared/types

# Initialize package.json
cat > package.json << 'EOF'
{
  "name": "@agentic-sdlc/shared-types",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "typescript": "^5.3.3"
  }
}
EOF

# Create tsconfig.json
cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
EOF

# Install dependencies
pnpm install
```

### ⏱️ Hour 2: Implement Core Types

Create `src/core/brands.ts`:
```typescript
// Type branding for compile-time safety
export type WorkflowId = string & { __brand: 'WorkflowId' };
export type AgentId = string & { __brand: 'AgentId' };
export type TaskId = string & { __brand: 'TaskId' };

export const toWorkflowId = (id: string): WorkflowId => id as WorkflowId;
export const toAgentId = (id: string): AgentId => id as AgentId;
export const toTaskId = (id: string): TaskId => id as TaskId;
```

Create `src/core/schemas.ts`:
```typescript
import { z } from 'zod';
import { WorkflowId, AgentId, TaskId, toWorkflowId, toAgentId, toTaskId } from './brands';

export const VERSION = '1.0.0' as const;

// Core workflow schema
export const WorkflowSchema = z.object({
  workflow_id: z.string().transform(toWorkflowId),
  type: z.enum(['app', 'service', 'feature', 'capability']),
  name: z.string(),
  current_state: z.enum(['initiated', 'scaffolding', 'validating', 'testing', 'completed', 'failed']),
  progress: z.number().min(0).max(100),
  version: z.literal(VERSION),
  metadata: z.record(z.unknown()).optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

// Base agent task
export const AgentTaskSchema = z.object({
  task_id: z.string().transform(toTaskId),
  workflow_id: z.string().transform(toWorkflowId),
  agent_type: z.string(),
  action: z.string(),
  payload: z.record(z.unknown()),
  version: z.literal(VERSION),
  timeout_ms: z.number().default(120000),
  retry_count: z.number().default(0),
  max_retries: z.number().default(3),
  created_at: z.string().datetime(),
});

// Base agent result
export const AgentResultSchema = z.object({
  task_id: z.string().transform(toTaskId),
  workflow_id: z.string().transform(toWorkflowId),
  agent_id: z.string().transform(toAgentId),
  success: z.boolean(),
  action: z.string(),
  result: z.record(z.unknown()),
  error: z.string().optional(),
  duration_ms: z.number(),
  timestamp: z.string().datetime(),
  version: z.literal(VERSION),
});

export type Workflow = z.infer<typeof WorkflowSchema>;
export type AgentTask = z.infer<typeof AgentTaskSchema>;
export type AgentResult = z.infer<typeof AgentResultSchema>;
```

### ⏱️ Hour 3: Schema Registry Implementation

Create `src/registry/schema-registry.ts`:
```typescript
import { z } from 'zod';

interface SchemaEntry {
  schema: z.ZodSchema;
  version: string;
  description?: string;
}

export class SchemaRegistry {
  private static schemas = new Map<string, SchemaEntry>();
  private static aliases = new Map<string, string>();

  static register(
    name: string,
    schema: z.ZodSchema,
    version = '1.0.0',
    description?: string
  ): void {
    const entry: SchemaEntry = { schema, version, description };

    // Register with version
    const versionedKey = `${name}:${version}`;
    this.schemas.set(versionedKey, entry);

    // Register as latest (without version)
    this.schemas.set(name, entry);

    // Track latest version
    this.aliases.set(name, version);

    console.log(`✅ Registered schema: ${name} (v${version})`);
  }

  static validate<T>(name: string, data: unknown, version?: string): T {
    const key = version ? `${name}:${version}` : name;
    const entry = this.schemas.get(key);

    if (!entry) {
      throw new Error(`Schema "${key}" not found in registry`);
    }

    try {
      return entry.schema.parse(data) as T;
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(
          `Validation failed for schema "${name}":\n${error.errors
            .map(e => `  - ${e.path.join('.')}: ${e.message}`)
            .join('\n')}`
        );
      }
      throw error;
    }
  }

  static getVersion(name: string): string | undefined {
    return this.aliases.get(name);
  }

  static list(): string[] {
    return Array.from(this.aliases.keys());
  }

  static describe(name: string): SchemaEntry | undefined {
    return this.schemas.get(name);
  }
}
```

### ⏱️ Hour 4: Scaffold Agent Types

Create `src/agents/scaffold.ts`:
```typescript
import { z } from 'zod';
import { AgentTaskSchema, AgentResultSchema } from '../core/schemas';

// Scaffold-specific task
export const ScaffoldTaskSchema = AgentTaskSchema.extend({
  agent_type: z.literal('scaffold'),
  action: z.enum(['generate_structure', 'analyze_requirements', 'create_templates']),
  payload: z.object({
    project_type: z.enum(['app', 'service', 'feature', 'capability']),
    name: z.string().min(1).max(100),
    description: z.string().max(500),
    tech_stack: z.object({
      framework: z.string().optional(),
      language: z.enum(['typescript', 'javascript']).default('typescript'),
      testing: z.enum(['vitest', 'jest']).default('vitest'),
      bundler: z.enum(['vite', 'webpack', 'rollup']).optional(),
    }).optional(),
    requirements: z.array(z.string()).min(1),
    template_overrides: z.record(z.string()).optional(),
  }),
});

// Scaffold-specific result
export const ScaffoldResultSchema = AgentResultSchema.extend({
  action: z.enum(['generate_structure', 'analyze_requirements', 'create_templates']),
  result: z.object({
    files_generated: z.array(z.object({
      path: z.string(),
      type: z.enum(['source', 'config', 'test', 'doc', 'template']),
      size_bytes: z.number().nonnegative(),
      checksum: z.string().optional(),
    })),
    structure: z.object({
      directories: z.array(z.string()),
      entry_points: z.array(z.string()),
      config_files: z.array(z.string()),
    }),
    templates_used: z.array(z.string()),
    analysis: z.object({
      estimated_complexity: z.enum(['low', 'medium', 'high']),
      recommended_agents: z.array(z.string()),
      dependencies_identified: z.array(z.string()),
    }).optional(),
    metrics: z.object({
      total_files: z.number(),
      total_size_bytes: z.number(),
      generation_time_ms: z.number(),
    }),
  }),
});

export type ScaffoldTask = z.infer<typeof ScaffoldTaskSchema>;
export type ScaffoldResult = z.infer<typeof ScaffoldResultSchema>;

// Type guards
export function isScaffoldTask(task: unknown): task is ScaffoldTask {
  return ScaffoldTaskSchema.safeParse(task).success;
}

export function isScaffoldResult(result: unknown): result is ScaffoldResult {
  return ScaffoldResultSchema.safeParse(result).success;
}
```

### ⏱️ Hour 5: Create Index Exports

Create `src/index.ts`:
```typescript
// Core exports
export * from './core/brands';
export * from './core/schemas';

// Registry
export { SchemaRegistry } from './registry/schema-registry';

// Agent types
export * from './agents/scaffold';

// Initialize registry with core schemas
import { SchemaRegistry } from './registry/schema-registry';
import {
  WorkflowSchema,
  AgentTaskSchema,
  AgentResultSchema
} from './core/schemas';
import {
  ScaffoldTaskSchema,
  ScaffoldResultSchema
} from './agents/scaffold';

// Auto-register core schemas on import
SchemaRegistry.register('workflow', WorkflowSchema, '1.0.0', 'Core workflow schema');
SchemaRegistry.register('agent.task', AgentTaskSchema, '1.0.0', 'Base agent task');
SchemaRegistry.register('agent.result', AgentResultSchema, '1.0.0', 'Base agent result');
SchemaRegistry.register('scaffold.task', ScaffoldTaskSchema, '1.0.0', 'Scaffold agent task');
SchemaRegistry.register('scaffold.result', ScaffoldResultSchema, '1.0.0', 'Scaffold agent result');
```

### ⏱️ Hour 6: Test Utils Package

```bash
# Create test utils package
mkdir -p packages/shared/test-utils/src/{mocks,factories,setup}
cd packages/shared/test-utils

# package.json
cat > package.json << 'EOF'
{
  "name": "@agentic-sdlc/test-utils",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@agentic-sdlc/shared-types": "workspace:*",
    "vitest": "^1.6.0"
  },
  "devDependencies": {
    "typescript": "^5.3.3",
    "@types/node": "^20.11.0"
  }
}
EOF

pnpm install
```

Create `src/mocks/redis.mock.ts`:
```typescript
import { vi } from 'vitest';

type MessageHandler = (message: string) => void;

export function createRedisMock() {
  const subscribedChannels = new Map<string, Set<MessageHandler>>();
  const messageHandlers = new Set<(channel: string, message: string) => void>();

  return {
    subscribe: vi.fn(async (channel: string | string[]) => {
      const channels = Array.isArray(channel) ? channel : [channel];
      channels.forEach(ch => {
        if (!subscribedChannels.has(ch)) {
          subscribedChannels.set(ch, new Set());
        }
      });
      return channels.length;
    }),

    publish: vi.fn(async (channel: string, message: string) => {
      // Simulate message delivery to subscribers
      const handlers = subscribedChannels.get(channel);
      if (handlers) {
        handlers.forEach(handler => handler(message));
      }
      // Also notify global message handlers
      messageHandlers.forEach(handler => handler(channel, message));
      return 1;
    }),

    on: vi.fn((event: string, handler: any) => {
      if (event === 'message') {
        messageHandlers.add(handler);
      }
      return this;
    }),

    off: vi.fn((event: string, handler: any) => {
      if (event === 'message') {
        messageHandlers.delete(handler);
      }
      return this;
    }),

    disconnect: vi.fn(async () => {}),
    quit: vi.fn(async () => {}),

    // Test helper methods
    simulateMessage: (channel: string, message: string) => {
      messageHandlers.forEach(handler => handler(channel, message));
    },

    getSubscriptions: () => Array.from(subscribedChannels.keys()),

    clearAll: () => {
      subscribedChannels.clear();
      messageHandlers.clear();
    },
  };
}

export type RedisMock = ReturnType<typeof createRedisMock>;
```

### ⏱️ Hour 7: Scaffold Agent Migration

Update `packages/agents/scaffold-agent/package.json`:
```json
{
  "dependencies": {
    "@agentic-sdlc/shared-types": "workspace:*",
    "@agentic-sdlc/test-utils": "workspace:*"
    // ... other deps
  }
}
```

Update `packages/agents/scaffold-agent/src/scaffold-agent.ts`:
```typescript
import {
  ScaffoldTask,
  ScaffoldResult,
  SchemaRegistry,
  toAgentId,
  toTaskId,
  toWorkflowId
} from '@agentic-sdlc/shared-types';

export class ScaffoldAgent extends BaseAgent {
  private agentId = toAgentId(`scaffold-agent-${Date.now()}`);

  async execute(task: ScaffoldTask): Promise<ScaffoldResult> {
    // Validate input
    const validatedTask = SchemaRegistry.validate<ScaffoldTask>(
      'scaffold.task',
      task
    );

    const startTime = Date.now();

    try {
      // Execute scaffolding logic
      const result = await this.generateStructure(validatedTask);

      // Create result
      const scaffoldResult: ScaffoldResult = {
        task_id: validatedTask.task_id,
        workflow_id: validatedTask.workflow_id,
        agent_id: this.agentId,
        success: true,
        action: validatedTask.action,
        result,
        duration_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      };

      // Validate output
      return SchemaRegistry.validate<ScaffoldResult>(
        'scaffold.result',
        scaffoldResult
      );
    } catch (error) {
      // Handle errors with proper typing
      return {
        task_id: validatedTask.task_id,
        workflow_id: validatedTask.workflow_id,
        agent_id: this.agentId,
        success: false,
        action: validatedTask.action,
        result: {
          files_generated: [],
          structure: { directories: [], entry_points: [], config_files: [] },
          templates_used: [],
          metrics: { total_files: 0, total_size_bytes: 0, generation_time_ms: 0 },
        },
        error: error instanceof Error ? error.message : String(error),
        duration_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      };
    }
  }
}
```

### ⏱️ Hour 8: Verify Happy Path

Create test file `packages/orchestrator/tests/e2e/happy-path-milestone-1.test.ts`:
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SchemaRegistry, WorkflowSchema, ScaffoldTaskSchema } from '@agentic-sdlc/shared-types';
import { createRedisMock } from '@agentic-sdlc/test-utils';

describe('Milestone 1: Happy Path E2E Test', () => {
  let orchestrator: any;
  let scaffoldAgent: any;
  let redis: ReturnType<typeof createRedisMock>;

  beforeAll(async () => {
    redis = createRedisMock();

    // Start services
    orchestrator = await startOrchestrator({ redis });
    scaffoldAgent = await startScaffoldAgent({ redis });
  });

  afterAll(async () => {
    await orchestrator?.stop();
    await scaffoldAgent?.stop();
  });

  it('should complete scaffold workflow with full type safety', async () => {
    // Create workflow
    const workflow = {
      workflow_id: 'test-workflow-1',
      type: 'app' as const,
      name: 'test-app',
      current_state: 'initiated' as const,
      progress: 0,
      version: '1.0.0' as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Validate workflow
    const validatedWorkflow = SchemaRegistry.validate('workflow', workflow);
    expect(validatedWorkflow.workflow_id).toBeDefined();

    // Create scaffold task
    const task = {
      task_id: 'test-task-1',
      workflow_id: workflow.workflow_id,
      agent_type: 'scaffold' as const,
      action: 'generate_structure' as const,
      payload: {
        project_type: 'app' as const,
        name: 'test-app',
        description: 'Test application',
        requirements: ['Authentication', 'Dashboard'],
      },
      version: '1.0.0' as const,
      timeout_ms: 120000,
      retry_count: 0,
      max_retries: 3,
      created_at: new Date().toISOString(),
    };

    // Validate task
    const validatedTask = SchemaRegistry.validate('scaffold.task', task);
    expect(validatedTask.agent_type).toBe('scaffold');

    // Dispatch task
    await redis.publish('agent:scaffold:tasks', JSON.stringify(validatedTask));

    // Wait for result
    const result = await new Promise((resolve) => {
      redis.on('message', (channel: string, message: string) => {
        if (channel === 'orchestrator:results') {
          resolve(JSON.parse(message));
        }
      });
    });

    // Validate result
    const validatedResult = SchemaRegistry.validate('scaffold.result', result);
    expect(validatedResult.success).toBe(true);
    expect(validatedResult.result.files_generated).toBeDefined();
    expect(validatedResult.result.files_generated.length).toBeGreaterThan(0);
  });
});
```

---

## ✅ Verification Checklist

### Build Verification
```bash
# 1. Build shared types
cd packages/shared/types
pnpm build
ls -la dist/  # Should see compiled .js and .d.ts files

# 2. Build test utils
cd ../test-utils
pnpm build

# 3. Type check scaffold agent
cd ../../agents/scaffold-agent
pnpm typecheck  # Should have 0 errors

# 4. Run happy path test
cd ../../orchestrator
pnpm test happy-path-milestone-1.test.ts
```

### Success Indicators
- ✅ `packages/shared/types` builds without errors
- ✅ Schema Registry can validate workflows
- ✅ Scaffold agent imports types successfully
- ✅ Type checking passes with 0 errors
- ✅ Happy path E2E test passes

---

## 🚨 Common Issues & Solutions

### Issue 1: Module Resolution
```bash
# If "@agentic-sdlc/shared-types" not found:
pnpm install  # From root to link workspaces
```

### Issue 2: Type Errors in Agent
```typescript
// Ensure all branded types use helper functions:
const workflowId = toWorkflowId(rawId);  // ✅
const workflowId = rawId as WorkflowId;  // ❌
```

### Issue 3: Schema Validation Failures
```typescript
// Always validate at boundaries:
const validated = SchemaRegistry.validate<ScaffoldTask>('scaffold.task', input);
// Use validated object, not original input
```

---

## 📊 Milestone 1 Completion Metrics

```
Before Starting:
- Type Errors: 67
- Working E2E Tests: 0
- Type-Safe Agents: 0

After Milestone 1 (8 hours):
- Type Errors: ~48 (scaffold path fixed)
- Working E2E Tests: 1 (happy path)
- Type-Safe Agents: 1 (scaffold)
- Schema Registry: ✅ Operational
- Test Infrastructure: ✅ Ready
```

---

## 🎯 Next Steps (Milestone 2 Preview)

Once Milestone 1 is complete:
1. Extend types for validation and e2e agents
2. Implement contract testing framework
3. Migrate validation and e2e agents
4. Create multi-stage pipeline test
5. Achieve 3-agent working pipeline

---

*Milestone 1 Quick Start Guide - Get to Happy Path in 8 Hours*