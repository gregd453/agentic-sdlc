import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { healthRoutes } from '../../../src/api/routes/health.routes';
import { HealthCheckService, HealthStatus } from '../../../src/services/health-check.service';

describe('Health Routes', () => {
  let app: any;
  let healthCheckService: HealthCheckService;

  beforeEach(async () => {
    // Create mock health check service
    healthCheckService = {
      checkLiveness: vi.fn(),
      checkReadiness: vi.fn(),
      checkDetailed: vi.fn(),
      getUptime: vi.fn()
    } as any;

    // Create Fastify app
    app = Fastify();
    await app.register(healthRoutes, { healthCheckService });
  });

  describe('GET /health', () => {
    it('should return 200 with healthy status', async () => {
      vi.mocked(healthCheckService.checkLiveness).mockResolvedValue({
        status: HealthStatus.HEALTHY,
        timestamp: new Date().toISOString()
      });

      const response = await app.inject({
        method: 'GET',
        url: '/health'
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({
        status: HealthStatus.HEALTHY,
        timestamp: expect.any(String)
      });
    });

    it('should call healthCheckService.checkLiveness', async () => {
      vi.mocked(healthCheckService.checkLiveness).mockResolvedValue({
        status: HealthStatus.HEALTHY,
        timestamp: new Date().toISOString()
      });

      await app.inject({
        method: 'GET',
        url: '/health'
      });

      expect(healthCheckService.checkLiveness).toHaveBeenCalled();
    });
  });

  describe('GET /health/ready', () => {
    it('should return 200 when all dependencies are healthy', async () => {
      vi.mocked(healthCheckService.checkReadiness).mockResolvedValue({
        status: HealthStatus.HEALTHY,
        version: '0.1.0',
        uptime: 1000,
        timestamp: new Date().toISOString(),
        components: {
          database: {
            status: HealthStatus.HEALTHY,
            message: 'OK',
            timestamp: new Date().toISOString(),
            responseTime: 10
          },
          redis: {
            status: HealthStatus.HEALTHY,
            message: 'OK',
            timestamp: new Date().toISOString(),
            responseTime: 5
          },
          agents: {
            status: HealthStatus.HEALTHY,
            message: '2 agents registered',
            timestamp: new Date().toISOString(),
            responseTime: 3
          }
        }
      });

      const response = await app.inject({
        method: 'GET',
        url: '/health/ready'
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe(HealthStatus.HEALTHY);
      expect(body.components.database).toBeDefined();
      expect(body.components.redis).toBeDefined();
      expect(body.components.agents).toBeDefined();
    });

    it('should return 503 when any dependency is unhealthy', async () => {
      vi.mocked(healthCheckService.checkReadiness).mockResolvedValue({
        status: HealthStatus.UNHEALTHY,
        version: '0.1.0',
        uptime: 1000,
        timestamp: new Date().toISOString(),
        components: {
          database: {
            status: HealthStatus.UNHEALTHY,
            message: 'Connection failed',
            timestamp: new Date().toISOString(),
            responseTime: 100
          }
        }
      });

      const response = await app.inject({
        method: 'GET',
        url: '/health/ready'
      });

      expect(response.statusCode).toBe(503);
      expect(healthCheckService.checkReadiness).toHaveBeenCalled();
    });

    it('should return 200 when dependencies are degraded', async () => {
      vi.mocked(healthCheckService.checkReadiness).mockResolvedValue({
        status: HealthStatus.DEGRADED,
        version: '0.1.0',
        uptime: 1000,
        timestamp: new Date().toISOString(),
        components: {
          agents: {
            status: HealthStatus.DEGRADED,
            message: '0 agents registered',
            timestamp: new Date().toISOString(),
            responseTime: 3
          }
        }
      });

      const response = await app.inject({
        method: 'GET',
        url: '/health/ready'
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe(HealthStatus.DEGRADED);
    });
  });

  describe('GET /health/detailed', () => {
    it('should return detailed system health including metrics', async () => {
      vi.mocked(healthCheckService.checkDetailed).mockResolvedValue({
        status: HealthStatus.HEALTHY,
        version: '0.1.0',
        uptime: 1000,
        timestamp: new Date().toISOString(),
        environment: 'test',
        pid: 12345,
        memory: {
          heapUsed: 1000000,
          heapTotal: 2000000,
          rss: 3000000,
          external: 100000
        },
        cpu: {
          user: 500000,
          system: 100000
        },
        components: {
          database: {
            status: HealthStatus.HEALTHY,
            message: 'OK',
            timestamp: new Date().toISOString(),
            responseTime: 10
          },
          redis: {
            status: HealthStatus.HEALTHY,
            message: 'OK',
            timestamp: new Date().toISOString(),
            responseTime: 5
          },
          agents: {
            status: HealthStatus.HEALTHY,
            message: '2 agents',
            timestamp: new Date().toISOString(),
            responseTime: 3
          },
          filesystem: {
            status: HealthStatus.HEALTHY,
            message: 'OK',
            timestamp: new Date().toISOString(),
            responseTime: 2
          }
        }
      });

      const response = await app.inject({
        method: 'GET',
        url: '/health/detailed'
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe(HealthStatus.HEALTHY);
      expect(body.environment).toBe('test');
      expect(body.pid).toBe(12345);
      expect(body.memory).toBeDefined();
      expect(body.cpu).toBeDefined();
      expect(body.components.database).toBeDefined();
      expect(body.components.redis).toBeDefined();
      expect(body.components.agents).toBeDefined();
      expect(body.components.filesystem).toBeDefined();
    });

    it('should return 503 when system is unhealthy', async () => {
      vi.mocked(healthCheckService.checkDetailed).mockResolvedValue({
        status: HealthStatus.UNHEALTHY,
        version: '0.1.0',
        uptime: 1000,
        timestamp: new Date().toISOString(),
        environment: 'test',
        pid: 12345,
        memory: {
          heapUsed: 1000000,
          heapTotal: 2000000,
          rss: 3000000,
          external: 100000
        },
        cpu: {
          user: 500000,
          system: 100000
        },
        components: {
          database: {
            status: HealthStatus.UNHEALTHY,
            message: 'Failed',
            timestamp: new Date().toISOString(),
            responseTime: 100
          }
        }
      });

      const response = await app.inject({
        method: 'GET',
        url: '/health/detailed'
      });

      expect(response.statusCode).toBe(503);
    });
  });
});
