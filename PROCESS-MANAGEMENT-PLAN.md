# Process Management & Runaway Prevention Plan

**Version:** 1.0 | **Date:** 2025-11-12 | **Status:** Design Document

---

## 🎯 Executive Summary

This document outlines a comprehensive plan to:
1. **Prevent runaway processes** during development
2. **Ensure complete cleanup** when `stop-dev.sh` executes
3. **Track all child processes** spawned by services
4. **Implement graceful shutdown** with timeout fallback
5. **Monitor process health** and auto-recovery

### Current Problem

**What happened:**
- Started `start-dev.sh` which spawned orchestrator + 5 agents
- Also started `npm test` in parallel (turbo runner)
- Turbo spawned vitest with multi-worker parallelization
- Each vitest worker: 256-512MB RAM, consuming 93.7% CPU peak
- Total: 80+ processes, 15+ GB RAM, multiple CPU cores saturated
- `stop-dev.sh` only killed 6 recorded PIDs → **74+ orphaned processes**

**Why it happened:**
- `start-dev.sh` only tracks direct children in `.pids/services.pids`
- Child processes (npm, tsx, vitest workers) not tracked
- No recursive process tree cleanup
- pkill patterns incomplete: missing `vitest`, `esbuild`, `turbo`
- No process accounting or monitoring

---

## 📊 Current Architecture Issues

### 1. PID Tracking Problem
```
.pids/services.pids contains:
  - PID of npm process
  - But NOT its children:
    - tsx watch (child of npm)
    - node modules (child of tsx)
    - vitest workers (when npm test run)

Result: Orphaned tree of processes
```

### 2. Incomplete pkill Patterns
Current `stop-dev.sh` only kills:
```bash
pkill -f "npm run dev"      # ✅ Gets dev scripts
pkill -f "tsx watch"        # ✅ Gets tsx watch
# MISSING:
# pkill -f "vitest"         # ❌ vitest workers
# pkill -f "turbo"          # ❌ turbo runner
# pkill -f "pnpm run test"  # ❌ pnpm test
# pkill -f "esbuild"        # ❌ build workers
```

### 3. No Process Tree Management
- Parent process killed → orphans become grandchildren of pid 1
- No way to group related processes
- No session/process group management

---

## 🔧 Solution Architecture

### Phase 1: Enhanced PID Tracking

**File:** `scripts/lib/process-manager.sh` (NEW)

```bash
#!/bin/bash
#
# Process Manager Library
# Tracks process trees and enables complete cleanup
#

# Save process group ID for cleanup
save_process_tree() {
  local service_name="$1"
  local pid="$2"
  local pids_file="$3"

  # Record the main PID
  echo "$pid" >> "$pids_file"

  # Also record process group ID (for SIGTERM cascade)
  echo "PGID:$service_name:$(ps -o pgid= -p $pid | tr -d ' ')" >> "$pids_file.groups"

  # Record service name for logging
  echo "$service_name:$pid" >> "$pids_file.services"
}

# Kill process tree recursively
kill_process_tree() {
  local pid="$1"
  local force="${2:-false}"

  if ! kill -0 "$pid" 2>/dev/null; then
    return 0  # Process already dead
  fi

  # Get all children
  local children=$(pgrep -P "$pid" 2>/dev/null || true)

  # Recursively kill children first
  for child in $children; do
    kill_process_tree "$child" "$force"
  done

  # Kill the parent
  if [ "$force" = true ]; then
    kill -9 "$pid" 2>/dev/null || true
  else
    kill -15 "$pid" 2>/dev/null || true
    # Wait for graceful shutdown
    sleep 1
    kill -9 "$pid" 2>/dev/null || true
  fi
}

# Kill entire process group
kill_process_group() {
  local pgid="$1"
  local force="${2:-false}"

  if [ "$force" = true ]; then
    kill -9 -"$pgid" 2>/dev/null || true
  else
    kill -15 -"$pgid" 2>/dev/null || true
    sleep 2
    kill -9 -"$pgid" 2>/dev/null || true
  fi
}

# Get all descendants of a process
get_descendants() {
  local pid="$1"
  echo "$pid"
  pgrep -P "$pid" 2>/dev/null | while read -r child; do
    get_descendants "$child"
  done
}
```

### Phase 2: Enhanced start-dev.sh

**Key Changes:**
1. Create process group for each service
2. Track all PIDs including children
3. Record service names for logging
4. Implement health monitoring

```bash
#!/bin/bash
# ... existing code ...

# Start service in its own process group
start_service() {
  local service_name="$1"
  local command="$2"
  local log_file="$3"
  local pids_file="$4"

  # Start in new process group (setsid)
  setsid bash -c "cd '$PROJECT_ROOT/$service_path' && $command" > "$log_file" 2>&1 &
  local pid=$!

  # Save process tree info
  save_process_tree "$service_name" "$pid" "$pids_file"

  return $pid
}

# For orchestrator:
echo -e "${YELLOW}[2/4]${NC} Starting Orchestrator API..."
(
  cd "$PROJECT_ROOT/packages/orchestrator"
  setsid npm run dev > "$LOGS_DIR/orchestrator.log" 2>&1 &
  ORCH_PID=$!
  echo "$ORCH_PID" >> "$PIDS_FILE"
  echo "orchestrator:$ORCH_PID" >> "$PIDS_FILE.services"
)

# Wait and verify
for i in {1..30}; do
  if curl -s http://localhost:3000/api/v1/health | grep -q "healthy" 2>/dev/null; then
    echo -e "  ${GREEN}✓${NC} Orchestrator ready (PID: $ORCH_PID)"
    break
  fi
  if [ $i -eq 30 ]; then
    echo -e "  ${RED}✗${NC} Orchestrator failed to start"
    exit 1
  fi
  sleep 1
done

# For agents:
for agent in validation-agent e2e-agent integration-agent deployment-agent; do
  echo -e "${YELLOW}Starting $agent...${NC}"
  (
    cd "$PROJECT_ROOT/packages/agents/$agent"
    setsid npm start > "$LOGS_DIR/$agent.log" 2>&1 &
    AGENT_PID=$!
    echo "$AGENT_PID" >> "$PIDS_FILE"
    echo "$agent:$AGENT_PID" >> "$PIDS_FILE.services"
  )
  sleep 2
done
```

### Phase 3: Enhanced stop-dev.sh

**Key Changes:**
1. Kill entire process groups
2. Comprehensive pkill fallback patterns
3. Verify no orphans remain
4. Detailed logging of killed processes

```bash
#!/bin/bash
# ... existing code ...

# Source process manager library
source "$PROJECT_ROOT/scripts/lib/process-manager.sh"

# Kill recorded PIDs first (graceful)
if [ -f "$PIDS_FILE" ]; then
  echo -e "${YELLOW}[1/4]${NC} Stopping Node services (graceful)..."

  while IFS= read -r pid; do
    if kill -0 "$pid" 2>/dev/null; then
      # Try graceful shutdown
      kill -15 "$pid" 2>/dev/null || true

      # Log the service name
      if [ -f "$PIDS_FILE.services" ]; then
        service=$(grep ":$pid$" "$PIDS_FILE.services" | cut -d: -f1)
        echo -e "  ${GREEN}✓${NC} Sent SIGTERM to $service (PID: $pid)"
      else
        echo -e "  ${GREEN}✓${NC} Sent SIGTERM to PID: $pid"
      fi
    fi
  done < "$PIDS_FILE"

  # Wait for graceful shutdown
  sleep 2

  # Kill any remaining stragglers
  echo -e "${YELLOW}[2/4]${NC} Killing remaining processes..."
  while IFS= read -r pid; do
    if kill -0 "$pid" 2>/dev/null; then
      # Get descendants and kill tree
      kill_process_tree "$pid" true
      echo -e "  ${GREEN}✓${NC} Force killed process tree PID: $pid"
    fi
  done < "$PIDS_FILE"

  sleep 1
fi

# Comprehensive fallback: kill all dev/test processes
echo -e "${YELLOW}[3/4]${NC} Killing orphaned processes..."

declare -a KILL_PATTERNS=(
  "npm run dev"
  "npm start"
  "npm test"
  "npm run test"
  "tsx watch"
  "tsx.*run-agent"
  "vitest"
  "vitest.*worker"
  "turbo run test"
  "pnpm run test"
  "esbuild.*service"
  "vite"
  "node.*watch"
)

for pattern in "${KILL_PATTERNS[@]}"; do
  # Count processes matching pattern
  count=$(pgrep -f "$pattern" 2>/dev/null | wc -l)
  if [ "$count" -gt 0 ]; then
    echo -e "  Killing $count process(es) matching: $pattern"
    pkill -9 -f "$pattern" 2>/dev/null || true
  fi
done

sleep 1

# Final verification - check for stragglers
echo -e "${YELLOW}[4/4]${NC} Verifying cleanup..."

STRAGGLERS=$(pgrep -f "node|vitest|esbuild|tsx" 2>/dev/null | grep -v VSCode | wc -l)
if [ "$STRAGGLERS" -eq 0 ]; then
  echo -e "  ${GREEN}✓${NC} All processes cleaned up"
else
  echo -e "  ${YELLOW}⚠${NC}  $STRAGGLERS straggler processes remain (non-critical)"
  pgrep -f "node|vitest|esbuild|tsx" 2>/dev/null | grep -v VSCode || true
fi

# Cleanup files
rm -f "$PIDS_FILE" "$PIDS_FILE.groups" "$PIDS_FILE.services"
echo -e "  ${GREEN}✓${NC} Cleaned up PID tracking files"
```

---

## 📋 Implementation Checklist

### Step 1: Create Process Manager Library
- [ ] Create `scripts/lib/process-manager.sh`
- [ ] Implement `save_process_tree()`
- [ ] Implement `kill_process_tree()`
- [ ] Implement `kill_process_group()`
- [ ] Add comprehensive comments and error handling
- [ ] Test with sample processes

### Step 2: Update start-dev.sh
- [ ] Source process-manager.sh
- [ ] Use setsid for all service starts
- [ ] Record process group IDs
- [ ] Track service names for logging
- [ ] Add health check verification
- [ ] Test complete startup sequence

### Step 3: Update stop-dev.sh
- [ ] Source process-manager.sh
- [ ] Implement graceful shutdown sequence
- [ ] Add comprehensive pkill patterns
- [ ] Implement force kill with timeout
- [ ] Add post-cleanup verification
- [ ] Log all killed processes

### Step 4: Create Process Monitoring Script
- [ ] Create `scripts/monitor-processes.sh`
- [ ] Display active process tree
- [ ] Show resource consumption
- [ ] Alert on runaway processes
- [ ] Integration with start-dev.sh

### Step 5: Documentation
- [ ] Update README with process management info
- [ ] Document environment variable requirements
- [ ] Add troubleshooting section
- [ ] Document cleanup procedures

### Step 6: Testing
- [ ] Test normal startup/shutdown cycle
- [ ] Test with --force flag
- [ ] Test with --containers only
- [ ] Verify no orphaned processes
- [ ] Test concurrent npm/vitest runs
- [ ] Stress test with full test suite

---

## 🛡️ Preventive Measures

### 1. Process Isolation Best Practices

**Use process groups for all long-running processes:**
```bash
# Good: Each service in isolated process group
setsid npm run dev &

# Bad: Shares parent's process group
npm run dev &
```

**Implement graceful shutdown handlers in Node services:**
```typescript
// In service startup code
process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully');
  await closeConnections();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully');
  await closeConnections();
  process.exit(0);
});
```

### 2. Resource Limits

**Set ulimits in start-dev.sh:**
```bash
# Limit processes per user
ulimit -u 512

# Limit open files
ulimit -n 8192

# Log limits for debugging
echo "Process limit: $(ulimit -u)"
echo "File descriptor limit: $(ulimit -n)"
```

### 3. Monitoring & Alerting

**Add runtime monitoring:**
```bash
# Monitor process count
PROC_COUNT=$(ps aux | grep "npm\|node\|vitest" | grep -v grep | wc -l)
if [ "$PROC_COUNT" -gt 100 ]; then
  echo "WARNING: Excessive process count: $PROC_COUNT"
  ps aux | grep "npm\|node\|vitest" | grep -v grep | head -20
fi

# Monitor RAM usage
TOTAL_RAM=$(ps aux | awk '{sum+=$6} END {print int(sum/1024)}')
if [ "$TOTAL_RAM" -gt 8192 ]; then
  echo "WARNING: High memory usage: ${TOTAL_RAM}MB"
fi
```

### 4. Session Management

**Use script/timeout for long-running processes:**
```bash
# Kill after 4 hours of inactivity
timeout -k 30 14400 npm run dev

# Or use systemd for production:
[Service]
Type=simple
ExecStart=/usr/bin/npm run start
Restart=on-failure
KillMode=mixed
TimeoutStopSec=10
```

---

## 🚨 Emergency Procedures

### If Runaway Processes Occur

**Immediate actions:**
```bash
# 1. Stop development environment
./scripts/env/stop-dev.sh --force

# 2. Verify all processes killed
ps aux | grep -E "node|vitest|npm|tsx" | grep -v grep

# 3. Force kill stragglers if needed
pkill -9 -f "vitest|esbuild|turbo"

# 4. Clean up stale PID files
rm -f .pids/*

# 5. Reset Docker containers
docker-compose down
docker-compose up -d postgres redis
```

**Automated recovery in start-dev.sh:**
```bash
# Before starting services, clean up any existing processes
echo "Cleaning up any existing processes..."
./scripts/env/stop-dev.sh --force 2>/dev/null || true
sleep 2

# Verify clean slate
EXISTING=$(pgrep -f "npm run|tsx watch|vitest" 2>/dev/null | wc -l)
if [ "$EXISTING" -gt 0 ]; then
  echo "WARNING: $EXISTING existing processes found, forcing cleanup"
  pkill -9 -f "npm run|tsx watch|vitest|esbuild" 2>/dev/null || true
  sleep 1
fi
```

---

## 📊 Process Tracking Format

**New file structure:**

```
.pids/
├── services.pids        # All process PIDs
├── services.pids.groups # Process groups (PGID)
└── services.pids.services # Service names mapped to PIDs

# Format of services.pids:
1234
5678
9012

# Format of services.pids.groups:
PGID:orchestrator:1234
PGID:scaffold-agent:5678

# Format of services.pids.services:
orchestrator:1234
scaffold-agent:5678
validation-agent:9012
```

---

## 🔍 Validation Checklist

After implementation, verify:

- [ ] `start-dev.sh` creates all services successfully
- [ ] All 6+ services are running and healthy
- [ ] `ps aux` shows services in isolated process groups
- [ ] `.pids/services.pids` contains all PIDs
- [ ] `stop-dev.sh` kills all processes gracefully
- [ ] No orphaned processes remain after `stop-dev.sh`
- [ ] Can restart services without interference
- [ ] No "Address already in use" errors
- [ ] Resource usage stays below limits
- [ ] Emergency cleanup works when needed

---

## 🎯 Expected Outcomes

### Before (Current State)
```
start-dev.sh + npm test
  ↓
  80+ processes spawned
  15+ GB RAM consumed
  Multiple CPU cores saturated
  stop-dev.sh kills only 6 PIDs
  74+ orphaned processes remain
```

### After (Desired State)
```
start-dev.sh
  ↓
  Exactly 6 tracked processes
  2-3 GB RAM consumed
  Normal CPU usage
  stop-dev.sh kills all 6 processes + children
  0 orphaned processes
  Clean shutdown in <10 seconds
```

---

## 📝 Notes

- macOS uses `pgrep` and `pkill` (different from Linux `ps` flags)
- Use `setsid` for new process groups (portable)
- SIGTERM (15) = graceful, SIGKILL (9) = forced
- Process groups allow killing entire tree with single signal
- Keep 2-3 second grace period between SIGTERM and SIGKILL

---

**Status:** Ready for Implementation
**Estimated Effort:** 4-6 hours (design + implementation + testing)
**Priority:** HIGH (blocks Session #51 work)

