/**
 * Monitoring Routes
 * Session #88: Real-time metrics endpoints
 *
 * Provides REST endpoints for monitoring dashboard to fetch real-time metrics.
 * Includes fallback HTTP endpoint for clients unable to use WebSocket.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { IEventAggregator } from '../../hexagonal/ports/event-aggregator.port';
import { RealtimeMetricsSchema } from '@agentic-sdlc/shared-types';
import { logger } from '../../utils/logger';

export async function monitoringRoutes(
  fastify: FastifyInstance,
  options: { eventAggregator: IEventAggregator }
): Promise<void> {
  const { eventAggregator } = options;

  /**
   * GET /api/v1/monitoring/metrics/realtime
   *
   * Returns current real-time metrics from the event aggregator.
   * This is a fallback endpoint for clients unable to use WebSocket.
   *
   * Response time target: <50ms (metrics served from Redis cache)
   */
  fastify.get('/api/v1/monitoring/metrics/realtime', {
    schema: {
      description: 'Get current real-time monitoring metrics',
      tags: ['Monitoring'],
      response: {
        200: zodToJsonSchema(
          z.object({
            data: RealtimeMetricsSchema,
            timestamp: z.string().datetime(),
            ttl_ms: z.number().int()
          })
        ),
        503: zodToJsonSchema(
          z.object({
            error: z.string(),
            message: z.string()
          })
        )
      }
    },
    handler: async (
      _request: FastifyRequest,
      reply: FastifyReply
    ): Promise<void> => {
      const startTime = Date.now();

      try {
        logger.debug('[MonitoringRoutes] Fetching realtime metrics');

        // Fetch metrics from event aggregator (cached in Redis)
        const metrics = await eventAggregator.getMetrics();

        if (!metrics) {
          logger.warn('[MonitoringRoutes] Metrics not yet available');
          reply.code(503).send({
            error: 'Service unavailable',
            message: 'Metrics aggregator is initializing'
          });
          return;
        }

        const duration = Date.now() - startTime;

        // Build response with cache TTL
        const response = {
          data: metrics,
          timestamp: new Date().toISOString(),
          ttl_ms: 5000 // Metrics cache expires in 5 seconds
        };

        // Set proper cache headers
        reply
          .header('Cache-Control', 'no-cache, must-revalidate')
          .header('Content-Type', 'application/json')
          .code(200)
          .send(response);

        logger.debug('[MonitoringRoutes] Metrics returned', {
          duration_ms: duration,
          total_workflows: metrics.overview.total_workflows
        });
      } catch (error) {
        logger.error('[MonitoringRoutes] Failed to get metrics', {
          error: error instanceof Error ? error.message : String(error)
        });

        reply.code(500).send({
          error: 'Internal server error',
          message: 'Failed to fetch monitoring metrics'
        });
      }
    }
  });

  /**
   * GET /api/v1/monitoring/health
   *
   * Health check endpoint for monitoring system.
   * Verifies EventAggregator is operational.
   */
  fastify.get('/api/v1/monitoring/health', {
    schema: {
      description: 'Check monitoring system health',
      tags: ['Monitoring'],
      response: {
        200: zodToJsonSchema(
          z.object({
            healthy: z.boolean(),
            aggregator_ready: z.boolean(),
            timestamp: z.string().datetime()
          })
        )
      }
    },
    handler: async (
      _request: FastifyRequest,
      reply: FastifyReply
    ): Promise<void> => {
      try {
        logger.debug('[MonitoringRoutes] Health check');

        const aggregatorHealthy = await eventAggregator.isHealthy();

        const response = {
          healthy: aggregatorHealthy,
          aggregator_ready: aggregatorHealthy,
          timestamp: new Date().toISOString()
        };

        reply.code(200).send(response);

        if (!aggregatorHealthy) {
          logger.warn('[MonitoringRoutes] Aggregator not healthy');
        }
      } catch (error) {
        logger.error('[MonitoringRoutes] Health check failed', {
          error: error instanceof Error ? error.message : String(error)
        });

        reply.code(500).send({
          healthy: false,
          aggregator_ready: false,
          timestamp: new Date().toISOString()
        });
      }
    }
  });

  /**
   * GET /api/v1/monitoring/status
   *
   * Get current monitoring system status and statistics.
   */
  fastify.get('/api/v1/monitoring/status', {
    schema: {
      description: 'Get monitoring system status',
      tags: ['Monitoring'],
      response: {
        200: zodToJsonSchema(
          z.object({
            status: z.enum(['running', 'initializing', 'error']),
            metrics_available: z.boolean(),
            last_update: z.string().datetime().optional(),
            timestamp: z.string().datetime()
          })
        )
      }
    },
    handler: async (
      _request: FastifyRequest,
      reply: FastifyReply
    ): Promise<void> => {
      try {
        logger.debug('[MonitoringRoutes] Status check');

        const metrics = await eventAggregator.getMetrics();
        const isHealthy = await eventAggregator.isHealthy();

        const response = {
          status: isHealthy ? 'running' : 'initializing',
          metrics_available: metrics !== null,
          last_update: metrics?.last_update,
          timestamp: new Date().toISOString()
        };

        reply.code(200).send(response);
      } catch (error) {
        logger.error('[MonitoringRoutes] Status check failed', {
          error: error instanceof Error ? error.message : String(error)
        });

        reply.code(500).send({
          status: 'error',
          metrics_available: false,
          timestamp: new Date().toISOString()
        });
      }
    }
  });

  logger.info('[MonitoringRoutes] Routes registered');
}
