/**
 * Scheduler Port Interface
 *
 * Defines the contract for job scheduling operations.
 *
 * Session #89: Phase 1 - Foundation
 */

import { Priority } from '@prisma/client';

// ==========================================
// CORE TYPES
// ==========================================

export type JobType = 'cron' | 'one_time' | 'recurring' | 'event';
export type JobStatus = 'pending' | 'active' | 'paused' | 'completed' | 'failed' | 'cancelled';
export type ExecutionStatus = 'pending' | 'running' | 'success' | 'failed' | 'timeout' | 'cancelled' | 'skipped';
export type HandlerType = 'function' | 'agent' | 'workflow';

// ==========================================
// JOB INPUT TYPES
// ==========================================

export interface ScheduledJobInput {
  // Identity
  id?: string;
  name: string;
  description?: string;

  // Schedule
  schedule: string;              // Cron expression
  timezone?: string;             // IANA timezone (default: UTC)

  // Handler
  handler_name: string;          // Registered handler name
  handler_type?: HandlerType;    // Type of handler
  payload?: any;                 // Data passed to handler

  // Configuration
  enabled?: boolean;
  max_retries?: number;
  retry_delay_ms?: number;
  timeout_ms?: number;
  priority?: Priority;
  concurrency?: number;
  allow_overlap?: boolean;

  // Organization
  tags?: string[];
  metadata?: Record<string, any>;

  // Platform Context
  platform_id?: string;
  created_by: string;
}

export interface OneTimeJobInput {
  // Identity
  id?: string;
  name: string;
  description?: string;

  // Timing
  execute_at: Date;              // Exact execution time

  // Handler
  handler_name: string;
  handler_type?: HandlerType;
  payload?: any;

  // Configuration
  max_retries?: number;
  retry_delay_ms?: number;
  timeout_ms?: number;
  priority?: Priority;

  // Organization
  tags?: string[];
  metadata?: Record<string, any>;

  // Platform Context
  platform_id?: string;
  created_by: string;
}

export interface RecurringJobInput extends ScheduledJobInput {
  // Time Boundaries
  start_date: Date;
  end_date?: Date;

  // Execution Limits
  max_executions?: number;

  // Behavior
  skip_if_overdue?: boolean;
}

// ==========================================
// JOB OUTPUT TYPES
// ==========================================

export interface Job {
  id: string;
  name: string;
  description?: string;
  type: JobType;
  status: JobStatus;
  schedule?: string;
  timezone?: string;
  next_run?: Date;
  last_run?: Date;
  start_date?: Date;
  end_date?: Date;
  max_executions?: number;
  handler_name: string;
  handler_type: HandlerType;
  payload?: any;
  max_retries: number;
  retry_delay_ms: number;
  timeout_ms: number;
  priority: Priority;
  concurrency: number;
  allow_overlap: boolean;
  executions_count: number;
  success_count: number;
  failure_count: number;
  avg_duration_ms?: number;
  tags: string[];
  metadata?: Record<string, any>;
  platform_id?: string;
  created_by: string;
  created_at: Date;
  updated_at: Date;
  completed_at?: Date;
  cancelled_at?: Date;
}

export interface JobExecution {
  id: string;
  job_id: string;
  status: ExecutionStatus;
  scheduled_at: Date;
  started_at?: Date;
  completed_at?: Date;
  duration_ms?: number;
  result?: any;
  error?: string;
  error_stack?: string;
  retry_count: number;
  max_retries: number;
  next_retry_at?: Date;
  worker_id?: string;
  metadata?: Record<string, any>;
  trace_id?: string;
  span_id?: string;
  parent_span_id?: string;
  created_at: Date;
}

// ==========================================
// FILTER & QUERY TYPES
// ==========================================

export interface JobFilter {
  type?: JobType | JobType[];
  status?: JobStatus | JobStatus[];
  tags?: string[];
  tags_all?: string[];
  created_after?: Date;
  created_before?: Date;
  next_run_after?: Date;
  next_run_before?: Date;
  name_contains?: string;
  platform_id?: string;
  created_by?: string;
  limit?: number;
  offset?: number;
  sort_by?: 'created_at' | 'next_run' | 'name' | 'priority';
  sort_order?: 'asc' | 'desc';
}

export interface HistoryOptions {
  limit?: number;
  offset?: number;
  status?: ExecutionStatus;
  since?: Date;
  until?: Date;
  include_logs?: boolean;
  sort_order?: 'asc' | 'desc';
}

// ==========================================
// METRICS TYPES
// ==========================================

export interface SchedulerMetrics {
  jobs: {
    total: number;
    active: number;
    paused: number;
    completed: number;
    failed: number;
    cancelled: number;
  };
  executions: {
    total: number;
    successful: number;
    failed: number;
    timeout: number;
    cancelled: number;
    pending: number;
    running: number;
  };
  performance: {
    success_rate: number;
    avg_duration_ms: number;
    p50_duration_ms: number;
    p95_duration_ms: number;
    p99_duration_ms: number;
  };
  queue: {
    size: number;
    processing: number;
    delayed: number;
    failed: number;
  };
  system: {
    workers: number;
    memory_usage_mb: number;
    cpu_usage_percent: number;
    uptime_seconds: number;
  };
  time_range: {
    start: Date;
    end: Date;
  };
  generated_at: Date;
}

export interface JobStats {
  job_id: string;
  job_name: string;
  total_executions: number;
  successful: number;
  failed: number;
  timeout: number;
  success_rate: number;
  avg_duration_ms: number;
  min_duration_ms: number;
  max_duration_ms: number;
  last_execution?: {
    execution_id: string;
    status: ExecutionStatus;
    started_at: Date;
    duration_ms?: number;
  };
  next_execution?: {
    scheduled_at: Date;
    estimated_duration_ms: number;
  };
  failure_patterns?: Array<{
    error_type: string;
    count: number;
    last_occurrence: Date;
  }>;
  busiest_hours: Array<{
    hour: number;
    execution_count: number;
  }>;
  generated_at: Date;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  components: {
    scheduler: {
      status: 'up' | 'down';
      message?: string;
    };
    database: {
      status: 'up' | 'down';
      latency_ms?: number;
      message?: string;
    };
    queue: {
      status: 'up' | 'down';
      message?: string;
    };
    workers: {
      status: 'up' | 'down';
      active_count: number;
      message?: string;
    };
  };
  issues?: Array<{
    component: string;
    severity: 'warning' | 'error' | 'critical';
    message: string;
    since: Date;
  }>;
  timestamp: Date;
  uptime_seconds: number;
}

// ==========================================
// SCHEDULER PORT (Interface)
// ==========================================

export interface IScheduler {
  // ==========================================
  // JOB SCHEDULING METHODS
  // ==========================================

  /**
   * Schedule a recurring job using cron expression
   */
  schedule(job: ScheduledJobInput): Promise<Job>;

  /**
   * Schedule a single execution at a specific time
   */
  scheduleOnce(job: OneTimeJobInput): Promise<Job>;

  /**
   * Schedule recurring job with start/end dates and execution limits
   */
  scheduleRecurring(job: RecurringJobInput): Promise<Job>;

  /**
   * Update the schedule of an existing job
   */
  reschedule(jobId: string, newSchedule: string): Promise<Job>;

  /**
   * Cancel and remove a scheduled job
   */
  unschedule(jobId: string): Promise<void>;

  // ==========================================
  // EVENT-BASED METHODS
  // ==========================================

  /**
   * Register handler to execute when event occurs
   */
  onEvent(event: string, handler: EventHandlerFunction, options?: EventHandlerOptions): Promise<void>;

  /**
   * Trigger an event that handlers are listening for
   */
  triggerEvent(event: string, data: any): Promise<void>;

  // ==========================================
  // JOB MANAGEMENT METHODS
  // ==========================================

  /**
   * Retrieve job details by ID
   */
  getJob(jobId: string): Promise<Job | null>;

  /**
   * List jobs with optional filtering
   */
  listJobs(filter?: JobFilter): Promise<Job[]>;

  /**
   * Temporarily stop job execution
   */
  pauseJob(jobId: string): Promise<void>;

  /**
   * Resume a paused job
   */
  resumeJob(jobId: string): Promise<void>;

  /**
   * Permanently cancel a job
   */
  cancelJob(jobId: string): Promise<void>;

  // ==========================================
  // EXECUTION HISTORY METHODS
  // ==========================================

  /**
   * Get execution history for a job
   */
  getJobHistory(jobId: string, options?: HistoryOptions): Promise<JobExecution[]>;

  /**
   * Get details of a specific execution
   */
  getExecution(executionId: string): Promise<JobExecution | null>;

  /**
   * Manually retry a failed execution
   */
  retryExecution(executionId: string): Promise<JobExecution>;

  // ==========================================
  // MONITORING METHODS
  // ==========================================

  /**
   * Get scheduler performance metrics
   */
  getMetrics(start?: Date, end?: Date): Promise<SchedulerMetrics>;

  /**
   * Check if scheduler is operational
   */
  healthCheck(): Promise<HealthStatus>;

  /**
   * Get statistics for a specific job
   */
  getJobStats(jobId: string): Promise<JobStats>;
}

// ==========================================
// EVENT HANDLER TYPES
// ==========================================

export type EventHandlerFunction = (data: any) => Promise<void> | void;

export interface EventHandlerOptions {
  priority?: number;
  enabled?: boolean;
  platform_id?: string;
  action?: {
    type: 'create_job' | 'trigger_workflow' | 'dispatch_agent';
    config: any;
  };
}
