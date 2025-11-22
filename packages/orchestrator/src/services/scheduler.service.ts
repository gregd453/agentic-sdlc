/**
 * Scheduler Service - Business Logic Layer
 *
 * Responsibilities:
 * - Job lifecycle management (create, update, cancel)
 * - Schedule validation and next run calculation
 * - Platform-scoped job isolation
 * - Integration with message bus for job dispatch
 * - Execution tracking and metrics
 *
 * Architecture:
 * - Uses Prisma for persistence
 * - Uses Redis Streams (via MessageBus) for job queue
 * - Follows hexagonal pattern (implements IScheduler port)
 *
 * Session #89: Phase 2 - Job Execution Engine
 */

import { PrismaClient, Priority } from '@prisma/client';
import { randomUUID } from 'crypto';
import { Cron } from 'croner';
import { logger } from '../utils/logger';
import { IMessageBus } from '../hexagonal/ports/message-bus.port';
import {
  IScheduler,
  ScheduledJobInput,
  OneTimeJobInput,
  RecurringJobInput,
  Job,
  JobExecution,
  JobFilter,
  HistoryOptions,
  SchedulerMetrics,
  JobStats,
  HealthStatus,
  EventHandlerFunction,
  EventHandlerOptions
} from '../hexagonal/ports/scheduler.port';

export class SchedulerService implements IScheduler {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly messageBus: IMessageBus
  ) {}

  // ==========================================
  // JOB SCHEDULING METHODS
  // ==========================================

  async schedule(input: ScheduledJobInput): Promise<Job> {
    // Validate cron expression
    this.validateCronExpression(input.schedule);

    // Calculate next run time
    const nextRun = this.calculateNextRun(input.schedule, input.timezone || 'UTC');

    // Create job in database
    const job = await this.prisma.scheduledJob.create({
      data: {
        id: input.id || randomUUID(),
        name: input.name,
        description: input.description,
        type: 'cron',
        status: input.enabled !== false ? 'active' : 'paused',
        schedule: input.schedule,
        timezone: input.timezone || 'UTC',
        next_run: nextRun,
        handler_name: input.handler_name,
        handler_type: input.handler_type || 'function',
        payload: input.payload || {},
        max_retries: input.max_retries ?? 3,
        retry_delay_ms: input.retry_delay_ms ?? 60000,
        timeout_ms: input.timeout_ms ?? 300000,
        priority: input.priority || 'medium',
        concurrency: input.concurrency ?? 1,
        allow_overlap: input.allow_overlap ?? false,
        tags: input.tags || [],
        metadata: input.metadata || {},
        platform_id: input.platform_id,
        created_by: input.created_by
      }
    });

    logger.info('[SchedulerService] Created cron job', {
      jobId: job.id,
      name: job.name,
      schedule: job.schedule,
      nextRun: job.next_run
    });

    // Publish job created event
    await this.messageBus.publish('scheduler:job.created', {
      job_id: job.id,
      job_name: job.name,
      type: job.type,
      schedule: job.schedule,
      next_run: job.next_run
    });

    return this.formatJob(job);
  }

  async scheduleOnce(input: OneTimeJobInput): Promise<Job> {
    // Validate execution time is in the future
    if (input.execute_at <= new Date()) {
      throw new Error('execute_at must be in the future');
    }

    // Create job in database
    const job = await this.prisma.scheduledJob.create({
      data: {
        id: input.id || randomUUID(),
        name: input.name,
        description: input.description,
        type: 'one_time',
        status: 'active',
        next_run: input.execute_at,
        timezone: 'UTC',
        handler_name: input.handler_name,
        handler_type: input.handler_type || 'function',
        payload: input.payload || {},
        max_retries: input.max_retries ?? 3,
        retry_delay_ms: input.retry_delay_ms ?? 60000,
        timeout_ms: input.timeout_ms ?? 300000,
        priority: input.priority || 'medium',
        concurrency: 1,
        allow_overlap: false,
        tags: input.tags || [],
        metadata: input.metadata || {},
        platform_id: input.platform_id,
        created_by: input.created_by
      }
    });

    logger.info('[SchedulerService] Created one-time job', {
      jobId: job.id,
      name: job.name,
      executeAt: job.next_run
    });

    // Publish job created event
    await this.messageBus.publish('scheduler:job.created', {
      job_id: job.id,
      job_name: job.name,
      type: job.type,
      execute_at: job.next_run
    });

    return this.formatJob(job);
  }

  async scheduleRecurring(input: RecurringJobInput): Promise<Job> {
    // Validate cron expression
    this.validateCronExpression(input.schedule);

    // Validate date ranges
    if (input.end_date && input.end_date <= input.start_date) {
      throw new Error('end_date must be after start_date');
    }

    // Calculate next run time (considering start_date)
    const nextRun = this.calculateNextRun(
      input.schedule,
      input.timezone || 'UTC',
      input.start_date
    );

    // Create job in database
    const job = await this.prisma.scheduledJob.create({
      data: {
        id: input.id || randomUUID(),
        name: input.name,
        description: input.description,
        type: 'recurring',
        status: input.enabled !== false ? 'active' : 'paused',
        schedule: input.schedule,
        timezone: input.timezone || 'UTC',
        next_run: nextRun,
        start_date: input.start_date,
        end_date: input.end_date,
        max_executions: input.max_executions,
        handler_name: input.handler_name,
        handler_type: input.handler_type || 'function',
        payload: input.payload || {},
        max_retries: input.max_retries ?? 3,
        retry_delay_ms: input.retry_delay_ms ?? 60000,
        timeout_ms: input.timeout_ms ?? 300000,
        priority: input.priority || 'medium',
        concurrency: input.concurrency ?? 1,
        allow_overlap: input.allow_overlap ?? false,
        tags: input.tags || [],
        metadata: { ...input.metadata, skip_if_overdue: input.skip_if_overdue },
        platform_id: input.platform_id,
        created_by: input.created_by
      }
    });

    logger.info('[SchedulerService] Created recurring job', {
      jobId: job.id,
      name: job.name,
      schedule: job.schedule,
      startDate: job.start_date,
      endDate: job.end_date,
      maxExecutions: job.max_executions
    });

    // Publish job created event
    await this.messageBus.publish('scheduler:job.created', {
      job_id: job.id,
      job_name: job.name,
      type: job.type,
      schedule: job.schedule,
      next_run: job.next_run,
      start_date: job.start_date,
      end_date: job.end_date
    });

    return this.formatJob(job);
  }

  async reschedule(jobId: string, newSchedule: string): Promise<Job> {
    // Validate cron expression
    this.validateCronExpression(newSchedule);

    // Get existing job
    const existingJob = await this.prisma.scheduledJob.findUnique({
      where: { id: jobId }
    });

    if (!existingJob) {
      throw new Error(`Job not found: ${jobId}`);
    }

    if (existingJob.type !== 'cron' && existingJob.type !== 'recurring') {
      throw new Error(`Cannot reschedule ${existingJob.type} job. Only cron and recurring jobs can be rescheduled.`);
    }

    // Calculate new next run time
    const nextRun = this.calculateNextRun(
      newSchedule,
      existingJob.timezone,
      existingJob.start_date || undefined
    );

    // Update job
    const job = await this.prisma.scheduledJob.update({
      where: { id: jobId },
      data: {
        schedule: newSchedule,
        next_run: nextRun
      }
    });

    logger.info('[SchedulerService] Rescheduled job', {
      jobId: job.id,
      oldSchedule: existingJob.schedule,
      newSchedule: newSchedule,
      nextRun: job.next_run
    });

    // Publish job updated event
    await this.messageBus.publish('scheduler:job.updated', {
      job_id: job.id,
      changes: { schedule: newSchedule, next_run: nextRun }
    });

    return this.formatJob(job);
  }

  async unschedule(jobId: string): Promise<void> {
    // Verify job exists
    const job = await this.prisma.scheduledJob.findUnique({
      where: { id: jobId }
    });

    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    // Delete job (cascade will delete executions)
    await this.prisma.scheduledJob.delete({
      where: { id: jobId }
    });

    logger.info('[SchedulerService] Unscheduled job', {
      jobId,
      name: job.name
    });

    // Publish job deleted event
    await this.messageBus.publish('scheduler:job.deleted', {
      job_id: jobId,
      job_name: job.name
    });
  }

  // ==========================================
  // EVENT-BASED METHODS
  // ==========================================

  async onEvent(event: string, handler: EventHandlerFunction, options?: EventHandlerOptions): Promise<void> {
    // Register event handler in database
    const eventHandler = await this.prisma.eventHandler.create({
      data: {
        event_name: event,
        handler_name: handler.name || 'anonymous',
        handler_type: options?.action ? 'job_creator' : 'function',
        enabled: options?.enabled !== false,
        priority: options?.priority ?? 5,
        action_type: options?.action?.type,
        action_config: options?.action?.config,
        platform_id: options?.platform_id
      }
    });

    logger.info('[SchedulerService] Registered event handler', {
      eventHandlerId: eventHandler.id,
      eventName: event,
      handlerName: eventHandler.handler_name,
      platformId: options?.platform_id
    });

    // Subscribe to event on message bus
    await this.messageBus.subscribe(event, async (data) => {
      try {
        // Execute handler
        await handler(data);

        // Update statistics
        await this.prisma.eventHandler.update({
          where: { id: eventHandler.id },
          data: {
            trigger_count: { increment: 1 },
            success_count: { increment: 1 },
            last_triggered: new Date()
          }
        });

        logger.debug('[SchedulerService] Event handler executed', {
          eventName: event,
          handlerName: eventHandler.handler_name
        });
      } catch (error: any) {
        // Update failure statistics
        await this.prisma.eventHandler.update({
          where: { id: eventHandler.id },
          data: {
            trigger_count: { increment: 1 },
            failure_count: { increment: 1 },
            last_triggered: new Date()
          }
        });

        logger.error('[SchedulerService] Event handler failed', {
          eventName: event,
          handlerName: eventHandler.handler_name,
          error: error.message
        });
      }
    });
  }

  async triggerEvent(event: string, data: any): Promise<void> {
    logger.info('[SchedulerService] Triggering event', { event, data });

    // Publish event to message bus
    await this.messageBus.publish(event, data);
  }

  // ==========================================
  // JOB MANAGEMENT METHODS
  // ==========================================

  async getJob(jobId: string): Promise<Job | null> {
    const job = await this.prisma.scheduledJob.findUnique({
      where: { id: jobId }
    });

    return job ? this.formatJob(job) : null;
  }

  async listJobs(filter?: JobFilter): Promise<Job[]> {
    const where: any = {};

    // Apply filters
    if (filter?.type) {
      where.type = Array.isArray(filter.type) ? { in: filter.type } : filter.type;
    }
    if (filter?.status) {
      where.status = Array.isArray(filter.status) ? { in: filter.status } : filter.status;
    }
    if (filter?.tags) {
      where.tags = { hasSome: filter.tags };
    }
    if (filter?.tags_all) {
      where.tags = { hasEvery: filter.tags_all };
    }
    if (filter?.created_after) {
      where.created_at = { ...where.created_at, gte: filter.created_after };
    }
    if (filter?.created_before) {
      where.created_at = { ...where.created_at, lte: filter.created_before };
    }
    if (filter?.next_run_after) {
      where.next_run = { ...where.next_run, gte: filter.next_run_after };
    }
    if (filter?.next_run_before) {
      where.next_run = { ...where.next_run, lte: filter.next_run_before };
    }
    if (filter?.name_contains) {
      where.name = { contains: filter.name_contains, mode: 'insensitive' };
    }
    if (filter?.platform_id) {
      where.platform_id = filter.platform_id;
    }
    if (filter?.created_by) {
      where.created_by = filter.created_by;
    }

    // Execute query
    const jobs = await this.prisma.scheduledJob.findMany({
      where,
      take: filter?.limit,
      skip: filter?.offset,
      orderBy: filter?.sort_by ? {
        [filter.sort_by]: filter.sort_order || 'desc'
      } : undefined
    });

    return jobs.map(job => this.formatJob(job));
  }

  async pauseJob(jobId: string): Promise<void> {
    const job = await this.prisma.scheduledJob.findUnique({
      where: { id: jobId }
    });

    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    if (job.status !== 'active') {
      throw new Error(`Cannot pause job with status: ${job.status}`);
    }

    await this.prisma.scheduledJob.update({
      where: { id: jobId },
      data: { status: 'paused' }
    });

    logger.info('[SchedulerService] Paused job', { jobId, name: job.name });

    // Publish job paused event
    await this.messageBus.publish('scheduler:job.paused', {
      job_id: jobId,
      job_name: job.name
    });
  }

  async resumeJob(jobId: string): Promise<void> {
    const job = await this.prisma.scheduledJob.findUnique({
      where: { id: jobId }
    });

    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    if (job.status !== 'paused') {
      throw new Error(`Cannot resume job with status: ${job.status}`);
    }

    await this.prisma.scheduledJob.update({
      where: { id: jobId },
      data: { status: 'active' }
    });

    logger.info('[SchedulerService] Resumed job', { jobId, name: job.name });

    // Publish job resumed event
    await this.messageBus.publish('scheduler:job.resumed', {
      job_id: jobId,
      job_name: job.name
    });
  }

  async cancelJob(jobId: string): Promise<void> {
    const job = await this.prisma.scheduledJob.findUnique({
      where: { id: jobId }
    });

    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    await this.prisma.scheduledJob.update({
      where: { id: jobId },
      data: {
        status: 'cancelled',
        cancelled_at: new Date()
      }
    });

    logger.info('[SchedulerService] Cancelled job', { jobId, name: job.name });

    // Publish job cancelled event
    await this.messageBus.publish('scheduler:job.cancelled', {
      job_id: jobId,
      job_name: job.name
    });
  }

  // ==========================================
  // EXECUTION HISTORY METHODS
  // ==========================================

  async getJobHistory(jobId: string, options?: HistoryOptions): Promise<JobExecution[]> {
    const where: any = { job_id: jobId };

    if (options?.status) {
      where.status = options.status;
    }
    if (options?.since) {
      where.started_at = { ...where.started_at, gte: options.since };
    }
    if (options?.until) {
      where.started_at = { ...where.started_at, lte: options.until };
    }

    const executions = await this.prisma.jobExecution.findMany({
      where,
      include: {
        logs: options?.include_logs
      },
      take: options?.limit ?? 10,
      skip: options?.offset,
      orderBy: {
        started_at: options?.sort_order || 'desc'
      }
    });

    return executions.map(exec => this.formatExecution(exec));
  }

  async getExecution(executionId: string): Promise<JobExecution | null> {
    const execution = await this.prisma.jobExecution.findUnique({
      where: { id: executionId },
      include: { logs: true }
    });

    return execution ? this.formatExecution(execution) : null;
  }

  async retryExecution(executionId: string): Promise<JobExecution> {
    const execution = await this.prisma.jobExecution.findUnique({
      where: { id: executionId },
      include: { job: true }
    });

    if (!execution) {
      throw new Error(`Execution not found: ${executionId}`);
    }

    if (execution.status !== 'failed' && execution.status !== 'timeout') {
      throw new Error(`Cannot retry execution with status: ${execution.status}`);
    }

    // Create new execution
    const newExecution = await this.prisma.jobExecution.create({
      data: {
        job_id: execution.job_id,
        status: 'pending',
        scheduled_at: new Date(),
        retry_count: 0,
        max_retries: execution.max_retries,
        metadata: {
          ...execution.metadata as any,
          manual_retry: true,
          original_execution_id: executionId
        }
      }
    });

    logger.info('[SchedulerService] Created retry execution', {
      originalExecutionId: executionId,
      newExecutionId: newExecution.id,
      jobId: execution.job_id
    });

    // Dispatch to job queue
    await this.dispatchJobExecution(execution.job, newExecution);

    return this.formatExecution(newExecution);
  }

  // ==========================================
  // MONITORING METHODS (STUBS FOR PHASE 5)
  // ==========================================

  async getMetrics(_start?: Date, _end?: Date): Promise<SchedulerMetrics> {
    // TODO: Implement in Phase 5
    throw new Error('getMetrics not implemented yet - Phase 5');
  }

  async healthCheck(): Promise<HealthStatus> {
    // TODO: Implement in Phase 5
    throw new Error('healthCheck not implemented yet - Phase 5');
  }

  async getJobStats(_jobId: string): Promise<JobStats> {
    // TODO: Implement in Phase 5
    throw new Error('getJobStats not implemented yet - Phase 5');
  }

  // ==========================================
  // PRIVATE HELPER METHODS
  // ==========================================

  private validateCronExpression(schedule: string): void {
    try {
      // Create a temporary cron instance to validate the expression
      new Cron(schedule, { paused: true });
    } catch (error: any) {
      throw new Error(`Invalid cron expression: ${error.message}`);
    }
  }

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

  private async dispatchJobExecution(job: any, execution: any): Promise<void> {
    // Publish to job execution queue (Redis Stream)
    await this.messageBus.publish('scheduler:job.dispatch', {
      job_id: job.id,
      execution_id: execution.id,
      handler_name: job.handler_name,
      handler_type: job.handler_type,
      payload: job.payload,
      timeout_ms: job.timeout_ms,
      trace_id: execution.trace_id
    }, {
      mirrorToStream: 'stream:scheduler:job.dispatch'
    });
  }

  private formatJob(job: any): Job {
    return {
      id: job.id,
      name: job.name,
      description: job.description,
      type: job.type,
      status: job.status,
      schedule: job.schedule,
      timezone: job.timezone,
      next_run: job.next_run,
      last_run: job.last_run,
      start_date: job.start_date,
      end_date: job.end_date,
      max_executions: job.max_executions,
      handler_name: job.handler_name,
      handler_type: job.handler_type,
      payload: job.payload,
      max_retries: job.max_retries,
      retry_delay_ms: job.retry_delay_ms,
      timeout_ms: job.timeout_ms,
      priority: job.priority,
      concurrency: job.concurrency,
      allow_overlap: job.allow_overlap,
      executions_count: job.executions_count,
      success_count: job.success_count,
      failure_count: job.failure_count,
      avg_duration_ms: job.avg_duration_ms,
      tags: job.tags,
      metadata: job.metadata,
      platform_id: job.platform_id,
      created_by: job.created_by,
      created_at: job.created_at,
      updated_at: job.updated_at,
      completed_at: job.completed_at,
      cancelled_at: job.cancelled_at
    };
  }

  private formatExecution(execution: any): JobExecution {
    return {
      id: execution.id,
      job_id: execution.job_id,
      status: execution.status,
      scheduled_at: execution.scheduled_at,
      started_at: execution.started_at,
      completed_at: execution.completed_at,
      duration_ms: execution.duration_ms,
      result: execution.result,
      error: execution.error,
      error_stack: execution.error_stack,
      retry_count: execution.retry_count,
      max_retries: execution.max_retries,
      next_retry_at: execution.next_retry_at,
      worker_id: execution.worker_id,
      metadata: execution.metadata,
      trace_id: execution.trace_id,
      span_id: execution.span_id,
      parent_span_id: execution.parent_span_id,
      created_at: execution.created_at
    };
  }
}
