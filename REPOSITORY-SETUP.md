# REPOSITORY SETUP FOR AGENTIC SDLC

**Version:** 1.0
**Created:** 2025-11-05
**Purpose:** Complete repository initialization and setup guide

---

## Repository Structure

```
agentic-sdlc/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml
│   │   ├── daily-build.yml
│   │   └── sprint-automation.yml
│   └── ISSUE_TEMPLATE/
│       ├── backlog-item.yml
│       └── bug-report.yml
│
├── packages/
│   ├── orchestrator/
│   ├── agents/
│   ├── pipeline/
│   ├── shared/
│   └── cli/
│
├── infrastructure/
│   ├── docker/
│   ├── kubernetes/
│   └── terraform/
│
├── backlog/
│   ├── queue.jsonl
│   └── archive/
│
├── scripts/
│   ├── bootstrap.sh
│   ├── dev-setup.sh
│   └── deploy.sh
│
├── docs/
│   └── [architecture files]
│
├── .env.example
├── docker-compose.yml
├── package.json
├── pnpm-workspace.yaml
├── README.md
└── LICENSE
```

---

## 1. Initialize Repository Script

Create `init-repo.sh`:

```bash
#!/bin/bash
set -e

echo "🚀 Initializing Agentic SDLC Repository"
echo "========================================"

# Create directory structure
echo "📁 Creating directory structure..."

mkdir -p .github/workflows
mkdir -p .github/ISSUE_TEMPLATE
mkdir -p packages/{orchestrator,agents,pipeline,shared,cli}/src
mkdir -p infrastructure/{docker,kubernetes,terraform}
mkdir -p backlog/archive
mkdir -p scripts
mkdir -p docs
mkdir -p tests/{unit,integration,e2e}

# Initialize git
echo "📝 Initializing git repository..."
git init

# Create .gitignore
cat > .gitignore << 'EOF'
# Dependencies
node_modules/
.pnp
.pnp.js

# Testing
coverage/
.nyc_output

# Production
dist/
build/

# Misc
.DS_Store
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

# Editor directories
.idea/
.vscode/
*.swp
*.swo

# OS
Thumbs.db

# TypeScript
*.tsbuildinfo

# Docker
.dockerignore

# Terraform
*.tfstate
*.tfstate.*
.terraform/
EOF

# Create README
cat > README.md << 'EOF'
# Agentic SDLC System

An autonomous, AI-driven Software Development Lifecycle system that manages complete development sprints with minimal human intervention.

## Features

- 🤖 Autonomous agent orchestration
- 🔄 Sprint-based development cycles
- ✅ 100% E2E test requirement enforcement
- 📊 Per-application backlog management
- 🔗 Bidirectional CI/CD pipeline integration
- 🧠 Intelligent decision negotiation
- 🔧 Self-healing problem resolution

## Quick Start

```bash
# Install dependencies
pnpm install

# Bootstrap the system
npm run bootstrap

# Start development environment
npm run dev

# Run tests
npm run test
```

## Architecture

See [FINAL-AGENTIC-SDLC-ARCH.md](docs/FINAL-AGENTIC-SDLC-ARCH.md) for complete architecture documentation.

## License

MIT
EOF

# Create root package.json
cat > package.json << 'EOF'
{
  "name": "agentic-sdlc",
  "version": "0.1.0",
  "description": "Autonomous AI-driven Software Development Lifecycle System",
  "private": true,
  "scripts": {
    "bootstrap": "./scripts/bootstrap.sh",
    "dev": "pnpm run --parallel dev",
    "build": "pnpm run -r build",
    "test": "pnpm run -r test",
    "lint": "pnpm run -r lint",
    "clean": "pnpm run -r clean && rm -rf node_modules",
    "orchestrator": "pnpm --filter orchestrator dev",
    "agent": "pnpm --filter @agentic-sdlc/agents dev",
    "pipeline": "pnpm --filter pipeline dev",
    "backlog:add": "node scripts/add-to-backlog.js",
    "sprint:start": "node scripts/start-sprint.js",
    "sprint:complete": "node scripts/complete-sprint.js"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "@typescript-eslint/parser": "^6.0.0",
    "eslint": "^8.0.0",
    "prettier": "^3.0.0",
    "typescript": "^5.0.0",
    "vitest": "^1.0.0"
  },
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=8.0.0"
  },
  "packageManager": "pnpm@8.0.0"
}
EOF

# Create pnpm workspace configuration
cat > pnpm-workspace.yaml << 'EOF'
packages:
  - 'packages/*'
  - 'packages/agents/*'
EOF

# Create docker-compose.yml
cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: agentic
      POSTGRES_PASSWORD: agentic_dev
      POSTGRES_DB: agentic_sdlc
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  orchestrator:
    build:
      context: ./packages/orchestrator
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://agentic:agentic_dev@postgres:5432/agentic_sdlc
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis
    volumes:
      - ./packages/orchestrator:/app
      - /app/node_modules

volumes:
  postgres_data:
  redis_data:
EOF

# Create .env.example
cat > .env.example << 'EOF'
# Database
DATABASE_URL=postgresql://agentic:agentic_dev@localhost:5432/agentic_sdlc

# Redis
REDIS_URL=redis://localhost:6379

# API Keys
ANTHROPIC_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here

# GitHub
GITHUB_TOKEN=your_token_here
GITHUB_OWNER=your_org
GITHUB_REPO=your_repo

# Environment
NODE_ENV=development
LOG_LEVEL=debug

# Ports
ORCHESTRATOR_PORT=3000
PIPELINE_PORT=3001
AGENT_PORT=3002

# Features
ENABLE_SPRINT_AUTOMATION=true
ENABLE_DAILY_BUILDS=true
ENABLE_AUTO_REMEDIATION=true
EOF

# Create GitHub Actions workflow
mkdir -p .github/workflows
cat > .github/workflows/ci.yml << 'EOF'
name: CI Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - uses: pnpm/action-setup@v2
        with:
          version: 8

      - uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run tests
        run: pnpm test

      - name: Run linting
        run: pnpm lint

      - name: Build
        run: pnpm build

      - name: E2E Tests
        run: pnpm test:e2e
EOF

# Create daily build workflow
cat > .github/workflows/daily-build.yml << 'EOF'
name: Daily Build

on:
  schedule:
    - cron: '0 2 * * *'  # 2 AM UTC daily
  workflow_dispatch:

jobs:
  daily-build:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Trigger Daily Build
        run: |
          curl -X POST \
            -H "Authorization: Bearer ${{ secrets.GITHUB_TOKEN }}" \
            -H "Content-Type: application/json" \
            -d '{"event_type": "daily-build"}' \
            https://api.github.com/repos/${{ github.repository }}/dispatches
EOF

echo "✅ Repository initialization complete!"
echo ""
echo "Next steps:"
echo "1. Copy .env.example to .env and update values"
echo "2. Run: pnpm install"
echo "3. Run: docker-compose up -d (for local services)"
echo "4. Run: npm run bootstrap"
echo "5. Run: npm run dev"
```

---

## 2. Bootstrap Script

Create `scripts/bootstrap.sh`:

```bash
#!/bin/bash
set -e

echo "🚀 Bootstrapping Agentic SDLC System"
echo "====================================="

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required but not installed."; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo "❌ pnpm is required but not installed."; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "❌ Docker is required but not installed."; exit 1; }

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install

# Start local services
echo "🐳 Starting Docker services..."
docker-compose up -d postgres redis

# Wait for services
echo "⏳ Waiting for services to be ready..."
sleep 5

# Run database migrations
echo "🗄️ Setting up database..."
pnpm --filter orchestrator run db:setup

# Initialize backlog
echo "📋 Initializing backlog..."
cp AGENTIC-BACKLOG.json backlog/queue.jsonl

# Build all packages
echo "🔨 Building packages..."
pnpm build

echo ""
echo "✅ Bootstrap complete!"
echo ""
echo "Available commands:"
echo "  npm run dev           - Start development environment"
echo "  npm run orchestrator  - Start orchestrator only"
echo "  npm run agent        - Start agents only"
echo "  npm run pipeline     - Start pipeline only"
echo "  npm run test         - Run tests"
echo "  npm run backlog:add  - Add item to backlog"
echo ""
echo "Dashboard will be available at: http://localhost:3000"
```

---

## 3. Development Setup Script

Create `scripts/dev-setup.sh`:

```bash
#!/bin/bash
set -e

echo "🛠️ Setting up development environment"
echo "===================================="

# Copy environment file
if [ ! -f .env ]; then
    echo "📄 Creating .env file..."
    cp .env.example .env
    echo "⚠️  Please update .env with your API keys"
fi

# Install VS Code extensions (if VS Code is installed)
if command -v code >/dev/null 2>&1; then
    echo "📝 Installing VS Code extensions..."
    code --install-extension dbaeumer.vscode-eslint
    code --install-extension esbenp.prettier-vscode
    code --install-extension ms-azuretools.vscode-docker
    code --install-extension Prisma.prisma
fi

# Setup git hooks
echo "🪝 Setting up git hooks..."
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
pnpm lint
pnpm test
EOF
chmod +x .git/hooks/pre-commit

echo "✅ Development setup complete!"
```

---

## 4. Orchestrator Package Setup

Create `packages/orchestrator/package.json`:

```json
{
  "name": "@agentic-sdlc/orchestrator",
  "version": "0.1.0",
  "description": "Central orchestrator for Agentic SDLC",
  "main": "dist/index.js",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest",
    "lint": "eslint src --ext .ts",
    "db:setup": "prisma migrate deploy && prisma db seed",
    "db:migrate": "prisma migrate dev"
  },
  "dependencies": {
    "fastify": "^4.0.0",
    "@fastify/cors": "^8.0.0",
    "@fastify/swagger": "^8.0.0",
    "prisma": "^5.0.0",
    "@prisma/client": "^5.0.0",
    "redis": "^4.0.0",
    "zod": "^3.0.0",
    "winston": "^3.0.0",
    "xstate": "^5.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.0.0",
    "vitest": "^1.0.0"
  }
}
```

---

## 5. Agent Base Package Setup

Create `packages/agents/base-agent/package.json`:

```json
{
  "name": "@agentic-sdlc/base-agent",
  "version": "0.1.0",
  "description": "Base agent framework",
  "main": "dist/index.js",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "test": "vitest",
    "lint": "eslint src --ext .ts"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.20.0",
    "openai": "^4.0.0",
    "p-retry": "^5.0.0",
    "winston": "^3.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.0.0",
    "vitest": "^1.0.0"
  }
}
```

---

## 6. Quick Start Commands

```bash
# Clone the repo (or create new)
mkdir agentic-sdlc && cd agentic-sdlc

# Run initialization script
curl -sSL https://raw.githubusercontent.com/your-org/agentic-sdlc/main/init-repo.sh | bash

# Make scripts executable
chmod +x scripts/*.sh
chmod +x init-repo.sh

# Run initialization
./init-repo.sh

# Setup development environment
./scripts/dev-setup.sh

# Bootstrap the system
./scripts/bootstrap.sh

# Start development
npm run dev
```

---

## 7. First Sprint Kickoff

Once the system is running:

```bash
# Start first sprint
npm run sprint:start

# The system will:
# 1. Read backlog items
# 2. Prioritize based on dependencies
# 3. Select items for sprint
# 4. Start agent execution
# 5. Run daily builds
# 6. Complete with 100% tests passing

# Monitor progress
open http://localhost:3000/dashboard
```

---

## Success Indicators

✅ Services start without errors
✅ Database connects successfully
✅ Redis is accessible
✅ First agent responds to health check
✅ Backlog is loaded
✅ Pipeline can be triggered
✅ Dashboard shows status

Once these indicators are green, the system is ready to start building itself!