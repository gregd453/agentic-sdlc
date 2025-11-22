/**
 * Scheduler Event Publisher Service
 *
 * Centralized event publishing for scheduler operations
 * Session #91: Consolidated from duplicate event publishing logic
 */

import { IMessageBus } from '../hexagonal/ports/message-bus.port';
import { SCHEDULER_EVENTS, SCHEDULER_STREAMS } from '../constants/scheduler.constants';
import { createLogger } from '../hexagonal/core/logger';

const logger = createLogger('SchedulerEventPublisher');

export type SchedulerEventType = keyof typeof SCHEDULER_EVENTS;

export interface EventPublishOptions {
  mirrorToStream?: string;
  throwOnError?: boolean;
}

/**
 * Service for publishing scheduler-related events
 */
export class SchedulerEventPublisher {
  constructor(private readonly messageBus: IMessageBus) {}

  /**
   * Publish a scheduler event
   *
   * @param eventType - Type of event (uses SCHEDULER_EVENTS constants)
   * @param payload - Event payload
   * @param options - Publishing options
   * @returns True if published successfully, false otherwise
   */
  async publishEvent(
    eventType: SchedulerEventType,
    payload: Record<string, any>,
    options?: EventPublishOptions
  ): Promise<boolean> {
    const eventName = SCHEDULER_EVENTS[eventType];

    try {
      await this.messageBus.publish(eventName, payload, {
        mirrorToStream: options?.mirrorToStream
      });

      logger.debug('Scheduler event published', {
        event: eventName,
        payload_keys: Object.keys(payload)
      });

      return true;
    } catch (error: any) {
      logger.error('Failed to publish scheduler event', {
        event: eventName,
        error: error.message
      });

      if (options?.throwOnError) {
        throw error;
      }

      return false;
    }
  }

  // ===== Job Lifecycle Events =====

  /**
   * Publish job created event
   */
  async publishJobCreated(job: {
    id: string;
    name: string;
    type: string;
    schedule?: string | null;
    next_run?: Date | null;
  }): Promise<void> {
    await this.publishEvent('JOB_CREATED', {
      job_id: job.id,
      job_name: job.name,
      type: job.type,
      schedule: job.schedule,
      next_run: job.next_run?.toISOString()
    });
  }

  /**
   * Publish job updated event
   */
  async publishJobUpdated(job: {
    id: string;
    name: string;
    changes: string[];
  }): Promise<void> {
    await this.publishEvent('JOB_UPDATED', {
      job_id: job.id,
      job_name: job.name,
      changes: job.changes
    });
  }

  /**
   * Publish job deleted event
   */
  async publishJobDeleted(jobId: string, jobName: string): Promise<void> {
    await this.publishEvent('JOB_DELETED', {
      job_id: jobId,
      job_name: jobName
    });
  }

  /**
   * Publish job paused event
   */
  async publishJobPaused(jobId: string, jobName: string): Promise<void> {
    await this.publishEvent('JOB_PAUSED', {
      job_id: jobId,
      job_name: jobName
    });
  }

  /**
   * Publish job resumed event
   */
  async publishJobResumed(jobId: string, jobName: string): Promise<void> {
    await this.publishEvent('JOB_RESUMED', {
      job_id: jobId,
      job_name: jobName
    });
  }

  /**
   * Publish job cancelled event
   */
  async publishJobCancelled(
    jobId: string,
    jobName: string,
    reason?: string
  ): Promise<void> {
    await this.publishEvent('JOB_CANCELLED', {
      job_id: jobId,
      job_name: jobName,
      reason
    });
  }

  // ===== Job Execution Events =====

  /**
   * Publish job dispatched event (with stream mirror for persistence)
   */
  async publishJobDispatched(job: {
    id: string;
    execution_id: string;
    handler_name: string;
    handler_type?: string;
    trace_id?: string;
    payload?: any;
  }): Promise<void> {
    await this.publishEvent('JOB_DISPATCH', {
      job_id: job.id,
      execution_id: job.execution_id,
      handler_name: job.handler_name,
      handler_type: job.handler_type,
      trace_id: job.trace_id,
      payload: job.payload
    }, {
      mirrorToStream: SCHEDULER_STREAMS.JOB_DISPATCH
    });
  }

  /**
   * Publish job execution success event
   */
  async publishExecutionSuccess(
    jobId: string,
    executionId: string,
    result: any,
    durationMs: number
  ): Promise<void> {
    await this.publishEvent('EXECUTION_SUCCESS', {
      job_id: jobId,
      execution_id: executionId,
      result,
      duration_ms: durationMs
    }, {
      mirrorToStream: SCHEDULER_STREAMS.JOB_RESULTS
    });
  }

  /**
   * Publish job execution failed event
   */
  async publishExecutionFailed(
    jobId: string,
    executionId: string,
    error: string,
    durationMs?: number
  ): Promise<void> {
    await this.publishEvent('EXECUTION_FAILED', {
      job_id: jobId,
      execution_id: executionId,
      error,
      duration_ms: durationMs
    }, {
      mirrorToStream: SCHEDULER_STREAMS.JOB_RESULTS
    });
  }

  /**
   * Publish job retry scheduled event
   */
  async publishRetryScheduled(
    jobId: string,
    executionId: string,
    attempt: number,
    maxRetries: number,
    retryAt: Date
  ): Promise<void> {
    await this.publishEvent('EXECUTION_RETRY', {
      job_id: jobId,
      execution_id: executionId,
      attempt,
      max_retries: maxRetries,
      retry_at: retryAt.toISOString()
    });
  }

  // ===== Batch Publishing =====

  /**
   * Publish multiple events in parallel
   *
   * @param events - Array of event specifications
   * @returns Array of success/failure results
   */
  async publishBatch(
    events: Array<{
      eventType: SchedulerEventType;
      payload: Record<string, any>;
      options?: EventPublishOptions;
    }>
  ): Promise<boolean[]> {
    const promises = events.map(({ eventType, payload, options }) =>
      this.publishEvent(eventType, payload, options)
    );

    return Promise.all(promises);
  }

  // ===== Custom Events =====

  /**
   * Publish a custom scheduler event (not in predefined constants)
   *
   * @param eventName - Full event name (e.g., 'scheduler:custom.event')
   * @param payload - Event payload
   * @param options - Publishing options
   */
  async publishCustomEvent(
    eventName: string,
    payload: Record<string, any>,
    options?: EventPublishOptions
  ): Promise<boolean> {
    try {
      await this.messageBus.publish(eventName, payload, {
        mirrorToStream: options?.mirrorToStream
      });

      logger.debug('Custom scheduler event published', {
        event: eventName,
        payload_keys: Object.keys(payload)
      });

      return true;
    } catch (error: any) {
      logger.error('Failed to publish custom scheduler event', {
        event: eventName,
        error: error.message
      });

      if (options?.throwOnError) {
        throw error;
      }

      return false;
    }
  }
}
