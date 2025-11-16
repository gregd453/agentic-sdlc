# Dashboard Docker Deployment

**Status:** ✅ **Running Successfully**  
**Date:** 2025-11-16  
**Environment:** Docker Compose (Local Testing)

---

## 🚀 Quick Start

### Prerequisites
- Docker Desktop installed
- Located in project root: `/Users/Greg/Projects/apps/zyp/agent-sdlc`

### Start Services
```bash
docker-compose -f docker-compose.simple.yml up -d
```

### Stop Services
```bash
docker-compose -f docker-compose.simple.yml down
```

### View Logs
```bash
docker-compose -f docker-compose.simple.yml logs -f dashboard
```

---

## 📊 Running Services

All services are running and healthy:

| Service | Container | Port | Image | Status |
|---------|-----------|------|-------|--------|
| Dashboard | agentic-dashboard | 3001 | agentic-sdlc-dashboard:latest | ✅ Running |
| PostgreSQL | agentic-postgres | 5433 | postgres:16-alpine | ✅ Running |
| Redis | agentic-redis | 6380 | redis:7-alpine | ✅ Running |

---

## 🔗 Access Dashboard

**Dashboard URL:** http://localhost:3001

**Direct Access:**
```bash
# Open in browser
open http://localhost:3001

# Or curl to verify
curl http://localhost:3001
```

---

## 🐳 Docker Images

### Dashboard Image
- **Name:** `agentic-sdlc-dashboard:latest`
- **Size:** ~350MB (includes Node.js, build tools)
- **Base:** `node:20.11.0-alpine`
- **Build Time:** ~15 seconds
- **Runtime:** Python 3 http.server on port 3001

### Build Dashboard Image
```bash
docker build -f Dockerfile.dashboard -t agentic-sdlc-dashboard:latest .
```

---

## 📝 Docker Configuration

### docker-compose.simple.yml
Includes:
- **Dashboard** service (port 3001)
- **PostgreSQL** service (port 5433)
- **Redis** service (port 6380)
- **Shared network:** agentic-network
- **Named volumes** for data persistence

### Dockerfile.dashboard
Multi-stage build:
1. **Stage 1 (builder):** Installs dependencies and builds dashboard
2. **Stage 2 (runner):** Lightweight Alpine image with Python HTTP server

---

## 🔐 Credentials (Test Environment)

**PostgreSQL:**
- User: `agentic`
- Password: `agentic_password`
- Database: `agentic_sdlc`

**Redis:**
- Password: `agentic_password`

**Note:** These are test credentials. Use secure, unique passwords in production.

---

## ✅ Health Checks

All services have health checks configured:

- **Dashboard:** HTTP GET `/` → 3001
- **PostgreSQL:** `pg_isready` on port 5432
- **Redis:** `redis-cli ping` on port 6379

Check health:
```bash
docker-compose -f docker-compose.simple.yml ps
```

---

## 📦 Volume Mounts

Named volumes for data persistence:
- `postgres-data:/var/lib/postgresql/data` - PostgreSQL database
- `redis-data:/data` - Redis persistent data

Data persists across container restarts.

---

## 🧪 Testing the Dashboard

### 1. Verify Dashboard Loads
```bash
curl http://localhost:3001
# Should return HTML with script src="/assets/index-*.js"
```

### 2. Check Docker Logs
```bash
docker-compose -f docker-compose.simple.yml logs dashboard
# Should show "Serving on 0.0.0.0:3001"
```

### 3. Verify All Services Healthy
```bash
docker-compose -f docker-compose.simple.yml ps
# All services should show "Up" and health "healthy"
```

### 4. Access in Browser
Navigate to: **http://localhost:3001**

You should see:
- Agentic SDLC Dashboard title
- Navigation menu (Dashboard, Workflows, Traces, Agents)
- Empty state (no connected backend yet)

---

## 🔧 Troubleshooting

### Dashboard Not Loading
```bash
# Check logs
docker-compose -f docker-compose.simple.yml logs dashboard

# Restart service
docker-compose -f docker-compose.simple.yml restart dashboard
```

### Port Already in Use
```bash
# Find and kill process on port 3001
lsof -i :3001
kill -9 <PID>

# Or use different port in compose file
```

### Container Won't Start
```bash
# Check Docker logs
docker logs agentic-dashboard

# Inspect container
docker inspect agentic-dashboard

# Rebuild image
docker build -f Dockerfile.dashboard -t agentic-sdlc-dashboard:latest .
```

---

## 📈 Production Deployment

For production deployment with full orchestrator + agents:

### Use docker-compose.production.yml
```bash
docker-compose -f docker-compose.production.yml \
  --env-file .env.docker \
  up -d
```

### Set Environment Variables
Edit `.env.docker` with:
- Real database passwords
- API keys (ANTHROPIC_API_KEY, GITHUB_TOKEN)
- AWS credentials
- Redis password

---

## 🎯 What's Included

**Dashboard (Phase 1 Complete):**
- ✅ React 18 + TypeScript
- ✅ Filter Context System
- ✅ Global Filters Bar (time, environment, agent types)
- ✅ Enhanced API Client (5 new endpoints)
- ✅ Chart Utilities & Color Mapping
- ✅ Reusable Components (ChartContainer)
- ✅ Data Transformation Hooks
- ✅ React Flow DAG Builder

**What's Not Yet Visible:**
- ⏳ KPI Cards (requires backend integration)
- ⏳ Recharts Visualizations
- ⏳ Workflow Tables
- ⏳ Trace Graphs

---

## 📊 Build Information

| Metric | Value |
|--------|-------|
| Build Time | 15 seconds |
| Dashboard Bundle | 247.85 kB (75.87 kB gzipped) |
| Docker Image Size | ~350MB |
| Container Startup | <5 seconds |
| Port | 3001 |
| Server | Python http.server |

---

## 🚀 Next Steps

### To Test Frontend Changes
1. Dashboard code is built into the Docker image
2. For development, use: `./scripts/env/start-dev.sh`
3. For Docker deployment, rebuild: `docker build -f Dockerfile.dashboard -t agentic-sdlc-dashboard:latest .`

### To Connect Backend
1. Start orchestrator with agents
2. Update API_URL in dashboard component
3. Connect to your data

### To Deploy to Production
1. Update Dockerfile credentials
2. Use docker-compose.production.yml
3. Configure environment variables
4. Deploy to cloud (AWS, GCP, Azure, etc.)

---

## 📚 Related Documentation

- **EPCC_EXPLORE.md** - Architecture & discovery
- **EPCC_PLAN.md** - Implementation plan
- **EPCC_CODE.md** - What was built
- **TEST_RESULTS.md** - Test validation

---

**Dashboard Status:** ✅ Ready for testing and integration with backend services

**Container Status:** All services healthy and running

**Next Action:** Connect to backend orchestrator (optional for Phase 1 testing)

