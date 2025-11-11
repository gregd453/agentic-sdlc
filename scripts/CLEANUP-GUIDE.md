# Test Environment Cleanup Guide

## Quick Reference

```bash
# Clean everything (interactive confirmation)
./scripts/cleanup-test-env.sh --all

# Dry run to see what would be deleted
./scripts/cleanup-test-env.sh --all --dry-run

# Clean only logs
./scripts/cleanup-test-env.sh --logs

# Clean only generated code
./scripts/cleanup-test-env.sh --output

# Keep the 5 most recent workflows
./scripts/cleanup-test-env.sh --output --keep-last 5

# Clean logs and PIDs but keep generated code
./scripts/cleanup-test-env.sh --logs --pids
```

## What Gets Cleaned

### `--output` (ai.output directory)
- **Location:** `ai.output/`
- **Contents:** All generated code from workflow runs
- **Typical size:** 50-100MB per workflow
- **Use `--keep-last N`:** Keep the most recent N workflows

### `--logs` (Log files)
- **Location:** `scripts/logs/*.log`
- **Contents:** Agent and orchestrator logs
- **Files cleaned:**
  - `orchestrator.log`
  - `scaffold-agent.log`
  - `validation-agent.log`
  - `e2e-agent.log`
  - `*.log`

### `--pids` (PID files)
- **Location:** `.pids/*.pid*`
- **Contents:** Process ID tracking files
- **Files cleaned:**
  - `services.pids`
  - `orchestrator.pid`
  - `*-agent.pid`

## Options

| Option | Description |
|--------|-------------|
| `--all` | Clean everything (output + logs + pids) |
| `--output` | Clean only ai.output directory |
| `--logs` | Clean only log files |
| `--pids` | Clean only PID files |
| `--dry-run` | Show what would be deleted without deleting |
| `--keep-last N` | Keep the most recent N workflows |
| `-h, --help` | Show help message |

## Common Use Cases

### Before Running Tests
```bash
# Clean logs to get fresh output
./scripts/cleanup-test-env.sh --logs

# Or clean everything for a fresh start
./scripts/cleanup-test-env.sh --all
```

### After Development Session
```bash
# Keep last 3 workflows for reference, clean logs
./scripts/cleanup-test-env.sh --output --keep-last 3 --logs
```

### Free Up Disk Space
```bash
# Check what would be freed (dry run)
./scripts/cleanup-test-env.sh --all --dry-run

# Then clean everything
./scripts/cleanup-test-env.sh --all
```

### Debug Session Cleanup
```bash
# Keep generated code, only clean logs
./scripts/cleanup-test-env.sh --logs --pids
```

## Safety Features

1. **Interactive Confirmation:** Always asks before deleting (unless dry run)
2. **Dry Run Mode:** Test with `--dry-run` to see what would be deleted
3. **Selective Cleaning:** Choose specific targets (output/logs/pids)
4. **Keep Recent:** Use `--keep-last` to preserve recent workflows
5. **Summary Display:** Shows before and after state

## Examples

### Example 1: Fresh Development Start
```bash
# Stop services
./scripts/env/stop-dev.sh

# Clean everything
./scripts/cleanup-test-env.sh --all

# Start services
./scripts/env/start-dev.sh
```

### Example 2: Keep Evidence, Clean Logs
```bash
# Useful when debugging - keep the generated code but get fresh logs
./scripts/cleanup-test-env.sh --logs
```

### Example 3: Gradual Cleanup
```bash
# Check size first
./scripts/cleanup-test-env.sh --all --dry-run

# Keep last 10 workflows
./scripts/cleanup-test-env.sh --output --keep-last 10

# Clean logs
./scripts/cleanup-test-env.sh --logs
```

## Output Example

```
================================================
Test Environment Cleanup
================================================

Current state:

================================================
Summary
================================================
ai.output: 37 workflows (99M)
logs:      8 files (68K)
pids:      5 files

Proceed with cleanup? (y/N) y

✓ Deleted 37 workflows (4677 files, freed 99M)
✓ Deleted 8 log files (freed 68K)
✓ Deleted 5 PID files

Final state:

================================================
Summary
================================================
ai.output: 0 workflows (0B)
logs:      0 files (0B)
pids:      0 files

✓ Cleanup complete!
```

## Integration with Development Scripts

The cleanup script is designed to work seamlessly with:

- `./scripts/env/start-dev.sh` - Start development environment
- `./scripts/env/stop-dev.sh` - Stop development environment
- `./scripts/run-pipeline-test.sh` - Run pipeline tests

Typical workflow:
```bash
# Stop services
./scripts/env/stop-dev.sh

# Clean test environment
./scripts/cleanup-test-env.sh --all

# Start fresh
./scripts/env/start-dev.sh

# Run tests
./scripts/run-pipeline-test.sh "Todo List"
```

## Troubleshooting

### "Permission denied"
```bash
chmod +x scripts/cleanup-test-env.sh
```

### "No such file or directory"
Make sure you're running from the project root:
```bash
cd /path/to/agent-sdlc
./scripts/cleanup-test-env.sh --all
```

### Want to undo?
Unfortunately cleanup is permanent. Use `--dry-run` first to verify what will be deleted, or use `--keep-last N` to preserve recent workflows.

---

**Created:** Session #36
**Last Updated:** 2025-11-11
**Script Location:** `scripts/cleanup-test-env.sh`
