# Incident Report: Runaway PM2 Processes (Session #75)

**Date:** 2025-11-16 | **Time:** ~17:40-17:41 | **Impact:** High (6 processes, ~670 MB memory, system near crash)

---

## Executive Summary

PM2 daemon auto-restart feature caused runaway processes that nearly crashed the system. When processes were killed via `kill -9`, PM2 automatically resurrected them within 4-5 seconds, creating an infinite loop. This consumed resources and made the environment unstable.

**Root Cause:** PM2 `autorestart: true` setting in ecosystem config combined with stale PID files.

**Fix Applied:** Updated `stop-dev.sh` to explicitly kill PM2 daemon and clean stale state files.

---

## Timeline of Events

| Time | Event | Details |
|------|-------|---------|
| 14:49:42 | Initial Startup | All 6 processes started: orchestrator + 5 agents |
| 17:32:20 | PM2 Warning | PM2 version warning logged (v5.3.0 → upgrade to v6.0.13) |
| 17:40:21 | First Kill Wave | All 6 processes killed via `kill -9` |
| 17:40:25 | Auto-Resurrection | 4 seconds later: ALL 6 processes auto-restarted by PM2 |
| 17:41:05 | Second Kill Wave | All 6 processes killed again via `kill -9` |
| 17:41:09 | Auto-Resurrection | 4 seconds later: ALL 6 processes auto-restarted again |
| 17:41:30 | Final Kill | Manual force kill of all 6 PIDs, PM2 daemon killed |

**Pattern:** Kill → 4-5 second delay → Auto-restart → Repeat (infinite loop)

---

## Root Cause Analysis

### Primary Cause: PM2 Auto-Restart Feature

The ecosystem config includes:
```javascript
autorestart: true,      // Automatically restart on crash
min_uptime: '10s',      // Minimum uptime before counting as a crash
max_restarts: 10,       // Max 10 restarts (we exceeded this)
restart_delay: 4000,    // 4 second delay between restarts
```

**How it Failed:**
1. Process killed → PM2 daemon detects exit
2. PM2 checks: "Has this process been up > 10 seconds?" → YES
3. PM2 action: "Restart it" (auto-restart triggered)
4. 4-second delay before restart
5. Process starts again
6. Repeat from step 1

### Secondary Cause: Stale PID Files

PM2 maintained persistent state in `~/.pm2/pids/`:
```
agent-deployment-10.pid
agent-e2e-3.pid
agent-integration-9.pid
agent-scaffold-8.pid
agent-validation-2.pid
orchestrator-0.pid
```

Even if processes died, PM2 daemon referenced these files and attempted resurrection.

### Tertiary Cause: PM2 Daemon Not Stopped

The `stop-dev.sh` script called `pnpm pm2:stop` but did **not**:
- Kill the PM2 daemon itself (`pm2 kill`)
- Clean up stale PID files
- Remove PM2 communication sockets

Result: PM2 daemon continued running in background with resurrection logic active.

---

## Impact Assessment

### Resource Consumption
```
Process                Memory (MB)    Uptime
Orchestrator           129 MB         ~3 min
Validation Agent       114 MB         ~3 min
E2E Agent              103 MB         ~3 min
Scaffold Agent         104 MB         ~3 min
Integration Agent      102 MB         ~3 min
Deployment Agent       118 MB         ~3 min
─────────────────────────────────────────
TOTAL                  670 MB         Constantly respawning
```

With resurrection loop every 4-5 seconds, processes consumed CPU continuously without completion.

### System Risk
- **Memory:** 670 MB × multiple resurrections = potential OOM
- **File Descriptors:** 6 processes × multiple forks = descriptor exhaustion
- **CPU:** Constant spawn/kill cycles = high CPU utilization
- **Stability:** System near crashing if loop continued

---

## Why Standard Kill Didn't Work

Users attempted:
```bash
pkill -f "run-agent.js"
pkill -f "server.js"
```

**Problem:** These only killed child processes, not PM2 daemon.

**What Happens:**
```
Kill attempt → Process exits → PM2 detects → Auto-restart triggered
```

PM2 daemon (running as background service) saw the dead processes and resurrected them automatically.

---

## Solution Implemented

### Updated `scripts/env/stop-dev.sh`

Added three critical steps to prevent resurrection:

#### Step 1: Kill PM2 Daemon
```bash
pkill -9 -f "pm2"
pkill -9 -f "PM2"
```

Kills the daemon managing all processes. Without the daemon, no auto-restart logic runs.

#### Step 2: Delete Stale PID Files
```bash
rm -f ~/.pm2/pids/*.pid
```

Removes PM2's persistent state. These files were the "resurrection blueprint" PM2 used to know which processes to restart.

#### Step 3: Remove Communication Sockets
```bash
rm -f ~/.pm2/*.sock
```

Removes Unix sockets used by PM2 daemon to communicate with processes. Prevents ghost connections.

### Result
- ✅ PM2 daemon cannot resurrect processes (daemon is dead)
- ✅ No persistent state for resurrection (PID files deleted)
- ✅ No socket connections for resurrection (sockets deleted)
- ✅ Processes stay dead until explicitly started with `start-dev.sh`

---

## Prevention Strategies

### For Users

**Always stop environment properly:**
```bash
./scripts/env/stop-dev.sh      # Uses updated script with PM2 daemon kill
```

Do **not** use:
```bash
pkill -f "run-agent"           # ❌ Only kills child processes
kill -9 <PID>                  # ❌ Triggers auto-restart
docker-compose down            # ❌ Doesn't kill PM2 processes
```

### For Developers (Phase 7 CLI)

When building the unified CLI command center (Phase 7), include:

```typescript
// Stop command must:
1. Stop PM2 processes via API
2. Kill PM2 daemon explicitly
3. Clean ~/.pm2/pids/* files
4. Remove ~/.pm2/*.sock files
5. Verify all processes dead
6. Verify PM2 daemon dead
```

### For Infrastructure

Consider alternatives to PM2 auto-restart in development:
- **Option A:** Disable `autorestart` in dev mode
- **Option B:** Use process supervisor with manual restart only
- **Option C:** Replace PM2 with Node.js worker_threads for agents

---

## Testing & Verification

### Verification Steps
```bash
# After running stop-dev.sh, verify:

# 1. No agent/orchestrator processes
ps aux | grep -E "run-agent|server.js" | grep -v grep
# Expected: Empty result

# 2. No PM2 daemon
ps aux | grep pm2 | grep -v grep
# Expected: Empty result

# 3. No stale PID files
ls ~/.pm2/pids/
# Expected: Empty or error (directory doesn't exist)

# 4. No sockets
ls ~/.pm2/*.sock
# Expected: Empty or error (files don't exist)
```

### Automated Testing (Phase 7)
Add to CLI validation:
```bash
agentic-sdlc stop --validate
# Should verify all 4 conditions above
```

---

## Lessons Learned

### 1. PM2 State is Persistent
PM2 daemon maintains state in `~/.pm2/`. Killing processes doesn't reset this state.

**Lesson:** Must explicitly kill daemon and clean state files for clean shutdown.

### 2. Auto-Restart in Development is Dangerous
Auto-restart is useful for production, but in development where we frequently kill/restart services, it creates resurrection loops.

**Lesson:** Consider disabling auto-restart in development configs or making it optional.

### 3. Process Management Must Be Explicit
Implicit background process management (like PM2 daemon) can cause hard-to-debug issues.

**Lesson:** Phase 7 CLI must make process lifecycle explicit and controllable.

### 4. Multiple Tools Need Coordination
Docker, PM2, and manual process killing all manage processes. They must coordinate.

**Lesson:** Phase 7 should consolidate process management into single CLI.

---

## Documentation Updates

### Updated Files
- ✅ `scripts/env/stop-dev.sh` - Added PM2 daemon kill + state cleanup
- ✅ `CLAUDE.md` - Version 49.0 (Phase 7 planning notes)

### New Documentation
- ✅ `INCIDENT_RUNAWAY_PROCESSES.md` (this file)

---

## Recommendations for Phase 7

### 1. Unified CLI Process Management
**Phase 7A Task 7:** Polish CLI framework includes explicit process lifecycle management.

```bash
agentic-sdlc start    # Single source of truth for starting
agentic-sdlc stop     # Proper shutdown with daemon kill + state cleanup
agentic-sdlc status   # Clear view of what's running
```

### 2. Health Checks
**Phase 7C Task 19:** Observability includes process health.

```bash
agentic-sdlc health:processes
# Shows:
# - PM2 daemon status
# - Running processes
# - Stale state files
# - Socket files
```

### 3. Automatic Recovery
**Phase 7B Task 14:** Advanced features include safe auto-restart.

```bash
agentic-sdlc deploy --auto-recovery
# Safely restarts services with proper cleanup
```

### 4. Documentation
**Phase 7C Task 24:** Include process management best practices.

---

## Conclusion

PM2 auto-restart feature created runaway process loop. Fixed by explicitly killing PM2 daemon and cleaning stale state files. Updated `stop-dev.sh` to prevent future occurrences.

**Next Steps:**
1. ✅ Immediate: Updated stop-dev.sh deployed
2. ✅ Short-term: This incident report for team awareness
3. ⏳ Long-term: Phase 7 unified CLI to eliminate this class of bugs

**Status:** RESOLVED & PREVENTIONS IN PLACE ✅

