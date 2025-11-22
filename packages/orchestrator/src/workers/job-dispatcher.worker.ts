/**
 * Job Dispatcher Worker
 *
 * Timer-based worker that:
 * - Runs every minute (or configurable interval)
 * - Queries database for due jobs (next_run <= NOW())
 * - Dispatches jobs to Redis Stream for execution
 * - Updates next_run for recurring jobs
 * - Handles job completion states
 *
 * Session #89: Phase 2 - Job Execution Engine
 */

import { PrismaClient } from '@prisma/client';
import { Cron } from 'croner';
import { randomUUID } from 'crypto';
import { logger } from '../utils/logger';
import { IMessageBus } from '../hexagonal/ports/message-bus.port';

// ==========================================
// WORKER CONFIGURATION
// ==========================================

export interface JobDispatcherConfig {
  interval_ms?: number; // Default: 60000 (1 minute)
  batch_size?: number; // Default: 100
  worker_id?: string;
  enabled?: boolean;
}

export interface DispatchStats {
  jobs_dispatched: number;
  jobs_skipped: number;
  jobs_completed: number;
  jobs_failed: number;
  errors: number;
  last_run: Date;
  next_run?: Date;
}

// ==========================================
// JOB DISPATCHER WORKER
// ==========================================

export class JobDispatcherWorker {
  private intervalHandle: NodeJS.Timeout | null = null;
  private isRunning = false;
  private stats: DispatchStats = {
    jobs_dispatched: 0,
    jobs_skipped: 0,
    jobs_completed: 0,
    jobs_failed: 0,
    errors: 0,
    last_run: new Date()
  };

  private readonly workerId: string;
  private readonly intervalMs: number;
  private readonly batchSize: number;
  private enabled: boolean;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly messageBus: IMessageBus,
    config?: JobDispatcherConfig
  ) {
    this.workerId = config?.worker_id || `dispatcher-${randomUUID().slice(0, 8)}`;
    this.intervalMs = config?.interval_ms || 60000; // 1 minute default
    this.batchSize = config?.batch_size || 100;
    this.enabled = config?.enabled !== false;
  }

  // ==========================================
  // PUBLIC API
  // ==========================================

  /**
   * Start the dispatcher worker
   */
  start(): void {
    if (this.intervalHandle) {
      logger.warn({ worker_id: this.workerId }, 'Dispatcher already running');
      return;
    }

    if (!this.enabled) {
      logger.info({ worker_id: this.workerId }, 'Dispatcher is disabled');
      return;
    }

    logger.info(
      {
        worker_id: this.workerId,
        interval_ms: this.intervalMs,
        batch_size: this.batchSize
      },
      'Starting job dispatcher worker'
    );

    // Run immediately on start
    this.dispatchDueJobs();

    // Then run at regular intervals
    this.intervalHandle = setInterval(() => {
      this.dispatchDueJobs();
    }, this.intervalMs);
  }

  /**
   * Stop the dispatcher worker
   */
  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
      logger.info({ worker_id: this.workerId }, 'Job dispatcher worker stopped');
    }
  }

  /**
   * Get worker statistics
   */
  getStats(): DispatchStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      jobs_dispatched: 0,
      jobs_skipped: 0,
      jobs_completed: 0,
      jobs_failed: 0,
      errors: 0,
      last_run: new Date()
    };
  }

  // ==========================================
  // DISPATCHER LOGIC
  // ==========================================

  /**
   * Main dispatch loop - finds and dispatches due jobs
   */
  private async dispatchDueJobs(): Promise<void> {
    if (this.isRunning) {
      logger.debug({ worker_id: this.workerId }, 'Previous dispatch still running, skipping');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      logger.debug({ worker_id: this.workerId }, 'Checking for due jobs');

      // 1. Query due jobs
      const dueJobs = await this.queryDueJobs();

      if (dueJobs.length === 0) {
        logger.debug({ worker_id: this.workerId }, 'No due jobs found');
        this.stats.last_run = new Date();
        return;
      }

      logger.info(
        { worker_id: this.workerId, job_count: dueJobs.length },
        'Found due jobs to dispatch'
      );

      // 2. Dispatch each job
      for (const job of dueJobs) {
        try {
          await this.dispatchJob(job);
        } catch (error: any) {
          logger.error(
            {
              worker_id: this.workerId,
              job_id: job.id,
              error: error.message
            },
            'Failed to dispatch job'
          );
          this.stats.errors++;
        }
      }

      const duration = Date.now() - startTime;
      this.stats.last_run = new Date();

      logger.info(
        {
          worker_id: this.workerId,
          jobs_dispatched: this.stats.jobs_dispatched,
          duration_ms: duration
        },
        'Dispatch cycle completed'
      );
    } catch (error: any) {
      logger.error(
        {
          worker_id: this.workerId,
          error: error.message,
          stack: error.stack
        },
        'Error in dispatch cycle'
      );
      this.stats.errors++;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Query database for jobs that are due to run
   */
  private async queryDueJobs(): Promise<any[]> {
    const now = new Date();

    return this.prisma.scheduledJob.findMany({
      where: {
        status: 'active',
        next_run: {
          lte: now
        }
      },
      orderBy: [{ priority: 'desc' }, { next_run: 'asc' }],
      take: this.batchSize
    });
  }

  /**
   * Dispatch individual job to execution queue
   */
  private async dispatchJob(job: any): Promise<void> {
    const traceId = randomUUID();

    logger.info(
      {
        worker_id: this.workerId,
        job_id: job.id,
        job_name: job.name,
        job_type: job.type,
        trace_id: traceId
      },
      'Dispatching job for execution'
    );

    try {
      // 1. Check concurrency limits
      if (!job.allow_overlap) {
        const runningExecutions = await this.prisma.jobExecution.count({
          where: {
            job_id: job.id,
            status: 'running'
          }
        });

        if (runningExecutions >= job.concurrency) {
          logger.info(
            {
              job_id: job.id,
              running_count: runningExecutions,
              concurrency_limit: job.concurrency
            },
            'Job skipped due to concurrency limit'
          );
          this.stats.jobs_skipped++;
          return;
        }
      }

      // 2. Publish to message bus
      await this.messageBus.publish(
        'scheduler:job.dispatch',
        {
          job_id: job.id,
          job_name: job.name,
          scheduled_at: new Date(),
          trace_id: traceId,
          worker_id: this.workerId,
          handler_name: job.handler_name,
          handler_type: job.handler_type,
          payload: job.payload,
          timeout_ms: job.timeout_ms
        },
        {
          mirrorToStream: 'stream:scheduler:job.dispatch'
        }
      );

      // 3. Update next_run based on job type
      await this.updateNextRun(job);

      this.stats.jobs_dispatched++;

      logger.debug(
        {
          job_id: job.id,
          trace_id: traceId
        },
        'Job dispatched successfully'
      );
    } catch (error: any) {
      logger.error(
        {
          job_id: job.id,
          error: error.message,
          stack: error.stack
        },
        'Failed to dispatch job'
      );
      throw error;
    }
  }

  /**
   * Update job's next_run timestamp based on job type
   */
  private async updateNextRun(job: any): Promise<void> {
    let nextRun: Date | null = null;

    switch (job.type) {
      case 'cron':
        // Recurring cron job - calculate next run
        nextRun = this.calculateNextRun(job.schedule, job.timezone, job.start_date);
        break;

      case 'recurring':
        // Limited recurring job
        nextRun = this.calculateNextRun(job.schedule, job.timezone, job.start_date);

        // Check if we've hit the end date or max executions
        if (job.end_date && nextRun > job.end_date) {
          nextRun = null;
          await this.completeJob(job.id);
        } else if (
          job.max_executions &&
          job.executions_count >= job.max_executions
        ) {
          nextRun = null;
          await this.completeJob(job.id);
        }
        break;

      case 'one_time':
        // One-time job - mark as completed
        nextRun = null;
        await this.completeJob(job.id);
        break;

      case 'event':
        // Event-based job - no scheduled next run
        nextRun = null;
        break;
    }

    // Update next_run in database
    await this.prisma.scheduledJob.update({
      where: { id: job.id },
      data: { next_run: nextRun }
    });

    logger.debug(
      {
        job_id: job.id,
        job_type: job.type,
        next_run: nextRun
      },
      'Updated job next_run'
    );
  }

  /**
   * Calculate next run time for cron job
   */
  private calculateNextRun(
    schedule: string,
    timezone: string,
    startDate?: Date
  ): Date {
    const options: any = {
      timezone,
      paused: true
    };

    if (startDate) {
      options.startAt = startDate;
    }

    const cron = new Cron(schedule, options);
    const nextRun = cron.nextRun();

    if (!nextRun) {
      throw new Error(`Could not calculate next run for schedule: ${schedule}`);
    }

    return nextRun;
  }

  /**
   * Mark job as completed
   */
  private async completeJob(jobId: string): Promise<void> {
    await this.prisma.scheduledJob.update({
      where: { id: jobId },
      data: {
        status: 'completed',
        completed_at: new Date()
      }
    });

    this.stats.jobs_completed++;

    logger.info({ job_id: jobId }, 'Job marked as completed');
  }
}
