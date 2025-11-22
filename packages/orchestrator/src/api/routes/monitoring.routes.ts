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
        let metrics;
        try {
          metrics = await eventAggregator.getMetrics();
        } catch (err) {
          logger.error('[MonitoringRoutes] Error calling getMetrics', { error: err });
          throw err;
        }

        if (!metrics) {
          logger.warn('[MonitoringRoutes] Metrics not yet available');
          reply.code(503).send({
            error: 'Service unavailable',
            message: 'Metrics aggregator is initializing'
          });
          return;
        }

        const duration = Date.now() - startTime;

        // Transform metrics to match frontend expectations
        const transformedMetrics = {
          timestamp: new Date().toISOString(),
          overview: {
            total_workflows: metrics?.overview?.total_workflows || 0,
            running: metrics?.overview?.running_workflows || 0,
            completed: metrics?.overview?.completed_workflows || 0,
            failed: metrics?.overview?.failed_workflows || 0,
            paused: metrics?.overview?.paused_workflows || 0,
            cancelled: 0, // Not in current metrics
            avg_completion_time_ms: metrics?.overview?.avg_completion_time_ms || 0,
            success_rate: metrics?.overview?.success_rate_percent || 100
          },
          agents: metrics?.agents || [],
          error_rate_percent: metrics?.overview?.error_rate_percent || 0,
          throughput_workflows_per_sec: (metrics?.throughput_per_minute || 0) / 60,
          avg_latency_ms: metrics?.latency_p50_ms || 0,
          p50_latency_ms: metrics?.latency_p50_ms || 0,
          p95_latency_ms: metrics?.latency_p95_ms || 0,
          p99_latency_ms: metrics?.latency_p99_ms || 0,
          active_workflows: metrics?.overview?.running_workflows || 0,
          agent_health: {} // TODO: Transform agent health data
        };

        // Set proper cache headers and wrap response to match schema
        reply
          .header('Cache-Control', 'no-cache, must-revalidate')
          .header('Content-Type', 'application/json')
          .code(200)
          .send({
            data: transformedMetrics,
            timestamp: new Date().toISOString(),
            ttl_ms: 5000  // Matches broadcast interval
          });

        logger.debug('[MonitoringRoutes] Metrics returned', {
          duration_ms: duration,
          total_workflows: transformedMetrics.overview.total_workflows
        });
      } catch (error) {
        logger.error('[MonitoringRoutes] Failed to get metrics', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        });

        reply.code(500).send({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Failed to fetch monitoring metrics'
        });
      }
    }
  });

  /**
   * GET /api/v1/monitoring/test
   * Test endpoint to verify monitoring is working
   */
  fastify.get('/api/v1/monitoring/test', {
    schema: {
      description: 'Test monitoring endpoint',
      tags: ['Monitoring'],
      response: {
        200: zodToJsonSchema(
          z.object({
            message: z.string(),
            timestamp: z.string().datetime()
          })
        )
      }
    },
    handler: async (
      _request: FastifyRequest,
      reply: FastifyReply
    ): Promise<void> => {
      reply.code(200).send({
        message: 'Monitoring test endpoint working',
        timestamp: new Date().toISOString()
      });
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
