import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { EventBus } from '../../src/events/event-bus';
import { AgentDispatcherService } from '../../src/services/agent-dispatcher.service';
import { HealthCheckService, HealthStatus } from '../../src/services/health-check.service';

describe('HealthCheckService', () => {
  let prisma: PrismaClient;
  let eventBus: EventBus;
  let agentDispatcher: AgentDispatcherService;
  let healthCheckService: HealthCheckService;

  beforeEach(() => {
    // Create mock instances
    prisma = {
      $queryRaw: vi.fn()
    } as any;

    eventBus = {
      ping: vi.fn()
    } as any;

    agentDispatcher = {
      getRegisteredAgents: vi.fn()
    } as any;

    healthCheckService = new HealthCheckService(prisma, eventBus, agentDispatcher);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('checkLiveness', () => {
    it('should return healthy status', async () => {
      const result = await healthCheckService.checkLiveness();

      expect(result.status).toBe(HealthStatus.HEALTHY);
      expect(result.timestamp).toBeDefined();
      expect(new Date(result.timestamp)).toBeInstanceOf(Date);
    });

    it('should return current timestamp', async () => {
      const before = new Date();
      const result = await healthCheckService.checkLiveness();
      const after = new Date();

      const timestamp = new Date(result.timestamp);
      expect(timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('checkReadiness', () => {
    it('should return healthy when all components are healthy', async () => {
      // Mock all dependencies as healthy
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ result: 1 }]);
      vi.mocked(eventBus.ping).mockResolvedValue(true);
      vi.mocked(agentDispatcher.getRegisteredAgents).mockResolvedValue([
        { agent_id: 'agent-1', type: 'scaffold' }
      ]);

      const result = await healthCheckService.checkReadiness();

      expect(result.status).toBe(HealthStatus.HEALTHY);
      expect(result.version).toBeDefined();
      expect(result.uptime).toBeGreaterThanOrEqual(0);
      expect(result.timestamp).toBeDefined();
      expect(result.components.database).toBeDefined();
      expect(result.components.redis).toBeDefined();
      expect(result.components.agents).toBeDefined();
    });

    it('should return unhealthy when database fails', async () => {
      vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error('Connection refused'));
      vi.mocked(eventBus.ping).mockResolvedValue(true);
      vi.mocked(agentDispatcher.getRegisteredAgents).mockResolvedValue([]);

      const result = await healthCheckService.checkReadiness();

      expect(result.status).toBe(HealthStatus.UNHEALTHY);
      expect(result.components.database?.status).toBe(HealthStatus.UNHEALTHY);
      expect(result.components.database?.message).toContain('Connection refused');
    });

    it('should return unhealthy when redis fails', async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ result: 1 }]);
      vi.mocked(eventBus.ping).mockResolvedValue(false);
      vi.mocked(agentDispatcher.getRegisteredAgents).mockResolvedValue([]);

      const result = await healthCheckService.checkReadiness();

      expect(result.status).toBe(HealthStatus.DEGRADED);
      expect(result.components.redis?.status).toBe(HealthStatus.DEGRADED);
    });

    it('should return degraded when no agents are registered', async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ result: 1 }]);
      vi.mocked(eventBus.ping).mockResolvedValue(true);
      vi.mocked(agentDispatcher.getRegisteredAgents).mockResolvedValue([]);

      const result = await healthCheckService.checkReadiness();

      expect(result.status).toBe(HealthStatus.DEGRADED);
      expect(result.components.agents?.status).toBe(HealthStatus.DEGRADED);
      expect(result.components.agents?.message).toContain('0 agent(s) registered');
    });

    it('should include response times for all components', async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ result: 1 }]);
      vi.mocked(eventBus.ping).mockResolvedValue(true);
      vi.mocked(agentDispatcher.getRegisteredAgents).mockResolvedValue([
        { agent_id: 'agent-1', type: 'scaffold' }
      ]);

      const result = await healthCheckService.checkReadiness();

      expect(result.components.database?.responseTime).toBeGreaterThanOrEqual(0);
      expect(result.components.redis?.responseTime).toBeGreaterThanOrEqual(0);
      expect(result.components.agents?.responseTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('checkDetailed', () => {
    it('should include all readiness checks plus system metrics', async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ result: 1 }]);
      vi.mocked(eventBus.ping).mockResolvedValue(true);
      vi.mocked(agentDispatcher.getRegisteredAgents).mockResolvedValue([]);

      const result = await healthCheckService.checkDetailed();

      // Readiness components
      expect(result.components.database).toBeDefined();
      expect(result.components.redis).toBeDefined();
      expect(result.components.agents).toBeDefined();
      expect(result.components.filesystem).toBeDefined();

      // System metrics
      expect(result.environment).toBeDefined();
      expect(result.pid).toBe(process.pid);
      expect(result.memory).toBeDefined();
      expect(result.memory.heapUsed).toBeGreaterThan(0);
      expect(result.memory.heapTotal).toBeGreaterThan(0);
      expect(result.memory.rss).toBeGreaterThan(0);
      expect(result.cpu).toBeDefined();
      expect(result.cpu.user).toBeGreaterThanOrEqual(0);
      expect(result.cpu.system).toBeGreaterThanOrEqual(0);
    });

    it('should check filesystem health', async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ result: 1 }]);
      vi.mocked(eventBus.ping).mockResolvedValue(true);
      vi.mocked(agentDispatcher.getRegisteredAgents).mockResolvedValue([]);

      const result = await healthCheckService.checkDetailed();

      expect(result.components.filesystem).toBeDefined();
      expect(result.components.filesystem?.status).toBe(HealthStatus.HEALTHY);
      expect(result.components.filesystem?.message).toContain('Filesystem access OK');
    });
  });

  describe('database health check', () => {
    it('should mark as healthy when response time < 100ms', async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ result: 1 }]);
      vi.mocked(eventBus.ping).mockResolvedValue(true);
      vi.mocked(agentDispatcher.getRegisteredAgents).mockResolvedValue([]);

      const result = await healthCheckService.checkReadiness();

      expect(result.components.database?.status).toBe(HealthStatus.HEALTHY);
    });

    it('should include database type in details', async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ result: 1 }]);
      vi.mocked(eventBus.ping).mockResolvedValue(true);
      vi.mocked(agentDispatcher.getRegisteredAgents).mockResolvedValue([]);

      const result = await healthCheckService.checkReadiness();

      expect(result.components.database?.details?.type).toBe('PostgreSQL');
    });
  });

  describe('redis health check', () => {
    it('should mark as healthy when ping succeeds and response time < 50ms', async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ result: 1 }]);
      vi.mocked(eventBus.ping).mockResolvedValue(true);
      vi.mocked(agentDispatcher.getRegisteredAgents).mockResolvedValue([]);

      const result = await healthCheckService.checkReadiness();

      expect(result.components.redis?.status).toBe(HealthStatus.HEALTHY);
    });

    it('should include Redis type in details', async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ result: 1 }]);
      vi.mocked(eventBus.ping).mockResolvedValue(true);
      vi.mocked(agentDispatcher.getRegisteredAgents).mockResolvedValue([]);

      const result = await healthCheckService.checkReadiness();

      expect(result.components.redis?.details?.type).toBe('Redis');
    });

    it('should handle ping returning false', async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ result: 1 }]);
      vi.mocked(eventBus.ping).mockResolvedValue(false);
      vi.mocked(agentDispatcher.getRegisteredAgents).mockResolvedValue([]);

      const result = await healthCheckService.checkReadiness();

      expect(result.components.redis?.status).toBe(HealthStatus.DEGRADED);
    });
  });

  describe('agents health check', () => {
    it('should include agent count in message', async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ result: 1 }]);
      vi.mocked(eventBus.ping).mockResolvedValue(true);
      vi.mocked(agentDispatcher.getRegisteredAgents).mockResolvedValue([
        { agent_id: 'agent-1', type: 'scaffold' },
        { agent_id: 'agent-2', type: 'validation' }
      ]);

      const result = await healthCheckService.checkReadiness();

      expect(result.components.agents?.message).toContain('2 agent(s) registered');
      expect(result.components.agents?.details?.registeredAgents).toBe(2);
    });

    it('should include agent list in details', async () => {
      const agents = [
        { agent_id: 'agent-1', type: 'scaffold' },
        { agent_id: 'agent-2', type: 'validation' }
      ];

      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ result: 1 }]);
      vi.mocked(eventBus.ping).mockResolvedValue(true);
      vi.mocked(agentDispatcher.getRegisteredAgents).mockResolvedValue(agents);

      const result = await healthCheckService.checkReadiness();

      expect(result.components.agents?.details?.agents).toEqual(agents);
    });
  });

  describe('getUptime', () => {
    it('should return uptime in seconds', async () => {
      // Wait a bit to ensure uptime > 0
      await new Promise(resolve => setTimeout(resolve, 10));

      const uptime = healthCheckService.getUptime();

      expect(uptime).toBeGreaterThanOrEqual(0);
    });
  });
});
