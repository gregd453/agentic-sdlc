# Hello World Test - Prerequisites Checklist

**Purpose:** Pre-flight checklist before attempting first React app generation
**Estimated Setup Time:** 30-45 minutes

---

## ✅ Environment Prerequisites

### Required Software

- [ ] **Node.js 20+**
  ```bash
  node --version  # Should be v20.x.x
  ```

- [ ] **pnpm 8+**
  ```bash
  pnpm --version  # Should be 8.x.x or higher
  ```

- [ ] **Docker & Docker Compose**
  ```bash
  docker --version
  docker-compose --version
  ```

- [ ] **Git**
  ```bash
  git --version
  ```

- [ ] **PostgreSQL Client** (for debugging)
  ```bash
  psql --version
  ```

- [ ] **Redis CLI** (for monitoring)
  ```bash
  redis-cli --version
  ```

---

## 🔧 System Configuration

### 1. Environment Variables

- [ ] Create `.env` file in project root
  ```bash
  cp .env.example .env
  ```

- [ ] Required variables set:
  ```bash
  # Database
  DATABASE_URL=postgresql://agentic:agentic_dev@localhost:5433/agentic_sdlc

  # Redis
  REDIS_URL=redis://localhost:6380

  # Anthropic API
  ANTHROPIC_API_KEY=sk-ant-api03-...  # YOUR KEY HERE

  # Optional
  LOG_LEVEL=debug
  NODE_ENV=development
  ```

- [ ] Verify API key is valid:
  ```bash
  curl https://api.anthropic.com/v1/models \
    -H "x-api-key: $ANTHROPIC_API_KEY" \
    -H "anthropic-version: 2023-06-01"
  ```

### 2. Project Dependencies

- [ ] Install all dependencies
  ```bash
  pnpm install
  ```

- [ ] Build all packages
  ```bash
  pnpm build
  ```

- [ ] Run type checking
  ```bash
  pnpm typecheck
  # Expected: 0 errors across all packages
  ```

### 3. Database Setup

- [ ] Start PostgreSQL via Docker
  ```bash
  docker-compose up -d postgres
  ```

- [ ] Wait for PostgreSQL to be ready
  ```bash
  docker-compose logs postgres
  # Look for: "database system is ready to accept connections"
  ```

- [ ] Test connection
  ```bash
  psql -h localhost -p 5433 -U agentic -d agentic_sdlc -c "SELECT version();"
  # Password: agentic_dev
  ```

- [ ] Run Prisma migrations
  ```bash
  cd packages/orchestrator
  pnpm prisma migrate deploy
  ```

- [ ] Verify tables created
  ```bash
  psql -h localhost -p 5433 -U agentic -d agentic_sdlc -c "\dt"
  # Should show: workflows, agents, events, pipeline_executions, etc.
  ```

### 4. Redis Setup

- [ ] Start Redis via Docker
  ```bash
  docker-compose up -d redis
  ```

- [ ] Test connection
  ```bash
  redis-cli -p 6380 ping
  # Expected: PONG
  ```

- [ ] Clear any old data
  ```bash
  redis-cli -p 6380 FLUSHDB
  ```

### 5. Orchestrator Setup

- [ ] Navigate to orchestrator
  ```bash
  cd packages/orchestrator
  ```

- [ ] Start in development mode
  ```bash
  pnpm dev
  ```

- [ ] Verify startup logs (in another terminal)
  ```
  [INFO] Orchestrator starting...
  [INFO] Database connected
  [INFO] Redis connected
  [INFO] Server listening on http://localhost:3000
  ```

- [ ] Test health endpoint
  ```bash
  curl http://localhost:3000/health | jq
  ```

  Expected response:
  ```json
  {
    "status": "healthy",
    "timestamp": "2025-11-09T...",
    "uptime_seconds": 5
  }
  ```

- [ ] Test API documentation
  ```bash
  open http://localhost:3000/documentation
  # Or visit in browser
  ```

---

## 🎨 Template Setup (CRITICAL)

### Create React Template Directory

- [ ] Create template directory structure
  ```bash
  mkdir -p packages/agents/scaffold-agent/templates/app/react-spa/src
  ```

- [ ] Verify directory exists
  ```bash
  ls -la packages/agents/scaffold-agent/templates/app/react-spa/
  ```

**NOTE:** Templates will be created in Phase 2 of the testing plan.

---

## 🧪 Verification Tests

### Test Suite

- [ ] Run all tests to verify system health
  ```bash
  pnpm test
  # Expected: ~421 tests passing
  ```

- [ ] Run orchestrator tests specifically
  ```bash
  pnpm --filter @agentic-sdlc/orchestrator test
  # Expected: 115+ tests passing
  ```

- [ ] Run scaffold agent tests
  ```bash
  pnpm --filter @agentic-sdlc/scaffold-agent test
  # Expected: 46 tests passing
  ```

### Docker Health Checks

- [ ] Verify all containers healthy
  ```bash
  docker-compose ps
  ```

  Expected output:
  ```
  agentic-sdlc-postgres   Up   healthy
  agentic-sdlc-redis      Up   healthy
  ```

- [ ] Check container logs for errors
  ```bash
  docker-compose logs --tail=50 postgres
  docker-compose logs --tail=50 redis
  ```

---

## 📊 System Status Dashboard

### Quick Status Check Script

Create a helper script to check all services:

```bash
#!/bin/bash
# save as: check-status.sh

echo "=== Agentic SDLC Status ==="
echo ""

echo "1. PostgreSQL:"
docker ps | grep postgres && echo "  ✅ Running" || echo "  ❌ Not running"

echo ""
echo "2. Redis:"
docker ps | grep redis && echo "  ✅ Running" || echo "  ❌ Not running"

echo ""
echo "3. PostgreSQL Connection:"
pg_isready -h localhost -p 5433 -U agentic > /dev/null 2>&1 && echo "  ✅ Connected" || echo "  ❌ Cannot connect"

echo ""
echo "4. Redis Connection:"
redis-cli -p 6380 ping > /dev/null 2>&1 && echo "  ✅ Connected" || echo "  ❌ Cannot connect"

echo ""
echo "5. Orchestrator API:"
curl -s http://localhost:3000/health > /dev/null 2>&1 && echo "  ✅ Responding" || echo "  ❌ Not responding"

echo ""
echo "6. Database Tables:"
psql -h localhost -p 5433 -U agentic -d agentic_sdlc -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';" 2>/dev/null && echo "  ✅ Migrated" || echo "  ❌ Not migrated"

echo ""
echo "=== End Status ==="
```

Make executable and run:
```bash
chmod +x check-status.sh
./check-status.sh
```

---

## 🚧 Common Setup Issues

### Issue: "Port already in use"

**Problem:** PostgreSQL port 5433 or Redis port 6380 already in use

**Solution:**
```bash
# Find process using port
lsof -i :5433
lsof -i :6380

# Kill process or change ports in docker-compose.yml
```

### Issue: "Cannot connect to database"

**Problem:** PostgreSQL not ready or wrong credentials

**Solution:**
```bash
# Check PostgreSQL logs
docker-compose logs postgres

# Verify DATABASE_URL in .env matches docker-compose.yml
# Default: postgresql://agentic:agentic_dev@localhost:5433/agentic_sdlc
```

### Issue: "Anthropic API key invalid"

**Problem:** API key missing or incorrect format

**Solution:**
```bash
# Check .env file
cat .env | grep ANTHROPIC_API_KEY

# Test key manually
curl https://api.anthropic.com/v1/messages \
  -H "content-type: application/json" \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -d '{"model":"claude-3-haiku-20240307","max_tokens":10,"messages":[{"role":"user","content":"Hi"}]}'
```

### Issue: "pnpm build fails"

**Problem:** TypeScript errors or missing dependencies

**Solution:**
```bash
# Clean and reinstall
rm -rf node_modules
rm pnpm-lock.yaml
pnpm install

# Check for type errors
pnpm typecheck

# Build specific packages in order
pnpm --filter @agentic-sdlc/shared-types build
pnpm --filter @agentic-sdlc/base-agent build
pnpm build
```

### Issue: "Tests failing"

**Problem:** Environment mismatch or database state

**Solution:**
```bash
# Use test database
export DATABASE_URL="postgresql://agentic:agentic_dev@localhost:5433/agentic_sdlc_test"

# Run migrations for test DB
cd packages/orchestrator
pnpm prisma migrate deploy

# Run tests in specific package
pnpm --filter @agentic-sdlc/orchestrator test
```

---

## ✅ Ready to Proceed Checklist

Before starting the Hello World test plan, ensure ALL of the following:

- [ ] ✅ PostgreSQL running and accepting connections
- [ ] ✅ Redis running and responding to PING
- [ ] ✅ Database migrations applied (tables exist)
- [ ] ✅ Orchestrator starts without errors
- [ ] ✅ Health endpoint returns 200 OK
- [ ] ✅ Anthropic API key configured and valid
- [ ] ✅ All packages built (`pnpm build` succeeds)
- [ ] ✅ All tests passing (`pnpm test` succeeds)
- [ ] ✅ No TypeScript errors (`pnpm typecheck` passes)
- [ ] ✅ Template directory created (empty is OK for now)

**If all checkboxes are checked, proceed to HELLO-WORLD-PLAN.md Phase 0!**

---

## 📞 Support

If stuck:
1. Check `docker-compose logs <service>`
2. Check `packages/orchestrator/logs/*.log`
3. Review CLAUDE.md for recent session notes
4. Check GitHub issues: https://github.com/yourusername/agent-sdlc/issues

---

**Last Updated:** 2025-11-09
**Next:** See HELLO-WORLD-PLAN.md for testing phases
