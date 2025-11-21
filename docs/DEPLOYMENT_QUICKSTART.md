# Deployment Pipeline - Quick Start

## One-Command Deployment (Local)

```bash
# Start everything with full validation
./infrastructure/local/deploy-with-validation.sh
```

This runs:
1. ✅ Cleanup (removes old containers)
2. ✅ Build dashboard image (with asset hashing)
3. ✅ Apply Terraform infrastructure
4. ✅ Start PM2 services (Orchestrator + Agents)
5. ✅ Validate all services
6. ✅ Generate deployment report

**Time:** ~50 seconds (first time), ~20 seconds (cached)

---

## Development Workflow (Recommended)

**Terminal 1: Start Services**
```bash
./dev start
# Starts: Docker (PostgreSQL, Redis, Dashboard) + PM2 services
```

**Terminal 2: Watch for Changes**
```bash
./dev watch
# Auto-rebuilds dashboard and restarts services on code changes
```

**Terminal 3: View Logs**
```bash
./dev logs
# Real-time logs from all services
```

**Then:** Edit React components and watch them update automatically!

---

## What Happens When You Save a Component

```
Edit src/components/MyComponent.tsx
  ↓ (2 seconds)
watch-and-redeploy.sh detects change
  ↓
pnpm build (Vite creates hashed assets)
  ↓
Docker rebuild with new image
  ↓
Container restart
  ↓
Browser auto-refresh (or manual F5)
  ↓
✅ Component updated with new changes
```

---

## Browser Cache Strategy (Automatic)

| Content | Cache Time | How? |
|---------|-----------|------|
| JavaScript/CSS assets | 1 year | Content-hashed filenames |
| index.html | Never | No-cache headers |
| API responses | Never | No-cache headers |

**What this means:**
- First visit caches everything
- Component changes force new downloads only for changed files
- Old unused assets automatically cleaned up
- No manual cache clearing needed

---

## Verify Services Are Healthy

```bash
# Run health checks
./infrastructure/local/post-deploy-validation.sh
```

Checks:
- ✅ All containers running
- ✅ Database responding
- ✅ Redis operational
- ✅ Dashboard serving (port 3050)
- ✅ Orchestrator API healthy (port 3051)
- ✅ PM2 services online
- ✅ Asset cache headers correct
- ✅ Service dependencies verified

---

## Production Build (for deployment)

```bash
# Build optimized production image
BUILD_ENV=prod ./infrastructure/local/deploy-with-validation.sh
```

Differences from dev:
- Smaller Docker image (~150MB vs ~500MB)
- Express serves static files (no Vite dev server)
- Asset hashing enabled
- Production optimizations

---

## Troubleshooting

**Q: Browser shows old component**
```bash
# Hard refresh (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)
# Or clear browser cache
```

**Q: Service won't start**
```bash
# Check if ports are available
lsof -i :3050 :3051 :5433 :6380

# Check Docker
docker ps

# Check Terraform
cd infrastructure/local && terraform show
```

**Q: Database error**
```bash
# Verify database is running
docker exec agentic-sdlc-dev-postgres pg_isready -U agentic

# Check connection
curl http://localhost:3051/api/v1/health
```

**Q: Deployment stuck**
```bash
# View real-time logs
./dev logs

# Stop and restart
./dev stop
sleep 2
./dev start
```

---

## Access Points

| Service | URL | Purpose |
|---------|-----|---------|
| Dashboard UI | http://localhost:3050 | React web interface |
| Orchestrator API | http://localhost:3051 | Backend API |
| Health Check | http://localhost:3051/api/v1/health | Service status |
| Database | localhost:5433 | PostgreSQL (psql or client) |
| Cache | localhost:6380 | Redis (redis-cli) |

---

## Command Reference

```bash
# Core
./dev start              # Start all services
./dev stop               # Stop all services
./dev restart            # Restart everything
./dev watch              # Watch and auto-redeploy

# Monitoring
./dev status             # Service status
./dev health             # Service health checks
./dev logs               # View logs

# Advanced
./infrastructure/local/deploy-with-validation.sh      # Full pipeline
./infrastructure/local/post-deploy-validation.sh      # Health checks only
./infrastructure/local/watch-and-redeploy.sh          # Dev auto-rebuild

# CI/CD
git push origin main     # Triggers GitHub Actions deployment
```

---

## Key Files

| File | Purpose |
|------|---------|
| `Dockerfile` | Development image (Vite dev server) |
| `Dockerfile.prod` | Production image (Express + static) |
| `packages/dashboard/server/index.ts` | Express with cache headers |
| `infrastructure/local/deploy-with-validation.sh` | Complete pipeline |
| `infrastructure/local/post-deploy-validation.sh` | Health checks |
| `DEPLOYMENT_PIPELINE.md` | Full documentation |

---

## Summary

✅ **Fully automated deployment pipeline** that ensures:
- All container changes deployed
- All caches properly invalidated
- All services verified healthy
- All artifacts propagated correctly
- All changes tracked with audit trail

**Result:** Code changes automatically flow from source → build → container → browser with zero manual steps.
