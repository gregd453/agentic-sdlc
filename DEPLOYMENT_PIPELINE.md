# Complete Deployment Pipeline Documentation

**Status:** ✅ Fully Automated | **Version:** 2.0 | **Updated:** 2025-11-19

## Table of Contents
1. [Overview](#overview)
2. [Component Flow Diagrams](#component-flow-diagrams)
3. [Local Development Pipeline](#local-development-pipeline)
4. [Production Deployment](#production-deployment)
5. [Cache Strategy](#cache-strategy)
6. [Troubleshooting](#troubleshooting)

---

## Overview

The deployment pipeline ensures that **React component changes propagate completely** through the entire stack with:
- ✅ Automatic caching with cache-busting
- ✅ Service health verification
- ✅ Old container cleanup
- ✅ Database health checks
- ✅ Complete audit trail

---

## Component Flow Diagrams

### Full Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     React Component Change                      │
└────────────────────────────┬────────────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │  Local Save     │
                    │  src/components │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
┌───────▼──────┐    ┌────────▼────────┐   ┌──────▼───────┐
│ Git Commit   │    │watch-and-       │   │GitHub Push   │
│              │    │redeploy.sh      │   │(CI/CD)       │
└───────┬──────┘    └────────┬────────┘   └──────┬───────┘
        │                    │                    │
        │          ┌─────────▼──────────┐         │
        │          │  pnpm build:       │         │
        │          │  - Vite bundling   │         │
        │          │  - Asset hashing   │         │
        │          │  - Express server  │         │
        │          └─────────┬──────────┘         │
        │                    │                    │
        │          ┌─────────▼──────────────────┐ │
        │          │ Docker Image (prod/dev)    │ │
        │          │ - Multi-stage build        │ │
        │          │ - Hashed assets: 1yr cache │ │
        │          │ - index.html: no-cache     │ │
        │          └─────────┬──────────────────┘ │
        │                    │                    │
        │          ┌─────────▼──────────────────┐ │
        │          │ Terraform Apply            │ │
        │          │ - Create/update containers │ │
        │          │ - PostgreSQL              │ │
        │          │ - Redis                   │ │
        │          │ - Dashboard (port 3050)   │ │
        │          └─────────┬──────────────────┘ │
        │                    │                    │
        │          ┌─────────▼──────────────────┐ │
        │          │ PM2 Services              │ │
        │          │ - Orchestrator            │ │
        │          │ - 5 Agent Types           │ │
        │          └─────────┬──────────────────┘ │
        │                    │                    │
        │          ┌─────────▼──────────────────┐ │
        │          │ Post-Deploy Validation     │ │
        │          │ ✓ Container health        │ │
        │          │ ✓ Service connectivity    │ │
        │          │ ✓ Database pool           │ │
        │          │ ✓ Asset cache headers     │ │
        │          │ ✓ Dependency verification │ │
        │          └─────────┬──────────────────┘ │
        │                    │                    │
        └────────────────────┼────────────────────┘
                             │
                    ┌────────▼────────────┐
                    │  ✅ Ready for Use   │
                    │                    │
                    │  Dashboard:        │
                    │  http://localhost  │
                    │  :3050             │
                    │                    │
                    │  API:              │
                    │  http://localhost  │
                    │  :3051             │
                    └────────────────────┘
```

---

## Local Development Pipeline

### Quick Start (Recommended)

```bash
# Terminal 1: Start everything
./dev start

# Terminal 2: Watch for changes and auto-redeploy
./dev watch

# Terminal 3: View logs
./dev logs
```

### Complete Development Workflow

**1. Start Infrastructure**
```bash
./dev start
# Executes: ./infrastructure/local/start-infra.sh
# Phase 1: Docker containers (Terraform)
# Phase 2: PM2 services (Orchestrator + Agents)
# Phase 3: Health checks
```

**2. Make Component Changes**
```bash
# Edit src/components/MyComponent.tsx
# File watcher detects changes in 2 seconds
```

**3. Auto-Redeploy (if ./dev watch running)**
```bash
./infrastructure/local/watch-and-redeploy.sh
# Detects: file hash changes
# Rebuilds: Docker image with new Dockerfile
# Restarts: Container with new assets
```

**4. Browser Automatically Updates**
```
┌─────────────────────────────────────────┐
│  Browser receives index.html (no-cache) │
│  ↓                                       │
│  New index.html has new asset refs      │
│  ↓                                       │
│  Browser fetches new assets (hashed)    │
│  ↓                                       │
│  React component updates displayed      │
└─────────────────────────────────────────┘
```

---

## Production Deployment

### GitHub Actions Flow

**Trigger:** Push to `main` branch

```bash
git push origin main
```

**Pipeline Steps:**

```
1. TEST JOB
   ├─ Lint (ESLint)
   ├─ TypeScript check
   ├─ Build all packages
   └─ Upload artifacts (dist/)

2. SECURITY JOB
   ├─ Trivy vulnerability scan
   └─ npm audit

3. DEPLOY JOB
   ├─ Build dashboard image (Dockerfile.prod)
   ├─ Terraform init/validate/plan/apply
   ├─ Output deployment info
   └─ (Returns build artifacts for use)

4. HEALTH CHECK JOB
   ├─ Wait for services
   ├─ Check dashboard (3050)
   ├─ Check API (3051)
   └─ Verify connectivity
```

### Manual Cloud Deployment

```bash
# (Future: After AWS Terraform configuration created)

# Set environment for AWS
export ENVIRONMENT=prod
export AWS_REGION=us-east-1
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...

# Run deployment
./infrastructure/cloud/deploy-aws.sh
```

---

## Cache Strategy

### Browser Cache Behavior

**Hash-based Assets** (Vite output)
```
GET /assets/index-A1B2C3D4.js
Cache-Control: public, max-age=31536000, immutable
↓
Cached for 1 year (365 days)
↓
URL changes = new cache entry (cache-busting)
```

**Dynamic Content** (index.html)
```
GET /index.html
Cache-Control: no-cache, no-store, must-revalidate
↓
Always fetches from server
↓
Returns new asset references (cache-busted URLs)
```

**API Responses**
```
GET /api/v1/workflows
Cache-Control: no-cache
↓
Always fresh from server
↓
React Query caches in memory
```

### How Cache Busting Works

```
Component source change:
  ↓
  pnpm build creates new bundle
  ↓
  Vite outputs: dist/assets/index-NEW_HASH.js
  ↓
  index.html updated with new reference
  ↓
  Browser fetches index.html (no-cache)
  ↓
  Browser sees: <script src="/assets/index-NEW_HASH.js">
  ↓
  Browser fetches new script (new cache entry)
  ↓
  Old cache entry never used (orphaned)
```

---

## Service Interdependencies

### Verification Order

```
1. PostgreSQL (Database)
   └─ Required by Dashboard API, Orchestrator
      CHECK: pg_isready -U agentic

2. Redis (Message Bus)
   └─ Required by Orchestrator, Agents
      CHECK: redis-cli ping

3. Dashboard Container
   └─ Requires: PostgreSQL, Redis
      CHECK: HTTP 200 on port 3050

4. Orchestrator (PM2)
   └─ Requires: PostgreSQL, Redis, Dashboard
      CHECK: HTTP 200 on /api/v1/health

5. Agents (PM2)
   └─ Require: Orchestrator, Redis
      CHECK: pm2 list | grep "online"
```

### Post-Deployment Validation

After deployment, verify:

```bash
./infrastructure/local/post-deploy-validation.sh
```

Checks performed:
- ✅ All containers running
- ✅ Database connectivity
- ✅ Redis connectivity
- ✅ Dashboard health
- ✅ API health
- ✅ PM2 services online
- ✅ Database pool health
- ✅ Asset cache headers
- ✅ Service interdependencies

---

## Enhanced Deployment Command

### Full Deployment with Validation

```bash
# Local development
./infrastructure/local/deploy-with-validation.sh

# With environment options
BUILD_ENV=prod ./infrastructure/local/deploy-with-validation.sh
VALIDATE=false ./infrastructure/local/deploy-with-validation.sh
```

**Phases:**
1. Pre-Deployment Cleanup (removes old containers)
2. Build Dashboard Image
3. Apply Terraform Configuration
4. Start PM2 Services
5. Run Comprehensive Validation
6. Generate Deployment Summary

---

## File Structure

```
infrastructure/
├─ local/
│  ├─ main.tf                          (Terraform main config)
│  ├─ dashboard.tf                     (Dashboard container)
│  ├─ postgres.tf                      (Database container)
│  ├─ redis.tf                         (Cache container)
│  ├─ start-infra.sh                   (Basic startup)
│  ├─ stop-infra.sh                    (Graceful shutdown)
│  ├─ watch-and-redeploy.sh            (Dev: auto-rebuild)
│  ├─ deploy-with-validation.sh        (Complete pipeline)
│  └─ post-deploy-validation.sh        (Health checks)
│
packages/dashboard/
├─ Dockerfile                          (Dev: Vite dev server)
├─ Dockerfile.prod                     (Prod: Static + Express)
├─ server/index.ts                     (Express app with cache headers)
├─ dist/                               (Built assets)
│  ├─ index.html                       (No cache)
│  ├─ assets/
│  │  ├─ index-ABC123.js              (1yr cache)
│  │  └─ index-ABC123.css             (1yr cache)
│  └─ server/                          (Compiled server code)
│
.github/workflows/
├─ deploy.yml                          (GitHub Actions pipeline)
└─ ...
```

---

## Troubleshooting

### Issue: Browser Shows Old React Component

**Symptom:** Component source changed but old version displays

**Causes & Solutions:**

1. **Browser cache not cleared**
   ```bash
   # Clear browser cache (Cmd+Shift+Delete on Mac)
   # Or: Hard refresh (Cmd+Shift+R on Mac)
   ```

2. **Service not restarted**
   ```bash
   # Check if container restarted
   docker ps | grep dashboard

   # Manually restart
   ./dev restart
   ```

3. **Build didn't run**
   ```bash
   # Check if pnpm build completed
   ls -la packages/dashboard/dist/

   # Force rebuild
   pnpm build --filter @agentic-sdlc/dashboard --force
   ```

### Issue: Services Won't Start

**Symptom:** `./dev start` fails

**Troubleshooting:**

```bash
# 1. Check ports are available
lsof -i :3050
lsof -i :3051
lsof -i :5433
lsof -i :6380

# 2. Check Docker is running
docker ps

# 3. Check Terraform state
cd infrastructure/local
terraform show

# 4. View detailed logs
pm2 logs
docker logs agentic-sdlc-dev-dashboard
```

### Issue: Database Connection Failed

**Symptom:** Dashboard shows "Database error"

**Solutions:**

```bash
# 1. Verify PostgreSQL is running
docker exec agentic-sdlc-dev-postgres pg_isready -U agentic

# 2. Check connection string
docker exec agentic-sdlc-dev-dashboard \
  curl http://localhost:3051/api/v1/health

# 3. Reset database
./dev stop
./dev start  # Recreates clean database

# 4. Run migrations
docker exec agentic-sdlc-dev-postgres \
  psql -U agentic -d agentic_sdlc -c "SELECT 1;"
```

### Issue: Asset Cache Not Working

**Symptom:** Page is slow due to re-fetching assets

**Check Cache Headers:**

```bash
# Check hashed asset cache
curl -I http://localhost:3050/assets/index-*.js | grep Cache-Control
# Expected: Cache-Control: public, max-age=31536000, immutable

# Check index.html cache
curl -I http://localhost:3050/index.html | grep Cache-Control
# Expected: Cache-Control: no-cache, no-store, must-revalidate
```

---

## Performance Monitoring

### Deployment Timing

After each deployment, check:

```bash
# Time breakdown
time ./infrastructure/local/deploy-with-validation.sh

# Components:
# Phase 1: Docker cleanup      ~2s
# Phase 2: Image build         ~30s (first time), ~5s (cached)
# Phase 3: Terraform apply     ~5s
# Phase 4: PM2 start           ~3s
# Phase 5: Validation          ~10s
# Total:                        ~50s (with rebuild)
```

### Service Health Metrics

```bash
# Container stats
docker stats

# PM2 status
pm2 list

# Database connections
docker exec agentic-sdlc-dev-postgres \
  psql -U agentic -d agentic_sdlc -c \
  "SELECT count(*) FROM pg_stat_activity;"
```

---

## Summary: Component Change Lifecycle

```
Edit src/components/Button.tsx
  ↓
File saved (watch detects in 2s)
  ↓
pnpm build:frontend (Vite creates new hashes)
  ↓
Docker rebuild (multi-stage, ~10s)
  ↓
Terraform updates container image reference
  ↓
Docker container recreated
  ↓
Express server starts
  ↓
Health check verifies 200 OK
  ↓
Browser requests index.html (no-cache)
  ↓
index.html references new asset hash: index-NEW_HASH.js
  ↓
Browser fetches new asset (new cache entry for 1 year)
  ↓
React loads from new asset
  ↓
Component displays with changes
  ✅ COMPLETE
```

---

**Next Steps:**
- Use `./dev start` to start development
- Use `./dev watch` to enable auto-redeploy
- Use `./infrastructure/local/post-deploy-validation.sh` to verify
- Use `./infrastructure/local/deploy-with-validation.sh` for complete pipeline
