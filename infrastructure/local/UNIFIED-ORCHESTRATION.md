# Unified Infrastructure Orchestration

**Version:** 1.0  
**Status:** Production-Ready

---

## Overview

Three-script unified system for managing local Agentic SDLC infrastructure:

1. **start-infra.sh** - Orchestrates complete startup (Docker + PM2 + health checks)
2. **stop-infra.sh** - Graceful shutdown (PM2 + Docker)
3. **watch-and-redeploy.sh** - Automatic redeployment on source changes

---

## Quick Start

### Start Everything

```bash
./infrastructure/local/start-infra.sh
```

**What happens:**
1. Terraform initializes (first run only)
2. Docker infrastructure created (PostgreSQL, Redis, Dashboard)
3. PM2 services started (Orchestrator + 5 Agents)
4. Health checks validate all services
5. Summary printed with access info

**Time to ready:** ~30-60 seconds

### Enable Auto-Redeploy

In another terminal:

```bash
./infrastructure/local/watch-and-redeploy.sh
```

**What happens:**
- Monitors source files for changes
- Automatically rebuilds and redeploys affected services
- No manual restart needed

### Stop Everything

```bash
./infrastructure/local/stop-infra.sh
```

**What happens:**
1. PM2 services stopped
2. Docker containers destroyed
3. All volumes removed (use `KEEP_VOLUMES=true` to preserve data)

---

## Service Architecture

```
┌─────────────────────────────────────────────────────────┐
│ ./start-infra.sh                                        │
└──────────────────┬──────────────────────────────────────┘
                   │
         ┌─────────┴─────────┐
         │                   │
    ┌────▼────┐      ┌───────▼─────┐
    │ Terraform│      │  PM2         │
    │ (Docker) │      │ (Processes)  │
    └────┬────┘      └───────┬──────┘
         │                   │
    ┌────▼──────────────────▼────┐
    │ Services                    │
    ├─────────────────────────────┤
    │ PostgreSQL  (5433) ✓        │
    │ Redis       (6380) ✓        │
    │ Dashboard   (3050) ✓        │
    │ Orchestr.   (3051) ✓        │
    │ Agents (5x)        ✓        │
    └─────────────────────────────┘
```

---

## Detailed Commands

### Phase 1: Docker Infrastructure (Terraform)

```bash
cd infrastructure/local

# Initialize (first time only)
terraform init

# See what will be created
terraform plan

# Create infrastructure
terraform apply -auto-approve

# View current state
terraform show

# Destroy infrastructure
terraform destroy -auto-approve
```

### Phase 2: PM2 Services

```bash
cd /repo/root

# Start PM2 ecosystem
pm2 start ecosystem.dev.config.js

# View running processes
pm2 list

# View logs
pm2 logs

# Restart all
pm2 restart ecosystem.dev.config.js

# Stop all
pm2 stop ecosystem.dev.config.js

# Kill all and clean
pm2 kill
```

### Phase 3: Health Validation

```bash
# PostgreSQL
docker exec agentic-sdlc-dev-postgres pg_isready -U agentic -d agentic_sdlc

# Redis
docker exec agentic-sdlc-dev-redis redis-cli ping

# Dashboard
curl http://localhost:3050

# Orchestrator
curl http://localhost:3051/api/v1/health
```

---

## Auto-Redeploy System

### How It Works

1. **File Monitoring** - Watches source directories for changes
2. **Change Detection** - Uses file hash comparison every 2 seconds
3. **Selective Rebuild** - Only rebuilds the changed component
4. **Automatic Restart** - Restarts via PM2 or Docker

### Monitored Directories

| Component | Watched Path | Action |
|-----------|---|---|
| Dashboard | `packages/dashboard/src/**` | Rebuild + restart container |
| Orchestrator | `packages/orchestrator/src/**` | Rebuild + restart PM2 |
| Agents | `packages/agents/**/src/**` | Rebuild + restart PM2 |

### Example: Dashboard Change

```
Source file changed: packages/dashboard/src/App.tsx
        ↓
Hash mismatch detected
        ↓
Docker image rebuilt
        ↓
Container stopped & removed
        ↓
New container started on port 3050
        ↓
Health check passed
        ↓
Service ready (automatic)
```

### Starting the Watcher

```bash
./infrastructure/local/watch-and-redeploy.sh
```

**Output:**
```
[INFO] Watching for changes...
[INFO] Press Ctrl+C to stop

[CHANGE] Dashboard source changed, rebuilding container...
[INFO] Building dashboard image...
[INFO] Recreating dashboard container...
[✓] Dashboard redeployed successfully
```

---

## Environment Variables

### start-infra.sh

No configuration needed; uses defaults from `terraform.tfvars`

### stop-infra.sh

```bash
# Keep data persistence (don't destroy volumes)
KEEP_VOLUMES=true ./infrastructure/local/stop-infra.sh
```

### watch-and-redeploy.sh

No configuration needed

---

## Troubleshooting

### Service Won't Start

```bash
# Check health
pm2 status

# View logs
pm2 logs orchestrator

# Check Terraform state
terraform state list

# Verify Docker
docker ps -a
```

### Auto-Redeploy Not Working

```bash
# Check file permissions
ls -la infrastructure/local/*.sh

# Make sure watcher is running
ps aux | grep watch-and-redeploy

# Check build logs
pnpm build --filter @agentic-sdlc/dashboard
```

### Port Conflicts

```bash
# Find what's using a port
lsof -i :3050

# Stop conflicting service
kill -9 <PID>
```

### Docker Issues

```bash
# See all containers
docker ps -a

# View logs
docker logs agentic-sdlc-dev-dashboard

# Rebuild image
docker build -f packages/dashboard/Dockerfile -t agent-sdlc-dashboard:latest .
```

---

## Integration with ./dev Script

The main `./dev` script at project root should delegate to:

```bash
./dev start     → ./infrastructure/local/start-infra.sh
./dev stop      → ./infrastructure/local/stop-infra.sh
./dev watch     → ./infrastructure/local/watch-and-redeploy.sh
```

---

## Workflow Example

### Development Session

```bash
# Terminal 1: Start everything
./infrastructure/local/start-infra.sh
# [waits for services to be ready]

# Terminal 2: Enable auto-redeploy
./infrastructure/local/watch-and-redeploy.sh
# [waits for file changes]

# Terminal 3: Edit code
vim packages/dashboard/src/App.tsx
# Watcher auto-rebuilds dashboard in Terminal 2
# No manual restart needed!

# View dashboard
open http://localhost:3050

# When done
Ctrl+C in Terminal 2 (stops watcher)
./infrastructure/local/stop-infra.sh
# [shuts down everything]
```

---

## Performance Notes

- **Start time:** 30-60 seconds (Terraform + PM2 startup)
- **Redeploy time:** 5-15 seconds (image rebuild + container restart)
- **Watch interval:** 2 seconds (file hash check)
- **Health check timeout:** 30 seconds per service

---

## Related Files

- `infrastructure/local/README.md` - Terraform detailed guide
- `infrastructure/local/versions.tf` - Provider configuration
- `infrastructure/local/variables.tf` - All configurable variables
- `infrastructure/local/terraform.tfvars` - Development values
- `pm2/ecosystem.dev.config.js` - PM2 process configuration
- `PORT_CONFIGURATION.md` - Complete port mapping reference

---

## Future Enhancements

- [ ] Kubernetes support (production)
- [ ] Multi-environment configuration (dev/test/staging)
- [ ] Automated backup on redeploy
- [ ] Metrics export on redeploy
- [ ] Database migration on redeploy
- [ ] Slack notifications on redeploy
