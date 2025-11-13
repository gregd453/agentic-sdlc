# ZYP Platform Development CLI - Complete Guide

**Status:** ✅ Ready for Production
**Created:** 2025-10-25
**Purpose:** Simplify development environment management with easy-to-use commands

---

## Overview

The new Development CLI (`scripts/dev/cli`) provides a simple, intuitive interface for managing your local development environment. No complex parameters needed—just straightforward commands that do what you need.

### Key Design Principles

✨ **Simplicity** - Commands work with sensible defaults, minimal parameters
🚀 **Automation** - No manual steps, everything happens automatically
📊 **Clarity** - Real-time feedback, clear status messages, helpful errors
🔧 **Modularity** - Each command is independent and composable
💡 **Discoverability** - Comprehensive help system with examples

---

## Getting Started

### Installation

The CLI is already set up in your repository at:
```
scripts/dev/cli
```

### Basic Usage

```bash
# From repository root
./scripts/dev/cli start
./scripts/dev/cli status
./scripts/dev/cli logs

# Or create an alias for convenience
alias dev="./scripts/dev/cli"
dev start
dev status
```

### Create Shell Alias (Recommended)

Add to your `~/.bashrc` or `~/.zshrc`:
```bash
alias dev="/path/to/repo/scripts/dev/cli"
```

Then use:
```bash
dev start
dev stop
dev logs
```

---

## Command Reference

### 🚀 Core Operations

#### `dev start` - Start the Environment

Starts all Docker containers in the correct order (infrastructure first, then apps).

```bash
# Default: uses cached images
dev start

# Rebuild all images from scratch
dev start --build

# Clean slate (remove volumes, rebuild, start)
dev start --clean --build

# Start and immediately follow logs
dev start --logs

# Combine options
dev start --build --logs
```

**What it does:**
1. Checks Docker is running
2. Regenerates API types if `--build` specified
3. Starts PostgreSQL and Redis
4. Waits for infrastructure to be healthy
5. Runs database migrations
6. Starts application services
7. Performs health checks
8. Follows logs if `--logs` specified

**Time:** ~30 seconds (cached) to 3 minutes (rebuild)

---

#### `dev stop` - Stop the Environment

Stops all running services.

```bash
# Graceful shutdown (keep volumes)
dev stop

# Hard shutdown (remove volumes)
dev stop --hard
```

**What it does:**
- Stops all containers
- Optionally removes volumes (data)
- Cleans up orphaned containers

---

#### `dev restart` - Restart Services

Restarts one or all services.

```bash
# Restart all services
dev restart

# Restart specific service
dev restart user-core-api
dev restart postgres
dev restart nginx
```

**What it does:**
- Gracefully stops service
- Waits 5 seconds for stabilization
- Starts service again
- Confirms ready status

**Time:** ~5-10 seconds

---

#### `dev status` - Check Status

Shows status of all services at a glance.

```bash
dev status
```

**Output:**
```
✓ postgres (5432)        - PostgreSQL 15 database
✓ redis (6379)           - Redis 7 cache
✓ user-core-api (3001)   - User Core API (Fastify)
✓ nginx (3000)           - Reverse Proxy
✗ nfl-games-api (3003)   - NFL Games API [offline]
```

---

### 👀 Monitoring & Debugging

#### `dev logs` - View Live Logs

Stream logs from services in real-time.

```bash
# All services
dev logs

# Specific service
dev logs user-core-api
dev logs postgres
dev logs nfl-games-api
```

**Tips:**
- Open in a separate terminal while working
- Ctrl+C stops log streaming (doesn't stop services)
- Very useful for debugging startup issues

---

#### `dev health` - Health Checks

Verifies all services are healthy and responsive.

```bash
dev health
```

**Checks:**
- PostgreSQL readiness
- Redis connectivity
- All API `/health` endpoints
- ZypPilot shell availability

**Output:**
```
PostgreSQL... ✓
Redis... ✓
User Core API... ✓
User Chat API... ⚠ (still starting)
...
```

---

#### `dev shell` - Open Container Shell

Open an interactive bash shell in a service container for debugging.

```bash
# Default: user-core-api
dev shell

# Specific service
dev shell nfl-games-api
dev shell user-chat-api
```

**What you can do inside:**
```bash
# Run npm scripts
npm run dev
npm run build
npm test

# View files
ls -la
cat .env

# Run commands directly
pnpm codegen
prisma studio
```

**Exit with:**
```bash
exit
```

---

### 🔧 Database & Code

#### `dev migrate` - Run Migrations

Execute database migrations for services.

```bash
# All services
dev migrate

# Specific service
dev migrate user-core-api
dev migrate user-credit-api
```

**What it does:**
- Runs Prisma migrations
- Regenerates Prisma clients
- Handles all services with databases

---

#### `dev build` - Build Docker Images

Build or rebuild Docker images.

```bash
# Build with cache (faster)
dev build

# Force rebuild without cache (thorough)
dev build --force
```

**Use when:**
- After major code changes
- To update dependencies
- To recover from build issues

**Time:** ~2-3 minutes

---

### 🧹 Maintenance

#### `dev reset` - Full Environment Reset

Performs a complete reset while preserving your code.

```bash
# Reset everything (keep data)
dev reset

# Reset + rebuild images
dev reset --rebuild

# Requires confirmation
```

**What it does:**
1. Confirms you want to proceed
2. Stops all services
3. Removes containers and volumes
4. Regenerates code (codegen)
5. Optionally rebuilds images
6. Ready to run `dev start`

**Use when:**
- Things are broken and you need a clean slate
- You've made major changes
- Database is corrupted

---

#### `dev clean` - Remove Containers & Volumes

Shorthand for `dev stop --hard`

```bash
dev clean
```

---

### ℹ️ Information

#### `dev services` - List All Services

Shows all available services with their purposes.

```bash
dev services
```

**Output:**
```
Infrastructure:
  postgres          - PostgreSQL 15 database
  redis             - Redis 7 cache

APIs:
  user-core-api     - User core service (port 3001)
  user-chat-api     - Chat service (port 3004)
  ...
```

---

#### `dev urls` - Service URLs

Lists all service endpoints and ports.

```bash
dev urls
```

**Output:**
```
Shell:
  http://localhost:3050  - ZypPilot (unified entry point)

APIs:
  http://localhost:3001  - User Core API
  http://localhost:3002  - User Credit API
  ...
```

---

#### `dev help` - Show Help

Displays comprehensive help with all commands and examples.

```bash
dev help
```

---

## Common Workflows

### Workflow 1: Initial Setup

```bash
# First time setup with fresh images
dev start --build --logs

# Watch the logs, wait for "Development Environment Started"
# Once ready, open http://localhost:3050 in your browser
```

**Expected output:**
```
✓ Development environment is ready!
✓ API client types regenerated
✓ Migrations complete
✓ Service health checks passing
```

---

### Workflow 2: Daily Development

**Morning:**
```bash
dev start
# Services start in ~30 seconds
```

**During work:**
```bash
# In terminal 1: Watch services
dev logs

# In terminal 2: Make changes, run commands
dev shell user-core-api
# Inside: npm run dev

# Or from outside
dev restart user-core-api
```

**Evening:**
```bash
dev stop
```

---

### Workflow 3: Feature Development

```bash
# 1. Start environment
dev start

# 2. Monitor logs in second terminal
dev logs

# 3. Open shell to debug
dev shell user-core-api

# 4. Make database changes
dev migrate user-core-api

# 5. Restart service
dev restart user-core-api

# 6. Check health
dev health

# 7. Stop when done
dev stop
```

---

### Workflow 4: Troubleshooting

```bash
# 1. Check status
dev status

# 2. Run health checks
dev health

# 3. View logs
dev logs [service]

# 4. Restart stuck service
dev restart [service]

# 5. If that doesn't help
dev reset

# 6. Nuclear option
dev reset --rebuild
```

---

### Workflow 5: Code Changes & Rebuilds

```bash
# Small changes (configs, environment):
dev restart [service]

# Medium changes (code, dependencies):
dev build --force
dev start

# Major changes (new packages, migrations):
dev start --build --logs
```

---

## Service Reference

### Infrastructure Services

| Service | Port | Purpose |
|---------|------|---------|
| postgres | 5432 | PostgreSQL 15 database |
| redis | 6379 | Redis 7 cache |

### API Services

| Service | Port | Purpose | Tech |
|---------|------|---------|------|
| user-core-api | 3001 | User authentication & profiles | Fastify |
| user-chat-api | 3004 | Messaging & conversations | Fastify |
| user-credit-api | 3002 | Credits & wallet | Fastify |
| nfl-games-api | 3003 | NFL games & schedules | Fastify |
| nfl-square-api | 3005 | Squares betting | Fastify |
| user-credit-worker | — | Background job processor | Node.js |

### Frontend Services

| Service | Port | Purpose | Tech |
|---------|------|---------|------|
| user-core-frontend | 5173 | User core UI | Vite + React |
| user-chat-frontend | 5174 | Chat UI | Vite + React |
| user-credit-frontend | 3100 | Credit UI | Vite + React |
| nfl-games-frontend | 3200 | Games UI | Vite + React |
| nfl-square-frontend | 3006 | Squares UI | Next.js |

### Infrastructure

| Service | Port | Purpose |
|---------|------|---------|
| nginx | 3000 | Reverse proxy |
| zyp-pilot | 3050 | Shell application |

---

## Service URLs

### Main Entry Points

```
ZypPilot (Unified Shell)
  http://localhost:3050

Nginx Proxy
  http://localhost:3000
```

### API Endpoints

```
User Core API        http://localhost:3001
User Credit API      http://localhost:3002
NFL Games API        http://localhost:3003
User Chat API        http://localhost:3004
NFL Squares API      http://localhost:3005
```

### Frontends (via proxy)

```
User Core Frontend   http://localhost:3000
User Credit UI       http://localhost:3100
NFL Games UI         http://localhost:3200
```

### Database

```
PostgreSQL           localhost:5432
Redis                localhost:6379
```

---

## Architecture

### Directory Structure

```
scripts/dev/
├── cli                      # Main entry point (orchestrator)
├── README.md               # Detailed documentation
├── commands/               # Individual command scripts
│   ├── start.sh           # Start services
│   ├── stop.sh            # Stop services
│   ├── restart.sh         # Restart services
│   ├── status.sh          # Show status
│   ├── logs.sh            # View logs
│   ├── health.sh          # Health checks
│   ├── shell.sh           # Open shell
│   ├── migrate.sh         # Run migrations
│   ├── build.sh           # Build images
│   └── reset.sh           # Full reset
└── lib/                   # Shared utilities
    ├── colors.sh         # Color definitions
    ├── helpers.sh        # Helper functions
    └── services.sh       # Service definitions
```

### How It Works

1. **CLI Entry Point** (`scripts/dev/cli`)
   - Parses command
   - Routes to appropriate command script
   - Displays help

2. **Command Scripts** (`commands/*.sh`)
   - Independent, self-contained
   - Source shared utilities
   - Can be run directly if needed

3. **Shared Libraries** (`lib/*.sh`)
   - Common functions (print_*, check_*)
   - Color definitions
   - Service metadata and utilities

---

## Tips & Best Practices

### 📍 Use Separate Terminals

```bash
# Terminal 1: Run your commands
dev start
# Make changes
dev migrate

# Terminal 2: Watch logs
dev logs
```

### 🔍 Debug with Shell Access

```bash
# When a service is misbehaving
dev shell [service]

# Inside container
npm run dev          # Start in debug mode
npm test             # Run tests
pnpm codegen        # Regenerate types
```

### ⚡ Quick Status Check

```bash
# Get the picture quickly
dev status
dev health
```

### 🔄 Graceful Restarts

```bash
# Don't need full stop/start
dev restart [service]

# Much faster than stop + start
```

### 💾 Database Operations

```bash
# After database changes
dev migrate [service]

# Specific migration
dev shell user-core-api
# Inside: prisma migrate dev --name my_change
```

### 📦 Code Generation

```bash
# After adding new OpenAPI specs or schemas
dev start --build  # Regenerates during start

# Or manually
dev shell [service]
# Inside: pnpm codegen
```

---

## Troubleshooting

### Issue: "Docker is not running"

```bash
# Solution: Start Docker Desktop or docker daemon
open -a Docker    # macOS
# or use your system's Docker launcher
```

### Issue: "Port already in use"

```bash
# Solution: Clean shutdown
dev clean
dev start
```

### Issue: Service won't start

```bash
# Check logs
dev logs [service]

# Check health
dev health

# Restart
dev restart [service]

# Full reset if needed
dev reset
```

### Issue: Database errors

```bash
# Re-run migrations
dev migrate [service]

# Or all
dev migrate
```

### Issue: Stuck/frozen services

```bash
# Hard restart all
dev stop --hard
dev start

# Or just one service
dev restart [service]
```

### Issue: Everything broken

```bash
# Full reset (keeps code, removes containers)
dev reset

# Full reset with image rebuild
dev reset --rebuild

# Then restart
dev start
```

---

## Performance Notes

| Operation | Time | Notes |
|-----------|------|-------|
| `dev start` (cached) | 30s | Using existing images |
| `dev start --build` | 2-3m | Rebuilding images |
| `dev restart [service]` | 5-10s | Very fast |
| `dev health` | 10-20s | Checks all services |
| `dev logs` | Real-time | No significant overhead |
| `dev shell` | Instant | Just opens bash |

---

## Integration with NPM

Add convenient scripts to `package.json`:

```json
{
  "scripts": {
    "dev:start": "./scripts/dev/cli start",
    "dev:stop": "./scripts/dev/cli stop",
    "dev:status": "./scripts/dev/cli status",
    "dev:logs": "./scripts/dev/cli logs",
    "dev:shell": "./scripts/dev/cli shell",
    "dev:health": "./scripts/dev/cli health",
    "dev:reset": "./scripts/dev/cli reset"
  }
}
```

Then use:
```bash
pnpm dev:start
pnpm dev:logs
pnpm dev:shell user-core-api
```

---

## Advanced Usage

### Running Commands Directly

Each script can be invoked directly:

```bash
./scripts/dev/commands/start.sh --build --logs
./scripts/dev/commands/logs.sh user-core-api
./scripts/dev/commands/status.sh
```

### Extending the CLI

To add a new command:

1. Create `scripts/dev/commands/my-command.sh`
2. Source utilities at top:
   ```bash
   SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
   PROJECT_ROOT="$(dirname "$(dirname "$(dirname "$SCRIPT_DIR")")")"
   source "$SCRIPT_DIR/../lib/colors.sh"
   source "$SCRIPT_DIR/../lib/helpers.sh"
   ```
3. Add to `scripts/dev/cli` case statement
4. Test and document

---

## Related Documentation

- **PRISMA_HASH_CONFLICT_ANALYSIS.md** - Prisma client naming solution
- **CODEGEN_ARCHITECTURE_OVERVIEW.md** - Code generation architecture
- **CLAUDE.md** - Project-wide guidelines
- **scripts/dev/README.md** - Technical CLI documentation

---

## Support

### Getting Help

```bash
# Comprehensive help
dev help

# Help for specific command
dev help | grep <command>

# See available services
dev services

# See service URLs
dev urls
```

### Reporting Issues

If you encounter issues:

1. Check logs: `dev logs`
2. Run health check: `dev health`
3. Check status: `dev status`
4. Try restart: `dev restart [service]`
5. Try full reset: `dev reset`

---

**Last Updated:** 2025-10-25
**Version:** 1.0.0
**Status:** ✅ Production Ready
