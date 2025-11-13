# Agentic SDLC - Environment Management Quick Reference

**Status:** ✅ Fully Operational

---

## 🚀 Quick Start

```bash
# Start everything
./scripts/env/start-dev.sh

# Check health
./scripts/env/check-health.sh

# Run a test workflow
./scripts/run-pipeline-test.sh "Hello World API"

# Stop everything
./scripts/env/stop-dev.sh
```

---

## 📋 All Commands

### Environment Management

**Start Development Environment**
```bash
./scripts/env/start-dev.sh [--verbose]
```
- Starts Docker containers (PostgreSQL, Redis)
- Starts Orchestrator API (port 3000)
- Starts all 5 agents (scaffold, validation, e2e, integration, deployment)
- Saves PIDs to `.pids/services.pids`
- Logs to `scripts/logs/`

**Stop Development Environment**
```bash
./scripts/env/stop-dev.sh [--force] [--containers]
```
- Graceful shutdown (SIGTERM → wait → SIGKILL)
- Cleans up orphaned processes
- Stops Docker containers
- Removes old logs (7+ days)

Options:
- `--force` - Force kill without waiting
- `--containers` - Only stop containers (leave processes)

**Check Health**
```bash
./scripts/env/check-health.sh [--wait] [--verbose]
```
- PostgreSQL (port 5433)
- Redis (port 6380)
- Orchestrator API (port 3000)
- Node processes

Options:
- `--wait` - Wait up to 60s for services to be ready
- `--verbose` - Show detailed output

### Reset Environment

**Complete Reset**
```bash
./scripts/env/reset-dev.sh
```
- Stops all services
- Removes Docker volumes (data loss!)
- Removes PID files
- Clears logs
- Fresh start

---

## 🧪 Testing

### Pipeline Tests (E2E Workflows)

**Run Single Test**
```bash
./scripts/run-pipeline-test.sh "Test Name"
```

**List All Tests**
```bash
./scripts/run-pipeline-test.sh --list
```

**Run All Tests**
```bash
./scripts/run-pipeline-test.sh --all
```

**Available Test Cases:**
1. Hello World API
2. Slate Nightfall Calculator
3. React Dashboard
4. Form Application
5. Todo List
6. Fullstack Notes App
7. Performance Test
8. Component Library

### Tier Tests

**Tier 1: Trivial (5 boxes, ~5-10 min)**
```bash
./scripts/run-tier-1-tests.sh
```

**Tier 2: Easy (8 boxes, ~15-25 min)**
```bash
./scripts/run-tier-2-tests.sh
```

**Tier 3: Medium (7 boxes, ~30-40 min)**
```bash
./scripts/run-tier-3-tests.sh
```

**Tier 4: Hard (21 boxes, ~60-90 min)**
```bash
./scripts/run-tier-4-tests.sh
```

### Other Tests

**Integration Tests**
```bash
./scripts/integration-tests.sh
```

**Performance Tests**
```bash
./scripts/performance-tests.sh
```

**Security Scan**
```bash
./scripts/security-scan.sh
```

**Compliance Check**
```bash
./scripts/compliance-check.sh
```

---

## 🔍 Monitoring

### Service Logs

**View All Logs**
```bash
ls -lh scripts/logs/
```

**Tail Specific Service**
```bash
tail -f scripts/logs/orchestrator.log
tail -f scripts/logs/scaffold-agent.log
tail -f scripts/logs/validation-agent.log
```

**Follow All Logs**
```bash
tail -f scripts/logs/*.log
```

### Docker Logs

**Orchestrator**
```bash
docker logs -f agentic-sdlc-orchestrator
```

**PostgreSQL**
```bash
docker logs -f agentic-sdlc-postgres
```

**Redis**
```bash
docker logs -f agentic-sdlc-redis
```

### Process Information

**List Running Services**
```bash
cat .pids/services.pids
```

**Check Process Status**
```bash
ps aux | grep -E "(npm|tsx)" | grep -v grep
```

**Check Docker Containers**
```bash
docker ps
```

---

## 🌐 Service URLs

| Service | URL | Status Check |
|---------|-----|--------------|
| **Orchestrator API** | http://localhost:3000 | `curl http://localhost:3000/api/v1/health` |
| **PostgreSQL** | localhost:5433 | `pg_isready -h localhost -p 5433 -U agentic` |
| **Redis** | localhost:6380 | `redis-cli -p 6380 ping` |

---

## 📂 Important Directories

```
agent-sdlc/
├── .pids/                    # Process ID tracking
│   ├── services.pids         # Main PID list
│   └── services.pids.groups  # Process groups
│
├── scripts/
│   ├── env/                  # Environment scripts ✅
│   │   ├── start-dev.sh
│   │   ├── stop-dev.sh
│   │   ├── check-health.sh
│   │   └── reset-dev.sh
│   │
│   ├── logs/                 # Service logs
│   │   ├── orchestrator.log
│   │   ├── scaffold-agent.log
│   │   └── *.log
│   │
│   └── run-pipeline-test.sh  # E2E testing
│
└── .test-results/            # Test outputs
```

---

## 🔧 Common Workflows

### Daily Development

```bash
# Morning: Start environment
./scripts/env/start-dev.sh

# Check everything is healthy
./scripts/env/check-health.sh

# Run a quick test
./scripts/run-pipeline-test.sh "Hello World API"

# Evening: Stop environment
./scripts/env/stop-dev.sh
```

### Feature Testing

```bash
# Start environment
./scripts/env/start-dev.sh

# Run tier 1 smoke tests
./scripts/run-tier-1-tests.sh

# Run specific workflow test
./scripts/run-pipeline-test.sh "Your Feature Name"

# Monitor logs
tail -f scripts/logs/orchestrator.log
```

### Troubleshooting

```bash
# Check health
./scripts/env/check-health.sh --verbose

# View recent logs
tail -100 scripts/logs/orchestrator.log
tail -100 scripts/logs/scaffold-agent.log

# Check processes
ps aux | grep tsx

# Force restart
./scripts/env/stop-dev.sh --force
./scripts/env/start-dev.sh --verbose
```

### Complete Reset

```bash
# Nuclear option - removes all data
./scripts/env/reset-dev.sh

# Then start fresh
./scripts/env/start-dev.sh
```

---

## 💡 Tips

1. **Use `--verbose` flag** when debugging startup issues
2. **Check logs first** - `scripts/logs/` has detailed service logs
3. **Health checks** - Run `check-health.sh` if something seems wrong
4. **PIDs tracked** - Process IDs saved in `.pids/` for debugging
5. **Graceful shutdown** - Always use `stop-dev.sh` (not kill -9)
6. **Old logs cleaned** - Logs older than 7 days removed on shutdown

---

## 🐛 Common Issues

### Port Already in Use

```bash
# Find what's using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or use stop script
./scripts/env/stop-dev.sh --force
```

### Agent Won't Start

```bash
# Check logs
tail -50 scripts/logs/scaffold-agent.log

# Check if orchestrator is running
curl http://localhost:3000/api/v1/health

# Restart orchestrator
./scripts/env/stop-dev.sh
./scripts/env/start-dev.sh
```

### Docker Container Issues

```bash
# Check container status
docker ps -a

# View container logs
docker logs agentic-sdlc-postgres
docker logs agentic-sdlc-redis

# Restart containers
docker compose down
docker compose up -d postgres redis
```

### Orphaned Processes

```bash
# Stop script handles this automatically
./scripts/env/stop-dev.sh --force

# Manual cleanup if needed
pkill -f "npm run dev"
pkill -f "tsx watch"
```

---

## 📖 Additional Resources

- **CLAUDE.md** - Full project guide
- **EPCC_EXPLORE.md** - Detailed CLI analysis
- **docker-compose.yml** - Infrastructure configuration
- **PIPELINE-TEST-CASES.md** - E2E test case definitions

---

**Last Updated:** 2025-11-13 (Session #56)
**Status:** ✅ All commands operational and tested
