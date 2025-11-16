# Surface Adapter Template

This guide provides template implementations for creating new surface adapters in the Agentic SDLC system.

## Overview

A **Surface** is an entry point for triggering workflows. The system supports:
- **REST API** - HTTP endpoints
- **Webhook** - Event-driven from external systems
- **CLI** - Command-line interface
- **Dashboard** - Web UI interactions
- **Mobile API** - Mobile app integrations

## Surface Architecture

```
User/System → Surface → SurfaceRouter → Platform → Workflow Engine → Agents
```

Each surface:
1. Receives input from its channel
2. Validates and normalizes the input
3. Passes to SurfaceRouter
4. Router determines platform and starts workflow
5. Returns workflow reference to user

## Template: Custom REST Surface Adapter

```typescript
// File: packages/orchestrator/src/hexagonal/adapters/surfaces/custom-rest-surface.adapter.ts
import { Fastify FastifyRequest, FastifyReply } from 'fastify'
import { ISurface } from '../ports/ISurface'
import { SurfaceRouter } from '../../services/surface-router.service'
import { CreateWorkflowRequest } from '@agentic-sdlc/shared-types'

/**
 * Custom REST Surface Adapter
 *
 * Provides REST API endpoints for custom workflow trigger
 * Example: Enterprise order fulfillment system
 */
export class CustomRestSurfaceAdapter implements ISurface {
  readonly type = 'REST'
  readonly name = 'custom-rest-surface'

  constructor(
    private readonly app: FastifyInstance,
    private readonly surfaceRouter: SurfaceRouter
  ) {}

  /**
   * Register routes for this surface
   */
  async registerRoutes(): Promise<void> {
    // Workflow creation endpoint
    this.app.post('/api/v1/custom-workflows', async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const input = request.body as CreateWorkflowRequest

        // Validate input for this surface
        this.validateInput(input)

        // Route through SurfaceRouter
        const workflow = await this.surfaceRouter.createWorkflow({
          ...input,
          surface: this.name,
          sourceSystem: request.headers['x-source-system'] as string
        })

        reply.code(201).send({
          id: workflow.id,
          status: 'created',
          trackingUrl: `/api/v1/custom-workflows/${workflow.id}`,
          trace_id: workflow.trace_id
        })
      } catch (error) {
        this.handleError(error, reply)
      }
    })

    // Workflow status endpoint
    this.app.get('/api/v1/custom-workflows/:id', async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }

        const workflow = await this.surfaceRouter.getWorkflow(id)

        if (!workflow) {
          return reply.code(404).send({ error: 'Workflow not found' })
        }

        reply.send({
          id: workflow.id,
          status: workflow.stage,
          progress: workflow.progress,
          result: workflow.output,
          trace_id: workflow.trace_id
        })
      } catch (error) {
        this.handleError(error, reply)
      }
    })

    // Batch workflow creation
    this.app.post('/api/v1/custom-workflows/batch', async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const inputs = (request.body as CreateWorkflowRequest[]) || []

        const workflows = await Promise.all(
          inputs.map(input => this.surfaceRouter.createWorkflow({
            ...input,
            surface: this.name,
            batchId: request.headers['x-batch-id']
          }))
        )

        reply.code(201).send({
          batchId: request.headers['x-batch-id'],
          workflowCount: workflows.length,
          workflows: workflows.map(w => ({ id: w.id, trace_id: w.trace_id }))
        })
      } catch (error) {
        this.handleError(error, reply)
      }
    })

    console.log('✅ [CustomRestSurface] Routes registered')
  }

  /**
   * Validate surface-specific input
   */
  private validateInput(input: CreateWorkflowRequest): void {
    if (!input.name) {
      throw new Error('Workflow name is required')
    }

    if (!input.type) {
      throw new Error('Workflow type is required')
    }

    // Surface-specific validations
    if (input.type === 'order-fulfillment') {
      if (!input.metadata?.orderId) {
        throw new Error('Order ID required for order-fulfillment workflows')
      }
    }
  }

  /**
   * Handle errors and format response
   */
  private handleError(error: any, reply: FastifyReply): void {
    console.error(`[CustomRestSurface] Error:`, error)

    const status = error.statusCode || 500
    const message = error.message || 'Internal server error'

    reply.code(status).send({
      error: message,
      statusCode: status,
      timestamp: new Date().toISOString(),
      surface: this.name
    })
  }
}
```

## Template: Custom Webhook Surface Adapter

```typescript
// File: packages/orchestrator/src/hexagonal/adapters/surfaces/custom-webhook-surface.adapter.ts
import { Fastify, FastifyRequest, FastifyReply } from 'fastify'
import { ISurface } from '../ports/ISurface'
import { SurfaceRouter } from '../../services/surface-router.service'
import { verifyWebhookSignature } from '../utils/webhook-security'

/**
 * Custom Webhook Surface Adapter
 *
 * Processes incoming webhooks from external systems
 * Example: GitHub push events, CI/CD pipeline completion
 */
export class CustomWebhookSurfaceAdapter implements ISurface {
  readonly type = 'WEBHOOK'
  readonly name = 'custom-webhook-surface'

  constructor(
    private readonly app: FastifyInstance,
    private readonly surfaceRouter: SurfaceRouter
  ) {}

  /**
   * Register webhook routes
   */
  async registerRoutes(): Promise<void> {
    // Webhook receiver endpoint
    this.app.post('/webhooks/custom', async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Verify webhook signature (security!)
        const signature = request.headers['x-webhook-signature'] as string
        const payload = JSON.stringify(request.body)

        if (!verifyWebhookSignature(payload, signature, process.env.WEBHOOK_SECRET!)) {
          return reply.code(401).send({ error: 'Invalid signature' })
        }

        // Parse webhook event
        const event = request.body as WebhookEvent
        const workflowRequest = this.parseWebhookEvent(event)

        // Create workflow
        const workflow = await this.surfaceRouter.createWorkflow({
          ...workflowRequest,
          surface: this.name,
          sourceEvent: event.type,
          externalId: event.id
        })

        // Return 202 Accepted immediately (async processing)
        reply.code(202).send({
          accepted: true,
          workflowId: workflow.id,
          trackingUrl: `/api/v1/workflows/${workflow.id}`
        })
      } catch (error) {
        this.handleWebhookError(error, reply)
      }
    })

    console.log('✅ [CustomWebhookSurface] Routes registered')
  }

  /**
   * Parse webhook event into workflow request
   */
  private parseWebhookEvent(event: WebhookEvent): any {
    switch (event.type) {
      case 'push':
        return {
          name: `Build: ${event.repository}`,
          type: 'app',
          metadata: {
            branch: event.branch,
            commit: event.commitSha,
            repository: event.repository,
            author: event.author
          }
        }

      case 'pipeline.complete':
        return {
          name: `Deploy: ${event.pipelineName}`,
          type: 'feature',
          metadata: {
            pipelineId: event.pipelineId,
            status: event.status,
            timestamp: event.timestamp
          }
        }

      default:
        throw new Error(`Unknown webhook event type: ${event.type}`)
    }
  }

  /**
   * Handle webhook errors
   */
  private handleWebhookError(error: any, reply: FastifyReply): void {
    console.error(`[CustomWebhookSurface] Webhook processing error:`, error)

    reply.code(500).send({
      error: 'Webhook processing failed',
      message: error.message,
      surface: this.name
    })
  }
}

interface WebhookEvent {
  id: string
  type: string
  timestamp: string
  [key: string]: any
}
```

## Template: Custom CLI Surface Adapter

```typescript
// File: packages/orchestrator/src/hexagonal/adapters/surfaces/custom-cli-surface.adapter.ts
import { Command } from 'commander'
import { SurfaceRouter } from '../../services/surface-router.service'
import { CreateWorkflowRequest } from '@agentic-sdlc/shared-types'

/**
 * Custom CLI Surface Adapter
 *
 * Provides command-line interface for workflow creation
 * Example: Developer local CLI tool
 */
export class CustomCliSurfaceAdapter {
  readonly type = 'CLI'
  readonly name = 'custom-cli-surface'

  private program: Command

  constructor(
    private readonly surfaceRouter: SurfaceRouter
  ) {
    this.program = new Command()
  }

  /**
   * Register CLI commands
   */
  registerCommands(): void {
    this.program
      .name('my-cli')
      .description('Workflow automation CLI')
      .version('1.0.0')

    // Create workflow command
    this.program
      .command('create <type>')
      .description('Create a new workflow')
      .option('-n, --name <name>', 'Workflow name')
      .option('-p, --platform <platform>', 'Platform (default: legacy)')
      .option('-j, --json', 'Output as JSON')
      .action(async (type, options) => {
        try {
          const request: CreateWorkflowRequest = {
            name: options.name || `CLI Workflow ${Date.now()}`,
            type: type as any,
            platform_id: options.platform
          }

          const workflow = await this.surfaceRouter.createWorkflow({
            ...request,
            surface: this.name,
            source: 'cli'
          })

          if (options.json) {
            console.log(JSON.stringify(workflow, null, 2))
          } else {
            console.log(`✅ Workflow created: ${workflow.id}`)
            console.log(`📊 Status: ${workflow.stage}`)
            console.log(`🔍 Trace ID: ${workflow.trace_id}`)
          }
        } catch (error: any) {
          console.error(`❌ Failed to create workflow: ${error.message}`)
          process.exit(1)
        }
      })

    // Status command
    this.program
      .command('status <id>')
      .description('Check workflow status')
      .action(async (id) => {
        try {
          const workflow = await this.surfaceRouter.getWorkflow(id)

          if (!workflow) {
            console.error(`❌ Workflow not found: ${id}`)
            process.exit(1)
          }

          console.log(`📋 Workflow: ${workflow.name}`)
          console.log(`📊 Status: ${workflow.stage}`)
          console.log(`📈 Progress: ${workflow.progress}%`)
          console.log(`🔍 Trace ID: ${workflow.trace_id}`)
        } catch (error: any) {
          console.error(`❌ Error: ${error.message}`)
          process.exit(1)
        }
      })

    console.log('✅ [CustomCliSurface] Commands registered')
  }

  /**
   * Parse and execute CLI
   */
  async execute(argv: string[]): Promise<void> {
    await this.program.parseAsync(argv)
  }
}
```

## Template: Surface Integration Steps

### Step 1: Create Surface Adapter

```typescript
// Implement ISurface interface
export class MyCustomSurface implements ISurface {
  readonly type = 'REST' | 'WEBHOOK' | 'CLI'
  readonly name = 'my-custom-surface'

  async registerRoutes(): Promise<void> {
    // Register routes/commands
  }
}
```

### Step 2: Register in SurfaceRouter

```typescript
// In orchestrator initialization:
const surfaceRouter = new SurfaceRouter(...)

// Register custom surface
const customSurface = new CustomRestSurfaceAdapter(app, surfaceRouter)
await customSurface.registerRoutes()

surfaceRouter.registerSurface(customSurface)
```

### Step 3: Handle Input Normalization

```typescript
private normalizeInput(input: any): CreateWorkflowRequest {
  return {
    name: input.name || input.title,
    type: input.type || input.workflowType,
    platform_id: input.platform || 'legacy',
    metadata: {
      source: this.name,
      externalId: input.id,
      ...input.metadata
    }
  }
}
```

### Step 4: Route to Platform

```typescript
// SurfaceRouter determines platform and routes
const workflow = await this.surfaceRouter.createWorkflow({
  ...normalizedInput,
  surface: this.name,
  platformId: this.determinePlatform(input)
})
```

## Best Practices

1. **Always validate input** - Each surface has different validation rules
2. **Normalize consistently** - Convert to standard CreateWorkflowRequest format
3. **Handle errors gracefully** - Return appropriate status codes
4. **Log extensively** - Track surface activity for debugging
5. **Implement security** - Validate signatures, API keys, etc.
6. **Return workflow reference** - Let users track their workflows
7. **Document endpoints** - Keep API documentation up-to-date
8. **Test thoroughly** - Test each surface independently and integrated

## References

- [STRATEGIC-ARCHITECTURE.md](../../STRATEGIC-ARCHITECTURE.md) - System design
- [Platform Definition Template](./PLATFORM_DEFINITION_TEMPLATE.md)
- [API Documentation](../../API_DOCUMENTATION.md)
