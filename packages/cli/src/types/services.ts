/**
 * Service interface definitions
 */

export interface IEnvironmentService {
  start(): Promise<void>
  stop(force?: boolean): Promise<void>
  restart(service?: string): Promise<void>
  status(): Promise<Record<string, unknown>>
  reset(): Promise<void>
}

import type { HealthCheckResult } from './commands.js'

export interface IHealthService {
  check(verbose?: boolean): Promise<HealthCheckResult>
  checkInfrastructure(): Promise<Record<string, unknown>>
  checkDatabase(): Promise<Record<string, unknown>>
  checkCache(): Promise<Record<string, unknown>>
  checkServices(): Promise<Record<string, unknown>>
  checkAgents(): Promise<Record<string, unknown>>
}

export interface ILogsService {
  tail(options: TailOptions): Promise<string[]>
  stream(options: StreamOptions): Promise<NodeJS.ReadableStream>
  grep(pattern: string, options?: GrepOptions): Promise<string[]>
}

export interface TailOptions {
  service?: string
  lines?: number
  since?: Date
}

export interface StreamOptions {
  service?: string
  follow?: boolean
}

export interface GrepOptions {
  service?: string
  lines?: number
}

export interface ITestService {
  runTests(tier: number): Promise<TestResult>
  listTests(): Promise<TestCase[]>
  runSpecific(pattern: string): Promise<TestResult>
}

export interface TestCase {
  id: string
  name: string
  tier: number
  command: string
  timeout: number
}

export interface TestResult {
  passed: number
  failed: number
  skipped: number
  duration: number
  tests: TestDetail[]
}

export interface TestDetail {
  name: string
  status: 'pass' | 'fail' | 'skip'
  duration: number
  error?: string
}

export interface IDeployService {
  validate(): Promise<ValidationResult>
  deploy(env: 'staging' | 'production', dryRun?: boolean): Promise<DeploymentResult>
  rollback(env: string): Promise<void>
  status(env: string): Promise<DeploymentStatus>
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export interface DeploymentResult {
  success: boolean
  environment: string
  version: string
  duration: number
  message: string
}

export interface DeploymentStatus {
  environment: string
  status: 'deployed' | 'deploying' | 'failed'
  version: string
  deployedAt: Date
  rollbackAvailable: boolean
}

export interface IDatabaseService {
  setup(): Promise<void>
  migrate(): Promise<MigrationResult>
  reset(): Promise<void>
  seed(): Promise<void>
  backup(): Promise<string>
  restore(backupPath: string): Promise<void>
  status(): Promise<DatabaseStatus>
  listBackups(): BackupInfo[]
  cleanupOldBackups(keepRecent?: number): number
}

export interface MigrationResult {
  applied: number
  pending: number
  duration: number
}

export interface DatabaseStatus {
  connected: boolean
  migrations: { applied: number; total: number }
  tables: number
  records: number
  size: string
}

export interface BackupInfo {
  timestamp: Date
  path: string
  size: string
  tables: number
  records: number
}

export interface ConfigValue {
  value: unknown
  source: 'default' | 'user' | 'project' | 'env' | 'cli'
}

export interface IConfigService {
  get(key: string): unknown
  getWithSource(key: string): ConfigValue | undefined
  set(key: string, value: unknown): void
  getAll(): Record<string, unknown>
  getAllWithSources(): Record<string, ConfigValue>
  saveProjectConfig(keys?: string[]): void
  saveUserConfig(keys?: string[]): void
  resetToDefaults(): void
  resetKeys(keys: string[]): void
  deleteProjectConfig(): void
  deleteUserConfig(): void
  validate(): { valid: boolean; errors: string[] }
  getPaths(): { userConfig: string; projectConfig: string; envFile: string }
}

export interface WorkflowResponse {
  id: string
  name?: string
  type: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  createdAt: Date
  updatedAt: Date
  progress?: number
}

export interface Agent {
  id: string
  type: string
  name: string
  status: 'online' | 'offline' | 'error'
  version: string
  capabilities: string[]
  platform?: string
  lastSeen?: Date
}

export interface HealthCheckStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: Date
  version?: string
}

export interface IAPIClient {
  // Health endpoints
  getHealth(): Promise<HealthCheckStatus>
  getHealthReady(): Promise<HealthCheckStatus>
  getHealthDetailed(): Promise<Record<string, unknown>>

  // Workflow endpoints
  getWorkflows(filter?: Record<string, unknown>): Promise<WorkflowResponse[]>
  getWorkflow(id: string): Promise<WorkflowResponse>
  createWorkflow(request: Record<string, unknown>): Promise<WorkflowResponse>
  cancelWorkflow(id: string): Promise<void>
  retryWorkflow(id: string): Promise<WorkflowResponse>

  // Agent endpoints
  getAgents(): Promise<Agent[]>
  getAgentStatus(name: string): Promise<Agent>

  // Stats endpoints
  getStatsOverview(period?: string): Promise<Record<string, unknown>>
  getStatsAgents(period?: string): Promise<Record<string, unknown>>
  getStatsTimeseries(period?: string): Promise<Record<string, unknown>[]>
  getStatsWorkflows(period?: string): Promise<Record<string, unknown>>

  // Task endpoints
  getTasks(filter?: Record<string, unknown>): Promise<Record<string, unknown>[]>
  getTask(id: string): Promise<Record<string, unknown>>

  // Trace endpoints
  getTrace(traceId: string): Promise<Record<string, unknown>>
  getTraceSpans(traceId: string): Promise<Record<string, unknown>[]>
  getTraceWorkflows(traceId: string): Promise<WorkflowResponse[]>
  getTraceTasks(traceId: string): Promise<Record<string, unknown>[]>

  // Platform endpoints
  getPlatforms(): Promise<Record<string, unknown>[]>
  getPlatform(id: string): Promise<Record<string, unknown>>
  getPlatformAnalytics(id: string, period?: string): Promise<Record<string, unknown>>
}
