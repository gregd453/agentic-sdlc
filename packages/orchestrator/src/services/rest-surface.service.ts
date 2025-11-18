/**
 * REST API Surface Service - Handles HTTP API surface for workflow submission
 *
 * Responsibilities:
 * - Accept REST API requests in standard HTTP format
 * - Validate request headers and payload
 * - Support both legacy and platform-aware workflows
 * - Provide Swagger/OpenAPI documentation
 */

import { CreateWorkflowRequest } from '../types'
import { SurfaceRouterService, SurfaceRequest, SurfaceContext } from './surface-router.service'
import { logger } from '../utils/logger'

export interface RestApiRequest {
  method: string
  path: string
  headers: Record<string, string>
  query?: Record<string, string>
  body: Record<string, any>
  source_ip?: string
  user_agent?: string
}

export interface RestApiResponse {
  status_code: number
  headers: Record<string, string>
  body: Record<string, any>
}

export interface RestApiOptions {
  base_path?: string
  enable_swagger?: boolean
  rate_limit_window_ms?: number
  rate_limit_max_requests?: number
}

export class RestSurfaceService {
  private router: SurfaceRouterService
  private options: RestApiOptions

  constructor(surfaceRouter: SurfaceRouterService, options?: RestApiOptions) {
    this.router = surfaceRouter
    this.options = {
      base_path: '/api/v1',
      enable_swagger: true,
      rate_limit_window_ms: 15 * 60 * 1000, // 15 minutes
      rate_limit_max_requests: 100,
      ...options
    }

    logger.info('[RestSurface] Service initialized', {
      base_path: this.options.base_path,
      enable_swagger: this.options.enable_swagger
    })
  }

  /**
   * Handle incoming REST API request
   */
  async handleRequest(request: RestApiRequest): Promise<RestApiResponse> {
    const startTime = Date.now()

    logger.info('[RestSurface] Handling request', {
      method: request.method,
      path: request.path,
      source_ip: request.source_ip
    })

    try {
      // Route the request based on method and path
      const response = await this.routeRequest(request)

      const duration = Date.now() - startTime
      logger.info('[RestSurface] Request handled successfully', {
        status: response.status_code,
        duration_ms: duration
      })

      return response
    } catch (error) {
      logger.error('[RestSurface] Request handling failed', {
        error: error instanceof Error ? error.message : String(error),
        path: request.path
      })

      return this.errorResponse(
        error instanceof Error ? error.message : 'Internal server error',
        500
      )
    }
  }

  /**
   * Route request based on HTTP method and path
   */
  private async routeRequest(request: RestApiRequest): Promise<RestApiResponse> {
    // GET endpoints
    if (request.method === 'GET') {
      if (request.path.match(/^\/api\/v1\/workflows$/)) {
        return await this.getWorkflows(request)
      }
      if (request.path.match(/^\/api\/v1\/workflows\/[^/]+$/)) {
        const id = request.path.split('/').pop()
        return await this.getWorkflow(request, id!)
      }
      if (request.path.match(/^\/api\/v1\/platforms$/)) {
        return await this.getPlatforms(request)
      }
      if (request.path.match(/^\/api\/v1\/surfaces$/)) {
        return await this.getSurfaces(request)
      }
      if (request.path.match(/^\/api\/v1\/health$/)) {
        return this.healthResponse()
      }
      if (request.path.match(/^\/api\/v1\/docs$/)) {
        return await this.getSwaggerDocs(request)
      }
    }

    // POST endpoints
    if (request.method === 'POST') {
      if (request.path.match(/^\/api\/v1\/workflows$/)) {
        return await this.createWorkflow(request)
      }
      if (request.path.match(/^\/api\/v1\/platforms\/[^/]+\/workflows$/)) {
        return await this.createPlatformWorkflow(request)
      }
    }

    // PUT/PATCH endpoints
    if (request.method === 'PUT' || request.method === 'PATCH') {
      if (request.path.match(/^\/api\/v1\/workflows\/[^/]+$/)) {
        const id = request.path.split('/').pop()
        return await this.updateWorkflow(request, id!)
      }
    }

    // Not found
    return this.errorResponse('Endpoint not found', 404)
  }

  /**
   * POST /api/v1/workflows - Create legacy workflow
   */
  private async createWorkflow(request: RestApiRequest): Promise<RestApiResponse> {
    logger.info('[RestSurface] Creating workflow via REST API')

    try {
      // Validate request body
      const validation = this.validateWorkflowPayload(request.body)
      if (!validation.valid) {
        return this.errorResponse(
          `Validation failed: ${validation.errors.join(', ')}`,
          400
        )
      }

      // Create surface request (legacy - no platform)
      const surfaceRequest: SurfaceRequest = {
        surface_type: 'REST',
        payload: request.body,
        metadata: {
          source_ip: request.source_ip,
          user_agent: request.user_agent,
          timestamp: new Date().toISOString(),
          trace_id: request.body.trace_id
        }
      }

      // Route through surface router
      const context = await this.router.routeRequest(surfaceRequest)

      // Return response with context
      return {
        status_code: 202, // Accepted (workflow will be processed)
        headers: {
          'Content-Type': 'application/json',
          'Location': `/api/v1/workflows/${context.surface_id}`
        },
        body: {
          status: 'accepted',
          surface_id: context.surface_id,
          surface_type: context.surface_type,
          message: 'Workflow submitted and will be processed'
        }
      }
    } catch (error) {
      return this.errorResponse(
        error instanceof Error ? error.message : 'Failed to create workflow',
        400
      )
    }
  }

  /**
   * POST /api/v1/platforms/:platformId/workflows - Create platform-specific workflow
   */
  private async createPlatformWorkflow(request: RestApiRequest): Promise<RestApiResponse> {
    const platformId = request.path.split('/')[4]
    logger.info('[RestSurface] Creating platform workflow', { platform_id: platformId })

    try {
      const validation = this.validateWorkflowPayload(request.body)
      if (!validation.valid) {
        return this.errorResponse(
          `Validation failed: ${validation.errors.join(', ')}`,
          400
        )
      }

      const surfaceRequest: SurfaceRequest = {
        surface_type: 'REST',
        platform_id: platformId,
        payload: request.body,
        metadata: {
          source_ip: request.source_ip,
          user_agent: request.user_agent,
          timestamp: new Date().toISOString()
        }
      }

      const context = await this.router.routeRequest(surfaceRequest)

      return {
        status_code: 202,
        headers: {
          'Content-Type': 'application/json',
          'Location': `/api/v1/platforms/${platformId}/workflows/${context.surface_id}`
        },
        body: {
          status: 'accepted',
          platform_id: context.platform_id,
          surface_id: context.surface_id,
          message: 'Platform workflow submitted'
        }
      }
    } catch (error) {
      return this.errorResponse(
        error instanceof Error ? error.message : 'Failed to create platform workflow',
        400
      )
    }
  }

  /**
   * GET /api/v1/workflows - List workflows
   */
  private async getWorkflows(request: RestApiRequest): Promise<RestApiResponse> {
    logger.info('[RestSurface] Getting workflows list')

    // TODO: Implement actual workflow listing
    return {
      status_code: 200,
      headers: { 'Content-Type': 'application/json' },
      body: {
        workflows: [],
        count: 0,
        message: 'Workflow listing endpoint ready for implementation'
      }
    }
  }

  /**
   * GET /api/v1/workflows/:id - Get single workflow
   */
  private async getWorkflow(request: RestApiRequest, id: string): Promise<RestApiResponse> {
    logger.info('[RestSurface] Getting workflow', { workflow_id: id })

    // TODO: Implement actual workflow retrieval
    return {
      status_code: 200,
      headers: { 'Content-Type': 'application/json' },
      body: {
        workflow_id: id,
        message: 'Workflow retrieval endpoint ready for implementation'
      }
    }
  }

  /**
   * PUT /api/v1/workflows/:id - Update workflow
   */
  private async updateWorkflow(request: RestApiRequest, id: string): Promise<RestApiResponse> {
    logger.info('[RestSurface] Updating workflow', { workflow_id: id })

    // TODO: Implement actual workflow update
    return {
      status_code: 200,
      headers: { 'Content-Type': 'application/json' },
      body: {
        workflow_id: id,
        message: 'Workflow update endpoint ready for implementation'
      }
    }
  }

  /**
   * GET /api/v1/platforms - List platforms
   */
  private async getPlatforms(request: RestApiRequest): Promise<RestApiResponse> {
    logger.info('[RestSurface] Getting platforms list')

    // TODO: Implement actual platform listing
    return {
      status_code: 200,
      headers: { 'Content-Type': 'application/json' },
      body: {
        platforms: [],
        count: 0,
        message: 'Platform listing endpoint ready for implementation'
      }
    }
  }

  /**
   * GET /api/v1/surfaces - List surfaces
   */
  private async getSurfaces(request: RestApiRequest): Promise<RestApiResponse> {
    logger.info('[RestSurface] Getting surfaces list')

    const surfaces = ['REST', 'WEBHOOK', 'CLI', 'DASHBOARD', 'MOBILE_API']
    return {
      status_code: 200,
      headers: { 'Content-Type': 'application/json' },
      body: {
        surfaces: surfaces.map(type => ({
          type,
          metadata: this.router.getSurfaceMetadata(type as any)
        })),
        count: surfaces.length
      }
    }
  }

  /**
   * GET /api/v1/health - Health check
   */
  private healthResponse(): RestApiResponse {
    return {
      status_code: 200,
      headers: { 'Content-Type': 'application/json' },
      body: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        surface: 'rest_api'
      }
    }
  }

  /**
   * GET /api/v1/docs - Swagger/OpenAPI documentation
   */
  private async getSwaggerDocs(request: RestApiRequest): Promise<RestApiResponse> {
    const docs = {
      openapi: '3.0.0',
      info: {
        title: 'Agentic SDLC REST API',
        version: '1.0.0',
        description: 'REST API surface for workflow submission and management'
      },
      paths: {
        '/api/v1/workflows': {
          post: {
            summary: 'Create workflow (legacy)',
            tags: ['Workflows (Legacy)'],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['type', 'name'],
                    properties: {
                      type: {
                        type: 'string',
                        enum: ['app', 'feature', 'bugfix']
                      },
                      name: {
                        type: 'string'
                      },
                      description: {
                        type: 'string'
                      },
                      priority: {
                        type: 'string',
                        enum: ['low', 'medium', 'high', 'critical'],
                        default: 'medium'
                      }
                    }
                  }
                }
              }
            },
            responses: {
              202: {
                description: 'Workflow accepted for processing'
              },
              400: {
                description: 'Invalid request'
              }
            }
          },
          get: {
            summary: 'List workflows',
            tags: ['Workflows'],
            responses: {
              200: {
                description: 'List of workflows'
              }
            }
          }
        },
        '/api/v1/platforms/{platformId}/workflows': {
          post: {
            summary: 'Create platform-specific workflow',
            tags: ['Workflows (Platform-Aware)'],
            parameters: [
              {
                name: 'platformId',
                in: 'path',
                required: true,
                schema: { type: 'string' }
              }
            ],
            responses: {
              202: {
                description: 'Platform workflow accepted'
              }
            }
          }
        }
      }
    }

    return {
      status_code: 200,
      headers: { 'Content-Type': 'application/json' },
      body: docs
    }
  }

  /**
   * Validate workflow payload
   */
  private validateWorkflowPayload(payload: any): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!payload.type) {
      errors.push('type is required')
    } else if (!['app', 'feature', 'bugfix'].includes(payload.type)) {
      errors.push(`invalid type: ${payload.type}`)
    }

    if (!payload.name) {
      errors.push('name is required')
    } else if (typeof payload.name !== 'string' || payload.name.trim().length === 0) {
      errors.push('name must be a non-empty string')
    }

    if (payload.priority && !['low', 'medium', 'high', 'critical'].includes(payload.priority)) {
      errors.push(`invalid priority: ${payload.priority}`)
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * Error response helper
   */
  private errorResponse(message: string, status_code: number): RestApiResponse {
    return {
      status_code,
      headers: { 'Content-Type': 'application/json' },
      body: {
        error: message,
        status: 'error',
        timestamp: new Date().toISOString()
      }
    }
  }
}
