# Agentic SDLC CLI - Quick Start

## 30 Second Setup

```bash
# From project root
alias dev="./scripts/dev/cli"

# Start everything
dev start

# Done! Services are running
```

## 2 Minute Tour

```bash
# Check status
dev status
╔════════════════════════════════════════════════════════════════╗
║              Agentic SDLC - Service Status                     ║
╚════════════════════════════════════════════════════════════════╝
Infrastructure:
  ✓ postgres (5433) - Database (PostgreSQL 16)
  ✓ redis (6380) - Cache & Message Bus (Redis 7)

Application:
  ✓ orchestrator (3000) - Workflow Orchestrator

Agents:
  ✓ scaffold-agent - Scaffold Agent (Autonomous)
  ✓ validation-agent - Validation Agent (Autonomous)
  ✓ e2e-agent - E2E Testing Agent (Autonomous)

# View agents
dev agents
Shows: Running status, activity, message bus stats

# Run a test workflow
dev pipeline "Hello World API"
Creates workflow, monitors progress, shows result

# View logs
dev logs orchestrator
Real-time log streaming (Ctrl+C to exit)

# Health check
dev health
Checks: Postgres, Redis, Orchestrator, Agents, Message Bus
```

## Essential Commands

```bash
dev start        # Start all services
dev stop         # Stop all services
dev status       # Service status
dev agents       # Agent status
dev health       # Health checks
dev logs [svc]   # View logs
dev pipeline     # Run workflow
dev help         # Full help
```

## Troubleshooting

```bash
# Something not working?
dev status       # What's running?
dev health       # What's healthy?
dev logs         # What's happening?

# Still stuck?
dev restart [service]  # Restart specific service
dev reset              # Nuclear option
```

## Next Steps

- Read: `AGENT_SDLC_CLI_GUIDE.md` (detailed reference)
- Read: `README.md` (full documentation)
- Read: `CLI_IMPLEMENTATION_SUMMARY.md` (implementation details)

## Tips

- `dev` commands work from anywhere if you set the alias globally
- Logs auto-saved to `scripts/dev/logs/`
- Most commands work without arguments
- Ctrl+C exits logs without stopping services

**Ready to build autonomous agents!** 🚀
