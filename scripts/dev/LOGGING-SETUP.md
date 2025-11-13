# Development CLI Logging Setup

## Overview

All development CLI scripts now automatically generate timestamped server logs to the `/scripts/logs` directory. This enables comprehensive debugging, auditing, and operational troubleshooting.

## Log File Structure

### Directory Location
```
scripts/logs/
  ├── dev-health-20251026-135409.log
  ├── dev-start-20251026-135420.log
  ├── dev-migrate-20251026-135430.log
  ├── dev-restart-20251026-140000.log
  ├── dev-build-20251026-140100.log
  └── dev-reset-20251026-150000.log
```

### Filename Convention
- Format: `dev-{command}-{YYYYMMDD-HHMMSS}.log`
- Example: `dev-start-20251026-135420.log`
  - Command: `start`
  - Date: October 26, 2025
  - Time: 13:54:20 (24-hour format)

### Log File Header
Each log file starts with a standard header:

```
==========================================
ZYP Platform - Development Log
Command: [command_name]
Started: 2025-10-26 13:54:09
==========================================

```

## Updated Scripts

The following scripts have been updated to support logging:

### 1. `scripts/dev/commands/start.sh`
- **Purpose:** Start development environment
- **Logs:** All startup operations, infrastructure checks, migrations, health checks
- **Usage:** `dev start [--build] [--clean] [--logs]`
- **Log Example:** `dev-start-20251026-135420.log`

### 2. `scripts/dev/commands/restart.sh`
- **Purpose:** Restart services (all or specific)
- **Logs:** Restart operations and service status
- **Usage:** `dev restart [service_name]`
- **Log Example:** `dev-restart-20251026-140000.log`

### 3. `scripts/dev/commands/build.sh`
- **Purpose:** Build Docker images
- **Logs:** Docker build output and completion status
- **Usage:** `dev build [--force]`
- **Log Example:** `dev-build-20251026-140100.log`

### 4. `scripts/dev/commands/reset.sh`
- **Purpose:** Full reset of development environment
- **Logs:** Cleanup, rebuild (if requested), code generation status
- **Usage:** `dev reset [--rebuild]`
- **Log Example:** `dev-reset-20251026-150000.log`

### 5. `scripts/dev/commands/migrate.sh`
- **Purpose:** Run database migrations
- **Logs:** Migration operations for all or specific services
- **Usage:** `dev migrate [service_name]`
- **Log Example:** `dev-migrate-20251026-135430.log`

### 6. `scripts/dev/commands/health.sh`
- **Purpose:** Check health of all services
- **Logs:** Infrastructure and service health check results
- **Usage:** `dev health`
- **Log Example:** `dev-health-20251026-135409.log`

## Implementation Details

### Core Logging Functions (in `scripts/dev/lib/helpers.sh`)

#### `get_logs_dir()`
- Returns the logs directory path
- Creates directory if it doesn't exist
- Path: `scripts/logs/`

#### `init_log_file(command_name)`
- Initializes a new timestamped log file
- Creates header with command name and timestamp
- Returns the log file path
- Called once per script execution

#### `log_output(log_file, message)`
- Logs message to both stdout and file
- Uses `tee -a` for simultaneous output
- Format: `echo "message" | tee -a "$LOG_FILE"`

#### `export_log_file(log_file)`
- Exports log file path as environment variable
- Variable name: `DEV_LOG_FILE`
- Allows child processes to access log file

#### `print_log_location(log_file)`
- Displays final log file location to user
- Printed at end of script execution
- Format:
  ```
  ========================================
  Log saved to:
    /path/to/scripts/logs/dev-command-timestamp.log
  ========================================
  ```

## Usage Examples

### Starting Development Environment
```bash
dev start
# Output shows:
# ========================================
# Log saved to:
#   /Users/Greg/Projects/apps/zyp/sandbox/pipeline/scripts/logs/dev-start-20251026-135420.log
# ========================================
```

### Following Logs While Starting
```bash
dev start --logs
# Logs are captured both to screen and to the log file
```

### Viewing a Specific Log
```bash
cat scripts/logs/dev-start-20251026-135420.log
tail -f scripts/logs/dev-start-20251026-135420.log  # Follow log in real-time
```

### Cleaning Old Logs
```bash
# Keep only last 10 days of logs
find scripts/logs -name "dev-*.log" -mtime +10 -delete

# Remove all logs older than 30 days
find scripts/logs -name "dev-*.log" -mtime +30 -exec rm {} \;
```

## Log File Contents

Each log file contains:

1. **Header** - Command name, timestamp, start time
2. **Operation Logs** - Docker compose output, script operations
3. **Status Messages** - Success/error indicators
4. **Final Status** - Completion status and timing

Example log excerpt:
```
==========================================
ZYP Platform - Development Log
Command: start
Started: 2025-10-26 13:54:09
==========================================

Log file: /Users/Greg/Projects/apps/zyp/sandbox/pipeline/scripts/logs/dev-start-20251026-135409.log

[... docker build output ...]
[... migration output ...]
[... health check output ...]

✓ Development Environment Started
```

## Log Rotation Strategy

### Recommended Approach

1. **Daily cleanup (optional):**
   ```bash
   # Add to crontab to run daily at 2 AM
   0 2 * * * find /Users/Greg/Projects/apps/zyp/sandbox/pipeline/scripts/logs -name "dev-*.log" -mtime +30 -delete
   ```

2. **Manual cleanup:**
   ```bash
   # Remove logs older than 30 days
   find scripts/logs -name "dev-*.log" -mtime +30 -delete

   # Remove logs matching a pattern
   find scripts/logs -name "dev-start-*.log" -mtime +7 -delete
   ```

3. **Archive strategy:**
   ```bash
   # Tar logs by date
   tar czf scripts/logs/archive/dev-logs-$(date +%Y%m).tar.gz scripts/logs/dev-*.log
   ```

## Troubleshooting

### Logs Not Being Created
1. Verify `scripts/logs/` directory exists
2. Check directory permissions: `ls -la scripts/logs/`
3. Verify helpers.sh is sourced before logging calls

### Log File Not Updating
1. Check if script is still running: `ps aux | grep dev`
2. Verify `tee` command is available: `which tee`
3. Check log file permissions: `ls -la scripts/logs/dev-*.log`

### Disk Space Issues
- Review log files: `du -sh scripts/logs/`
- Archive old logs to external storage
- Implement automated cleanup with cron jobs

## Integration with Other Tools

### CI/CD Pipelines
- Logs can be captured and uploaded to build artifacts
- Useful for debugging failed deployments

### Monitoring Tools
- Parse logs for errors using grep/awk
- Send alerts if critical errors detected
- Archive logs in centralized logging system

### Git Hooks
- Exclude logs from version control (add to `.gitignore`)
- Logs are developer-local only

## Related Files

- `scripts/dev/lib/helpers.sh` - Contains all logging functions
- `scripts/dev/commands/*.sh` - Updated to use logging
- `.gitignore` - Should exclude `/scripts/logs/`

## Future Enhancements

- [ ] Structured JSON logging format option
- [ ] Log aggregation to centralized system
- [ ] Real-time log streaming to dashboard
- [ ] Automatic log rotation with size limits
- [ ] Log analysis and reporting scripts
- [ ] Integration with ELK Stack or similar

---

**Last Updated:** October 26, 2025
**Status:** ✅ Active - All scripts logging to `/scripts/logs/`
