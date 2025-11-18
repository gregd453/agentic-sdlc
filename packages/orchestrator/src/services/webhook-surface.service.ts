/**
 * Webhook Surface Service - Handles GitHub and generic webhook events
 *
 * Responsibilities:
 * - Accept webhook events from GitHub
 * - Verify webhook signatures (HMAC)
 * - Map webhook events to workflow types
 * - Support generic webhook payloads
 * - Handle delivery retries and idempotency
 */

import { createHmac } from 'crypto'
import { SurfaceRouterService, SurfaceRequest } from './surface-router.service'
import { logger } from '../utils/logger'

export interface WebhookPayload {
  event: string
  delivery_id?: string
  signature?: string
  payload: Record<string, any>
}

export interface WebhookDeliveryResult {
  success: boolean
  delivery_id?: string
  message: string
  workflow_id?: string
}

export interface WebhookConfig {
  secret?: string
  verify_signature?: boolean
  max_payload_size_mb?: number
  event_mapping?: Record<string, string>
}

export class WebhookSurfaceService {
  private router: SurfaceRouterService
  private config: WebhookConfig
  private processedDeliveries: Set<string> = new Set() // Track processed deliveries
  private deliveryWindowMs: number = 24 * 60 * 60 * 1000 // 24 hours

  constructor(surfaceRouter: SurfaceRouterService, config?: WebhookConfig) {
    this.router = surfaceRouter
    this.config = {
      verify_signature: true,
      max_payload_size_mb: 25,
      event_mapping: {
        // GitHub events → workflow type
        'push': WORKFLOW_TYPES.FEATURE, // Code push = feature/bugfix
        'pull_request': WORKFLOW_TYPES.FEATURE, // PR = feature
        'release': WORKFLOW_TYPES.APP, // Release = app deployment
        'workflow_dispatch': WORKFLOW_TYPES.APP, // Manual workflow = app
        'repository.created': WORKFLOW_TYPES.APP, // New repo = app setup
        'issues': WORKFLOW_TYPES.BUGFIX // Issue opened = bugfix
      },
      ...config
    }

    logger.info('[WebhookSurface] Service initialized', {
      verify_signature: this.config.verify_signature,
      event_mapping_keys: Object.keys(this.config.event_mapping!).length
    })
  }

  /**
   * Handle incoming webhook delivery
   */
  async handleDelivery(payload: WebhookPayload): Promise<WebhookDeliveryResult> {
    const startTime = Date.now()
    const deliveryId = payload.delivery_id || `webhook-${Date.now()}`

    logger.info('[WebhookSurface] Handling webhook delivery', {
      delivery_id: deliveryId,
      event: payload.event
    })

    try {
      // Check for duplicate delivery
      if (this.processedDeliveries.has(deliveryId)) {
        logger.info('[WebhookSurface] Duplicate delivery detected, skipping', {
          delivery_id: deliveryId
        })
        return {
          success: true,
          delivery_id: deliveryId,
          message: 'Duplicate delivery ignored'
        }
      }

      // Verify signature if configured
      if (this.config.verify_signature && this.config.secret) {
        const valid = this.verifySignature(
          JSON.stringify(payload.payload),
          payload.signature || ''
        )
        if (!valid) {
          logger.error('[WebhookSurface] Signature verification failed', {
            delivery_id: deliveryId
          })
          return {
            success: false,
            delivery_id: deliveryId,
            message: 'Signature verification failed'
          }
        }
      }

      // Validate payload
      if (!this.isValidPayload(payload)) {
        logger.error('[WebhookSurface] Invalid payload', { delivery_id: deliveryId })
        return {
          success: false,
          delivery_id: deliveryId,
          message: 'Invalid webhook payload'
        }
      }

      // Map webhook event to workflow
      const workflowType = this.mapEventToWorkflowType(payload.event)
      if (!workflowType) {
        logger.warn('[WebhookSurface] Unmapped webhook event', {
          event: payload.event,
          delivery_id: deliveryId
        })
        return {
          success: true,
          delivery_id: deliveryId,
          message: 'Event type not mapped to workflow'
        }
      }

      // Extract workflow metadata from payload
      const metadata = this.extractMetadata(payload.event, payload.payload)

      // Create surface request
      const surfaceRequest: SurfaceRequest = {
        surface_type: 'WEBHOOK',
        payload: {
          type: workflowType,
          name: metadata.name,
          description: metadata.description,
          requirements: metadata.requirements,
          priority: metadata.priority || TASK_PRIORITY.HIGH, // Webhooks default to high priority
          webhook_metadata: {
            event: payload.event,
            delivery_id: deliveryId,
            repository: metadata.repository,
            branch: metadata.branch,
            source: metadata.source
          }
        },
        metadata: {
          source_ip: undefined, // Webhook source IP would need to be passed
          timestamp: new Date().toISOString()
        }
      }

      // Route through surface router
      const context = await this.router.routeRequest(surfaceRequest)

      // Mark delivery as processed
      this.processedDeliveries.add(deliveryId)

      const duration = Date.now() - startTime
      logger.info('[WebhookSurface] Webhook delivery processed successfully', {
        delivery_id: deliveryId,
        event: payload.event,
        workflow_type: workflowType,
        duration_ms: duration
      })

      return {
        success: true,
        delivery_id: deliveryId,
        message: 'Webhook processed successfully',
        workflow_id: context.surface_id
      }
    } catch (error) {
      logger.error('[WebhookSurface] Webhook processing failed', {
        delivery_id: deliveryId,
        error: error instanceof Error ? error.message : String(error)
      })

      return {
        success: false,
        delivery_id: deliveryId,
        message: error instanceof Error ? error.message : 'Webhook processing failed'
      }
    }
  }

  /**
   * Verify webhook signature (HMAC-SHA256)
   */
  private verifySignature(payload: string, signature: string): boolean {
    if (!this.config.secret) {
      logger.warn('[WebhookSurface] No secret configured for signature verification')
      return false
    }

    try {
      const hmac = createHmac('sha256', this.config.secret)
      hmac.update(payload)
      const digest = `sha256=${hmac.digest('hex')}`

      // Constant-time comparison to prevent timing attacks
      return this.constantTimeCompare(digest, signature)
    } catch (error) {
      logger.error('[WebhookSurface] Signature verification error', {
        error: error instanceof Error ? error.message : String(error)
      })
      return false
    }
  }

  /**
   * Constant-time string comparison
   */
  private constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) return false

    let result = 0
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i)
    }

    return result === 0
  }

  /**
   * Validate webhook payload structure
   */
  private isValidPayload(payload: WebhookPayload): boolean {
    if (!payload.event || typeof payload.event !== 'string') {
      logger.warn('[WebhookSurface] Missing or invalid event field')
      return false
    }

    if (!payload.payload || typeof payload.payload !== 'object') {
      logger.warn('[WebhookSurface] Missing or invalid payload field')
      return false
    }

    return true
  }

  /**
   * Map webhook event to workflow type
   */
  private mapEventToWorkflowType(event: string): string | null {
    // Exact match first
    if (this.config.event_mapping![event]) {
      return this.config.event_mapping![event]
    }

    // Prefix match (e.g., "pull_request.opened" → "pull_request")
    const prefix = event.split('.')[0]
    if (this.config.event_mapping![prefix]) {
      return this.config.event_mapping![prefix]
    }

    return null
  }

  /**
   * Extract workflow metadata from webhook payload
   */
  private extractMetadata(
    event: string,
    payload: Record<string, any>
  ): {
    name: string
    description: string
    repository?: string
    branch?: string
    priority?: string
    requirements?: string
    source: string
  } {
    const source = payload.repository?.full_name || 'webhook'
    const branch = payload.ref?.split('/').pop() || payload.branch || 'main'

    let name = ''
    let description = ''
    let requirements = ''

    // Extract from GitHub payload based on event type
    if (event.startsWith('push')) {
      const commits = payload.commits || []
      const commitCount = commits.length
      const branch = payload.ref?.split('/').pop() || 'main'
      name = `Push to ${branch} (${commitCount} commits)`
      description = commits.map((c: any) => c.message).join(', ').substring(0, 200)
    } else if (event.startsWith('pull_request')) {
      const pr = payload.pull_request
      name = `PR: ${pr?.title || 'Update'}`
      description = pr?.body || `Pull request #${pr?.number}`
    } else if (event === 'release') {
      const release = payload.release
      name = `Release: ${release?.tag_name || 'v1.0.0'}`
      description = release?.body || `Release deployment`
    } else if (event === 'issues') {
      const issue = payload.issue
      name = `Issue: ${issue?.title || 'Bug report'}`
      description = issue?.body || `Issue #${issue?.number}`
    } else if (event.startsWith('repository')) {
      name = `Repository event: ${event}`
      description = `Repository operation: ${event}`
    } else {
      // Generic event
      name = `Webhook: ${event}`
      description = `Event triggered: ${event}`
    }

    return {
      name: name.substring(0, 100),
      description: description.substring(0, 500),
      repository: source,
      branch,
      source: 'github',
      requirements
    }
  }

  /**
   * Clean up old processed deliveries (older than 24 hours)
   */
  cleanupOldDeliveries(): void {
    // For a real implementation, this would track timestamps
    // For now, just clear the set periodically
    if (this.processedDeliveries.size > 10000) {
      const oldSize = this.processedDeliveries.size
      this.processedDeliveries.clear()
      logger.info('[WebhookSurface] Cleaned up processed deliveries cache', {
        old_size: oldSize
      })
    }
  }

  /**
   * Get webhook statistics
   */
  getStats(): {
    processed_deliveries: number
    verified_signature: boolean
  } {
    return {
      processed_deliveries: this.processedDeliveries.size,
      verified_signature: this.config.verify_signature || false
    }
  }

  /**
   * Test webhook with sample payload
   */
  async testWebhook(source: 'github' | 'generic'): Promise<WebhookDeliveryResult> {
    const samples = {
      github: {
        event: 'push',
        delivery_id: `test-${Date.now()}`,
        payload: {
          ref: 'refs/heads/main',
          before: 'abc123',
          after: 'def456',
          repository: {
            name: 'test-repo',
            full_name: 'user/test-repo',
            html_url: 'https://github.com/user/test-repo'
          },
          commits: [
            {
              id: 'abc123def456',
              message: 'Test commit',
              author: { name: 'Test User' }
            }
          ]
        }
      },
      generic: {
        event: 'workflow_dispatch',
        delivery_id: `test-${Date.now()}`,
        payload: {
          workflow_name: 'Test Workflow',
          status: 'started'
        }
      }
    }

    return await this.handleDelivery(samples[source])
  }
}
