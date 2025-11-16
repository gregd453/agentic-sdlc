# Platform Onboarding Guide

Welcome! This guide walks you through adding a new platform to the Agentic SDLC system.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Step-by-Step Onboarding](#step-by-step-onboarding)
4. [Testing Your Platform](#testing-your-platform)
5. [Troubleshooting](#troubleshooting)
6. [Best Practices](#best-practices)

## Overview

A **platform** represents a category of software delivery workflows. Examples:
- **Web Apps** - Single-page applications, progressive web apps
- **Data Pipelines** - ETL workflows, data processing
- **Mobile Apps** - iOS/Android native applications
- **Infrastructure** - Cloud infrastructure, Kubernetes deployments

### What You'll Create

```
Your Platform
├── Platform Configuration (YAML)
├── Workflow Definitions (YAML)
├── Platform Service (TypeScript, optional)
├── Custom Agents (TypeScript, optional)
└── Tests (Vitest)
```

### Time Estimate

- **Basic Platform:** 2-4 hours
- **Custom Agents:** 4-8 hours additional
- **Complete Integration:** 1-2 days with full testing

## Prerequisites

### Software Requirements

```bash
# Node.js 20+
node --version

# pnpm (package manager)
pnpm --version

# Docker (for running services)
docker --version

# Git
git --version
```

### Knowledge Requirements

- Basic YAML syntax
- TypeScript fundamentals
- REST API concepts
- Workflow design thinking

### Repository Access

You should have:
- ✅ Cloned the agentic-sdlc repository
- ✅ Installed dependencies: `pnpm install`
- ✅ Development environment running: `./scripts/env/start-dev.sh`

## Step-by-Step Onboarding

### Phase 1: Platform Definition (30 minutes)

#### 1.1 Create Platform Configuration File

Create `configs/platforms/my-platform.yml`:

```yaml
name: my-platform
layer: APPLICATION
description: "Brief description of your platform"
enabled: true

config:
  defaultTimeout: 3600
  retryPolicy: exponential
  maxConcurrentWorkflows: 10

workflowDefinitions:
  - name: standard
    version: "1.0.0"
    path: definitions/workflows/my-platform-standard.yml

surfaces:
  - type: REST
    enabled: true
    config:
      basePath: /api/v1/my-platform
  - type: DASHBOARD
    enabled: true

agents:
  scaffold:
    type: global
    agentName: scaffold-agent
    version: "1.0.0"
  validation:
    type: global
    agentName: validation-agent
    version: "1.0.0"
```

**Key Fields:**
- `layer` - Classification: APPLICATION | DATA | INFRASTRUCTURE | ENTERPRISE
- `surfaces` - How workflows are triggered (REST, Webhook, CLI, Dashboard)
- `agents` - Which agents handle each stage

#### 1.2 Create Workflow Definition

Create `definitions/workflows/my-platform-standard.yml`:

```yaml
name: my-platform-standard
version: "1.0.0"
platform: my-platform
description: "Standard workflow for my platform"

stages:
  - name: scaffold
    weight: 20
    timeout: 1800
    agents:
      primary: scaffold-agent
    description: Generate project structure
    retryPolicy:
      maxRetries: 2
      backoffMs: 1000

  - name: validation
    weight: 20
    timeout: 1800
    agents:
      primary: validation-agent
    description: Validate code quality

  - name: deployment
    weight: 60
    timeout: 3600
    agents:
      primary: deployment-agent
    description: Deploy to production

progressCalculation: weighted
```

**Important Notes:**
- `weight` values must sum to 100
- Each stage needs an `agents.primary` assignment
- `timeout` is in seconds

#### 1.3 Validate Configuration

```bash
# Check syntax
yaml-lint configs/platforms/my-platform.yml
yaml-lint definitions/workflows/my-platform-*.yml

# Verify files exist
ls -la configs/platforms/my-platform.yml
ls -la definitions/workflows/my-platform-*.yml
```

### Phase 2: Platform Registration (45 minutes)

#### 2.1 Bootstrap Integration

Update `packages/orchestrator/src/hexagonal/bootstrap/orchestrator-container.ts`:

```typescript
// In the initialize() method, add:
async initialize(): Promise<void> {
  // ... existing initialization ...

  // Load your platform
  const myPlatformConfig = await this.platformLoader.loadByName('my-platform')
  console.log(`✅ Loaded platform: ${myPlatformConfig?.name}`)

  // Register platform-specific agents (if any)
  // registerMyPlatformAgents(this.agentRegistry, this.messageBus)
}
```

#### 2.2 Add Database Seed (if needed)

Update `packages/orchestrator/src/services/seed-platforms.service.ts`:

```typescript
async seedPlatforms(): Promise<void> {
  // Add to the platforms array
  const platforms = [
    // ... existing platforms ...
    {
      name: 'my-platform',
      layer: 'APPLICATION',
      description: 'Your platform description',
      config: {
        defaultTimeout: 3600,
        // ...
      }
    }
  ]

  // Insert platforms
  for (const platform of platforms) {
    await this.prisma.platform.upsert({
      where: { name: platform.name },
      update: platform,
      create: platform
    })
  }
}
```

#### 2.3 Test Platform Loading

```bash
# Start services
./scripts/env/start-dev.sh

# In another terminal, test API
curl http://localhost:3000/api/v1/platforms/my-platform

# Should return your platform definition
```

### Phase 3: Test Your Platform (1 hour)

#### 3.1 Create Test File

Create `packages/orchestrator/src/__tests__/platforms/my-platform.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createServer } from '../../server'
import { FastifyInstance } from 'fastify'

describe('My Platform', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = await createServer()
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  it('should load my-platform', async () => {
    const response = await app.inject({
      method: 'GET' as const,
      url: '/api/v1/platforms/my-platform'
    })

    expect(response.statusCode).toBe(200)
    const platform = JSON.parse(response.payload)
    expect(platform.name).toBe('my-platform')
    expect(platform.layer).toBe('APPLICATION')
  })

  it('should create workflow on my-platform', async () => {
    const response = await app.inject({
      method: 'POST' as const,
      url: '/api/v1/workflows',
      payload: {
        name: 'Test Workflow',
        type: 'app',
        platform_id: 'my-platform'
      }
    })

    expect(response.statusCode).toBe(201)
    const workflow = JSON.parse(response.payload)
    expect(workflow.platform_id).toBe('my-platform')
  })
})
```

#### 3.2 Run Tests

```bash
cd packages/orchestrator
pnpm test my-platform.test.ts
```

#### 3.3 Test via API

```bash
# Create a workflow on your platform
curl -X POST http://localhost:3000/api/v1/workflows \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My First Platform Workflow",
    "type": "app",
    "platform_id": "my-platform"
  }'

# Check the workflow
curl http://localhost:3000/api/v1/workflows/{workflow-id}
```

### Phase 4: Add Custom Agents (Optional, 4-8 hours)

If you need platform-specific agents:

#### 4.1 Create Agent Package

```bash
mkdir -p packages/agents/my-platform-agent/src
cd packages/agents/my-platform-agent
pnpm init
```

#### 4.2 Implement Agent

Create `src/my-platform-agent.ts`:

```typescript
import { BaseAgent } from '@agentic-sdlc/base-agent'
import { AgentEnvelope } from '@agentic-sdlc/shared-types'

export class MyPlatformAgent extends BaseAgent {
  async processTask(envelope: AgentEnvelope): Promise<AgentEnvelope> {
    console.log(`[MyPlatformAgent] Processing: ${envelope.trace.trace_id}`)

    // Your platform-specific logic here
    const result = await this.doMyPlatformWork(envelope.payload)

    return this.buildResultEnvelope(result, envelope)
  }

  private async doMyPlatformWork(payload: any): Promise<any> {
    // Implementation
    return { success: true, message: 'Platform work complete' }
  }
}
```

#### 4.3 Register Agent

In your platform bootstrap:

```typescript
import { MyPlatformAgent } from '@agentic-sdlc/my-platform-agent'

function registerMyPlatformAgents(registry: AgentRegistry, messageBus: any): void {
  const agent = new MyPlatformAgent(messageBus)

  registry.register({
    name: 'my-platform-scaffold-agent',
    version: '1.0.0',
    type: 'scaffold',
    platform: 'my-platform',
    instance: agent
  })
}
```

## Testing Your Platform

### Manual Testing Checklist

- [ ] Platform loads via API: `GET /api/v1/platforms/my-platform`
- [ ] Create workflow: `POST /api/v1/workflows` with `platform_id`
- [ ] Workflow shows correct platform: `GET /api/v1/workflows/{id}`
- [ ] Workflow progresses through stages
- [ ] Trace IDs are unique per workflow
- [ ] Dashboard shows platform in platform list

### Automated Testing

```bash
# Run all platform tests
pnpm test my-platform

# Run with coverage
pnpm test:coverage my-platform

# Check TypeScript compilation
pnpm typecheck

# Lint code
pnpm lint
```

## Troubleshooting

### Platform Not Loading

**Problem:** `Platform not found` error

**Solution:**
```bash
# Verify platform file exists
ls -la configs/platforms/my-platform.yml

# Check YAML syntax
yaml-lint configs/platforms/my-platform.yml

# Restart services
./scripts/env/stop-dev.sh
./scripts/env/start-dev.sh
```

### Workflows Not Creating

**Problem:** `400 Bad Request` when creating workflow

**Solution:**
```bash
# Check payload format
# Required fields: name, type
# Optional: platform_id, metadata

curl -X POST http://localhost:3000/api/v1/workflows \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test",
    "type": "app"
  }'
```

### Tests Failing

**Problem:** Test timeout or connection errors

**Solution:**
```bash
# Ensure services are running
./scripts/env/check-health.sh

# Check logs
pnpm pm2:logs

# Increase test timeout
# In test file: it('test', async () => { ... }, 10000)
```

### Agent Not Processing Tasks

**Problem:** Workflows stuck in `scaffold:started`

**Solution:**
```bash
# Check agent is registered
curl http://localhost:3000/api/v1/agents

# Verify agent logs
pnpm pm2:logs | grep "my-platform-agent"

# Check message bus
redis-cli -n 0 KEYS "*scaffold*"
```

## Best Practices

### 1. Platform Configuration

✅ **DO:**
- Use clear, descriptive names
- Document workflow stage purposes
- Configure appropriate timeouts
- Set retry policies based on stage reliability

❌ **DON'T:**
- Hardcode stage sequences in code
- Modify hexagonal core for platforms
- Duplicate common agent logic

### 2. Workflow Definitions

✅ **DO:**
- Keep stage weights realistic (sum to 100)
- Define clear descriptions for each stage
- Test definition-driven routing

❌ **DON'T:**
- Create too many stages (5-8 is optimal)
- Use unclear stage names
- Skip retry policy configuration

### 3. Agent Implementation

✅ **DO:**
- Extend BaseAgent for consistency
- Validate input before processing
- Log important operations
- Handle errors gracefully
- Use platform_id from envelope

❌ **DON'T:**
- Duplicate message bus logic
- Hardcode platform names
- Skip error handling
- Ignore trace IDs

### 4. Testing

✅ **DO:**
- Write tests for happy path
- Test error conditions
- Verify trace ID propagation
- Mock external dependencies

❌ **DON'T:**
- Skip integration tests
- Hardcode IDs in tests
- Use sleep() for synchronization
- Test implementation details

### 5. Documentation

✅ **DO:**
- Document platform layer classification
- Explain workflow stages and purposes
- Provide example requests/responses
- Include troubleshooting tips

❌ **DON'T:**
- Leave configurations undocumented
- Skip API documentation
- Assume users know system internals

## Next Steps

1. **Create Your Platform** - Follow Phase 1-2 above
2. **Test It** - Follow Phase 3 testing checklist
3. **Add Custom Agents** (optional) - Phase 4
4. **Deploy** - Reference Architecture Migration Guide
5. **Monitor** - Use dashboard analytics

## Support

- **Questions?** Check [CLAUDE.md](../CLAUDE.md) for system overview
- **Technical Details?** See [STRATEGIC-ARCHITECTURE.md](../STRATEGIC-ARCHITECTURE.md)
- **API Reference?** See [API_DOCUMENTATION.md](../API_DOCUMENTATION.md)
- **Migration Help?** See [ARCHITECTURE_MIGRATION.md](./ARCHITECTURE_MIGRATION.md)

## References

- [Platform Definition Template](./templates/PLATFORM_DEFINITION_TEMPLATE.md)
- [Surface Adapter Template](./templates/SURFACE_ADAPTER_TEMPLATE.md)
- [Strategic Architecture](../STRATEGIC-ARCHITECTURE.md)
- [System Runbook](../AGENTIC_SDLC_RUNBOOK.md)

---

**Questions?** Open an issue or reach out to the team!

**Last Updated:** 2025-11-16 | **Status:** Production Ready
