/**
 * Service Implementation Selector
 * Provides intelligent service selection strategies with failover and health tracking
 *
 * Features:
 * - Primary/fallback service selection
 * - Round-robin load balancing
 * - Health tracking with automatic fallback
 * - Service availability monitoring
 * - Configurable retry and timeout policies
 */

/**
 * Service health status
 */
export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
  UNKNOWN = 'unknown'
}

/**
 * Service instance with health information
 */
export interface ServiceInstance {
  name: string;
  priority: number; // Lower number = higher priority
  weight: number; // For weighted round-robin
  health: HealthStatus;
  lastHealthCheck: number; // Timestamp
  consecutiveFailures: number;
  totalRequests: number;
  successfulRequests: number;
}

/**
 * Selection strategy type
 */
export type SelectionStrategy = 'primary-fallback' | 'round-robin' | 'weighted-round-robin' | 'least-connections';

/**
 * Selector configuration
 */
export interface SelectorConfig {
  strategy: SelectionStrategy;
  healthCheckIntervalMs: number;
  failureThreshold: number; // Failures before marking unhealthy
  recoveryDelayMs: number; // Time before retrying unhealthy service
  maxRetries: number;
  enableStickiness: boolean; // Stick with same service for session
}

/**
 * Service selector for intelligent service selection
 */
export class ServiceSelector {
  private instances: Map<string, ServiceInstance> = new Map();
  private roundRobinIndex: number = 0;
  private stickySession: Map<string, string> = new Map(); // sessionId -> serviceName
  private config: SelectorConfig;
  private lastHealthCheckTime: number = 0;

  constructor(config: Partial<SelectorConfig> = {}) {
    this.config = {
      strategy: config.strategy || 'primary-fallback',
      healthCheckIntervalMs: config.healthCheckIntervalMs || 30000,
      failureThreshold: config.failureThreshold || 5,
      recoveryDelayMs: config.recoveryDelayMs || 60000,
      maxRetries: config.maxRetries || 3,
      enableStickiness: config.enableStickiness !== false
    };
  }

  /**
   * Register a service instance
   */
  registerService(instance: Omit<ServiceInstance, 'lastHealthCheck' | 'consecutiveFailures' | 'totalRequests' | 'successfulRequests'>): void {
    this.instances.set(instance.name, {
      ...instance,
      lastHealthCheck: Date.now(),
      consecutiveFailures: 0,
      totalRequests: 0,
      successfulRequests: 0
    });
  }

  /**
   * Unregister a service instance
   */
  unregisterService(serviceName: string): void {
    this.instances.delete(serviceName);
  }

  /**
   * Select a service based on configured strategy
   */
  selectService(sessionId?: string): ServiceInstance | null {
    const candidates = this.getHealthyServices();
    if (candidates.length === 0) {
      return this.selectFallbackService();
    }

    // Check sticky session
    if (sessionId && this.config.enableStickiness) {
      const stickyName = this.stickySession.get(sessionId);
      if (stickyName) {
        const stickyService = this.instances.get(stickyName);
        if (stickyService && stickyService.health !== HealthStatus.UNHEALTHY) {
          return stickyService;
        }
      }
    }

    let selected: ServiceInstance | null = null;

    switch (this.config.strategy) {
      case 'primary-fallback':
        selected = this.selectByPriority(candidates);
        break;
      case 'round-robin':
        selected = this.selectRoundRobin(candidates);
        break;
      case 'weighted-round-robin':
        selected = this.selectWeightedRoundRobin(candidates);
        break;
      case 'least-connections':
        selected = this.selectLeastConnections(candidates);
        break;
      default:
        selected = candidates[0];
    }

    // Store sticky session
    if (selected && sessionId && this.config.enableStickiness) {
      this.stickySession.set(sessionId, selected.name);
    }

    return selected;
  }

  /**
   * Report successful service request
   */
  reportSuccess(serviceName: string): void {
    const instance = this.instances.get(serviceName);
    if (instance) {
      instance.totalRequests++;
      instance.successfulRequests++;
      instance.consecutiveFailures = 0;

      // Update health if was degraded
      if (instance.health === HealthStatus.DEGRADED) {
        instance.health = HealthStatus.HEALTHY;
      }
    }
  }

  /**
   * Report failed service request
   */
  reportFailure(serviceName: string): void {
    const instance = this.instances.get(serviceName);
    if (instance) {
      instance.totalRequests++;
      instance.consecutiveFailures++;

      if (instance.consecutiveFailures >= this.config.failureThreshold) {
        instance.health = HealthStatus.UNHEALTHY;
      } else if (instance.consecutiveFailures > 0) {
        instance.health = HealthStatus.DEGRADED;
      }
    }
  }

  /**
   * Update service health status
   */
  updateHealth(serviceName: string, health: HealthStatus): void {
    const instance = this.instances.get(serviceName);
    if (instance) {
      instance.health = health;
      instance.lastHealthCheck = Date.now();
      if (health === HealthStatus.HEALTHY) {
        instance.consecutiveFailures = 0;
      }
    }
  }

  /**
   * Get health information for all services
   */
  getHealthReport(): Map<string, ServiceInstance> {
    // Check for services that can recover
    const now = Date.now();
    for (const [, instance] of this.instances) {
      if (instance.health === HealthStatus.UNHEALTHY) {
        const timeSinceLastCheck = now - instance.lastHealthCheck;
        if (timeSinceLastCheck > this.config.recoveryDelayMs) {
          // Reset and mark as unknown for re-evaluation
          instance.health = HealthStatus.UNKNOWN;
          instance.consecutiveFailures = Math.max(0, instance.consecutiveFailures - 1);
        }
      }
    }

    return new Map(this.instances);
  }

  /**
   * Get healthy services
   */
  private getHealthyServices(): ServiceInstance[] {
    return Array.from(this.instances.values()).filter(
      i => i.health === HealthStatus.HEALTHY || i.health === HealthStatus.UNKNOWN
    );
  }

  /**
   * Select fallback service (any available, prioritize least failed)
   */
  private selectFallbackService(): ServiceInstance | null {
    const allServices = Array.from(this.instances.values());
    if (allServices.length === 0) return null;

    return allServices.reduce((best, current) => {
      const currentFailureRate = current.totalRequests > 0
        ? 1 - (current.successfulRequests / current.totalRequests)
        : 0;
      const bestFailureRate = best.totalRequests > 0
        ? 1 - (best.successfulRequests / best.totalRequests)
        : 0;

      return currentFailureRate < bestFailureRate ? current : best;
    });
  }

  /**
   * Select by priority (primary-fallback)
   */
  private selectByPriority(candidates: ServiceInstance[]): ServiceInstance {
    return candidates.reduce((best, current) =>
      current.priority < best.priority ? current : best
    );
  }

  /**
   * Select using round-robin
   */
  private selectRoundRobin(candidates: ServiceInstance[]): ServiceInstance {
    if (candidates.length === 0) {
      throw new Error('No healthy services available');
    }

    const selected = candidates[this.roundRobinIndex % candidates.length];
    this.roundRobinIndex++;
    return selected;
  }

  /**
   * Select using weighted round-robin
   */
  private selectWeightedRoundRobin(candidates: ServiceInstance[]): ServiceInstance {
    const totalWeight = candidates.reduce((sum, c) => sum + c.weight, 0);
    if (totalWeight === 0) {
      return candidates[0];
    }

    let random = Math.random() * totalWeight;
    for (const candidate of candidates) {
      random -= candidate.weight;
      if (random <= 0) {
        return candidate;
      }
    }

    return candidates[candidates.length - 1];
  }

  /**
   * Select least connections (based on total requests)
   */
  private selectLeastConnections(candidates: ServiceInstance[]): ServiceInstance {
    return candidates.reduce((least, current) =>
      current.totalRequests < least.totalRequests ? current : least
    );
  }

  /**
   * Reset statistics for a service
   */
  resetStats(serviceName: string): void {
    const instance = this.instances.get(serviceName);
    if (instance) {
      instance.totalRequests = 0;
      instance.successfulRequests = 0;
      instance.consecutiveFailures = 0;
      instance.health = HealthStatus.UNKNOWN;
    }
  }

  /**
   * Clear sticky sessions
   */
  clearStickySessions(): void {
    this.stickySession.clear();
  }
}

/**
 * Selector error
 */
export class SelectorError extends Error {
  constructor(message: string, public readonly serviceName?: string) {
    super(message);
    this.name = 'SelectorError';
  }
}
