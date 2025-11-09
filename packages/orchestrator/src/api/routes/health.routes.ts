import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { HealthCheckService, HealthStatus } from '../../services/health-check.service';

/**
 * Health Check Routes
 *
 * Endpoints:
 * - GET /health - Basic liveness probe
 * - GET /health/ready - Readiness probe with dependency checks
 * - GET /health/detailed - Detailed system status
 */

export interface HealthRoutesOptions extends FastifyPluginOptions {
  healthCheckService: HealthCheckService;
}

export async function healthRoutes(
  fastify: FastifyInstance,
  options: HealthRoutesOptions
): Promise<void> {
  const { healthCheckService } = options;

  /**
   * Basic Liveness Probe
   * Returns 200 if service is running
   */
  fastify.get('/health', {
    schema: {
      tags: ['health'],
      summary: 'Basic liveness check',
      description: 'Returns OK if the service is running. Suitable for Kubernetes liveness probes.',
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'] },
            timestamp: { type: 'string', format: 'date-time' }
          }
        }
      }
    }
  }, async (_request, reply) => {
    const health = await healthCheckService.checkLiveness();
    reply.code(200).send(health);
  });

  /**
   * Readiness Probe
   * Checks all dependencies and returns appropriate status
   */
  fastify.get('/health/ready', {
    schema: {
      tags: ['health'],
      summary: 'Readiness check with dependencies',
      description: 'Verifies all critical dependencies (database, Redis, agents) are available. Suitable for Kubernetes readiness probes.',
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'] },
            version: { type: 'string' },
            uptime: { type: 'number' },
            timestamp: { type: 'string', format: 'date-time' },
            components: {
              type: 'object',
              properties: {
                database: {
                  type: 'object',
                  properties: {
                    status: { type: 'string' },
                    message: { type: 'string' },
                    timestamp: { type: 'string' },
                    responseTime: { type: 'number' }
                  }
                },
                redis: {
                  type: 'object',
                  properties: {
                    status: { type: 'string' },
                    message: { type: 'string' },
                    timestamp: { type: 'string' },
                    responseTime: { type: 'number' }
                  }
                },
                agents: {
                  type: 'object',
                  properties: {
                    status: { type: 'string' },
                    message: { type: 'string' },
                    timestamp: { type: 'string' },
                    responseTime: { type: 'number' }
                  }
                }
              }
            }
          }
        },
        503: {
          type: 'object',
          description: 'Service unavailable - one or more dependencies are unhealthy'
        }
      }
    }
  }, async (_request, reply) => {
    const health = await healthCheckService.checkReadiness();

    // Return 503 if unhealthy (for load balancers/orchestrators)
    const statusCode = health.status === HealthStatus.UNHEALTHY ? 503 : 200;

    reply.code(statusCode).send(health);
  });

  /**
   * Detailed Health Check
   * Includes full system status, metrics, and resource usage
   */
  fastify.get('/health/detailed', {
    schema: {
      tags: ['health'],
      summary: 'Detailed system health',
      description: 'Returns comprehensive system status including all dependencies, resource usage, and metrics.',
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'] },
            version: { type: 'string' },
            uptime: { type: 'number' },
            timestamp: { type: 'string', format: 'date-time' },
            environment: { type: 'string' },
            pid: { type: 'number' },
            memory: {
              type: 'object',
              properties: {
                heapUsed: { type: 'number' },
                heapTotal: { type: 'number' },
                rss: { type: 'number' },
                external: { type: 'number' }
              }
            },
            cpu: {
              type: 'object',
              properties: {
                user: { type: 'number' },
                system: { type: 'number' }
              }
            },
            components: {
              type: 'object',
              additionalProperties: true
            }
          }
        },
        503: {
          type: 'object',
          description: 'Service unavailable - one or more dependencies are unhealthy'
        }
      }
    }
  }, async (_request, reply) => {
    const health = await healthCheckService.checkDetailed();

    // Return 503 if unhealthy (for load balancers/orchestrators)
    const statusCode = health.status === HealthStatus.UNHEALTHY ? 503 : 200;

    reply.code(statusCode).send(health);
  });
}
