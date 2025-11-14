# PM2 Process Management - Agentic SDLC

**Status:** Dev/Pilot Tooling (Not Production Orchestration)

PM2 provides centralized process management, auto-restart, and monitoring for local development and pilot deployments. For production, use container orchestration (ECS/Kubernetes).

---

## Quick Start

### First Time Setup

```bash
# 1. Install dependencies (includes PM2)
pnpm install

# 2. Build all packages
pnpm build

# 3. Start infrastructure (Redis, PostgreSQL)
docker-compose up -d redis postgres

# 4. Start PM2 processes
pnpm pm2:start
```

### Daily Development Workflow

```bash
# Start environment (with preflight check)
pnpm pm2:start

# View all logs in real-time
pnpm pm2:logs

# Check process status
pnpm pm2:status

# Stop all processes
pnpm pm2:stop
```

---

## Common Operations

### Process Control

```bash
# Start all services
pnpm pm2:start

# Stop all services (keeps in PM2 list)
pnpm pm2:stop

# Restart all services (reload code)
pnpm pm2:restart

# Reload all services (zero-downtime restart)
pnpm pm2:reload

# Remove from PM2 list completely
pnpm pm2:delete
```

### Individual Process Control

```bash
# Restart single process
pm2 restart orchestrator
pm2 restart agent-scaffold

# Stop single process
pm2 stop agent-validation

# Delete single process
pm2 delete agent-e2e

# View single process details
pm2 describe orchestrator
```

### Monitoring

```bash
# List all processes with status
pnpm pm2:status

# Tail logs from all processes
pnpm pm2:logs

# Tail logs from specific process
pm2 logs orchestrator
pm2 logs agent-scaffold

# Last 100 lines
pm2 logs orchestrator --lines 100

# Only error logs
pm2 logs orchestrator --err

# Live monitoring dashboard (ncurses)
pnpm pm2:monit
```

### After Code Changes

**Important:** PM2 runs compiled JavaScript from `dist/` directories.

```bash
# 1. Stop current processes
pnpm pm2:stop

# 2. Rebuild packages
pnpm build

# 3. Restart with new code
pnpm pm2:start

# Or use restart (combines stop + start)
pnpm build && pnpm pm2:restart
```

---

## Process List

PM2 manages the following processes:

| Name               | Script Path                                          | Memory Limit | Auto-Restart |
|--------------------|------------------------------------------------------|--------------|--------------|
| orchestrator       | packages/orchestrator/dist/server.js                 | 1GB          | Yes          |
| agent-scaffold     | packages/agents/scaffold-agent/dist/run-agent.js     | 512MB        | Yes          |
| agent-validation   | packages/agents/validation-agent/dist/run-agent.js   | 512MB        | Yes          |
| agent-e2e          | packages/agents/e2e-agent/dist/run-agent.js          | 512MB        | Yes          |
| agent-integration  | packages/agents/integration-agent/dist/run-agent.js  | 512MB        | Yes          |
| agent-deployment   | packages/agents/deployment-agent/dist/run-agent.js   | 512MB        | Yes          |

---

## Configuration

### Ecosystem File

**Location:** `pm2/ecosystem.dev.config.js`

Key settings:
- **Auto-restart:** Enabled for all processes
- **Max restarts:** 10 per process
- **Min uptime:** 10s before considered stable
- **Restart delay:** 4s between restarts
- **Log location:** `scripts/logs/` (matches existing infrastructure)

### Environment Variables

PM2 reads environment variables from:
1. Shell environment (highest priority)
2. `env` block in ecosystem config
3. `.env` file loaded by application code

**Required:**
- `DATABASE_URL` - PostgreSQL connection
- `REDIS_URL` - Redis connection
- `ANTHROPIC_API_KEY` - Claude API key

**Example `.env`:**
```bash
DATABASE_URL=postgresql://agentic:agentic_dev@localhost:5433/agentic_sdlc
REDIS_URL=redis://localhost:6380
ANTHROPIC_API_KEY=sk-ant-api03-...
```

---

## Log Files

### PM2 Writes To

```
scripts/logs/
├── orchestrator-out.log        # Orchestrator stdout
├── orchestrator-error.log      # Orchestrator stderr
├── scaffold-agent-out.log      # Scaffold agent stdout
├── scaffold-agent-error.log    # Scaffold agent stderr
├── validation-agent-out.log
├── validation-agent-error.log
├── e2e-agent-out.log
├── e2e-agent-error.log
├── integration-agent-out.log
├── integration-agent-error.log
├── deployment-agent-out.log
└── deployment-agent-error.log
```

**Note:** These are separate from PM2's internal logs at `~/.pm2/logs/`.

### Viewing Logs

```bash
# Via PM2
pnpm pm2:logs

# Via standard tools
tail -f scripts/logs/orchestrator-out.log
grep ERROR scripts/logs/*.log
```

---

## Troubleshooting

### Preflight Check Fails

**Error:** "Missing build artifacts"

**Solution:**
```bash
pnpm build
```

PM2 requires compiled JavaScript in `dist/` directories. If you see this error, run a full build.

### Process Won't Start

```bash
# Check detailed error
pm2 describe orchestrator

# View recent logs
pm2 logs orchestrator --lines 50

# Check infrastructure is running
docker ps | grep agentic

# Test infrastructure health
docker exec agentic-sdlc-redis redis-cli ping
docker exec agentic-sdlc-postgres pg_isready -U agentic
```

### Process Crashes Immediately

**Check:**
1. Environment variables set correctly (`.env` file)
2. Redis and PostgreSQL running
3. No port conflicts (3000 for orchestrator)
4. Build artifacts exist and are current

```bash
# View crash logs
pm2 logs orchestrator --err --lines 100

# Reset restart counter
pm2 reset orchestrator
```

### Memory Limit Exceeded

**Symptom:** Process restarted due to memory limit

**Check current memory usage:**
```bash
pnpm pm2:status  # Shows memory column
```

**Adjust limit in ecosystem config:**
```javascript
{
  name: 'orchestrator',
  max_memory_restart: '2G',  // Increase from 1G
  // ...
}
```

### Clean Slate Reset

**Nuclear option** - removes all PM2 processes and cleans state:

```bash
# Stop and delete all processes
pnpm pm2:delete

# Or kill PM2 daemon entirely
pm2 kill

# Then restart fresh
pnpm build
pnpm pm2:start
```

---

## Differences from start-dev.sh

### Old Bash Script Approach

```bash
./scripts/env/start-dev.sh
./scripts/env/stop-dev.sh
```

**How it works:**
- Fire-and-forget background processes (`npm start &`)
- PID tracking in `.pids/services.pids`
- No auto-restart
- No centralized monitoring
- Manual log tailing

### New PM2 Approach

```bash
pnpm pm2:start
pnpm pm2:stop
```

**How it works:**
- PM2 daemon manages processes
- Auto-restart on crash
- Centralized `pm2 logs`, `pm2 monit`
- Process health monitoring
- Memory limit enforcement

**Both approaches work** - choose based on preference. PM2 provides better observability and resilience for pilot deployment.

---

## Strategic Context

### PM2 is for Dev/Pilot Only

**Use PM2 for:**
- ✅ Local development
- ✅ Pilot VM deployment
- ✅ Integration testing environment

**Do NOT use PM2 for:**
- ❌ Production containers (ECS/K8s provides orchestration)
- ❌ Cloud auto-scaling
- ❌ Multi-node deployments

### Future Production Path

```
Dev (PM2 or bash scripts)
  ↓
Pilot (PM2 on VM)
  ↓
Production (ECS/Kubernetes with container orchestration)
```

PM2 is process supervision, not container orchestration. For production, containers provide:
- Health checks
- Auto-restart
- Load balancing
- Auto-scaling
- Service discovery

---

## Advanced Usage

### Watch Mode (Optional)

**Default:** `watch: false` (explicit rebuilds)

**Enable watch mode** to auto-restart on file changes:

Edit `pm2/ecosystem.dev.config.js`:
```javascript
{
  name: 'orchestrator',
  watch: true,
  watch_options: {
    followSymlinks: false,
    usePolling: false
  },
  ignore_watch: ['node_modules', 'logs', '.git'],
  // ...
}
```

**Trade-off:** Convenience vs. reliability. Watch mode can trigger false restarts.

### Multiple Instances

**Scale a single agent** (for load testing):

```javascript
{
  name: 'agent-scaffold',
  instances: 3,  // Run 3 instances
  exec_mode: 'cluster',  // Use cluster mode
  // ...
}
```

**Or via CLI:**
```bash
pm2 scale agent-scaffold 3
```

### JSON Output

**For automation/parsing:**

```bash
pm2 jlist  # JSON process list
pm2 logs orchestrator --json  # JSON log stream
```

---

## Quick Reference Card

```bash
# Start/Stop
pnpm pm2:start      # Start all
pnpm pm2:stop       # Stop all
pnpm pm2:restart    # Restart all
pnpm pm2:delete     # Remove all

# Monitoring
pnpm pm2:status     # Process list
pnpm pm2:logs       # Tail all logs
pnpm pm2:monit      # Live dashboard

# Individual Control
pm2 restart orchestrator
pm2 logs agent-scaffold
pm2 describe agent-validation

# Troubleshooting
pm2 logs <name> --err --lines 100
pm2 reset <name>
pm2 kill  # Nuclear option
```

---

## Support

### Infrastructure Already Running?

PM2 only manages Node.js processes (orchestrator + agents).

**You must start infrastructure separately:**
```bash
docker-compose up -d redis postgres
```

**Check infrastructure health:**
```bash
./scripts/env/check-health.sh
```

### Need Help?

1. Check this README
2. Check `INFRASTRUCTURE_OVERVIEW.md`
3. View PM2 logs: `pnpm pm2:logs`
4. Inspect specific process: `pm2 describe <name>`

---

**Last Updated:** 2025-11-13 (Session #58)
**Ecosystem Config:** `pm2/ecosystem.dev.config.js`
**Preflight Check:** `scripts/pm2-preflight.sh`
