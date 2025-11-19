import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { PlatformRegistryService } from '../../services/platform-registry.service';
import { StatsService } from '../../services/stats.service';
import { AgentRegistryService } from '../../services/agent-registry.service';
import { logger } from '../../utils/logger';

export async function platformRoutes(
  fastify: FastifyInstance,
  options: {
    platformRegistry: PlatformRegistryService
    statsService: StatsService
    agentRegistry: AgentRegistryService
  }
): Promise<void> {
  const { platformRegistry, statsService, agentRegistry } = options;

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
}
