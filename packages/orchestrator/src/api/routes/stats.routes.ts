import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { StatsService } from '../../services/stats.service';
import { logger } from '../../utils/logger';

export async function statsRoutes(
  fastify: FastifyInstance,
  options: { statsService: StatsService }
): Promise<void> {
  const { statsService } = options;

  // Get dashboard overview
  fastify.get('/api/v1/stats/overview', {
    schema: {
      response: {
        200: zodToJsonSchema(z.object({
          overview: z.object({
            total_workflows: z.number(),
            running_workflows: z.number(),
            completed_workflows: z.number(),
            failed_workflows: z.number(),
            paused_workflows: z.number()
          }),
          recent_workflows_count: z.number(),
          avg_completion_time_ms: z.number().nullable()
        }))
      }
    },
    handler: async (_request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      try {
        const overview = await statsService.getOverview();
        reply.code(200).send(overview);
      } catch (error) {
        logger.error('Failed to get dashboard overview', { error });
        reply.code(500).send({
          error: 'Internal server error'
        });
      }
    }
  });

  // Get agent performance stats
  fastify.get('/api/v1/stats/agents', {
    schema: {
      response: {
        200: zodToJsonSchema(z.array(z.object({
          agent_type: z.string(),
          total_tasks: z.number(),
          completed_tasks: z.number(),
          failed_tasks: z.number(),
          avg_duration_ms: z.number().nullable(),
          success_rate: z.number()
        })))
      }
    },
    handler: async (_request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      try {
        const stats = await statsService.getAgentPerformance();
        reply.code(200).send(stats);
      } catch (error) {
        logger.error('Failed to get agent stats', { error });
        reply.code(500).send({
          error: 'Internal server error'
        });
      }
    }
  });

  // Get time series data
  fastify.get('/api/v1/stats/timeseries', {
    schema: {
      querystring: zodToJsonSchema(z.object({
        period: z.enum(['1h', '24h', '7d', '30d']).optional()
      })),
      response: {
        200: zodToJsonSchema(z.array(z.object({
          timestamp: z.string(),
          workflows_created: z.number(),
          workflows_completed: z.number(),
          workflows_failed: z.number()
        }))),
        400: zodToJsonSchema(z.object({
          error: z.string()
        }))
      }
    },
    handler: async (
      request: FastifyRequest<{ Querystring: { period?: string } }>,
      reply: FastifyReply
    ): Promise<void> => {
      try {
        const period = request.query.period || '24h';
        const data = await statsService.getTimeSeries(period);
        reply.code(200).send(data);
      } catch (error: any) {
        if (error.message?.includes('Invalid period')) {
          reply.code(400).send({
            error: error.message
          });
        } else {
          logger.error('Failed to get time series data', { error });
          reply.code(500).send({
            error: 'Internal server error'
          });
        }
      }
    }
  });

  // Get workflow stats by type
  fastify.get('/api/v1/stats/workflows', {
    schema: {
      response: {
        200: zodToJsonSchema(z.record(z.string(), z.object({
          total: z.number(),
          completed: z.number(),
          failed: z.number(),
          success_rate: z.number()
        })))
      }
    },
    handler: async (_request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      try {
        const stats = await statsService.getWorkflowStats();
        reply.code(200).send(stats);
      } catch (error) {
        logger.error('Failed to get workflow stats', { error });
        reply.code(500).send({
          error: 'Internal server error'
        });
      }
    }
  });
}
