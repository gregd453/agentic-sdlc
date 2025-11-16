# Platform Definition Template

This guide provides template files for defining new platforms in the Agentic SDLC system.

## Overview

A **Platform** represents a category of software delivery workflows (e.g., Web Apps, Data Pipelines, Mobile). Platforms define:
- **Layer:** Classification (APPLICATION, DATA, INFRASTRUCTURE, ENTERPRISE)
- **Workflow Definitions:** Stages and progression through the delivery lifecycle
- **Surface Types:** How workflows can be triggered (REST, Webhook, CLI, Dashboard)
- **Agent Assignments:** Which agents handle each stage

## Template Files

### 1. Platform Registration Template (YAML)

```yaml
# File: configs/platforms/my-platform.yml
name: my-platform
layer: APPLICATION  # APPLICATION | DATA | INFRASTRUCTURE | ENTERPRISE
description: Description of what this platform delivers
enabled: true

# Platform-specific configuration
config:
  defaultTimeout: 3600
  retryPolicy: exponential
  maxConcurrentWorkflows: 10

# Linked workflow definitions (references to workflow definition files)
workflowDefinitions:
  - name: standard
    version: "1.0.0"
    path: definitions/workflows/my-platform-standard.yml

  - name: hotfix
    version: "1.0.0"
    path: definitions/workflows/my-platform-hotfix.yml

# Supported surfaces for this platform
surfaces:
  - type: REST
    enabled: true
    config:
      basePath: /api/v1/my-platform

  - type: WEBHOOK
    enabled: true
    config:
      webhookUrl: https://your-domain.com/webhooks/my-platform

  - type: CLI
    enabled: true
    config:
      commandPrefix: my-platform

  - type: DASHBOARD
    enabled: true
    config:
      displayName: My Platform Dashboard

# Agent assignments for each stage
agents:
  scaffold:
    type: platform-specific  # global | platform-specific
    agentName: my-platform-scaffold-agent
    version: "1.0.0"

  validation:
    type: global
    agentName: validation-agent
    version: "1.0.0"

  deployment:
    type: platform-specific
    agentName: my-platform-deploy-agent
    version: "1.0.0"
```

### 2. Workflow Definition Template (YAML)

```yaml
# File: definitions/workflows/my-platform-standard.yml
name: my-platform-standard
version: "1.0.0"
platform: my-platform
description: Standard workflow for my platform

# Define stages in execution order
stages:
  - name: scaffold
    weight: 15  # Percentage of total workflow progress
    timeout: 1800
    agents:
      primary: my-platform-scaffold-agent
      fallback: scaffold-agent
    description: Generate project structure and initial code
    retryPolicy:
      maxRetries: 2
      backoffMs: 1000

  - name: validation
    weight: 15
    timeout: 1800
    agents:
      primary: validation-agent
    description: Validate code quality and tests
    retryPolicy:
      maxRetries: 3
      backoffMs: 500

  - name: build
    weight: 20
    timeout: 3600
    agents:
      primary: my-platform-build-agent
    description: Compile and package application
    retryPolicy:
      maxRetries: 2
      backoffMs: 2000

  - name: test
    weight: 20
    timeout: 3600
    agents:
      primary: e2e-agent
    description: Execute comprehensive test suite
    retryPolicy:
      maxRetries: 1
      backoffMs: 1000

  - name: integration
    weight: 15
    timeout: 2400
    agents:
      primary: integration-agent
    description: Test integration with dependent services
    retryPolicy:
      maxRetries: 2
      backoffMs: 1000

  - name: deployment
    weight: 15
    timeout: 1800
    agents:
      primary: my-platform-deploy-agent
      fallback: deployment-agent
    description: Deploy to production
    retryPolicy:
      maxRetries: 1
      backoffMs: 5000

# Progress calculation method
progressCalculation: weighted  # weighted | linear | exponential | custom

# Gate checks before progression
gates:
  - stage: validation
    checkpoint: code-quality
    threshold: 80  # Code coverage percentage

  - stage: test
    checkpoint: test-pass-rate
    threshold: 95  # Percentage of tests passing

# Notification settings
notifications:
  onCompletion: true
  onFailure: true
  webhookUrl: https://your-domain.com/webhooks/workflow-events
```

### 3. Platform Service Integration Template (TypeScript)

```typescript
// File: packages/platforms/src/services/my-platform.service.ts
import { Platform, WorkflowDefinition } from '@agentic-sdlc/shared-types'
import { PlatformLoader } from '@agentic-sdlc/orchestrator'

/**
 * MyPlatformService - Platform-specific service for "my-platform"
 *
 * Handles:
 * - Platform initialization and configuration
 * - Workflow definition loading
 * - Platform-specific business logic
 * - Integration with platform-scoped agents
 */
export class MyPlatformService {
  private platform: Platform | null = null
  private definitions: Map<string, WorkflowDefinition> = new Map()

  constructor(
    private readonly platformLoader: PlatformLoader
  ) {}

  /**
   * Initialize platform and load definitions
   */
  async initialize(): Promise<void> {
    // Load platform configuration
    this.platform = await this.platformLoader.loadByName('my-platform')

    if (!this.platform) {
      throw new Error('Platform "my-platform" not found')
    }

    // Load workflow definitions
    await this.loadDefinitions()

    console.log(`✅ [MyPlatformService] Initialized with ${this.definitions.size} definitions`)
  }

  /**
   * Load workflow definitions for this platform
   */
  private async loadDefinitions(): Promise<void> {
    if (!this.platform) return

    // Load each definition specified in platform config
    for (const defConfig of this.platform.config?.workflowDefinitions || []) {
      try {
        // Implementation: Load from YAML/JSON file or database
        // const definition = await this.loadDefinition(defConfig.path)
        // this.definitions.set(defConfig.name, definition)
      } catch (error) {
        console.error(`Failed to load definition ${defConfig.name}:`, error)
      }
    }
  }

  /**
   * Get a workflow definition by name
   */
  getDefinition(name: string): WorkflowDefinition | undefined {
    return this.definitions.get(name)
  }

  /**
   * Get all definitions for this platform
   */
  getAllDefinitions(): WorkflowDefinition[] {
    return Array.from(this.definitions.values())
  }

  /**
   * Platform-specific validation before workflow starts
   */
  async validateWorkflowInput(input: any): Promise<boolean> {
    // Implement platform-specific validation logic
    // Example: Validate required fields, check permissions, etc.
    return true
  }

  /**
   * Platform-specific processing after workflow completes
   */
  async processCompletion(result: any): Promise<void> {
    // Implement platform-specific post-processing
    // Example: Notify external systems, update platform state, etc.
  }
}
```

### 4. Platform Agent Registration Template (TypeScript)

```typescript
// File: packages/agents/my-platform-agent/src/register.ts
import { AgentRegistry } from '@agentic-sdlc/agent-registry'
import { MyPlatformAgent } from './my-platform-agent'

/**
 * Register platform-specific agent with the agent registry
 *
 * This agent handles "my-platform" workflows exclusively
 */
export function registerMyPlatformAgent(
  registry: AgentRegistry,
  messageBus: any
): void {
  const agent = new MyPlatformAgent(messageBus)

  // Register with platform scoping
  registry.register({
    name: 'my-platform-agent',
    version: '1.0.0',
    type: 'scaffold',  // Stage this agent handles
    platform: 'my-platform',  // Platform-specific
    instance: agent,
    metadata: {
      description: 'Scaffold agent for my-platform',
      capabilities: ['code-generation', 'project-setup'],
      runtimeRequirements: ['nodejs', 'python3']
    }
  })

  console.log('✅ [Registry] Registered my-platform-agent')
}
```

## Integration Steps

### Step 1: Create Platform Definition File

Create `configs/platforms/my-platform.yml` with the platform configuration above.

### Step 2: Create Workflow Definition Files

Create workflow definitions in `definitions/workflows/` directory:
- `my-platform-standard.yml` - Standard workflow (5-8 stages)
- `my-platform-hotfix.yml` - Hotfix workflow (3 stages)
- etc.

### Step 3: Create Platform Service (Optional)

For complex platforms, create `packages/platforms/my-platform-service/` with:
- Service initialization
- Workflow loading logic
- Platform-specific business logic

### Step 4: Register Platform-Scoped Agents

Create `packages/agents/my-platform-agent/` for each stage:
- `scaffold-agent` → Generates project structure
- `build-agent` → Compiles code
- `deploy-agent` → Deploys to production

### Step 5: Register in Bootstrap

In `packages/orchestrator/src/hexagonal/bootstrap/`:

```typescript
// orchestrator-container.ts
async initialize(): Promise<void> {
  // ... existing initialization ...

  // Load my-platform
  const myPlatformService = new MyPlatformService(
    this.platformLoader
  )
  await myPlatformService.initialize()

  // Register my-platform agents
  registerMyPlatformAgent(this.agentRegistry, this.messageBus)
}
```

## Validation

After creating platform definitions, verify with:

```bash
# 1. Check YAML syntax
yaml-lint configs/platforms/my-platform.yml
yaml-lint definitions/workflows/my-platform-*.yml

# 2. Load platform via API
curl http://localhost:3000/api/v1/platforms?name=my-platform

# 3. Create test workflow
curl -X POST http://localhost:3000/api/v1/workflows \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test My Platform",
    "type": "app",
    "platform_id": "my-platform-id"
  }'

# 4. Monitor workflow progression
curl http://localhost:3000/api/v1/workflows/{id}
```

## Best Practices

1. **Keep definitions in version control** - YAML files should be in Git
2. **Document platform-specific logic** - Add comments explaining stage purposes
3. **Use meaningful names** - Platform and workflow names should be clear
4. **Validate inputs** - Implement platform-specific validation before workflow starts
5. **Handle failures gracefully** - Configure appropriate retry policies
6. **Monitor metrics** - Implement platform-specific monitoring
7. **Backward compatibility** - Ensure new platforms don't break existing workflows

## References

- [Architecture: Multi-Platform System](./../../STRATEGIC-ARCHITECTURE.md)
- [Platform Onboarding Guide](./PLATFORM_ONBOARDING.md)
- [Architecture Migration Guide](./ARCHITECTURE_MIGRATION.md)
- [API Documentation](./../../API_DOCUMENTATION.md)
