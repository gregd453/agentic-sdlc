# Port Configuration Guide

This document defines all port assignments across development, testing, and production environments to prevent conflicts and maintain consistency.

## Quick Reference Table

| Service | Dev (Host) | Dev (Docker) | Test | Staging | Production |
|---------|-----------|--------------|------|---------|------------|
| PostgreSQL | 5433 | 5433 | 5434 | 5432 | 5432 (RDS) |
| Redis | 6380 | 6380 | 6381 | 6379 | 6379 (ElastiCache) |
| Orchestrator API | 3051 (PM2) | 3000 | 3000 | 3000 | 3000 |
| Dashboard UI | 3050 | 3050 | 3001 | 3001 | 3001 |
| Analytics | 3002 | 3002 | - | 3002 | 3002 |
| Prometheus Metrics | - | - | - | 9090 | 9090 |

## Environment Details

### Development Environment

**When using `./dev start` (PM2 + Docker Hybrid):**

```
Host Machine:
  - Orchestrator API:  http://localhost:3051  (PM2 process)
  - PostgreSQL:        localhost:5433         (Docker)
  - Redis:             localhost:6380         (Docker)
  - Dashboard:         http://localhost:3050  (Docker)
  - Analytics:         http://localhost:3002  (Docker)

Dashboard Docker Container:
  - Proxies to:        http://host.docker.internal:3051
  - (Reaches host PM2 orchestrator via Docker gateway)
```

**Network Architecture:**
```
┌─ Host Machine ─────────────────┐
│  PM2 Processes:                 │
│  ├─ Orchestrator :3051          │
│  ├─ Agents (5x)                 │
│  └─ ...                         │
└─────────────────────────────────┘
         ↑                        ↑
         │                        │
    Docker Network               host.docker.internal
         │                        │
┌─ Docker Containers ────────────┐
│  ├─ PostgreSQL :5433           │
│  ├─ Redis :6380                │
│  ├─ Dashboard :3050            │
│  │   └─ Proxies to 3051        │
│  └─ Analytics :3002            │
└─────────────────────────────────┘
```

### Test Environment

**When using `docker-compose.test.yml`:**

- **PostgreSQL:** `localhost:5434` (avoids conflict with dev on 5433)
- **Redis:** `localhost:6381` (avoids conflict with dev on 6380)  
- **Orchestrator API:** `localhost:3000` (Docker container)
- **Dashboard:** `localhost:3001` (Docker container)
- **Database:** `agentic_sdlc_test` (isolated from dev)
- **Redis Auth:** `agentic_redis_test` (password required)

**Important:** Test services run in Docker with isolated ports to allow concurrent dev + test execution.

### CI/CD Environment (GitHub Actions)

- **PostgreSQL:** Service container on standard port
- **Redis:** Service container on standard port
- **Database:** `agentic_sdlc_test`
- **Environment:** Set `NODE_ENV=test`

### Production Environment

**Docker Compose (`docker-compose.production.yml`):**

```
Internal Docker Network (service names):
  - orchestrator    :3000
  - postgres        :5432
  - redis           :6379
  - dashboard       :3001
  - agents (5x)     (internal communication via Redis)

External Access (host ports):
  - Orchestrator    :3000  → http://orchestrator:3000
  - Dashboard       :3001  → http://dashboard:3001
  - Metrics         :9090  → http://metrics:9090
```

**AWS/Cloud Deployment:**

```
RDS (Managed PostgreSQL):
  - Endpoint: rds-endpoint.region.rds.amazonaws.com:5432
  - Database: agentic_sdlc_prod
  - Via: VPC Security Groups

ElastiCache (Managed Redis):
  - Endpoint: elasticache-endpoint.region.cache.amazonaws.com:6379
  - Via: VPC Security Groups

ECS Services:
  - Orchestrator Task    → Port 3000
  - Agent Tasks (5x)     → Port N/A (internal communication)
  - Dashboard Task       → Port 3001
  - Load Balancer        → Routes external traffic
```

## Service Port Assignments

### 3000 - Orchestrator API (Production/Docker)

| Environment | Address | How to Access |
|-------------|---------|---------------|
| Dev (Docker) | `localhost:3000` | Direct from host (when using docker-compose.yml) |
| Dev (PM2) | `localhost:3051` | Direct from host (when using ./dev start) |
| Test | `localhost:3000` | Docker container |
| Prod | `orchestrator:3000` | Docker service name (internal) |

### 3050 - Dashboard (Dev Only)

- **Dev:** `localhost:3050` (Docker)
- **Internal Docker communication:** From dashboard to orchestrator via `host.docker.internal:3051`

### 3001 - Dashboard (Test/Prod)

- **Test:** `localhost:3001`
- **Production:** Service on port 3001
- **External access:** Via load balancer or reverse proxy

### 3002 - Analytics Service

- **Dev:** `localhost:3002` (Docker)
- **Production:** `localhost:3002` (Docker)

### 5433/5434/5432 - PostgreSQL

| Environment | Port | Container | Access |
|-------------|------|-----------|--------|
| Dev | 5433 | Docker | localhost:5433 |
| Test | 5434 | Docker | localhost:5434 (isolated) |
| Prod | 5432 | RDS | Via VPC (no direct access) |
| CI/CD | 5432 | Service | localhost:5432 |

**Database Names:**
- Dev: `agentic_sdlc`
- Test: `agentic_sdlc_test`
- Prod: `agentic_sdlc_prod`

### 6380/6381/6379 - Redis

| Environment | Port | Container | Access | Auth |
|-------------|------|-----------|--------|------|
| Dev | 6380 | Docker | localhost:6380 | None |
| Test | 6381 | Docker | localhost:6381 | `agentic_redis_test` |
| Prod | 6379 | ElastiCache | Via VPC | `${REDIS_PASSWORD}` |
| CI/CD | 6379 | Service | localhost:6379 | None |

### 9090 - Prometheus Metrics

- **Dev:** Not exposed (optional)
- **Staging/Prod:** `localhost:9090` or via load balancer

## Configuration Files

### Start Development Environment

```bash
./dev start
```

This automatically:
1. Starts Docker containers (PostgreSQL 5433, Redis 6380, Dashboard 3050, Analytics 3002)
2. Starts PM2 processes (Orchestrator on 3051, 5 agents)
3. Validates all services are healthy

### Stop Development Environment

```bash
./dev stop
```

### Run Tests with Isolated Ports

```bash
docker-compose -f docker-compose.test.yml up -d
```

This uses:
- PostgreSQL: 5434 (dev uses 5433)
- Redis: 6381 (dev uses 6380)
- Orchestrator: 3000 (same, but in Docker)

### Production Deployment

```bash
docker-compose -f docker-compose.production.yml up -d
```

All services communicate via Docker service names (no host ports needed internally).

## Troubleshooting Port Conflicts

### Port Already in Use

```bash
# Find process using port
lsof -i :PORT_NUMBER

# Or for specific service
lsof -i :5433  # PostgreSQL
lsof -i :6380  # Redis
lsof -i :3051  # Orchestrator (PM2)
```

### Kill Process on Port

```bash
# Gracefully (recommended)
./dev stop

# Force kill (if stuck)
kill -9 <PID>
```

### Test Runs While Dev is Running

This is **NOT SUPPORTED**. Tests use port 5434 for PostgreSQL to avoid conflicts, but other services (Redis, Orchestrator) still share ports:

**Solution:** Stop dev environment before running tests

```bash
./dev stop
docker-compose -f docker-compose.test.yml up -d
```

## Health Checks

Each service includes health checks that verify port connectivity:

```yaml
# Orchestrator health check
healthcheck:
  test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000/api/v1/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"]
  interval: 30s
  timeout: 10s
  retries: 3

# PostgreSQL health check
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U agentic -d agentic_sdlc"]
  interval: 10s
  timeout: 5s
  retries: 5
```

## Environment Variables

### Development

```bash
DATABASE_URL=postgresql://agentic:agentic_dev@localhost:5433/agentic_sdlc
REDIS_URL=redis://localhost:6380
ORCHESTRATOR_PORT=3051
VITE_PROXY_TARGET=http://host.docker.internal:3051
```

### Testing

```bash
DATABASE_URL=postgresql://agentic:agentic_password_test@localhost:5434/agentic_sdlc_test
REDIS_URL=redis://:agentic_redis_test@localhost:6381
ORCHESTRATOR_PORT=3000
NODE_ENV=test
```

### Production

```bash
DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379
ORCHESTRATOR_PORT=3000
NODE_ENV=production
LOG_LEVEL=info
```

## Related Documentation

- `.env.example` - Environment variable templates
- `.env.production.example` - Production environment template
- `docker-compose.yml` - Dev environment definition
- `docker-compose.test.yml` - Test environment definition
- `docker-compose.production.yml` - Production environment definition
- `pm2/ecosystem.dev.config.js` - PM2 process configuration
