#!/bin/bash
# Box #9: Demo Generation
# Creates setup guides and demo scripts for generated applications
set -e

APP_NAME="${1:-hello-world-demo}"
DEMO_DIR="logs/demo-${APP_NAME}"

mkdir -p "$DEMO_DIR"

echo "🎬 Generating Demo Setup Guide for ${APP_NAME}..."

# Create setup guide
cat > "$DEMO_DIR/SETUP-GUIDE.md" << 'EOF'
# Demo Setup Guide

## Quick Start

### Prerequisites
- Node.js v20.11.0 (check: `node --version`)
- Docker & Docker Compose (check: `docker --version`)
- Git (check: `git --version`)

### Installation (5 minutes)

```bash
# 1. Clone repository
git clone <repo-url>
cd agent-sdlc

# 2. Start infrastructure
docker-compose up -d postgres redis

# 3. Install dependencies
pnpm install

# 4. Start services
pnpm dev
```

### Verify Installation

```bash
# Check Orchestrator (port 3000)
curl http://localhost:3000/api/v1/health

# Check Redis
redis-cli ping
# Should output: PONG

# Check PostgreSQL
psql -h localhost -U agentic -d agentic_sdlc -c "SELECT version();"
```

## Running Demo Applications

### Frontend (React 19.2.0)

```bash
cd /tmp/agentic-sdlc-output/<workflow-id>/<app-name>
npm install
npm run dev
# Open http://localhost:5173
```

### Backend (Fastify 5.6.1)

```bash
cd /tmp/agentic-sdlc-output/<workflow-id>/<app-name>-api
npm install
npm run dev
# Server runs on http://localhost:3001
```

### Full Stack

```bash
# Terminal 1: Start backend
cd api
npm run dev

# Terminal 2: Start frontend
cd app
npm run dev

# Browser: http://localhost:5173
# API: http://localhost:3001/api/v1/hello
```

## Test Scenarios

### Scenario 1: Hello World Request
```bash
curl http://localhost:3001/api/v1/hello -H "x-user-id: user-123"
# Expected: { data: { message: "Hello from Fastify", userId: "user-123" } }
```

### Scenario 2: Database Integration
```bash
curl http://localhost:3001/api/v1/messages -X POST \
  -H "Content-Type: application/json" \
  -H "x-user-id: user-123" \
  -d '{ "text": "Test message" }'
# Expected: { data: { id: "...", text: "Test message" } }
```

### Scenario 3: Health Checks
```bash
curl http://localhost:3001/health/live
curl http://localhost:3001/health/ready
curl http://localhost:3001/health/status
# All should return 200 OK
```

## Troubleshooting

### Port Already in Use
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use different port
PORT=3001 npm run dev
```

### Database Connection Error
```bash
# Check PostgreSQL
docker ps | grep postgres

# Reset database
docker-compose down -v
docker-compose up -d postgres
```

### Redis Connection Error
```bash
# Check Redis
docker ps | grep redis

# Restart Redis
docker-compose restart redis
```

## Performance Tips

1. **Use pnpm** - Faster than npm (already configured)
2. **Enable caching** - Docker layer caching for faster rebuilds
3. **Database indexing** - Automatically created by Prisma
4. **API response time** - Monitor with: curl -w "@curl-format.txt" <url>

## Production Deployment

See `/docs/deployment.md` for production setup with:
- Blue-green deployments
- Health checks
- Auto-scaling
- Monitoring

## Getting Help

- Check logs: `docker-compose logs -f`
- View errors: `npm run dev` with debug: `DEBUG=* npm run dev`
- Consult docs: See `/docs` directory

---
**Generated:** $(date '+%Y-%m-%d %H:%M:%S')
**Version:** 1.0.0
EOF

# Create demo execution script
cat > "$DEMO_DIR/run-demo.sh" << 'DEMO_SCRIPT'
#!/bin/bash
# Demo Execution Script

echo "╔═══════════════════════════════════════════════════╗"
echo "║    DEMO: Full Stack Application                  ║"
echo "║    React 19.2.0 + Fastify 5.6.1 + Prisma        ║"
echo "╚═══════════════════════════════════════════════════╝"
echo ""

echo "✅ Backend running on http://localhost:3001"
echo "✅ Frontend running on http://localhost:5173"
echo ""

echo "Testing API endpoints..."
echo ""

echo "1. Health Check (Liveness)"
curl -s http://localhost:3001/health/live | jq '.' || echo "❌ Failed"
echo ""

echo "2. Health Check (Readiness)"
curl -s http://localhost:3001/health/ready | jq '.' || echo "❌ Failed"
echo ""

echo "3. Hello Endpoint"
curl -s http://localhost:3001/api/v1/hello \
  -H "x-user-id: demo-user" | jq '.' || echo "❌ Failed"
echo ""

echo "4. Create Message"
RESPONSE=$(curl -s http://localhost:3001/api/v1/messages \
  -X POST \
  -H "Content-Type: application/json" \
  -H "x-user-id: demo-user" \
  -d '{ "text": "Demo message from test" }')
echo "$RESPONSE" | jq '.'
echo ""

echo "5. List Messages"
curl -s http://localhost:3001/api/v1/messages \
  -H "x-user-id: demo-user" | jq '.'
echo ""

echo "✅ Demo Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
DEMO_SCRIPT

chmod +x "$DEMO_DIR/run-demo.sh"

echo ""
echo "✅ Demo Generation Complete"
echo "   Setup Guide: $DEMO_DIR/SETUP-GUIDE.md"
echo "   Demo Script: $DEMO_DIR/run-demo.sh"
