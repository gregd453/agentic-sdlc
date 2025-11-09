import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { EventBus } from '../events/event-bus';
import { AgentDispatcherService } from './agent-dispatcher.service';
import { PipelineExecutorService } from './pipeline-executor.service';
import { PipelineWebSocketHandler } from '../websocket/pipeline-websocket.handler';
import { WorkflowService } from './workflow.service';
import { logger } from '../utils/logger';

/**
 * Shutdown Phase
 */
export enum ShutdownPhase {
  INITIATED = 'initiated',
  DRAINING = 'draining',
  SAVING_STATE = 'saving_state',
  CLOSING_CONNECTIONS = 'closing_connections',
  CLEANUP = 'cleanup',
  COMPLETE = 'complete',
  FAILED = 'failed'
}

/**
 * Shutdown Status
 */
export interface ShutdownStatus {
  phase: ShutdownPhase;
  startTime: number;
  message: string;
  errors?: string[];
}

/**
 * Graceful Shutdown Service
 *
 * Handles graceful shutdown of the orchestrator with the following phases:
 * 1. Drain active requests (30s timeout)
 * 2. Save in-progress pipeline state
 * 3. Close database connections
 * 4. Disconnect Redis clients
 * 5. Cleanup resources
 * 6. Log shutdown completion
 */
export class GracefulShutdownService {
  private shuttingDown = false;
  private shutdownStatus: ShutdownStatus = {
    phase: ShutdownPhase.INITIATED,
    startTime: 0,
    message: ''
  };

  private readonly DRAIN_TIMEOUT_MS = 30000; // 30 seconds
  private readonly FORCE_EXIT_TIMEOUT_MS = 45000; // 45 seconds total

  constructor(
    private readonly fastify: FastifyInstance,
    private readonly prisma: PrismaClient,
    private readonly eventBus: EventBus,
    private readonly agentDispatcher: AgentDispatcherService,
    private readonly pipelineExecutor: PipelineExecutorService,
    private readonly pipelineWebSocketHandler: PipelineWebSocketHandler,
    private readonly workflowService: WorkflowService
  ) {}

  /**
   * Initialize shutdown handlers for SIGTERM and SIGINT
   */
  initialize(): void {
    process.on('SIGTERM', () => this.handleShutdown('SIGTERM'));
    process.on('SIGINT', () => this.handleShutdown('SIGINT'));

    // Handle uncaught errors during shutdown
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception during shutdown', { error });
      if (this.shuttingDown) {
        this.forceExit(1);
      }
    });

    logger.info('Graceful shutdown handlers initialized');
  }

  /**
   * Handle shutdown signal
   */
  private async handleShutdown(signal: string): Promise<void> {
    // Prevent multiple shutdown attempts
    if (this.shuttingDown) {
      logger.warn('Shutdown already in progress, ignoring signal', { signal });
      return;
    }

    this.shuttingDown = true;
    this.shutdownStatus.startTime = Date.now();
    this.updatePhase(ShutdownPhase.INITIATED, `Received signal ${signal}`);

    logger.info(`Graceful shutdown initiated`, { signal });

    // Set force exit timeout
    const forceExitTimer = setTimeout(() => {
      logger.error('Graceful shutdown timeout, forcing exit');
      this.forceExit(1);
    }, this.FORCE_EXIT_TIMEOUT_MS);

    try {
      // Phase 1: Drain active requests
      await this.drainRequests();

      // Phase 2: Save in-progress pipeline state
      await this.savePipelineState();

      // Phase 3: Close connections
      await this.closeConnections();

      // Phase 4: Cleanup resources
      await this.cleanup();

      // Phase 5: Complete
      this.updatePhase(ShutdownPhase.COMPLETE, 'Shutdown completed successfully');

      const duration = Date.now() - this.shutdownStatus.startTime;
      logger.info('Graceful shutdown completed', { duration, signal });

      clearTimeout(forceExitTimer);
      process.exit(0);

    } catch (error) {
      const duration = Date.now() - this.shutdownStatus.startTime;
      logger.error('Graceful shutdown failed', { error, duration, signal });

      this.updatePhase(ShutdownPhase.FAILED, `Shutdown failed: ${error}`);
      this.addError(error instanceof Error ? error.message : String(error));

      clearTimeout(forceExitTimer);
      process.exit(1);
    }
  }

  /**
   * Phase 1: Drain active requests
   */
  private async drainRequests(): Promise<void> {
    this.updatePhase(ShutdownPhase.DRAINING, 'Draining active requests');

    try {
      // Fastify graceful close (waits for active requests)
      await Promise.race([
        this.fastify.close(),
        this.timeout(this.DRAIN_TIMEOUT_MS, 'Request drain timeout')
      ]);

      logger.info('Active requests drained successfully');
    } catch (error) {
      logger.warn('Error draining requests, continuing shutdown', { error });
      // Don't throw - continue shutdown even if drain fails
    }
  }

  /**
   * Phase 2: Save in-progress pipeline state
   */
  private async savePipelineState(): Promise<void> {
    this.updatePhase(ShutdownPhase.SAVING_STATE, 'Saving in-progress pipeline state');

    try {
      // Get active pipelines
      const activePipelines = await this.pipelineExecutor.getActivePipelines();

      if (activePipelines.length === 0) {
        logger.info('No active pipelines to save');
        return;
      }

      logger.info('Saving state for active pipelines', { count: activePipelines.length });

      // Save each pipeline state
      for (const pipeline of activePipelines) {
        try {
          await this.pipelineExecutor.savePipelineState(pipeline.pipeline_id);
          logger.info('Pipeline state saved', { pipeline_id: pipeline.pipeline_id });
        } catch (error) {
          logger.error('Failed to save pipeline state', {
            pipeline_id: pipeline.pipeline_id,
            error
          });
          // Continue with other pipelines
        }
      }

      logger.info('Pipeline state saved successfully');
    } catch (error) {
      logger.warn('Error saving pipeline state, continuing shutdown', { error });
      // Don't throw - continue shutdown even if save fails
    }
  }

  /**
   * Phase 3: Close all connections
   */
  private async closeConnections(): Promise<void> {
    this.updatePhase(ShutdownPhase.CLOSING_CONNECTIONS, 'Closing database and Redis connections');

    const errors: string[] = [];

    // Close WebSocket connections
    try {
      await this.pipelineWebSocketHandler.cleanup();
      logger.info('WebSocket connections closed');
    } catch (error) {
      const msg = `WebSocket cleanup failed: ${error}`;
      logger.error(msg);
      errors.push(msg);
    }

    // Disconnect agent dispatcher
    try {
      await this.agentDispatcher.disconnect();
      logger.info('Agent dispatcher disconnected');
    } catch (error) {
      const msg = `Agent dispatcher disconnect failed: ${error}`;
      logger.error(msg);
      errors.push(msg);
    }

    // Disconnect event bus (Redis)
    try {
      await this.eventBus.disconnect();
      logger.info('Event bus disconnected');
    } catch (error) {
      const msg = `Event bus disconnect failed: ${error}`;
      logger.error(msg);
      errors.push(msg);
    }

    // Disconnect database
    try {
      await this.prisma.$disconnect();
      logger.info('Database connection closed');
    } catch (error) {
      const msg = `Database disconnect failed: ${error}`;
      logger.error(msg);
      errors.push(msg);
    }

    if (errors.length > 0) {
      throw new Error(`Connection closure failed: ${errors.join(', ')}`);
    }
  }

  /**
   * Phase 4: Cleanup resources
   */
  private async cleanup(): Promise<void> {
    this.updatePhase(ShutdownPhase.CLEANUP, 'Cleaning up resources');

    try {
      // Cleanup pipeline executor
      await this.pipelineExecutor.cleanup();
      logger.info('Pipeline executor cleaned up');

      // Cleanup workflow service
      await this.workflowService.cleanup();
      logger.info('Workflow service cleaned up');

      logger.info('Resource cleanup completed');
    } catch (error) {
      logger.warn('Error during resource cleanup, continuing', { error });
      // Don't throw - continue shutdown even if cleanup fails partially
    }
  }

  /**
   * Force exit
   */
  private forceExit(code: number): void {
    logger.error('Forcing process exit', { code });
    process.exit(code);
  }

  /**
   * Timeout helper
   */
  private timeout(ms: number, message: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    });
  }

  /**
   * Update shutdown phase
   */
  private updatePhase(phase: ShutdownPhase, message: string): void {
    this.shutdownStatus.phase = phase;
    this.shutdownStatus.message = message;
    logger.info('Shutdown phase update', { phase, message });
  }

  /**
   * Add error to shutdown status
   */
  private addError(error: string): void {
    if (!this.shutdownStatus.errors) {
      this.shutdownStatus.errors = [];
    }
    this.shutdownStatus.errors.push(error);
  }

  /**
   * Get current shutdown status
   */
  getStatus(): ShutdownStatus {
    return { ...this.shutdownStatus };
  }

  /**
   * Check if shutdown is in progress
   */
  isShuttingDown(): boolean {
    return this.shuttingDown;
  }
}
