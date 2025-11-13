# Quick Log Reference - Development CLI

## One-Liner Reference

Every `dev` command now automatically saves logs to timestamped files.

## View Latest Logs

```bash
# View latest health check log
cat scripts/logs/dev-health-*.log | tail -1

# View latest migration log
cat scripts/logs/dev-migrate-*.log | tail -1

# View latest start log
cat scripts/logs/dev-start-*.log | tail -1

# Follow latest log in real-time
tail -f scripts/logs/dev-*.log
```

## Common Scenarios

### After Running `dev start`
```bash
# The command prints the exact log path at the end:
# Log saved to: scripts/logs/dev-start-20251026-135420.log

# View it immediately:
cat scripts/logs/dev-start-20251026-135420.log
```

### Finding Specific Command Logs
```bash
# All start logs
ls scripts/logs/dev-start-*.log

# All migration logs
ls scripts/logs/dev-migrate-*.log

# All logs from today
find scripts/logs -name "dev-*.log" -mtime 0

# All logs from last 7 days
find scripts/logs -name "dev-*.log" -mtime -7
```

### Cleaning Old Logs
```bash
# Remove logs older than 30 days
find scripts/logs -name "dev-*.log" -mtime +30 -delete

# Remove all logs
rm scripts/logs/dev-*.log

# Keep only last 5 start logs
ls -t scripts/logs/dev-start-*.log | tail -n +6 | xargs rm
```

## Log File Naming

```
dev-{COMMAND}-{TIMESTAMP}.log

Examples:
  dev-start-20251026-135420.log      (October 26, 13:54:20)
  dev-health-20251026-135409.log     (October 26, 13:54:09)
  dev-migrate-20251026-135501.log    (October 26, 13:55:01)
  dev-restart-20251026-140000.log    (October 26, 14:00:00)
  dev-build-20251026-140100.log      (October 26, 14:01:00)
  dev-reset-20251026-150000.log      (October 26, 15:00:00)
```

## What's Logged

| Command | Logged Information |
|---------|-------------------|
| `start` | Infrastructure checks, migrations, health checks, all operations |
| `restart` | Service restart status, stabilization wait |
| `build` | Docker build output, build errors/warnings |
| `migrate` | Migration status per service, Prisma output |
| `health` | Infrastructure status, API availability, shell status |
| `reset` | Cleanup operations, rebuild output, code generation |

## Environment Variable

Each script sets:
```bash
export DEV_LOG_FILE="/path/to/scripts/logs/dev-command-timestamp.log"
```

This can be used in custom scripts or debugging.

## Useful Commands

```bash
# Search for errors in logs
grep -r "ERROR\|error\|✗" scripts/logs/

# Search for warnings
grep -r "WARN\|warning\|⚠" scripts/logs/

# Count total logs
ls scripts/logs/dev-*.log | wc -l

# List logs by size
ls -lSh scripts/logs/

# Archive logs from previous month
tar czf scripts/logs/archive/dev-logs-202509.tar.gz scripts/logs/dev-*-202509*.log

# Search logs for specific service
grep -r "user-credit-api" scripts/logs/
```

## Git Integration

Logs are automatically excluded from git (see `.gitignore`).

To manually exclude:
```bash
# Don't commit logs
git add -A
git reset scripts/logs/
```

## Integration Examples

### Check if migration succeeded
```bash
# After running: dev migrate
if grep -q "Migration complete" scripts/logs/dev-migrate-*.log; then
  echo "Success!"
else
  echo "Failed!"
fi
```

### Monitor development environment
```bash
# Watch all new logs as they're created
watch "ls -lt scripts/logs/dev-*.log | head -5"
```

### Extract timing information
```bash
# Find how long dev start took
grep "Started:" scripts/logs/dev-start-*.log | tail -1
```

## Tips & Tricks

1. **Latest log shortcut:**
   ```bash
   cat scripts/logs/dev-*.log | tail -100  # See last 100 lines across all logs
   ```

2. **Real-time log follow:**
   ```bash
   tail -f scripts/logs/dev-*.log  # Follow all new logs as they appear
   ```

3. **Search across all logs:**
   ```bash
   grep "ERROR" scripts/logs/*  # Find all errors
   ```

4. **Count commands run:**
   ```bash
   ls scripts/logs/dev-*.log | cut -d- -f2 | sort | uniq -c
   ```

---

For detailed information, see: `scripts/dev/LOGGING-SETUP.md`
