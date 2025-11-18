/**
 * Command and CLI type definitions
 */

export interface CommandOptions {
  verbose?: boolean
  json?: boolean
  yaml?: boolean
  force?: boolean
  confirm?: boolean
  watch?: boolean
  follow?: boolean
  lines?: number
  service?: string
  services?: string
  tier?: number
  match?: string
  parallel?: boolean
  timeout?: number
  output?: 'json' | 'table' | 'yaml'
  env?: 'staging' | 'production'
  'dry-run'?: boolean
  approve?: boolean
  period?: string
  status?: string
  platform?: string
  skip?: string
  'skip-build'?: boolean
}

export interface CommandResult<T = unknown> {
  success: boolean
  code: number
  message: string
  data?: T
  duration?: number
  error?: Error | string
}

export interface CLIContext {
  verbose: boolean
  json: boolean
  cwd: string
  env: Record<string, string>
}

export interface ServiceStatus {
  name: string
  status: WORKFLOW_STATUS.RUNNING | 'stopped' | LOG_LEVEL.ERROR
  healthy: boolean
  message?: string
  uptime?: number
  pid?: number
}

export interface EnvironmentStatus {
  docker: ServiceStatus
  pm2: ServiceStatus
  database: ServiceStatus
  redis: ServiceStatus
  orchestrator: ServiceStatus
  dashboard: ServiceStatus
  analytics: ServiceStatus
  agents: ServiceStatus[]
}

export interface HealthCheckResult {
  infrastructure: {
    docker: boolean
    memory: { used: number; total: number }
    disk: { free: number; total: number }
    ports: { [key: string]: boolean }
  }
  database: {
    connected: boolean
    latency?: number
    migrations?: { applied: number; total: number }
  }
  messageBus: {
    connected: boolean
    latency?: number
  }
  services: ServiceStatus[]
  agents: {
    total: number
    healthy: number
    unhealthy: AgentStatus[]
  }
  summary: 'healthy' | 'degraded' | 'unhealthy'
}

export interface AgentStatus {
  name: string
  type: string
  status: WORKFLOW_STATUS.RUNNING | 'stopped' | LOG_LEVEL.ERROR
  platform?: string
  registered: boolean
  instances: number
  latency?: number
  error?: string
}

export type CommandHandler<T = unknown> = (
  options: CommandOptions,
  context: CLIContext
) => Promise<CommandResult<T>>
