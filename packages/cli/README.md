# @agentic-sdlc/cli

Unified Command Center CLI for Agentic SDLC Platform

## Overview

Consolidates 45+ shell scripts into a single, cohesive CLI interface with:

- **Unified Commands**: Single entry point for all operations (start, stop, health, test, deploy, etc.)
- **Structured Output**: JSON format for AI agent integration
- **Production-Ready**: Deployment management, health monitoring, rollback
- **Developer-Friendly**: Clear documentation, helpful errors, progress indicators

## Installation

```bash
# From monorepo
pnpm install

# Build
pnpm build

# Verify
agentic-sdlc --help
```

## Quick Start

```bash
# Start environment
agentic-sdlc start

# Check health
agentic-sdlc health

# View status
agentic-sdlc status --json

# Stop environment
agentic-sdlc stop
```

## Commands

### Environment Management

- `agentic-sdlc start` - Start all services
- `agentic-sdlc stop` - Stop all services
- `agentic-sdlc restart` - Restart services
- `agentic-sdlc status` - Show status

### Health & Diagnostics

- `agentic-sdlc health` - Full health check
- `agentic-sdlc health:services` - Service health only
- `agentic-sdlc health:database` - Database connectivity
- `agentic-sdlc health:agents` - Agent registration

### Testing

- `agentic-sdlc test` - Run tests by tier
- `agentic-sdlc test:units` - Unit tests
- `agentic-sdlc test:integration` - Integration tests
- `agentic-sdlc test:e2e` - E2E tests

### Logs & Monitoring

- `agentic-sdlc logs` - View logs
- `agentic-sdlc metrics` - Show metrics

### Database

- `agentic-sdlc db:setup` - Setup database
- `agentic-sdlc db:migrate` - Run migrations
- `agentic-sdlc db:reset` - Reset database

## Options

### Global Options

- `-v, --verbose` - Enable verbose output
- `-j, --json` - Output as JSON
- `-y, --yaml` - Output as YAML
- `-h, --help` - Show help
- `--version` - Show version

## Architecture

```
packages/cli/
├── src/
│   ├── index.ts              # Entry point
│   ├── commands/             # Command implementations
│   ├── services/             # Core services
│   ├── utils/                # Utilities
│   ├── types/                # Type definitions
│   └── config/               # Configuration
├── tests/
├── package.json
├── tsconfig.json
└── README.md
```

## Development

```bash
# Watch mode
pnpm dev

# Run tests
pnpm test

# Coverage
pnpm test:coverage

# Type check
pnpm typecheck

# Lint
pnpm lint
```

## Phase Implementation

- **Phase 7A (40 hrs)**: Core CLI, start/stop/health/logs
- **Phase 7B (35 hrs)**: Test/deploy/db/workflow commands
- **Phase 7C (25 hrs)**: Monitoring, optimization, docs

## Testing

Target: **85%+ code coverage**

```bash
# Run tests
pnpm test

# Watch mode
pnpm test:watch

# Coverage report
pnpm test:coverage
```

## Documentation

- See [CLAUDE.md](../../CLAUDE.md) for project context
- See [EPCC_PLAN_PHASE7.md](../../EPCC_PLAN_PHASE7.md) for detailed implementation plan
- See [EPCC_EXPLORE_PHASE7.md](../../EPCC_EXPLORE_PHASE7.md) for exploration findings

## Status

**Phase 7A**: ✅ Project setup complete, Core commands in progress

---

**Created**: 2025-11-16 | **Version**: 1.0.0-alpha | **Status**: Development
