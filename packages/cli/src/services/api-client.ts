/**
 * API Client Service - HTTP client to Orchestrator API
 * Handles all communication with the orchestrator microservice
 */

import { logger } from '../utils/logger.js'

export interface WorkflowResponse {
  id: string
  name?: string
  type: string
  status: TASK_STATUS.PENDING | WORKFLOW_STATUS.RUNNING | WORKFLOW_STATUS.COMPLETED | WORKFLOW_STATUS.FAILED | WORKFLOW_STATUS.CANCELLED
  createdAt: Date
  updatedAt: Date
  progress?: number
  stages?: Record<string, unknown>
  metadata?: Record<string, unknown>
}

export interface WorkflowCreateRequest extends Record<string, unknown> {
  name?: string
  type: WORKFLOW_TYPES.APP | WORKFLOW_TYPES.FEATURE | WORKFLOW_TYPES.BUGFIX | string
  definition?: string
  platformId?: string
  metadata?: Record<string, unknown>
}

export interface Agent {
  id: string
  type: string
  name: string
  status: 'online' | 'offline' | LOG_LEVEL.ERROR
  version: string
  capabilities: string[]
  platform?: string
  lastSeen?: Date
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: Date
  version?: string
  uptime?: number
  components?: Record<string, unknown>
}

export interface StatsOverview {
  totalWorkflows: number
  runningWorkflows: number
  completedWorkflows: number
  failedWorkflows: number
  totalAgents: number
  onlineAgents: number
  timestamp: Date
}

export interface Task {
  id: string
  workflowId: string
  agentType: string
  status: string
  payload?: Record<string, unknown>
  result?: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

export interface Trace {
  traceId: string
  workflowId: string
  parentTraceId?: string
  agentType: string
  stage: string
  status: string
  startTime: Date
  endTime?: Date
  duration?: number
  spans?: TraceSpan[]
  error?: string
}

export interface TraceSpan {
  spanId: string
  traceId: string
  name: string
  startTime: Date
  endTime?: Date
  duration?: number
  attributes?: Record<string, unknown>
  events?: TraceEvent[]
}

export interface TraceEvent {
  timestamp: Date
  name: string
  attributes?: Record<string, unknown>
}

export interface Platform {
  id: string
  name: string
  type: string
  description?: string
  config?: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

export interface RetryConfig {
  maxRetries: number
  backoffMs: number
  backoffMultiplier: number
}

export interface APIClientConfig {
  baseUrl: string
  timeout?: number
  retryConfig?: RetryConfig
  verbose?: boolean
}

export class APIClient {
  private baseUrl: string
  private timeout: number = 30000 // 30 seconds
  private retryConfig: RetryConfig = {
    maxRetries: 3,
    backoffMs: 1000,
    backoffMultiplier: 2,
  }
  private verbose: boolean = false

  constructor(config: APIClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '') // Remove trailing slash
    if (config.timeout) this.timeout = config.timeout
    if (config.retryConfig) this.retryConfig = config.retryConfig
    this.verbose = config.verbose ?? false

    logger.debug(`APIClient initialized with baseUrl: ${this.baseUrl}`)
  }

  /**
   * Health check endpoints
   */
  async getHealth(): Promise<HealthStatus> {
    return this.get<HealthStatus>('/health')
  }

  async getHealthReady(): Promise<HealthStatus> {
    return this.get<HealthStatus>('/health/ready')
  }

  async getHealthDetailed(): Promise<HealthStatus & Record<string, unknown>> {
    return this.get<HealthStatus & Record<string, unknown>>('/health/detailed')
  }

  /**
   * Workflow endpoints
   */
  async getWorkflows(filter?: Record<string, unknown>): Promise<WorkflowResponse[]> {
    return this.get<WorkflowResponse[]>('/api/v1/workflows', filter)
  }

  async getWorkflow(id: string): Promise<WorkflowResponse> {
    return this.get<WorkflowResponse>(`/api/v1/workflows/${id}`)
  }

  async createWorkflow(request: WorkflowCreateRequest): Promise<WorkflowResponse> {
    return this.post<WorkflowResponse>('/api/v1/workflows', request)
  }

  async cancelWorkflow(id: string): Promise<void> {
    return this.post<void>(`/api/v1/workflows/${id}/cancel`, {})
  }

  async retryWorkflow(id: string): Promise<WorkflowResponse> {
    return this.post<WorkflowResponse>(`/api/v1/workflows/${id}/retry`, {})
  }

  /**
   * Agent endpoints
   */
  async getAgents(): Promise<Agent[]> {
    return this.get<Agent[]>('/api/v1/agents')
  }

  async getAgentStatus(name: string): Promise<Agent> {
    return this.get<Agent>(`/api/v1/agents/${name}`)
  }

  /**
   * Stats endpoints
   */
  async getStatsOverview(period?: string): Promise<StatsOverview> {
    const params = period ? { period } : undefined
    return this.get<StatsOverview>('/api/v1/stats/overview', params)
  }

  async getStatsAgents(period?: string): Promise<Record<string, unknown>> {
    const params = period ? { period } : undefined
    return this.get<Record<string, unknown>>('/api/v1/stats/agents', params)
  }

  async getStatsTimeseries(period?: string): Promise<Record<string, unknown>[]> {
    const params = period ? { period } : undefined
    return this.get<Record<string, unknown>[]>('/api/v1/stats/timeseries', params)
  }

  async getStatsWorkflows(period?: string): Promise<Record<string, unknown>> {
    const params = period ? { period } : undefined
    return this.get<Record<string, unknown>>('/api/v1/stats/workflows', params)
  }

  /**
   * Task endpoints
   */
  async getTasks(filter?: Record<string, unknown>): Promise<Task[]> {
    return this.get<Task[]>('/api/v1/tasks', filter)
  }

  async getTask(id: string): Promise<Task> {
    return this.get<Task>(`/api/v1/tasks/${id}`)
  }

  /**
   * Trace endpoints
   */
  async getTrace(traceId: string): Promise<Trace> {
    return this.get<Trace>(`/api/v1/traces/${traceId}`)
  }

  async getTraceSpans(traceId: string): Promise<TraceSpan[]> {
    return this.get<TraceSpan[]>(`/api/v1/traces/${traceId}/spans`)
  }

  async getTraceWorkflows(traceId: string): Promise<WorkflowResponse[]> {
    return this.get<WorkflowResponse[]>(`/api/v1/traces/${traceId}/workflows`)
  }

  async getTraceTasks(traceId: string): Promise<Task[]> {
    return this.get<Task[]>(`/api/v1/traces/${traceId}/tasks`)
  }

  /**
   * Platform endpoints
   */
  async getPlatforms(): Promise<Platform[]> {
    return this.get<Platform[]>('/api/v1/platforms')
  }

  async getPlatform(id: string): Promise<Platform> {
    return this.get<Platform>(`/api/v1/platforms/${id}`)
  }

  async getPlatformAnalytics(
    id: string,
    period?: string
  ): Promise<Record<string, unknown>> {
    const params = period ? { period } : undefined
    return this.get<Record<string, unknown>>(`/api/v1/platforms/${id}/analytics`, params)
  }

  /**
   * Generic HTTP methods with retry logic
   */
  private async get<T>(
    path: string,
    query?: Record<string, unknown>
  ): Promise<T> {
    const url = this.buildUrl(path, query)
    return this.request<T>(url, {
      method: 'GET',
      headers: this.getHeaders(),
    })
  }

  private async post<T>(
    path: string,
    body: Record<string, unknown>
  ): Promise<T> {
    const url = this.buildUrl(path)
    return this.request<T>(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    })
  }

  private async request<T>(
    url: string,
    options: RequestInit
  ): Promise<T> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), this.timeout)

        if (this.verbose) {
          logger.debug(`API Request: ${options.method} ${url}`, { attempt })
        }

        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          const error = await this.parseErrorResponse(response)
          throw new Error(`HTTP ${response.status}: ${error}`)
        }

        const data = await response.json()

        if (this.verbose) {
          logger.debug(`API Response: ${options.method} ${url}`, {
            status: response.status,
            dataSize: JSON.stringify(data).length,
          })
        }

        return data as T
      } catch (error) {
        lastError = error as Error

        if (this.isRetryable(error) && attempt < this.retryConfig.maxRetries) {
          const delayMs =
            this.retryConfig.backoffMs *
            Math.pow(this.retryConfig.backoffMultiplier, attempt)

          logger.debug(`Retrying request (attempt ${attempt + 1}/${this.retryConfig.maxRetries})`, {
            error: lastError.message,
            delayMs,
          })

          await this.delay(delayMs)
        } else {
          logger.error(`API request failed: ${options.method} ${url}`, lastError)
          throw error
        }
      }
    }

    throw lastError || new Error('Unknown error in API request')
  }

  private buildUrl(path: string, query?: Record<string, unknown>): string {
    const url = new URL(`${this.baseUrl}${path}`)

    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value))
        }
      })
    }

    return url.toString()
  }

  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'User-Agent': 'agentic-sdlc-cli/1.0',
    }
  }

  private isRetryable(error: unknown): boolean {
    if (error instanceof TypeError) {
      // Network errors
      if (
        error.message.includes('fetch') ||
        error.message.includes('network') ||
        error.message.includes('ECONNREFUSED') ||
        error.message.includes('ENOTFOUND')
      ) {
        return true
      }
    }

    return false
  }

  private async parseErrorResponse(response: Response): Promise<string> {
    try {
      const data = await response.json() as Record<string, unknown>
      if (typeof data.error === 'string') {
        return data.error
      }
      if (typeof data.message === 'string') {
        return data.message
      }
      return JSON.stringify(data)
    } catch {
      return response.statusText || 'Unknown error'
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

/**
 * Singleton instance of API client
 */
let apiClientInstance: APIClient | null = null

export function initializeAPIClient(config: APIClientConfig): APIClient {
  apiClientInstance = new APIClient(config)
  return apiClientInstance
}

export function getAPIClient(): APIClient {
  if (!apiClientInstance) {
    const baseUrl = process.env.ORCHESTRATOR_URL || 'http://localhost:3051'
    apiClientInstance = new APIClient({
      baseUrl,
      timeout: 30000,
      verbose: process.env.VERBOSE === 'true',
    })
  }
  return apiClientInstance
}

/**
 * API Service wrapper - convenience layer
 */
export class APIService {
  constructor(private client: APIClient) {}

  async isHealthy(): Promise<boolean> {
    try {
      const health = await this.client.getHealth()
      return health.status !== 'unhealthy'
    } catch {
      return false
    }
  }

  async isReady(): Promise<boolean> {
    try {
      const health = await this.client.getHealthReady()
      return health.status !== 'unhealthy'
    } catch {
      return false
    }
  }

  async getSystemStatus(): Promise<{
    health: HealthStatus
    stats: StatsOverview
    agents: Agent[]
    platforms: Platform[]
  }> {
    const [health, stats, agents, platforms] = await Promise.all([
      this.client.getHealthReady(),
      this.client.getStatsOverview(),
      this.client.getAgents(),
      this.client.getPlatforms(),
    ])

    return { health, stats, agents, platforms }
  }
}

export const apiService = new APIService(getAPIClient())
