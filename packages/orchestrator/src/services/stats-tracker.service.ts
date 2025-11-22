/**
 * Stats Tracker Service
 *
 * Centralized service for updating job and event handler statistics
 * Session #91: Consolidated from duplicate logic across scheduler services
 */

import { PrismaClient } from '@prisma/client';
import { createLogger } from '../hexagonal/core/logger';

const logger = createLogger('StatsTrackerService');

export type ExecutionResult = 'success' | 'failure';

/**
 * Service for tracking and updating execution statistics
 */
export class StatsTrackerService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Update event handler statistics atomically
   *
   * @param handlerId - ID of the event handler
   * @param result - Execution result (success or failure)
   */
  async updateEventHandlerStats(
    handlerId: string,
    result: ExecutionResult
  ): Promise<void> {
    try {
      await this.prisma.eventHandler.update({
        where: { id: handlerId },
        data: {
          trigger_count: { increment: 1 },
          success_count: result === 'success' ? { increment: 1 } : undefined,
          failure_count: result === 'failure' ? { increment: 1 } : undefined,
          last_triggered: new Date()
        }
      });

      logger.debug('Event handler stats updated', {
        handler_id: handlerId,
        result
      });
    } catch (error: any) {
      logger.error('Failed to update event handler stats', {
        handler_id: handlerId,
        error: error.message
      });
      // Don't throw - stats updates should not fail the operation
    }
  }

  /**
   * Update job execution statistics with rolling average duration
   *
   * @param jobId - ID of the scheduled job
   * @param result - Execution result (success or failure)
   * @param durationMs - Execution duration in milliseconds
   */
  async updateJobExecutionStats(
    jobId: string,
    result: ExecutionResult,
    durationMs: number
  ): Promise<void> {
    try {
      // Fetch current stats to calculate rolling average
      const job = await this.prisma.scheduledJob.findUnique({
        where: { id: jobId },
        select: {
          executions_count: true,
          avg_duration_ms: true
        }
      });

      if (!job) {
        logger.warn('Job not found for stats update', { job_id: jobId });
        return;
      }

      // Calculate new rolling average
      const newAvg = this.calculateRollingAverage(
        job.avg_duration_ms || 0,
        job.executions_count,
        durationMs
      );

      await this.prisma.scheduledJob.update({
        where: { id: jobId },
        data: {
          executions_count: { increment: 1 },
          success_count: result === 'success' ? { increment: 1 } : undefined,
          failure_count: result === 'failure' ? { increment: 1 } : undefined,
          avg_duration_ms: newAvg,
          last_run: new Date()
        }
      });

      logger.debug('Job execution stats updated', {
        job_id: jobId,
        result,
        duration_ms: durationMs,
        avg_duration_ms: newAvg
      });
    } catch (error: any) {
      logger.error('Failed to update job execution stats', {
        job_id: jobId,
        error: error.message
      });
      // Don't throw - stats updates should not fail the operation
    }
  }

  /**
   * Increment only trigger count (for simple event tracking)
   *
   * @param handlerId - ID of the event handler
   */
  async incrementTriggerCount(handlerId: string): Promise<void> {
    try {
      await this.prisma.eventHandler.update({
        where: { id: handlerId },
        data: {
          trigger_count: { increment: 1 },
          last_triggered: new Date()
        }
      });
    } catch (error: any) {
      logger.error('Failed to increment trigger count', {
        handler_id: handlerId,
        error: error.message
      });
    }
  }

  /**
   * Batch update job statistics (for multiple jobs)
   *
   * @param updates - Array of job stat updates
   */
  async batchUpdateJobStats(
    updates: Array<{
      jobId: string;
      result: ExecutionResult;
      durationMs: number;
    }>
  ): Promise<void> {
    const promises = updates.map(({ jobId, result, durationMs }) =>
      this.updateJobExecutionStats(jobId, result, durationMs)
    );

    await Promise.allSettled(promises);
  }

  /**
   * Get job statistics summary
   *
   * @param jobId - ID of the scheduled job
   * @returns Statistics summary or null if job not found
   */
  async getJobStats(jobId: string): Promise<{
    executions_count: number;
    success_count: number;
    failure_count: number;
    success_rate: number;
    avg_duration_ms: number | null;
    last_run: Date | null;
  } | null> {
    try {
      const job = await this.prisma.scheduledJob.findUnique({
        where: { id: jobId },
        select: {
          executions_count: true,
          success_count: true,
          failure_count: true,
          avg_duration_ms: true,
          last_run: true
        }
      });

      if (!job) {
        return null;
      }

      const successRate = job.executions_count > 0
        ? (job.success_count / job.executions_count) * 100
        : 0;

      return {
        ...job,
        success_rate: Math.round(successRate * 100) / 100 // Round to 2 decimal places
      };
    } catch (error: any) {
      logger.error('Failed to get job stats', {
        job_id: jobId,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Get event handler statistics summary
   *
   * @param handlerId - ID of the event handler
   * @returns Statistics summary or null if handler not found
   */
  async getEventHandlerStats(handlerId: string): Promise<{
    trigger_count: number;
    success_count: number;
    failure_count: number;
    success_rate: number;
    last_triggered: Date | null;
  } | null> {
    try {
      const handler = await this.prisma.eventHandler.findUnique({
        where: { id: handlerId },
        select: {
          trigger_count: true,
          success_count: true,
          failure_count: true,
          last_triggered: true
        }
      });

      if (!handler) {
        return null;
      }

      const successRate = handler.trigger_count > 0
        ? (handler.success_count / handler.trigger_count) * 100
        : 0;

      return {
        ...handler,
        success_rate: Math.round(successRate * 100) / 100
      };
    } catch (error: any) {
      logger.error('Failed to get event handler stats', {
        handler_id: handlerId,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Calculate rolling average
   *
   * @param currentAvg - Current average value
   * @param count - Number of data points in current average
   * @param newValue - New value to add to average
   * @returns New rolling average
   */
  private calculateRollingAverage(
    currentAvg: number,
    count: number,
    newValue: number
  ): number {
    if (count === 0) {
      return Math.round(newValue);
    }

    return Math.round((currentAvg * count + newValue) / (count + 1));
  }
}
