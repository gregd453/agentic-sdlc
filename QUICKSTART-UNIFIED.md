# Quick Start: Unified Infrastructure Management

**Version:** 1.0 | **Status:** Production-Ready

---

## One Command to Start Everything

```bash
./dev start
```

That's it! This command:

1. ✅ Initializes Terraform (first run only)
2. ✅ Starts Docker containers (PostgreSQL, Redis, Dashboard)
3. ✅ Starts PM2 services (Orchestrator + 5 Agents)
4. ✅ Validates all services are healthy
5. ✅ Prints access information

**Total time:** ~60 seconds

---

## Enable Auto-Rebuild (In Another Terminal)

```bash
./dev watch
```

This enables automatic rebuilding when you edit code:
- Edit dashboard → auto-rebuild & redeploy
- Edit orchestrator → auto-rebuild & restart
- Edit agents → auto-rebuild & restart

**No manual restarts needed!**

---

## Stop Everything

```bash
./dev stop
```

Gracefully stops all services and cleans up.

---

## Your Services

Once started, access them at:

| Service | URL | Port |
|---------|-----|------|
| **Dashboard UI** | http://localhost:3050 | 3050 |
| **Orchestrator API** | http://localhost:3051/api/v1/health | 3051 |
| **PostgreSQL** | `psql -h localhost -p 5433 -U agentic` | 5433 |
| **Redis** | `redis-cli -p 6380` | 6380 |

---

## Development Workflow

### Terminal 1: Start Infrastructure
```bash
./dev start
# [waits for all services to be ready]
# ✓ All services healthy
```

### Terminal 2: Enable Auto-Rebuild
```bash
./dev watch
# [waits for file changes]
```

### Terminal 3: Edit Code
```bash
# Make changes to dashboard, orchestrator, or agents
vim packages/dashboard/src/App.tsx

# Terminal 2 automatically rebuilds and redeploys!
# No manual intervention needed
```

### View Results
```bash
# Open dashboard
./dev dashboard

# Check API health
./dev api

# View logs
./dev logs
```

### When Done
```bash
# Terminal 2: Stop watch
Ctrl+C

# Terminal 1: Stop everything
./dev stop
```

---

## Behind the Scenes

The `./dev` script delegates to three main orchestration scripts:

### 1. **start-infra.sh** - Full Startup
- Initializes Terraform
- Creates Docker network
- Starts Docker containers (PostgreSQL, Redis, Dashboard)
- Starts PM2 ecosystem (Orchestrator + 5 Agents)
- Validates health of all services

### 2. **stop-infra.sh** - Graceful Shutdown
- Stops PM2 services
- Destroys Docker containers
- Cleans up volumes

### 3. **watch-and-redeploy.sh** - Auto-Rebuild
- Monitors source files for changes
- Detects changes every 2 seconds
- Automatically rebuilds affected services
- Redeploys in 5-15 seconds

---

## Service Status

Check what's running:

```bash
./dev status      # CLI dashboard status
./dev health      # Service health checks
./dev logs        # Real-time logs
```

---

## Individual Service Management

If you need to start/restart individual services:

```bash
./dev orchestrator-only    # Start orchestrator only
./dev agents-only          # Start agents only
./dev dashboard-only       # Start dashboard only
./dev db-only              # Start database only
./dev cache-only           # Start cache only

./dev restart-orchestrator # Restart just orchestrator
./dev restart-agents       # Restart just agents
```

---

## Architecture Overview

```
┌──────────────────────────┐
│   ./dev start            │
└──────────┬───────────────┘
           │
    ┌──────┴──────┐
    │             │
    v             v
┌────────┐    ┌──────┐
│Terraform│    │ PM2  │
│(Docker) │    │(Host)│
└────┬───┘    └──┬───┘
     │           │
     ├─ PostgreSQL (5433)
     ├─ Redis (6380)
     ├─ Dashboard (3050)
     ├─ Orchestrator (3051)
     └─ Agents (5x) 

All validated with health checks ✓
```

---

## Troubleshooting

### Services won't start
```bash
# Check logs
./dev logs

# Try individual service
./dev orchestrator-only

# Check ports
lsof -i :3051
```

### Auto-rebuild not working
```bash
# Verify watcher is running
ps aux | grep watch-and-redeploy

# Check build output
pnpm build
```

### Need to preserve data when stopping
```bash
# Use this to keep volumes
KEEP_VOLUMES=true ./dev stop
```

---

## Advanced: Direct Infrastructure Control

For advanced users, you can also call orchestration scripts directly:

```bash
# Full paths
./infrastructure/local/start-infra.sh
./infrastructure/local/stop-infra.sh
./infrastructure/local/watch-and-redeploy.sh

# See detailed orchestration documentation
cat ./infrastructure/local/UNIFIED-ORCHESTRATION.md
```

---

## Next Steps

1. **Start**: `./dev start`
2. **Watch**: `./dev watch` (in another terminal)
3. **Develop**: Edit your code and see auto-rebuilds
4. **Stop**: `./dev stop`

For detailed information, see:
- `./infrastructure/local/UNIFIED-ORCHESTRATION.md` - Complete orchestration guide
- `./infrastructure/local/README.md` - Terraform configuration details
- `./PORT_CONFIGURATION.md` - Port mapping reference

Happy coding! 🚀
