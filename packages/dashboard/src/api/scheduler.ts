/**
 * Scheduler API Client
 *
 * API integration for scheduler management
 * Session #89: Scheduler UI Implementation
 */

import { getAPIBase } from './client';

// Create axios-like client using fetch
const apiClient = {
  async get<T>(url: string, config?: { params?: Record<string, any> }): Promise<{ data: T }> {
    const params = config?.params ? new URLSearchParams(config.params).toString() : '';
    const fullUrl = `${getAPIBase()}${url}${params ? `?${params}` : ''}`;
    const response = await fetch(fullUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return { data };
  },
  async post<T>(url: string, body?: any): Promise<{ data: T }> {
    const response = await fetch(`${getAPIBase()}${url}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return { data };
  },
  async put<T>(url: string, body?: any): Promise<{ data: T }> {
    const response = await fetch(`${getAPIBase()}${url}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return { data };
  },
  async delete(url: string): Promise<void> {
    const response = await fetch(`${getAPIBase()}${url}`, { method: 'DELETE' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  },
};

// ==========================================
// TYPES
// ==========================================

export type JobType = 'cron' | 'one_time' | 'recurring' | 'event';
export type JobStatus = 'pending' | 'active' | 'paused' | 'completed' | 'failed' | 'cancelled';
export type ExecutionStatus = 'pending' | 'running' | 'success' | 'failed' | 'timeout' | 'cancelled' | 'skipped';
export type Priority = 'low' | 'medium' | 'high' | 'critical';
export type HandlerType = 'function' | 'agent' | 'workflow';

export interface Job {
  id: string;
  name: string;
  description?: string;
  type: JobType;
  status: JobStatus;
  schedule?: string;
  timezone?: string;
  next_run?: string;
  last_run?: string;
  start_date?: string;
  end_date?: string;
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
  created_at: string;
  updated_at: string;
  completed_at?: string;
  cancelled_at?: string;
}

export interface JobExecution {
  id: string;
  job_id: string;
  status: ExecutionStatus;
  scheduled_at: string;
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
  result?: any;
  error?: string;
  error_stack?: string;
  retry_count: number;
  max_retries: number;
  next_retry_at?: string;
  worker_id?: string;
  metadata?: Record<string, any>;
  trace_id?: string;
  span_id?: string;
  created_at: string;
}

export interface CreateCronJobInput {
  name: string;
  description?: string;
  schedule: string;
  timezone?: string;
  handler_name: string;
  handler_type?: HandlerType;
  payload?: any;
  enabled?: boolean;
  max_retries?: number;
  retry_delay_ms?: number;
  timeout_ms?: number;
  priority?: Priority;
  concurrency?: number;
  allow_overlap?: boolean;
  tags?: string[];
  metadata?: Record<string, any>;
  platform_id?: string;
  created_by: string;
}

export interface CreateOneTimeJobInput {
  name: string;
  description?: string;
  execute_at: string;
  handler_name: string;
  handler_type?: HandlerType;
  payload?: any;
  max_retries?: number;
  retry_delay_ms?: number;
  timeout_ms?: number;
  priority?: Priority;
  tags?: string[];
  metadata?: Record<string, any>;
  platform_id?: string;
  created_by: string;
}

export interface JobFilters {
  type?: JobType;
  status?: JobStatus;
  platform_id?: string;
  limit?: number;
  offset?: number;
}

export interface HistoryOptions {
  limit?: number;
  offset?: number;
  status?: ExecutionStatus;
}

export interface EventHandler {
  id: string;
  event_name: string;
  handler_name: string;
  handler_type: string;
  enabled: boolean;
  priority: number;
  action_type?: string;
  action_config?: any;
  platform_id?: string;
  trigger_count: number;
  success_count: number;
  failure_count: number;
  created_at: string;
  last_triggered?: string;
}

// ==========================================
// API CLIENT
// ==========================================

export const schedulerApi = {
  // ==========================================
  // JOBS
  // ==========================================

  /**
   * Create a cron job
   */
  createCronJob: async (data: CreateCronJobInput): Promise<Job> => {
    const response = await apiClient.post<Job>('/scheduler/jobs/cron', data);
    return response.data;
  },

  /**
   * Create a one-time job
   */
  createOneTimeJob: async (data: CreateOneTimeJobInput): Promise<Job> => {
    const response = await apiClient.post<Job>('/scheduler/jobs/once', data);
    return response.data;
  },

  /**
   * Get job by ID
   */
  getJob: async (jobId: string): Promise<Job> => {
    const response = await apiClient.get<Job>(`/scheduler/jobs/${jobId}`);
    return response.data;
  },

  /**
   * List jobs with filters
   */
  listJobs: async (filters?: JobFilters): Promise<Job[]> => {
    const response = await apiClient.get<Job[]>('/scheduler/jobs', { params: filters });
    return response.data;
  },

  /**
   * Update job schedule
   */
  updateSchedule: async (jobId: string, schedule: string): Promise<Job> => {
    const response = await apiClient.put<Job>(`/scheduler/jobs/${jobId}/schedule`, { schedule });
    return response.data;
  },

  /**
   * Pause job
   */
  pauseJob: async (jobId: string): Promise<void> => {
    await apiClient.post(`/scheduler/jobs/${jobId}/pause`);
  },

  /**
   * Resume job
   */
  resumeJob: async (jobId: string): Promise<void> => {
    await apiClient.post(`/scheduler/jobs/${jobId}/resume`);
  },

  /**
   * Delete job
   */
  deleteJob: async (jobId: string): Promise<void> => {
    await apiClient.delete(`/scheduler/jobs/${jobId}`);
  },

  // ==========================================
  // EXECUTIONS
  // ==========================================

  /**
   * Get job execution history
   */
  getJobHistory: async (jobId: string, options?: HistoryOptions): Promise<JobExecution[]> => {
    const response = await apiClient.get<JobExecution[]>(
      `/scheduler/jobs/${jobId}/executions`,
      { params: options }
    );
    return response.data;
  },

  /**
   * Get execution details
   */
  getExecution: async (executionId: string): Promise<JobExecution> => {
    const response = await apiClient.get<JobExecution>(`/scheduler/executions/${executionId}`);
    return response.data;
  },

  /**
   * Retry failed execution
   */
  retryExecution: async (executionId: string): Promise<JobExecution> => {
    const response = await apiClient.post<JobExecution>(`/scheduler/executions/${executionId}/retry`);
    return response.data;
  },

  // ==========================================
  // EVENTS
  // ==========================================

  /**
   * Trigger event manually
   */
  triggerEvent: async (data: {
    event_name: string;
    data: any;
    platform_id?: string;
    trace_id?: string;
  }): Promise<void> => {
    await apiClient.post('/scheduler/events/trigger', data);
  },
};
