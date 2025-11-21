# Infrastructure Overview - Agentic SDLC

**Document Date:** 2025-11-13
**Session:** #58
**Status:** Current Production Setup

---

## Architecture Overview

### Component Topology

```
┌─────────────────────────────────────────────────────────────┐
│                     LOCAL DEVELOPMENT                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌────────────────┐                 ┌────────────────┐      │
│  │  Docker         │                 │  Node.js       │      │
│  │  Containers     │                 │  Processes     │      │
│  │                 │                 │                │      │
│  │  ┌──────────┐  │                 │  ┌──────────┐  │      │
│  │  │PostgreSQL│  │◄───────────────►│  │Orchestr. │  │      │
│  │  │  :5433   │  │  DATABASE_URL   │  │  :3000   │  │      │
│  │  └──────────┘  │                 │  └──────────┘  │      │
│  │                 │                 │       ▲        │      │
│  │  ┌──────────┐  │                 │       │        │      │
│  │  │  Redis   │  │◄────────────────┼───────┴────────┤      │
│  │  │  :6380   │  │   REDIS_URL     │       │        │      │
│  │  └──────────┘  │                 │       │        │      │
│  │        ▲        │                 │       │        │      │
│  └────────┼────────┘                 │       │        │      │
│           │                          │       │        │      │
│           │  Message Bus (Pub/Sub    │       │        │      │
│           │  + Streams)              │       │        │      │
│           │                          │       │        │      │
│           └──────────────────────────┼───────┤        │      │
│                                      │       │        │      │
│                     ┌────────────────┘       │        │      │
│                     │                        │        │      │
│           ┌─────────▼────────┐     ┌─────────▼────────┐    │
│           │ Scaffold Agent   │     │ Validation Agent │    │
│           │ (Node Process)   │     │ (Node Process)   │    │
│           └──────────────────┘     └──────────────────┘    │
│                                                              │
│           ┌──────────────────┐     ┌──────────────────┐    │
│           │   E2E Agent      │     │ Integration Agent│    │
│           │ (Node Process)   │     │ (Node Process)   │    │
│           └──────────────────┘     └──────────────────┘    │
│                                                              │
│           ┌──────────────────┐                              │
│           │ Deployment Agent │                              │
│           │ (Node Process)   │                              │
│           └──────────────────┘                              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Port Allocation

### Infrastructure Services (Docker)

| Service    | Internal Port | External Port | Access URL                | Protocol |
|------------|---------------|---------------|---------------------------|----------|
| PostgreSQL | 5432          | **5433**      | localhost:5433            | TCP      |
| Redis      | 6379          | **6380**      | localhost:6380            | TCP      |

**Note:** External ports avoid conflicts with default installations:
- PostgreSQL default: 5432 → **5433** (to avoid conflicts)
- Redis default: 6379 → **6380** (to avoid conflicts)

### Application Services (Node.js)

| Service              | Port   | Access URL            | Type      | Process  |
|----------------------|--------|-----------------------|-----------|----------|
| Orchestrator API     | **3000** | http://localhost:3000 | HTTP/REST | Node.js  |
| Scaffold Agent       | N/A    | Redis consumer only   | Worker    | Node.js  |
| Validation Agent     | N/A    | Redis consumer only   | Worker    | Node.js  |
| E2E Agent            | N/A    | Redis consumer only   | Worker    | Node.js  |
| Integration Agent    | N/A    | Redis consumer only   | Worker    | Node.js  |
| Deployment Agent     | N/A    | Redis consumer only   | Worker    | Node.js  |

**Note:** Agents don't expose HTTP ports - they're pure message consumers

---

## Service Startup Sequence

### Two Process Management Options

**Option A: Bash Scripts** (Original)
- **Start:** `./scripts/env/start-dev.sh`
- **Stop:** `./scripts/env/stop-dev.sh`
- **Health Check:** `./scripts/env/check-health.sh`

**Option B: PM2** (New - Pilot-Ready)
- **Start:** `pnpm pm2:start`
- **Stop:** `pnpm pm2:stop`
- **Monitor:** `pnpm pm2:status`, `pnpm pm2:logs`, `pnpm pm2:monit`
- **See:** `pm2/README.md` for full documentation

Both approaches manage the same services. PM2 provides auto-restart, centralized monitoring, and better resilience for pilot deployments.

### Start Order (via `scripts/env/start-dev.sh`)

```
1. Docker Containers (parallel)
   ├── PostgreSQL :5433
   └── Redis :6380

2. Health Check Wait (5 seconds)
   ├── pg_isready check
   └── redis-cli ping check

3. Orchestrator API :3000
   └── Wait for /api/v1/health endpoint (30s timeout)

4. Scaffold Agent
   └── Sleep 3s for initialization

5. Pipeline Agents (sequential, 2s between each)
   ├── Validation Agent
   ├── E2E Agent
   ├── Integration Agent
   └── Deployment Agent
```

### PM2 Process Management (New)

**Prerequisites:**
```bash
pnpm install        # Install PM2 as local dependency
pnpm build          # Build all packages
docker-compose up -d redis postgres  # Start infrastructure
```

**Start with PM2:**
```bash
pnpm pm2:start      # Starts orchestrator + all agents
```

**PM2 Features:**
- ✅ Auto-restart on crash (max 10 restarts per process)
- ✅ Memory limit enforcement (1GB orchestrator, 512MB agents)
- ✅ Centralized log management (`scripts/logs/`)
- ✅ Live monitoring dashboard (`pnpm pm2:monit`)
- ✅ Process health tracking (`pnpm pm2:status`)
- ✅ Individual process control (`pm2 restart orchestrator`)

**Configuration:** `pm2/ecosystem.dev.config.js`

---

## Connection Strings & URLs

### Environment Variables (`.env`)

```bash
# Database
DATABASE_URL=postgresql://agentic:agentic_dev@localhost:5433/agentic_sdlc

# Redis
REDIS_URL=redis://localhost:6380

# Orchestrator
ORCHESTRATOR_PORT=3000

# API Keys
ANTHROPIC_API_KEY=sk-ant-api03-...
```

### Connection Details

**PostgreSQL:**
- Host: `localhost`
- Port: `5433`
- User: `agentic`
- Password: `agentic_dev`
- Database: `agentic_sdlc`
- Full URL: `postgresql://agentic:agentic_dev@localhost:5433/agentic_sdlc`

**Redis:**
- Host: `localhost`
- Port: `6380`
- Full URL: `redis://localhost:6380`
- Namespace per agent:
  - Orchestrator: `orchestrator`
  - Scaffold Agent: `agent-scaffold`
  - Validation Agent: `agent-validation`
  - E2E Agent: `agent-e2e`
  - Integration Agent: `agent-integration`
  - Deployment Agent: `agent-deployment`

---

## Message Bus Architecture

### Redis Usage Patterns

**Dual Mode: Pub/Sub + Streams**

1. **Pub/Sub:** Real-time message delivery (ephemeral)
   - Topic: `agent:scaffold:tasks`
   - Topic: `orchestrator:results`
   - Subscribers receive immediately if online

2. **Streams:** Durable message queue (persistent)
   - Stream: `stream:agent:scaffold:tasks`
   - Stream: `stream:orchestrator:results`
   - Consumer groups provide persistence + load balancing

### Message Flow

**Task Dispatch (Orchestrator → Agents):**
```
Orchestrator
  └─► messageBus.publish('agent:scaffold:tasks', envelope, {
        mirrorToStream: 'stream:agent:scaffold:tasks'
      })
        ├─► Redis Pub/Sub: 'agent:scaffold:tasks'
        └─► Redis Stream: 'stream:agent:scaffold:tasks'
                └─► Scaffold Agent consumes from stream
```

**Result Publishing (Agents → Orchestrator):**
```
Agent
  └─► messageBus.publish('orchestrator:results', agentResult, {
        mirrorToStream: 'stream:orchestrator:results'
      })
        ├─► Redis Pub/Sub: 'orchestrator:results'
        └─► Redis Stream: 'stream:orchestrator:results'
                └─► Orchestrator consumes from stream
```

---

## Agent Architecture

### Common Pattern (All Agents)

Each agent is a **standalone Node.js process** that:

1. **Initializes OrchestratorContainer:**
   ```typescript
   const container = new OrchestratorContainer({
     redisUrl: process.env.REDIS_URL || 'redis://localhost:6380',
     redisNamespace: 'agent-{type}',
     coordinators: {}
   });
   ```

2. **Gets Message Bus:**
   ```typescript
   const messageBus = container.getBus();
   ```

3. **Extends BaseAgent:**
   ```typescript
   const agent = new ScaffoldAgent(messageBus);
   await agent.initialize();
   ```

4. **Subscribes to Tasks:**
   - Topic: `agent:{type}:tasks`
   - Stream: `stream:agent:{type}:tasks`
   - Consumer Group: `agent-{type}-group`
   - Consumer Name: `consumer-{timestamp}`

5. **Publishes Results:**
   - Topic: `orchestrator:results`
   - Stream: `stream:orchestrator:results`

### Agent Isolation

**Each agent has:**
- Own Node.js process
- Own Redis namespace
- Own consumer group
- Own log file: `scripts/logs/{agent-name}.log`
- Own PID tracked in `.pids/services.pids`

**No shared memory or state between agents** - pure message passing.

---

## Logging & Monitoring

### Log Files (Directory: `scripts/logs/`)

| Service            | Log File                  | Content                          |
|--------------------|---------------------------|----------------------------------|
| Orchestrator       | `orchestrator.log`        | API, state machine, dispatching  |
| Scaffold Agent     | `scaffold-agent.log`      | Task execution, Claude API calls |
| Validation Agent   | `validation-agent.log`    | Code validation, linting         |
| E2E Agent          | `e2e-agent.log`           | E2E test execution               |
| Integration Agent  | `integration-agent.log`   | Integration test execution       |
| Deployment Agent   | `deployment-agent.log`    | Deployment operations            |

### Process Tracking

**PID File:** `.pids/services.pids`
- One PID per line
- Order: orchestrator, scaffold-agent, validation-agent, e2e-agent, integration-agent, deployment-agent
- Used by `stop-dev.sh` for graceful shutdown

---

## Health Checks

### Service Health Endpoints

**Orchestrator:**
```bash
curl http://localhost:3000/api/v1/health
# Response: { "status": "healthy", "timestamp": "...", ... }
```

**PostgreSQL:**
```bash
docker exec agentic-sdlc-postgres pg_isready -U agentic
# Response: "localhost:5432 - accepting connections"
```

**Redis:**
```bash
docker exec agentic-sdlc-redis redis-cli ping
# Response: "PONG"
```

### Comprehensive Health Check Script

```bash
./scripts/env/check-health.sh
```

Checks:
- Docker containers running
- PostgreSQL accepting connections
- Redis responding to PING
- Orchestrator HTTP endpoint
- All agent processes alive

---

## Docker Configuration

### Docker Compose Services

**File:** `docker-compose.yml`

**Networks:**
- Name: `agentic-network`
- Driver: `bridge`
- Isolation: Internal container communication

**Volumes:**
- `postgres_data`: PostgreSQL data persistence
- `redis_data`: Redis RDB/AOF persistence

### Container Details

**PostgreSQL Container:**
```yaml
container_name: agentic-sdlc-postgres
image: postgres:16-alpine
ports: ["5433:5432"]
environment:
  POSTGRES_USER: agentic
  POSTGRES_PASSWORD: agentic_dev
  POSTGRES_DB: agentic_sdlc
healthcheck:
  test: pg_isready -U agentic -d agentic_sdlc
  interval: 10s
  timeout: 5s
  retries: 5
```

**Redis Container:**
```yaml
container_name: agentic-sdlc-redis
image: redis:7-alpine
ports: ["6380:6379"]
command: redis-server --appendonly yes
healthcheck:
  test: redis-cli ping
  interval: 10s
  timeout: 5s
  retries: 5
```

---

## Development Workflow

### Starting the Environment

```bash
# 1. Clean start (stop → start)
./scripts/env/stop-dev.sh && ./scripts/env/start-dev.sh

# 2. Check health
./scripts/env/check-health.sh

# 3. Run a test workflow
./scripts/run-pipeline-test.sh "Hello World API"

# 4. Monitor logs
tail -f scripts/logs/orchestrator.log
tail -f scripts/logs/scaffold-agent.log
```

### After Code Changes

**Orchestrator changes:**
```bash
cd packages/orchestrator
npm run build
# Restart just orchestrator, or full environment
```

**Agent changes:**
```bash
cd packages/agents/scaffold-agent
npm run build
# Restart agents (stop-dev → start-dev picks up new build)
```

**Shared package changes (e.g., orchestrator hexagonal):**
```bash
npm run build  # Root level builds all packages
./scripts/env/stop-dev.sh && ./scripts/env/start-dev.sh
```

---

## Key Insight: Shared Package Dependency

### Critical Understanding

**Agents import from orchestrator package:**
```typescript
import { OrchestratorContainer } from '@agentic-sdlc/orchestrator/hexagonal/bootstrap';
```

This means:
- Agents use the **compiled** version of orchestrator's hexagonal layer
- Located in: `packages/orchestrator/dist/hexagonal/`
- Includes: `redis-bus.adapter.js`, `bootstrap.js`, etc.

**Implication:**
When you change `packages/orchestrator/src/hexagonal/adapters/redis-bus.adapter.ts`:
1. ✅ Must run `npm run build` in orchestrator package
2. ✅ Agents will pick up changes on next start (they import from dist/)
3. ❌ Hot reload **does not work** for hexagonal changes
4. ✅ Full `npm run build` at root ensures all packages sync

---

## Common Issues & Solutions

### Issue: Agents not receiving full envelope

**Symptom:** Agents receive message without `payload` or `workflow_context`

**Cause:** Agents running with old compiled version of redis-bus adapter

**Solution:**
```bash
npm run build  # Rebuild all packages
./scripts/env/stop-dev.sh && ./scripts/env/start-dev.sh
```

### Issue: Port already in use

**Symptom:** `EADDRINUSE` error on startup

**Ports to check:**
- 5433 (PostgreSQL)
- 6380 (Redis)
- 3000 (Orchestrator)

**Solution:**
```bash
# Find and kill processes using ports
lsof -i :3000 -i :5433 -i :6380
kill -9 <PID>

# Or use stop script
./scripts/env/stop-dev.sh
```

### Issue: Database connection refused

**Symptom:** `ECONNREFUSED localhost:5433`

**Solution:**
```bash
# Check Docker containers
docker ps | grep agentic

# Restart Docker services
docker-compose -f docker-compose.yml restart postgres
```

---

## Security Notes

### Development Credentials

⚠️ **Development-only credentials** - NOT for production:
- PostgreSQL: `agentic:agentic_dev`
- Database: `agentic_sdlc`

### API Keys

**Anthropic API Key:**
- Stored in `.env` file
- ⚠️ `.env` is in `.gitignore` - do NOT commit
- Each developer needs their own key

---

## Performance Considerations

### Redis Stream Settings

**Current Configuration:**
- Block time: 5000ms (5 seconds)
- Batch size: 10 messages per read
- Consumer groups: One per agent type

**Tuning Options:**
- Increase batch size for higher throughput
- Decrease block time for lower latency
- Add more consumers per group for horizontal scaling

### Process Management

**Current:** Simple script-based process management

**Future Options:**
- PM2 for production process management
- Docker Compose for all services (including Node apps)
- Kubernetes for cloud deployment

---

## Future Architecture Considerations

### Potential Improvements

1. **Containerize all services** (including agents)
   - Easier deployment
   - Better isolation
   - Simpler scaling

2. **Add API Gateway**
   - Single entry point
   - Rate limiting
   - Authentication

3. **Add Message Bus Monitoring**
   - RedisInsight for stream visualization
   - Metrics on message throughput
   - Dead letter queue monitoring

4. **Add Service Discovery**
   - Agents auto-register capabilities
   - Dynamic routing
   - Health-aware load balancing

---

## Quick Reference Commands

```bash
# Environment Management
./scripts/env/start-dev.sh        # Start all services
./scripts/env/stop-dev.sh         # Stop all services
./scripts/env/check-health.sh     # Health check

# Testing
./scripts/run-pipeline-test.sh "Test Name"  # Run workflow test
./scripts/run-pipeline-test.sh --list       # List test cases

# Logs
tail -f scripts/logs/orchestrator.log       # Watch orchestrator
tail -f scripts/logs/scaffold-agent.log     # Watch scaffold agent
grep ERROR scripts/logs/*.log               # Find all errors

# Docker
docker-compose ps                           # Show containers
docker-compose logs -f postgres             # Watch PostgreSQL logs
docker-compose logs -f redis                # Watch Redis logs
docker exec -it agentic-sdlc-postgres psql -U agentic -d agentic_sdlc  # DB shell
docker exec -it agentic-sdlc-redis redis-cli  # Redis shell

# Build
npm run build                               # Build all packages
cd packages/orchestrator && npm run build   # Build orchestrator only
cd packages/agents/scaffold-agent && npm run build  # Build agent only

# Process Management
cat .pids/services.pids                     # Show all PIDs
ps aux | grep node                          # Show running Node processes
kill -SIGTERM $(cat .pids/services.pids)    # Graceful shutdown
```

---

**Document Maintenance:**
- Update when architecture changes
- Update when ports change
- Update when new services added
- Review quarterly for accuracy
