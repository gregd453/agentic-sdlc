# Strategic Refactoring Plan V2 - Milestone-Based Happy Path Approach

**Version:** 2.0
**Date:** 2025-11-08
**Strategy:** Happy Path First → Expand Foundation → Complete Coverage
**Target:** 9.8/10 Production Readiness

---

## Executive Summary

This updated plan takes a **milestone-based approach** focusing on achieving a **working happy path end-to-end** before expanding. Each milestone delivers independently valuable functionality with clear success criteria.

**Core Strategy:**
1. **Milestone 1:** Minimal viable happy path (1 agent → orchestrator → result)
2. **Milestone 2:** Expand to critical agents (validation + scaffold)
3. **Milestone 3:** Complete agent coverage
4. **Milestone 4:** Production hardening
5. **Milestone 5:** Advanced capabilities

**Timeline:** 5 milestones over 10 days (2 weeks)
**First Working System:** Day 2 (Milestone 1)

---

## Milestone 1: Happy Path Foundation (Days 1-2)

### Goal: Single Agent E2E Working Flow
**Success Criteria:** Can execute `scaffold-agent` task from API to completion with proper types

### Phase 1.1: Core Type System (4 hours)

#### Create Minimal Shared Types Package
```bash
# Create package structure
packages/shared/types/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts
│   ├── core/
│   │   ├── schemas.ts      # Core schemas only
│   │   └── brands.ts       # Type branding
│   ├── agents/
│   │   └── scaffold.ts     # Scaffold agent types only
│   └── registry/
│       └── schema-registry.ts
```

**Implementation:**
```typescript
// packages/shared/types/src/core/schemas.ts
import { z } from 'zod';

// Type branding for ID safety
export type WorkflowId = string & { __brand: 'WorkflowId' };
export type AgentId = string & { __brand: 'AgentId' };
export type TaskId = string & { __brand: 'TaskId' };

// Version metadata for future compatibility
const VERSION = '1.0.0' as const;

// Core workflow schema
export const WorkflowSchema = z.object({
  workflow_id: z.string().transform(id => id as WorkflowId),
  type: z.enum(['app', 'service', 'feature', 'capability']),
  current_state: z.enum(['initiated', 'scaffolding', 'validating', 'testing', 'completed', 'failed']),
  version: z.literal(VERSION),
  metadata: z.record(z.unknown()).optional(),
});

// Base agent communication
export const AgentTaskSchema = z.object({
  task_id: z.string().transform(id => id as TaskId),
  workflow_id: z.string().transform(id => id as WorkflowId),
  agent_type: z.string(),
  action: z.string(),
  payload: z.record(z.unknown()),
  version: z.literal(VERSION),
  timeout_ms: z.number().default(120000),
  retry_count: z.number().default(0),
  max_retries: z.number().default(3),
});

export const AgentResultSchema = z.object({
  task_id: z.string().transform(id => id as TaskId),
  workflow_id: z.string().transform(id => id as WorkflowId),
  agent_id: z.string().transform(id => id as AgentId),
  success: z.boolean(),
  action: z.string(),
  result: z.record(z.unknown()),
  error: z.string().optional(),
  duration_ms: z.number(),
  timestamp: z.string().datetime(),
  version: z.literal(VERSION),
});

// Type exports
export type Workflow = z.infer<typeof WorkflowSchema>;
export type AgentTask = z.infer<typeof AgentTaskSchema>;
export type AgentResult = z.infer<typeof AgentResultSchema>;

// packages/shared/types/src/registry/schema-registry.ts
export class SchemaRegistry {
  private static schemas = new Map<string, z.ZodSchema>();
  private static versions = new Map<string, string>();

  static register(name: string, schema: z.ZodSchema, version = '1.0.0') {
    const key = `${name}:${version}`;
    this.schemas.set(key, schema);
    this.versions.set(name, version);

    // Also register without version for latest
    this.schemas.set(name, schema);
  }

  static validate<T>(name: string, data: unknown, version?: string): T {
    const key = version ? `${name}:${version}` : name;
    const schema = this.schemas.get(key);

    if (!schema) {
      throw new Error(`Schema ${key} not registered`);
    }

    return schema.parse(data) as T;
  }

  static getVersion(name: string): string | undefined {
    return this.versions.get(name);
  }
}

// packages/shared/types/src/agents/scaffold.ts
import { z } from 'zod';
import { AgentTaskSchema, AgentResultSchema } from '../core/schemas';

// Scaffold-specific task
export const ScaffoldTaskSchema = AgentTaskSchema.extend({
  agent_type: z.literal('scaffold'),
  action: z.enum(['generate_structure', 'analyze_requirements']),
  payload: z.object({
    project_type: z.enum(['app', 'service', 'feature', 'capability']),
    name: z.string(),
    description: z.string(),
    tech_stack: z.record(z.string()).optional(),
    requirements: z.array(z.string()),
  }),
});

// Scaffold-specific result
export const ScaffoldResultSchema = AgentResultSchema.extend({
  action: z.enum(['generate_structure', 'analyze_requirements']),
  result: z.object({
    files_generated: z.array(z.object({
      path: z.string(),
      type: z.enum(['source', 'config', 'test', 'doc']),
      size_bytes: z.number(),
    })),
    structure: z.record(z.unknown()),
    templates_used: z.array(z.string()),
  }),
});

export type ScaffoldTask = z.infer<typeof ScaffoldTaskSchema>;
export type ScaffoldResult = z.infer<typeof ScaffoldResultSchema>;
```

### Phase 1.2: Test Infrastructure for Happy Path (2 hours)

```typescript
// packages/shared/test-utils/src/setup.ts
import { beforeAll, afterEach, vi } from 'vitest';
import { createRedisMock } from './mocks/redis.mock';
import { createAnthropicMock } from './mocks/anthropic.mock';

export interface TestContext {
  redis: ReturnType<typeof createRedisMock>;
  anthropic: ReturnType<typeof createAnthropicMock>;
}

export function setupHappyPathTest(): TestContext {
  const ctx: TestContext = {
    redis: createRedisMock(),
    anthropic: createAnthropicMock(),
  };

  beforeAll(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
  });

  return ctx;
}

// Error boundary for guaranteed cleanup
export async function withTestContext<T>(
  fn: (ctx: TestContext) => Promise<T>
): Promise<T> {
  const ctx = setupHappyPathTest();
  try {
    return await fn(ctx);
  } finally {
    await ctx.redis.quit();
    vi.restoreAllMocks();
  }
}

// packages/shared/test-utils/src/factories/scaffold.factory.ts
import { ScaffoldTask, ScaffoldResult } from '@agentic-sdlc/shared-types';

export const ScaffoldFactory = {
  task: (overrides = {}): ScaffoldTask => ({
    task_id: 'task-123' as any,
    workflow_id: 'workflow-456' as any,
    agent_type: 'scaffold',
    action: 'generate_structure',
    payload: {
      project_type: 'app',
      name: 'test-app',
      description: 'Test application',
      requirements: ['User authentication', 'Dashboard'],
    },
    version: '1.0.0',
    timeout_ms: 120000,
    retry_count: 0,
    max_retries: 3,
    ...overrides,
  }),

  result: (overrides = {}): ScaffoldResult => ({
    task_id: 'task-123' as any,
    workflow_id: 'workflow-456' as any,
    agent_id: 'scaffold-agent-1' as any,
    success: true,
    action: 'generate_structure',
    result: {
      files_generated: [
        { path: 'src/index.ts', type: 'source', size_bytes: 1024 },
        { path: 'package.json', type: 'config', size_bytes: 512 },
      ],
      structure: { src: {}, tests: {} },
      templates_used: ['app-template-v1'],
    },
    duration_ms: 1500,
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    ...overrides,
  }),
};
```

### Phase 1.3: Scaffold Agent Migration (3 hours)

```bash
# Update scaffold agent to use shared types
cd packages/agents/scaffold-agent

# Update imports in scaffold-agent.ts
# Update tests to use test-utils
# Verify with:
pnpm typecheck
pnpm test
```

### Phase 1.4: Orchestrator Happy Path (3 hours)

Focus only on scaffold workflow:

```typescript
// packages/orchestrator/src/services/workflow-executor.service.ts
import { WorkflowSchema, ScaffoldTaskSchema, ScaffoldResultSchema } from '@agentic-sdlc/shared-types';
import { SchemaRegistry } from '@agentic-sdlc/shared-types/registry';

export class WorkflowExecutorService {
  constructor() {
    // Register schemas on startup
    SchemaRegistry.register('workflow', WorkflowSchema);
    SchemaRegistry.register('scaffold.task', ScaffoldTaskSchema);
    SchemaRegistry.register('scaffold.result', ScaffoldResultSchema);
  }

  async executeScaffoldTask(workflow: Workflow): Promise<void> {
    // Validate workflow
    const validatedWorkflow = SchemaRegistry.validate<Workflow>('workflow', workflow);

    // Create scaffold task
    const task = {
      task_id: generateId(),
      workflow_id: validatedWorkflow.workflow_id,
      agent_type: 'scaffold',
      action: 'generate_structure',
      payload: validatedWorkflow.metadata?.requirements || {},
      version: '1.0.0',
      timeout_ms: 120000,
      retry_count: 0,
      max_retries: 3,
    };

    // Validate and dispatch
    const validatedTask = SchemaRegistry.validate<ScaffoldTask>('scaffold.task', task);
    await this.redis.publish('agent:scaffold:tasks', JSON.stringify(validatedTask));

    // Wait for result...
  }
}
```

### Phase 1.5: E2E Happy Path Test (2 hours)

```typescript
// packages/orchestrator/tests/e2e/happy-path.test.ts
import { describe, it, expect } from 'vitest';
import { withTestContext } from '@agentic-sdlc/test-utils';
import { ScaffoldFactory } from '@agentic-sdlc/test-utils/factories';

describe('Happy Path: Scaffold Workflow', () => {
  it('should complete scaffold task end-to-end', async () => {
    await withTestContext(async (ctx) => {
      // Start orchestrator
      const orchestrator = await startOrchestrator();

      // Start scaffold agent
      const agent = await startScaffoldAgent();

      // Create workflow via API
      const response = await fetch('http://localhost:3000/api/v1/workflows', {
        method: 'POST',
        body: JSON.stringify({
          type: 'app',
          name: 'test-app',
          requirements: ['Authentication', 'Dashboard'],
        }),
      });

      const workflow = await response.json();
      expect(workflow.workflow_id).toBeDefined();

      // Wait for completion
      await waitFor(() => workflow.current_state === 'completed', {
        timeout: 5000,
      });

      // Verify result
      const result = await getWorkflowResult(workflow.workflow_id);
      expect(result.files_generated).toHaveLength(2);
    });
  });
});
```

### 🎯 Milestone 1 Success Criteria
- [ ] Scaffold agent uses shared types
- [ ] Orchestrator dispatches typed tasks
- [ ] E2E test passes
- [ ] Zero type errors for happy path
- [ ] Schema registry operational

**Verification:**
```bash
# Should all pass:
cd packages/shared/types && pnpm build
cd packages/agents/scaffold-agent && pnpm test
cd packages/orchestrator && pnpm test happy-path.test.ts
```

---

## Milestone 2: Critical Path Expansion (Days 3-4)

### Goal: Add Validation + E2E Agents to Happy Path
**Success Criteria:** Complete scaffold → validate → test workflow

### Phase 2.1: Extend Type System (2 hours)

```typescript
// packages/shared/types/src/agents/validation.ts
export const ValidationTaskSchema = AgentTaskSchema.extend({
  agent_type: z.literal('validation'),
  action: z.enum(['validate_code', 'check_quality']),
  payload: z.object({
    file_paths: z.array(z.string()),
    validation_types: z.array(z.enum(['typescript', 'eslint', 'security', 'coverage'])),
    thresholds: z.object({
      coverage: z.number().min(0).max(100).optional(),
      complexity: z.number().optional(),
    }).optional(),
  }),
});

// packages/shared/types/src/agents/e2e.ts
export const E2ETaskSchema = AgentTaskSchema.extend({
  agent_type: z.literal('e2e'),
  action: z.enum(['generate_tests', 'execute_tests']),
  payload: z.object({
    requirements: z.array(z.string()),
    test_type: z.enum(['ui', 'api', 'integration']),
    browsers: z.array(z.enum(['chromium', 'firefox', 'webkit'])).optional(),
  }),
});
```

### Phase 2.2: Contract Testing Framework (3 hours)

```typescript
// packages/shared/contracts/src/validator.ts
import { z } from 'zod';

export class ContractValidator {
  private contracts = new Map<string, ContractDefinition>();

  register(name: string, contract: ContractDefinition) {
    this.contracts.set(name, contract);
  }

  async validate(name: string, implementation: () => Promise<any>): Promise<void> {
    const contract = this.contracts.get(name);
    if (!contract) throw new Error(`Contract ${name} not found`);

    const result = await implementation();

    // Validate request/response
    contract.request?.parse(result.request);
    contract.response?.parse(result.response);

    // Validate invariants
    for (const invariant of contract.invariants || []) {
      if (!invariant(result)) {
        throw new Error(`Contract invariant failed: ${name}`);
      }
    }
  }
}

// Usage in tests
describe('Validation Agent Contract', () => {
  it('should fulfill validation contract', async () => {
    const validator = new ContractValidator();

    validator.register('validation.execute', {
      request: ValidationTaskSchema,
      response: ValidationResultSchema,
      invariants: [
        (result) => result.duration_ms > 0,
        (result) => result.success || result.error,
      ],
    });

    await validator.validate('validation.execute', async () => {
      const agent = new ValidationAgent();
      const task = ValidationFactory.task();
      const result = await agent.execute(task);
      return { request: task, response: result };
    });
  });
});
```

### Phase 2.3: Migrate Critical Agents (4 hours)

```bash
# Parallel migration of validation and e2e agents
cd packages/agents/validation-agent
# Update to use shared types, test-utils, contracts

cd packages/agents/e2e-agent
# Update to use shared types, test-utils, contracts

# Both should pass:
pnpm test
pnpm typecheck
```

### Phase 2.4: Orchestrator Pipeline (3 hours)

```typescript
// packages/orchestrator/src/services/pipeline-executor.service.ts
import { SchemaRegistry } from '@agentic-sdlc/shared-types/registry';

export class PipelineExecutor {
  async executePipeline(workflow: Workflow): Promise<void> {
    const stages = [
      { agent: 'scaffold', action: 'generate_structure' },
      { agent: 'validation', action: 'validate_code' },
      { agent: 'e2e', action: 'generate_tests' },
      { agent: 'e2e', action: 'execute_tests' },
    ];

    for (const stage of stages) {
      const task = this.createTask(workflow, stage);
      const validatedTask = SchemaRegistry.validate(`${stage.agent}.task`, task);

      await this.dispatchTask(validatedTask);
      const result = await this.waitForResult(task.task_id);

      if (!result.success) {
        throw new Error(`Stage failed: ${stage.agent}.${stage.action}`);
      }
    }
  }
}
```

### Phase 2.5: Integration Tests (2 hours)

```typescript
// packages/orchestrator/tests/integration/critical-path.test.ts
describe('Critical Path: Scaffold → Validate → Test', () => {
  it('should complete full workflow', async () => {
    // Test the complete happy path with 3 agents
  });
});
```

### 🎯 Milestone 2 Success Criteria
- [ ] 3 agents using shared types (scaffold, validation, e2e)
- [ ] Contract tests passing
- [ ] Pipeline executor working
- [ ] Integration test passing
- [ ] < 10 type errors total

---

## Milestone 3: Complete Agent Coverage (Days 5-6)

### Goal: All Agents Migrated
**Success Criteria:** All 6 agents operational with shared infrastructure

### Phase 3.1: Remaining Agent Types (2 hours)

```typescript
// Add types for integration, deployment, base agents
// Follow same pattern as scaffold/validation
```

### Phase 3.2: Agent Migration Sprint (6 hours)

```bash
# Migrate in dependency order:
1. base-agent (if not already done)
2. integration-agent
3. deployment-agent

# Each agent:
- Update imports
- Add contract tests
- Fix type errors
- Verify tests pass
```

### Phase 3.3: Orchestrator Complete (4 hours)

- Fix all remaining type errors
- Update all services to use SchemaRegistry
- Add WebSocket type safety
- Complete state machine types

### 🎯 Milestone 3 Success Criteria
- [ ] All 6 agents migrated
- [ ] All orchestrator services typed
- [ ] Full E2E test suite passing
- [ ] 0 type errors
- [ ] 90%+ test coverage

---

## Milestone 4: Production Hardening (Days 7-8)

### Goal: Production-Ready System
**Success Criteria:** Security, observability, error handling complete

### Phase 4.1: Error Standardization (3 hours)

```typescript
// packages/shared/errors/src/index.ts
export class AgentError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly context?: Record<string, unknown>,
    public readonly retryable = false
  ) {
    super(message);
    this.name = 'AgentError';
  }

  static fromUnknown(error: unknown): AgentError {
    if (error instanceof AgentError) return error;
    if (error instanceof Error) {
      return new AgentError('UNKNOWN_ERROR', error.message);
    }
    return new AgentError('UNKNOWN_ERROR', String(error));
  }
}

export const ErrorCodes = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  TIMEOUT: 'TIMEOUT',
  RATE_LIMITED: 'RATE_LIMITED',
  // ... more codes
} as const;
```

### Phase 4.2: Observability Layer (4 hours)

```typescript
// packages/shared/observability/src/index.ts
export class TypedMetrics<T extends Record<string, number>> {
  record<K extends keyof T>(metric: K, value: T[K]): void {
    // Type-safe metric recording
    metrics.gauge(String(metric), value);
  }
}

export class TraceContext {
  constructor(
    private traceId: string,
    private spanId: string
  ) {}

  child(): TraceContext {
    return new TraceContext(this.traceId, generateSpanId());
  }

  async traced<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const span = tracer.startSpan(name);
    try {
      return await fn();
    } finally {
      span.end();
    }
  }
}
```

### Phase 4.3: Security Hardening (3 hours)

```bash
# Update all dependencies
pnpm update --latest
pnpm audit fix

# Add security headers
# Add rate limiting
# Add input sanitization
```

### Phase 4.4: Configuration Management (2 hours)

```typescript
// packages/shared/config/src/index.ts
const ConfigSchema = z.object({
  env: z.enum(['development', 'staging', 'production']),
  redis: z.object({
    url: z.string().url(),
    maxRetries: z.number().default(3),
  }),
  agents: z.object({
    timeout: z.number().default(120000),
    maxConcurrent: z.number().default(10),
  }),
});

export class Config {
  private static instance: z.infer<typeof ConfigSchema>;

  static load(): void {
    this.instance = ConfigSchema.parse({
      env: process.env.NODE_ENV,
      redis: {
        url: process.env.REDIS_URL,
        maxRetries: Number(process.env.REDIS_MAX_RETRIES || 3),
      },
      // ...
    });
  }

  static get(): z.infer<typeof ConfigSchema> {
    if (!this.instance) this.load();
    return this.instance;
  }
}
```

### 🎯 Milestone 4 Success Criteria
- [ ] Standardized error handling
- [ ] Observability integrated
- [ ] 0 security vulnerabilities
- [ ] Configuration management
- [ ] Production deployment ready

---

## Milestone 5: Advanced Capabilities (Days 9-10)

### Goal: Performance & Scalability
**Success Criteria:** System optimized for production load

### Phase 5.1: Schema Evolution (2 hours)

```typescript
// packages/shared/types/src/evolution/index.ts
export class SchemaEvolution {
  static migrate<T>(
    data: unknown,
    fromVersion: string,
    toVersion: string
  ): T {
    const migrations = this.getMigrations(fromVersion, toVersion);

    let current = data;
    for (const migration of migrations) {
      current = migration(current);
    }

    return current as T;
  }

  private static getMigrations(from: string, to: string) {
    // Return migration functions
    return [];
  }
}
```

### Phase 5.2: Performance Optimization (4 hours)

- Connection pooling optimization
- Caching layer implementation
- Batch processing for agents
- Async queue management

### Phase 5.3: Advanced Testing (3 hours)

- Load testing suite
- Chaos engineering tests
- Contract compatibility tests
- Performance regression tests

### Phase 5.4: Documentation (3 hours)

- API documentation generation
- Architecture decision records
- Runbooks for common issues
- Migration guides

### 🎯 Milestone 5 Success Criteria
- [ ] Schema versioning operational
- [ ] Performance benchmarks met
- [ ] Advanced test suite complete
- [ ] Documentation complete
- [ ] 9.8/10 production readiness achieved

---

## Implementation Schedule

### Week 1 (Days 1-5)
**Monday-Tuesday:** Milestone 1 - Happy Path Foundation ✅
- Morning: Core types & test utils
- Afternoon: Scaffold agent migration
- Next day: Orchestrator & E2E test

**Wednesday-Thursday:** Milestone 2 - Critical Path ✅
- Morning: Extend types for validation/e2e
- Afternoon: Contract testing framework
- Next day: Agent migrations & pipeline

**Friday:** Milestone 3 Start - Coverage
- Complete remaining type definitions
- Begin agent migration sprint

### Week 2 (Days 6-10)
**Monday:** Milestone 3 Complete - Full Coverage ✅
- Complete all agent migrations
- Fix all orchestrator type errors

**Tuesday-Wednesday:** Milestone 4 - Production Hardening ✅
- Error handling standardization
- Observability implementation
- Security hardening

**Thursday-Friday:** Milestone 5 - Advanced Features ✅
- Schema evolution
- Performance optimization
- Advanced testing
- Documentation

---

## Risk Management

### Risk Matrix

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Happy path breaks | High | Low | Comprehensive E2E test after each change |
| Migration introduces bugs | High | Medium | Incremental migration with rollback points |
| Performance regression | Medium | Low | Benchmark before/after each milestone |
| Schema incompatibility | High | Low | Version all schemas from start |
| Timeline slip | Low | Medium | Each milestone independently valuable |

### Rollback Strategy

Each milestone has a git tag for easy rollback:
```bash
git tag milestone-1-happy-path
git tag milestone-2-critical-path
git tag milestone-3-full-coverage
git tag milestone-4-production-ready
git tag milestone-5-advanced
```

---

## Success Metrics Dashboard

### Milestone Progress
```
[✅] M1: Happy Path        Day 2  | Types: ✓ | Tests: ✓ | E2E: ✓
[⏳] M2: Critical Path     Day 4  | Types: - | Tests: - | E2E: -
[  ] M3: Full Coverage     Day 6  | Types: - | Tests: - | E2E: -
[  ] M4: Production Ready  Day 8  | Security: - | Observability: -
[  ] M5: Advanced         Day 10  | Performance: - | Docs: -
```

### Quality Metrics
```
Type Errors:     67 → 48 → 10 → 0
Test Coverage:   78% → 85% → 90% → 95%
Test Passing:    277/299 → 290/299 → 299/299
Build Success:   ❌ → ⚠️ → ✅
Vulnerabilities: 3 → 1 → 0
Prod Readiness:  6.5 → 7.5 → 8.5 → 9.5 → 9.8
```

---

## Daily Checklist

### Day Start
- [ ] Review milestone objectives
- [ ] Check CI/CD status
- [ ] Pull latest changes
- [ ] Run test suite baseline

### During Development
- [ ] Commit after each successful phase
- [ ] Run tests after major changes
- [ ] Update progress metrics
- [ ] Document any deviations

### Day End
- [ ] Push all changes
- [ ] Update milestone progress
- [ ] Tag if milestone complete
- [ ] Plan next day priorities

---

## Key Commands Reference

```bash
# Happy Path Testing
cd packages/orchestrator
pnpm test happy-path.test.ts

# Type Checking Progress
pnpm typecheck 2>&1 | grep error | wc -l

# Coverage Report
pnpm test --coverage

# Security Audit
pnpm audit

# Build All
pnpm build

# E2E Test Suite
pnpm test:e2e

# Performance Benchmark
pnpm benchmark

# Generate Docs
pnpm docs:generate
```

---

## Conclusion

This milestone-based approach ensures:
1. **Working system by Day 2** (happy path)
2. **Incremental value delivery** (each milestone stands alone)
3. **Risk mitigation** (rollback points, comprehensive testing)
4. **Clear progress tracking** (metrics dashboard)
5. **Production readiness by Day 10** (9.8/10 score)

The focus on getting a happy path working first means the team can:
- Validate the architecture early
- Have a working reference implementation
- Build confidence through incremental success
- Maintain momentum with visible progress

**Next Step:** Begin with Milestone 1, Phase 1.1 - Create the core shared types package.

---

*Plan Version 2.0 | Created: 2025-11-08 | Target Completion: 2 weeks*