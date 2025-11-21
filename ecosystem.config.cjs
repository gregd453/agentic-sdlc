module.exports = {
  apps: [
    {
      name: 'orchestrator',
      script: './packages/orchestrator/dist/index.js',
      instances: process.env.CLUSTER_INSTANCES || 0, // 0 = CPU cores
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      env_production: {
        NODE_ENV: 'production'
      },
      error_file: './logs/orchestrator-error.log',
      out_file: './logs/orchestrator-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      max_memory_restart: '1G',
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      listen_timeout: 10000,
      kill_timeout: 5000,
      wait_ready: true,
      shutdown_with_message: true
    },
    {
      name: 'scaffold-agent',
      script: './packages/agents/scaffold-agent/dist/index.js',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        AGENT_TYPE: 'scaffold'
      },
      error_file: './logs/scaffold-agent-error.log',
      out_file: './logs/scaffold-agent-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      max_memory_restart: '512M',
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s'
    },
    {
      name: 'validation-agent',
      script: './packages/agents/validation-agent/dist/index.js',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        AGENT_TYPE: 'validation'
      },
      error_file: './logs/validation-agent-error.log',
      out_file: './logs/validation-agent-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      max_memory_restart: '512M',
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s'
    },
    {
      name: 'e2e-agent',
      script: './packages/agents/e2e-agent/dist/index.js',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        AGENT_TYPE: 'e2e'
      },
      error_file: './logs/e2e-agent-error.log',
      out_file: './logs/e2e-agent-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      max_memory_restart: '1G',
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s'
    },
    {
      name: 'integration-agent',
      script: './packages/agents/integration-agent/dist/index.js',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        AGENT_TYPE: 'integration'
      },
      error_file: './logs/integration-agent-error.log',
      out_file: './logs/integration-agent-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      max_memory_restart: '512M',
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s'
    },
    {
      name: 'deployment-agent',
      script: './packages/agents/deployment-agent/dist/index.js',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        AGENT_TYPE: 'deployment'
      },
      error_file: './logs/deployment-agent-error.log',
      out_file: './logs/deployment-agent-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      max_memory_restart: '512M',
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s'
    }
  ]
};
