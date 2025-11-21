# AGENT-PLAYBOOK.md - Instructions for AI Agents

**Version:** 1.0.0 | **Status:** ✅ Ready for Agent Implementation | **Last Updated:** 2025-11-16 (Session #69)

This document provides step-by-step instructions for **AI agents** to create and integrate new agents into the Agentic SDLC platform.

---

## 🎯 Quick Start: Create a New Agent in 5 Steps

1. **Create package structure** → `packages/agents/your-agent-name/`
2. **Implement agent class** → Extend `BaseAgent`, override `execute()`
3. **Register agent type** → Add to AGENT_TYPES constant
4. **Update orchestrator routing** → Map stage → agent type
5. **Add PM2 process** → Enable standalone execution

---

## 📋 STEP 1: Create Package Structure

### Goal
Set up the directory and configuration files for a new agent.

### Instructions

**1.1 Create Directory**
```bash
mkdir -p packages/agents/your-agent-name/src
mkdir -p packages/agents/your-agent-name/templates
```

**1.2 Create `package.json`**
Copy from an existing agent and update:

```json
{
  "name": "@agentic-sdlc/your-agent-name",
  "version": "1.0.0",
  "description": "Agent that does [describe purpose]",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/run-agent.js",
    "dev": "tsx src/run-agent.ts",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "@agentic-sdlc/base-agent": "workspace:*",
    "@agentic-sdlc/shared-types": "workspace:*",
    "@anthropic-ai/sdk": "^0.30.0",
    "pino": "^8.16.0",
    "redis": "^4.6.11"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "typescript": "^5.3.3",
    "tsx": "^4.7.0"
  }
}
```

**1.3 Create `tsconfig.json`**
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "lib": ["ES2020"],
    "target": "ES2020"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

## 📋 STEP 2: Implement Agent Class

### Goal
Create the core agent implementation that extends `BaseAgent`.

### Instructions

**2.1 Create `src/types.ts`** (Agent-specific types)
```typescript
/**
 * your-agent-name/src/types.ts
 * Define agent-specific input/output types
 */

export interface YourAgentInput {
  // Define what your agent receives in task payload
  requirement: string;
  // Add other fields specific to your agent
}

export interface YourAgentOutput {
  // Define what your agent produces
  result: string;
  // Add other output fields
}

export interface YourAgentMetrics {
  processingTimeMs: number;
  itemsProcessed: number;
}
```

**2.2 Create `src/your-agent-name.ts`** (Main agent implementation)

```typescript
/**
 * your-agent-name/src/your-agent-name.ts
 * Main agent class implementation
 *
 * CRITICAL IMPORTS:
 * - Use package index imports ONLY (never /src/ paths)
 * - All types from @agentic-sdlc/shared-types and @agentic-sdlc/base-agent
 */

import pino from 'pino';
import { Anthropic } from '@anthropic-ai/sdk';

// ✅ CORRECT: Import from package index
import {
  BaseAgent,
  AgentCapabilities,
  AgentEnvelope,
  TaskResult,
  type IMessageBus,
  LoggerConfigService,
  ConfigurationManager,
  ServiceLocator
} from '@agentic-sdlc/base-agent';

import {
  AGENT_TYPES,
  WORKFLOW_STAGES
} from '@agentic-sdlc/shared-types';

// ❌ WRONG - Never do this:
// import { AgentEnvelopeSchema } from '@agentic-sdlc/shared-types/src/messages/agent-envelope';

import type { YourAgentInput, YourAgentOutput, YourAgentMetrics } from './types';

/**
 * YourAgent
 *
 * Purpose: [Describe what this agent does]
 *
 * Responsibilities:
 * - [Responsibility 1]
 * - [Responsibility 2]
 * - [Responsibility 3]
 */
export class YourAgent extends BaseAgent {
  private logger: pino.Logger;

  constructor(
    messageBus: IMessageBus,
    loggerConfigService?: LoggerConfigService,
    configurationManager?: ConfigurationManager,
    serviceLocator?: ServiceLocator
  ) {
    // Define agent capabilities
    const capabilities: AgentCapabilities = {
      type: 'your_agent_type',  // Must match AGENT_TYPES constant
      version: '1.0.0',
      capabilities: [
        'analyze-inputs',
        'process-data',
        'generate-outputs'
        // List all capabilities your agent provides
      ],
      max_tokens: 4096,  // Optional: Claude API token limit
      timeout_ms: 300000  // Optional: 5-minute timeout
    };

    // Call parent constructor with capabilities and message bus
    super(capabilities, messageBus, loggerConfigService, configurationManager, serviceLocator);

    // Initialize logger for this agent
    this.logger = pino({
      name: 'YourAgent',
      level: process.env.LOG_LEVEL || 'info'
    });
  }

  /**
   * CORE METHOD: execute()
   *
   * This is the ONLY method you MUST override.
   *
   * Input: AgentEnvelope (validated by BaseAgent.receiveTask())
   * Output: TaskResult
   *
   * The envelope contains:
   * - task_id: Unique task identifier
   * - workflow_id: Parent workflow identifier
   * - agent_type: Type of agent (matches your agent type)
   * - workflow_context: Current workflow stage, previous outputs, etc.
   * - payload: Agent-specific input data
   * - trace: Distributed trace context (trace_id, span_id)
   * - constraints: Timeout, retry limits, confidence thresholds
   */
  async execute(task: AgentEnvelope): Promise<TaskResult> {
    const startTime = Date.now();
    const traceId = task.trace.trace_id;

    try {
      this.logger.info(
        { traceId, taskId: task.task_id, stage: task.workflow_context.current_stage },
        '🔍 [AGENT-TRACE] Starting task execution'
      );

      // 1. Extract and validate input from task payload
      const input = this.extractAndValidateInput(task.payload);
      this.logger.debug({ input }, 'Input extracted and validated');

      // 2. Call Claude API or perform processing logic
      const result = await this.processInput(input, task, traceId);
      this.logger.debug({ result }, 'Processing complete');

      // 3. Calculate metrics
      const processingTimeMs = Date.now() - startTime;
      const metrics: YourAgentMetrics = {
        processingTimeMs,
        itemsProcessed: 1  // Update based on your implementation
      };

      // 4. Return TaskResult
      this.logger.info(
        { traceId, taskId: task.task_id, processingTimeMs },
        '🔍 [AGENT-TRACE] Task execution completed successfully'
      );

      return {
        task_id: task.task_id,
        workflow_id: task.workflow_id,
        agent_id: this.agentId,
        status: 'success',
        result: result as unknown,  // Your processing output
        metadata: {
          completed_at: new Date().toISOString(),
          stage: task.workflow_context.current_stage
        },
        metrics
      };

    } catch (error) {
      const processingTimeMs = Date.now() - startTime;

      this.logger.error(
        { traceId, taskId: task.task_id, error, processingTimeMs },
        '🔍 [AGENT-TRACE] Task execution failed'
      );

      return {
        task_id: task.task_id,
        workflow_id: task.workflow_id,
        agent_id: this.agentId,
        status: 'failed',
        result: null,
        error: {
          code: 'EXECUTION_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          details: error instanceof Error ? error.stack : undefined
        },
        metadata: {
          failed_at: new Date().toISOString(),
          stage: task.workflow_context.current_stage
        }
      };
    }
  }

  /**
   * Helper: Extract and validate input from task payload
   *
   * This validates that the required fields are present in the task payload.
   */
  private extractAndValidateInput(payload: any): YourAgentInput {
    if (!payload || typeof payload !== 'object') {
      throw new Error('Invalid payload: must be an object');
    }

    // Validate required fields
    if (!payload.requirement || typeof payload.requirement !== 'string') {
      throw new Error('Missing required field: requirement');
    }

    return {
      requirement: payload.requirement,
      // Extract other fields
    };
  }

  /**
   * Helper: Process input using Claude API
   *
   * This demonstrates how to call Claude for AI-powered processing.
   * BaseAgent provides `this.callClaude()` helper for API calls.
   */
  private async processInput(
    input: YourAgentInput,
    task: AgentEnvelope,
    traceId: string
  ): Promise<YourAgentOutput> {
    // Example: Call Claude API via BaseAgent helper
    const systemPrompt = `You are an agent that processes: ${input.requirement}`;

    const response = await this.executeWithRetry(
      async () => {
        return await this.callClaude(
          `Process this: ${input.requirement}`,
          systemPrompt,
          4096  // max_tokens
        );
      },
      3  // max retries
    );

    // Parse and return result
    return {
      result: response
    };
  }
}
```

**2.3 Create `src/index.ts`** (Package exports)
```typescript
/**
 * your-agent-name/src/index.ts
 * Public API exports
 */

export { YourAgent } from './your-agent-name';
export type { YourAgentInput, YourAgentOutput, YourAgentMetrics } from './types';
```

**2.4 Create `src/run-agent.ts`** (Standalone runner)
```typescript
/**
 * your-agent-name/src/run-agent.ts
 *
 * This file allows the agent to run as a standalone PM2 process.
 * It initializes the dependency injection container and starts the agent.
 */

import pino from 'pino';
import { OrchestratorContainer } from '@agentic-sdlc/orchestrator';
import { YourAgent } from './your-agent-name';

const logger = pino({ name: 'YourAgent-Startup', level: 'info' });

async function main() {
  try {
    logger.info('🚀 Initializing YourAgent...');

    // 1. Create DI container
    const container = new OrchestratorContainer({
      redisUrl: process.env.REDIS_URL || 'redis://localhost:6380',
      redisNamespace: 'agent-your-agent-type'
    });

    // 2. Initialize container (creates Redis connections, message bus)
    await container.initialize();
    logger.info('✅ DI container initialized');

    // 3. Create and start agent
    const messageBus = container.getBus();
    const agent = new YourAgent(messageBus);

    await agent.initialize();
    logger.info('✅ Agent initialized and listening for tasks');

    // 4. Graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('⏹️  Shutting down gracefully...');
      await agent.cleanup();
      await container.shutdown();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('⏹️  Shutting down gracefully (SIGTERM)...');
      await agent.cleanup();
      await container.shutdown();
      process.exit(0);
    });

  } catch (error) {
    logger.error({ error }, '❌ Fatal error during startup');
    process.exit(1);
  }
}

main();
```

---

## 📋 STEP 3: Register Agent Type

### Goal
Register your agent type in the system constants so the orchestrator knows about it.

### Instructions

**3.1 Add to Agent Types Constant**

File: `/packages/shared/types/src/constants/pipeline.constants.ts`

```typescript
// Find this section:
export const AGENT_TYPES = {
  SCAFFOLD: 'scaffold',
  VALIDATION: 'validation',
  E2E: 'e2e_test',
  INTEGRATION: 'integration',
  DEPLOYMENT: 'deployment',
  // ADD YOUR AGENT HERE:
  YOUR_AGENT: 'your_agent_type'  // Match the type in your agent's capabilities
};
```

**3.2 Verify Export**
Ensure the constant is exported from the shared-types package index:

File: `/packages/shared/types/src/index.ts`

```typescript
export { AGENT_TYPES, WORKFLOW_STAGES } from './constants/pipeline.constants';
```

---

## 📋 STEP 4: Update Orchestrator Routing

### Goal
Map workflow stages to your agent type so the orchestrator knows when to invoke it.

### Instructions

**4.1 Update Stage-to-Agent Mapping**

File: `/packages/orchestrator/src/services/workflow.service.ts`

Find the `getAgentTypeForStage()` method:

```typescript
private getAgentTypeForStage(stage: string): string {
  const stageToAgent: Record<string, string> = {
    'initialization': AGENT_TYPES.SCAFFOLD,
    'validation': AGENT_TYPES.VALIDATION,
    'e2e_testing': AGENT_TYPES.E2E,
    'integration': AGENT_TYPES.INTEGRATION,
    'deployment': AGENT_TYPES.DEPLOYMENT,
    // ADD YOUR MAPPING:
    'your_stage': AGENT_TYPES.YOUR_AGENT
  };

  return stageToAgent[stage] || AGENT_TYPES.SCAFFOLD;
}
```

**4.2 Update buildAgentEnvelope()**

Find the `buildAgentEnvelope()` method and add a case for your agent type:

```typescript
private buildAgentEnvelope(
  agentType: string,
  task: any,
  workflowContext: any
): AgentEnvelope {
  // Add case for your agent
  switch (agentType) {
    case AGENT_TYPES.YOUR_AGENT:
      return {
        message_id: generateId(),
        task_id: generateId(),
        workflow_id: workflowContext.workflow_id,
        agent_type: AGENT_TYPES.YOUR_AGENT,
        priority: 'medium',
        status: 'pending',
        constraints: {
          timeout_ms: 300000,
          max_retries: 2,
          required_confidence: 0.8
        },
        metadata: {
          created_at: new Date().toISOString(),
          created_by: 'orchestrator',
          envelope_version: '2.0.0'
        },
        trace: {
          trace_id: workflowContext.trace_id,
          span_id: generateId(),
          parent_span_id: workflowContext.span_id
        },
        workflow_context: workflowContext,
        payload: {
          // Your agent-specific payload structure
          requirement: task.requirement
        }
      };

    // ... other cases
  }
}
```

---

## 📋 STEP 5: Add PM2 Process

### Goal
Enable your agent to run as a standalone PM2 process.

### Instructions

**5.1 Update PM2 Configuration**

File: `/pm2/ecosystem.dev.config.js`

Add your agent to the apps array:

```javascript
module.exports = {
  apps: [
    // ... existing apps (orchestrator, scaffold-agent, etc.)
    {
      name: 'your-agent',
      script: 'packages/agents/your-agent-name/dist/run-agent.js',
      instances: 1,
      env: {
        NODE_ENV: 'development',
        LOG_LEVEL: 'debug',
        REDIS_URL: 'redis://localhost:6380'
      },
      error_file: 'scripts/logs/your-agent-error.log',
      out_file: 'scripts/logs/your-agent-out.log',
      merge_logs: true,
      watch: false,
      ignore_watch: ['node_modules', 'dist', '.git'],
      watch_delay: 2000
    }
  ]
};
```

---

## 🧪 STEP 6: Testing & Validation

### Goal
Verify your agent works correctly before deployment.

### Instructions

**6.1 Build the Agent**
```bash
cd packages/agents/your-agent-name
pnpm install
pnpm build
```

**6.2 Type Check**
```bash
pnpm type-check
```

**6.3 Start the Agent in Dev Mode**
```bash
cd packages/agents/your-agent-name
pnpm dev
```

You should see:
```
🚀 Initializing YourAgent...
✅ DI container initialized
✅ Agent initialized and listening for tasks
```

**6.4 Test with a Workflow**

From project root:
```bash
./scripts/run-pipeline-test.sh "Your Test Name"
```

**6.5 Monitor Logs**
```bash
pnpm pm2:logs
# Filter for your agent: grep "your-agent" in logs
```

---

## 📝 Implementation Checklist

Use this checklist when creating a new agent:

### Pre-Implementation
- [ ] **Understand requirements** - What should the agent do?
- [ ] **Plan interface** - What are inputs/outputs?
- [ ] **Review existing agents** - Copy patterns from similar agents

### Implementation
- [ ] **Create package structure** (Step 1)
  - [ ] `package.json` created
  - [ ] `tsconfig.json` created
  - [ ] `src/types.ts` defined

- [ ] **Implement agent class** (Step 2)
  - [ ] `src/your-agent-name.ts` extends BaseAgent
  - [ ] `execute()` method implemented
  - [ ] Input validation implemented
  - [ ] Error handling with proper logging
  - [ ] Metrics collection
  - [ ] `src/run-agent.ts` created
  - [ ] `src/index.ts` created with exports

- [ ] **Register agent** (Step 3)
  - [ ] Added to AGENT_TYPES constant
  - [ ] Type exported from shared-types package

- [ ] **Update orchestrator** (Step 4)
  - [ ] Updated `getAgentTypeForStage()` mapping
  - [ ] Updated `buildAgentEnvelope()` with payload structure
  - [ ] Imported AGENT_TYPES

- [ ] **Add PM2 process** (Step 5)
  - [ ] Updated ecosystem.dev.config.js
  - [ ] Added error/output log paths

- [ ] **Testing** (Step 6)
  - [ ] Agent builds without errors
  - [ ] Type checking passes
  - [ ] Agent starts and listens
  - [ ] Logs show proper trace messages
  - [ ] Workflow test completes successfully

### Code Quality
- [ ] **No console.log()** - Use pino logger
- [ ] **All imports use package index** - No `/src/` imports
- [ ] **Error handling** - All promises have try/catch
- [ ] **Type safety** - TypeScript strict mode passes
- [ ] **Logging** - 🔍 [AGENT-TRACE] marks included
- [ ] **Comments** - Complex logic documented

---

## 🔍 Debugging Guide

### Agent Not Receiving Tasks

**Check:**
1. Agent is running: `pnpm pm2:status | grep your-agent`
2. Agent type matches constant: Check AGENT_TYPES
3. Stage mapping exists: Check `getAgentTypeForStage()`
4. Redis connection: Check `pnpm pm2:logs | grep "Redis"`

**Fix:**
```bash
# Restart agent
pnpm pm2:restart your-agent

# Check connection
redis-cli KEYS "agent:your_agent_type*"
```

### Agent Crashes on Startup

**Check:**
1. All dependencies installed: `cd packages/agents/your-agent-name && pnpm install`
2. TypeScript compilation: `pnpm build` in agent directory
3. Environment variables: Check `REDIS_URL` is accessible

**Fix:**
```bash
# Full rebuild
cd packages/agents/your-agent-name
pnpm install
pnpm build
pnpm dev  # Run in dev mode to see errors
```

### Task Validation Fails

**Check:**
1. Payload structure matches input extraction
2. AgentEnvelope is valid (check buildAgentEnvelope())
3. Required fields present in payload

**Fix:**
Add detailed logging in `extractAndValidateInput()`:
```typescript
private extractAndValidateInput(payload: any): YourAgentInput {
  console.error('Raw payload:', JSON.stringify(payload, null, 2));
  // ... validation
}
```

---

## 📚 Reference: Key Concepts

### AgentEnvelope (Task Assignment Format)

```typescript
interface AgentEnvelope {
  // Identification
  message_id: string;              // Unique message ID
  task_id: string;                 // Task identifier
  workflow_id: string;             // Parent workflow ID
  agent_type: string;              // Which agent type (must match AGENT_TYPES)

  // Execution Control
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'running' | 'completed' | 'failed';

  // Constraints
  constraints: {
    timeout_ms: number;            // Execution timeout
    max_retries: number;           // Retry limit
    required_confidence: number;   // Confidence threshold
  };

  // Metadata
  metadata: {
    created_at: string;            // ISO timestamp
    created_by: string;            // 'orchestrator'
    envelope_version: string;      // '2.0.0'
  };

  // Distributed Tracing
  trace: {
    trace_id: string;              // Correlation ID
    span_id: string;               // This task's span ID
    parent_span_id?: string;       // Parent task span ID
  };

  // Workflow Context
  workflow_context: {
    workflow_id: string;
    workflow_type: string;
    workflow_name: string;
    current_stage: string;         // Current stage name
    stage_outputs: Record<string, any>;  // Outputs from previous stages
  };

  // Agent-Specific Payload
  payload: any;                    // Your agent receives this as input
}
```

### TaskResult (Agent Output Format)

```typescript
interface TaskResult {
  task_id: string;                 // Must match input task_id
  workflow_id: string;             // Must match input workflow_id
  agent_id: string;                // Your agent's unique ID
  status: 'success' | 'failed';
  result: any;                     // Your processing output (null if failed)
  error?: {                        // Only if failed
    code: string;
    message: string;
    details?: string;
  };
  metadata: {
    completed_at: string;          // ISO timestamp
    stage: string;                 // Current workflow stage
  };
  metrics?: {                      // Optional performance data
    [key: string]: any;
  };
}
```

### BaseAgent Helper Methods

Your agent inherits these useful methods:

```typescript
// Call Claude API with automatic retries
protected async callClaude(
  prompt: string,
  systemPrompt?: string,
  maxTokens?: number
): Promise<string>

// Execute operation with exponential backoff retries
protected async executeWithRetry<T>(
  operation: () => Promise<T>,
  maxRetries?: number
): Promise<T>

// Generate distributed trace ID
protected generateTraceId(): string

// Access to Anthropic SDK
protected readonly anthropic: Anthropic

// Access to message bus
protected readonly messageBus: IMessageBus

// Agent's unique ID
protected readonly agentId: string
```

---

## 🚀 Quick Reference: Common Agent Patterns

### Pattern 1: Claude-Only Agent
Agent that only calls Claude API:

```typescript
async execute(task: AgentEnvelope): Promise<TaskResult> {
  const response = await this.callClaude(
    task.payload.requirement,
    'You are an expert assistant.'
  );
  return { task_id, workflow_id, agent_id, status: 'success', result: { output: response } };
}
```

### Pattern 2: Multi-Step Agent
Agent with multiple processing steps:

```typescript
async execute(task: AgentEnvelope): Promise<TaskResult> {
  // Step 1: Analyze
  const analysis = await this.analyze(task.payload);

  // Step 2: Process
  const processed = await this.process(analysis);

  // Step 3: Generate
  const output = await this.generate(processed);

  return { task_id, workflow_id, agent_id, status: 'success', result: output };
}
```

### Pattern 3: File-Based Agent
Agent that generates files:

```typescript
async execute(task: AgentEnvelope): Promise<TaskResult> {
  const files = await this.generateFiles(task.payload);
  return {
    task_id, workflow_id, agent_id, status: 'success',
    result: { files: files.map(f => f.path) }
  };
}
```

---

## 🔗 Important Links & Files

| What | Where |
|------|-------|
| Agent Types Constant | `/packages/shared/types/src/constants/pipeline.constants.ts` |
| BaseAgent Class | `/packages/agents/base-agent/src/base-agent.ts` |
| AgentEnvelope Schema | `/packages/shared/types/src/messages/agent-envelope.ts` |
| Orchestrator Service | `/packages/orchestrator/src/services/workflow.service.ts` |
| State Machine | `/packages/orchestrator/src/state-machine/workflow-state-machine.ts` |
| PM2 Config | `/pm2/ecosystem.dev.config.js` |
| Example: Scaffold Agent | `/packages/agents/scaffold-agent/src/scaffold-agent.ts` |
| Example: Validation Agent | `/packages/agents/validation-agent/src/validation-agent.ts` |

---

## ✅ Validation Checklist: Before Committing

- [ ] `pnpm build` succeeds with zero errors
- [ ] `pnpm type-check` passes (no TypeScript errors)
- [ ] `pnpm dev` starts without crashing
- [ ] Logs show trace messages with proper format
- [ ] Agent receives tasks from orchestrator
- [ ] Agent completes tasks and reports results
- [ ] Workflow progresses past your agent's stage
- [ ] No direct console.log() statements (only pino)
- [ ] All imports use package indexes (no `/src/` paths)
- [ ] Code follows patterns from existing agents
- [ ] Error handling covers all failure cases
- [ ] PM2 process configured and working

---

## 🎓 Learning Path

If you're new to this architecture, read in this order:

1. **CLAUDE.md** - Overall system status and architecture overview
2. **SCHEMA_USAGE_DEEP_DIVE.md** - Detailed schema documentation
3. **This file (AGENT-PLAYBOOK.md)** - Step-by-step agent creation
4. **Example agent** - Read `/packages/agents/scaffold-agent/src/scaffold-agent.ts`
5. **BaseAgent** - Study `/packages/agents/base-agent/src/base-agent.ts`
6. **State machine** - Understand `/packages/orchestrator/src/state-machine/workflow-state-machine.ts`

---

## 💡 Tips & Gotchas

### ✅ DO:
- Use `@agentic-sdlc/shared-types` for imports
- Add 🔍 [AGENT-TRACE] to important log lines
- Test agent in isolation first (`pnpm dev`)
- Follow naming patterns: `YourAgentInput`, `YourAgentOutput`
- Implement retry logic for external API calls
- Extract trace_id from task and include in logs

### ❌ DON'T:
- Import from `/src/` paths (breaks in production)
- Use `console.log()` (use pino logger)
- Copy BaseAgent code to your agent package
- Make direct Redis calls (use IMessageBus)
- Skip error handling in execute()
- Forget graceful shutdown handlers in run-agent.ts

---

## 📞 Getting Help

**Questions about:**
- **Architecture** → Read CLAUDE.md
- **Schemas** → Read SCHEMA_USAGE_DEEP_DIVE.md
- **Debugging** → Read AGENTIC_SDLC_RUNBOOK.md
- **Existing patterns** → Study existing agents (scaffold, validation, e2e)

---

**Status:** ✅ Ready for agent implementation
**Last Updated:** 2025-11-16 (Session #69)
