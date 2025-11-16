# Dashboard Quick Start Guide

## 🚀 Get Dashboard Running (2 minutes)

### Option 1: Start Everything
```bash
./scripts/env/start-dev.sh
```
Then open: **http://localhost:3001**

### Option 2: Manual Start
```bash
# Terminal 1: Start Docker services
docker-compose -f docker-compose.simple.yml up -d

# Terminal 2: Start PM2 processes (if needed)
pnpm pm2:start

# Then open dashboard
open http://localhost:3001
```

### Option 3: Just Dashboard (if services already running)
```bash
docker-compose -f docker-compose.simple.yml restart dashboard
open http://localhost:3001
```

---

## 📍 What's Where

| URL | What | Status |
|-----|------|--------|
| http://localhost:3001 | Dashboard UI | ✅ Running |
| http://localhost:3000/api/v1/health | API Health | ✅ Running |
| http://localhost:3000/api/v1/stats/overview | KPI Data | ✅ Running |
| http://localhost:5433 | PostgreSQL | ✅ Running |
| http://localhost:6380 | Redis | ✅ Running |

---

## 📊 Dashboard Pages

### 1. Overview (Home)
- 4 KPI cards
- Status distribution pie chart
- 24h throughput area chart

### 2. Workflows
- List all workflows
- Filter by status & type
- View details

### 3. Agents
- Agent health cards
- Performance metrics
- Task completion chart
- System throughput

### 4. Traces
- Search traces
- Filter by status
- View trace details

---

## 🔧 Common Commands

### Start/Stop
```bash
./scripts/env/start-dev.sh      # Start all
./scripts/env/stop-dev.sh       # Stop all
```

### View Logs
```bash
pnpm pm2:logs                   # All logs
pnpm pm2:logs orchestrator      # Orchestrator only
docker logs agentic-sdlc-dashboard  # Dashboard
```

### Status
```bash
pnpm pm2:status                 # PM2 processes
docker-compose -f docker-compose.simple.yml ps   # Docker
```

---

## ✅ Quick Checks

### Is Dashboard Running?
```bash
curl http://localhost:3001
```

### Is API Working?
```bash
curl http://localhost:3000/api/v1/health
```

### Are Services Healthy?
```bash
docker-compose -f docker-compose.simple.yml ps
```

---

## 📚 Documentation

- **Phase Summary:** `DASHBOARD_PHASE_2_3_SUMMARY.md`
- **Dev Guide:** `DASHBOARD_IMPLEMENTATION_GUIDE.md`
- **Session Notes:** `SESSION_CONTINUATION_SUMMARY.md`

---

**Dashboard Status:** ✅ Production Ready | **Last Updated:** 2025-11-15
