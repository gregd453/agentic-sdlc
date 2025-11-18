# Dashboard Backend Server

Combined Express backend + React frontend in a single container.

## Overview

The dashboard now includes an Express backend server that:

1. **Serves static React frontend** (built by Vite)
2. **Exposes analytics API endpoints** (read-only)
3. **Provides health checks** for orchestration
4. **Connects to PostgreSQL** for data access

## Architecture

```
User Browser
    ↓
    ├─ GET http://localhost:3050/
    │  └─ Express serves static React build (index.html)
    │
    ├─ GET http://localhost:3050/api/v1/stats/*
    │  └─ Express API endpoints (analytics)
    │
    └─ GET http://localhost:3050/health
       └─ Health check endpoint
```

## Development

### Run Frontend Only (Vite)
```bash
cd packages/dashboard
npm run dev
# Opens on http://localhost:5173 (default Vite port)
```

### Run Backend Only (Express)
```bash
cd packages/dashboard
npm run server:dev
# Runs on http://localhost:3050
```

### Run Both Concurrently (Recommended)
```bash
cd packages/dashboard
npm run dev:full
# Frontend: http://localhost:5173
# Backend API: http://localhost:3050/api/v1/*
```

### Build for Production
```bash
cd packages/dashboard
npm run build
# Builds frontend (Vite) + backend (TypeScript)
# Output: dist/
```

## API Endpoints

### Health Checks

**GET /health**
```json
{
  "status": "healthy",
  "timestamp": "2025-11-18T09:00:00Z",
  "uptime": 123.45
}
```

**GET /ready**
```json
{
  "ready": true,
  "services": {
    "database": "connected",
    "api": "running"
  }
}
```

### Analytics - Stats

**GET /api/v1/stats/overview**
```json
{
  "totalWorkflows": 42,
  "totalTasks": 156,
  "totalErrors": 2,
  "timestamp": "2025-11-18T09:00:00Z"
}
```

**GET /api/v1/stats/agents**
```json
[
  {
    "type": "scaffold-agent",
    "taskCount": 50,
    "avgExecutionTime": 1234.5
  },
  {
    "type": "validation-agent",
    "taskCount": 40,
    "avgExecutionTime": 567.8
  }
]
```

**GET /api/v1/stats/timeseries?period=24h**
Query parameters: `period` (1h, 24h, 7d, 30d)

**GET /api/v1/stats/workflows**
Workflow statistics by type and status

### Analytics - Tasks

**GET /api/v1/tasks?workflowId=X&agentType=Y&status=Z&limit=50&offset=0**

Query parameters:
- `workflowId` - Filter by workflow ID
- `agentType` - Filter by agent type
- `status` - Filter by task status
- `limit` - Results per page (default: 50, max: 100)
- `offset` - Pagination offset (default: 0)

**GET /api/v1/tasks/:taskId**
Get single task by ID

### Analytics - Workflows

**GET /api/v1/workflows?status=X&type=Y&limit=50&offset=0**

Query parameters:
- `status` - Filter by workflow status
- `type` - Filter by workflow type
- `limit` - Results per page (default: 50, max: 100)
- `offset` - Pagination offset (default: 0)

**GET /api/v1/workflows/:workflowId**
Get workflow with stages and recent events

## Frontend API Integration

The React frontend makes requests to the same-origin API:

```typescript
// api/client.ts
const BASE_URL = 'http://localhost:3050/api/v1';

export const fetchStats = () => 
  fetch(`${BASE_URL}/stats/overview`).then(r => r.json());

export const fetchWorkflows = (filters?) =>
  fetch(`${BASE_URL}/workflows?${new URLSearchParams(filters)}`).then(r => r.json());
```

## Environment Variables

### Development

```bash
NODE_ENV=development
PORT=3050
LOG_LEVEL=debug
DATABASE_URL=postgresql://agentic:agentic_dev@localhost:5433/agentic_sdlc
```

### Production

```bash
NODE_ENV=production
PORT=3050
LOG_LEVEL=info
DATABASE_URL=postgresql://user:pass@postgres:5432/db_name
```

## File Structure

```
packages/dashboard/
├── src/                      # React frontend
│   ├── components/
│   ├── pages/
│   ├── api/                  # Frontend API client
│   └── App.tsx
├── server/                   # Express backend
│   └── index.ts              # Main server file
├── dist/                     # Built output
│   ├── index.html            # Vite build
│   └── server/index.js       # Compiled Express server
├── Dockerfile                # Development
├── Dockerfile.production     # Production (multi-stage)
├── vite.config.ts
├── tsconfig.json             # Frontend TS config
├── tsconfig.server.json      # Backend TS config
├── package.json
└── BACKEND.md               # This file
```

## Dependencies

### Frontend
- React 18
- Vite 5
- Tailwind CSS
- React Router

### Backend
- Express 4
- Prisma (database ORM)
- Pino (logger)
- TypeScript

## Docker

### Development
```bash
docker build -f packages/dashboard/Dockerfile -t dashboard:dev .
docker run -p 3050:3050 dashboard:dev
```

### Production
```bash
docker build -f packages/dashboard/Dockerfile.production -t dashboard:prod .
docker run -p 3050:3050 dashboard:prod
```

## Terraform Management

Managed via `infrastructure/local/dashboard.tf`:

```hcl
resource "docker_container" "dashboard" {
  # Builds image from packages/dashboard/Dockerfile
  # Starts server on port 3050
  # Serves frontend + API
}
```

Start with:
```bash
cd infrastructure/local
terraform apply
```

## Troubleshooting

### Server not starting

```bash
# Check logs
docker logs agentic-sdlc-dev-dashboard

# Rebuild image
docker build -f packages/dashboard/Dockerfile -t agentic-sdlc-dashboard .

# Restart container
docker restart agentic-sdlc-dev-dashboard
```

### Database connection error

```bash
# Verify PostgreSQL is running
psql -h localhost -p 5433 -U agentic -d agentic_sdlc

# Check DATABASE_URL
echo $DATABASE_URL

# Restart dashboard container
docker restart agentic-sdlc-dev-dashboard
```

### API endpoints not responding

```bash
# Check if server is running
curl http://localhost:3050/health

# Check logs for errors
docker logs agentic-sdlc-dev-dashboard

# Verify port binding
lsof -i :3050
```

## Related Documentation

- **PORT_CONFIGURATION.md** - Port assignments across environments
- **infrastructure/local/README.md** - Terraform usage
- **AGENTIC_SDLC_RUNBOOK.md** - Operational guide
