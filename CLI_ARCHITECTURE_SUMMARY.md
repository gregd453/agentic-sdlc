# ZYP Development CLI - Architecture & Adaptation Guide

## Quick Facts
- **Location**: `/Users/Greg/Projects/apps/zyp/sandbox/pipeline/scripts/dev`
- **Total Code**: 1,872 lines across 21 bash files
- **Total Size**: 168KB
- **Commands**: 14 fully-featured commands
- **Status**: Production-ready, well-documented

## Directory Structure

```
scripts/dev/
├── cli                          (271 lines) - Main entry point & command router
├── commands/                    (14 scripts, 1,280 lines)
│   ├── start.sh                 - Multi-mode startup dispatcher
│   ├── docker-start.sh          - Full Docker startup (174 lines)
│   ├── local-start.sh           - Local machine startup (162 lines)
│   ├── stop.sh                  - Service shutdown
│   ├── restart.sh               - Service restart
│   ├── status.sh                - Service status display
│   ├── logs.sh                  - Real-time log streaming
│   ├── health.sh                - Health checks
│   ├── shell.sh                 - Container shell access
│   ├── build.sh                 - Docker image building
│   ├── migrate.sh               - Database migrations
│   ├── reset.sh                 - Full environment reset
│   ├── local-db.sh              - Local database management (169 lines)
│   └── e2e-test.sh              - Playwright E2E testing (205 lines)
├── lib/                         (361 lines, 3 utilities)
│   ├── colors.sh                - ANSI colors & symbols (37 lines)
│   ├── helpers.sh               - Core utilities (227 lines)
│   └── services.sh              - Service definitions (97 lines)
└── docs/                        (7+ markdown files)
    ├── README.md
    ├── DEV_CLI_GUIDE.md
    ├── DEV_CLI_CHEATSHEET.md
    ├── LOGGING-SETUP.md
    ├── QUICK-LOG-REFERENCE.md
    └── E2E_TESTING_GUIDE.md
```

## Commands Summary

| Category | Commands | Purpose |
|----------|----------|---------|
| **Lifecycle** | start, stop, restart | Service management |
| **Monitoring** | logs, status, health, shell | Debugging & inspection |
| **Build** | build, migrate, reset | Code & data management |
| **Testing** | e2e-test | E2E automation |
| **Infrastructure** | local-db | Database management |

## Key Architectural Patterns

### 1. Modular Command Layer
- Each command is independent, executable script
- All follow identical pattern: parse args → check env → execute → log
- Easy to extend: just add new script + register in main cli

### 2. Shared Library Layer
```bash
colors.sh   → ANSI colors, symbols
helpers.sh  → Logging, display, Docker, validation
services.sh → Service definitions, mappings
```

### 3. Service-Driven Configuration
```bash
INFRASTRUCTURE_SERVICES=("postgres" "redis")
APPLICATION_SERVICES=(...)
FRONTEND_SERVICES=(...)
```
Services defined once, reused everywhere (status, health, logs, etc.)

### 4. Comprehensive Logging
- Automatic timestamped files: `dev-{command}-{timestamp}.log`
- Three-tier: console output + file capture + environment export
- Every command logs to `scripts/logs/` directory
- Always prints log location at end

### 5. Layered UX
- **Colors**: GREEN for success, RED for errors, YELLOW for warnings
- **Symbols**: ✓ (running), ✗ (failed), ⚠ (warning)
- **Headers**: Blue boxes for sections
- **Progress**: Dots shown during polling

## Core Features

### Service Management
- **Docker Mode**: Full containerization with dependencies
- **Local Mode**: Services on host machine (requires postgres/redis installed)
- **Health Checks**: Validates all services with timeouts
- **Startup Sequencing**: Infrastructure → Applications → Verification

### Monitoring & Debugging
- **Real-time Logs**: `dev logs [service]` with Ctrl+C handling
- **Status Matrix**: Shows all services with ports and health
- **Health Checks**: curl endpoints, pg_isready, redis-cli ping
- **Container Shell**: `dev shell [service]` for direct access

### Code & Data Management
- **Database Migrations**: Service-specific migration commands
- **Image Building**: Docker build with caching options
- **Code Generation**: Automatic API type generation
- **Full Reset**: Confirmation-protected environment wipe

### Testing
- **E2E Testing**: Playwright integration with multiple modes
- **Auto-start Services**: Optional automatic startup of required services
- **Test Report**: HTML report generation and viewing

## Design Strengths

1. **Low Learning Curve** - Sensible defaults, minimal parameters
2. **Team-Friendly** - Consistent behavior, comprehensive logging
3. **Maintainable** - Modular design, DRY principles, clear patterns
4. **Extensible** - Easy to add commands (3 steps: create, register, update help)
5. **Well-Documented** - 7+ guide files + built-in help system
6. **Professional UX** - Colors, progress indicators, formatted output

## For Agent-SDLC Adaptation

### What to Keep (90% reusable)
- Entry point pattern (cli)
- Command structure (commands/*.sh template)
- Logging system (helpers.sh functions)
- Color system (colors.sh)
- Helper functions (environment checks, docker wrapper)

### What to Customize (10%)
- Service definitions (orchestrator + 4 agents instead of 14 services)
- Health checks (agent-specific endpoints)
- Port mappings (fewer, simpler ports)
- Help text (agent-specific workflows)

### Minimal Changes Example
```bash
# In lib/services.sh

INFRASTRUCTURE_SERVICES=("postgres" "redis")

APPLICATION_SERVICES=(
  "orchestrator"
  "base-agent"
  "scaffold-agent"
  "validation-agent"
  "e2e-agent"
)

# Update mappings
get_service_port() {
  case "$service" in
    orchestrator) echo "3000" ;;
    *-agent) echo "none" ;;  # Agents don't expose HTTP
  esac
}
```

### Recommended New Commands
- `dev agents` - List agent status
- `dev agent:logs [agent]` - Agent-specific logs
- `dev agent:test [agent]` - Test single agent
- `dev orchestrator` - Orchestrator-specific commands
- `dev pipeline` - Run workflow pipeline
- `dev validate [workflow]` - Workflow validation
- `dev debug [agent]` - Enhanced debugging

## Performance Characteristics

| Command | Time | Notes |
|---------|------|-------|
| dev help | <100ms | Instant |
| dev status | 1-2s | Docker ps |
| dev start | 30s | Cached images |
| dev start --build | 2-3 min | Full rebuild |
| dev health | 5-30s | Service checks |
| dev restart | 5-10s | Service restart |
| dev e2e-test | 5-30s | Test dependent |

## Integration Points

### Shell Alias
```bash
alias dev="/path/to/project/scripts/dev/cli"
# Then: dev start, dev status, etc.
```

### Package.json Scripts
```json
{
  "scripts": {
    "dev:start": "./scripts/dev/cli start",
    "dev:stop": "./scripts/dev/cli stop",
    "dev:status": "./scripts/dev/cli status"
  }
}
```

### CI/CD (GitHub Actions)
```yaml
- run: ./scripts/dev/cli docker-start --build
- run: ./scripts/dev/cli e2e-test --report
- if: failure()
  run: tail -100 scripts/logs/dev-*.log
```

## File Summary

| File | Lines | Purpose |
|------|-------|---------|
| cli | 271 | Main dispatcher |
| colors.sh | 37 | ANSI colors |
| helpers.sh | 227 | Core utilities |
| services.sh | 97 | Service defs |
| docker-start.sh | 174 | Docker startup |
| e2e-test.sh | 205 | E2E testing |
| local-db.sh | 169 | DB management |
| local-start.sh | 162 | Local startup |
| migrate.sh | 89 | Migrations |
| health.sh | 73 | Health checks |
| status.sh | 70 | Status display |
| reset.sh | 72 | Full reset |
| build.sh | 41 | Image build |
| restart.sh | 41 | Restart service |
| shell.sh | 37 | Shell access |
| stop.sh | 40 | Shutdown |
| start.sh | 38 | Mode selector |
| logs.sh | 29 | Log streaming |

**Total: 1,872 lines**

## Key Takeaways

1. **Modular** - 14 independent, reusable commands
2. **Scalable** - Easy to add 5-10 more commands
3. **Well-Documented** - 7+ guide files + inline help
4. **Production-Ready** - Logging, error handling, validation
5. **Team-Friendly** - Low learning curve, consistent UX
6. **Adaptable** - 90% code reuse for agent-sdlc project

## Next Steps for Agent-SDLC

1. **Copy** entire `scripts/dev/` directory
2. **Update** `lib/services.sh` with agent services
3. **Customize** port mappings and health check endpoints
4. **Add** agent-specific commands (optional but recommended)
5. **Document** agent-specific workflows in help system
6. **Test** with your agent infrastructure

---

**Detailed Analysis**: See `DEV_CLI_COMPREHENSIVE_ANALYSIS.txt` (1,342 lines)
