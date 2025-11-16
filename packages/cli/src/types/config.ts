/**
 * Configuration type definitions
 */

export interface CLIConfig {
  // Service URLs
  orchestratorUrl: string
  analyticsUrl: string

  // Database
  databaseUrl: string

  // Redis
  redisUrl: string
  redisNamespace: string

  // Paths
  projectRoot: string
  scriptsDir: string
  docsDir: string

  // Docker
  dockerComposeFile: string
  dockerNetwork: string

  // PM2
  pm2EcosystemFile: string

  // Timeouts
  startTimeout: number // ms
  stopTimeout: number // ms
  healthCheckTimeout: number // ms

  // Output
  verbose: boolean
  colorOutput: boolean

  // Features
  features: {
    docker: boolean
    pm2: boolean
    kubernetes: boolean
  }
}

export interface EnvironmentConfig {
  NODE_ENV: string
  DEBUG?: string
  VERBOSE?: string
  REDIS_URL: string
  DATABASE_URL: string
  ORCHESTRATOR_URL: string
  ANALYTICS_URL: string
}

export interface ServiceConfig {
  name: string
  command: string
  enabled: boolean
  timeout?: number
  healthCheck?: string
  dependsOn?: string[]
}
