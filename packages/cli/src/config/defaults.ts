/**
 * Default configuration values for Agentic SDLC CLI
 */

import { CLIConfig, EnvironmentConfig } from '../types/index.js'

export const DEFAULT_CLI_CONFIG: CLIConfig = {
  // Service URLs
  orchestratorUrl: process.env.ORCHESTRATOR_URL || 'http://localhost:3000',
  analyticsUrl: process.env.ANALYTICS_URL || 'http://localhost:3002',

  // Database
  databaseUrl: process.env.DATABASE_URL || 'postgresql://user:password@localhost:5433/agentic_sdlc',

  // Redis
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6380',
  redisNamespace: 'agentic-sdlc',

  // Paths
  projectRoot: process.cwd(),
  scriptsDir: 'scripts',
  docsDir: 'docs',

  // Docker
  dockerComposeFile: 'docker-compose.yml',
  dockerNetwork: 'agentic-sdlc-network',

  // PM2
  pm2EcosystemFile: 'ecosystem.config.js',

  // Timeouts (in milliseconds)
  startTimeout: 120000, // 2 minutes
  stopTimeout: 30000, // 30 seconds
  healthCheckTimeout: 60000, // 1 minute

  // Output
  verbose: false,
  colorOutput: true,

  // Features
  features: {
    docker: true,
    pm2: true,
    kubernetes: false,
  },
}

export const DEFAULT_ENV_CONFIG: Partial<EnvironmentConfig> = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  DEBUG: process.env.DEBUG,
  VERBOSE: process.env.VERBOSE,
  REDIS_URL: process.env.REDIS_URL || DEFAULT_CLI_CONFIG.redisUrl,
  DATABASE_URL: process.env.DATABASE_URL || DEFAULT_CLI_CONFIG.databaseUrl,
  ORCHESTRATOR_URL: process.env.ORCHESTRATOR_URL || DEFAULT_CLI_CONFIG.orchestratorUrl,
  ANALYTICS_URL: process.env.ANALYTICS_URL || DEFAULT_CLI_CONFIG.analyticsUrl,
}

export const SERVICE_TIMEOUTS = {
  DOCKER_START: 60000, // 1 minute
  PM2_START: 30000, // 30 seconds
  HEALTH_CHECK: 5000, // 5 seconds
  BUILD: 180000, // 3 minutes
  TEST: 120000, // 2 minutes
}

export const EXIT_CODES = {
  SUCCESS: 0,
  GENERIC_ERROR: 1,
  INVALID_USAGE: 2,
  SERVICE_UNAVAILABLE: 3,
  DATABASE_ERROR: 4,
  PERMISSION_DENIED: 5,
  TIMEOUT: 6,
  CONFIGURATION_ERROR: 7,
  VALIDATION_FAILED: 8,
}

export const COMMAND_ALIASES = {
  up: 'start',
  down: 'stop',
  reload: 'restart',
}

export const SERVICES = {
  DOCKER: 'docker',
  PM2: 'pm2',
  DATABASE: 'database',
  REDIS: 'redis',
  ORCHESTRATOR: 'orchestrator',
  DASHBOARD: 'dashboard',
  ANALYTICS: 'analytics',
}
