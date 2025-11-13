# Agentic SDLC Development CLI - Complete Guide

> Professional CLI for managing orchestrator, agents, and infrastructure

## Quick Reference

```bash
# Lifecycle
dev start             # Start all services
dev stop              # Stop all services
dev restart [service] # Restart service

# Monitoring
dev status            # Service status matrix
dev agents            # Agent-specific status
dev health            # Health checks
dev logs [service]    # Stream logs

# Operations  
dev pipeline "desc"   # Run workflow
dev shell [service]   # Container shell
dev migrate           # DB migrations

# Maintenance
dev reset             # Full reset
dev build --force     # Rebuild images
```

## Available Commands

### Core Commands
- `start` - Start development environment
- `stop` - Stop all services
- `restart` - Restart specific service
- `status` - Show all service status

### Agent Commands
- `agents` - Display agent status
- `pipeline` - Run workflow pipeline

### Monitoring Commands
- `logs` - Stream service logs
- `health` - Run health checks
- `shell` - Access container shell

### Build Commands
- `build` - Build Docker images
- `migrate` - Run DB migrations
- `reset` - Full environment reset

## Service Architecture

```
Infrastructure:
  postgres:5433    Database
  redis:6380       Message Bus

Application:
  orchestrator:3000  Workflow Engine

Agents:
  scaffold-agent     Autonomous scaffolding
  validation-agent   Autonomous validation  
  e2e-agent         Autonomous E2E testing
```

## Common Workflows

### First Time Setup
```bash
cd /path/to/agent-sdlc
alias dev="./scripts/dev/cli"
dev start --build
dev health
dev agents
```

### Daily Development
```bash
dev start
dev status
dev pipeline "Test My Feature"
dev logs orchestrator
dev stop
```

### Debugging
```bash
dev status               # Check what's running
dev health               # Detailed health check
dev agents scaffold-agent # Agent details
dev logs scaffold-agent  # Agent logs
dev shell orchestrator   # Interactive debugging
```

## Tips

- Most commands work without arguments (sensible defaults)
- Logs saved to `scripts/dev/logs/`
- Use Ctrl+C to exit log streaming (doesn't stop services)
- Run `dev help` for full documentation

---

**For detailed documentation, see:** `README.md` and `docs/DEV_CLI_GUIDE.md`
