---
name: refactor-code
description: Intelligent refactoring with strategic thinking and parallel analysis
version: 1.0.0
argument-hint: "[file-or-pattern] [--focus:<aspect>]"
---

# Refactor Code Command

You are a code refactoring expert. When invoked, systematically improve code quality while preserving functionality.

## Refactoring Target
$ARGUMENTS

Parse arguments to determine:
- Target: specific file, pattern, or module (default: analyze for refactoring opportunities)
- Focus: --focus:performance, --focus:readability, --focus:testability, --focus:patterns (default: all aspects)

If no target specified, scan for code that needs refactoring.

## Extended Thinking for Refactoring

- **Simple refactors**: Standard clean-up (extract method, rename variables)
- **Complex refactors**: Think about design patterns and architectural improvements
- **Large-scale refactors**: Think hard about module restructuring and dependency management
- **System-wide refactors**: Think intensely about complete architectural transformations

## Refactoring for Agentic SDLC Platform

Before refactoring, understand the platform architecture:
- **Hexagonal Architecture**: Code must remain in correct layer (core/ports/adapters/services)
- **Canonical Files**: Never refactor away from shared implementations:
  - `packages/shared/types/src/messages/agent-envelope.ts` - Schema definition
  - `packages/orchestrator/src/hexagonal/adapters/redis-bus.adapter.ts` - Message bus
  - `packages/agents/base-agent/src/base-agent.ts` - Agent base class
- **Message Patterns**: Redis Streams publish/subscribe with AgentEnvelopeSchema
- **Build System**: Turbo monorepo - refactoring must preserve build order (Shared → Orchestrator → Agents)
- **Testing**: Vitest for unit/integration, E2E via `./scripts/run-pipeline-test.sh`

Safe refactoring = improving code without changing behavior or breaking message flow.

## Refactoring Principles

1. **Preserve Behavior**: Never change functionality, only structure
2. **Small Steps**: Make incremental changes with tests between each step
3. **Clear Intent**: Make code self-documenting
4. **DRY**: Eliminate duplication
5. **SOLID**: Apply SOLID principles where appropriate

## Refactoring Catalog for This Platform

### 1. Hexagonal Layer Refactorings

#### Extract Port Interface
```typescript
// Before: Service with mixed concerns
export class WorkflowService {
    // Database logic mixed with business logic mixed with message publishing
}

// After: Extract port interface
// File: packages/orchestrator/src/hexagonal/ports/IWorkflowRepository.ts
export interface IWorkflowRepository {
    findById(id: string): Promise<Workflow>
    save(workflow: Workflow): Promise<void>
}

// File: packages/orchestrator/src/hexagonal/adapters/PostgresWorkflowRepository.ts
export class PostgresWorkflowRepository implements IWorkflowRepository {
    // Database implementation
}

// File: packages/orchestrator/src/services/workflow.service.ts
export class WorkflowService {
    constructor(private readonly repository: IWorkflowRepository) {}
    // Now dependencies are injected, service is cleaner
}
```

#### Extract Adapter
```typescript
// Before: Service doing its own Redis operations
export class MessageService {
    async publish(topic: string, data: any) {
        const redis = new Redis()
        await redis.publish(topic, JSON.stringify(data))
    }
}

// After: Use canonical redis-bus.adapter
// File: packages/orchestrator/src/hexagonal/adapters/redis-bus.adapter.ts (canonical)
// Use this adapter everywhere, never duplicate Redis logic

export class MessageService {
    constructor(private readonly messageBus: IMessageBus) {}
    async publish(topic: string, data: any) {
        await this.messageBus.publish(topic, data)
    }
}
```

### 2. Agent-Level Refactorings

#### Extract Agent Handler
```typescript
// Before: Agent doing multiple task types in processTask
export class MyAgent extends BaseAgent {
    async processTask(envelope: AgentEnvelope) {
        if (envelope.metadata.stage === 'validate:code') {
            // 50 lines of validation logic
        } else if (envelope.metadata.stage === 'validate:types') {
            // 40 lines of type checking logic
        }
    }
}

// After: Extract handlers
export class MyAgent extends BaseAgent {
    async processTask(envelope: AgentEnvelope) {
        const handler = this.getHandler(envelope.metadata.stage)
        return await handler(envelope)
    }

    private getHandler(stage: string) {
        if (stage === 'validate:code') return this.handleCodeValidation
        if (stage === 'validate:types') return this.handleTypeValidation
    }

    private async handleCodeValidation(envelope: AgentEnvelope) {
        // Focused validation logic
    }

    private async handleTypeValidation(envelope: AgentEnvelope) {
        // Focused type checking logic
    }
}
```

### 3. Code Smells to Fix

#### Duplicate Code
- Extract method/class
- Pull up to parent class
- Form template method

#### Long Method
- Extract method
- Replace temp with query
- Introduce parameter object

#### Large Class
- Extract class
- Extract subclass
- Extract interface

#### Long Parameter List
- Replace with parameter object
- Preserve whole object
- Introduce builder pattern

#### Data Clumps
- Extract class
- Introduce parameter object
- Preserve whole object

## Refactoring Process for TypeScript Monorepo

### Step 1: Identify Refactoring Opportunities
```bash
# Find code quality metrics
turbo run test:coverage  # Identify low coverage areas

# Search for code smells
grep -r "TODO\|FIXME\|HACK\|XXX" packages/ --include="*.ts" | head -20

# Find duplicated patterns
grep -r "if.*if\|switch.*switch" packages/ --include="*.ts" | head -10

# Identify long methods (over 30 lines)
grep -r "^\s*async\s\|^\s*private\s\|^\s*public\s" packages/ --include="*.ts" | wc -l

# Check for unused imports
turbo run lint --filter=@agentic-sdlc/[package]
```

### Step 2: Create Safety Net
```bash
# Ensure tests exist for target file
find packages/[package]/src/__tests__ -name "*target*.test.ts"

# Run all tests to establish baseline
turbo run test

# Run E2E tests to verify behavior
./scripts/env/start-dev.sh
./scripts/run-pipeline-test.sh "Baseline Test"
./scripts/env/stop-dev.sh

# Create git checkpoint
git add -A
git commit -m "checkpoint: before refactoring [target]"
```

### Step 3: Apply Refactoring Incrementally
```bash
# Make ONE refactoring at a time
# Example: Extract interface from service

# 1. Make the change
# File: packages/orchestrator/src/hexagonal/ports/INewPort.ts
# File: packages/orchestrator/src/hexagonal/adapters/NewAdapter.ts
# File: packages/orchestrator/src/services/target.service.ts (update to use port)

# 2. Verify behavior preserved
turbo run typecheck --filter=@agentic-sdlc/[package]
turbo run lint --filter=@agentic-sdlc/[package]
turbo run test --filter=@agentic-sdlc/[package]

# 3. If tests pass, commit this small change
git add packages/[package]/src/hexagonal/...
git commit -m "refactor([package]): extract [interface] port interface"

# 4. Repeat for next refactoring
```

## Common Refactoring Patterns

### 1. Replace Stage Conditionals with Strategy Pattern
```typescript
// Before: Multiple if statements checking stage
async processEnvelope(envelope: AgentEnvelope) {
    if (envelope.metadata.stage === 'scaffold:started') {
        // 40 lines of scaffold logic
    } else if (envelope.metadata.stage === 'validate:started') {
        // 35 lines of validation logic
    } else if (envelope.metadata.stage === 'e2e:started') {
        // 30 lines of e2e logic
    }
}

// After: Strategy pattern with handlers
const stageHandlers: Record<string, Handler> = {
    'scaffold:started': handleScaffold,
    'validate:started': handleValidate,
    'e2e:started': handleE2E
}

async processEnvelope(envelope: AgentEnvelope) {
    const handler = stageHandlers[envelope.metadata.stage]
    if (handler) {
        return await handler(envelope)
    }
}
```

### 2. Extract Configuration Constants
```typescript
// Before: Magic strings scattered in code
await this.messageBus.subscribe(
    'agent:scaffold:tasks',
    async (envelope) => { /* ... */ },
    { consumerGroup: 'orchestrator-scaffold-group' }
)

// After: Named constants
const MESSAGE_TOPICS = {
    SCAFFOLD_TASKS: 'agent:scaffold:tasks',
    VALIDATION_TASKS: 'agent:validation:tasks',
} as const

const CONSUMER_GROUPS = {
    ORCHESTRATOR_SCAFFOLD: 'orchestrator-scaffold-group',
    ORCHESTRATOR_VALIDATION: 'orchestrator-validation-group',
} as const

await this.messageBus.subscribe(
    MESSAGE_TOPICS.SCAFFOLD_TASKS,
    async (envelope) => { /* ... */ },
    { consumerGroup: CONSUMER_GROUPS.ORCHESTRATOR_SCAFFOLD }
)
```

### 3. Extract Message Handler
```typescript
// Before: Service with mixed concerns
export class WorkflowService {
    async onWorkflowCreated(envelope: AgentEnvelope) {
        // Validate
        // Update database
        // Publish message
        // Log metrics
    }
}

// After: Separate handler
export class WorkflowCreatedHandler {
    constructor(
        private readonly repository: IWorkflowRepository,
        private readonly messageBus: IMessageBus,
        private readonly metrics: IMetrics
    ) {}

    async handle(envelope: AgentEnvelope): Promise<void> {
        const workflow = this.createWorkflow(envelope.payload)
        await this.repository.save(workflow)
        await this.publishNext(envelope)
        this.metrics.recordWorkflowCreated()
    }
}
```

## Command Options for This Platform

```bash
# Analyze and suggest refactorings
/refactor-code --analyze  # Scans for code smells in TypeScript

# Refactor specific package
/refactor-code --target "@agentic-sdlc/orchestrator"
/refactor-code --target "@agentic-sdlc/base-agent"

# Refactor specific file
/refactor-code --target "packages/orchestrator/src/services/workflow.service.ts"

# Refactor with focus on hexagonal layer
/refactor-code --focus ports        # Extract port interfaces
/refactor-code --focus adapters     # Clean up adapters
/refactor-code --focus services     # Simplify services
/refactor-code --focus orchestration # Improve state machine

# Safe mode (includes E2E tests after changes)
/refactor-code --safe-mode --target "packages/[package]/src/[target]"

# After refactoring, verify with
turbo run build
turbo run test --filter=@agentic-sdlc/[package]
./scripts/run-pipeline-test.sh "Refactoring Test"
```

## Quality Metrics

Track improvements:
- **Cyclomatic Complexity**: Reduced by X%
- **Code Duplication**: Eliminated X lines
- **Test Coverage**: Maintained at X%
- **Method Length**: Average reduced from X to Y
- **Class Cohesion**: Improved from X to Y

## Refactoring Checklist

Before refactoring:
- [ ] Tests pass
- [ ] Behavior documented
- [ ] Performance baseline captured
- [ ] Code committed

During refactoring:
- [ ] Make one change at a time
- [ ] Run tests after each change
- [ ] Keep refactoring separate from features
- [ ] Commit frequently

After refactoring:
- [ ] All tests pass
- [ ] Performance unchanged or improved
- [ ] Code review completed
- [ ] Documentation updated

## Advanced Refactoring Techniques

### 1. Strangler Fig Pattern
Gradually replace legacy code:
```python
class LegacyService:
    def old_method(self):
        # Legacy implementation
        pass

class ModernService:
    def __init__(self):
        self.legacy = LegacyService()
    
    def new_method(self):
        # Modern implementation
        # Gradually reduce calls to legacy
        if should_use_legacy():
            return self.legacy.old_method()
        return modern_implementation()
```

### 2. Branch by Abstraction
```python
# Step 1: Create abstraction
class PaymentProcessor(ABC):
    @abstractmethod
    def process(self, payment):
        pass

# Step 2: Implement both old and new
class LegacyProcessor(PaymentProcessor):
    def process(self, payment):
        # Old implementation
        pass

class ModernProcessor(PaymentProcessor):
    def process(self, payment):
        # New implementation
        pass

# Step 3: Switch gradually
processor = ModernProcessor() if feature_flag else LegacyProcessor()
```

## Integration with Platform Tools

### Build System (Turbo)
```bash
# Verify refactoring didn't break build
turbo run typecheck --filter=@agentic-sdlc/[package]
turbo run build --filter=@agentic-sdlc/[package]

# Full monorepo build to check dependencies
turbo run build
```

### Testing (Vitest)
```bash
# Unit tests for refactored code
turbo run test --filter=@agentic-sdlc/[package]

# Integration tests to verify message patterns work
turbo run test  # Full suite

# Coverage to identify untested paths
turbo run test:coverage
```

### Linting
```bash
# Check for style issues
turbo run lint --filter=@agentic-sdlc/[package]
```

### E2E Validation
```bash
# Start environment
./scripts/env/start-dev.sh

# Run pipeline test
./scripts/run-pipeline-test.sh "Refactoring Validation"

# Check health
./scripts/env/check-health.sh

# Stop when done
./scripts/env/stop-dev.sh
```

### Version Control
```bash
# Safe refactoring checkpoints
git commit -m "refactor([package]): extract [interface]"

# If problems arise, revert single commits
git revert HEAD  # Revert last change
```

### Before/After Metrics
```bash
# Before refactoring
turbo run test:coverage > before-coverage.txt
git log --oneline | head -5 > before-commits.txt

# After refactoring
turbo run test:coverage > after-coverage.txt
git log --oneline | head -5 > after-commits.txt

# Compare results
diff before-coverage.txt after-coverage.txt
```