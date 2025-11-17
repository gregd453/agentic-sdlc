# CLI Infrastructure Test - Quick Start Guide

**Purpose:** Comprehensive test suite for the Agentic SDLC CLI with infrastructure start/stop cycles

**Status:** ✅ Ready to Execute
**Test Script:** `./scripts/test-cli-infrastructure.sh`
**Test Plan:** `CLI-INFRASTRUCTURE-TEST-PLAN.md`

---

## 🚀 Quick Start

### Run Full Test Suite
```bash
./scripts/test-cli-infrastructure.sh
```

**What it tests:**
- ✅ Cold start (clean environment startup)
- ✅ Service verification (all services responding)
- ✅ Process scanning (no runaway processes)
- ✅ CLI command execution (all 11 core commands)
- ✅ Graceful shutdown (clean service stop)
- ✅ Cleanup verification (zero leftover processes)
- ✅ Rapid cycles (3 consecutive start/stop cycles)

**Duration:** ~15-20 minutes
**Exit Code:** 0 = PASS, 1 = FAIL, 2 = Setup Error

### Run Quick Test (Skip Rapid Cycles)
```bash
./scripts/test-cli-infrastructure.sh --quick
```

**Duration:** ~10-15 minutes
**What it skips:** Phase 7 (rapid cycles)

### Run Specific Phase
```bash
./scripts/test-cli-infrastructure.sh --phase 1   # Cold start
./scripts/test-cli-infrastructure.sh --phase 2   # Service verification
./scripts/test-cli-infrastructure.sh --phase 3   # Process scan
./scripts/test-cli-infrastructure.sh --phase 4   # CLI testing
./scripts/test-cli-infrastructure.sh --phase 5   # Graceful shutdown
./scripts/test-cli-infrastructure.sh --phase 6   # Cleanup
./scripts/test-cli-infrastructure.sh --phase 7   # Rapid cycles
```

---

## 📋 Test Phases Overview

| Phase | Name | What It Tests | Duration | Critical |
|-------|------|---------------|----------|----------|
| 0 | Setup | Build CLI, check env, cleanup existing | 2min | Yes |
| 1 | Cold Start | Start environment from clean state | 2min | Yes |
| 2 | Service Verification | All services responding (API, DB, Redis, etc) | 1min | Yes |
| 3 | Process Scan | No orphaned/runaway processes | 1min | Yes |
| 4 | CLI Testing | Execute all 11 core CLI commands | 3min | Yes |
| 5 | Graceful Shutdown | Stop all services cleanly | 2min | Yes |
| 6 | Cleanup | Verify complete cleanup, zero processes | 1min | Yes |
| 7 | Rapid Cycles | 3 consecutive start/stop cycles | 3min | No |

---

## 🔬 CLI Commands Tested (Phase 7A Implementation)

### Environment Commands
```bash
agentic-sdlc start              # ✅ Start environment
agentic-sdlc stop               # ✅ Stop environment
agentic-sdlc restart [service]  # ✅ Restart services
agentic-sdlc status             # ✅ Show environment status
agentic-sdlc reset --confirm    # ✅ Reset environment
```

### Health Commands
```bash
agentic-sdlc health             # ✅ Full system health
agentic-sdlc health:services    # ✅ Service health only
agentic-sdlc health:database    # ✅ Database connectivity
agentic-sdlc health:agents      # ✅ Agent registration
```

### Logs & Monitoring
```bash
agentic-sdlc logs               # ✅ View logs
agentic-sdlc metrics            # ✅ System metrics
```

### Help
```bash
agentic-sdlc help               # ✅ Show help
agentic-sdlc --help             # ✅ Show help
```

**Total Core Commands Tested:** 11

---

## 📊 Expected Test Results

### ✅ All Tests PASS
- Startup time: < 60 seconds
- Shutdown time: < 30 seconds
- PM2 processes: 6 online (orchestrator + 5 agents)
- Docker containers: 5 (postgres, redis, dashboard, analytics, app)
- Critical ports (3000, 3001, 3002): 1 listener each
- Orphaned processes post-shutdown: 0
- CLI commands: All responding correctly
- Success rate: 100%

### ❌ Tests FAIL If
- Infrastructure fails to start
- Any service not responding
- Duplicate processes (e.g., 2 Dashboards)
- Services don't stop cleanly
- Orphaned processes remain
- CLI commands return errors

---

## 📁 Output Files

After running tests, check these files:

```bash
# Detailed report
cat /tmp/cli-test-report-*.txt

# Summary results
cat /tmp/cli-test-summary.txt

# Individual phase logs
/tmp/start-dev.log       # Start script output
/tmp/stop-dev.log        # Stop script output
/tmp/cli-status.json     # CLI status command output
/tmp/cli-health.json     # CLI health command output
/tmp/cli-logs.txt        # CLI logs command output
```

---

## 🔧 Troubleshooting

### Test hangs on "Starting infrastructure"
```bash
# Kill hanging processes
pkill -9 node
pkill -9 pm2
pkill -9 docker-compose

# Check status
pgrep node | wc -l  # Should be 0

# Re-run test
./scripts/test-cli-infrastructure.sh --phase 1
```

### "Port 3000 already in use"
```bash
# Find and kill process on port
lsof -i :3000
kill -9 <PID>

# Or force stop via script
./scripts/env/stop-dev.sh
```

### "PM2 processes expected 6, got X"
```bash
# Check what's running
pnpm pm2:status

# Force reset
pkill -9 -f "pm2 daemon"
rm -f ~/.pm2/pids/*.pid
rm -f ~/.pm2/*.sock

# Retry
./scripts/env/stop-dev.sh
sleep 5
./scripts/test-cli-infrastructure.sh --phase 1
```

### "CLI command not found"
```bash
# Rebuild CLI
pnpm build --filter @agentic-sdlc/cli

# Verify it exists
ls -la packages/cli/dist/index.js

# Run directly
node packages/cli/dist/index.js status
```

### Docker containers not stopping
```bash
# Force stop all containers
docker-compose -f docker-compose.yml down -v
docker stop $(docker ps -q)

# Verify
docker ps  # Should show no running containers
```

---

## 📈 Success Metrics

### Phase Completion Criteria
- **Phase 1:** Infrastructure starts within 60 seconds
- **Phase 2:** All 5 critical services responding
- **Phase 3:** Exactly 6 PM2 processes, 1 listener per port
- **Phase 4:** All 11 CLI commands execute successfully
- **Phase 5:** Infrastructure stops within 30 seconds
- **Phase 6:** Zero orphaned processes post-shutdown
- **Phase 7:** All 3 rapid cycles complete successfully

### Overall Success
- **PASS:** All phases complete, 0 failed tests
- **FAIL:** Any phase fails or CLI commands return errors
- **PARTIAL PASS:** Some phases fail, infrastructure still usable

---

## 💡 What This Tests

### Functionality
- ✅ Infrastructure startup/shutdown works correctly
- ✅ All services come online and respond
- ✅ CLI commands execute against running services
- ✅ Services shut down gracefully

### Reliability
- ✅ No resource leaks (orphaned processes)
- ✅ No duplicate services (singleton enforcement)
- ✅ Clean state between cycles
- ✅ Consistent behavior across rapid restarts

### Automation
- ✅ CLI commands return parseable JSON
- ✅ CLI commands work with --json flag
- ✅ Exit codes indicate success/failure
- ✅ Ready for CI/CD integration

---

## 🎯 Next Steps

### If Tests PASS ✅
1. Infrastructure is production-ready for testing
2. CLI commands are working as implemented
3. Ready to test actual workflows
4. Ready to integrate with CI/CD pipeline
5. Can move to Phase 7B command implementation

### If Tests FAIL ❌
1. Review detailed report: `/tmp/cli-test-report-*.txt`
2. Run specific failing phase with verbose output
3. Check logs: `./scripts/env/check-health.sh --verbose`
4. Fix issues in respective scripts/services
5. Rerun tests from failing phase

---

## 📚 Related Documentation

- [CLAUDE.md](./CLAUDE.md) - Project context & Phase 7A completion
- [CLI-INFRASTRUCTURE-TEST-PLAN.md](./CLI-INFRASTRUCTURE-TEST-PLAN.md) - Detailed test plan
- [PHASE_7A_FINAL_REPORT.md](./PHASE_7A_FINAL_REPORT.md) - CLI implementation details
- [scripts/env/start-dev.sh](./scripts/env/start-dev.sh) - Environment startup
- [scripts/env/stop-dev.sh](./scripts/env/stop-dev.sh) - Environment shutdown
- [packages/cli/README.md](./packages/cli/README.md) - CLI documentation

---

## 📞 Support

### View Full Help
```bash
# CLI help
agentic-sdlc --help

# Specific command help
agentic-sdlc start --help
agentic-sdlc status --help
```

### Manual Infrastructure Control
```bash
# Start services
./scripts/env/start-dev.sh

# Check health
./scripts/env/check-health.sh --verbose

# View logs
pnpm pm2:logs

# Stop services
./scripts/env/stop-dev.sh
```

### Check PM2 Status
```bash
# List processes
pnpm pm2:status

# Monitor live
pnpm pm2:monit

# View specific logs
pnpm pm2:logs orchestrator
pnpm pm2:logs agent-scaffold
```

---

## 🏁 Test Template

After running tests, fill out this template:

```
CLI Infrastructure Test Results
================================

Date: ____________
Tester: __________

Phase Results:
  ☐ Phase 0 (Setup): PASS / FAIL
  ☐ Phase 1 (Cold Start): PASS / FAIL
  ☐ Phase 2 (Service Verification): PASS / FAIL
  ☐ Phase 3 (Process Scan): PASS / FAIL
  ☐ Phase 4 (CLI Testing): PASS / FAIL
  ☐ Phase 5 (Graceful Shutdown): PASS / FAIL
  ☐ Phase 6 (Cleanup): PASS / FAIL
  ☐ Phase 7 (Rapid Cycles): PASS / FAIL / SKIPPED

Overall: ☐ PASS ☐ FAIL ☐ PARTIAL

Issues Found:
  1. ___________________________
  2. ___________________________

Next Steps: _____________________
```

---

## 📝 Version Info

- **Test Script Version:** 1.0
- **CLI Version:** 1.0.0 (Phase 7A)
- **Created:** 2025-11-16
- **Last Updated:** 2025-11-16
- **Status:** Ready for Execution

---

**Ready to test? Run:**
```bash
./scripts/test-cli-infrastructure.sh
```

**Questions? Check:**
```bash
agentic-sdlc --help
./scripts/env/check-health.sh --verbose
```
