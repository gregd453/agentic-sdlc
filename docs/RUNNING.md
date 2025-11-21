# 🚀 Running the Agentic SDLC System

This guide provides all the information needed to run and manage the Agentic SDLC orchestrator.

## 📋 Prerequisites

Before running the system, ensure you have:

- **Node.js 20+** - [Download](https://nodejs.org/)
- **pnpm 8+** - Install with `npm install -g pnpm`
- **Docker** - [Download](https://www.docker.com/)
- **Docker Compose** - Usually included with Docker Desktop

## 🎯 Quick Start

The fastest way to get started:

```bash
# Navigate to the project directory
cd /Users/Greg/Projects/apps/zyp/agent-sdlc

# Run the system
./run.sh start
```

This will:
1. Check prerequisites
2. Install dependencies
3. Start PostgreSQL and Redis
4. Run database migrations
5. Start the orchestrator
6. Open the API at http://localhost:3000

## 📜 Available Scripts

### Main Runner Script

```bash
./run.sh [command] [options]
```

#### Commands:
- `start` - Start the complete system (default)
- `stop` - Stop all services
- `status` - Check system status
- `test` - Run tests
- `test-api` - Test API endpoints
- `dev` - Start in development mode
- `prod` - Start in production mode
- `logs` - Show orchestrator logs
- `db:migrate` - Run database migrations
- `db:reset` - Reset database
- `docker:up` - Start only Docker services
- `docker:down` - Stop Docker services
- `build` - Build all packages
- `clean` - Clean build artifacts

#### Options:
- `--help, -h` - Show help message
- `--verbose, -v` - Enable verbose output
- `--no-docker` - Skip Docker services
- `--no-tests` - Skip running tests

### Individual Scripts

#### 🟢 Start System
```bash
./start.sh
```
Interactive script that:
- Checks all prerequisites
- Sets up environment
- Starts services with progress indicators
- Provides helpful prompts

#### 🔴 Stop System
```bash
./stop.sh
```
Gracefully stops:
- Orchestrator process
- Docker containers
- Optionally removes volumes

#### 📊 Check Status
```bash
./status.sh
```
Shows status of:
- Infrastructure services (PostgreSQL, Redis)
- Application services (Orchestrator)
- API endpoints
- System resources
- Configuration

#### 🧪 Test API
```bash
./test-api.sh
```
Tests all API endpoints:
- Health check
- Create workflow
- Get workflow
- List workflows
- Cancel/retry workflows

## 🔧 Manual Commands

### Development Mode

```bash
# Start infrastructure only
docker-compose up -d postgres redis

# Generate Prisma client
pnpm --filter @agentic-sdlc/orchestrator exec prisma generate

# Run migrations
pnpm --filter @agentic-sdlc/orchestrator exec prisma migrate deploy

# Start orchestrator in dev mode with hot reload
pnpm orchestrator:dev
```

### Production Mode

```bash
# Build all packages
pnpm build

# Start with Docker Compose
docker-compose up --build

# Or run built version locally
pnpm --filter @agentic-sdlc/orchestrator start
```

### Testing

```bash
# Run all tests
pnpm test

# Run orchestrator tests only
pnpm --filter @agentic-sdlc/orchestrator test

# Run tests with coverage
pnpm --filter @agentic-sdlc/orchestrator test:coverage

# Run tests in watch mode
pnpm --filter @agentic-sdlc/orchestrator test --watch
```

### Database Management

```bash
# Create migration
pnpm --filter @agentic-sdlc/orchestrator exec prisma migrate dev --name <migration-name>

# Apply migrations
pnpm --filter @agentic-sdlc/orchestrator exec prisma migrate deploy

# Reset database
pnpm --filter @agentic-sdlc/orchestrator exec prisma migrate reset

# Open Prisma Studio
pnpm --filter @agentic-sdlc/orchestrator exec prisma studio
```

## 🌐 API Endpoints

Once running, the following endpoints are available:

### Main Endpoints
- **API Base:** http://localhost:3000
- **Swagger Docs:** http://localhost:3000/documentation
- **Health Check:** http://localhost:3000/api/v1/health

### Workflow Management
- `POST /api/v1/workflows` - Create workflow
- `GET /api/v1/workflows` - List workflows
- `GET /api/v1/workflows/:id` - Get workflow by ID
- `POST /api/v1/workflows/:id/cancel` - Cancel workflow
- `POST /api/v1/workflows/:id/retry` - Retry workflow

## 📝 Environment Configuration

### Required Environment Variables

Create a `.env` file with:

```env
# Database
DATABASE_URL=postgresql://agentic:agentic_dev@localhost:5432/agentic_sdlc

# Redis
REDIS_URL=redis://localhost:6379

# API Keys (for agents)
ANTHROPIC_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here

# Optional
NODE_ENV=development
LOG_LEVEL=debug
ORCHESTRATOR_PORT=3000
```

## 🐳 Docker Management

### View Running Containers
```bash
docker-compose ps
```

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f orchestrator
docker-compose logs -f postgres
docker-compose logs -f redis
```

### Access Database
```bash
# Connect to PostgreSQL
docker-compose exec postgres psql -U agentic -d agentic_sdlc

# Connect to Redis CLI
docker-compose exec redis redis-cli
```

### Clean Up
```bash
# Stop containers
docker-compose stop

# Remove containers and networks
docker-compose down

# Remove everything including volumes
docker-compose down -v
```

## 🔍 Troubleshooting

### Common Issues

#### Port Already in Use
```bash
# Check what's using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>
```

#### Database Connection Failed
```bash
# Restart PostgreSQL
docker-compose restart postgres

# Check logs
docker-compose logs postgres
```

#### Dependencies Not Installing
```bash
# Clear cache
pnpm store prune

# Reinstall
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

#### Orchestrator Not Starting
```bash
# Check for TypeScript errors
pnpm --filter @agentic-sdlc/orchestrator typecheck

# Check for missing migrations
pnpm --filter @agentic-sdlc/orchestrator exec prisma migrate status
```

## 📊 Monitoring

### Check System Health
```bash
curl http://localhost:3000/api/v1/health
```

### Monitor Metrics
The orchestrator logs metrics for:
- Request duration
- Workflow creation
- Task assignments
- Error rates

View in logs:
```bash
./run.sh logs | grep METRIC
```

### Database Monitoring
```sql
-- Connect to database
docker-compose exec postgres psql -U agentic -d agentic_sdlc

-- Check workflow count
SELECT COUNT(*) FROM "Workflow";

-- Check recent workflows
SELECT id, type, name, status, created_at
FROM "Workflow"
ORDER BY created_at DESC
LIMIT 10;

-- Check task queue
SELECT agent_type, status, COUNT(*)
FROM "AgentTask"
GROUP BY agent_type, status;
```

## 🔐 Security Notes

- Never commit `.env` file with real API keys
- Use strong passwords for production databases
- Enable HTTPS for production deployments
- Restrict Redis access in production
- Use environment-specific configurations

## 📚 Additional Resources

- [Architecture Documentation](./FINAL-AGENTIC-SDLC-ARCH.md)
- [API Documentation](http://localhost:3000/documentation) (when running)
- [Sprint 1 Summary](./SPRINT-1-SUMMARY.md)
- [AI Context Patterns](./AI-CONTEXT/)

## 💡 Tips

1. **Development Workflow:**
   - Use `./run.sh dev` for hot-reload during development
   - Keep `./run.sh logs` open in a separate terminal

2. **Testing Workflow:**
   - Run `./test-api.sh` after making API changes
   - Use `pnpm test --watch` for TDD

3. **Debugging:**
   - Set `LOG_LEVEL=debug` in `.env` for verbose logs
   - Use `./status.sh` to quickly check system state

4. **Performance:**
   - Monitor Docker stats with `docker stats`
   - Check database query performance in logs

## 🆘 Getting Help

If you encounter issues:

1. Check the status: `./status.sh`
2. Review logs: `./run.sh logs`
3. Run tests: `pnpm test`
4. Check documentation: `./docs/`

---

**Remember:** The system is designed to be self-contained. All necessary services (PostgreSQL, Redis) are managed through Docker Compose, making it easy to start, stop, and reset the entire system.