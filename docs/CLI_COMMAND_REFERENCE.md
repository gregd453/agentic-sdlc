# Agentic SDLC CLI Command Reference

**Version:** 1.0.0 | **Last Updated:** 2025-11-16 | **Status:** Phase 7A Complete

Complete reference for all `agentic-sdlc` CLI commands with usage examples.

---

## Table of Contents

1. [Global Options](#global-options)
2. [Environment Commands](#environment-commands)
3. [Health & Diagnostics](#health--diagnostics)
4. [Logs & Monitoring](#logs--monitoring)
5. [Testing Commands](#testing-commands) ⏳ Coming in Phase 7B
6. [Deployment Commands](#deployment-commands) ⏳ Coming in Phase 7B
7. [Database Commands](#database-commands) ⏳ Coming in Phase 7B
8. [Operations Commands](#operations-commands) ⏳ Coming in Phase 7B
9. [Exit Codes](#exit-codes)
10. [Examples](#examples)

---

## Global Options

Global options work with any command:

```bash
agentic-sdlc [COMMAND] [OPTIONS]

Options:
  -v, --verbose           Enable verbose output (shows detailed logging)
  -j, --json              Output as JSON (for scripting and automation)
  -y, --yaml              Output as YAML format
  -h, --help              Show help for command
  --version               Show CLI version
```

### Usage Examples

```bash
# Human-readable output (default)
agentic-sdlc start

# JSON output for automation/AI agents
agentic-sdlc health --json

# Verbose output with detailed logging
agentic-sdlc start --verbose

# YAML format
agentic-sdlc status --yaml
```

---

## Environment Commands

Commands for managing the development environment (Docker, PM2, services).

### `agentic-sdlc start`

Start the complete development environment.

**Usage:**
```bash
agentic-sdlc start [OPTIONS]
```

**Options:**
- `--skip-build` - Skip build step (use cached packages)
- `--services <services>` - Start specific services (comma-separated)
- `--wait <timeout>` - Wait timeout in seconds (default: 120)
- `--verbose` - Show detailed startup process

**What it does:**
1. Creates logs directory
2. Starts Docker containers (PostgreSQL, Redis, Dashboard, Analytics)
3. Builds packages with turbo (unless --skip-build)
4. Validates build artifacts
5. Starts PM2 processes (orchestrator, agents)
6. Waits for all services to be healthy
7. Starts analytics service (non-critical)

**Examples:**
```bash
# Start everything with health checks
agentic-sdlc start

# Skip build step for faster startup
agentic-sdlc start --skip-build

# Show what's happening
agentic-sdlc start --verbose

# JSON output for monitoring
agentic-sdlc start --json

# Custom timeout
agentic-sdlc start --wait 180
```

**Expected Output:**
```
Starting environment...
✓ Docker containers ready
✓ Packages built
✓ PM2 processes started
✓ Health checks passed
✅ Ready in 45s

Services running:
  PostgreSQL       → localhost:5433
  Redis            → localhost:6380
  Orchestrator     → http://localhost:3000
  Dashboard        → http://localhost:3001
  Analytics Service → http://localhost:3002
```

**Exit Codes:**
- `0` - Success
- `1` - Generic failure
- `2` - Critical error

---

### `agentic-sdlc stop`

Stop all running services gracefully.

**Usage:**
```bash
agentic-sdlc stop [OPTIONS]
```

**Options:**
- `--force` - Force kill without graceful shutdown
- `--services <services>` - Stop specific services only

**What it does:**
1. Stops PM2 processes (SIGTERM with timeout)
2. Stops Docker containers
3. Cleans up orphaned processes

**Examples:**
```bash
# Graceful shutdown
agentic-sdlc stop

# Force immediate kill (for stuck processes)
agentic-sdlc stop --force

# Stop only specific services
agentic-sdlc stop --services orchestrator,dashboard

# Quiet stop
agentic-sdlc stop --json
```

**Exit Codes:**
- `0` - Success
- `1` - Some services failed to stop
- `2` - Critical error

---

### `agentic-sdlc restart [SERVICE]`

Restart services (all or specific).

**Usage:**
```bash
agentic-sdlc restart [SERVICE] [OPTIONS]
```

**Arguments:**
- `SERVICE` - Optional: specific service to restart

**Options:**
- `--wait <timeout>` - Wait timeout in seconds (default: 120)

**What it does:**
- If SERVICE specified: restarts just that service via PM2
- If no SERVICE: performs full stop → start cycle

**Examples:**
```bash
# Restart all services (full cycle)
agentic-sdlc restart

# Restart specific service
agentic-sdlc restart orchestrator

# Restart with longer timeout
agentic-sdlc restart dashboard --wait 180

# JSON output
agentic-sdlc restart --json
```

**Exit Codes:**
- `0` - Success
- `1` - Restart failed
- `2` - Critical error

---

### `agentic-sdlc status [OPTIONS]`

Show current environment status.

**Usage:**
```bash
agentic-sdlc status [OPTIONS]
```

**Options:**
- `--watch` - Continuous monitoring (auto-refresh)
- `--interval <ms>` - Refresh interval in milliseconds (default: 1000)
- `--json` - JSON format (better for parsing)

**What it does:**
- Checks Docker container status
- Checks PM2 process status
- Displays port availability
- Shows uptime information

**Examples:**
```bash
# One-time status check
agentic-sdlc status

# Watch mode (continuous refresh)
agentic-sdlc status --watch

# Custom refresh interval (2 seconds)
agentic-sdlc status --watch --interval 2000

# JSON output for scripting
agentic-sdlc status --json

# Pipe to other tools
agentic-sdlc status --json | jq '.services[] | select(.status=="running")'
```

**Expected Output:**
```
📊 Environment Status:

{
  "services": {
    "database": "running",
    "cache": "running",
    "ui": "running",
    "analytics": "running"
  },
  "pm2_status": "7 processes online",
  "timestamp": "2025-11-16T10:30:45.123Z"
}
```

**Exit Codes:**
- `0` - All services running
- `1` - Some services stopped
- `2` - Critical error

---

### `agentic-sdlc reset [OPTIONS]`

Reset environment to clean state (⚠️ DATA LOSS).

**Usage:**
```bash
agentic-sdlc reset [OPTIONS]
```

**Options:**
- `--confirm` - Skip confirmation prompt (use in scripts)

**What it does:**
1. Stops all services
2. Removes Docker volumes (deletes databases)
3. Clears logs directory
4. Prepares for fresh start

**⚠️ WARNING:** This command deletes all data in:
- PostgreSQL database
- Redis cache
- All logs

**Examples:**
```bash
# Interactive (shows confirmation)
agentic-sdlc reset

# Automated reset (CI/CD safe)
agentic-sdlc reset --confirm

# Reset and restart
agentic-sdlc reset --confirm && agentic-sdlc start

# After reset, start fresh
agentic-sdlc reset --confirm
agentic-sdlc start
```

**Exit Codes:**
- `0` - Success
- `1` - Reset failed
- `2` - Critical error

---

## Health & Diagnostics

Commands for checking system and service health.

### `agentic-sdlc health`

Run comprehensive system health check.

**Usage:**
```bash
agentic-sdlc health [OPTIONS]
```

**Options:**
- `--verbose` - Show detailed breakdown
- `--wait <timeout>` - Wait for health check (default: 60 seconds)

**What it checks:**
- Infrastructure (Docker, ports, disk space)
- Database connectivity (PostgreSQL)
- Cache health (Redis)
- Service endpoints (Orchestrator, Dashboard, Analytics)
- Agent registration and status

**Examples:**
```bash
# Full health check
agentic-sdlc health

# Verbose output with details
agentic-sdlc health --verbose

# JSON output for parsing
agentic-sdlc health --json

# Check health with custom timeout
agentic-sdlc health --wait 120
```

**Expected Output:**
```
📋 System Health Report
Overall Status: ✓ HEALTHY

{
  "infrastructure": {
    "docker": true,
    "memory": { "used": 4096, "total": 16384 },
    "disk": { "free": 512000, "total": 1000000 },
    "ports": {
      "3000": true,
      "3001": true,
      "3002": true,
      "5433": true,
      "6380": true
    }
  },
  "database": {
    "connected": true,
    "latency": 2
  },
  "messageBus": {
    "connected": true,
    "latency": 1
  },
  "services": [
    { "name": "orchestrator", "status": "running", "healthy": true, "port": 3000 },
    { "name": "dashboard", "status": "running", "healthy": true, "port": 3001 },
    { "name": "analytics", "status": "running", "healthy": true, "port": 3002 }
  ],
  "agents": {
    "total": 5,
    "healthy": 5,
    "unhealthy": []
  },
  "summary": "healthy"
}
```

**Exit Codes:**
- `0` - All healthy ✓
- `1` - Degraded status ⚠️
- `2` - Unhealthy/Critical ❌

---

### `agentic-sdlc health:services`

Check service health only (faster).

**Usage:**
```bash
agentic-sdlc health:services [OPTIONS]
```

**Options:**
- `--json` - JSON output

**What it checks:**
- Orchestrator API endpoint
- Dashboard UI endpoint
- Analytics Service endpoint

**Examples:**
```bash
agentic-sdlc health:services

agentic-sdlc health:services --json
```

**Exit Codes:**
- `0` - All services healthy
- `1` - Some services down
- `2` - Critical error

---

### `agentic-sdlc health:database`

Check database connectivity and status.

**Usage:**
```bash
agentic-sdlc health:database [OPTIONS]
```

**Options:**
- `--json` - JSON output

**What it checks:**
- PostgreSQL connection
- Connection pool status
- Migration status
- Database size

**Examples:**
```bash
agentic-sdlc health:database

agentic-sdlc health:database --json
```

**Exit Codes:**
- `0` - Database healthy
- `1` - Database issues
- `2` - Connection failed

---

### `agentic-sdlc health:agents`

Check agent registration and health.

**Usage:**
```bash
agentic-sdlc health:agents [OPTIONS]
```

**Options:**
- `--json` - JSON output
- `--platform <platform>` - Filter by platform

**What it checks:**
- Total agents registered
- Agents online/offline
- Agent resource usage
- Agent error rates

**Examples:**
```bash
agentic-sdlc health:agents

agentic-sdlc health:agents --json

agentic-sdlc health:agents --platform web-apps
```

**Exit Codes:**
- `0` - All agents healthy
- `1` - Some agents down
- `2` - Critical error

---

## Logs & Monitoring

Commands for viewing logs and system metrics.

### `agentic-sdlc logs [OPTIONS]`

View logs from services.

**Usage:**
```bash
agentic-sdlc logs [OPTIONS]
```

**Options:**
- `--service <service>` - Filter by specific service
- `--lines <number>` - Number of lines to show (default: 100)
- `--grep <pattern>` - Search for pattern (case-insensitive)
- `--follow` - Stream logs continuously (like `tail -f`)
- `--json` - JSON output

**Available services:**
- `orchestrator` - Main orchestrator service
- `dashboard` - Web dashboard
- `analytics` - Analytics service
- `scaffold-agent` - Scaffold agent
- `validation-agent` - Validation agent
- `integration-agent` - Integration agent
- `deployment-agent` - Deployment agent
- `e2e-agent` - E2E testing agent

**Examples:**
```bash
# View last 100 lines from all services
agentic-sdlc logs

# View logs from specific service
agentic-sdlc logs --service orchestrator

# View more lines
agentic-sdlc logs --lines 500

# Stream logs in real-time
agentic-sdlc logs --follow

# Search for errors
agentic-sdlc logs --grep ERROR

# Search in specific service
agentic-sdlc logs --service orchestrator --grep "workflow.*fail"

# JSON output for parsing
agentic-sdlc logs --json

# Complex filtering
agentic-sdlc logs --service validation-agent --grep "validation.*error" --lines 50
```

**Expected Output:**
```
📋 Logs (orchestrator):

2025-11-16T10:30:45.123Z [INFO] Orchestrator started
2025-11-16T10:30:46.456Z [INFO] Connected to database
2025-11-16T10:30:47.789Z [WARN] High memory usage: 85%
2025-11-16T10:30:48.012Z [INFO] 3 agents registered
```

**Exit Codes:**
- `0` - Success
- `1` - No logs found
- `2` - Error reading logs

---

### `agentic-sdlc metrics [OPTIONS]`

Show system metrics and performance data.

**Usage:**
```bash
agentic-sdlc metrics [OPTIONS]
```

**Options:**
- `--service <service>` - Filter by service
- `--period <period>` - Time period: `1h` (default), `24h`, `7d`
- `--json` - JSON output

**Metrics shown:**
- CPU usage per process
- Memory usage per process
- Process uptime
- Error rates
- Request latency

**Examples:**
```bash
# Current metrics
agentic-sdlc metrics

# Metrics for specific service
agentic-sdlc metrics --service orchestrator

# Last 24 hours of metrics
agentic-sdlc metrics --period 24h

# Last 7 days
agentic-sdlc metrics --period 7d

# JSON output
agentic-sdlc metrics --json

# Combined with jq
agentic-sdlc metrics --json | jq '.processes[] | select(.cpu > 50)'
```

**Expected Output:**
```
📊 System Metrics (1h):

ProcessID   Service              CPU    Memory     Uptime
28391       orchestrator         2.1%   245 MB     45m 23s
28392       dashboard            0.8%   156 MB     45m 18s
28393       analytics-service    1.4%   189 MB     45m 12s
28394       scaffold-agent       0.2%   98 MB      42m 15s
28395       validation-agent     0.3%   102 MB     41m 50s
```

**Exit Codes:**
- `0` - Success
- `1` - No metrics available
- `2` - Error fetching metrics

---

## Testing Commands

⏳ **Coming in Phase 7B** - Test and validation commands.

### `agentic-sdlc test [OPTIONS]` (Phase 7B)

Run test suite.

**Usage:**
```bash
agentic-sdlc test [OPTIONS]
```

**Options:**
- `--tier <number>` - Run specific tier (1-4)
- `--match <pattern>` - Run tests matching pattern
- `--parallel` - Run in parallel
- `--timeout <ms>` - Test timeout (default: 120000)

---

### `agentic-sdlc test:units` (Phase 7B)

Run unit tests only.

---

### `agentic-sdlc test:integration` (Phase 7B)

Run integration tests only.

---

### `agentic-sdlc test:e2e` (Phase 7B)

Run end-to-end tests.

---

### `agentic-sdlc validate:ci` (Phase 7B)

Validate before commit.

---

## Deployment Commands

⏳ **Coming in Phase 7B** - Deployment and rollback commands.

### `agentic-sdlc deploy` (Phase 7B)

Deploy to environment.

### `agentic-sdlc deploy:validate` (Phase 7B)

Validate deployment.

### `agentic-sdlc deploy:rollback` (Phase 7B)

Rollback deployment.

---

## Database Commands

⏳ **Coming in Phase 7B** - Database management commands.

### `agentic-sdlc db:setup` (Phase 7B)

Setup database.

### `agentic-sdlc db:migrate` (Phase 7B)

Run migrations.

### `agentic-sdlc db:reset` (Phase 7B)

Reset database (data loss).

### `agentic-sdlc db:seed` (Phase 7B)

Seed test data.

### `agentic-sdlc db:backup` (Phase 7B)

Backup database.

---

## Operations Commands

⏳ **Coming in Phase 7B** - Workflow and agent operations.

### `agentic-sdlc workflows:list` (Phase 7B)

List all workflows.

### `agentic-sdlc workflows:get <ID>` (Phase 7B)

Get workflow details.

### `agentic-sdlc agents:list` (Phase 7B)

List all agents.

### `agentic-sdlc agents:status` (Phase 7B)

Check agent status.

### `agentic-sdlc config` (Phase 7B)

Show configuration.

---

## Exit Codes

Standard exit codes for all commands:

| Code | Meaning | When Used |
|------|---------|-----------|
| `0` | SUCCESS | Command completed successfully |
| `1` | FAILURE | Command failed (check output for details) |
| `2` | GENERIC_ERROR | Critical error (infrastructure/permission issues) |
| `3` | INVALID_USAGE | Invalid command or option syntax |

**Using exit codes in scripts:**

```bash
#!/bin/bash

agentic-sdlc start
if [ $? -eq 0 ]; then
  echo "✓ Environment started successfully"
  agentic-sdlc health --json | jq '.summary'
else
  echo "✗ Failed to start environment"
  exit 1
fi
```

---

## Examples

### Complete Startup Workflow

```bash
#!/bin/bash
set -e  # Exit on any error

echo "🚀 Starting Agentic SDLC Platform"

# Start environment
echo "⏳ Starting services..."
agentic-sdlc start --verbose

# Wait for health
echo "⏳ Waiting for health checks..."
agentic-sdlc health --wait 120

# Show status
echo "✓ Services running:"
agentic-sdlc status --json | jq '.services'

# Show quick links
echo ""
echo "📚 Quick Links:"
echo "  Orchestrator:  http://localhost:3000"
echo "  Dashboard:     http://localhost:3001"
echo "  Analytics:     http://localhost:3002"
```

### Monitoring Dashboard

```bash
# Watch status in one terminal
watch -n 1 'agentic-sdlc status --json | jq'

# Tail logs in another
agentic-sdlc logs --follow

# Monitor metrics
agentic-sdlc metrics --period 24h
```

### CI/CD Integration

```bash
#!/bin/bash
# Pre-commit validation

set -e

echo "Running pre-commit checks..."

# Health check
agentic-sdlc health --json || {
  echo "❌ System health check failed"
  exit 1
}

# Run tests
agentic-sdlc test --tier 1 || {
  echo "❌ Unit tests failed"
  exit 1
}

# Validate environment
agentic-sdlc validate:ci || {
  echo "❌ CI validation failed"
  exit 1
}

echo "✓ All checks passed"
```

### Production Health Monitoring

```bash
#!/bin/bash
# Continuous health monitoring

while true; do
  echo "=== Health Check at $(date) ==="
  agentic-sdlc health --json | jq '{
    status: .summary,
    services: (.services | length),
    agents: .agents.healthy,
    timestamp: .timestamp
  }'

  echo "=== Service Status ==="
  agentic-sdlc status --json | jq '.services'

  echo ""
  sleep 300  # Check every 5 minutes
done
```

### Automated Recovery

```bash
#!/bin/bash
# Auto-restart degraded services

HEALTH=$(agentic-sdlc health --json)
STATUS=$(echo $HEALTH | jq -r '.summary')

if [ "$STATUS" != "healthy" ]; then
  echo "⚠️ System degraded, attempting recovery..."

  # Restart services
  agentic-sdlc restart

  # Verify recovery
  sleep 30
  agentic-sdlc health || {
    echo "❌ Recovery failed, alerting..."
    # Send alert
  }
fi
```

---

## Tips & Tricks

### Using JSON output with jq

```bash
# Get all running services
agentic-sdlc status --json | jq '.services[] | select(.status=="running")'

# Check agent count
agentic-sdlc health --json | jq '.agents.healthy'

# Monitor memory usage
agentic-sdlc metrics --json | jq '.processes[] | select(.memory > 500)'
```

### Piping and Filtering

```bash
# Export logs to file
agentic-sdlc logs --grep ERROR --lines 1000 > errors.log

# Search for patterns
agentic-sdlc logs | grep -i "failed\|error\|exception"

# Count occurrences
agentic-sdlc logs | grep "WARN" | wc -l
```

### Performance Optimization

```bash
# Fast startup (skip rebuild)
agentic-sdlc start --skip-build

# Parallel testing (Phase 7B)
agentic-sdlc test --parallel

# Targeted health check (faster)
agentic-sdlc health:services
```

### Troubleshooting

```bash
# Verbose output shows what's happening
agentic-sdlc start --verbose

# Full health report
agentic-sdlc health --verbose --json

# Tail logs for errors
agentic-sdlc logs --follow --grep ERROR

# Check specific service
agentic-sdlc logs --service orchestrator --grep "connection\|error"
```

---

## Phase 7A Status

✅ **Implemented:** start, stop, restart, reset, status, health (all variants), logs, metrics

⏳ **Coming Phase 7B:** test, test:units, test:integration, test:e2e, validate:ci, deploy commands, database commands, operations commands

---

## Related Documentation

- **CLAUDE.md** - Project guidelines
- **EPCC_PLAN_PHASE7.md** - Implementation plan
- **EPCC_CODE_PHASE7A.md** - Phase 7A completion report
- **AGENTIC_SDLC_RUNBOOK.md** - Debugging guide

---

**Last Updated:** 2025-11-16 | **Phase:** 7A Complete
