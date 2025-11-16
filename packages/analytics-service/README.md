# Analytics Service

Read-only analytics and reporting microservice for Agentic SDLC platform.

## Overview

This service provides 12 read-only API endpoints for dashboard analytics, distributed tracing, task management, and workflow monitoring. It connects to the same PostgreSQL database as the orchestrator but operates independently for scalability.

## Features

- **Dashboard Statistics:** Overview metrics, agent performance, time series data, workflow statistics
- **Distributed Tracing:** Complete trace details, span hierarchy, workflow/task relationships
- **Task Management:** List and retrieve agent tasks with filtering
- **Workflow Queries:** List and retrieve workflows with filtering

## Endpoints

### Stats API (4 endpoints)
- `GET /api/v1/stats/overview` - Dashboard KPI counts
- `GET /api/v1/stats/agents` - Agent performance statistics
- `GET /api/v1/stats/timeseries?period=24h` - Time series data (1h, 24h, 7d, 30d)
- `GET /api/v1/stats/workflows` - Workflow statistics by type

### Traces API (4 endpoints)
- `GET /api/v1/traces/:traceId` - Trace details with metadata and hierarchy
- `GET /api/v1/traces/:traceId/spans` - All spans for a trace
- `GET /api/v1/traces/:traceId/workflows` - Workflows related to a trace
- `GET /api/v1/traces/:traceId/tasks` - Tasks related to a trace

### Tasks API (2 endpoints)
- `GET /api/v1/tasks` - List tasks with filters (workflow_id, agent_type, status)
- `GET /api/v1/tasks/:taskId` - Get task by ID

### Workflows API (2 endpoints)
- `GET /api/v1/workflows` - List workflows with filters (status, type, priority)
- `GET /api/v1/workflows/:id` - Get workflow by ID

### Health API
- `GET /health` - Basic liveness probe
- `GET /ready` - Readiness check

## Getting Started

### Development

```bash
# Start the service locally
pnpm dev

# Run in production mode
pnpm start

# Run tests
pnpm test

# Build TypeScript
pnpm build
```

### Docker

```bash
# Build image
docker build -f packages/analytics-service/Dockerfile -t analytics-service:latest .

# Run with docker-compose
docker-compose up -d analytics-service
```

## Environment Variables

- `NODE_ENV` - Environment (development/production)
- `PORT` - Server port (default: 3001)
- `HOST` - Server host (default: 0.0.0.0)
- `DATABASE_URL` - PostgreSQL connection string
- `LOG_LEVEL` - Logging level (debug/info/warn/error)

## Architecture

- **Routes:** API endpoint definitions with Zod validation
- **Services:** Business logic and orchestration
- **Repositories:** Database access layer (read-only)
- **Utils:** Logging and error handling

## Database

Connects to the same PostgreSQL database as orchestrator using Prisma Client. All operations are read-only.

## API Documentation

Full OpenAPI/Swagger documentation available at `/docs` endpoint when service is running.

## Monitoring

- Health check: `GET /health` or `GET /ready`
- Structured logging with Pino
- Request IDs for tracing

## Development Notes

- Zero orchestrator dependencies (pure read-only service)
- Fully type-safe with TypeScript strict mode
- Uses shared Prisma schema from orchestrator
- Follows platform conventions for error handling and logging
