# CLAUDE.md - AI Assistant Guide for Agentic SDLC Project

**Version:** 2.0
**Last Updated:** 2025-11-05
**Major Update:** Added comprehensive AI-CONTEXT file references and implementation guidance
**Purpose:** This document provides comprehensive guidance for AI assistants (Claude, GPT-4, etc.) working on the Agentic SDLC system.

---

## Table of Contents

- [Important Note for AI Agents](#important-note-for-ai-agents)
- [Project Overview](#project-overview)
- [Core Principles](#core-principles)
- [Project Architecture](#project-architecture)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Agent Development Guidelines](#agent-development-guidelines)
- [Testing Strategies](#testing-strategies)
- [Common Tasks](#common-tasks)
- [Troubleshooting](#troubleshooting)
- [Reference Documentation](#reference-documentation)

---

## Important Note for AI Agents

**🚨 CRITICAL: Before implementing any component, you MUST consult the AI-CONTEXT directory files.**

The `AI-CONTEXT/` directory contains essential patterns, contracts, and pre-solved solutions that ensure consistency and quality across the entire Agentic SDLC system. These files are your primary reference for:

1. **Code Patterns** - Standard templates for all components
2. **API Contracts** - Message schemas and endpoint specifications
3. **Testing Guidelines** - Required coverage and test patterns
4. **Integration Patterns** - External service connections
5. **Decision Trees** - Autonomous decision-making logic
6. **Common Solutions** - Pre-solved problems and optimizations

### Quick Reference Guide for Implementation:

| Task | Primary Reference | Secondary References |
|------|------------------|---------------------|
| Creating a new agent | CODE-PATTERNS.md | API-CONTRACTS.md, TESTING-GUIDELINES.md |
| Adding API endpoint | API-CONTRACTS.md | CODE-PATTERNS.md, TESTING-GUIDELINES.md |
| Writing tests | TESTING-GUIDELINES.md | CODE-PATTERNS.md |
| Handling errors | DECISION-TREES.md | COMMON-SOLUTIONS.md |
| Database operations | INTEGRATION-PATTERNS.md | COMMON-SOLUTIONS.md |
| LLM integration | INTEGRATION-PATTERNS.md | COMMON-SOLUTIONS.md, API-CONTRACTS.md |
| Performance issues | COMMON-SOLUTIONS.md | INTEGRATION-PATTERNS.md |

**Remember:** These patterns have been battle-tested and optimized. Using them ensures your implementation will integrate seamlessly with the rest of the system.

---

## Project Overview

### What is This Project?

The **Agentic SDLC** system is a fully autonomous, AI-driven software development lifecycle platform that:
- Automatically generates production-ready applications from requirements
- Validates code through automated quality gates
- Runs comprehensive E2E testing
- Deploys applications to AWS infrastructure
- Monitors and self-heals production systems

### Key Technologies

```yaml
Core Platform:
  - Language: TypeScript/Node.js 20+
  - Framework: Fastify (backend), Next.js (frontend)
  - Monorepo: Turborepo + pnpm workspaces
  - Database: PostgreSQL 16 + Redis 7
  - Message Queue: Redis Streams

AI/ML:
  - Primary LLM: Anthropic Claude Sonnet 4.5
  - Fallback: OpenAI GPT-4
  - Orchestration: LangGraph
  - Vector DB: Pinecone/Weaviate

Testing:
  - Unit: Vitest
  - E2E: Playwright
  - Contract: Zod schemas

Infrastructure:
  - Containers: Docker
  - Orchestration: AWS ECS/Fargate
  - IaC: Terraform
  - CI/CD: GitHub Actions
```

### Project Goals

1. **Zero-touch deployments** from requirements to production
2. **100% test coverage** with automated quality gates
3. **Sub-2-hour** scaffold-to-deploy time
4. **Self-healing** production systems
5. **Full auditability** of all changes

---

## Core Principles

When working on this project, always adhere to these principles:

### 1. Contracts-First Development

**Always define contracts before implementation.**

```typescript
// ✅ GOOD: Define Zod schema first
export const WorkflowSchema = z.object({
  workflow_id: z.string().uuid(),
  type: z.enum(['app', 'capability', 'feature']),
  domain: z.string().min(1),
  name: z.string().min(1),
  current_state: z.enum(['initiated', 'scaffolding', 'validating', ...]),
  context: z.record(z.unknown())
});

export type Workflow = z.infer<typeof WorkflowSchema>;

// Then implement
class WorkflowRepository {
  async save(workflow: Workflow): Promise<void> {
    // Validate before saving
    const validated = WorkflowSchema.parse(workflow);
    // ... implementation
  }
}

// ❌ BAD: Implementation without contract
class WorkflowRepository {
  async save(workflow: any): Promise<void> {
    // No validation, no type safety
  }
}
```

### 2. Isolation-First Architecture

**All new capabilities must be developed in isolation and validated before integration.**

```bash
# ✅ GOOD: Isolated development
./scripts/scaffold.sh capability user user-rewards-ui --isolated
# Develop, test, validate
./scripts/validate.sh
./scripts/e2e.sh user-rewards
# Only then integrate
./scripts/integrate.sh user-rewards-ui

# ❌ BAD: Direct integration
./scripts/scaffold.sh capability user user-rewards-ui --integrated
# Immediate integration without validation
```

### 3. Automated Gates

**Every stage must have automated validation. No manual checks.**

```typescript
// ✅ GOOD: Automated validation at every stage
interface StageGate {
  validate(): Promise<ValidationResult>;
  canProceed(): boolean;
}

class ValidationStage implements StageGate {
  async validate(): Promise<ValidationResult> {
    const typecheck = await runTypeCheck();
    const lint = await runLint();
    const tests = await runTests();
    const coverage = await checkCoverage();

    return {
      passed: typecheck.passed && lint.passed && tests.passed && coverage >= 80,
      results: { typecheck, lint, tests, coverage }
    };
  }

  canProceed(): boolean {
    return this.lastValidation?.passed === true;
  }
}

// ❌ BAD: Manual checks
class ValidationStage {
  async validate() {
    console.log('Please manually check types, lint, and tests');
  }
}
```

### 4. Immutable Deployments

**Every deployment is tagged by SHA and can be rolled back instantly.**

```typescript
// ✅ GOOD: SHA-tagged deployments
interface Deployment {
  sha: string;
  image_tag: string; // same as SHA
  timestamp: string;
  rollback_sha?: string;
}

async function deploy(sha: string): Promise<void> {
  const image = `ecr.aws/app:${sha}`;
  await deployToECS(image);
}

async function rollback(deployment: Deployment): Promise<void> {
  if (deployment.rollback_sha) {
    await deploy(deployment.rollback_sha);
  }
}

// ❌ BAD: Mutable deployments
async function deploy(): Promise<void> {
  const image = 'ecr.aws/app:latest'; // No way to rollback
  await deployToECS(image);
}
```

### 5. Observability-Driven

**Every action must be logged, measured, and traceable.**

```typescript
// ✅ GOOD: Full observability
class ScaffoldAgent {
  async execute(task: ScaffoldTask): Promise<ScaffoldResult> {
    const trace_id = generateTraceId();
    const start = Date.now();

    logger.info('Scaffold task started', {
      task_id: task.id,
      trace_id,
      type: task.type,
      domain: task.domain
    });

    try {
      const result = await this.performScaffolding(task);

      metrics.recordDuration('scaffold.duration', Date.now() - start, {
        type: task.type,
        status: 'success'
      });

      logger.info('Scaffold task completed', {
        task_id: task.id,
        trace_id,
        files_generated: result.files_generated
      });

      return result;

    } catch (error) {
      metrics.increment('scaffold.errors', { type: task.type });

      logger.error('Scaffold task failed', {
        task_id: task.id,
        trace_id,
        error: error.message,
        stack: error.stack
      });

      throw error;
    }
  }
}

// ❌ BAD: No observability
class ScaffoldAgent {
  async execute(task: ScaffoldTask): Promise<ScaffoldResult> {
    return await this.performScaffolding(task);
  }
}
```

---

## Project Architecture

### Directory Structure

```
agentic-sdlc/
├── packages/
│   ├── orchestrator/          # Central control plane
│   │   ├── src/
│   │   │   ├── api/           # REST/GraphQL endpoints
│   │   │   ├── state-machine/ # Workflow state machine
│   │   │   ├── agents/        # Agent pool management
│   │   │   └── events/        # Event bus integration
│   │   ├── tests/
│   │   └── package.json
│   │
│   ├── agents/                # Agent implementations
│   │   ├── scaffold-agent/
│   │   │   ├── src/
│   │   │   │   ├── agent.ts           # Main agent class
│   │   │   │   ├── templates/         # Template engine
│   │   │   │   ├── contracts/         # Contract generation
│   │   │   │   └── analyzers/         # Requirement analysis
│   │   │   ├── tests/
│   │   │   └── package.json
│   │   │
│   │   ├── validation-agent/
│   │   ├── e2e-agent/
│   │   ├── integration-agent/
│   │   ├── deployment-agent/
│   │   ├── monitoring-agent/
│   │   └── enhancement-agent/
│   │
│   ├── shared/                # Shared libraries
│   │   ├── types/             # Common TypeScript types
│   │   ├── utils/             # Helper functions
│   │   ├── contracts/         # Message schemas
│   │   ├── db/                # Database clients
│   │   └── logger/            # Logging utilities
│   │
│   └── cli/                   # CLI tool
│       ├── src/
│       └── package.json
│
├── scaffold/                  # Templates and generators
│   ├── templates/
│   │   ├── app-ui/           # Full app template
│   │   ├── service-bff/      # Backend service template
│   │   ├── capability/       # Capability template
│   │   └── feature/          # Feature template
│   └── scripts/
│       └── scaffold.sh
│
├── scripts/                   # Operational scripts
│   ├── validate.sh
│   ├── e2e.sh
│   ├── dev-up.sh
│   ├── build-images.sh
│   └── deploy-aws.sh
│
├── infra/                     # Infrastructure as Code
│   ├── terraform/
│   └── docker/
│
└── docs/                      # Documentation
    ├── AGENTIC-SDLC-ARCHITECTURE.md
    ├── PHASE-1-CAPABILITY-PLAYBOOK.md
    ├── ZYP-AGENTIC-PROCESS-DESIGN.md
    ├── app-requirements.md
    ├── app-template-guide.md
    └── CLAUDE.md (this file)
```

### Agent Interaction Flow

```
User/System Request
       │
       ▼
┌──────────────────┐
│   Orchestrator   │◄────┐
│  (State Machine) │     │
└──────────────────┘     │
       │                 │
       ▼                 │
┌──────────────────┐     │
│   Event Bus      │     │
│ (Redis Streams)  │     │
└──────────────────┘     │
       │                 │
       ▼                 │
┌──────────────────┐     │
│   Agent Pool     │     │
│  - Scaffold      │     │
│  - Validation    │     │
│  - E2E           │─────┘ (Results)
│  - Integration   │
│  - Deployment    │
│  - Monitoring    │
│  - Enhancement   │
└──────────────────┘
       │
       ▼
┌──────────────────┐
│   Target System  │
│  (ZYP Monorepo)  │
└──────────────────┘
```

### Data Flow

```
┌─────────────┐
│   Request   │
└──────┬──────┘
       │
       ▼
┌─────────────────────┐
│  Orchestrator API   │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐     ┌──────────────┐
│   PostgreSQL        │────>│    Redis     │
│  (Workflow State)   │     │   (Cache)    │
└──────┬──────────────┘     └──────────────┘
       │
       ▼
┌─────────────────────┐
│    Event Bus        │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│   Agent (Claude)    │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│   File System       │
│   Git Repository    │
│   AWS Services      │
└─────────────────────┘
```

---

## Development Workflow

### Starting a New Feature

```bash
# 1. Ensure baseline is green
pnpm install
./scripts/validate.sh

# 2. Create feature branch
git checkout -b feat/scaffold-agent-enhancements

# 3. Make changes following patterns
# - Update contracts first (Zod schemas)
# - Implement functionality
# - Add tests
# - Update documentation

# 4. Validate locally
pnpm turbo run typecheck
pnpm turbo run lint
pnpm turbo run test
pnpm turbo run build

# 5. Commit with conventional commits
git add .
git commit -m "feat(scaffold): add support for custom templates"

# 6. Push and create PR
git push origin feat/scaffold-agent-enhancements
gh pr create --title "feat(scaffold): add support for custom templates"
```

### Creating a New Agent

When creating a new agent, follow this pattern:

```typescript
// packages/agents/my-agent/src/agent.ts

import { z } from 'zod';
import { BaseAgent } from '@agentic-sdlc/shared/agents';
import { logger } from '@agentic-sdlc/shared/logger';
import { metrics } from '@agentic-sdlc/shared/metrics';

// 1. Define input schema
export const MyAgentTaskSchema = z.object({
  task_id: z.string().uuid(),
  workflow_id: z.string().uuid(),
  // ... task-specific fields
});

export type MyAgentTask = z.infer<typeof MyAgentTaskSchema>;

// 2. Define output schema
export const MyAgentResultSchema = z.object({
  status: z.enum(['success', 'failure']),
  // ... result-specific fields
  next_stage: z.string().optional()
});

export type MyAgentResult = z.infer<typeof MyAgentResultSchema>;

// 3. Implement agent
export class MyAgent extends BaseAgent<MyAgentTask, MyAgentResult> {
  constructor() {
    super({
      type: 'my-agent',
      version: '1.0.0',
      capabilities: ['capability1', 'capability2']
    });
  }

  async execute(task: MyAgentTask): Promise<MyAgentResult> {
    const trace_id = this.generateTraceId();
    const start = Date.now();

    // Validate input
    const validatedTask = MyAgentTaskSchema.parse(task);

    logger.info('Task started', {
      agent_type: this.type,
      task_id: validatedTask.task_id,
      workflow_id: validatedTask.workflow_id,
      trace_id
    });

    try {
      // Perform work
      const result = await this.doWork(validatedTask);

      // Validate output
      const validatedResult = MyAgentResultSchema.parse(result);

      // Record metrics
      metrics.recordDuration(
        'agent.task.duration',
        Date.now() - start,
        { agent_type: this.type, status: 'success' }
      );

      logger.info('Task completed', {
        agent_type: this.type,
        task_id: validatedTask.task_id,
        trace_id,
        status: validatedResult.status
      });

      return validatedResult;

    } catch (error) {
      metrics.increment('agent.task.errors', { agent_type: this.type });

      logger.error('Task failed', {
        agent_type: this.type,
        task_id: validatedTask.task_id,
        trace_id,
        error: error.message,
        stack: error.stack
      });

      throw error;
    }
  }

  private async doWork(task: MyAgentTask): Promise<MyAgentResult> {
    // Implementation
    return {
      status: 'success'
    };
  }
}
```

### Testing an Agent

```typescript
// packages/agents/my-agent/tests/agent.test.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MyAgent } from '../src/agent';

describe('MyAgent', () => {
  let agent: MyAgent;

  beforeEach(() => {
    agent = new MyAgent();
  });

  describe('execute', () => {
    it('should successfully execute a valid task', async () => {
      const task = {
        task_id: '123e4567-e89b-12d3-a456-426614174000',
        workflow_id: '123e4567-e89b-12d3-a456-426614174001'
      };

      const result = await agent.execute(task);

      expect(result.status).toBe('success');
    });

    it('should throw error for invalid task', async () => {
      const task = {
        // Missing required fields
      };

      await expect(agent.execute(task as any)).rejects.toThrow();
    });

    it('should record metrics on success', async () => {
      const metricsSpy = vi.spyOn(metrics, 'recordDuration');

      const task = {
        task_id: '123e4567-e89b-12d3-a456-426614174000',
        workflow_id: '123e4567-e89b-12d3-a456-426614174001'
      };

      await agent.execute(task);

      expect(metricsSpy).toHaveBeenCalledWith(
        'agent.task.duration',
        expect.any(Number),
        { agent_type: 'my-agent', status: 'success' }
      );
    });
  });
});
```

---

## Coding Standards

### TypeScript Standards

#### 1. Strict Type Safety

```typescript
// ✅ GOOD: Explicit types, no 'any'
interface User {
  id: string;
  email: string;
  name: string | null;
  created_at: Date;
}

function getUser(id: string): Promise<User> {
  // ...
}

// ❌ BAD: Using 'any'
function getUser(id: any): Promise<any> {
  // ...
}
```

#### 2. Discriminated Unions for States

```typescript
// ✅ GOOD: Type-safe state handling
type WorkflowState =
  | { status: 'initiated'; workflow_id: string }
  | { status: 'scaffolding'; workflow_id: string; agent_id: string }
  | { status: 'validating'; workflow_id: string; validation_results: ValidationResult }
  | { status: 'completed'; workflow_id: string; deployment_url: string }
  | { status: 'failed'; workflow_id: string; error: Error };

function handleState(state: WorkflowState): void {
  switch (state.status) {
    case 'initiated':
      console.log('Starting workflow', state.workflow_id);
      break;
    case 'scaffolding':
      console.log('Agent working', state.agent_id);
      break;
    case 'validating':
      console.log('Validation results', state.validation_results);
      break;
    case 'completed':
      console.log('Deployed at', state.deployment_url);
      break;
    case 'failed':
      console.error('Failed with error', state.error);
      break;
  }
}

// ❌ BAD: Loose typing
interface WorkflowState {
  status: string;
  workflow_id?: string;
  agent_id?: string;
  validation_results?: any;
  deployment_url?: string;
  error?: any;
}
```

#### 3. Functional Error Handling

```typescript
// ✅ GOOD: Result type for error handling
type Result<T, E = Error> =
  | { success: true; value: T }
  | { success: false; error: E };

async function validateCode(path: string): Promise<Result<ValidationResult>> {
  try {
    const result = await runValidation(path);
    return { success: true, value: result };
  } catch (error) {
    return { success: false, error: error as Error };
  }
}

// Usage
const result = await validateCode('/path/to/code');
if (result.success) {
  console.log('Validation passed', result.value);
} else {
  console.error('Validation failed', result.error);
}

// ❌ BAD: Throwing errors everywhere
async function validateCode(path: string): Promise<ValidationResult> {
  const result = await runValidation(path); // May throw
  return result;
}
```

#### 4. Const Assertions and Enums

```typescript
// ✅ GOOD: Use const objects with 'as const'
export const WORKFLOW_STATES = {
  INITIATED: 'initiated',
  SCAFFOLDING: 'scaffolding',
  VALIDATING: 'validating',
  E2E_TESTING: 'e2e_testing',
  INTEGRATING: 'integrating',
  DEPLOYING: 'deploying',
  MONITORING: 'monitoring',
  COMPLETED: 'completed',
  FAILED: 'failed'
} as const;

export type WorkflowState = typeof WORKFLOW_STATES[keyof typeof WORKFLOW_STATES];

// Also acceptable: String literal union
export type WorkflowState =
  | 'initiated'
  | 'scaffolding'
  | 'validating'
  | 'e2e_testing'
  | 'integrating'
  | 'deploying'
  | 'monitoring'
  | 'completed'
  | 'failed';

// ❌ AVOID: Enums (unless absolutely necessary)
enum WorkflowState {
  INITIATED = 'initiated',
  SCAFFOLDING = 'scaffolding',
  // ... (enums add runtime overhead and complexity)
}
```

### Naming Conventions

```typescript
// Classes: PascalCase
class ScaffoldAgent {}
class WorkflowOrchestrator {}

// Interfaces/Types: PascalCase
interface AgentTask {}
type WorkflowContext = {};

// Functions/Methods: camelCase
function executeTask() {}
async function deployToAWS() {}

// Constants: UPPER_SNAKE_CASE
const MAX_RETRY_COUNT = 3;
const DEFAULT_TIMEOUT_MS = 30000;

// Variables: camelCase
const workflowId = '123';
const agentPool = new AgentPool();

// Private class members: prefix with underscore
class MyAgent {
  private _internalState: State;
  private _performAction() {}
}

// Files: kebab-case
// scaffold-agent.ts
// workflow-orchestrator.ts
// state-machine.ts
```

### File Organization

```typescript
// Standard file structure for a module:

// 1. Imports (grouped)
import { z } from 'zod';                           // External dependencies
import type { FastifyInstance } from 'fastify';    // Type imports

import { logger } from '@/shared/logger';          // Internal dependencies
import { metrics } from '@/shared/metrics';

import type { AgentTask } from './types';          // Local imports

// 2. Constants
const MAX_RETRIES = 3;
const TIMEOUT_MS = 30000;

// 3. Types/Interfaces/Schemas
export const TaskSchema = z.object({
  // ...
});

export type Task = z.infer<typeof TaskSchema>;

export interface TaskResult {
  // ...
}

// 4. Helper functions (private)
function validateInput(input: unknown): Task {
  return TaskSchema.parse(input);
}

// 5. Main implementation
export class MyAgent {
  // ...
}

// 6. Exports (if not inline)
export { MyAgent };
```

---

## Agent Development Guidelines

### Agent Lifecycle

Every agent follows this lifecycle:

```typescript
interface AgentLifecycle {
  // 1. Initialization
  initialize(): Promise<void>;

  // 2. Task reception
  receiveTask(message: AgentMessage): Promise<void>;

  // 3. Validation
  validateTask(task: unknown): Task;

  // 4. Execution
  execute(task: Task): Promise<Result>;

  // 5. Result reporting
  reportResult(result: Result): Promise<void>;

  // 6. Cleanup
  cleanup(): Promise<void>;

  // 7. Health check
  healthCheck(): Promise<HealthStatus>;
}
```

### Agent Communication Protocol

```typescript
// Message format for agent communication
interface AgentMessage {
  id: string;                    // Unique message ID
  type: 'task' | 'result' | 'error' | 'heartbeat';
  agent_id: string;              // Agent identifier
  workflow_id: string;           // Workflow this belongs to
  stage: SDLCStage;              // Current stage
  payload: Record<string, any>;  // Stage-specific data
  timestamp: string;             // ISO 8601 timestamp
  trace_id: string;              // Distributed tracing ID
  parent_message_id?: string;    // For threading
}

// Example: Task assignment
const taskMessage: AgentMessage = {
  id: 'msg_123',
  type: 'task',
  agent_id: 'scaffold-agent-01',
  workflow_id: 'wf_456',
  stage: 'scaffold',
  payload: {
    type: 'app',
    domain: 'user',
    name: 'user-rewards-ui',
    requirements: '...'
  },
  timestamp: '2025-11-05T12:00:00Z',
  trace_id: 'trace_789'
};

// Example: Result reporting
const resultMessage: AgentMessage = {
  id: 'msg_124',
  type: 'result',
  agent_id: 'scaffold-agent-01',
  workflow_id: 'wf_456',
  stage: 'scaffold',
  payload: {
    status: 'success',
    path: '/apps/user/user-rewards-ui',
    files_generated: 47,
    contracts: ['schemas/reward.schema.ts'],
    next_stage: 'validation'
  },
  timestamp: '2025-11-05T12:05:00Z',
  trace_id: 'trace_789',
  parent_message_id: 'msg_123'
};
```

### Agent Error Handling

```typescript
class BaseAgent {
  protected async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        logger.warn('Operation failed, retrying', {
          agent_id: this.agentId,
          attempt,
          maxRetries,
          error: lastError.message
        });

        if (attempt < maxRetries) {
          // Exponential backoff
          const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 30000);
          await this.sleep(delayMs);
        }
      }
    }

    throw new AgentError(
      `Operation failed after ${maxRetries} attempts`,
      { cause: lastError }
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Custom error types
export class AgentError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'AgentError';
  }
}

export class ValidationError extends AgentError {
  constructor(message: string, public validationErrors: any[]) {
    super(message);
    this.name = 'ValidationError';
  }
}
```

### Agent State Management

```typescript
// Agents should be stateless where possible
// State should be persisted in database/cache

// ✅ GOOD: Stateless agent
class ScaffoldAgent {
  async execute(task: ScaffoldTask): Promise<ScaffoldResult> {
    // All state is in the task or fetched from database
    const context = await this.getWorkflowContext(task.workflow_id);
    const result = await this.performScaffolding(task, context);
    await this.saveResult(result);
    return result;
  }
}

// ❌ BAD: Stateful agent
class ScaffoldAgent {
  private currentTask: ScaffoldTask; // State stored in memory
  private results: ScaffoldResult[];

  async execute(task: ScaffoldTask): Promise<ScaffoldResult> {
    this.currentTask = task; // Problematic if agent handles multiple tasks
    // ...
  }
}
```

---

## Testing Strategies

### Unit Testing

```typescript
// Test structure: Arrange-Act-Assert

describe('ScaffoldAgent', () => {
  describe('execute', () => {
    it('should generate app structure from requirements', async () => {
      // Arrange
      const agent = new ScaffoldAgent();
      const task: ScaffoldTask = {
        task_id: 'task_123',
        workflow_id: 'wf_456',
        type: 'app',
        domain: 'user',
        name: 'user-rewards-ui',
        requirements: 'A rewards system for users',
        template: 'app-ui',
        isolated: true
      };

      // Act
      const result = await agent.execute(task);

      // Assert
      expect(result.status).toBe('success');
      expect(result.files_generated).toBeGreaterThan(0);
      expect(result.path).toContain('user-rewards-ui');
    });

    it('should handle invalid task input', async () => {
      // Arrange
      const agent = new ScaffoldAgent();
      const invalidTask = { invalid: 'data' };

      // Act & Assert
      await expect(
        agent.execute(invalidTask as any)
      ).rejects.toThrow(ValidationError);
    });
  });
});
```

### Integration Testing

```typescript
// Test multiple components working together

describe('Workflow Integration', () => {
  let orchestrator: Orchestrator;
  let scaffoldAgent: ScaffoldAgent;
  let validationAgent: ValidationAgent;

  beforeEach(async () => {
    orchestrator = new Orchestrator();
    scaffoldAgent = new ScaffoldAgent();
    validationAgent = new ValidationAgent();

    await orchestrator.registerAgent(scaffoldAgent);
    await orchestrator.registerAgent(validationAgent);
  });

  it('should complete scaffold-to-validation workflow', async () => {
    // Start workflow
    const workflowId = await orchestrator.startWorkflow({
      type: 'app',
      domain: 'user',
      name: 'test-app',
      requirements: 'Test application'
    });

    // Wait for completion
    const result = await orchestrator.waitForStage(workflowId, 'validating');

    // Verify stages completed
    expect(result.stages_completed).toContain('scaffold');
    expect(result.stages_completed).toContain('validation');
  });
});
```

### E2E Testing

```typescript
// Test complete workflows end-to-end

import { test, expect } from '@playwright/test';

test.describe('Agentic SDLC E2E', () => {
  test('should create and deploy app from requirements', async ({ page }) => {
    // Navigate to orchestrator UI
    await page.goto('http://localhost:3000');

    // Fill in requirements
    await page.fill('[name="domain"]', 'user');
    await page.fill('[name="name"]', 'test-rewards-ui');
    await page.fill('[name="requirements"]', 'User rewards system');

    // Start workflow
    await page.click('button:has-text("Create App")');

    // Wait for completion (with timeout)
    await page.waitForSelector('.workflow-status:has-text("Completed")', {
      timeout: 120000 // 2 minutes
    });

    // Verify deployment
    const deploymentUrl = await page.textContent('.deployment-url');
    expect(deploymentUrl).toContain('https://');
  });
});
```

### Testing LLM Integration

```typescript
// Mock LLM responses for testing

import { vi } from 'vitest';

describe('ScaffoldAgent with LLM', () => {
  it('should analyze requirements using Claude', async () => {
    // Mock Anthropic API
    const mockAnthropicResponse = {
      content: [{
        type: 'text',
        text: JSON.stringify({
          capabilities: ['view_rewards', 'redeem_rewards'],
          routes: [
            { method: 'GET', path: '/api/rewards', description: 'List rewards' }
          ],
          schemas: [
            {
              name: 'Reward',
              fields: [
                { name: 'id', type: 'uuid', required: true },
                { name: 'name', type: 'string', required: true }
              ]
            }
          ]
        })
      }]
    };

    vi.spyOn(anthropic.messages, 'create').mockResolvedValue(mockAnthropicResponse);

    const agent = new ScaffoldAgent();
    const task = createScaffoldTask();

    const result = await agent.execute(task);

    expect(result.status).toBe('success');
    expect(anthropic.messages.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-sonnet-4-5-20250929'
      })
    );
  });
});
```

---

## Common Tasks

### Task 1: Adding a New Agent Type

1. **Create agent directory:**
   ```bash
   mkdir -p packages/agents/my-agent/src
   mkdir -p packages/agents/my-agent/tests
   ```

2. **Define contracts:**
   ```typescript
   // packages/agents/my-agent/src/contracts.ts
   export const MyAgentTaskSchema = z.object({
     // Define input schema
   });

   export const MyAgentResultSchema = z.object({
     // Define output schema
   });
   ```

3. **Implement agent:**
   ```typescript
   // packages/agents/my-agent/src/agent.ts
   export class MyAgent extends BaseAgent {
     async execute(task: MyAgentTask): Promise<MyAgentResult> {
       // Implementation
     }
   }
   ```

4. **Add tests:**
   ```typescript
   // packages/agents/my-agent/tests/agent.test.ts
   describe('MyAgent', () => {
     // Tests
   });
   ```

5. **Register with orchestrator:**
   ```typescript
   // packages/orchestrator/src/agents/registry.ts
   import { MyAgent } from '@agentic-sdlc/agents/my-agent';

   export const agentRegistry = {
     // ...
     'my-agent': MyAgent
   };
   ```

### Task 2: Adding a New Workflow Stage

1. **Define stage in state machine:**
   ```typescript
   // packages/orchestrator/src/state-machine/states.ts
   export enum WorkflowState {
     // ...
     MY_NEW_STAGE = 'my_new_stage'
   }
   ```

2. **Add transitions:**
   ```typescript
   // packages/orchestrator/src/state-machine/transitions.ts
   const transitions = [
     // ...
     {
       from: WorkflowState.PREVIOUS_STAGE,
       to: WorkflowState.MY_NEW_STAGE,
       trigger: 'PREVIOUS_STAGE_SUCCESS'
     },
     {
       from: WorkflowState.MY_NEW_STAGE,
       to: WorkflowState.NEXT_STAGE,
       trigger: 'MY_NEW_STAGE_SUCCESS'
     }
   ];
   ```

3. **Implement stage handler:**
   ```typescript
   // packages/orchestrator/src/stages/my-stage.ts
   export class MyStageHandler {
     async handle(context: WorkflowContext): Promise<void> {
       // Assign agent
       // Wait for completion
       // Update context
     }
   }
   ```

### Task 3: Modifying the API

1. **Update OpenAPI spec:**
   ```typescript
   // packages/orchestrator/src/api/openapi.ts
   export const openApiSpec = {
     paths: {
       '/api/v1/my-endpoint': {
         post: {
           summary: 'My new endpoint',
           // ...
         }
       }
     }
   };
   ```

2. **Define route schema:**
   ```typescript
   // packages/orchestrator/src/api/routes/my-route.ts
   const myRouteSchema = {
     body: z.object({
       // Request body schema
     }),
     response: {
       200: z.object({
         // Response schema
       })
     }
   };
   ```

3. **Implement route handler:**
   ```typescript
   export async function myRouteHandler(
     request: FastifyRequest,
     reply: FastifyReply
   ) {
     // Handler implementation
   }
   ```

4. **Register route:**
   ```typescript
   // packages/orchestrator/src/api/server.ts
   app.post('/api/v1/my-endpoint', {
     schema: myRouteSchema,
     handler: myRouteHandler
   });
   ```

---

## Troubleshooting

### Common Issues

#### Issue 1: Agent Not Receiving Tasks

**Symptoms:**
- Agent status shows "idle" but tasks are queued
- No agent logs showing task reception

**Diagnosis:**
```typescript
// Check event bus connection
const connection = await eventBus.checkConnection();
console.log('Event bus connected:', connection.connected);

// Check agent registration
const agents = await orchestrator.getRegisteredAgents();
console.log('Registered agents:', agents);

// Check task queue
const queueLength = await eventBus.getQueueLength('tasks');
console.log('Tasks in queue:', queueLength);
```

**Solutions:**
1. Verify event bus (Redis) is running: `docker ps | grep redis`
2. Check agent registration in database: `SELECT * FROM agents WHERE type = 'my-agent'`
3. Verify agent is subscribed to correct channel
4. Check for network issues between agent and event bus

#### Issue 2: Workflow Stuck in State

**Symptoms:**
- Workflow remains in one state indefinitely
- No error messages

**Diagnosis:**
```typescript
// Check workflow state
const workflow = await db.query(
  'SELECT * FROM workflows WHERE workflow_id = $1',
  [workflowId]
);
console.log('Current state:', workflow.current_state);
console.log('Last updated:', workflow.updated_at);

// Check recent events
const events = await db.query(
  'SELECT * FROM workflow_events WHERE workflow_id = $1 ORDER BY created_at DESC LIMIT 10',
  [workflowId]
);
console.log('Recent events:', events);

// Check agent tasks
const tasks = await db.query(
  'SELECT * FROM agent_tasks WHERE workflow_id = $1',
  [workflowId]
);
console.log('Agent tasks:', tasks);
```

**Solutions:**
1. Check if agent completed task but result not processed
2. Verify state machine transitions are configured correctly
3. Check for deadlocks or race conditions
4. Manually trigger transition if needed (with caution)

#### Issue 3: High Memory Usage

**Symptoms:**
- Application using excessive memory
- OOM errors

**Diagnosis:**
```typescript
// Check heap usage
const usage = process.memoryUsage();
console.log('Heap used:', Math.round(usage.heapUsed / 1024 / 1024), 'MB');
console.log('Heap total:', Math.round(usage.heapTotal / 1024 / 1024), 'MB');

// Profile memory
import v8 from 'v8';
const heapSnapshot = v8.writeHeapSnapshot();
// Analyze with Chrome DevTools
```

**Solutions:**
1. Check for memory leaks (unclosed connections, event listeners)
2. Implement proper cleanup in agent lifecycle
3. Add memory limits to Docker containers
4. Review caching strategy (TTL, size limits)

---

## Reference Documentation

### Primary Documents

1. **[FINAL-AGENTIC-SDLC-ARCH.md](./FINAL-AGENTIC-SDLC-ARCH.md)**
   - Complete system architecture (Version 3.0)
   - Sprint-based CI/CD pipeline
   - Decision negotiation and problem-solving engine
   - Comprehensive agent specifications
   - State machine design
   - Implementation roadmap

2. **[PHASE-1-CAPABILITY-PLAYBOOK.md](./PHASE-1-CAPABILITY-PLAYBOOK.md)**
   - Cookie-cutter scaffolding process
   - E2E testing requirements
   - Integration procedures
   - CI/CD pipeline design

3. **[AGENTIC-SDLC-PROCESS-FLOW.md](./AGENTIC-SDLC-PROCESS-FLOW.md)**
   - Visual process flows
   - Sprint lifecycle diagrams
   - Agent orchestration flows
   - Decision and problem resolution processes

4. **[MVP-IMPLEMENTATION-PLAN.md](./MVP-IMPLEMENTATION-PLAN.md)**
   - Minimal viable implementation steps
   - Quick-start orchestrator setup
   - Essential components only
   - 15-minute setup guide

5. **[AGENTIC-BACKLOG.json](./AGENTIC-BACKLOG.json)**
   - 25 prioritized backlog items
   - Sprint planning with story points
   - Epic organization
   - Self-building approach

### AI Context Files

**CRITICAL:** These files in the `AI-CONTEXT/` directory provide essential patterns and guidance for AI agents executing implementation tasks. Always reference these files when building components.

1. **[AI-CONTEXT/CODE-PATTERNS.md](./AI-CONTEXT/CODE-PATTERNS.md)**
   - Standard code templates for all agent types
   - Base agent implementation patterns
   - Event handling templates
   - State machine patterns
   - Database integration templates
   - Error handling patterns
   - **Use this when:** Creating new agents, implementing handlers, or writing standard components

2. **[AI-CONTEXT/API-CONTRACTS.md](./AI-CONTEXT/API-CONTRACTS.md)**
   - Complete API specifications with Zod schemas
   - TaskAssignmentSchema and TaskResultSchema definitions
   - REST endpoint contracts for orchestrator and pipeline
   - WebSocket protocol specifications
   - Event bus message formats
   - Quality gate definitions
   - **Use this when:** Defining new APIs, creating message contracts, or integrating components

3. **[AI-CONTEXT/TESTING-GUIDELINES.md](./AI-CONTEXT/TESTING-GUIDELINES.md)**
   - Comprehensive testing requirements (90% coverage for agents)
   - Unit test patterns with Vitest
   - Integration test templates
   - E2E test patterns with Playwright
   - Performance testing guidelines
   - Mock strategies for LLM testing
   - **Use this when:** Writing any tests, setting up test harnesses, or validating components

4. **[AI-CONTEXT/INTEGRATION-PATTERNS.md](./AI-CONTEXT/INTEGRATION-PATTERNS.md)**
   - Database connection pooling patterns
   - Redis pub/sub implementation
   - File system safe operations
   - Git integration patterns
   - AWS service integration
   - Docker containerization patterns
   - **Use this when:** Integrating with external services, handling file operations, or setting up infrastructure

5. **[AI-CONTEXT/DECISION-TREES.md](./AI-CONTEXT/DECISION-TREES.md)**
   - Task acceptance decision trees
   - Error handling decision flows
   - Scaffold agent decision patterns
   - Validation agent decision logic
   - Deployment decision trees
   - Human escalation patterns
   - **Use this when:** Implementing decision logic, handling errors, or creating autonomous workflows

6. **[AI-CONTEXT/COMMON-SOLUTIONS.md](./AI-CONTEXT/COMMON-SOLUTIONS.md)**
   - Pre-solved solutions for common problems
   - Timeout handling implementations
   - Memory leak prevention
   - Race condition solutions
   - Rate limiting patterns
   - LLM response parsing
   - Caching strategies
   - **Use this when:** Encountering common issues, implementing resilience patterns, or optimizing performance

### Using AI Context Files Effectively

When implementing any component:

1. **Start with CODE-PATTERNS.md** for the base template
2. **Reference API-CONTRACTS.md** for message formats
3. **Follow TESTING-GUIDELINES.md** for test implementation
4. **Use INTEGRATION-PATTERNS.md** for external connections
5. **Apply DECISION-TREES.md** for decision logic
6. **Check COMMON-SOLUTIONS.md** for known issues

Example workflow:
```bash
# Creating a new agent
1. Open AI-CONTEXT/CODE-PATTERNS.md → Find "Base Agent Template"
2. Open AI-CONTEXT/API-CONTRACTS.md → Use TaskAssignmentSchema
3. Open AI-CONTEXT/TESTING-GUIDELINES.md → Follow "Agent Unit Test Pattern"
4. Open AI-CONTEXT/DECISION-TREES.md → Implement task acceptance logic
5. Open AI-CONTEXT/COMMON-SOLUTIONS.md → Apply retry patterns
```

### External References

- **TypeScript:** https://www.typescriptlang.org/docs/
- **Fastify:** https://fastify.dev/docs/latest/
- **Zod:** https://zod.dev/
- **Vitest:** https://vitest.dev/
- **Playwright:** https://playwright.dev/
- **Anthropic Claude:** https://docs.anthropic.com/
- **Turborepo:** https://turbo.build/repo/docs
- **PostgreSQL:** https://www.postgresql.org/docs/
- **Redis:** https://redis.io/docs/

### Code Examples Repository

Example implementations are available in:
- `examples/` directory in this repository
- Integration tests in `packages/*/tests/integration/`

---

## Quick Command Reference

```bash
# Development
pnpm install                    # Install dependencies
pnpm dev                        # Start development servers
pnpm build                      # Build all packages
pnpm test                       # Run all tests
pnpm test:watch                 # Run tests in watch mode

# Quality checks
pnpm typecheck                  # TypeScript type checking
pnpm lint                       # Lint code
pnpm format                     # Format code with Prettier

# Scripts
./scripts/validate.sh           # Run full validation
./scripts/e2e.sh                # Run E2E tests
./scripts/dev-up.sh             # Start local stack
./scripts/build-images.sh       # Build Docker images

# Database
pnpm db:migrate                 # Run migrations
pnpm db:seed                    # Seed database
pnpm db:reset                   # Reset database

# Orchestrator
pnpm orchestrator:dev           # Start orchestrator
pnpm orchestrator:logs          # View logs

# Agents
pnpm agents:scaffold:dev        # Start scaffold agent
pnpm agents:validation:dev      # Start validation agent
```

---

## Best Practices Summary

1. **Always define contracts first** (Zod schemas, OpenAPI specs)
2. **Validate all inputs and outputs** at boundaries
3. **Log everything** with structured logging (trace IDs, context)
4. **Record metrics** for all operations (duration, success/failure)
5. **Handle errors gracefully** with retry logic and proper error types
6. **Keep agents stateless** - store state in database/cache
7. **Write tests** before implementation (TDD)
8. **Document as you go** - update docs with code changes
9. **Use type safety** - avoid `any`, leverage TypeScript
10. **Follow the playbook** - isolation → validation → integration

---

## Getting Help

- **Documentation Issues:** Open an issue in this repository
- **Technical Questions:** Post in team Slack #agentic-sdlc
- **Architecture Decisions:** Consult the Platform Architecture team
- **Urgent Issues:** Page on-call engineer

---

**Remember:** This system is building other systems. Quality and reliability are paramount. When in doubt, over-communicate and over-document.

---

**End of CLAUDE.md**
