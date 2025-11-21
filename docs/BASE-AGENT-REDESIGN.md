# EPCC Exploration Report: Strategic Agent Abstraction Layer Design

**Phase:** EXPLORE (Analysis Only - No Code Implementation)
**Date:** 2025-11-15 (Session #68)
**Goal:** Design a strategic abstraction layer for configurable, plug-and-play agents with complete logging infrastructure
**Status:** ✅ Complete Analysis

---

## Executive Summary

This exploration analyzes the **agents layer** of the Agentic SDLC platform to design a strategic abstraction that enables:
- **Plug-and-Play Agent Patterns**: Predefined workflows and agents adhering to canonical architecture
- **Configurable Agents**: Runtime configuration without code changes
- **Logging Infrastructure Retention**: Complete distributed tracing (trace_id/span_id propagation)
- **Log Level Management**: Configurable logging at agent, component, and module levels

**Platform State:** 98% Production Ready (Session #68)
- All agents building successfully
- Message bus (Redis Streams) stable with proper ACK timing
- AgentEnvelopeSchema v2.0.0 canonical and enforced
- Distributed tracing working end-to-end
- All 5 agents (scaffold, validation, integration, deployment, e2e) operational

---

## Architecture Overview

### System Topology

```
┌─────────────────────────────────────────────────────────┐
│                  Orchestrator (PM2)                      │
│  - Workflow State Machine (xstate)                      │
│  - Redis Message Bus (Streams + Pub/Sub)                │
│  - OrchestratorContainer (DI)                           │
└──────────────┬──────────────────────────────────────────┘
               │ AgentEnvelope v2.0.0
               │ (REDIS_CHANNELS.AGENT_TASKS)
        ┌──────┴─────────────────────┐
        │                            │
   ┌────▼────┐  ┌──────────┐  ┌─────▼─────┐  ┌─────────┐  ┌─────────┐
   │Scaffold │  │Validation│  │Integration│  │Deployment │  │E2E     │
   │Agent    │  │Agent     │  │Agent      │  │Agent      │  │Agent   │
   └────┬────┘  └──────────┘  └─────┬─────┘  └─────────┘  └─────────┘
        │                            │
        └────────────────┬───────────┘
                         │
                    AgentResult
                    (REDIS_CHANNELS.ORCHESTRATOR_RESULTS)
                         │
                    ┌────▼──────────────┐
                    │ State Machine     │
                    │ Transition Logic  │
                    └───────────────────┘
```

---

## Current Agent Layer Architecture

### BaseAgent (Transport Layer Contract)

**Location:** packages/agents/base-agent/src/base-agent.ts (783 lines)

**Key Characteristics:**
- Abstract base class for all agents
- Implements AgentLifecycle interface
- Handles Redis subscription, message unwrapping, trace context
- Pino logger built-in (not injectable)
- Circuit breaker for Claude API calls
- Schema validation with detailed error logging

**Current Logging Pattern:**
```typescript
// Pino logger with timestamp and colorization
this.logger = pino({
  name: this.agentId,
  transport: {
    target: 'pino-pretty',
    options: { colorize: true, translateTime: 'UTC:yyyy-mm-dd HH:MM:ss' }
  }
});

// Trace logging with standard prefixes
this.logger.info('🔍 [AGENT-TRACE] Task received', {
  workflow_id, task_id, stage, trace_id, span_id
});
```

**Constraints:**
- Logger hardcoded to Pino (cannot swap)
- Log level control via process.env.DEBUG only
- No per-module or per-agent log level configuration
- Transport configuration fixed

### Concrete Agent Implementations (All Pattern-Compliant)

**Analyzed Agents:**

1. **ScaffoldAgent** (packages/agents/scaffold-agent/src/scaffold-agent.ts)
   - Capabilities: analyze-requirements, generate-structure, create-boilerplate
   - Services: FileGenerator, TemplateEngine
   - Domain Task: ScaffoldTask with project_type, name, tech_stack

2. **ValidationAgent** (packages/agents/validation-agent/src/validation-agent.ts)
   - Capabilities: typescript-compilation, eslint, coverage, security, quality-gates
   - Services: PolicyConfig loader, 5 validators, quality gates
   - Domain Task: ValidationTask with code path, rules, gates

3. **IntegrationAgent** (packages/agents/integration-agent/src/integration-agent.ts)
   - Capabilities: branch_merging, conflict_resolution, dependency_updates, testing
   - Services: GitService, ConflictResolverService, DependencyUpdaterService
   - Domain Task: IntegrationTask with action (merge, resolve, update, test)

4. **DeploymentAgent** (packages/agents/deployment-agent/src/deployment-agent.ts)
   - Capabilities: docker_build, ecr_push, ecs_deployment, rollback, health_check
   - Services: DockerService, ECRService, ECSService, HealthCheckService
   - Domain Task: DeploymentTask with action and AWS-specific payloads

5. **E2EAgent** (packages/agents/e2e-agent/src/e2e-agent.ts)
   - Capabilities: test-generation, playwright, page-objects, multi-browser, artifacts
   - Services: Generators, Runners, ArtifactStorage
   - Domain Task: E2ETaskContext with project path, URLs, test specs

**Common Pattern Across All Agents:**
```typescript
export class ConcreteAgent extends BaseAgent {
  constructor(messageBus: any) {
    super({
      type: 'agent-type',
      version: '1.0.0',
      capabilities: [...]
    }, messageBus);
    // Service instantiation here
    this.service = new Service(this.logger);
  }

  async execute(task: AgentEnvelope): Promise<TaskResult> {
    // Extract payload
    // Map to domain task
    // Call executeTask()
    // Return TaskResult
  }
}
```

---

## Logging Infrastructure Deep Dive

### Structured Logging System

**Pino Configuration (Hardcoded):**
```typescript
// From BaseAgent constructor
transport: {
  target: 'pino-pretty',
  options: {
    colorize: true,
    translateTime: 'UTC:yyyy-mm-dd HH:MM:ss'
  }
}
```

**Log Level Architecture:**
```
INFO      (always logged)
WARN      (always logged)
ERROR     (always logged)
DEBUG     (only if process.env.DEBUG=true)
```

**Trace Logging Prefixes (Observed Pattern):**
- `🔍 [AGENT-TRACE]` - Agent task lifecycle (received, processing, publishing)
- `🔍 [MSG-UNWRAP]` - Message envelope parsing steps
- `🔍 [VALIDATION]` - Task schema validation results
- `🔍 [RESULT-VALIDATION]` - AgentResult schema compliance
- `🔍 [WORKFLOW-TRACE]` - Orchestrator-level progression
- `[SESSION #XX]` - Session-specific debug contexts
- `[DEBUG-*]` - Ad-hoc debugging markers

**Distributed Trace Context:**
```typescript
export interface TraceContext {
  trace_id: string;      // Correlation ID (uniqueness: entire workflow)
  span_id: string;       // Operation span (uniqueness: per task)
  parent_span_id?: string; // Parent operation reference
}

// Extraction in receiveTask()
this.currentTraceContext = extractTraceContext(envelope);

// Propagation in reportResult()
metadata: {
  trace_id: this.currentTraceContext?.trace_id || randomUUID(),
  // ... sent in AgentResult
}
```

### Logging Limitations & Gaps

1. **No Runtime Log Level Control**
   - Cannot enable DEBUG without env var + restart
   - Cannot disable INFO/WARN for quiet runs
   - No per-module granularity

2. **Logger Not Configurable**
   - Pino hardcoded (cannot inject alternative)
   - Transport options immutable
   - Pretty-printing always on (no structured output option)

3. **Trace Context Implicit**
   - Relies on extraction utility (not transparent)
   - No explicit context passing to child operations
   - Loss of context in async boundaries possible

4. **No Log Aggregation Support**
   - No JSON structured logging mode
   - Pretty-printing conflicts with log aggregation systems
   - No correlation ID header support (HTTP context missing)

---

## Configuration Analysis

### Current Configuration Sources

**1. Hardcoded Values (Agent Constructors)**
```typescript
// Example: ScaffoldAgent
super({
  type: AGENT_TYPES.SCAFFOLD,        // ← Hardcoded constant
  version: '1.0.0',                   // ← Hardcoded literal
  capabilities: [                      // ← Hardcoded array
    'analyze-requirements',
    'generate-structure',
    // ...
  ]
}, messageBus);
```

**2. Environment Variables**
```typescript
// DeploymentAgent
new ECRService(process.env.AWS_REGION || 'us-east-1')

// BaseAgent
const apiKey = process.env.ANTHROPIC_API_KEY;
const redisPort = parseInt(process.env.REDIS_PORT || '6380');
```

**3. OrchestratorContainer Configuration**
```typescript
export interface BootstrapConfig {
  redisUrl: string;
  redisNamespace?: string;
  redisDefaultTtl?: number;
  coordinators: {
    plan?: boolean;
    code?: boolean;
    certify?: boolean;
  };
}
```

### Configuration Limitations

1. **Not Externalized**
   - Agent capabilities hardcoded
   - No YAML/JSON configuration files
   - No configuration as code pattern

2. **Not Runtime-Changeable**
   - Changes require code edits
   - No hot reload capability
   - Rebuilds + redeployment needed

3. **Not Validated**
   - No schema for agent configuration
   - No way to express constraints (timeout, retry bounds)
   - Environment variable strings parsed ad-hoc

4. **No Composition**
   - Cannot create agent variants
   - Cannot disable capabilities
   - Cannot override service implementations

---

## Dependency Injection & Service Management

### Current DI Pattern

**Constructor Injection (Minimal):**
```typescript
export abstract class BaseAgent {
  constructor(
    capabilities: AgentCapabilities,
    messageBus: IMessageBus  // ← Only injected dependency
  ) { ... }
}
```

**Service Instantiation (Direct):**
```typescript
// In each agent constructor
this.fileGenerator = new FileGenerator(this.logger);
this.templateEngine = new TemplateEngine(path.join(__dirname, '../templates'));
this.gitService = new GitService(repoPath);
```

**OrchestratorContainer Pattern:**
```typescript
export class OrchestratorContainer {
  async initialize(): Promise<void> {
    this.redis = await makeRedisSuite(this.config.redisUrl);
    this.bus = makeRedisBus(this.redis.pub, this.redis.sub);
    this.kv = makeRedisKV(this.redis.base);
  }

  async startOrchestrators(): Promise<void> {
    if (this.config.coordinators.plan) {
      const plan = new PlanCoordinator({ bus: this.bus, kv: this.kv, ... });
      await plan.start();
    }
  }
}
```

### DI Limitations

1. **No Service Registry**
   - Services hardcoded in agents
   - Cannot swap implementations
   - Testing requires mocking

2. **No Factory Pattern**
   - Agent instantiation scattered
   - No agent discovery mechanism
   - No plugin support

3. **Tight Coupling**
   - Services know about Pino logger
   - Agents know concrete service types
   - No interface-based abstraction for services

---

## Workflow & Stage Architecture

### Current Workflow Model

**From workflow-state-machine.ts:**
```typescript
export interface WorkflowContext {
  workflow_id: string;
  type: string;
  current_stage: string;
  nextStage?: string;  // Computed
  progress: number;
  metadata: Record<string, any>;
  decision_id?: string;
  clarification_id?: string;
  pending_decision?: boolean;
  _seenEventIds?: Set<string>;  // Deduplication
}

export type WorkflowEvent =
  | { type: 'START' }
  | { type: 'STAGE_COMPLETE'; stage: string; eventId?: string }
  | { type: 'STAGE_FAILED'; stage: string; error: Error }
  | { type: 'DECISION_REQUIRED'; decision_id: string }
  | { type: 'CLARIFICATION_REQUIRED'; clarification_id: string }
  // ...
```

**Stage Progression (Implicit Convention):**
```
initialization → validation → integration → deployment → e2e_testing → completion
```

**Agent ↔ Stage Binding:**
- scaffold agent → initialization stage
- validation agent → validation stage
- integration agent → integration stage
- deployment agent → deployment stage
- e2e agent → e2e_testing stage

**Binding Type:** Convention-based (not enforced)

### Workflow Limitations

1. **Workflows Hardcoded**
   - Fixed progression in state machine
   - Cannot reuse stage sequences
   - No composition of workflow stages

2. **Stage Progression Implicit**
   - No explicit workflow definition
   - Agent type ≠ stage name contract implicit
   - No way to express conditional routing

3. **Agent-Stage Coupling**
   - One agent per stage assumption
   - No parallel execution support
   - No agent chaining within stage

4. **No Workflow Variants**
   - E-commerce vs SaaS workflows would need separate state machines
   - No parameterization support
   - Code duplication for similar workflows

---

## Message Schema Analysis

### AgentEnvelopeSchema v2.0.0 (Canonical)

**Location:** packages/shared/types/src/messages/agent-envelope.ts

**Schema Structure:**
```typescript
const AgentEnvelopeSchema = z.object({
  message_id: z.string(),
  task_id: z.string(),
  workflow_id: z.string(),
  agent_type: z.string(),
  priority: z.enum(['critical', 'high', 'medium', 'low']),

  trace: z.object({
    trace_id: z.string(),
    span_id: z.string(),
    parent_span_id: z.string().optional()
  }),

  metadata: z.object({
    created_at: z.string().datetime(),
    created_by: z.string(),
    envelope_version: z.string()
  }),

  constraints: z.object({
    timeout_ms: z.number(),
    max_retries: z.number()
  }),

  payload: z.record(z.unknown()),
  workflow_context: z.object({
    current_stage: z.string(),
    // ... additional workflow state
  }).optional()
});
```

**TaskResult Schema:**
```typescript
const TaskResultSchema = z.object({
  message_id: z.string(),
  task_id: z.string(),
  workflow_id: z.string(),
  agent_id: z.string(),
  status: z.enum(['success', 'failure', 'partial']),
  result: z.object({
    data: z.record(z.unknown()),
    metrics: z.object({
      duration_ms: z.number()
    }).optional()
  }),
  errors: z.array(z.object({
    code: z.string(),
    message: z.string(),
    recoverable: z.boolean()
  })).optional(),
  metadata: z.object({
    completed_at: z.string(),
    trace_id: z.string()
  })
});
```

**Key Insight:** Payload is intentionally generic (z.record) to support domain-specific data at runtime.

---

## Message Bus & Adapter Pattern

### IMessageBus Interface (Port)

**Location:** packages/orchestrator/src/hexagonal/ports/message-bus.port.ts

```typescript
export interface IMessageBus {
  publish<T>(
    topic: string,
    message: T,
    options?: PublishOptions
  ): Promise<void>;

  subscribe<T>(
    topic: string,
    handler: (message: T) => Promise<void>,
    options?: SubscribeOptions
  ): Promise<void>;

  health(): Promise<HealthStatus>;
}
```

### Redis Bus Adapter (redis-bus.adapter.ts)

**Implementation Details:**
- Separate pub/sub clients (required by Redis)
- Stream mirroring for durability
- Consumer group management (consumer group: agent-{type}-group)
- ACK-on-success timing (critical reliability fix in Session #67)
- Message deduplication support

**Topic Convention:**
```
REDIS_CHANNELS.AGENT_TASKS(agentType)  // Input: 'agents:tasks:{agentType}'
REDIS_CHANNELS.ORCHESTRATOR_RESULTS    // Output: 'orchestrator:results'
```

---

## Monorepo & Package Structure

### Directory Layout

```
packages/
├── agents/
│   ├── base-agent/
│   │   ├── src/
│   │   │   ├── base-agent.ts (783 lines)
│   │   │   ├── types.ts (80 lines)
│   │   │   ├── example-agent.ts
│   │   │   └── index.ts
│   │   ├── tests/
│   │   └── package.json
│   ├── scaffold-agent/
│   ├── validation-agent/
│   ├── integration-agent/
│   ├── deployment-agent/
│   └── e2e-agent/
├── orchestrator/
│   └── src/
│       ├── hexagonal/
│       │   ├── core/ (logger, idempotency, retry)
│       │   ├── ports/ (message-bus, kv-store)
│       │   ├── adapters/ (redis-bus, redis-kv)
│       │   ├── orchestration/ (base-orchestrator, plan-coordinator)
│       │   └── persistence/ (workflow-state-manager)
│       └── state-machine/ (workflow-state-machine.ts)
├── shared/
│   ├── types/ (AgentEnvelope, TaskResult schemas)
│   ├── utils/ (retry, CircuitBreaker, trace utilities)
│   ├── contracts/
│   └── redis-core/ (logger.ts utility)
└── dashboard/
```

### Export Convention

```typescript
// @agentic-sdlc/base-agent/package.json
"main": "dist/index.js",
"exports": {
  ".": {
    "types": "./dist/index.d.ts",
    "default": "./dist/index.js"
  }
}

// Index exports canonical types and BaseAgent
export { BaseAgent };
export { AgentEnvelope, TaskResult } from './types';
```

### Critical Constraint

**Never duplicate schemas or core utilities**
- Always import from @agentic-sdlc/shared-types
- Never copy BaseAgent code
- Always use IMessageBus (never Redis directly)

---

## Error Handling Patterns

### Error Type Hierarchy

**From base-agent/src/types.ts:**

```typescript
export class AgentError extends Error {
  constructor(message: string, public readonly code?: string) { ... }
}

export class ValidationError extends AgentError {
  constructor(message: string, public readonly validationErrors: any[]) { ... }
}

export class TaskExecutionError extends AgentError {
  constructor(message: string, public readonly task_id: string) { ... }
}
```

### Error Handling in receiveTask()

```typescript
try {
  const task = this.validateTask((message.payload as any).context);
  const result = await retry(() => this.execute(task), { ... });
  await this.reportResult(result, workflowStage);
} catch (error) {
  // Only report if result not already sent
  const errorResult: TaskResult = {
    status: 'failure',
    errors: [{
      code: 'TASK_EXECUTION_ERROR',
      message: error.message,
      recoverable: true
    }]
  };
  await this.reportResult(errorResult);
}
```

### Result Error Format

**TaskResult format:**
```typescript
errors: [{
  code: string;
  message: string;
  recoverable: boolean;
}][]
```

**AgentResult format (mapped):**
```typescript
error: {
  code: string;
  message: string;
  retryable: boolean;  // ← Renamed from recoverable
}
```

---

## Key Architectural Decisions

### ✅ AgentEnvelope as Universal Contract
- Fixed structure enforced at validation
- Payload remains generic for domain extension
- Trace context propagated end-to-end
- Cannot be extended per-agent

### ✅ BaseAgent as Transport Layer
- Handles all Redis pub/sub infrastructure
- Unwraps envelopes and validates schemas
- Extracts trace context automatically
- Domain logic isolated in execute()

### ✅ Message Bus Abstraction
- IMessageBus interface decouples from Redis
- Agents depend only on abstraction
- Implementation swappable (for testing, alternative transports)
- Health checking built-in

### ✅ Distributed Tracing Built-in
- Trace context extracted in receiveTask()
- Stored in currentTraceContext
- Passed to reportResult() for correlation
- Pino logger includes trace in all messages

### ⚠️ Agent Registry Missing
- No discovery mechanism
- Agent instantiation scattered
- Hardcoded in orchestrator startup

### ⚠️ Configuration Not Externalized
- Capabilities hardcoded in constructors
- Service choices not configurable
- Environment variables only for external services

### ⚠️ Workflows Not Composable
- Stage progression hardcoded
- No way to parameterize workflows
- Agent-stage binding implicit

---

## Identified Design Gaps & Improvement Areas

### Gap 1: No Agent Registry/Discovery
**Current State:** Agents scattered across packages, hardcoded in orchestrator
**Problem:** Cannot dynamically add/remove agents without code changes
**Impact:** Extends time-to-value for new agent types, requires redeploy

**Example Use Case:**
```
New "DataValidator" agent created
→ Must add to AGENT_TYPES enum
→ Must modify orchestrator startup
→ Must rebuild and redeploy entire system
```

### Gap 2: No Configuration Management
**Current State:** Config via env vars or hardcoding
**Problem:** Changes require code edits, no runtime configuration
**Impact:** Operationally expensive, cannot tune in production

**Example Use Case:**
```
Need to increase task timeout from 30s to 60s
→ Must edit agent code
→ Must rebuild agent package
→ Must restart agent process
```

### Gap 3: Logging Not Configurable at Runtime
**Current State:** Hardcoded Pino with DEBUG env var only
**Problem:** Cannot adjust log verbosity without restart
**Impact:** Cannot troubleshoot production issues without downtime

**Example Use Case:**
```
Workflow stuck, need trace logging
→ Must set DEBUG=true
→ Must restart orchestrator and all agents
→ All workflows get verbose logging (noisy)
```

### Gap 4: Workflow Not Explicitly Defined
**Current State:** Stage progression implicit in state machine
**Problem:** Cannot reuse workflows, hard to compose
**Impact:** Workflow variants require separate state machine code

**Example Use Case:**
```
SaaS vs E-commerce workflows share some stages but differ in others
→ Would need two separate state machines
→ Or complex conditional logic in single machine
→ Cannot share stage definitions
```

### Gap 5: Task Mapping Duplicated
**Current State:** Priority mapping, metadata extraction in each agent
**Problem:** DRY violation, inconsistency risk
**Impact:** Changes in one agent not reflected in others

**Example Duplication:**
```typescript
// In IntegrationAgent
priority: task.priority === 'critical' ? 90 :
          task.priority === 'high' ? 70 :
          task.priority === 'medium' ? 50 : 30,

// In DeploymentAgent (identical)
priority: task.priority === 'critical' ? 90 :
          task.priority === 'high' ? 70 :
          task.priority === 'medium' ? 50 : 30,
```

### Gap 6: Service Locator Missing
**Current State:** Services instantiated directly in agents
**Problem:** Hard to swap implementations, test, or reuse
**Impact:** Testing requires constructor mocking, cannot dynamically swap storage backends

**Example:**
```
Want to use S3 instead of local filesystem
→ Must edit ScaffoldAgent constructor
→ FileGenerator takes hardcoded path
→ No way to inject alternative storage
```

---

## Production Readiness Assessment

### ✅ What's Production Ready

1. **Schema Validation**
   - AgentEnvelopeSchema v2.0.0 enforced end-to-end
   - Detailed validation error logging
   - Type safety with TypeScript strict mode

2. **Message Bus Reliability**
   - Redis Streams with proper ACK timing
   - Consumer group management
   - Deduplication support
   - Health checking

3. **Trace Correlation**
   - trace_id propagated through entire workflow
   - span_id for operation isolation
   - Automatically included in all logs

4. **Error Handling**
   - Structured error types (AgentError, ValidationError)
   - Retry logic with circuit breaker
   - Recoverable flag for intelligent retries

### ⚠️ What Needs Hardening

1. **Agent Management**
   - Agent registry needed for discovery
   - Configuration externalization required
   - Factory pattern for instantiation

2. **Logging Control**
   - Log levels need runtime configuration
   - Per-module granularity missing
   - Dashboard integration for log management

3. **Workflow Composition**
   - Explicit workflow definitions needed
   - Stage composition and reuse required
   - Conditional routing support

4. **Service Dependencies**
   - Service locator pattern missing
   - Dependency injection incomplete
   - Testing complexity due to tight coupling

---

## Recommendations for Strategic Abstraction Layer

### Overarching Principles

1. **Non-Breaking Changes**
   - Don't modify BaseAgent.execute() signature
   - Keep AgentEnvelopeSchema v2.0.0 unchanged
   - IMessageBus interface stays as-is
   - All existing agents continue to work

2. **Composition Over Inheritance**
   - Layer new abstraction above BaseAgent
   - Use composition for cross-cutting concerns
   - Middleware pattern for logging, configuration

3. **Configuration Externalization**
   - YAML/JSON for workflow and agent definitions
   - Environment variable overrides
   - Runtime configuration updates (where possible)

4. **Complete Trace Preservation**
   - Maintain trace_id → span_id → parent_span_id propagation
   - Extend logging without breaking existing patterns
   - Log level control while preserving trace context

### Required Components (In Priority Order)

#### Component 1: Agent Registry
- **Purpose:** Discover and instantiate agents dynamically
- **Inputs:** Agent metadata (name, version, capabilities, config schema)
- **Outputs:** Agent factory functions
- **Integration:** OrchestratorContainer uses registry at startup

#### Component 2: Agent Configuration Manager
- **Purpose:** Handle agent configuration with override hierarchy
- **Levels:** defaults → environment → config file → runtime overrides
- **Validation:** Schema enforcement per agent type
- **Integration:** Injected into agents via constructor

#### Component 3: Workflow Definition Engine
- **Purpose:** Explicit workflow definitions with stage composition
- **Formats:** YAML/JSON with validation
- **Capabilities:** Reusable stages, conditional routing, agent binding
- **Integration:** Feeds workflow definitions into state machine

#### Component 4: Logger Configuration Service
- **Purpose:** Runtime log level management across all agents
- **Granularity:** Global, per-agent, per-module levels
- **Features:** Dynamic updates, context-aware logging
- **Integration:** Middleware in BaseAgent for level filtering

#### Component 5: Service Locator / Factory
- **Purpose:** Centralized service instantiation and dependency wiring
- **Pattern:** Registry of service factories
- **Capabilities:** Pluggable implementations, test doubles
- **Integration:** Agents request services rather than create them

---

## References & Key Files

**Essential Architecture Files:**
- CLAUDE.md (Platform status, session history)
- AGENT-BASE-DESIGN.md (Design guidance for abstractions)
- packages/agents/base-agent/src/base-agent.ts (783 lines - core transport layer)
- packages/shared/types/src/messages/agent-envelope.ts (Schema definitions)
- packages/orchestrator/src/state-machine/workflow-state-machine.ts (Workflow progression)
- packages/orchestrator/src/hexagonal/bootstrap.ts (DI container)

**Agent Implementations (All Pattern-Consistent):**
- packages/agents/scaffold-agent/src/scaffold-agent.ts
- packages/agents/validation-agent/src/validation-agent.ts
- packages/agents/integration-agent/src/integration-agent.ts
- packages/agents/deployment-agent/src/deployment-agent.ts
- packages/agents/e2e-agent/src/e2e-agent.ts

**Logging & Utilities:**
- packages/orchestrator/src/hexagonal/core/logger.ts (Structured logging util)
- packages/shared/redis-core/src/core/logger.ts (JSON logger helper)
- packages/shared/utils/src/ (Trace extraction, retry, circuit breaker)

---

## Exploration Completion Checklist

- [x] CLAUDE.md reviewed - Session #68, 98% production ready
- [x] AGENT-BASE-DESIGN.md analyzed - Design patterns and recommendations
- [x] BaseAgent core implementation studied (783 lines)
- [x] All 5 concrete agents reviewed and patterns identified
- [x] Logging infrastructure fully mapped
- [x] Configuration sources and limitations documented
- [x] Dependency injection patterns analyzed
- [x] Workflow state machine architecture understood
- [x] Message schemas (AgentEnvelope, TaskResult) verified
- [x] IMessageBus port and Redis adapter analyzed
- [x] Monorepo structure and exports documented
- [x] Error handling patterns classified
- [x] Testing approach and mocking patterns identified
- [x] 6 major design gaps identified and documented
- [x] Production readiness evaluated
- [x] Strategic recommendations formulated

---

**Prepared for:** PLAN Phase (Strategic Design & Architecture)
**Next Steps:** Design Agent Registry, Configuration Manager, Workflow Engine, Logger Service, Service Locator
**Status:** ✅ Ready for PLAN Phase

