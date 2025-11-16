---
name: epcc-code
description: Code phase of EPCC workflow - implement with confidence
version: 1.0.0
argument-hint: "[task-to-implement] [--tdd|--quick]"
---

# EPCC Code Command

You are in the **CODE** phase of the Explore-Plan-Code-Commit workflow. Transform plans into working code.

## Implementation Target
$ARGUMENTS

If no specific task was provided above, check `EPCC_PLAN.md` for the next task to implement.

## 💻 Coding Objectives

1. **Follow the Plan**: Implement according to EPCC_PLAN.md
2. **Apply Patterns**: Use patterns identified in EPCC_EXPLORE.md
3. **Write Clean Code**: Maintainable, tested, documented
4. **Handle Edge Cases**: Consider what could go wrong
5. **Ensure Quality**: Test as you code

## Extended Thinking Strategy

- **Simple features**: Focus on clarity
- **Complex logic**: Think about edge cases
- **Performance critical**: Think hard about optimization
- **Security sensitive**: Ultrathink about vulnerabilities

## Coding Guidelines for Agentic SDLC Platform

Before you start coding:
1. **Review EPCC_PLAN.md** - Follow the task breakdown and estimates
2. **Review EPCC_EXPLORE.md** - Reference discovered patterns
3. **Read CLAUDE.md** - Understand architecture rules and constraints
4. **Check recent commits** - See Session #67-68 patterns for this platform

Key principles:
- **Hexagonal First**: Place code in the right hexagonal layer (core/ports/adapters/services)
- **Never Duplicate**: Canonical files exist - use them, don't copy them
- **Message Bus Pattern**: Use packages/orchestrator/src/hexagonal/adapters/redis-bus.adapter.ts
- **Schema Validation**: All messages must validate against AgentEnvelopeSchema v2.0.0
- **Test As You Code**: Write tests incrementally, TDD preferred for complex logic
- **Import Correctly**: Use package index from @agentic-sdlc/shared-types, never /src/ paths

Note: Reference EPCC_EXPLORE.md and EPCC_PLAN.md throughout implementation.

## Implementation Approach

### Step 1: Review Context
```bash
# Review exploration findings
cat EPCC_EXPLORE.md

# Review implementation plan
cat EPCC_PLAN.md

# Check current task status
grep -A 5 "Task Breakdown" EPCC_PLAN.md

# Review CLAUDE.md for current project status
cat CLAUDE.md
```

### Step 2: Set Up Development Environment
```bash
# Create feature branch aligned with task name
git checkout -b feature/[task-name-from-plan]

# Install dependencies (if package.json changed)
pnpm install

# Start development environment (PM2-managed 7 services)
./scripts/env/start-dev.sh  # Starts orchestrator + agents + dashboard

# Verify all services are running
./scripts/env/check-health.sh  # Should show 7/7 healthy

# In another terminal, set up test watcher
pnpm test --watch  # Watch mode for your specific package

# In another terminal, build and watch
turbo run build --filter=@agentic-sdlc/[package-name] --watch

# Tail logs to monitor changes
pnpm pm2:logs  # Monitor all PM2 services in real-time

# Focus on the specific package and hexagonal layer
# Reference EPCC_PLAN.md task details
```

### Step 3: Test-Driven Development (if --tdd flag)
```typescript
// 1. Write failing test first (Vitest)
// File: packages/[package]/src/__tests__/feature.test.ts
import { describe, it, expect } from 'vitest'
import { newFeature } from '../feature'

describe('newFeature', () => {
    it('should process input correctly', () => {
        const result = newFeature(inputData)
        expect(result).toEqual(expectedOutput)
    })
})

// 2. Run test to confirm it fails
// pnpm test feature.test.ts

// 3. Write minimal code to pass
// File: packages/[package]/src/feature.ts
export function newFeature(data: InputType): OutputType {
    return process(data)
}

// 4. Refactor while keeping tests green
// 5. Build to verify TypeScript compilation
// turbo run build --filter=@agentic-sdlc/[package]
```

### Step 4: Implementation Patterns for This Platform

#### Pattern: Hexagonal Architecture - Port (Interface)
```typescript
// File: packages/orchestrator/src/hexagonal/ports/INewPort.ts
export interface INewPort {
    processData(input: InputType): Promise<OutputType>
    validateData(input: InputType): boolean
}
```

#### Pattern: Hexagonal Architecture - Adapter (Implementation)
```typescript
// File: packages/orchestrator/src/hexagonal/adapters/NewAdapter.ts
import { INewPort } from '../ports/INewPort'

export class NewAdapter implements INewPort {
    async processData(input: InputType): Promise<OutputType> {
        if (!this.validateData(input)) {
            throw new Error('Invalid input')
        }
        return await this.transform(input)
    }

    validateData(input: InputType): boolean {
        // Validation logic
        return true
    }

    private async transform(input: InputType): Promise<OutputType> {
        // Transformation logic
    }
}
```

#### Pattern: Service Layer with Message Bus
```typescript
// File: packages/orchestrator/src/services/feature.service.ts
import { IMessageBus } from '../hexagonal/ports/IMessageBus'
import { buildAgentEnvelope } from '@agentic-sdlc/shared-types'

export class FeatureService {
    constructor(
        private readonly messageBus: IMessageBus,
        private readonly featureAdapter: INewPort
    ) {}

    async execute(input: InputType): Promise<void> {
        try {
            const result = await this.featureAdapter.processData(input)

            // Wrap in AgentEnvelopeSchema v2.0.0 (NEVER duplicate)
            const envelope = buildAgentEnvelope({
                payload: result,
                stage: 'feature:complete',
                workflowId: input.workflowId,
                agentType: 'orchestrator'
            })

            // Publish via redis-bus adapter (NEVER duplicate)
            await this.messageBus.publish('feature:result', envelope, {
                key: input.id,
                mirrorToStream: 'stream:feature:results'
            })
        } catch (error) {
            console.error('[FeatureService] Failed to process:', error)
            throw error
        }
    }
}
```

#### Pattern: Redis Streams Subscribe/Publish
```typescript
// CANONICAL: packages/orchestrator/src/hexagonal/adapters/redis-bus.adapter.ts
// Use this adapter - do NOT duplicate redis logic
// Subscription pattern:
await this.messageBus.subscribe(
    'agent:scaffold:tasks',
    async (envelope: AgentEnvelope) => {
        // envelope.payload contains task data
        // envelope.trace.trace_id for distributed tracing
        // envelope.metadata.stage for routing
        await this.handleTask(envelope)
    },
    {
        consumerGroup: 'orchestrator-consumer-group',
        fromBeginning: false
    }
)

// Publish pattern (wrap in envelope first):
const envelope = buildAgentEnvelope({
    payload: taskData,
    stage: 'orchestrator:task:created',
    workflowId,
    agentType: 'orchestrator'
})
await this.messageBus.publish('agent:scaffold:tasks', envelope, {
    key: workflowId
})
```

#### Pattern: Agent Implementation (extends BaseAgent)
```typescript
// File: packages/agents/[agent-name]/src/[agent-name]-agent.ts
import { BaseAgent } from '@agentic-sdlc/base-agent'
import { AgentEnvelope } from '@agentic-sdlc/shared-types'

export class MyAgent extends BaseAgent {
    constructor(messageBus) {
        super(messageBus, {
            type: 'my-agent',
            version: '1.0.0',
            capabilities: ['capability1']
        })
    }

    async processTask(envelope: AgentEnvelope): Promise<AgentEnvelope> {
        console.log(`[MyAgent] Processing task: ${envelope.trace.trace_id}`)

        // Do work
        const result = await this.doWork(envelope.payload)

        // Return result wrapped in envelope (BaseAgent handles publish)
        return this.buildResultEnvelope(result, envelope)
    }
}
```

## Code Quality Checklist

### Before Writing Code
- [ ] Understand requirements from EPCC_PLAN.md
- [ ] Review similar code patterns
- [ ] Set up test environment
- [ ] Plan error handling

### While Coding
- [ ] Follow project conventions
- [ ] Write self-documenting code
- [ ] Add meaningful comments for complex logic
- [ ] Handle edge cases
- [ ] Log important operations

### After Coding
- [ ] Run all tests: `turbo run test --filter=@agentic-sdlc/[package]`
- [ ] Check code coverage: `turbo run test:coverage`
- [ ] Verify no /src/ imports in code (use @agentic-sdlc/shared-types)
- [ ] Build affected packages: `turbo run build --filter=@agentic-sdlc/[package]`
- [ ] Build everything: `turbo run build` (verify no errors)
- [ ] Run type checking: `turbo run typecheck`
- [ ] Run linters: `turbo run lint`
- [ ] Update package.json if new dependencies added
- [ ] Verify AgentEnvelopeSchema usage (if message changes)
- [ ] Update code comments with platform context
- [ ] Review for security issues (input validation, trace_id safety)
- [ ] Run E2E tests if applicable: `./scripts/run-pipeline-test.sh "Test Name"`
- [ ] Check logs for errors: `pnpm pm2:logs` (no ERROR/CRITICAL)
- [ ] Update CLAUDE.md if appropriate (Session milestone, fixes)

## Output File: EPCC_CODE.md

Document your implementation progress in `EPCC_CODE.md`:

```markdown
# Code Implementation Report

## Date: [Current Date]
## Feature: [Feature Name]

## Implemented Tasks
- [x] Task 1: Description
  - Files modified: [list]
  - Tests added: [count]
  - Lines of code: [count]

- [x] Task 2: Description
  - Files modified: [list]
  - Tests added: [count]
  - Lines of code: [count]

## Code Metrics
- Test Coverage: X%
- Linting Issues: X
- Security Scan: Pass/Fail
- Performance: Baseline/Improved

## Key Decisions
1. Decision: Rationale
2. Decision: Rationale

## Challenges Encountered
1. Challenge: How resolved
2. Challenge: How resolved

## Testing Summary
- Unit Tests: X passed, X failed
- Integration Tests: X passed, X failed
- E2E Tests: X passed, X failed

## Documentation Updates
- [ ] Code comments added
- [ ] API documentation updated
- [ ] README updated
- [ ] CHANGELOG entry added

## Ready for Review
- [ ] All tests passing
- [ ] Code reviewed self
- [ ] Documentation complete
- [ ] No console.logs or debug code
- [ ] Security considerations addressed
```

## Platform-Specific Implementation Patterns

### Agent Implementation (Standard Pattern)
```typescript
// File: packages/agents/[agent-name]/src/[agent-name]-agent.ts
import { BaseAgent } from '@agentic-sdlc/base-agent'
import { AgentEnvelope } from '@agentic-sdlc/shared-types'

export class MyAgent extends BaseAgent {
    async processTask(envelope: AgentEnvelope): Promise<AgentEnvelope> {
        // BaseAgent handles message subscription automatically
        console.log(`[MyAgent] Task: ${envelope.trace.trace_id} Stage: ${envelope.metadata.stage}`)

        try {
            // Do the work
            const result = await this.executeWork(envelope.payload)

            // Return wrapped in envelope (BaseAgent publishes automatically)
            return this.buildResultEnvelope(result, envelope)
        } catch (error) {
            console.error(`[MyAgent] Error: ${error.message}`, { traceId: envelope.trace.trace_id })
            throw error
        }
    }

    private async executeWork(payload: any): Promise<any> {
        // Implementation specific to this agent
        return payload
    }
}
```

### Container Integration (OrchestratorContainer)
```typescript
// File: packages/agents/[agent-name]/src/run-agent.ts
import { OrchestratorContainer } from '@agentic-sdlc/orchestrator/hexagonal/bootstrap'
import { MyAgent } from './[agent-name]-agent'

async function main() {
    // OrchestratorContainer handles dependency injection
    const container = new OrchestratorContainer({
        redisUrl: process.env.REDIS_URL || 'redis://localhost:6380',
        redisNamespace: 'agent-[agent-name]',
        dbUrl: process.env.DATABASE_URL || 'postgresql://...',
        coordinators: {}
    })

    await container.initialize()
    const messageBus = container.getBus()

    const agent = new MyAgent(messageBus)
    await agent.start()

    console.log('[MyAgent] Started successfully')
}

main().catch(console.error)
```

### Service with Dependency Injection Pattern
```typescript
// File: packages/orchestrator/src/services/workflow.service.ts
import { OrchestratorContainer } from '../hexagonal/bootstrap'
import { WorkflowStateMachine } from '../state-machine/workflow-state-machine'

export class WorkflowService {
    constructor(
        private readonly messageBus: IMessageBus,
        private readonly stateManager: IStateManager,
        private readonly stateMachine: WorkflowStateMachine
    ) {}

    async createWorkflow(request: WorkflowRequest): Promise<WorkflowResponse> {
        // Dependency injection provides all needed services
        const envelope = buildAgentEnvelope({
            payload: request,
            stage: 'orchestrator:workflow:created',
            workflowId: generateId(),
            agentType: 'orchestrator'
        })

        await this.messageBus.publish('workflow:created', envelope)
        return { workflowId: envelope.metadata.workflowId }
    }
}
```

### Workflow State Machine Integration
```typescript
// File: packages/orchestrator/src/state-machine/workflow-state-machine.ts
// This is the canonical workflow orchestration logic
// It determines which agent gets tasks based on current stage

export class WorkflowStateMachine {
    async processEnvelope(envelope: AgentEnvelope): Promise<void> {
        const stage = envelope.metadata.stage

        switch (stage) {
            case 'orchestrator:workflow:created':
                // Route to scaffold agent
                await this.routeToAgent(envelope, 'scaffold-agent')
                break
            case 'scaffold:complete':
                // Route to validation agent
                await this.routeToAgent(envelope, 'validation-agent')
                break
            // ... more stages
        }
    }

    private async routeToAgent(envelope: AgentEnvelope, agentName: string): Promise<void> {
        // State machine updates metadata with next stage
        const nextEnvelope = {
            ...envelope,
            metadata: {
                ...envelope.metadata,
                stage: `${agentName}:started`
            }
        }
        await this.messageBus.publish(`agent:${agentName}:tasks`, nextEnvelope)
    }
}
```

## Integration with Other Phases

### From PLAN:
- Follow task breakdown from EPCC_PLAN.md
- Implement according to technical design
- Meet acceptance criteria

### To COMMIT:
- Ensure EPCC_CODE.md is complete
- All tests passing
- Code review ready

## Final Steps

1. Update `EPCC_CODE.md` with implementation details
2. Run final test suite
3. Perform self-review
4. Prepare for commit phase

Remember: **Clean code is written once but read many times!**