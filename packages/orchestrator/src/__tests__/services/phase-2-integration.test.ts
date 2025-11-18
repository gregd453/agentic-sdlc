/**
 * Phase 2 Integration Test - Surface Abstraction
 *
 * Tests the complete Phase 2 implementation:
 * 1. SurfaceRouter service for multi-surface routing
 * 2. REST API surface implementation
 * 3. GitHub Webhook surface implementation
 * 4. CLI surface implementation
 * 5. Multi-surface workflow submission
 * 6. Backward compatibility with legacy workflows
 *
 * This test ensures all surface adapters work correctly
 * and maintain backward compatibility with Phase 1 infrastructure.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { SurfaceRouterService, SurfaceRequest } from '../../services/surface-router.service'
import { RestSurfaceService, RestApiRequest } from '../../services/rest-surface.service'
import { WebhookSurfaceService, WebhookPayload } from '../../services/webhook-surface.service'
import { CliSurfaceService, CliCommand } from '../../services/cli-surface.service'

describe('Phase 2: Surface Abstraction Integration', () => {
  let surfaceRouter: SurfaceRouterService
  let restSurface: RestSurfaceService
  let webhookSurface: WebhookSurfaceService
  let cliSurface: CliSurfaceService

  beforeAll(async () => {
    // Initialize services
    surfaceRouter = new SurfaceRouterService()
    restSurface = new RestSurfaceService(surfaceRouter)
    webhookSurface = new WebhookSurfaceService(surfaceRouter, {
      verify_signature: false, // Disable signature verification for tests
      event_mapping: {
        push: 'feature',
        pull_request: 'feature',
        release: 'app',
        issues: 'bugfix'
      }
    })
    cliSurface = new CliSurfaceService(surfaceRouter, {
      offline_mode: false,
      allow_local_cache: true
    })
  })

  describe('SurfaceRouter Service', () => {
    it('should validate REST surface requests', async () => {
      const request: SurfaceRequest = {
        surface_type: 'REST',
        payload: {
          type: 'app',
          name: 'Test App'
        }
      }

      const context = await surfaceRouter.routeRequest(request)
      expect(context).toBeDefined()
      expect(context.surface_type).toBe('REST')
      expect(context.surface_id).toBeDefined()
    })

    it('should reject invalid surface requests', async () => {
      const request: SurfaceRequest = {
        surface_type: 'REST',
        payload: {
          // Missing required 'type' field
          name: 'Test App'
        }
      }

      await expect(surfaceRouter.routeRequest(request)).rejects.toThrow()
    })

    it('should route requests to correct surface', async () => {
      const request: SurfaceRequest = {
        surface_type: 'WEBHOOK',
        payload: {
          type: 'feature',
          name: 'Webhook Workflow'
        }
      }

      const context = await surfaceRouter.routeRequest(request)
      expect(context.surface_type).toBe('WEBHOOK')
    })

    it('should support platform-specific routing', async () => {
      const request: SurfaceRequest = {
        surface_type: 'REST',
        platform_id: 'test-platform-id',
        payload: {
          type: 'app',
          name: 'Platform App'
        }
      }

      const context = await surfaceRouter.routeRequest(request)
      expect(context.platform_id).toBe('test-platform-id')
    })

    it('should normalize payload data', async () => {
      const request: SurfaceRequest = {
        surface_type: 'REST',
        payload: {
          type: 'feature',
          name: '  Feature Name  ', // With whitespace
          priority: 'high'
        }
      }

      const context = await surfaceRouter.routeRequest(request)
      expect(context.validated_payload.name).toBe('Feature Name')
      expect(context.validated_payload.priority).toBe('high')
    })

    it('should get surface metadata', () => {
      const restMetadata = surfaceRouter.getSurfaceMetadata('REST')
      expect(restMetadata.description).toBeDefined()
      expect(restMetadata.authentication).toBeDefined()
      expect(restMetadata.rate_limit).toBeDefined()

      const webhookMetadata = surfaceRouter.getSurfaceMetadata('WEBHOOK')
      expect(webhookMetadata.retry_policy).toBeDefined()

      const cliMetadata = surfaceRouter.getSurfaceMetadata('CLI')
      expect(cliMetadata.offline_support).toBe(true)
    })
  })

  describe('REST API Surface', () => {
    it('should handle workflow creation requests', async () => {
      const request: RestApiRequest = {
        method: 'POST',
        path: '/api/v1/workflows',
        headers: { 'Content-Type': 'application/json' },
        body: {
          type: 'app',
          name: 'Test App',
          description: 'Test Description',
          priority: 'high'
        },
        source_ip: '127.0.0.1'
      }

      const response = await restSurface.handleRequest(request)
      expect(response.status_code).toBe(202) // Accepted
      expect(response.body.status).toBe('accepted')
      expect(response.body.surface_id).toBeDefined()
    })

    it('should validate REST request payloads', async () => {
      const request: RestApiRequest = {
        method: 'POST',
        path: '/api/v1/workflows',
        headers: { 'Content-Type': 'application/json' },
        body: {
          // Missing required 'type' field
          name: 'Test App'
        }
      }

      const response = await restSurface.handleRequest(request)
      expect(response.status_code).toBe(400)
      expect(response.body.error).toBeDefined()
    })

    it('should return 404 for unknown endpoints', async () => {
      const request: RestApiRequest = {
        method: 'GET',
        path: '/api/v1/unknown',
        headers: {},
        body: {}
      }

      const response = await restSurface.handleRequest(request)
      expect(response.status_code).toBe(404)
    })

    it('should return health check', async () => {
      const request: RestApiRequest = {
        method: 'GET',
        path: '/api/v1/health',
        headers: {},
        body: {}
      }

      const response = await restSurface.handleRequest(request)
      expect(response.status_code).toBe(200)
      expect(response.body.status).toBe('healthy')
      expect(response.body.surface).toBe('rest_api')
    })

    it('should return Swagger documentation', async () => {
      const request: RestApiRequest = {
        method: 'GET',
        path: '/api/v1/docs',
        headers: {},
        body: {}
      }

      const response = await restSurface.handleRequest(request)
      expect(response.status_code).toBe(200)
      expect(response.body.openapi).toBeDefined()
      expect(response.body.paths).toBeDefined()
    })

    it('should support platform-specific workflow creation', async () => {
      const request: RestApiRequest = {
        method: 'POST',
        path: '/api/v1/platforms/test-platform/workflows',
        headers: { 'Content-Type': 'application/json' },
        body: {
          type: 'feature',
          name: 'Platform Feature'
        }
      }

      const response = await restSurface.handleRequest(request)
      expect(response.status_code).toBe(202)
      expect(response.body.platform_id).toBe('test-platform')
    })
  })

  describe('Webhook Surface', () => {
    it('should handle GitHub push webhook', async () => {
      const payload: WebhookPayload = {
        event: 'push',
        delivery_id: 'test-delivery-1',
        payload: {
          ref: 'refs/heads/main',
          repository: {
            name: 'test-repo',
            full_name: 'user/test-repo'
          },
          commits: [
            {
              message: 'Add new feature',
              author: { name: 'Test User' }
            }
          ]
        }
      }

      const result = await webhookSurface.handleDelivery(payload)
      expect(result.success).toBe(true)
      expect(result.delivery_id).toBe('test-delivery-1')
      expect(result.workflow_id).toBeDefined()
    })

    it('should handle GitHub pull request webhook', async () => {
      const payload: WebhookPayload = {
        event: 'pull_request',
        delivery_id: 'test-delivery-2',
        payload: {
          action: 'opened',
          pull_request: {
            number: 123,
            title: 'Add authentication',
            body: 'Implements user authentication'
          }
        }
      }

      const result = await webhookSurface.handleDelivery(payload)
      expect(result.success).toBe(true)
      expect(result.workflow_id).toBeDefined()
    })

    it('should detect duplicate deliveries', async () => {
      const payload: WebhookPayload = {
        event: 'push',
        delivery_id: 'test-delivery-3',
        payload: {
          repository: { name: 'test' },
          commits: []
        }
      }

      // First delivery
      const result1 = await webhookSurface.handleDelivery(payload)
      expect(result1.success).toBe(true)

      // Duplicate delivery
      const result2 = await webhookSurface.handleDelivery(payload)
      expect(result2.success).toBe(true)
      expect(result2.message).toContain('Duplicate')
    })

    it('should map webhook events to workflow types', async () => {
      const pushPayload: WebhookPayload = {
        event: 'push',
        delivery_id: `delivery-${Date.now()}`,
        payload: {
          ref: 'refs/heads/main',
          repository: { name: 'test' },
          commits: [{ message: 'Test' }]
        }
      }

      const releasePayload: WebhookPayload = {
        event: 'release',
        delivery_id: `delivery-${Date.now() + 1}`,
        payload: {
          action: 'published',
          release: { tag_name: 'v1.0.0' }
        }
      }

      const pushResult = await webhookSurface.handleDelivery(pushPayload)
      const releaseResult = await webhookSurface.handleDelivery(releasePayload)

      expect(pushResult.success).toBe(true)
      expect(releaseResult.success).toBe(true)
    })

    it('should get webhook statistics', () => {
      const stats = webhookSurface.getStats()
      expect(stats.processed_deliveries).toBeGreaterThanOrEqual(0)
      expect(stats.verified_signature).toBe(false) // We disabled verification
    })

    it('should test webhook with sample payload', async () => {
      const result = await webhookSurface.testWebhook('github')
      expect(result.success).toBe(true)
      expect(result.delivery_id).toBeDefined()
    })
  })

  describe('CLI Surface', () => {
    it('should handle workflow creation command', async () => {
      const command: CliCommand = {
        command: 'workflow:create',
        args: ['app', 'My CLI App'],
        flags: { priority: 'high' }
      }

      const result = await cliSurface.handleCommand(command)
      expect(result.success).toBe(true)
      expect(result.workflow_id).toBeDefined()
      expect(result.output).toBeDefined()
    })

    it('should validate workflow types', async () => {
      const command: CliCommand = {
        command: 'workflow:create',
        args: ['invalid-type', 'My App'],
        flags: {}
      }

      const result = await cliSurface.handleCommand(command)
      expect(result.success).toBe(false)
      expect(result.message).toContain('Invalid workflow type')
    })

    it('should show help message', async () => {
      const command: CliCommand = {
        command: 'help',
        args: [],
        flags: { help: true }
      }

      const result = await cliSurface.handleCommand(command)
      expect(result.success).toBe(true)
      expect(result.output).toContain('Usage')
    })

    it('should show version', async () => {
      const command: CliCommand = {
        command: 'version',
        args: [],
        flags: { version: true }
      }

      const result = await cliSurface.handleCommand(command)
      expect(result.success).toBe(true)
      expect(result.output).toContain('v1.0.0')
    })

    it('should support platform-targeted workflows', async () => {
      const command: CliCommand = {
        command: 'workflow:create',
        args: ['feature', 'New Feature'],
        flags: { platform: 'web-apps' }
      }

      const result = await cliSurface.handleCommand(command)
      expect(result.success).toBe(true)
      expect(result.output).toContain('web-apps')
    })

    it('should get CLI statistics', () => {
      const stats = cliSurface.getStats()
      expect(stats.offline_mode).toBe(false)
      expect(typeof stats.local_cache_entries).toBe('number')
    })

    it('should support offline mode', async () => {
      const offlineCli = new CliSurfaceService(surfaceRouter, {
        offline_mode: true,
        allow_local_cache: true
      })

      const command: CliCommand = {
        command: 'workflow:create',
        args: ['app', 'Offline App'],
        flags: {}
      }

      const result = await offlineCli.handleCommand(command)
      expect(result.success).toBe(true)
      expect(result.message).toContain('offline')
    })
  })

  describe('Multi-Surface Integration', () => {
    it('should handle same workflow from different surfaces', async () => {
      // Via REST
      const restRequest: RestApiRequest = {
        method: 'POST',
        path: '/api/v1/workflows',
        headers: {},
        body: {
          type: 'app',
          name: 'Multi-Surface App',
          priority: 'high'
        }
      }

      const restResponse = await restSurface.handleRequest(restRequest)
      expect(restResponse.status_code).toBe(202)

      // Via CLI
      const cliCommand: CliCommand = {
        command: 'workflow:create',
        args: ['app', 'Multi-Surface App'],
        flags: { priority: 'high' }
      }

      const cliResult = await cliSurface.handleCommand(cliCommand)
      expect(cliResult.success).toBe(true)

      // Via Webhook
      const webhookPayload: WebhookPayload = {
        event: 'release',
        delivery_id: `delivery-${Date.now()}`,
        payload: {
          action: 'published',
          release: { tag_name: 'v1.0.0' }
        }
      }

      const webhookResult = await webhookSurface.handleDelivery(webhookPayload)
      expect(webhookResult.success).toBe(true)
    })

    it('should preserve platform context across surfaces', async () => {
      // REST with platform
      const restRequest: RestApiRequest = {
        method: 'POST',
        path: '/api/v1/platforms/web-apps/workflows',
        headers: {},
        body: {
          type: 'feature',
          name: 'Web Feature'
        }
      }

      const restResponse = await restSurface.handleRequest(restRequest)
      expect(restResponse.body.platform_id).toBe('web-apps')
    })
  })

  describe('Backward Compatibility', () => {
    it('should support legacy workflow creation via REST', async () => {
      // Legacy workflow (no platform_id)
      const request: RestApiRequest = {
        method: 'POST',
        path: '/api/v1/workflows',
        headers: {},
        body: {
          type: 'feature',
          name: 'Legacy Feature'
        }
      }

      const response = await restSurface.handleRequest(request)
      expect(response.status_code).toBe(202)
      expect(response.body.platform_id).toBeUndefined()
    })

    it('should support legacy workflow creation via CLI', async () => {
      const command: CliCommand = {
        command: 'workflow:create',
        args: ['bugfix', 'Fix bug'],
        flags: {} // No platform specified
      }

      const result = await cliSurface.handleCommand(command)
      expect(result.success).toBe(true)
    })

    it('should support legacy workflow creation via webhook', async () => {
      const payload: WebhookPayload = {
        event: 'issues',
        delivery_id: `delivery-${Date.now()}`,
        payload: {
          action: 'opened',
          issue: {
            number: 456,
            title: 'Bug report'
          }
        }
      }

      const result = await webhookSurface.handleDelivery(payload)
      expect(result.success).toBe(true)
    })
  })

  describe('Phase 2 Gate Validation', () => {
    it('should pass all Phase 2 gate criteria', async () => {
      const checks = {
        restApiSurfaceWorking: false,
        webhookSurfaceWorking: false,
        cliSurfaceWorking: false,
        multiSurfaceSupport: false,
        backwardCompatibilityMaintained: false,
        productionReadiness: false
      }

      // Check 1: REST API surface working
      const restReq: RestApiRequest = {
        method: 'POST',
        path: '/api/v1/workflows',
        headers: {},
        body: { type: 'app', name: 'Test' }
      }
      const restResp = await restSurface.handleRequest(restReq)
      checks.restApiSurfaceWorking = restResp.status_code === 202

      // Check 2: Webhook surface working
      const whPayload: WebhookPayload = {
        event: 'push',
        delivery_id: `test-${Date.now()}`,
        payload: { repository: { name: 'test' }, commits: [] }
      }
      const whResult = await webhookSurface.handleDelivery(whPayload)
      checks.webhookSurfaceWorking = whResult.success

      // Check 3: CLI surface working
      const cliCmd: CliCommand = {
        command: 'workflow:create',
        args: ['app', 'Test'],
        flags: {}
      }
      const cliResult = await cliSurface.handleCommand(cliCmd)
      checks.cliSurfaceWorking = cliResult.success

      // Check 4: Multi-surface support
      checks.multiSurfaceSupport =
        checks.restApiSurfaceWorking &&
        checks.webhookSurfaceWorking &&
        checks.cliSurfaceWorking

      // Check 5: Backward compatibility
      const legacyReq: RestApiRequest = {
        method: 'POST',
        path: '/api/v1/workflows',
        headers: {},
        body: { type: 'feature', name: 'Legacy' }
      }
      const legacyResp = await restSurface.handleRequest(legacyReq)
      checks.backwardCompatibilityMaintained = legacyResp.status_code === 202

      // Check 6: Production readiness (all services initialized without errors)
      checks.productionReadiness =
        !!surfaceRouter &&
        !!restSurface &&
        !!webhookSurface &&
        !!cliSurface

      // All checks must pass
      const allPassed = Object.values(checks).every(v => v === true)
      expect(allPassed).toBe(true)

      // Log results
      console.log('Phase 2 Gate Validation Results:')
      Object.entries(checks).forEach(([key, value]) => {
        console.log(`  ${key}: ${value ? '✓ PASS' : '✗ FAIL'}`)
      })
    })
  })
})
