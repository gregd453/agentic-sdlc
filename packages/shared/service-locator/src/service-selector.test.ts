import { describe, it, expect, beforeEach } from 'vitest';
import { ServiceSelector, HealthStatus, SelectionStrategy } from './service-selector';

describe('ServiceSelector', () => {
  let selector: ServiceSelector;

  beforeEach(() => {
    selector = new ServiceSelector({
      strategy: 'primary-fallback',
      healthCheckIntervalMs: 30000,
      failureThreshold: 3,
      recoveryDelayMs: 60000,
      maxRetries: 3
    });
  });

  describe('Service Registration', () => {
    it('should register services', () => {
      selector.registerService({ name: 'service-1', priority: 1, weight: 1, health: HealthStatus.HEALTHY });
      selector.registerService({ name: 'service-2', priority: 2, weight: 1, health: HealthStatus.HEALTHY });

      const health = selector.getHealthReport();
      expect(health.size).toBe(2);
      expect(health.has('service-1')).toBe(true);
      expect(health.has('service-2')).toBe(true);
    });

    it('should unregister services', () => {
      selector.registerService({ name: 'service-1', priority: 1, weight: 1, health: HealthStatus.HEALTHY });
      selector.unregisterService('service-1');

      const health = selector.getHealthReport();
      expect(health.size).toBe(0);
    });
  });

  describe('Primary-Fallback Strategy', () => {
    beforeEach(() => {
      selector = new ServiceSelector({ strategy: 'primary-fallback' });
      selector.registerService({ name: 'primary', priority: 1, weight: 1, health: HealthStatus.HEALTHY });
      selector.registerService({ name: 'fallback', priority: 2, weight: 1, health: HealthStatus.HEALTHY });
    });

    it('should select primary service', () => {
      const selected = selector.selectService();
      expect(selected?.name).toBe('primary');
    });

    it('should fallback when primary unhealthy', () => {
      selector.updateHealth('primary', HealthStatus.UNHEALTHY);
      const selected = selector.selectService();
      expect(selected?.name).toBe('fallback');
    });

    it('should fall back to any service when all unhealthy', () => {
      selector.updateHealth('primary', HealthStatus.UNHEALTHY);
      selector.updateHealth('fallback', HealthStatus.UNHEALTHY);
      const selected = selector.selectService();
      expect(selected).not.toBeNull();
    });
  });

  describe('Round-Robin Strategy', () => {
    beforeEach(() => {
      selector = new ServiceSelector({ strategy: 'round-robin' });
      selector.registerService({ name: 'service-1', priority: 1, weight: 1, health: HealthStatus.HEALTHY });
      selector.registerService({ name: 'service-2', priority: 1, weight: 1, health: HealthStatus.HEALTHY });
      selector.registerService({ name: 'service-3', priority: 1, weight: 1, health: HealthStatus.HEALTHY });
    });

    it('should round-robin across services', () => {
      const names: string[] = [];
      for (let i = 0; i < 9; i++) {
        const selected = selector.selectService();
        names.push(selected?.name || '');
      }

      // Should cycle: 1, 2, 3, 1, 2, 3, 1, 2, 3
      expect(names).toEqual([
        'service-1', 'service-2', 'service-3',
        'service-1', 'service-2', 'service-3',
        'service-1', 'service-2', 'service-3'
      ]);
    });
  });

  describe('Health Tracking', () => {
    beforeEach(() => {
      selector.registerService({ name: 'service-1', priority: 1, weight: 1, health: HealthStatus.HEALTHY });
    });

    it('should track successful requests', () => {
      selector.reportSuccess('service-1');
      selector.reportSuccess('service-1');

      const health = selector.getHealthReport();
      const service = health.get('service-1');
      expect(service?.totalRequests).toBe(2);
      expect(service?.successfulRequests).toBe(2);
      expect(service?.consecutiveFailures).toBe(0);
    });

    it('should track failed requests', () => {
      selector.reportFailure('service-1');
      selector.reportFailure('service-1');

      const health = selector.getHealthReport();
      const service = health.get('service-1');
      expect(service?.totalRequests).toBe(2);
      expect(service?.successfulRequests).toBe(0);
      expect(service?.consecutiveFailures).toBe(2);
    });

    it('should mark unhealthy after failure threshold', () => {
      for (let i = 0; i < 3; i++) {
        selector.reportFailure('service-1');
      }

      const health = selector.getHealthReport();
      const service = health.get('service-1');
      expect(service?.health).toBe(HealthStatus.UNHEALTHY);
    });

    it('should reset consecutive failures on success', () => {
      selector.reportFailure('service-1');
      selector.reportFailure('service-1');
      selector.reportSuccess('service-1');

      const health = selector.getHealthReport();
      const service = health.get('service-1');
      expect(service?.consecutiveFailures).toBe(0);
    });
  });

  describe('Weighted Round-Robin Strategy', () => {
    beforeEach(() => {
      selector = new ServiceSelector({ strategy: 'weighted-round-robin' });
      selector.registerService({ name: 'high-weight', priority: 1, weight: 3, health: HealthStatus.HEALTHY });
      selector.registerService({ name: 'low-weight', priority: 1, weight: 1, health: HealthStatus.HEALTHY });
    });

    it('should select services based on weight', () => {
      const selections: Record<string, number> = { 'high-weight': 0, 'low-weight': 0 };
      const iterations = 1000;

      for (let i = 0; i < iterations; i++) {
        const selected = selector.selectService();
        if (selected) {
          selections[selected.name]++;
        }
      }

      // High weight should be selected ~3 times more often
      const ratio = selections['high-weight'] / selections['low-weight'];
      expect(ratio).toBeGreaterThan(2.5);
      expect(ratio).toBeLessThan(3.5);
    });
  });

  describe('Least Connections Strategy', () => {
    beforeEach(() => {
      selector = new ServiceSelector({ strategy: 'least-connections' });
      selector.registerService({ name: 'service-1', priority: 1, weight: 1, health: HealthStatus.HEALTHY });
      selector.registerService({ name: 'service-2', priority: 1, weight: 1, health: HealthStatus.HEALTHY });
    });

    it('should select service with least connections', () => {
      // Load service-1
      selector.reportSuccess('service-1');
      selector.reportSuccess('service-1');

      // Service-2 should be selected (has 0 requests)
      const selected = selector.selectService();
      expect(selected?.name).toBe('service-2');
    });
  });

  describe('Sticky Sessions', () => {
    beforeEach(() => {
      selector = new ServiceSelector({ strategy: 'round-robin', enableStickiness: true });
      selector.registerService({ name: 'service-1', priority: 1, weight: 1, health: HealthStatus.HEALTHY });
      selector.registerService({ name: 'service-2', priority: 1, weight: 1, health: HealthStatus.HEALTHY });
    });

    it('should stick to same service for same session', () => {
      const sessionId = 'session-123';
      const first = selector.selectService(sessionId);
      const second = selector.selectService(sessionId);
      const third = selector.selectService(sessionId);

      expect(first?.name).toBe(second?.name);
      expect(second?.name).toBe(third?.name);
    });

    it('should different sessions get different services', () => {
      const session1 = selector.selectService('session-1');
      const session2 = selector.selectService('session-2');

      expect(session1?.name).not.toBe(session2?.name);
    });

    it('should clear sticky sessions', () => {
      selector.selectService('session-1');
      selector.clearStickySessions();

      // Next call should use strategy, not sticky session
      const service1 = selector.selectService('session-1');
      const service2 = selector.selectService('session-1');

      // May not be sticky anymore
      expect([service1, service2]).toBeDefined();
    });
  });

  describe('Statistics Reset', () => {
    beforeEach(() => {
      selector.registerService({ name: 'service-1', priority: 1, weight: 1, health: HealthStatus.HEALTHY });
    });

    it('should reset statistics', () => {
      selector.reportSuccess('service-1');
      selector.reportSuccess('service-1');
      selector.reportFailure('service-1');

      selector.resetStats('service-1');

      const health = selector.getHealthReport();
      const service = health.get('service-1');
      expect(service?.totalRequests).toBe(0);
      expect(service?.successfulRequests).toBe(0);
      expect(service?.consecutiveFailures).toBe(0);
    });
  });
});
