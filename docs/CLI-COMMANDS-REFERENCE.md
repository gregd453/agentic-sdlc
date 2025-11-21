# CLI Commands Reference - Phase 7B+

**Status:** ✅ Phase 7B+ Complete (18 commands total: 16 implemented)
**Latest Update:** Added 5 new workflow test commands
**Entry Point:** `agentic-sdlc` command
**Package:** `@agentic-sdlc/cli`
**Location:** `packages/cli/`

**New in this release:**
- ✅ `workflows:presets` - List available preset behaviors
- ✅ `workflows:run:preset` - Run workflows with preset behaviors
- ✅ `workflows:run` - Run custom workflows with behavior metadata
- ✅ `workflows:list` - List workflows with filtering
- ✅ `workflows:get` - Get workflow details

---

## 📋 Command Summary

| Category | Command | Status | Purpose |
|----------|---------|--------|---------|
| **Environment** | `start` | ✅ Implemented | Start environment |
| | `stop` | ✅ Implemented | Stop services gracefully |
| | `restart` | ✅ Implemented | Restart services |
| | `status` | ✅ Implemented | Show environment status |
| | `reset` | ✅ Implemented | Reset environment (data loss!) |
| **Health** | `health` | ✅ Implemented | Full system health |
| | `health:services` | ✅ Implemented | Service health only |
| | `health:database` | ✅ Implemented | Database connectivity |
| | `health:agents` | ✅ Implemented | Agent registration |
| **Logs** | `logs` | ✅ Implemented | View logs |
| | `metrics` | ✅ Implemented | System metrics |
| **Help** | `help` | ✅ Implemented | Show help |
| **Testing** | `test` | 📋 Placeholder | Run tests (Phase 7B) |
| | `test:units` | 📋 Placeholder | Unit tests (Phase 7B) |
| | `test:integration` | 📋 Placeholder | Integration tests (Phase 7B) |
| | `test:e2e` | 📋 Placeholder | E2E tests (Phase 7B) |
| | `validate:ci` | 📋 Placeholder | CI validation (Phase 7B) |
| **Deployment** | `deploy` | 📋 Placeholder | Deploy (Phase 7B) |
| **Database** | `db:setup` | 📋 Placeholder | Setup DB (Phase 7B) |
| | `db:migrate` | 📋 Placeholder | Run migrations (Phase 7B) |
| | `db:reset` | 📋 Placeholder | Reset DB (Phase 7B) |
| **Workflows** | `workflows:list` | ✅ Implemented | List workflows |
| | `workflows:get` | ✅ Implemented | Get workflow details |
| | `workflows:run` | ✅ Implemented | Run custom workflow |
| | `workflows:run:preset` | ✅ Implemented | Run preset workflow |
| | `workflows:presets` | ✅ Implemented | List preset behaviors |
| **Agents** | `agents:list` | ✅ Implemented | List agents |
| | `agents:status` | ✅ Implemented | Agent status |
| **Config** | `config` | 📋 Placeholder | Show config (Phase 7B) |

---

## ✅ Phase 7A: Implemented Commands (11 Total)

### Environment Commands

#### `agentic-sdlc start`
**Purpose:** Start the Agentic SDLC environment

```bash
# Basic start
agentic-sdlc start

# Start with specific services
agentic-sdlc start --services postgres,redis

# Skip build step (faster)
agentic-sdlc start --skip-build

# Custom wait timeout
agentic-sdlc start --wait 180

# Verbose output
agentic-sdlc -v start
```

**Options:**
- `--services <services>` - Comma-separated services to start
- `--skip-build` - Skip build step (faster startup)
- `--wait <timeout>` - Wait timeout in seconds (default: 120)

**Output:**
- Startup progress with status indicators
- Service readiness confirmations
- Final summary of running services

**Exit Codes:**
- 0 = Success
- 1 = Startup failed
- 2 = Invalid arguments

---

#### `agentic-sdlc stop`
**Purpose:** Stop the environment gracefully

```bash
# Graceful stop (default)
agentic-sdlc stop

# Force stop (kills processes without graceful shutdown)
agentic-sdlc stop --force

# Verbose output
agentic-sdlc -v stop
```

**Options:**
- `--force` - Force stop without graceful shutdown

**What it does:**
1. Stops PM2 processes (orchestrator + agents)
2. Cleans up orphaned processes
3. Stops Docker containers
4. Kills PM2 daemon
5. Verifies complete cleanup

**Exit Codes:**
- 0 = Success
- 1 = Stop failed

---

#### `agentic-sdlc restart [service]`
**Purpose:** Restart services

```bash
# Restart all services
agentic-sdlc restart

# Restart specific service
agentic-sdlc restart orchestrator
agentic-sdlc restart agent-scaffold

# Custom wait timeout
agentic-sdlc restart --wait 90

# Verbose output
agentic-sdlc -v restart orchestrator
```

**Arguments:**
- `[service]` - Optional service name (default: all)

**Available Services:**
- `orchestrator` - Main API server
- `agent-scaffold` - Scaffold agent
- `agent-validation` - Validation agent
- `agent-e2e` - E2E testing agent
- `agent-integration` - Integration testing agent
- `agent-deployment` - Deployment agent

**Options:**
- `--wait <timeout>` - Wait timeout in seconds

**Exit Codes:**
- 0 = Success
- 1 = Restart failed

---

#### `agentic-sdlc status`
**Purpose:** Show environment status

```bash
# Text output (default)
agentic-sdlc status

# JSON output for automation
agentic-sdlc status --json

# Watch mode (auto-refresh)
agentic-sdlc status --watch

# Custom refresh interval
agentic-sdlc status --watch --interval 2000

# YAML output
agentic-sdlc status -y
```

**Options:**
- `--watch` - Watch for changes (auto-refresh)
- `--interval <ms>` - Refresh interval in milliseconds (default: 1000)
- `-j, --json` - JSON output
- `-y, --yaml` - YAML output

**Output Example (JSON):**
```json
{
  "status": "healthy",
  "timestamp": "2025-11-16T19:00:00Z",
  "services": {
    "orchestrator": {
      "status": "online",
      "port": 3000,
      "uptime": "2m45s"
    },
    "dashboard": {
      "status": "online",
      "port": 3001,
      "uptime": "2m43s"
    },
    "postgres": {
      "status": "online",
      "port": 5433
    },
    "redis": {
      "status": "online",
      "port": 6380
    }
  },
  "agents": {
    "scaffold": "online",
    "validation": "online",
    "e2e": "online",
    "integration": "online",
    "deployment": "online"
  }
}
```

---

#### `agentic-sdlc reset`
**Purpose:** Reset environment (⚠️ DATA LOSS!)

```bash
# Show warning (default)
agentic-sdlc reset

# Reset with confirmation
agentic-sdlc reset --confirm

# Skip confirmation prompt
agentic-sdlc reset --confirm -v
```

**Options:**
- `--confirm` - Skip confirmation prompt

**What it resets:**
- Stops all services
- Clears PostgreSQL database
- Clears Redis cache
- Removes workflow history
- Removes logs

**⚠️ WARNING:** This is irreversible! All data will be lost.

---

### Health & Diagnostics Commands

#### `agentic-sdlc health`
**Purpose:** Check full system health

```bash
# Text output (default)
agentic-sdlc health

# JSON output
agentic-sdlc health --json

# YAML output
agentic-sdlc health -y

# Verbose details
agentic-sdlc -v health
```

**Options:**
- `--wait <timeout>` - Wait timeout in seconds
- `-j, --json` - JSON output
- `-v, --verbose` - Verbose output

**Checks:**
- ✓ Orchestrator API
- ✓ Database connectivity
- ✓ Redis connectivity
- ✓ Dashboard UI
- ✓ Agent registration
- ✓ Service responsiveness

**Output Example:**
```json
{
  "summary": "healthy",
  "timestamp": "2025-11-16T19:00:00Z",
  "services": {
    "orchestrator": {
      "status": "online",
      "responseTime": "45ms"
    },
    "database": {
      "status": "connected",
      "connections": 5
    },
    "redis": {
      "status": "connected",
      "memory": "2.1MB"
    },
    "dashboard": {
      "status": "online",
      "responseTime": "78ms"
    },
    "agents": {
      "registered": 5,
      "online": 5
    }
  }
}
```

---

#### `agentic-sdlc health:services`
**Purpose:** Check service health only

```bash
# Text output
agentic-sdlc health:services

# JSON output
agentic-sdlc health:services --json
```

**What it checks:**
- PM2 process status
- Docker container status
- Port availability
- Service responsiveness

---

#### `agentic-sdlc health:database`
**Purpose:** Check database connectivity

```bash
# Database health check
agentic-sdlc health:database

# JSON output
agentic-sdlc health:database --json
```

**What it checks:**
- PostgreSQL connectivity
- Database availability
- Table existence
- Migration status

**Exit Codes:**
- 0 = Database healthy
- 1 = Database issues

---

#### `agentic-sdlc health:agents`
**Purpose:** Check agent registration and health

```bash
# Agent health check
agentic-sdlc health:agents

# JSON output
agentic-sdlc health:agents --json
```

**Checks:**
- Agent process status
- Redis message queue connectivity
- Agent registration status
- Last heartbeat time

**Output includes:**
- `scaffold` - Scaffold agent status
- `validation` - Validation agent status
- `e2e` - E2E testing agent status
- `integration` - Integration testing agent status
- `deployment` - Deployment agent status

---

### Logs & Monitoring Commands

#### `agentic-sdlc logs`
**Purpose:** View and search logs

```bash
# View all logs (last 100 lines)
agentic-sdlc logs

# Filter by service
agentic-sdlc logs --service orchestrator
agentic-sdlc logs --service agent-scaffold

# Get more lines
agentic-sdlc logs --lines 500

# Search logs
agentic-sdlc logs --grep "ERROR"
agentic-sdlc logs --grep "FAIL.*test"

# Combine filters
agentic-sdlc logs --service orchestrator --grep "ERROR" --lines 50

# Stream logs (follow mode)
agentic-sdlc logs --follow
```

**Options:**
- `--service <service>` - Filter by service
- `--lines <number>` - Number of lines to show (default: 100)
- `--grep <pattern>` - Filter by regex pattern
- `--follow` - Stream logs continuously
- `-j, --json` - JSON output

**Available Services:**
- `orchestrator` - Main API
- `agent-scaffold` - Scaffold agent
- `agent-validation` - Validation agent
- `agent-e2e` - E2E agent
- `agent-integration` - Integration agent
- `agent-deployment` - Deployment agent
- `dashboard` - Dashboard UI
- `postgres` - Database
- `redis` - Cache/Message bus

---

#### `agentic-sdlc metrics`
**Purpose:** Show system metrics

```bash
# Live metrics (via PM2)
agentic-sdlc metrics

# Metrics for specific period
agentic-sdlc metrics --period 1h
agentic-sdlc metrics --period 24h
agentic-sdlc metrics --period 7d

# JSON output
agentic-sdlc metrics --json
```

**Options:**
- `--service <service>` - Filter by service
- `--period <period>` - Time period (1h, 24h, 7d)

**Metrics shown:**
- CPU usage
- Memory usage
- Uptime
- Process status
- System load

---

### Help Command

#### `agentic-sdlc help`
**Purpose:** Show help information

```bash
# General help
agentic-sdlc help

# Help for specific command
agentic-sdlc start --help
agentic-sdlc status --help

# Show full help
agentic-sdlc --help
agentic-sdlc -h
```

**Displays:**
- Available commands
- Global options
- Usage examples
- Common tasks

---

## 🌍 Global Options

All commands support these global options:

```bash
# Verbose output
agentic-sdlc -v <command>
agentic-sdlc --verbose <command>

# JSON output
agentic-sdlc -j <command>
agentic-sdlc --json <command>

# YAML output
agentic-sdlc -y <command>
agentic-sdlc --yaml <command>

# Help
agentic-sdlc -h
agentic-sdlc --help
```

---

## 📋 Phase 7B: Planned Commands (Placeholders)

These commands are stubbed out and will be implemented in Phase 7B:

### Testing Commands
```bash
agentic-sdlc test              # Run all tests
agentic-sdlc test:units        # Unit tests only
agentic-sdlc test:integration  # Integration tests only
agentic-sdlc test:e2e          # E2E tests only
agentic-sdlc validate:ci       # Validate before commit
```

### Deployment Commands
```bash
agentic-sdlc deploy            # Deploy to environment
```

### Database Commands
```bash
agentic-sdlc db:setup          # Setup database
agentic-sdlc db:migrate        # Run migrations
agentic-sdlc db:reset          # Reset database (with confirmation)
```

### Workflow & Agent Commands

#### Test Workflow Commands (NEW)
```bash
# List available preset behaviors
agentic-sdlc workflows:presets

# Run a preset workflow (happy path)
agentic-sdlc workflows:run:preset success

# Run a preset workflow and wait for completion
agentic-sdlc workflows:run:preset validation_error --wait

# Run a custom workflow with behavior
agentic-sdlc workflows:run "my-test" --behavior timeout --priority high

# Run any preset behavior
agentic-sdlc workflows:run:preset timeout
agentic-sdlc workflows:run:preset crash
agentic-sdlc workflows:run:preset tests_partial_pass
```

#### Workflow/Agent Management
```bash
agentic-sdlc workflows:list    # List workflows
agentic-sdlc workflows:get <id> # Get workflow details
agentic-sdlc agents:list       # List agents
agentic-sdlc agents:status     # Agent status
```

### Configuration
```bash
agentic-sdlc config            # Show configuration
```

---

## 🆕 NEW: Workflow Test Commands (Phase 7B+)

### `agentic-sdlc workflows:presets`
**Purpose:** List all available preset behaviors for test workflows

```bash
# Show all presets
agentic-sdlc workflows:presets

# Output JSON format
agentic-sdlc workflows:presets --json
```

**Available Presets:**
- `success` - Normal successful completion
- `fast_success` - Quick execution (minimal delays)
- `slow_success` - Extended execution
- `validation_error` - TypeScript compilation failure
- `deployment_failed` - Deployment to environment fails
- `unrecoverable_error` - Fatal, non-retryable error
- `timeout` - Stage execution exceeds timeout
- `tests_partial_pass` - 8/10 tests pass, 2 fail
- `high_resource_usage` - High memory (512MB) and CPU (75%)
- `crash` - Agent process crashes (retryable)

---

### `agentic-sdlc workflows:run:preset <preset>`
**Purpose:** Run a test workflow with a preset behavior

```bash
# Run with preset (no waiting)
agentic-sdlc workflows:run:preset success

# Run and wait for completion
agentic-sdlc workflows:run:preset validation_error --wait

# With custom name
agentic-sdlc workflows:run:preset timeout --name "my-timeout-test"

# With custom platform and priority
agentic-sdlc workflows:run:preset crash --platform legacy --priority high

# Multiple examples
agentic-sdlc workflows:run:preset tests_partial_pass --wait
agentic-sdlc workflows:run:preset deployment_failed
agentic-sdlc workflows:run:preset high_resource_usage --wait --timeout 120
```

**Options:**
- `--name <name>` - Custom workflow name (auto-generated if not provided)
- `--platform <platform>` - Platform name (default: "legacy")
- `--priority <priority>` - Priority: low|medium|high (default: "medium")
- `--wait` - Wait for workflow to complete before returning
- `-j, --json` - Output as JSON

**Exit Codes:**
- 0 = Success
- 1 = Failed to create workflow

---

### `agentic-sdlc workflows:run <name>`
**Purpose:** Run a custom test workflow with optional behavior metadata

```bash
# Simple workflow
agentic-sdlc workflows:run "test-workflow"

# With behavior preset
agentic-sdlc workflows:run "validation-test" --behavior validation_error

# With custom priority and wait
agentic-sdlc workflows:run "critical-test" --priority high --wait

# With description and timeout
agentic-sdlc workflows:run "slow-test" --behavior slow_success --desc "Testing slow execution" --timeout 300

# Full example
agentic-sdlc workflows:run "my-test-app" \
  --behavior timeout \
  --platform legacy \
  --priority high \
  --desc "Testing timeout behavior" \
  --wait \
  --timeout 300
```

**Options:**
- `--behavior <preset>` - Behavior preset to use (success, validation_error, etc.)
- `--platform <platform>` - Platform name (default: "legacy")
- `--priority <priority>` - Priority: low|medium|high (default: "high")
- `--desc <description>` - Workflow description
- `--wait` - Wait for workflow to complete
- `--timeout <seconds>` - Wait timeout in seconds (default: 300)
- `-j, --json` - Output as JSON

**Exit Codes:**
- 0 = Success
- 1 = Failed to create or run workflow

---

### `agentic-sdlc workflows:list`
**Purpose:** List all workflows

```bash
# List all workflows
agentic-sdlc workflows:list

# With status filter
agentic-sdlc workflows:list --status running
agentic-sdlc workflows:list --status failed

# Limit results
agentic-sdlc workflows:list --limit 20

# JSON output
agentic-sdlc workflows:list --json
```

**Options:**
- `--status <status>` - Filter by status: pending|running|completed|failed|cancelled
- `--limit <number>` - Limit results (default: 50)
- `-j, --json` - Output as JSON

---

### `agentic-sdlc workflows:get <id>`
**Purpose:** Get details of a specific workflow

```bash
# Get workflow details
agentic-sdlc workflows:get 123e4567-e89b-12d3-a456-426614174000

# JSON output
agentic-sdlc workflows:get 123e4567-e89b-12d3-a456-426614174000 --json
```

**Output includes:**
- Workflow ID
- Name and type
- Status and progress
- Created/updated timestamps
- Stage information

---

## 🔧 Common Usage Patterns

### Development Workflow
```bash
# Morning setup
agentic-sdlc start --skip-build

# Check everything is healthy
agentic-sdlc health --json | grep healthy

# Work on features...

# Before committing
agentic-sdlc logs --grep ERROR
agentic-sdlc health:agents

# End of day
agentic-sdlc stop
```

### Debugging
```bash
# Find errors in logs
agentic-sdlc logs --grep "ERROR\|FAIL\|Exception"

# Check specific service
agentic-sdlc logs --service orchestrator --lines 200

# Monitor live
agentic-sdlc logs --follow
agentic-sdlc status --watch

# Get metrics
agentic-sdlc metrics
```

### Testing Workflows with CLI
```bash
# List available test behaviors
agentic-sdlc workflows:presets

# Run happy path test
agentic-sdlc workflows:run:preset success --wait

# Test error handling
agentic-sdlc workflows:run:preset validation_error
agentic-sdlc workflows:run:preset deployment_failed
agentic-sdlc workflows:run:preset timeout

# Test partial failures
agentic-sdlc workflows:run:preset tests_partial_pass --wait

# Test agent crash and recovery
agentic-sdlc workflows:run:preset crash

# Run multiple test scenarios
for preset in success validation_error timeout crash; do
  echo "Testing $preset..."
  agentic-sdlc workflows:run:preset "$preset" --wait
done

# Monitor ongoing workflows
agentic-sdlc workflows:list --status running
agentic-sdlc workflows:get <workflow-id>

# View dashboard
open http://localhost:3050
```

### Automation/CI
```bash
# Check if ready
agentic-sdlc health --json | jq '.summary' | grep -q "healthy"

# Run with timeout
timeout 300 agentic-sdlc start

# Get JSON for processing
agentic-sdlc status --json > status.json
agentic-sdlc health --json > health.json

# Test and verify
agentic-sdlc workflows:run:preset success --wait && echo "Test passed"
```

---

## 🎯 Exit Codes

| Code | Meaning | Typical Cause |
|------|---------|---------------|
| 0 | Success | Command completed successfully |
| 1 | General error | Service failed, health check failed |
| 2 | Invalid usage | Bad arguments, unknown command |
| 3 | Setup error | Build failed, missing dependencies |
| 124 | Timeout | Command took too long |

---

## 📊 Performance Characteristics

| Command | Typical Duration | Purpose |
|---------|-----------------|---------|
| `start` | 45-60s | Full startup with health checks |
| `stop` | 15-30s | Graceful shutdown |
| `restart` | 30-45s | Restart single service |
| `status` | <1s | Quick status check |
| `health` | 2-5s | Full health check |
| `logs` | <1s | View recent logs |
| `metrics` | <1s | System metrics |

---

## 🚀 Integration with CI/CD

### GitHub Actions Example
```yaml
- name: Start environment
  run: agentic-sdlc start

- name: Check health
  run: agentic-sdlc health --json | grep -q "healthy"

- name: Run tests (Phase 7B)
  run: agentic-sdlc test

- name: Stop environment
  run: agentic-sdlc stop
  if: always()
```

### Docker Example
```bash
# In Dockerfile
RUN npm install -g @agentic-sdlc/cli

# In entrypoint
agentic-sdlc start --wait 180
```

---

## 📝 Version Info

- **CLI Version:** 1.0.0
- **Phase:** 7A (Complete)
- **Commands Implemented:** 11
- **Commands Planned:** 13+
- **Last Updated:** 2025-11-16

---

## 📚 Related Documentation

- [PHASE_7A_FINAL_REPORT.md](./PHASE_7A_FINAL_REPORT.md) - Implementation details
- [CLI-TEST-QUICK-START.md](./CLI-TEST-QUICK-START.md) - Test execution guide
- [CLI-INFRASTRUCTURE-TEST-PLAN.md](./CLI-INFRASTRUCTURE-TEST-PLAN.md) - Detailed test plan
- [packages/cli/README.md](./packages/cli/README.md) - CLI package documentation
- [CLAUDE.md](./CLAUDE.md) - Overall project context

---

**Ready to use? Start with:**
```bash
agentic-sdlc help
agentic-sdlc start
agentic-sdlc status --json
```

**Testing infrastructure?**
```bash
./scripts/test-cli-infrastructure.sh
```
