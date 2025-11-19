# Docker Development Guide - UI Application Management

## Problem
The Dashboard container runs with a COPY of code from build time. Host changes are NOT reflected in the running container because:
1. **No volume mounts** in current Terraform setup
2. **Static code** copied at image build time
3. **Browser cache** persists old code
4. **Container rebuild** required for code changes

## Complete Workflow for Development with Hot Reload

### Option 1: Development Mode (Recommended for Active Development)
Run the dashboard on the host machine with Vite dev server, not in Docker:

```bash
# Stop Docker containers
./dev stop

# Start only backend services (orchestrator + agents + DB)
./dev orchestrator-only    # Runs PM2 services + Docker DB/Redis

# In a NEW terminal, run dashboard locally with hot reload
cd packages/dashboard
export VITE_DASHBOARD_PORT=3050
export VITE_API_URL=http://localhost:3051/api/v1
pnpm run dev
```

**Benefits:**
- ✅ Hot reload works instantly on code changes
- ✅ No container rebuild needed
- ✅ Faster development iteration
- ✅ Browser DevTools work better

### Option 2: Docker Production Mode (Full Docker Stack)
For testing the full Docker deployment:

```bash
# Step 1: Clean everything
./dev stop
docker system prune -f
docker rmi -f agentic-sdlc-dashboard:latest

# Step 2: Rebuild dashboard image
export VITE_DASHBOARD_PORT=3050
docker build -t agentic-sdlc-dashboard:latest -f packages/dashboard/Dockerfile .

# Step 3: Start full infrastructure
./dev start

# Step 4: Clear browser cache
# - Cmd+Shift+Delete (Mac) or Ctrl+Shift+Delete (Windows)
# - Clear all browsing data for localhost:3050
# - Hard refresh: Cmd+Shift+R or Ctrl+Shift+R
```

### Option 3: Docker Development Mode (Docker with Volume Mounts)
For Docker with live code changes (requires Dockerfile modification):

This requires updating the Terraform/Docker setup to mount volumes. See Improvement #1 below.

---

## Problems & Solutions

### Problem 1: Browser Cache
**Symptom:** Code changes appear in editor but not in browser

**Solution:**
```bash
# Hard refresh (clears browser cache)
Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)

# OR clear entire site data
DevTools → Application → Clear Site Data → Select localhost:3050 → Clear
```

### Problem 2: Vite Dev Server Not Picking Up Changes
**Symptom:** Changes in code don't appear even after refresh

**Solution:**
```bash
# If running locally:
# Vite watches files automatically, just save and refresh browser

# If in Docker:
# Must rebuild the image (no volume mounts)
docker build -t agentic-sdlc-dashboard:latest -f packages/dashboard/Dockerfile .
./dev restart
```

### Problem 3: API Endpoint Wrong
**Symptom:** 404 errors when submitting forms

**Solution:**
- Dashboard (port 3050) tries to call `/api/v1/workflows`
- This resolves to `localhost:3050/api/v1` (WRONG - no API there)
- Should call `localhost:3051/api/v1` (orchestrator)

**Fix in Modal:**
```typescript
// ❌ WRONG
const response = await fetch('/api/v1/workflows', {...})

// ✅ CORRECT
const response = await fetch('http://localhost:3051/api/v1/workflows', {...})
```

### Problem 4: Container Doesn't Start After Rebuild
**Symptom:** Container created but status is "Created", not "Up"

**Solution:**
```bash
# Start the created container
docker start agentic-sdlc-dev-dashboard

# OR full restart
./dev restart
```

---

## Automation Scripts

### Script 1: Fresh Dashboard Rebuild (Docker Mode)
```bash
#!/bin/bash
# file: scripts/rebuild-dashboard.sh

set -e

echo "🛑 Stopping all services..."
./dev stop

echo "🧹 Cleaning Docker resources..."
docker system prune -f
docker rmi -f agentic-sdlc-dashboard:latest 2>/dev/null || true

echo "🔨 Building dashboard image..."
export VITE_DASHBOARD_PORT=3050
docker build -t agentic-sdlc-dashboard:latest -f packages/dashboard/Dockerfile .

echo "🚀 Starting infrastructure..."
./dev start

echo "✅ Dashboard ready at http://localhost:3050"
echo "🧠 Don't forget to hard refresh (Cmd+Shift+R)"
```

### Script 2: Dashboard Development Mode (Local Vite)
```bash
#!/bin/bash
# file: scripts/dev-dashboard.sh

set -e

echo "🛑 Stopping Docker..."
./dev stop

echo "🚀 Starting backend services (PM2 + DB)..."
./dev orchestrator-only

sleep 3

echo "📊 Starting dashboard dev server..."
cd packages/dashboard
export VITE_DASHBOARD_PORT=3050
export VITE_API_URL=http://localhost:3051/api/v1
pnpm run dev
```

### Script 3: Clear Everything + Full Restart
```bash
#!/bin/bash
# file: scripts/full-reset.sh

set -e

echo "🛑 Stopping all services..."
./dev stop

echo "🧹 Cleaning Docker..."
docker system prune -f -a --volumes

echo "🧹 Cleaning build artifacts..."
rm -rf packages/dashboard/dist
rm -rf .turbo

echo "🔨 Rebuilding dashboard..."
export VITE_DASHBOARD_PORT=3050
docker build -t agentic-sdlc-dashboard:latest -f packages/dashboard/Dockerfile .

echo "🚀 Starting full infrastructure..."
./dev start

echo "✅ All services ready!"
echo "📊 Dashboard: http://localhost:3050"
echo "🔌 API: http://localhost:3051/api/v1/health"
```

---

## Recommended Development Workflow

### For Active Development:
```bash
# Terminal 1: Backend + DB
./dev orchestrator-only

# Terminal 2: Dashboard with hot reload
cd packages/dashboard && pnpm run dev
```

### For Testing Full Docker Stack:
```bash
# Full automated rebuild + restart
./scripts/full-reset.sh
```

### Quick Cache Clear:
```bash
# Browser: Cmd+Shift+Delete → Clear all for localhost:3050
# Then: Cmd+Shift+R (hard refresh)
```

---

## Checklist for Dashboard Changes

When making changes to the dashboard UI:

- [ ] Edit file (e.g., CreateMockWorkflowModal.tsx)
- [ ] If running locally with Vite: Save → Browser auto-reloads
- [ ] If running in Docker: Run `./scripts/rebuild-dashboard.sh`
- [ ] Hard refresh browser (Cmd+Shift+R or Ctrl+Shift+R)
- [ ] Clear browser cache if needed (Cmd+Shift+Delete)
- [ ] Open DevTools Console (F12) to check for errors
- [ ] Test the feature

---

## Future Improvements

### Improvement #1: Docker Development with Volume Mounts
Modify Terraform/Dockerfile to mount source directories:

```hcl
# infrastructure/local/dashboard.tf
resource "docker_container" "dashboard" {
  # ... existing config ...

  volumes {
    host_path      = abspath("${path.module}/../../packages/dashboard/src")
    container_path = "/app/packages/dashboard/src"
  }

  volumes {
    host_path      = abspath("${path.module}/../../packages/shared")
    container_path = "/app/packages/shared"
  }
}
```

This would enable hot reload even in Docker containers.

### Improvement #2: Unified Dev Command
Create a single `./dev dashboard-dev` command that:
1. Stops other services
2. Starts backend only
3. Runs Vite dev server
4. Watches for changes

### Improvement #3: Health Check Script
```bash
#!/bin/bash
# scripts/check-dashboard.sh
curl -s http://localhost:3050 | grep -q "Agentic SDLC" && echo "✅ Dashboard OK" || echo "❌ Dashboard Down"
```
