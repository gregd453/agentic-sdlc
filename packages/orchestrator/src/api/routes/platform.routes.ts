import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { PlatformRegistryService } from '../../services/platform-registry.service';
import { PlatformService } from '../../services/platform.service';
import { PlatformLoaderService } from '../../services/platform-loader.service';
import { StatsService } from '../../services/stats.service';
import { AgentRegistryService } from '../../services/agent-registry.service';
import { logger } from '../../utils/logger';

export async function platformRoutes(
  fastify: FastifyInstance,
  options: {
    platformRegistry: PlatformRegistryService
    platformService: PlatformService
    platformLoader: PlatformLoaderService
    statsService: StatsService
    agentRegistry: AgentRegistryService
  }
): Promise<void> {
  const { platformRegistry, platformService, platformLoader, statsService, agentRegistry } = options;

  // List all platforms
  fastify.get('/api/v1/platforms', {
    schema: {
      response: {
        200: zodToJsonSchema(z.array(z.object({
          id: z.string().uuid(),
          name: z.string(),
          layer: z.string(),
          description: z.string().optional(),
          enabled: z.boolean(),
          created_at: z.string().datetime().optional(),
          updated_at: z.string().datetime().optional()
        })))
      }
    },
    handler: async (_request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      try {
        const platforms = platformRegistry.getAllPlatforms();
        const response = platforms.map(entry => ({
          id: entry.platform.id,
          name: entry.platform.name,
          layer: entry.platform.layer,
          description: entry.platform.description,
          enabled: entry.platform.enabled,
          created_at: entry.platform.created_at?.toISOString(),
          updated_at: entry.platform.updated_at?.toISOString()
        }));
        reply.code(200).send(response);
      } catch (error) {
        logger.error('Failed to list platforms', { error });
        reply.code(500).send({
          error: 'Internal server error'
        });
      }
    }
  });

  // Get platform by ID
  fastify.get('/api/v1/platforms/:id', {
    schema: {
      params: zodToJsonSchema(z.object({
        id: z.string().uuid()
      })),
      response: {
        200: zodToJsonSchema(z.object({
          id: z.string().uuid(),
          name: z.string(),
          layer: z.string(),
          description: z.string().optional(),
          enabled: z.boolean(),
          created_at: z.string().datetime().optional(),
          updated_at: z.string().datetime().optional()
        })),
        404: zodToJsonSchema(z.object({
          error: z.string()
        }))
      }
    },
    handler: async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ): Promise<void> => {
      try {
        const entry = platformRegistry.getPlatformById(request.params.id);
        if (!entry) {
          reply.code(404).send({
            error: 'Platform not found'
          });
          return;
        }
        reply.code(200).send({
          id: entry.platform.id,
          name: entry.platform.name,
          layer: entry.platform.layer,
          description: entry.platform.description,
          enabled: entry.platform.enabled,
          created_at: entry.platform.created_at?.toISOString(),
          updated_at: entry.platform.updated_at?.toISOString()
        });
      } catch (error) {
        logger.error('Failed to get platform', { error, id: request.params.id });
        reply.code(500).send({
          error: 'Internal server error'
        });
      }
    }
  });

  // Get platform analytics
  fastify.get('/api/v1/platforms/:id/analytics', {
    schema: {
      params: zodToJsonSchema(z.object({
        id: z.string().uuid()
      })),
      querystring: zodToJsonSchema(z.object({
        period: z.enum(['1h', '24h', '7d', '30d']).optional()
      })),
      response: {
        200: zodToJsonSchema(z.object({
          platform_id: z.string().uuid(),
          platform_name: z.string(),
          total_workflows: z.number(),
          completed_workflows: z.number(),
          failed_workflows: z.number(),
          running_workflows: z.number(),
          avg_completion_time_ms: z.number().nullable(),
          success_rate: z.number(),
          timeseries: z.array(z.object({
            timestamp: z.string(),
            workflows_created: z.number(),
            workflows_completed: z.number(),
            workflows_failed: z.number()
          }))
        })),
        404: zodToJsonSchema(z.object({
          error: z.string()
        }))
      }
    },
    handler: async (
      request: FastifyRequest<{
        Params: { id: string }
        Querystring: { period?: string }
      }>,
      reply: FastifyReply
    ): Promise<void> => {
      try {
        const entry = platformRegistry.getPlatformById(request.params.id);
        if (!entry) {
          reply.code(404).send({
            error: 'Platform not found'
          });
          return;
        }

        const period = request.query.period || '24h';
        const timeseries = await statsService.getTimeSeries(period);
        const overview = await statsService.getOverview();

        // Calculate success rate
        const totalWorkflows = overview.overview.completed_workflows + overview.overview.failed_workflows;
        const successRate = totalWorkflows > 0
          ? (overview.overview.completed_workflows / totalWorkflows) * 100
          : 0;

        reply.code(200).send({
          platform_id: entry.platform.id,
          platform_name: entry.platform.name,
          total_workflows: overview.overview.total_workflows,
          completed_workflows: overview.overview.completed_workflows,
          failed_workflows: overview.overview.failed_workflows,
          running_workflows: overview.overview.running_workflows,
          avg_completion_time_ms: overview.avg_completion_time_ms,
          success_rate: Math.round(successRate * 100) / 100,
          timeseries
        });
      } catch (error: any) {
        if (error.message?.includes('Invalid period')) {
          reply.code(400).send({
            error: error.message
          });
        } else {
          logger.error('Failed to get platform analytics', { error, id: request.params.id });
          reply.code(500).send({
            error: 'Internal server error'
          });
        }
      }
    }
  });

  // Get agents for a specific platform
  fastify.get('/api/v1/platforms/:id/agents', {
    schema: {
      params: zodToJsonSchema(z.object({
        id: z.string()
      })),
      response: {
        200: zodToJsonSchema(z.array(z.object({
          type: z.string(),
          name: z.string(),
          version: z.string(),
          description: z.string().optional(),
          capabilities: z.array(z.string()),
          timeout_ms: z.number(),
          max_retries: z.number(),
          configSchema: z.any().optional(),
          scope: z.enum(['global', 'platform']),
          platformId: z.string().optional()
        }))),
        404: zodToJsonSchema(z.object({
          error: z.string()
        }))
      }
    },
    handler: async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ): Promise<void> => {
      try {
        // Verify platform exists
        const entry = platformRegistry.getPlatformById(request.params.id);
        if (!entry) {
          reply.code(404).send({
            error: 'Platform not found'
          });
          return;
        }

        // Get agents for this platform
        const agents = agentRegistry.listAgents(request.params.id);

        logger.info('[GET /api/v1/platforms/:id/agents] Retrieved platform agents', {
          platformId: request.params.id,
          agentCount: agents.length
        });

        reply.code(200).send(agents);
      } catch (error) {
        logger.error('Failed to get platform agents', { error, id: request.params.id });
        reply.code(500).send({
          error: 'Internal server error'
        });
      }
    }
  });

  // Create a new platform
  fastify.post('/api/v1/platforms', {
    schema: {
      body: zodToJsonSchema(z.object({
        name: z.string().min(1, 'Platform name is required'),
        layer: z.enum(['APPLICATION', 'DATA', 'INFRASTRUCTURE', 'ENTERPRISE']),
        description: z.string().optional(),
        config: z.record(z.any()).optional(),
        enabled: z.boolean().optional()
      })),
      response: {
        201: zodToJsonSchema(z.object({
          id: z.string().uuid(),
          name: z.string(),
          layer: z.string(),
          description: z.string().optional(),
          config: z.any().optional(),
          enabled: z.boolean(),
          created_at: z.string().datetime(),
          updated_at: z.string().datetime()
        })),
        400: zodToJsonSchema(z.object({
          error: z.string()
        })),
        500: zodToJsonSchema(z.object({
          error: z.string()
        }))
      }
    },
    handler: async (
      request: FastifyRequest<{
        Body: {
          name: string
          layer: string
          description?: string
          config?: Record<string, any>
          enabled?: boolean
        }
      }>,
      reply: FastifyReply
    ): Promise<void> => {
      try {
        // Cast layer string to PlatformLayer enum
        const { layer, ...body } = request.body;
        const platform = await platformService.createPlatform({
          ...body,
          layer: layer as any // layer is validated by schema
        });

        // Reload platform in registry
        platformLoader.invalidateCache();
        await platformRegistry.refresh();

        logger.info('[POST /api/v1/platforms] Created platform', {
          platformId: platform.id,
          name: platform.name
        });

        reply.code(201).send(platform);
      } catch (error: any) {
        logger.error('[POST /api/v1/platforms] Failed to create platform', { error: error.message });
        reply.code(400).send({
          error: error.message || 'Failed to create platform'
        });
      }
    }
  });

  // Update an existing platform
  fastify.put('/api/v1/platforms/:id', {
    schema: {
      params: zodToJsonSchema(z.object({
        id: z.string().uuid()
      })),
      body: zodToJsonSchema(z.object({
        name: z.string().optional(),
        layer: z.enum(['APPLICATION', 'DATA', 'INFRASTRUCTURE', 'ENTERPRISE']).optional(),
        description: z.string().optional().nullable(),
        config: z.record(z.any()).optional(),
        enabled: z.boolean().optional()
      })),
      response: {
        200: zodToJsonSchema(z.object({
          id: z.string().uuid(),
          name: z.string(),
          layer: z.string(),
          description: z.string().optional(),
          config: z.any().optional(),
          enabled: z.boolean(),
          created_at: z.string().datetime(),
          updated_at: z.string().datetime()
        })),
        400: zodToJsonSchema(z.object({
          error: z.string()
        })),
        404: zodToJsonSchema(z.object({
          error: z.string()
        })),
        500: zodToJsonSchema(z.object({
          error: z.string()
        }))
      }
    },
    handler: async (
      request: FastifyRequest<{
        Params: { id: string }
        Body: {
          name?: string
          layer?: string
          description?: string | null
          config?: Record<string, any>
          enabled?: boolean
        }
      }>,
      reply: FastifyReply
    ): Promise<void> => {
      try {
        // Cast layer string to PlatformLayer enum if provided
        const { layer, ...body } = request.body;
        const updateData = layer ? { ...body, layer: layer as any } : body;
        const platform = await platformService.updatePlatform(request.params.id, updateData);

        // Reload platform in registry
        platformLoader.invalidateCache(request.params.id);
        await platformRegistry.refresh();

        logger.info('[PUT /api/v1/platforms/:id] Updated platform', {
          platformId: request.params.id,
          updates: Object.keys(request.body)
        });

        reply.code(200).send(platform);
      } catch (error: any) {
        const statusCode = error.message?.includes('not found') ? 404 : 400;
        logger.error('[PUT /api/v1/platforms/:id] Failed to update platform', {
          platformId: request.params.id,
          error: error.message
        });
        reply.code(statusCode).send({
          error: error.message || 'Failed to update platform'
        });
      }
    }
  });

  // Delete a platform
  fastify.delete('/api/v1/platforms/:id', {
    schema: {
      params: zodToJsonSchema(z.object({
        id: z.string().uuid()
      })),
      response: {
        204: z.null(),
        404: zodToJsonSchema(z.object({
          error: z.string()
        })),
        500: zodToJsonSchema(z.object({
          error: z.string()
        }))
      }
    },
    handler: async (
      request: FastifyRequest<{
        Params: { id: string }
      }>,
      reply: FastifyReply
    ): Promise<void> => {
      try {
        await platformService.deletePlatform(request.params.id);

        // Reload platforms in registry
        platformLoader.invalidateCache();
        await platformRegistry.refresh();

        logger.info('[DELETE /api/v1/platforms/:id] Deleted platform', {
          platformId: request.params.id
        });

        reply.code(204).send();
      } catch (error: any) {
        const statusCode = error.message?.includes('not found') ? 404 : 500;
        logger.error('[DELETE /api/v1/platforms/:id] Failed to delete platform', {
          platformId: request.params.id,
          error: error.message
        });
        reply.code(statusCode).send({
          error: error.message || 'Failed to delete platform'
        });
      }
    }
  });

  // ==========================================
  // PHASE 4: SURFACE MANAGEMENT API ROUTES
  // ==========================================

  // List platform surfaces
  fastify.get('/api/v1/platforms/:platformId/surfaces', {
    schema: {
      params: zodToJsonSchema(z.object({
        platformId: z.string().uuid()
      })),
      response: {
        200: zodToJsonSchema(z.array(z.object({
          id: z.string().uuid(),
          platform_id: z.string().uuid(),
          surface_type: z.enum(['REST', 'WEBHOOK', 'CLI', 'DASHBOARD', 'MOBILE_API']),
          config: z.record(z.any()).optional(),
          enabled: z.boolean(),
          created_at: z.string().datetime(),
          updated_at: z.string().datetime()
        }))),
        404: zodToJsonSchema(z.object({
          error: z.string()
        }))
      }
    },
    handler: async (
      request: FastifyRequest<{ Params: { platformId: string } }>,
      reply: FastifyReply
    ): Promise<void> => {
      try {
        // Verify platform exists
        const entry = platformRegistry.getPlatformById(request.params.platformId);
        if (!entry) {
          reply.code(404).send({
            error: 'Platform not found'
          });
          return;
        }

        // Get surfaces for this platform
        const surfaces = await platformService.getPlatformSurfaces(request.params.platformId);

        logger.info('[GET /api/v1/platforms/:platformId/surfaces] Retrieved platform surfaces', {
          platformId: request.params.platformId,
          surfaceCount: surfaces.length
        });

        reply.code(200).send(surfaces);
      } catch (error) {
        logger.error('Failed to get platform surfaces', { error, platformId: request.params.platformId });
        reply.code(500).send({
          error: 'Internal server error'
        });
      }
    }
  });

  // Enable/create a platform surface
  fastify.post('/api/v1/platforms/:platformId/surfaces', {
    schema: {
      params: zodToJsonSchema(z.object({
        platformId: z.string().uuid()
      })),
      body: zodToJsonSchema(z.object({
        surface_type: z.enum(['REST', 'WEBHOOK', 'CLI', 'DASHBOARD', 'MOBILE_API']),
        config: z.record(z.any()).optional(),
        enabled: z.boolean().optional()
      })),
      response: {
        201: zodToJsonSchema(z.object({
          id: z.string().uuid(),
          platform_id: z.string().uuid(),
          surface_type: z.enum(['REST', 'WEBHOOK', 'CLI', 'DASHBOARD', 'MOBILE_API']),
          config: z.record(z.any()).optional(),
          enabled: z.boolean(),
          created_at: z.string().datetime(),
          updated_at: z.string().datetime()
        })),
        400: zodToJsonSchema(z.object({
          error: z.string()
        })),
        404: zodToJsonSchema(z.object({
          error: z.string()
        }))
      }
    },
    handler: async (
      request: FastifyRequest<{
        Params: { platformId: string }
        Body: {
          surface_type: 'REST' | 'WEBHOOK' | 'CLI' | 'DASHBOARD' | 'MOBILE_API'
          config?: Record<string, any>
          enabled?: boolean
        }
      }>,
      reply: FastifyReply
    ): Promise<void> => {
      try {
        // Verify platform exists
        const entry = platformRegistry.getPlatformById(request.params.platformId);
        if (!entry) {
          reply.code(404).send({
            error: 'Platform not found'
          });
          return;
        }

        // Create or enable surface
        const surface = await platformService.enablePlatformSurface(
          request.params.platformId,
          request.body.surface_type,
          request.body.config || {},
          request.body.enabled ?? true
        );

        logger.info('[POST /api/v1/platforms/:platformId/surfaces] Enabled platform surface', {
          platformId: request.params.platformId,
          surfaceType: request.body.surface_type
        });

        reply.code(201).send(surface);
      } catch (error: any) {
        logger.error('[POST /api/v1/platforms/:platformId/surfaces] Failed to enable surface', {
          platformId: request.params.platformId,
          error: error.message
        });
        reply.code(400).send({
          error: error.message || 'Failed to enable surface'
        });
      }
    }
  });

  // Update a platform surface
  fastify.put('/api/v1/platforms/:platformId/surfaces/:surfaceType', {
    schema: {
      params: zodToJsonSchema(z.object({
        platformId: z.string().uuid(),
        surfaceType: z.enum(['REST', 'WEBHOOK', 'CLI', 'DASHBOARD', 'MOBILE_API'])
      })),
      body: zodToJsonSchema(z.object({
        config: z.record(z.any()).optional(),
        enabled: z.boolean().optional()
      })),
      response: {
        200: zodToJsonSchema(z.object({
          id: z.string().uuid(),
          platform_id: z.string().uuid(),
          surface_type: z.enum(['REST', 'WEBHOOK', 'CLI', 'DASHBOARD', 'MOBILE_API']),
          config: z.record(z.any()).optional(),
          enabled: z.boolean(),
          created_at: z.string().datetime(),
          updated_at: z.string().datetime()
        })),
        400: zodToJsonSchema(z.object({
          error: z.string()
        })),
        404: zodToJsonSchema(z.object({
          error: z.string()
        }))
      }
    },
    handler: async (
      request: FastifyRequest<{
        Params: {
          platformId: string
          surfaceType: 'REST' | 'WEBHOOK' | 'CLI' | 'DASHBOARD' | 'MOBILE_API'
        }
        Body: {
          config?: Record<string, any>
          enabled?: boolean
        }
      }>,
      reply: FastifyReply
    ): Promise<void> => {
      try {
        // Verify platform exists
        const entry = platformRegistry.getPlatformById(request.params.platformId);
        if (!entry) {
          reply.code(404).send({
            error: 'Platform not found'
          });
          return;
        }

        // Update surface
        const surface = await platformService.updatePlatformSurface(
          request.params.platformId,
          request.params.surfaceType,
          request.body
        );

        logger.info('[PUT /api/v1/platforms/:platformId/surfaces/:surfaceType] Updated platform surface', {
          platformId: request.params.platformId,
          surfaceType: request.params.surfaceType
        });

        reply.code(200).send(surface);
      } catch (error: any) {
        const statusCode = error.message?.includes('not found') ? 404 : 400;
        logger.error('[PUT /api/v1/platforms/:platformId/surfaces/:surfaceType] Failed to update surface', {
          platformId: request.params.platformId,
          surfaceType: request.params.surfaceType,
          error: error.message
        });
        reply.code(statusCode).send({
          error: error.message || 'Failed to update surface'
        });
      }
    }
  });

  // Disable/delete a platform surface
  fastify.delete('/api/v1/platforms/:platformId/surfaces/:surfaceType', {
    schema: {
      params: zodToJsonSchema(z.object({
        platformId: z.string().uuid(),
        surfaceType: z.enum(['REST', 'WEBHOOK', 'CLI', 'DASHBOARD', 'MOBILE_API'])
      })),
      response: {
        204: z.null(),
        404: zodToJsonSchema(z.object({
          error: z.string()
        })),
        500: zodToJsonSchema(z.object({
          error: z.string()
        }))
      }
    },
    handler: async (
      request: FastifyRequest<{
        Params: {
          platformId: string
          surfaceType: 'REST' | 'WEBHOOK' | 'CLI' | 'DASHBOARD' | 'MOBILE_API'
        }
      }>,
      reply: FastifyReply
    ): Promise<void> => {
      try {
        // Verify platform exists
        const entry = platformRegistry.getPlatformById(request.params.platformId);
        if (!entry) {
          reply.code(404).send({
            error: 'Platform not found'
          });
          return;
        }

        // Disable surface
        await platformService.disablePlatformSurface(
          request.params.platformId,
          request.params.surfaceType
        );

        logger.info('[DELETE /api/v1/platforms/:platformId/surfaces/:surfaceType] Disabled platform surface', {
          platformId: request.params.platformId,
          surfaceType: request.params.surfaceType
        });

        reply.code(204).send();
      } catch (error: any) {
        const statusCode = error.message?.includes('not found') ? 404 : 500;
        logger.error('[DELETE /api/v1/platforms/:platformId/surfaces/:surfaceType] Failed to disable surface', {
          platformId: request.params.platformId,
          surfaceType: request.params.surfaceType,
          error: error.message
        });
        reply.code(statusCode).send({
          error: error.message || 'Failed to disable surface'
        });
      }
    }
  });
}
