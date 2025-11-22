/**
 * Scheduler Service Constants
 *
 * Centralized configuration for all scheduler-related services
 * Session #91: Extracted from magic numbers across scheduler services
 */

/**
 * Default configuration values for scheduler operations
 */
export const SCHEDULER_DEFAULTS = {
  // Retry configuration
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 60_000, // 1 minute
  MAX_RETRY_DELAY_MS: 3_600_000, // 1 hour
  BACKOFF_MULTIPLIER: 2,

  // Timeout configuration
  JOB_TIMEOUT_MS: 300_000, // 5 minutes
  DATABASE_QUERY_TIMEOUT_MS: 5_000, // 5 seconds
  SUBSCRIPTION_TIMEOUT_MS: 3_000, // 3 seconds
  INITIALIZATION_TIMEOUT_MS: 10_000, // 10 seconds

  // Concurrency
  DEFAULT_CONCURRENCY: 1,
  MAX_BATCH_SIZE: 100,

  // Intervals and polling
  DISPATCHER_INTERVAL_MS: 60_000, // 1 minute
  BROADCAST_INTERVAL_MS: 5_000, // 5 seconds
  CONSUMER_BLOCK_MS: 5_000, // 5 seconds
  HEALTH_CHECK_INTERVAL_MS: 30_000, // 30 seconds

  // Cache and cleanup
  METRICS_CACHE_TTL_SEC: 300, // 5 minutes
  RETENTION_DAYS: 30,

  // Shutdown and error handling
  GRACEFUL_SHUTDOWN_DELAY_MS: 100,
  ERROR_BACKOFF_MS: 5_000, // 5 seconds

  // Default timezone
  DEFAULT_TIMEZONE: 'UTC'
} as const;

/**
 * Built-in job handlers with their configurations
 */
export const BUILT_IN_HANDLERS = {
  KB_REINDEX: {
    NAME: 'kb:reindex',
    TIMEOUT_MS: 300_000, // 5 minutes
    DESCRIPTION: 'Reindex knowledge base'
  },
  CLEANUP_TRACES: {
    NAME: 'cleanup:old_traces',
    TIMEOUT_MS: 600_000, // 10 minutes
    DEFAULT_RETENTION_DAYS: 30,
    DESCRIPTION: 'Clean up old trace data'
  },
  CLEANUP_EXECUTIONS: {
    NAME: 'cleanup:old_executions',
    TIMEOUT_MS: 600_000, // 10 minutes
    DEFAULT_RETENTION_DAYS: 90,
    DESCRIPTION: 'Clean up old job execution records'
  },
  BACKUP_DATABASE: {
    NAME: 'backup:database',
    TIMEOUT_MS: 1_800_000, // 30 minutes
    DESCRIPTION: 'Create database backup'
  },
  HEALTH_CHECK: {
    NAME: 'health:check',
    TIMEOUT_MS: 30_000, // 30 seconds
    DESCRIPTION: 'System health check'
  }
} as const;

/**
 * Job status values
 */
export const JOB_STATUS = {
  ACTIVE: 'active',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  FAILED: 'failed'
} as const;

/**
 * Job types
 */
export const JOB_TYPE = {
  CRON: 'cron',
  ONE_TIME: 'one_time',
  RECURRING: 'recurring',
  EVENT: 'event'
} as const;

/**
 * Job priority levels
 */
export const JOB_PRIORITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
} as const;

/**
 * Execution status values
 */
export const EXECUTION_STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  SUCCESS: 'success',
  FAILED: 'failed',
  TIMEOUT: 'timeout',
  CANCELLED: 'cancelled'
} as const;

/**
 * Event handler action types
 */
export const EVENT_ACTION_TYPE = {
  CREATE_JOB: 'create_job',
  TRIGGER_WORKFLOW: 'trigger_workflow',
  DISPATCH_AGENT: 'dispatch_agent',
  SEND_NOTIFICATION: 'send_notification',
  WEBHOOK: 'webhook'
} as const;

/**
 * Event names for scheduler system
 */
export const SCHEDULER_EVENTS = {
  JOB_CREATED: 'scheduler:job.created',
  JOB_UPDATED: 'scheduler:job.updated',
  JOB_DELETED: 'scheduler:job.deleted',
  JOB_PAUSED: 'scheduler:job.paused',
  JOB_RESUMED: 'scheduler:job.resumed',
  JOB_CANCELLED: 'scheduler:job.cancelled',
  JOB_DISPATCH: 'scheduler:job.dispatch',
  EXECUTION_SUCCESS: 'scheduler:job.execution.success',
  EXECUTION_FAILED: 'scheduler:job.execution.failed',
  EXECUTION_RETRY: 'scheduler:job.execution.retry_scheduled'
} as const;

/**
 * Redis stream names for scheduler
 */
export const SCHEDULER_STREAMS = {
  JOB_DISPATCH: 'stream:scheduler:job.dispatch',
  JOB_RESULTS: 'stream:scheduler:job.results',
  EVENTS: 'stream:scheduler:events'
} as const;

/**
 * Consumer group names
 */
export const CONSUMER_GROUPS = {
  JOB_EXECUTOR: 'scheduler:job-executor',
  JOB_DISPATCHER: 'scheduler:job-dispatcher',
  EVENT_PROCESSOR: 'scheduler:event-processor'
} as const;

/**
 * WebSocket message types for monitoring
 */
export const WS_MESSAGE_TYPE = {
  METRICS_UPDATE: 'metrics:update',
  JOB_DISPATCHED: 'job:dispatched',
  JOB_COMPLETED: 'job:completed',
  JOB_FAILED: 'job:failed',
  SYSTEM_STATUS: 'system:status'
} as const;

/**
 * Type exports for type safety
 */
export type JobStatus = typeof JOB_STATUS[keyof typeof JOB_STATUS];
export type JobType = typeof JOB_TYPE[keyof typeof JOB_TYPE];
export type JobPriority = typeof JOB_PRIORITY[keyof typeof JOB_PRIORITY];
export type ExecutionStatus = typeof EXECUTION_STATUS[keyof typeof EXECUTION_STATUS];
export type EventActionType = typeof EVENT_ACTION_TYPE[keyof typeof EVENT_ACTION_TYPE];
