# Dashboard Infrastructure & Deployment Plan

**Version:** 1.0
**Date:** 2025-11-13
**Status:** Ready for Implementation
**Environment:** Development, Staging, Production

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current State Analysis](#current-state-analysis)
3. [Deployment Architecture](#deployment-architecture)
4. [Development Environment](#development-environment)
5. [Production Deployment](#production-deployment)
6. [CI/CD Pipeline](#cicd-pipeline)
7. [Monitoring & Observability](#monitoring--observability)
8. [Security & Compliance](#security--compliance)
9. [Rollout Plan](#rollout-plan)
10. [Operational Runbook](#operational-runbook)

---

## Executive Summary

### Objective
Deploy the Agent Workflow Monitoring Dashboard to development, staging, and production environments with full observability, security, and high availability.

### Current Status
- ✅ **Dashboard Code:** Implemented (React + TypeScript + Vite)
- ✅ **E2E Tests:** Working (7/11 tests passing, 4 require API)
- ✅ **Docker Support:** Basic Dockerfile exists
- ✅ **Dev Environment:** PM2 + Docker Compose configured
- ⏳ **Production Ready:** Needs deployment configuration

### Key Decisions

| Decision | Rationale |
|----------|-----------|
| **Dev:** PM2 + Local Build | Fast iteration, hot reload, easier debugging |
| **Staging/Prod:** Docker + Nginx | Production-grade, reverse proxy, static serving |
| **Build Strategy:** Multi-stage | Optimized image size, security hardening |
| **Deployment:** Rolling updates | Zero downtime, gradual rollout |
| **Monitoring:** Built-in metrics | Dashboard consumes orchestrator stats API |

---

## Current State Analysis

### Existing Infrastructure

```
Agentic SDLC Stack (Current)
├── PostgreSQL (port 5433)        # Database
├── Redis (port 6380)             # Message Bus
├── Orchestrator (port 3000)      # API Server
│   ├── Workflow Management
│   ├── Task Dispatch
│   ├── State Machine
│   └── REST API
├── 6 Agent Services (PM2)        # Task Executors
│   ├── scaffold-agent
│   ├── validation-agent
│   ├── e2e-agent
│   ├── integration-agent
│   └── deployment-agent
└── Dashboard (port 3001)         # NEW - Monitoring UI
    ├── React SPA
    ├── Vite Dev Server
    └── API Proxy → Orchestrator
```

### Gaps & Requirements

**Missing Infrastructure:**
1. Production-grade dashboard build process
2. Static asset serving (Nginx)
3. Dashboard health checks
4. Dashboard-specific monitoring
5. Production environment configuration
6. CDN/caching strategy (future)
7. Authentication/authorization (future)

**API Dependencies:**
- Dashboard requires orchestrator API endpoints
- Some endpoints missing (stats, traces, timeseries)
- Need to implement before full dashboard deployment

---

## Deployment Architecture

### 3-Tier Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       USER BROWSER                          │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTPS (443)
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    LOAD BALANCER (ALB)                      │
│                   SSL/TLS Termination                        │
└────────┬────────────────────────────┬───────────────────────┘
         │ /                          │ /api/*
         ▼                            ▼
┌──────────────────┐         ┌──────────────────────┐
│   DASHBOARD      │         │   ORCHESTRATOR       │
│   (Nginx + SPA)  │────────▶│   (Node.js API)      │
│   Port: 3001     │  Proxy  │   Port: 3000         │
└──────────────────┘         └──────────┬───────────┘
                                        │
                    ┌───────────────────┼───────────────────┐
                    ▼                   ▼                   ▼
              ┌──────────┐       ┌──────────┐       ┌──────────┐
              │PostgreSQL│       │  Redis   │       │ Agents   │
              │  :5432   │       │  :6379   │       │ Workers  │
              └──────────┘       └──────────┘       └──────────┘
```

### Component Isolation

| Environment | Dashboard | Orchestrator | Database | Redis | Agents |
|-------------|-----------|--------------|----------|-------|--------|
| **Dev**     | PM2 (local) | PM2 (local) | Docker | Docker | PM2 (local) |
| **Staging** | Docker + Nginx | Docker | RDS | ElastiCache | ECS/K8s |
| **Prod**    | Docker + Nginx | Docker (multi-AZ) | RDS (multi-AZ) | ElastiCache (cluster) | ECS/K8s (auto-scale) |

---

## Development Environment

### Option 1: PM2 (Current - Fast Iteration)

**Pros:**
- Hot module reload (instant feedback)
- Easy debugging (source maps, breakpoints)
- Lower resource usage
- Faster startup time

**Cons:**
- Not production-identical
- Requires Node.js installed locally
- Manual dependency management

**Configuration:**

```javascript
// pm2/ecosystem.dev.config.js (ADD DASHBOARD)
module.exports = {
  apps: [
    // ... existing apps ...
    {
      name: 'dashboard',
      script: 'node_modules/.bin/vite',
      args: '--host',
      cwd: path.resolve(__dirname, '../packages/dashboard'),

      env: {
        NODE_ENV: 'development',
        PORT: 3001,
        VITE_API_URL: 'http://localhost:3000'
      },

      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',

      error_file: './scripts/logs/dashboard-error.log',
      out_file: './scripts/logs/dashboard-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,

      listen_timeout: 10000,
      kill_timeout: 5000
    }
  ]
};
```

**Usage:**

```bash
# Start all services (including dashboard)
pnpm pm2:start

# Just dashboard
pm2 start pm2/ecosystem.dev.config.js --only dashboard

# Logs
pm2 logs dashboard

# Reload on code change (manual)
pm2 restart dashboard
```

### Option 2: Docker Compose (Production-like)

**Pros:**
- Matches production environment
- Isolated dependencies
- Easy to reset/clean
- Tests full Docker build

**Cons:**
- Slower iteration (rebuild on changes)
- More resource intensive
- Harder to debug

**Already Configured:** `docker-compose.yml:67-84`

```bash
# Start dashboard via Docker
docker-compose up dashboard

# Rebuild on code changes
docker-compose up --build dashboard

# Logs
docker logs -f agentic-sdlc-dashboard
```

### Hybrid Approach (RECOMMENDED)

```bash
# Use PM2 for active development
pnpm pm2:start

# Use Docker Compose for integration testing
docker-compose up dashboard --build

# Use both together (PM2 for dashboard, Docker for services)
docker-compose up postgres redis orchestrator  # Infrastructure
pnpm pm2:start --only dashboard                # Dashboard only
```

---

## Production Deployment

### Multi-Stage Docker Build

**Optimized Dockerfile** (Production):

```dockerfile
# ==========================================
# Stage 1: Dependencies
# ==========================================
FROM node:22-alpine AS deps
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@8.11.0 --activate

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# ==========================================
# Stage 2: Build
# ==========================================
FROM node:22-alpine AS builder
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@8.11.0 --activate

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install all dependencies (including devDependencies)
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN pnpm build

# ==========================================
# Stage 3: Runtime (Nginx)
# ==========================================
FROM nginx:1.25-alpine AS production

# Install curl for health checks
RUN apk add --no-cache curl

# Copy custom Nginx config
COPY nginx.conf /etc/nginx/nginx.conf

# Copy built static files from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Create non-root user
RUN addgroup -g 101 -S nginx && \
    adduser -S nginx -u 101 -G nginx

# Change ownership
RUN chown -R nginx:nginx /usr/share/nginx/html /var/cache/nginx /var/run

# Switch to non-root user
USER nginx

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/ || exit 1

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
```

**Nginx Configuration** (`packages/dashboard/nginx.conf`):

```nginx
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;

    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    server_tokens off;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript
               application/json application/javascript application/xml+rss
               application/rss+xml font/truetype font/opentype
               application/vnd.ms-fontobject image/svg+xml;

    # Server configuration
    server {
        listen 3001;
        server_name localhost;
        root /usr/share/nginx/html;
        index index.html;

        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Referrer-Policy "no-referrer-when-downgrade" always;

        # Static assets caching
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
            access_log off;
        }

        # API proxy (to orchestrator)
        location /api/ {
            proxy_pass http://orchestrator:3000;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;

            # Timeouts
            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
        }

        # SPA fallback (client-side routing)
        location / {
            try_files $uri $uri/ /index.html;
            add_header Cache-Control "no-cache";
        }

        # Health check endpoint
        location /health {
            access_log off;
            return 200 "healthy\n";
            add_header Content-Type text/plain;
        }

        # Deny access to sensitive files
        location ~ /\. {
            deny all;
            access_log off;
            log_not_found off;
        }
    }
}
```

### Environment Variables

**Development** (`.env.development`):

```bash
# Dashboard
NODE_ENV=development
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000
VITE_POLLING_INTERVAL=5000

# Optional
VITE_ENABLE_MOCK_DATA=false
VITE_LOG_LEVEL=debug
```

**Production** (`.env.production`):

```bash
# Dashboard
NODE_ENV=production
VITE_API_URL=https://api.agentic-sdlc.example.com
VITE_WS_URL=wss://api.agentic-sdlc.example.com
VITE_POLLING_INTERVAL=10000

# Security
VITE_ENABLE_ANALYTICS=true
VITE_SENTRY_DSN=https://xxx@sentry.io/xxx
```

### Build & Deploy Commands

```bash
# Development build (with source maps)
pnpm --filter @agentic-sdlc/dashboard build

# Production build (minified, optimized)
NODE_ENV=production pnpm --filter @agentic-sdlc/dashboard build

# Build Docker image
docker build -t agentic-sdlc-dashboard:latest -f packages/dashboard/Dockerfile packages/dashboard/

# Tag for registry
docker tag agentic-sdlc-dashboard:latest gcr.io/my-project/agentic-sdlc-dashboard:v1.0.0

# Push to registry
docker push gcr.io/my-project/agentic-sdlc-dashboard:v1.0.0
```

---

## CI/CD Pipeline

### GitHub Actions Workflow

**`.github/workflows/dashboard-deploy.yml`**:

```yaml
name: Dashboard CI/CD

on:
  push:
    branches: [main, develop]
    paths:
      - 'packages/dashboard/**'
      - '.github/workflows/dashboard-deploy.yml'
  pull_request:
    branches: [main]
    paths:
      - 'packages/dashboard/**'

env:
  NODE_VERSION: '22'
  PNPM_VERSION: '8.11.0'

jobs:
  # ==========================================
  # Job 1: Lint & Type Check
  # ==========================================
  lint-and-typecheck:
    name: Lint & Type Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v2
        with:
          version: ${{ env.PNPM_VERSION }}

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Type check
        run: pnpm --filter @agentic-sdlc/dashboard typecheck

      - name: Lint
        run: pnpm --filter @agentic-sdlc/dashboard lint

  # ==========================================
  # Job 2: Build
  # ==========================================
  build:
    name: Build Dashboard
    runs-on: ubuntu-latest
    needs: [lint-and-typecheck]
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v2
        with:
          version: ${{ env.PNPM_VERSION }}

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build
        run: pnpm --filter @agentic-sdlc/dashboard build
        env:
          NODE_ENV: production

      - name: Upload build artifacts
        uses: actions/upload-artifact@v4
        with:
          name: dashboard-dist
          path: packages/dashboard/dist
          retention-days: 7

  # ==========================================
  # Job 3: E2E Tests
  # ==========================================
  e2e-tests:
    name: E2E Tests
    runs-on: ubuntu-latest
    needs: [build]
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: agentic
          POSTGRES_PASSWORD: agentic_test
          POSTGRES_DB: agentic_sdlc_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

      redis:
        image: redis:7-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v2
        with:
          version: ${{ env.PNPM_VERSION }}

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Install Playwright browsers
        run: pnpm --filter @agentic-sdlc/dashboard exec playwright install --with-deps

      - name: Start orchestrator
        run: |
          pnpm --filter @agentic-sdlc/orchestrator db:migrate
          pnpm --filter @agentic-sdlc/orchestrator build
          pnpm --filter @agentic-sdlc/orchestrator start &
        env:
          DATABASE_URL: postgresql://agentic:agentic_test@localhost:5432/agentic_sdlc_test
          REDIS_URL: redis://localhost:6379

      - name: Wait for orchestrator
        run: |
          timeout 60 bash -c 'until curl -f http://localhost:3000/api/v1/health; do sleep 2; done'

      - name: Run E2E tests
        run: pnpm --filter @agentic-sdlc/dashboard test:e2e

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: packages/dashboard/playwright-report
          retention-days: 30

  # ==========================================
  # Job 4: Build Docker Image
  # ==========================================
  build-image:
    name: Build Docker Image
    runs-on: ubuntu-latest
    needs: [e2e-tests]
    if: github.ref == 'refs/heads/main' || github.ref == 'refs/heads/develop'
    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to Container Registry
        uses: docker/login-action@v3
        with:
          registry: gcr.io
          username: _json_key
          password: ${{ secrets.GCP_SA_KEY }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: gcr.io/${{ secrets.GCP_PROJECT_ID }}/agentic-sdlc-dashboard
          tags: |
            type=ref,event=branch
            type=sha,prefix={{branch}}-
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: ./packages/dashboard
          file: ./packages/dashboard/Dockerfile
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          platforms: linux/amd64,linux/arm64

  # ==========================================
  # Job 5: Deploy to Staging
  # ==========================================
  deploy-staging:
    name: Deploy to Staging
    runs-on: ubuntu-latest
    needs: [build-image]
    if: github.ref == 'refs/heads/develop'
    environment:
      name: staging
      url: https://dashboard-staging.agentic-sdlc.example.com
    steps:
      - uses: actions/checkout@v4

      - name: Configure kubectl
        run: |
          echo "${{ secrets.KUBE_CONFIG_STAGING }}" | base64 -d > $HOME/.kube/config

      - name: Deploy to Kubernetes
        run: |
          kubectl set image deployment/dashboard \
            dashboard=gcr.io/${{ secrets.GCP_PROJECT_ID }}/agentic-sdlc-dashboard:develop-${{ github.sha }} \
            -n staging
          kubectl rollout status deployment/dashboard -n staging --timeout=5m

      - name: Run smoke tests
        run: |
          curl -f https://dashboard-staging.agentic-sdlc.example.com/health || exit 1

  # ==========================================
  # Job 6: Deploy to Production
  # ==========================================
  deploy-production:
    name: Deploy to Production
    runs-on: ubuntu-latest
    needs: [build-image]
    if: github.ref == 'refs/heads/main'
    environment:
      name: production
      url: https://dashboard.agentic-sdlc.example.com
    steps:
      - uses: actions/checkout@v4

      - name: Configure kubectl
        run: |
          echo "${{ secrets.KUBE_CONFIG_PRODUCTION }}" | base64 -d > $HOME/.kube/config

      - name: Deploy to Kubernetes (Blue-Green)
        run: |
          # Deploy to blue environment
          kubectl set image deployment/dashboard-blue \
            dashboard=gcr.io/${{ secrets.GCP_PROJECT_ID }}/agentic-sdlc-dashboard:main-${{ github.sha }} \
            -n production
          kubectl rollout status deployment/dashboard-blue -n production --timeout=10m

          # Run smoke tests
          kubectl run smoke-test --rm -i --restart=Never --image=curlimages/curl -- \
            curl -f http://dashboard-blue.production.svc.cluster.local:3001/health

          # Switch traffic to blue
          kubectl patch service dashboard -n production -p '{"spec":{"selector":{"version":"blue"}}}'

          # Wait for traffic switch
          sleep 10

          # Update green to new version (for next deployment)
          kubectl set image deployment/dashboard-green \
            dashboard=gcr.io/${{ secrets.GCP_PROJECT_ID }}/agentic-sdlc-dashboard:main-${{ github.sha }} \
            -n production

      - name: Verify deployment
        run: |
          curl -f https://dashboard.agentic-sdlc.example.com/health || exit 1

      - name: Notify Slack
        if: always()
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: 'Dashboard deployment to production: ${{ job.status }}'
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

---

## Monitoring & Observability

### Health Checks

**Dashboard Health Check** (`packages/dashboard/src/health.ts`):

```typescript
// Simple health endpoint for container orchestration
export const healthCheck = () => {
  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version,
  };
};
```

### Metrics Collection

**Key Metrics to Track:**

1. **Performance Metrics:**
   - Page load time (FCP, LCP, TTI)
   - API response times
   - Bundle size
   - Cache hit rate

2. **User Metrics:**
   - Active sessions
   - Page views
   - Navigation paths
   - Error rates

3. **Infrastructure Metrics:**
   - Container CPU/memory usage
   - Request rate
   - Error rate (4xx, 5xx)
   - Nginx upstream health

**Implementation:**

```typescript
// src/utils/analytics.ts
export const trackPageView = (path: string) => {
  if (import.meta.env.PROD) {
    // Google Analytics
    window.gtag?.('config', 'GA_MEASUREMENT_ID', {
      page_path: path,
    });

    // Custom metrics
    fetch('/api/v1/analytics/pageview', {
      method: 'POST',
      body: JSON.stringify({ path, timestamp: Date.now() }),
    });
  }
};

export const trackError = (error: Error) => {
  if (import.meta.env.PROD) {
    // Sentry
    Sentry.captureException(error);

    // Custom metrics
    fetch('/api/v1/analytics/error', {
      method: 'POST',
      body: JSON.stringify({
        message: error.message,
        stack: error.stack,
        timestamp: Date.now(),
      }),
    });
  } else {
    console.error('Dashboard Error:', error);
  }
};
```

### Logging

**Nginx Access Logs:**

```nginx
# Custom log format with timing
log_format dashboard '$remote_addr - $remote_user [$time_local] '
                     '"$request" $status $body_bytes_sent '
                     '"$http_referer" "$http_user_agent" '
                     'rt=$request_time uct="$upstream_connect_time" '
                     'uht="$upstream_header_time" urt="$upstream_response_time"';

access_log /var/log/nginx/dashboard-access.log dashboard;
```

**Centralized Logging:**

```yaml
# docker-compose.production.yml
services:
  dashboard:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
        labels: "service=dashboard,environment=production"
```

---

## Security & Compliance

### Security Headers

**Already configured in `nginx.conf`:**

```nginx
# Security headers
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "no-referrer-when-downgrade" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' http://localhost:3000 https://api.agentic-sdlc.example.com;" always;
```

### Authentication & Authorization

**Phase 1 (Current):** Internal dashboard, no auth required
**Phase 2 (Future):** OAuth 2.0 + JWT

```typescript
// Future implementation
// src/auth/useAuth.ts
export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);

  const login = async (credentials: Credentials) => {
    const response = await fetch('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    const { token, user } = await response.json();
    localStorage.setItem('token', token);
    setUser(user);
  };

  return { user, login, logout };
};
```

### Secrets Management

**Development:**

```bash
# .env.local (gitignored)
VITE_API_URL=http://localhost:3000
```

**Production:**

```bash
# Kubernetes secrets
kubectl create secret generic dashboard-secrets \
  --from-literal=api-url=https://api.agentic-sdlc.example.com \
  --from-literal=sentry-dsn=https://xxx@sentry.io/xxx \
  -n production
```

---

## Rollout Plan

### Phase 1: Local Development (CURRENT)

**Timeline:** Now
**Goal:** Enable local dashboard development

**Tasks:**
- ✅ Dashboard code implemented
- ✅ E2E tests working (7/11 passing)
- ✅ Docker Compose configured
- ⏳ Add dashboard to PM2 config
- ⏳ Document local dev workflow

**Commands:**

```bash
# Start dashboard via PM2
pnpm pm2:start

# Or via Docker Compose
docker-compose up dashboard
```

### Phase 2: API Endpoint Implementation

**Timeline:** Next session
**Goal:** Complete API requirements for dashboard

**Tasks:**
- [ ] Implement stats endpoints (`/api/v1/stats/overview`, `/api/v1/stats/agents`)
- [ ] Implement trace endpoints (`/api/v1/traces/:id/spans`)
- [ ] Implement task endpoints (`/api/v1/tasks`)
- [ ] Update workflow endpoints (timeline, events)
- [ ] Add pagination support
- [ ] Add filtering support

**E2E Test Validation:**

```bash
# After API implementation, all 11 tests should pass
cd packages/dashboard
pnpm test:e2e

# Expected: 11/11 passing
```

### Phase 3: Production Build Optimization

**Timeline:** Week 2
**Goal:** Optimize dashboard for production

**Tasks:**
- [ ] Implement code splitting
- [ ] Add lazy loading for routes
- [ ] Optimize bundle size (target: <500KB)
- [ ] Add service worker (PWA)
- [ ] Implement error boundaries
- [ ] Add Sentry integration

**Validation:**

```bash
# Analyze bundle
pnpm --filter @agentic-sdlc/dashboard build --analyze

# Check bundle size
du -sh packages/dashboard/dist
```

### Phase 4: Staging Deployment

**Timeline:** Week 3
**Goal:** Deploy to staging environment

**Tasks:**
- [ ] Set up staging Kubernetes cluster
- [ ] Configure CI/CD pipeline
- [ ] Deploy dashboard + orchestrator
- [ ] Run full E2E test suite
- [ ] Load testing (100 concurrent users)
- [ ] Security scanning

**Validation:**

```bash
# Deploy to staging
kubectl apply -f k8s/staging/

# Verify deployment
kubectl get pods -n staging
kubectl logs -f deployment/dashboard -n staging

# Smoke tests
curl -f https://dashboard-staging.agentic-sdlc.example.com/health
```

### Phase 5: Production Deployment

**Timeline:** Week 4
**Goal:** Deploy to production

**Tasks:**
- [ ] Blue-green deployment setup
- [ ] Production database ready
- [ ] CDN configured (CloudFlare/CloudFront)
- [ ] Monitoring alerts configured
- [ ] Runbook documented
- [ ] Team training completed

**Go-Live Checklist:**

- [ ] All E2E tests passing (11/11)
- [ ] Performance tests passing (p95 < 2s)
- [ ] Security scan clean
- [ ] Backup & rollback tested
- [ ] On-call rotation staffed
- [ ] Stakeholders notified

---

## Operational Runbook

### Common Operations

#### 1. Start Dashboard (Development)

```bash
# Option A: PM2 (recommended for dev)
pnpm pm2:start --only dashboard
pm2 logs dashboard

# Option B: Docker Compose
docker-compose up dashboard

# Option C: Manual (for debugging)
cd packages/dashboard
pnpm dev
```

#### 2. Restart Dashboard (Production)

```bash
# Rolling restart (zero downtime)
kubectl rollout restart deployment/dashboard -n production

# Check status
kubectl rollout status deployment/dashboard -n production

# View logs
kubectl logs -f deployment/dashboard -n production --tail=100
```

#### 3. Rollback Deployment

```bash
# Rollback to previous version
kubectl rollout undo deployment/dashboard -n production

# Rollback to specific revision
kubectl rollout undo deployment/dashboard -n production --to-revision=5

# View rollout history
kubectl rollout history deployment/dashboard -n production
```

#### 4. Scale Dashboard

```bash
# Scale up (more replicas)
kubectl scale deployment/dashboard --replicas=5 -n production

# Horizontal Pod Autoscaler (HPA)
kubectl autoscale deployment dashboard --min=2 --max=10 --cpu-percent=70 -n production

# Check HPA status
kubectl get hpa -n production
```

#### 5. Debug Issues

```bash
# View logs
kubectl logs -f deployment/dashboard -n production

# Execute shell in pod
kubectl exec -it deployment/dashboard -n production -- /bin/sh

# Check environment variables
kubectl exec deployment/dashboard -n production -- env | grep VITE

# Check Nginx config
kubectl exec deployment/dashboard -n production -- nginx -t

# View recent events
kubectl get events -n production --sort-by='.lastTimestamp' | grep dashboard
```

#### 6. Monitor Performance

```bash
# Resource usage
kubectl top pod -n production -l app=dashboard

# Request rate (via Nginx logs)
kubectl logs -f deployment/dashboard -n production | grep "GET /" | wc -l

# Error rate
kubectl logs -f deployment/dashboard -n production | grep "HTTP/1.1 5"
```

### Troubleshooting Guide

| Issue | Symptoms | Solution |
|-------|----------|----------|
| **Dashboard not loading** | Blank page, 404 errors | Check Nginx config, verify static files copied, check browser console |
| **API calls failing** | Network errors, CORS issues | Verify orchestrator health, check proxy config in nginx.conf, verify API URL env var |
| **Slow page load** | High LCP/FCP times | Check bundle size, enable gzip, optimize images, implement code splitting |
| **Memory leak** | Increasing memory usage | Check for unsubscribed listeners, review useEffect cleanup, analyze heap dump |
| **High error rate** | 5xx errors in logs | Check orchestrator health, verify database connection, review error logs |

### Alert Thresholds

**Critical Alerts (PagerDuty):**

- Dashboard container down (no healthy replicas)
- Error rate > 5% (5xx responses)
- p95 response time > 5 seconds
- Health check failing for 5 minutes

**Warning Alerts (Slack):**

- Error rate > 1% (4xx/5xx responses)
- p95 response time > 2 seconds
- Memory usage > 80%
- CPU usage > 80%

---

## Appendix

### A. Package Scripts Reference

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src --ext .ts,.tsx",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:headed": "playwright test --headed",
    "test:e2e:debug": "playwright test --debug",
    "analyze": "vite build --analyze"
  }
}
```

### B. Environment Variables

| Variable | Dev | Staging | Prod | Description |
|----------|-----|---------|------|-------------|
| `NODE_ENV` | development | staging | production | Node environment |
| `VITE_API_URL` | http://localhost:3000 | https://api-staging.example.com | https://api.example.com | Orchestrator API URL |
| `VITE_WS_URL` | ws://localhost:3000 | wss://api-staging.example.com | wss://api.example.com | WebSocket URL |
| `VITE_POLLING_INTERVAL` | 5000 | 10000 | 10000 | Polling interval (ms) |
| `VITE_SENTRY_DSN` | - | https://xxx@sentry.io/staging | https://xxx@sentry.io/prod | Sentry error tracking |

### C. Kubernetes Manifests

**Deployment:**

```yaml
# k8s/dashboard-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: dashboard
  namespace: production
  labels:
    app: dashboard
    version: blue
spec:
  replicas: 3
  selector:
    matchLabels:
      app: dashboard
      version: blue
  template:
    metadata:
      labels:
        app: dashboard
        version: blue
    spec:
      containers:
      - name: dashboard
        image: gcr.io/my-project/agentic-sdlc-dashboard:latest
        ports:
        - containerPort: 3001
          name: http
        env:
        - name: NODE_ENV
          value: "production"
        resources:
          requests:
            cpu: 100m
            memory: 128Mi
          limits:
            cpu: 500m
            memory: 512Mi
        livenessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 10
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 5
          periodSeconds: 10
```

**Service:**

```yaml
# k8s/dashboard-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: dashboard
  namespace: production
spec:
  selector:
    app: dashboard
  ports:
  - port: 80
    targetPort: 3001
    protocol: TCP
  type: ClusterIP
```

**Ingress:**

```yaml
# k8s/dashboard-ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: dashboard
  namespace: production
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - dashboard.agentic-sdlc.example.com
    secretName: dashboard-tls
  rules:
  - host: dashboard.agentic-sdlc.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: dashboard
            port:
              number: 80
```

---

## Next Steps

### Immediate Actions (This Session)

1. ✅ Review and approve this infrastructure plan
2. ⏳ Add dashboard to PM2 config (`pm2/ecosystem.dev.config.js`)
3. ⏳ Test PM2 dashboard startup
4. ⏳ Verify all E2E tests still passing

### Next Session (API Implementation)

1. Implement missing orchestrator API endpoints
2. Verify 11/11 E2E tests passing
3. Performance testing
4. Security review

### Week 2 (Production Optimization)

1. Production Dockerfile with Nginx
2. CI/CD pipeline setup
3. Kubernetes manifests
4. Monitoring & alerting

### Week 3 (Staging Deployment)

1. Deploy to staging environment
2. Load testing
3. Security scanning
4. Runbook documentation

### Week 4 (Production Go-Live)

1. Blue-green deployment
2. Production monitoring
3. Team training
4. Stakeholder communication

---

**Document Status:** Ready for Review
**Next Review:** After API endpoint implementation
**Owner:** Platform Team
**Last Updated:** 2025-11-13
