# Agentic SDLC System

An autonomous, AI-driven Software Development Lifecycle system that manages complete development sprints with minimal human intervention.

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- pnpm 8+
- Docker and Docker Compose
- PostgreSQL 16 (or use Docker)
- Redis 7 (or use Docker)

### Setup Instructions

1. **Clone the repository**
   ```bash
   cd /Users/Greg/Projects/apps/zyp/agent-sdlc
   ```

2. **Copy environment variables**
   ```bash
   cp .env.example .env
   # Edit .env and add your API keys
   ```

3. **Install dependencies**
   ```bash
   pnpm install
   ```

4. **Start infrastructure services**
   ```bash
   docker-compose up -d postgres redis
   ```

5. **Setup database**
   ```bash
   pnpm db:setup
   ```

6. **Run the orchestrator**
   ```bash
   pnpm orchestrator:dev
   ```

The orchestrator will be available at:
- API: http://localhost:3000
- Swagger Documentation: http://localhost:3000/documentation

## 📁 Project Structure

```
agentic-sdlc/
├── packages/
│   ├── orchestrator/       # Central control plane
│   ├── agents/            # Agent implementations
│   ├── shared/            # Shared utilities
│   └── cli/               # CLI tool
├── infrastructure/        # Docker and Terraform configs
├── scripts/              # Build and deployment scripts
├── tests/                # E2E and integration tests
└── docs/                 # Documentation
```

## 🧪 Testing

### Run all tests
```bash
pnpm test
```

### Run tests with coverage
```bash
pnpm test:coverage
```

### Run specific package tests
```bash
pnpm --filter @agentic-sdlc/orchestrator test
```

## 🐳 Docker Development

### Start all services with Docker Compose
```bash
docker-compose up
```

### Build and run in production mode
```bash
docker-compose -f docker-compose.yml up --build
```

### View logs
```bash
docker-compose logs -f orchestrator
```

## 📚 API Documentation

Once the orchestrator is running, visit http://localhost:3000/documentation for interactive API documentation.

### Key Endpoints

- `POST /api/v1/workflows` - Create a new workflow
- `GET /api/v1/workflows/:id` - Get workflow status
- `GET /api/v1/workflows` - List all workflows
- `POST /api/v1/workflows/:id/cancel` - Cancel a workflow
- `POST /api/v1/workflows/:id/retry` - Retry a failed workflow
- `GET /api/v1/health` - Health check

### Example: Create a Workflow

```bash
curl -X POST http://localhost:3000/api/v1/workflows \
  -H "Content-Type: application/json" \
  -d '{
    "type": "app",
    "name": "user-rewards-ui",
    "description": "User rewards management interface",
    "requirements": "Build a rewards system for users",
    "priority": "high"
  }'
```

## 🎯 Sprint 1 Status

### Completed Tasks
- ✅ TASK-001: Orchestrator Service (5 pts)
- ✅ TASK-004: Database Schema Setup (3 pts - Prisma schema created)
- ✅ TASK-024: Docker Configuration (5 pts)

### Pending Tasks
- ⏳ TASK-006: Base Agent Framework (5 pts)

### Achievements
- Monorepo structure with Turborepo and pnpm
- Orchestrator with state machine (XState)
- PostgreSQL schema with Prisma ORM
- Redis event bus for async communication
- RESTful API with Swagger documentation
- 90% test coverage target with Vitest
- Docker containerization
- Health checks and monitoring

## 🛠️ Development Commands

```bash
# Development
pnpm dev                    # Start all services in dev mode
pnpm orchestrator:dev       # Start orchestrator only
pnpm build                  # Build all packages
pnpm typecheck              # Run TypeScript checks
pnpm lint                   # Run linting

# Database
pnpm db:migrate             # Run database migrations
pnpm db:setup               # Setup database (migrate + seed)

# Testing
pnpm test                   # Run all tests
pnpm test:coverage          # Run tests with coverage
pnpm test:watch             # Run tests in watch mode

# Docker
docker-compose up           # Start all services
docker-compose down         # Stop all services
docker-compose logs -f      # View logs
```

## 📝 Architecture

The system follows a microservices architecture with:

- **Orchestrator**: Central control plane managing workflows
- **State Machine**: XState-based workflow state management
- **Event Bus**: Redis Streams for async agent communication
- **Database**: PostgreSQL for persistent state
- **Agents**: Autonomous agents for each SDLC stage

See [FINAL-AGENTIC-SDLC-ARCH.md](./FINAL-AGENTIC-SDLC-ARCH.md) for complete architecture details.

## 🤝 Contributing

This is an autonomous self-building system. Contributions should follow the patterns defined in:
- `AI-CONTEXT/CODE-PATTERNS.md` - Code templates
- `AI-CONTEXT/API-CONTRACTS.md` - API specifications
- `AI-CONTEXT/TESTING-GUIDELINES.md` - Testing requirements

## 📄 License

MIT

## 🔗 Links

- [Architecture Documentation](./FINAL-AGENTIC-SDLC-ARCH.md)
- [Phase 1 Playbook](./PHASE-1-CAPABILITY-PLAYBOOK.md)
- [API Contracts](./AI-CONTEXT/API-CONTRACTS.md)
- [Code Patterns](./AI-CONTEXT/CODE-PATTERNS.md)