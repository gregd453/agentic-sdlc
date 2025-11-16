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

export interface IHealthService {
  check(): Promise<Record<string, unknown>>
  checkServices(): Promise<Record<string, unknown>>
  checkDatabase(): Promise<Record<string, unknown>>
  checkAgents(): Promise<Record<string, unknown>>
  waitUntilReady(timeout?: number): Promise<void>
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
  status(): Promise<DatabaseStatus>
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

export interface IAPIClient {
  getWorkflows(filter?: Record<string, unknown>): Promise<unknown[]>
  getWorkflow(id: string): Promise<unknown>
  getAgents(): Promise<unknown[]>
  getAgentStatus(name: string): Promise<unknown>
  getHealth(): Promise<unknown>
}
