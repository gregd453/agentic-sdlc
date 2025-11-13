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

## Parallel Coding Subagents

Deploy specialized coding agents concurrently:
@test-generator @optimization-engineer @security-reviewer @documentation-agent @ux-optimizer

- @test-generator: Write tests BEFORE implementation (TDD approach)
- @optimization-engineer: Optimize algorithms and queries during implementation
- @security-reviewer: Validate security as code is written
- @documentation-agent: Generate inline documentation and API docs
- @ux-optimizer: Ensure user experience best practices in implementation

Note: Review patterns in EPCC_EXPLORE.md and follow the plan in EPCC_PLAN.md if they exist.

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
# Create feature branch
git checkout -b feature/[task-name]

# Install dependencies (if package.json changed)
pnpm install

# Set up test watchers (Vitest)
pnpm test --watch  # Watch mode for tests

# Build affected packages
turbo run build --filter=@agentic-sdlc/[package-name]

# Start development environment (if needed for E2E)
./scripts/env/start-dev.sh

# Open relevant files in your editor
# Focus on the specific package and hexagonal layer
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

### Step 4: Implementation Patterns

#### Pattern: Hexagonal Architecture - Port (Interface)
```typescript
// File: packages/orchestrator/src/hexagonal/ports/IFeaturePort.ts
export interface IFeaturePort {
    processData(input: InputType): Promise<OutputType>
    validateData(input: InputType): boolean
}
```

#### Pattern: Hexagonal Architecture - Adapter (Implementation)
```typescript
// File: packages/orchestrator/src/hexagonal/adapters/FeatureAdapter.ts
import { IFeaturePort } from '../ports/IFeaturePort'

export class FeatureAdapter implements IFeaturePort {
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

#### Pattern: Service Layer
```typescript
// File: packages/orchestrator/src/services/feature.service.ts
import { IMessageBus } from '../hexagonal/ports/IMessageBus'

export class FeatureService {
    constructor(
        private readonly messageBus: IMessageBus,
        private readonly featureAdapter: IFeaturePort
    ) {}

    async execute(input: InputType): Promise<void> {
        try {
            const result = await this.featureAdapter.processData(input)

            // Publish result via message bus
            await this.messageBus.publish('feature:result', result, {
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

#### Pattern: Message Bus Integration
```typescript
// Subscribe to messages
await this.messageBus.subscribe(
    'agent:scaffold:tasks',
    async (message) => {
        await this.handleTask(message)
    },
    {
        consumerGroup: 'agent-scaffold-group',
        fromBeginning: false
    }
)

// Publish messages
await this.messageBus.publish(
    'agent:scaffold:results',
    resultData,
    {
        key: workflowId,
        mirrorToStream: 'stream:agent:scaffold:results'
    }
)
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
- [ ] Run all tests: `pnpm test` or `turbo run test`
- [ ] Check code coverage: `turbo run test:coverage`
- [ ] Build packages: `turbo run build`
- [ ] Run type checking: `turbo run typecheck`
- [ ] Run linters: `turbo run lint`
- [ ] Update package.json if new dependencies added
- [ ] Update documentation
- [ ] Review for security issues
- [ ] Run E2E tests if applicable: `./scripts/run-pipeline-test.sh "Test Name"`

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

## Common Implementation Patterns

### Agent Implementation
```typescript
// File: packages/agents/[agent-name]/src/[agent-name]-agent.ts
import { BaseAgent } from '@agentic-sdlc/base-agent'
import { IMessageBus } from '@agentic-sdlc/orchestrator/hexagonal'

export class MyAgent extends BaseAgent {
    constructor(messageBus: IMessageBus) {
        super(messageBus, {
            type: 'my-agent',
            version: '1.0.0',
            capabilities: ['capability1', 'capability2']
        })
    }

    async processTask(task: TaskType): Promise<ResultType> {
        console.log(`[MyAgent] Processing task: ${task.id}`)

        // Implementation logic
        const result = await this.doWork(task)

        // Report result via message bus
        await this.reportResult(task.workflowId, result)

        return result
    }
}
```

### Container Integration
```typescript
// File: packages/agents/[agent-name]/src/run-agent.ts
import { OrchestratorContainer } from '@agentic-sdlc/orchestrator/hexagonal'
import { MyAgent } from './my-agent'

async function main() {
    const container = new OrchestratorContainer({
        redisUrl: process.env.REDIS_URL || 'redis://localhost:6380',
        redisNamespace: 'agent-my-agent',
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

### Dependency Injection Pattern
```typescript
// File: packages/orchestrator/src/hexagonal/bootstrap.ts
export class OrchestratorContainer {
    private messageBus: IMessageBus
    private stateManager: IStateManager

    async initialize(): Promise<void> {
        // Initialize dependencies
        this.messageBus = new RedisMessageBus(this.config)
        this.stateManager = new PostgresStateManager(this.config)

        await this.messageBus.connect()
        await this.stateManager.connect()
    }

    getBus(): IMessageBus {
        return this.messageBus
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