/**
 * SurfaceRouter Service - Routes workflows based on entry surface
 *
 * Responsibilities:
 * - Route workflow requests by surface type (REST, Webhook, CLI, Dashboard)
 * - Validate surface-specific request formats
 * - Enrich workflow data with surface context
 * - Support both platform-specific and legacy surfaces
 */

import { SurfaceType } from '@prisma/client'
import { CreateWorkflowRequest } from '../types'
import { logger } from '../utils/logger'

export interface SurfaceRequest {
  surface_type: SurfaceType
  platform_id?: string
  payload: Record<string, any>
  metadata?: {
    source_ip?: string
    user_agent?: string
    timestamp?: string
    trace_id?: string
  }
}

export interface SurfaceValidationResult {
  valid: boolean
  errors: string[]
  normalized_payload?: Record<string, any>
}

export interface SurfaceContext {
  surface_id: string
  surface_type: SurfaceType
  platform_id?: string
  validated_payload: Record<string, any>
  entry_metadata: Record<string, any>
}

export class SurfaceRouterService {
  constructor() {
    logger.info('[SurfaceRouter] Service initialized')
  }

  /**
   * Route a request from a specific surface to workflow creation
   */
  async routeRequest(request: SurfaceRequest): Promise<SurfaceContext> {
    logger.info('[SurfaceRouter] Routing request', {
      surface_type: request.surface_type,
      platform_id: request.platform_id,
      has_payload: !!request.payload
    })

    // Validate request structure
    const validation = this.validateSurfaceRequest(request)
    if (!validation.valid) {
      const errorMsg = `Surface validation failed: ${validation.errors.join(', ')}`
      logger.error('[SurfaceRouter] Request validation failed', {
        surface_type: request.surface_type,
        errors: validation.errors
      })
      throw new Error(errorMsg)
    }

    // Route based on surface type
    switch (request.surface_type) {
      case 'REST':
        return await this.routeRestSurface(request, validation.normalized_payload!)
      case 'WEBHOOK':
        return await this.routeWebhookSurface(request, validation.normalized_payload!)
      case 'CLI':
        return await this.routeCliSurface(request, validation.normalized_payload!)
      case 'DASHBOARD':
        return await this.routeDashboardSurface(request, validation.normalized_payload!)
      case 'MOBILE_API':
        return await this.routeMobileApiSurface(request, validation.normalized_payload!)
      default:
        throw new Error(`Unknown surface type: ${request.surface_type}`)
    }
  }

  /**
   * Convert SurfaceContext to CreateWorkflowRequest
   */
  surfaceContextToWorkflowRequest(context: SurfaceContext): Partial<CreateWorkflowRequest> {
    return {
      platform_id: context.platform_id,
      surface_id: context.surface_id,
      input_data: context.validated_payload,
      // These are extracted from payload if present
      name: context.validated_payload.name,
      description: context.validated_payload.description,
      requirements: context.validated_payload.requirements,
      type: context.validated_payload.type as any,
      priority: context.validated_payload.priority as any
    }
  }

  /**
   * Validate surface request structure
   */
  private validateSurfaceRequest(request: SurfaceRequest): SurfaceValidationResult {
    const errors: string[] = []

    // Check required fields
    if (!request.surface_type) {
      errors.push('surface_type is required')
    }

    if (!request.payload || typeof request.payload !== 'object') {
      errors.push('payload must be a non-null object')
    }

    // Validate payload has required workflow fields
    const payload = request.payload || {}
    if (!payload.type) {
      errors.push('workflow type is required in payload')
    }

    if (!payload.name) {
      errors.push('workflow name is required in payload')
    }

    if (payload.type && !['app', 'feature', 'bugfix'].includes(payload.type)) {
      errors.push(`invalid workflow type: ${payload.type}`)
    }

    if (payload.priority && !['low', 'medium', 'high', 'critical'].includes(payload.priority)) {
      errors.push(`invalid priority: ${payload.priority}`)
    }

    return {
      valid: errors.length === 0,
      errors,
      normalized_payload: this.normalizePayload(request.payload)
    }
  }

  /**
   * Normalize payload to standard workflow request format
   */
  private normalizePayload(payload: Record<string, any>): Record<string, any> {
    return {
      type: payload.type || 'app',
      name: (payload.name || '').trim(),
      description: payload.description || undefined,
      requirements: payload.requirements || undefined,
      priority: payload.priority || 'medium',
      trace_id: payload.trace_id, // Preserve trace_id if provided
      // Store other surface-specific data
      ...payload
    }
  }

  /**
   * Route REST API surface
   */
  private async routeRestSurface(
    request: SurfaceRequest,
    normalized_payload: Record<string, any>
  ): Promise<SurfaceContext> {
    logger.info('[SurfaceRouter] Routing REST surface request', {
      platform_id: request.platform_id,
      workflow_type: normalized_payload.type
    })

    return {
      surface_id: `rest-${Date.now()}`,
      surface_type: 'REST',
      platform_id: request.platform_id,
      validated_payload: normalized_payload,
      entry_metadata: {
        source: 'rest_api',
        source_ip: request.metadata?.source_ip,
        user_agent: request.metadata?.user_agent,
        received_at: new Date().toISOString()
      }
    }
  }

  /**
   * Route GitHub Webhook surface
   */
  private async routeWebhookSurface(
    request: SurfaceRequest,
    normalized_payload: Record<string, any>
  ): Promise<SurfaceContext> {
    logger.info('[SurfaceRouter] Routing webhook surface request', {
      platform_id: request.platform_id,
      workflow_type: normalized_payload.type
    })

    // Extract webhook-specific metadata
    const webhookMeta = request.payload.webhook_metadata || {}

    return {
      surface_id: `webhook-${Date.now()}`,
      surface_type: 'WEBHOOK',
      platform_id: request.platform_id,
      validated_payload: normalized_payload,
      entry_metadata: {
        source: 'webhook',
        webhook_event: webhookMeta.event,
        webhook_delivery_id: webhookMeta.delivery_id,
        source_repo: webhookMeta.repository,
        source_branch: webhookMeta.branch,
        received_at: new Date().toISOString()
      }
    }
  }

  /**
   * Route CLI surface
   */
  private async routeCliSurface(
    request: SurfaceRequest,
    normalized_payload: Record<string, any>
  ): Promise<SurfaceContext> {
    logger.info('[SurfaceRouter] Routing CLI surface request', {
      platform_id: request.platform_id,
      workflow_type: normalized_payload.type
    })

    return {
      surface_id: `cli-${Date.now()}`,
      surface_type: 'CLI',
      platform_id: request.platform_id,
      validated_payload: normalized_payload,
      entry_metadata: {
        source: 'cli',
        cli_command: normalized_payload.cli_command,
        cli_flags: normalized_payload.cli_flags || {},
        received_at: new Date().toISOString()
      }
    }
  }

  /**
   * Route Dashboard surface
   */
  private async routeDashboardSurface(
    request: SurfaceRequest,
    normalized_payload: Record<string, any>
  ): Promise<SurfaceContext> {
    logger.info('[SurfaceRouter] Routing dashboard surface request', {
      platform_id: request.platform_id,
      workflow_type: normalized_payload.type
    })

    return {
      surface_id: `dashboard-${Date.now()}`,
      surface_type: 'DASHBOARD',
      platform_id: request.platform_id,
      validated_payload: normalized_payload,
      entry_metadata: {
        source: 'dashboard',
        user_id: normalized_payload.user_id,
        session_id: normalized_payload.session_id,
        received_at: new Date().toISOString()
      }
    }
  }

  /**
   * Route Mobile API surface
   */
  private async routeMobileApiSurface(
    request: SurfaceRequest,
    normalized_payload: Record<string, any>
  ): Promise<SurfaceContext> {
    logger.info('[SurfaceRouter] Routing mobile API surface request', {
      platform_id: request.platform_id,
      workflow_type: normalized_payload.type
    })

    return {
      surface_id: `mobile-${Date.now()}`,
      surface_type: 'MOBILE_API',
      platform_id: request.platform_id,
      validated_payload: normalized_payload,
      entry_metadata: {
        source: 'mobile_app',
        device_type: normalized_payload.device_type,
        app_version: normalized_payload.app_version,
        offline_sync: normalized_payload.offline_sync || false,
        received_at: new Date().toISOString()
      }
    }
  }

  /**
   * Get surface metadata/config
   */
  getSurfaceMetadata(surface_type: SurfaceType): Record<string, any> {
    const metadata: Record<SurfaceType, Record<string, any>> = {
      REST: {
        description: 'RESTful HTTP API',
        authentication: 'API Key / JWT',
        rate_limit: '100 requests per 15 minutes',
        supported_formats: ['JSON']
      },
      WEBHOOK: {
        description: 'Event-driven webhook triggers',
        authentication: 'HMAC signature verification',
        retry_policy: '3 retries with exponential backoff',
        supported_events: ['push', 'pull_request', 'release']
      },
      CLI: {
        description: 'Command-line interface',
        authentication: 'Local (no network)',
        offline_support: true,
        supported_platforms: ['macOS', 'Linux', 'Windows']
      },
      DASHBOARD: {
        description: 'Web-based dashboard UI',
        authentication: 'Session-based',
        real_time: true,
        analytics: true
      },
      MOBILE_API: {
        description: 'Mobile-optimized API',
        authentication: 'OAuth 2.0',
        offline_sync: true,
        compression: 'gzip'
      }
    }

    return metadata[surface_type] || {}
  }
}
