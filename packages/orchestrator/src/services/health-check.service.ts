import { PrismaClient } from '@prisma/client';
import { EventBus } from '../events/event-bus';
// Phase 2: AgentDispatcherService removed - agent health checks will be reimplemented via message bus
import { logger } from '../utils/logger';
import { existsSync, accessSync, constants } from 'fs';
import { tmpdir } from 'os';

/**
 * Health Check Status
 */
export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy'
}

/**
 * Individual Component Health
 */
export interface ComponentHealth {
  status: HealthStatus;
  message?: string;
  timestamp: string;
  responseTime?: number;
  details?: Record<string, unknown>;
}

/**
 * Overall System Health
 */
export interface SystemHealth {
  status: HealthStatus;
  version: string;
  uptime: number;
  timestamp: string;
  components: {
    database?: ComponentHealth;
    redis?: ComponentHealth;
    agents?: ComponentHealth;
    filesystem?: ComponentHealth;
  };
}

/**
 * Detailed Health Report
 */
export interface DetailedHealthReport extends SystemHealth {
  environment: string;
  pid: number;
  memory: {
    heapUsed: number;
    heapTotal: number;
    rss: number;
    external: number;
  };
  cpu: {
    user: number;
    system: number;
  };
}

/**
 * Health Check Service
 *
 * Provides comprehensive health checks for all system dependencies:
 * - Database (PostgreSQL via Prisma)
 * - Redis (Event bus)
 * - Agent registry
 * - File system
 */
export class HealthCheckService {
  private readonly startTime: number;
  private readonly version: string;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly eventBus: EventBus
    // Phase 2: agentDispatcher parameter removed
  ) {
    this.startTime = Date.now();
    this.version = process.env.npm_package_version || '0.1.0';
  }

  /**
   * Basic liveness check
   * Returns OK if the service is running
   */
  async checkLiveness(): Promise<{ status: HealthStatus; timestamp: string }> {
    return {
      status: HealthStatus.HEALTHY,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Readiness check
   * Verifies all critical dependencies are available
   */
  async checkReadiness(): Promise<SystemHealth> {
    const startTime = Date.now();

    const [database, redis, agents] = await Promise.allSettled([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkAgents()
    ]);

    const components = {
      database: database.status === 'fulfilled' ? database.value : this.createUnhealthyComponent(database.reason),
      redis: redis.status === 'fulfilled' ? redis.value : this.createUnhealthyComponent(redis.reason),
      agents: agents.status === 'fulfilled' ? agents.value : this.createUnhealthyComponent(agents.reason)
    };

    // Determine overall status
    const statuses = Object.values(components).map(c => c.status);
    const overallStatus = this.determineOverallStatus(statuses);

    const health: SystemHealth = {
      status: overallStatus,
      version: this.version,
      uptime: Date.now() - this.startTime,
      timestamp: new Date().toISOString(),
      components
    };

    const duration = Date.now() - startTime;
    logger.info('Readiness check completed', { status: overallStatus, duration });

    return health;
  }

  /**
   * Detailed health check
   * Includes all dependency checks plus system metrics
   */
  async checkDetailed(): Promise<DetailedHealthReport> {
    const readiness = await this.checkReadiness();
    const filesystem = await this.checkFilesystem();

    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    const detailed: DetailedHealthReport = {
      ...readiness,
      components: {
        ...readiness.components,
        filesystem
      },
      environment: process.env.NODE_ENV || 'development',
      pid: process.pid,
      memory: {
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        rss: memoryUsage.rss,
        external: memoryUsage.external
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      }
    };

    return detailed;
  }

  /**
   * Check database connectivity
   */
  private async checkDatabase(): Promise<ComponentHealth> {
    const start = Date.now();

    try {
      // Simple query to verify connectivity
      await this.prisma.$queryRaw`SELECT 1`;

      const responseTime = Date.now() - start;

      return {
        status: responseTime < 100 ? HealthStatus.HEALTHY : HealthStatus.DEGRADED,
        message: 'Database connection OK',
        timestamp: new Date().toISOString(),
        responseTime,
        details: {
          type: 'PostgreSQL',
          responseTimeThreshold: 100
        }
      };
    } catch (error) {
      const responseTime = Date.now() - start;
      logger.error('Database health check failed', { error });

      return {
        status: HealthStatus.UNHEALTHY,
        message: error instanceof Error ? error.message : 'Database connection failed',
        timestamp: new Date().toISOString(),
        responseTime
      };
    }
  }

  /**
   * Check Redis connectivity
   */
  private async checkRedis(): Promise<ComponentHealth> {
    const start = Date.now();

    try {
      // Ping Redis to verify connectivity
      const pingResult = await this.eventBus.ping();

      const responseTime = Date.now() - start;

      return {
        status: pingResult && responseTime < 50 ? HealthStatus.HEALTHY : HealthStatus.DEGRADED,
        message: 'Redis connection OK',
        timestamp: new Date().toISOString(),
        responseTime,
        details: {
          type: 'Redis',
          responseTimeThreshold: 50
        }
      };
    } catch (error) {
      const responseTime = Date.now() - start;
      logger.error('Redis health check failed', { error });

      return {
        status: HealthStatus.UNHEALTHY,
        message: error instanceof Error ? error.message : 'Redis connection failed',
        timestamp: new Date().toISOString(),
        responseTime
      };
    }
  }

  /**
   * Check agent registry
   * Phase 2: Temporarily disabled - will be reimplemented via message bus
   */
  private async checkAgents(): Promise<ComponentHealth> {
    const start = Date.now();
    const responseTime = Date.now() - start;

    // Phase 2: Agent health check temporarily disabled
    // Will be reimplemented to use message bus health checks
    return {
      status: HealthStatus.DEGRADED,
      message: 'Agent health check temporarily disabled (Phase 2 migration)',
      timestamp: new Date().toISOString(),
      responseTime,
      details: {
        note: 'Will be reimplemented via message bus in future phase'
      }
    };

    /* Phase 2: Commented out for migration
    try {
      const registeredAgents = await this.agentDispatcher.getRegisteredAgents();
      const responseTime = Date.now() - start;

      const agentCount = registeredAgents.length;
      const status = agentCount > 0 ? HealthStatus.HEALTHY : HealthStatus.DEGRADED;

      return {
        status,
        message: `${agentCount} agent(s) registered`,
        timestamp: new Date().toISOString(),
        responseTime,
        details: {
          registeredAgents: agentCount,
          agents: registeredAgents
        }
      };
    } catch (error) {
      const responseTime = Date.now() - start;
      logger.error('Agent registry health check failed', { error });

      return {
        status: HealthStatus.UNHEALTHY,
        message: error instanceof Error ? error.message : 'Agent registry check failed',
        timestamp: new Date().toISOString(),
        responseTime
      };
    }
    */
  }

  /**
   * Check filesystem access
   */
  private async checkFilesystem(): Promise<ComponentHealth> {
    const start = Date.now();

    try {
      // Check temp directory exists and is writable
      const tempDir = tmpdir();

      // Verify temp directory exists
      if (!existsSync(tempDir)) {
        throw new Error('Temp directory does not exist');
      }

      // Verify write access
      accessSync(tempDir, constants.W_OK | constants.R_OK);

      const responseTime = Date.now() - start;

      return {
        status: HealthStatus.HEALTHY,
        message: 'Filesystem access OK',
        timestamp: new Date().toISOString(),
        responseTime,
        details: {
          tempDir,
          writable: true,
          readable: true
        }
      };
    } catch (error) {
      const responseTime = Date.now() - start;
      logger.error('Filesystem health check failed', { error });

      return {
        status: HealthStatus.UNHEALTHY,
        message: error instanceof Error ? error.message : 'Filesystem check failed',
        timestamp: new Date().toISOString(),
        responseTime
      };
    }
  }

  /**
   * Create unhealthy component from error
   */
  private createUnhealthyComponent(error: unknown): ComponentHealth {
    return {
      status: HealthStatus.UNHEALTHY,
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Determine overall status from component statuses
   */
  private determineOverallStatus(statuses: HealthStatus[]): HealthStatus {
    if (statuses.some(s => s === HealthStatus.UNHEALTHY)) {
      return HealthStatus.UNHEALTHY;
    }
    if (statuses.some(s => s === HealthStatus.DEGRADED)) {
      return HealthStatus.DEGRADED;
    }
    return HealthStatus.HEALTHY;
  }

  /**
   * Get uptime in seconds
   */
  getUptime(): number {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }
}
