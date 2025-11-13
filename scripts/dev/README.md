# Development CLI (Template - Needs Adaptation)

> ⚠️ **IMPORTANT:** This CLI was cloned from the ZYP Platform and has not been fully adapted for Agentic SDLC.
>
> **Current Status:** References wrong services and docker-compose file. See `EPCC_EXPLORE.md` for details.
>
> **For Operational Commands:** Use `scripts/env/` instead:
> - `./scripts/env/start-dev.sh` - Start environment
> - `./scripts/env/stop-dev.sh` - Stop environment
> - `./scripts/env/check-health.sh` - Health checks
> - `./scripts/run-pipeline-test.sh` - Run E2E tests
>
> **Future:** This CLI will be adapted for Agentic SDLC (estimated 2.5 hours of work).

---

# Original Documentation (ZYP Platform)

A comprehensive, easy-to-use CLI interface for managing the development environment.

## Quick Start

### Basic Usage

```bash
# Start the development environment
./scripts/dev/cli start

# Check service status
./scripts/dev/cli status

# View logs
./scripts/dev/cli logs

# Stop services
./scripts/dev/cli stop
```

### From Any Directory

Create an alias in your shell profile (~/.bashrc, ~/.zshrc, etc.):

```bash
# Add to your shell profile
alias dev="$PWD/scripts/dev/cli"
```

Then use:
```bash
dev start
dev status
dev logs
```

## Commands

### 🚀 Core Operations

| Command | Purpose | Usage |
|---------|---------|-------|
| `start` | Start development environment | `dev start [--build] [--clean] [--logs]` |
| `stop` | Stop services | `dev stop [--hard]` |
| `restart` | Restart services | `dev restart [service]` |
| `status` | Show service status | `dev status` |

### 👀 Monitoring

| Command | Purpose | Usage |
|---------|---------|-------|
| `logs` | View live logs | `dev logs [service]` |
| `health` | Check service health | `dev health` |
| `shell` | Open container shell | `dev shell [service]` |

### 🔧 Database & Code

| Command | Purpose | Usage |
|---------|---------|-------|
| `migrate` | Run migrations | `dev migrate [service]` |
| `build` | Build images | `dev build [--force]` |

### 🧹 Maintenance

| Command | Purpose | Usage |
|---------|---------|-------|
| `reset` | Full environment reset | `dev reset [--rebuild]` |
| `clean` | Remove containers & volumes | `dev clean` |

### ℹ️ Information

| Command | Purpose | Usage |
|---------|---------|-------|
| `services` | List all services | `dev services` |
| `urls` | Show service URLs | `dev urls` |
| `help` | Show help | `dev help` |

## Common Workflows

### Initial Setup

```bash
# Fresh start with image rebuild
dev start --build --logs
```

### Daily Development

```bash
# Morning
dev start

# During work
dev logs                    # Monitor in separate terminal
dev shell [service]         # Debug specific service

# Evening
dev stop
```

### Troubleshooting

```bash
# Check what's running
dev status

# Check health
dev health

# Restart a service
dev restart user-core-api

# Full reset (keeps data)
dev reset

# Full reset with image rebuild
dev reset --rebuild
```

## Directory Structure

```
scripts/dev/
├── cli                   # Main entry point
├── README.md            # This file
├── commands/            # Individual command scripts
│   ├── start.sh
│   ├── stop.sh
│   ├── restart.sh
│   ├── status.sh
│   ├── logs.sh
│   ├── health.sh
│   ├── shell.sh
│   ├── migrate.sh
│   ├── build.sh
│   └── reset.sh
└── lib/                 # Shared utilities
    ├── colors.sh        # Color definitions
    ├── helpers.sh       # Common functions
    └── services.sh      # Service definitions
```

## Service Reference

### Infrastructure
- **postgres** - PostgreSQL 15 database (port 5432)
- **redis** - Redis 7 cache (port 6379)

### APIs
- **user-core-api** - User core service (port 3001)
- **user-chat-api** - Chat service (port 3004)
- **user-credit-api** - Credit service (port 3002)
- **nfl-games-api** - NFL games service (port 3003)
- **nfl-square-api** - NFL squares service (port 3005)

### Frontends
- **user-core-frontend** - User core UI (port 5173)
- **user-chat-frontend** - Chat UI (port 5174)
- **user-credit-frontend** - Credit UI (port 3100)
- **nfl-games-frontend** - Games UI (port 3200)
- **nfl-square-frontend** - Squares UI (port 3006)

### Infrastructure
- **nginx** - Reverse proxy (port 3000)
- **zyp-pilot** - Shell application (port 3050)

## Key Features

✨ **Simple Commands** - No complex parameters needed
🚀 **Smart Defaults** - Commands work out of the box
📊 **Real-time Monitoring** - Watch logs as things happen
🔧 **Container Access** - Open shells for debugging
🏥 **Health Checks** - Verify service status
🔄 **Intelligent Restart** - Graceful service restart
💾 **Database Management** - Easy migration running
🎯 **Modular Design** - Each command is independent script

## Tips & Tricks

### Watch Logs in Separate Terminal
```bash
# Terminal 1: Start services
dev start

# Terminal 2: Watch logs
dev logs
```

### Debug a Specific Service
```bash
# Open shell in container
dev shell user-core-api

# Inside container
npm run dev
# or
npm run build
# etc.
```

### Reset to Clean State
```bash
# Keep data but restart everything
dev reset

# Complete wipe (remove volumes)
dev clean
```

### Rebuild Images
```bash
# Rebuild with cache (faster)
dev build

# Force rebuild without cache (slower but thorough)
dev build --force
```

## Troubleshooting

### Services Won't Start
```bash
# Check health
dev health

# Check logs
dev logs

# Restart specific service
dev restart [service]
```

### Port Already in Use
```bash
# Full cleanup
dev clean

# Start fresh
dev start
```

### Database Issues
```bash
# Re-run migrations
dev migrate

# Specific service
dev migrate user-core-api
```

### Need a Complete Reset
```bash
# Full reset (keeps data)
dev reset

# Full reset + rebuild images
dev reset --rebuild
```

## Performance Notes

- First `dev start` takes ~30-45 seconds (image pulling)
- Subsequent starts are faster (cached images)
- `dev start --build` takes 2-3 minutes
- `dev restart [service]` is instant
- Log streaming has minimal overhead

## Integration with Package.json

You can add convenience scripts to `package.json`:

```json
{
  "scripts": {
    "dev:start": "./scripts/dev/cli start",
    "dev:stop": "./scripts/dev/cli stop",
    "dev:status": "./scripts/dev/cli status",
    "dev:logs": "./scripts/dev/cli logs",
    "dev:reset": "./scripts/dev/cli reset"
  }
}
```

Then use:
```bash
pnpm dev:start
pnpm dev:logs
```

## Architecture

The CLI is organized into:

1. **Main CLI** (`cli`) - Command router and help display
2. **Commands** (`commands/`) - Individual action scripts
3. **Utilities** (`lib/`) - Shared functions (colors, services, helpers)

Each command is independent and can be run directly:
```bash
./scripts/dev/commands/start.sh
./scripts/dev/commands/logs.sh user-core-api
```

## Contributing

To add a new command:

1. Create `scripts/dev/commands/my-command.sh`
2. Source the utilities at the top
3. Add it to the case statement in `scripts/dev/cli`
4. Update this README

## License

Part of ZYP Platform Development Suite
