/**
 * Cron Helper Utilities
 *
 * Centralized utilities for cron expression handling
 * Session #91: Consolidated from duplicate implementations in scheduler.service.ts and job-dispatcher.worker.ts
 */

import { Cron } from 'croner';
import { CronExpressionError } from '../errors/scheduler-errors';
import { SCHEDULER_DEFAULTS } from '../constants/scheduler.constants';

export interface CronCalculationOptions {
  schedule: string;
  timezone?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface CronValidationResult {
  valid: boolean;
  error?: string;
  nextRun?: Date;
}

/**
 * Cron expression helper class
 */
export class CronHelper {
  /**
   * Calculate next run time for a cron expression
   *
   * @param options - Cron calculation options
   * @returns Next run date
   * @throws {CronExpressionError} If cron expression is invalid or next run cannot be calculated
   */
  static calculateNextRun(options: CronCalculationOptions): Date {
    const {
      schedule,
      timezone = SCHEDULER_DEFAULTS.DEFAULT_TIMEZONE,
      startDate,
      endDate
    } = options;

    const cronOptions: any = {
      timezone,
      paused: true
    };

    if (startDate) {
      cronOptions.startAt = startDate;
    }

    if (endDate) {
      cronOptions.stopAt = endDate;
    }

    try {
      const cron = new Cron(schedule, cronOptions);
      const nextRun = cron.nextRun();

      if (!nextRun) {
        throw new CronExpressionError(
          schedule,
          'Could not calculate next run time (expression may be in the past or invalid)'
        );
      }

      return nextRun;
    } catch (error: any) {
      if (error instanceof CronExpressionError) {
        throw error;
      }

      throw new CronExpressionError(
        schedule,
        error.message || 'Failed to parse cron expression'
      );
    }
  }

  /**
   * Validate a cron expression without calculating next run
   *
   * @param schedule - Cron expression to validate
   * @param timezone - Timezone for validation (optional)
   * @returns Validation result with detailed feedback
   */
  static validate(
    schedule: string,
    timezone: string = SCHEDULER_DEFAULTS.DEFAULT_TIMEZONE
  ): CronValidationResult {
    try {
      const cron = new Cron(schedule, { timezone, paused: true });
      const nextRun = cron.nextRun();

      return {
        valid: true,
        nextRun: nextRun || undefined
      };
    } catch (error: any) {
      return {
        valid: false,
        error: error.message || 'Invalid cron expression'
      };
    }
  }

  /**
   * Simple boolean validation of cron expression
   *
   * @param schedule - Cron expression to validate
   * @returns True if valid, false otherwise
   */
  static isValid(schedule: string): boolean {
    return this.validate(schedule).valid;
  }

  /**
   * Get human-readable description of cron schedule
   *
   * @param schedule - Cron expression
   * @returns Human-readable description
   *
   * Note: This is a basic implementation. For production use, consider
   * integrating a library like cronstrue for more detailed descriptions.
   */
  static describe(schedule: string): string {
    // Basic descriptions for common patterns
    const patterns: Record<string, string> = {
      '* * * * *': 'Every minute',
      '0 * * * *': 'Every hour',
      '0 0 * * *': 'Daily at midnight',
      '0 0 * * 0': 'Weekly on Sunday at midnight',
      '0 0 1 * *': 'Monthly on the 1st at midnight',
      '0 0 1 1 *': 'Yearly on January 1st at midnight'
    };

    return patterns[schedule] || schedule;
  }

  /**
   * Calculate multiple next run times
   *
   * @param options - Cron calculation options
   * @param count - Number of occurrences to calculate
   * @returns Array of next run dates
   */
  static calculateNextRuns(
    options: CronCalculationOptions,
    count: number = 5
  ): Date[] {
    const {
      schedule,
      timezone = SCHEDULER_DEFAULTS.DEFAULT_TIMEZONE,
      startDate,
      endDate
    } = options;

    const cronOptions: any = {
      timezone,
      paused: true
    };

    if (startDate) {
      cronOptions.startAt = startDate;
    }

    if (endDate) {
      cronOptions.stopAt = endDate;
    }

    try {
      const cron = new Cron(schedule, cronOptions);
      const runs: Date[] = [];

      for (let i = 0; i < count; i++) {
        const nextRun = cron.nextRun();
        if (!nextRun) break;
        runs.push(nextRun);
      }

      return runs;
    } catch (error: any) {
      throw new CronExpressionError(
        schedule,
        error.message || 'Failed to calculate next runs'
      );
    }
  }

  /**
   * Check if a cron expression will run within a given time window
   *
   * @param schedule - Cron expression
   * @param windowMs - Time window in milliseconds
   * @param timezone - Timezone (optional)
   * @returns True if expression will run within the window
   */
  static willRunInWindow(
    schedule: string,
    windowMs: number,
    timezone: string = SCHEDULER_DEFAULTS.DEFAULT_TIMEZONE
  ): boolean {
    try {
      const nextRun = this.calculateNextRun({ schedule, timezone });
      const now = new Date();
      const windowEnd = new Date(now.getTime() + windowMs);

      return nextRun <= windowEnd;
    } catch {
      return false;
    }
  }

  /**
   * Common cron expression templates
   */
  static readonly Templates = {
    EVERY_MINUTE: '* * * * *',
    EVERY_5_MINUTES: '*/5 * * * *',
    EVERY_15_MINUTES: '*/15 * * * *',
    EVERY_30_MINUTES: '*/30 * * * *',
    EVERY_HOUR: '0 * * * *',
    EVERY_6_HOURS: '0 */6 * * *',
    EVERY_12_HOURS: '0 */12 * * *',
    DAILY_MIDNIGHT: '0 0 * * *',
    DAILY_NOON: '0 12 * * *',
    WEEKLY_SUNDAY: '0 0 * * 0',
    WEEKLY_MONDAY: '0 0 * * 1',
    MONTHLY_FIRST: '0 0 1 * *',
    YEARLY: '0 0 1 1 *'
  } as const;
}
