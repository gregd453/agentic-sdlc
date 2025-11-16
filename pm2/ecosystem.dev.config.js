/**
 * PM2 Ecosystem Configuration - DEV/PILOT ENVIRONMENT
 *
 * Strategic Context:
 * - PM2 is for dev/pilot only, NOT production orchestration
 * - Production will use container orchestration (ECS/K8s)
 * - This provides process supervision, auto-restart, and monitoring
 *
 * Prerequisites:
 * 1. All packages built: pnpm build
 * 2. Redis running: docker-compose up -d redis
 * 3. PostgreSQL running: docker-compose up -d postgres
 *
 * Usage:
 *   pnpm pm2:start      # Start all services
 *   pnpm pm2:logs       # Tail logs from all processes
 *   pnpm pm2:monit      # Live monitoring dashboard
 *   pnpm pm2:stop       # Stop all services
 *   pnpm pm2:status     # Process status
 */

const path = require('path');
const projectRoot = path.resolve(__dirname, '..');

module.exports = {
  apps: [
    // ==========================================
    // ORCHESTRATOR
    // ==========================================
    {
      name: 'orchestrator',
      script: './packages/orchestrator/dist/server.js',
      cwd: projectRoot,

      // Environment
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
        DATABASE_URL: process.env.DATABASE_URL || 'postgresql://agentic:agentic_dev@localhost:5433/agentic_sdlc',
        REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6380',
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY
      },

      // Process Management
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,  // Explicit rebuilds (more reliable than watch)
      max_memory_restart: '1G',

      // Restart Policies
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,

      // Logging (uses existing scripts/logs/ structure)
      error_file: './scripts/logs/orchestrator-error.log',
      out_file: './scripts/logs/orchestrator-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,

      // Health & Monitoring
      listen_timeout: 10000,
      kill_timeout: 5000
    },

    // ==========================================
    // SCAFFOLD AGENT
    // ==========================================
    {
      name: 'agent-scaffold',
      script: './packages/agents/scaffold-agent/dist/run-agent.js',
      cwd: projectRoot,

      env: {
        NODE_ENV: 'development',
        REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6380',
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY
      },

      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',

      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,

      error_file: './scripts/logs/scaffold-agent-error.log',
      out_file: './scripts/logs/scaffold-agent-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,

      listen_timeout: 10000,
      kill_timeout: 5000
    },

    // ==========================================
    // VALIDATION AGENT
    // ==========================================
    {
      name: 'agent-validation',
      script: './packages/agents/validation-agent/dist/run-agent.js',
      cwd: projectRoot,

      env: {
        NODE_ENV: 'development',
        REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6380',
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY
      },

      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',

      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,

      error_file: './scripts/logs/validation-agent-error.log',
      out_file: './scripts/logs/validation-agent-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,

      listen_timeout: 10000,
      kill_timeout: 5000
    },

    // ==========================================
    // E2E AGENT
    // ==========================================
    {
      name: 'agent-e2e',
      script: './packages/agents/e2e-agent/dist/run-agent.js',
      cwd: projectRoot,

      env: {
        NODE_ENV: 'development',
        REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6380',
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY
      },

      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',

      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,

      error_file: './scripts/logs/e2e-agent-error.log',
      out_file: './scripts/logs/e2e-agent-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,

      listen_timeout: 10000,
      kill_timeout: 5000
    },

    // ==========================================
    // INTEGRATION AGENT
    // ==========================================
    {
      name: 'agent-integration',
      script: './packages/agents/integration-agent/dist/run-agent.js',
      cwd: projectRoot,

      env: {
        NODE_ENV: 'development',
        REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6380',
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY
      },

      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',

      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,

      error_file: './scripts/logs/integration-agent-error.log',
      out_file: './scripts/logs/integration-agent-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,

      listen_timeout: 10000,
      kill_timeout: 5000
    },

    // ==========================================
    // DEPLOYMENT AGENT
    // ==========================================
    {
      name: 'agent-deployment',
      script: './packages/agents/deployment-agent/dist/run-agent.js',
      cwd: projectRoot,

      env: {
        NODE_ENV: 'development',
        REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6380',
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY
      },

      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',

      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,

      error_file: './scripts/logs/deployment-agent-error.log',
      out_file: './scripts/logs/deployment-agent-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,

      listen_timeout: 10000,
      kill_timeout: 5000
    },

    // ==========================================
    // DASHBOARD
    // ==========================================
    // NOTE: Dashboard is now managed via Docker only (docker-compose.simple.yml)
    // This avoids conflicts with dual PM2/Docker instances on port 3001.
    // To run dashboard dev server: `docker-compose -f docker-compose.simple.yml up -d dashboard`
    // COMMENTED OUT TO PREVENT DUPLICATE PORT BINDING:
    /*
    {
      name: 'dashboard',
      script: 'pnpm',
      args: 'dev',
      cwd: path.resolve(projectRoot, 'packages/dashboard'),

      env: {
        NODE_ENV: 'development',
        VITE_API_URL: 'http://localhost:3000',
        VITE_WS_URL: 'ws://localhost:3000',
        VITE_POLLING_INTERVAL: '5000'
      },

      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',

      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,

      error_file: path.resolve(projectRoot, 'scripts/logs/dashboard-error.log'),
      out_file: path.resolve(projectRoot, 'scripts/logs/dashboard-out.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,

      listen_timeout: 10000,
      kill_timeout: 5000
    }
    */
  ]
};
