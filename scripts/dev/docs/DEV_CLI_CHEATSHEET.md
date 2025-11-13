# ZYP Development CLI - Cheat Sheet

Quick reference for the most common commands.

## Basic Commands

```bash
# Start environment
dev start

# Check what's running
dev status

# View logs
dev logs

# Stop services
dev stop
```

## Options & Flags

```bash
# Start with options
dev start --build         # Rebuild images
dev start --clean         # Clean slate
dev start --logs          # Follow logs after start

# Combine flags
dev start --build --clean --logs

# Stop hard
dev stop --hard           # Remove volumes
```

## Service Management

```bash
# Restart all or specific
dev restart                # All services
dev restart user-core-api  # Just one service

# Open shell in container
dev shell                  # Default (user-core-api)
dev shell nfl-games-api    # In specific service

# Run migrations
dev migrate                # All services
dev migrate user-core-api  # Specific service
```

## Monitoring

```bash
# Follow all logs
dev logs

# Follow specific service
dev logs user-core-api

# Health check
dev health

# Check status
dev status
```

## Images & Rebuild

```bash
# Build images
dev build                  # With cache
dev build --force          # No cache

# Full reset
dev reset                  # Clean start
dev reset --rebuild        # Reset + rebuild images
```

## Information

```bash
dev services    # List all services
dev urls        # Show URLs and ports
dev help        # Full help
```

---

## Service Ports Quick Reference

| Service | Port |
|---------|------|
| ZypPilot | 3050 |
| Nginx | 3000 |
| User Core API | 3001 |
| User Credit API | 3002 |
| NFL Games API | 3003 |
| User Chat API | 3004 |
| NFL Squares API | 3005 |
| PostgreSQL | 5432 |
| Redis | 6379 |

---

## Common Workflows

### Morning Startup
```bash
dev start
# Wait ~30 seconds
# Open http://localhost:3050
```

### During Development
```bash
# Terminal 1: Watch logs
dev logs

# Terminal 2: Make changes, run commands
dev shell [service]
dev restart [service]
dev migrate [service]
```

### Evening Shutdown
```bash
dev stop
```

### Troubleshooting
```bash
dev status         # What's running?
dev health         # Are they healthy?
dev logs [service] # What's happening?
dev restart [s]    # Try restart
dev reset          # Full reset
```

---

## Examples

```bash
# Fresh start with new images
dev start --build

# Watch a service
dev logs user-core-api

# Debug in container
dev shell nfl-games-api

# Database migration
dev migrate

# Restart stuck service
dev restart postgres

# Full environment reset
dev reset --rebuild

# Check everything
dev health
dev status
dev urls
```

---

## Keyboard Shortcuts

```
Ctrl+C  Stop log viewing (doesn't stop services)
exit    Exit container shell
```

---

**Need more help?** Run `dev help`
