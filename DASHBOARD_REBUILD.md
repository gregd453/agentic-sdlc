# Dashboard Rebuild Guide

## Quick Start

After making changes to the dashboard code, redeploy with a single command:

```bash
./dev rebuild-dashboard
```

This automatically:
1. ✅ Loads environment variables
2. ✅ Builds React app with pnpm
3. ✅ Builds Docker image with Prisma generation
4. ✅ Restarts the dashboard container
5. ✅ Verifies health check

**No manual steps required!**

## What It Does

The `rebuild-dashboard` script fully automates the deployment cycle:

```
Modified Code
    ↓
pnpm build (React compilation)
    ↓
docker build (Docker image)
    ↓
docker rm -f (Stop old container)
    ↓
docker run (Start new container)
    ↓
Health check (Verify it works)
    ↓
✅ Done!
```

## Full Script (reference)

Location: `scripts/rebuild-dashboard.sh`

```bash
#!/bin/bash

# 1. Load environment variables (.env.development)
# 2. Build React dashboard: pnpm run build --filter=@agentic-sdlc/dashboard
# 3. Build Docker image: docker build -f packages/dashboard/Dockerfile.prod
# 4. Stop old container: docker rm -f agentic-sdlc-dev-dashboard
# 5. Start new container with proper networking and environment
# 6. Health check: curl http://localhost:3050
```

## Usage Examples

### Standard rebuild (most common)
```bash
./dev rebuild-dashboard
```

### After making dashboard component changes
```bash
# Edit packages/dashboard/src/components/Workflows/SomeComponent.tsx
# Then rebuild
./dev rebuild-dashboard

# Hard refresh browser to see changes
# Chrome: Ctrl+Shift+R
# Mac:    Cmd+Shift+R
```

### Troubleshooting

#### If rebuild fails
Check the build output:
```bash
# Run the script manually to see errors
scripts/rebuild-dashboard.sh
```

#### If React build fails
```bash
# Check environment variables are loaded
source .env.development

# Try building manually
pnpm run build --filter=@agentic-sdlc/dashboard
```

#### If Docker build fails
```bash
# Check if dependencies installed
pnpm install

# Try Docker build manually
docker build -f packages/dashboard/Dockerfile.prod -t agentic-sdlc-dashboard:latest .
```

#### If container won't start
```bash
# Check logs
docker logs agentic-sdlc-dev-dashboard

# Kill any existing container
docker rm -f agentic-sdlc-dev-dashboard

# Start fresh
./dev rebuild-dashboard
```

## Dev Workflow

1. **Start services** (once at session start):
   ```bash
   ./dev start
   ```

2. **Edit dashboard code**:
   - Modify `.tsx`, `.ts`, or `.css` files in `packages/dashboard/src/`

3. **Redeploy** (after your changes):
   ```bash
   ./dev rebuild-dashboard
   ```

4. **Verify in browser**:
   - Hard refresh: `Ctrl+Shift+R` (or `Cmd+Shift+R` on Mac)
   - Navigate to: http://localhost:3050

5. **Repeat** steps 2-4 for additional changes

## Alternatives (Manual Process)

If you need more control, you can run the steps manually:

```bash
# Step 1: Load environment
source .env.development

# Step 2: Build React
pnpm run build --filter=@agentic-sdlc/dashboard

# Step 3: Build Docker
docker build -f packages/dashboard/Dockerfile.prod -t agentic-sdlc-dashboard:latest .

# Step 4: Restart container
docker rm -f agentic-sdlc-dev-dashboard
sleep 2

docker run -d \
  --name agentic-sdlc-dev-dashboard \
  --network agentic-network \
  -p 3050:3050 \
  -e NODE_ENV=production \
  -e PORT=3050 \
  agentic-sdlc-dashboard:latest

# Step 5: Check health
sleep 3
curl http://localhost:3050
```

## Related Commands

```bash
# Stop everything
./dev stop

# Restart entire infrastructure
./dev restart

# View logs
./dev logs

# Check status
./dev status
```

## Files Modified

- `scripts/rebuild-dashboard.sh` - New automation script
- `dev` - Added `rebuild-dashboard` command

## Environment

The script uses variables from `.env.development`:
- `VITE_DASHBOARD_PORT=3053` (for React compilation, not Docker)
- `VITE_ORCHESTRATOR_PORT=3051`
- `NODE_ENV=production` (in Docker)

## Timing

Expected execution time: **30-60 seconds**
- React build: 5-10s
- Docker image: 15-30s
- Container startup: 5-10s
- Health check: 1-5s

## Success Indicators

✅ Script completes without errors
✅ Container health check passes (HTTP 200)
✅ No Docker restart loops
✅ Browser shows latest code after hard refresh
