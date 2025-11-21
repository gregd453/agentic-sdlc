# CLI Infrastructure Test Plan - Complete Package

**Created:** 2025-11-16
**Status:** ✅ Ready for Execution
**Purpose:** Comprehensive testing suite for Agentic SDLC CLI with infrastructure start/stop validation

---

## 📦 What Has Been Created

### 1. **CLI-INFRASTRUCTURE-TEST-PLAN.md** (1,200+ lines)
   - **Purpose:** Detailed, phase-by-phase test plan
   - **Audience:** QA engineers, developers
   - **Content:**
     - 10 complete test phases with step-by-step procedures
     - Expected results and acceptance criteria for each phase
     - Troubleshooting guide with common issues
     - Test completion checklist
     - Metrics summary table
   - **Use Case:** Reference guide for manual testing or documentation

### 2. **scripts/test-cli-infrastructure.sh** (Executable)
   - **Purpose:** Automated test runner script
   - **Audience:** Developers, CI/CD automation
   - **Content:**
     - 7 automated test phases with color-coded output
     - Process scanning for runaway processes
     - Service verification (API, DB, Redis, Dashboard)
     - CLI command execution testing (11 commands)
     - Rapid cycle testing (3 consecutive start/stop cycles)
     - Automatic report generation
   - **Duration:** ~15-20 minutes (full) or ~10-15 minutes (quick mode)
   - **Usage:**
     ```bash
     ./scripts/test-cli-infrastructure.sh        # Full suite
     ./scripts/test-cli-infrastructure.sh --quick # Quick run
     ./scripts/test-cli-infrastructure.sh --phase 1 # Specific phase
     ```

### 3. **CLI-TEST-QUICK-START.md** (500+ lines)
   - **Purpose:** Quick reference for running tests
   - **Audience:** Developers getting started
   - **Content:**
     - Command cheat sheet for test execution
     - Phase overview table with durations
     - CLI commands being tested (11 core + 13 total)
     - Expected results and success metrics
     - Troubleshooting quick fix guide
     - Output file reference
   - **Use Case:** Get started in 2 minutes

### 4. **CLI-COMMANDS-REFERENCE.md** (800+ lines)
   - **Purpose:** Complete CLI command documentation
   - **Audience:** All users of the CLI
   - **Content:**
     - All 11 Phase 7A implemented commands with examples
     - Command options and flags
     - Output examples (JSON, YAML, text)
     - Exit codes and error handling
     - Common usage patterns
     - CI/CD integration examples
     - Performance characteristics
     - Planned Phase 7B commands (placeholders)
   - **Use Case:** Developer reference during development

---

## 🎯 What Gets Tested

### Infrastructure Lifecycle
| Phase | Test | Duration | Critical |
|-------|------|----------|----------|
| 0 | Setup & Initialization | 2min | ✅ |
| 1 | Cold Start | 2min | ✅ |
| 2 | Service Verification | 1min | ✅ |
| 3 | Process Scanning | 1min | ✅ |
| 4 | **CLI Command Testing** | 3min | ✅ |
| 5 | Graceful Shutdown | 2min | ✅ |
| 6 | Cleanup Verification | 1min | ✅ |
| 7 | Rapid Cycles | 3min | ❌ (optional) |

### Services Validated
- ✅ Orchestrator API (port 3000)
- ✅ Dashboard UI (port 3001)
- ✅ Analytics Service (port 3002)
- ✅ PostgreSQL Database (port 5433)
- ✅ Redis Cache (port 6380)
- ✅ 5 Agent Processes (via PM2)

### CLI Commands Tested (11 Total)
```
start, stop, restart, status, reset                    (Environment)
health, health:services, health:database, health:agents (Health)
logs, metrics                                          (Logs & Monitoring)
help                                                   (Help)
```

### Runaway Process Detection
- ✅ Counts node processes (should be 6)
- ✅ Counts npm processes (should be 0)
- ✅ Counts PM2 daemon (should be 1)
- ✅ Verifies port listeners (3000, 3001, 3002 = 1 each)
- ✅ Detects orphaned processes post-shutdown

### Singleton Enforcement
- ✅ Only 1 Dashboard running
- ✅ Only 1 Orchestrator API running
- ✅ Only 1 Analytics Service running
- ✅ No duplicate port bindings

---

## 📊 Success Criteria

### Phase Results
- **Phase 1 (Cold Start):** Infrastructure starts in <60s
- **Phase 2 (Services):** All 5 critical services responding
- **Phase 3 (Processes):** 6 PM2 processes, 1 listener per port
- **Phase 4 (CLI):** All 11 commands execute successfully
- **Phase 5 (Shutdown):** Services stop in <30s
- **Phase 6 (Cleanup):** Zero orphaned processes
- **Phase 7 (Cycles):** All 3 rapid cycles complete

### Overall Success
- ✅ **PASS:** All phases complete, 0 failed tests
- ✅ **PARTIAL PASS:** Some phases fail, infrastructure usable
- ❌ **FAIL:** Critical phases fail or CLI commands error

---

## 🚀 How to Run Tests

### Step 1: Verify Setup
```bash
# Check CLI is built
ls -la packages/cli/dist/index.js

# Check test script is executable
ls -la scripts/test-cli-infrastructure.sh
```

### Step 2: Run Tests
```bash
# Full test suite (~15-20 minutes)
./scripts/test-cli-infrastructure.sh

# Quick test (~10-15 minutes, skips rapid cycles)
./scripts/test-cli-infrastructure.sh --quick

# Test specific phase only
./scripts/test-cli-infrastructure.sh --phase 4  # Test CLI commands only
```

### Step 3: Review Results
```bash
# View detailed report
cat /tmp/cli-test-report-*.txt

# View summary
cat /tmp/cli-test-summary.txt

# Check individual command outputs
cat /tmp/cli-status.json
cat /tmp/cli-health.json
```

---

## 📈 Test Output Files

After running tests, these files are generated:

```
/tmp/cli-test-report-YYYYMMDD-HHMMSS.txt   # Detailed report
/tmp/cli-test-summary.txt                   # Summary results
/tmp/cli-status.json                        # status command output
/tmp/cli-health.json                        # health command output
/tmp/cli-health-svc.json                    # health:services output
/tmp/cli-logs.txt                           # logs command output
/tmp/cli-metrics.txt                        # metrics command output
/tmp/cli-restart.txt                        # restart command output
/tmp/start-dev.log                          # start-dev.sh log
/tmp/stop-dev.log                           # stop-dev.sh log
```

---

## 🔍 Key Features of Test Suite

### Automated
- ✅ Runs unattended from single command
- ✅ Color-coded output (green pass, red fail, yellow warning)
- ✅ Progress indicators for each test
- ✅ Automatic report generation
- ✅ Exit codes for CI/CD integration

### Comprehensive
- ✅ Tests infrastructure start/stop
- ✅ Tests service connectivity
- ✅ Tests process management
- ✅ Tests CLI command execution
- ✅ Tests cleanup and resource release
- ✅ Tests stability with rapid cycles

### Reliable
- ✅ Handles cleanup if previous tests left orphans
- ✅ Graceful timeouts (doesn't hang forever)
- ✅ Detailed error messages for troubleshooting
- ✅ Skips non-critical failures
- ✅ Works with existing infrastructure

### Actionable
- ✅ Clear pass/fail indicators
- ✅ Specific failure messages
- ✅ Troubleshooting guide included
- ✅ Can re-run individual phases
- ✅ Detailed metrics and summaries

---

## 💡 Usage Examples

### For Local Development
```bash
# Quick health check during development
./scripts/test-cli-infrastructure.sh --phase 2

# Full validation before committing
./scripts/test-cli-infrastructure.sh --quick

# Debug specific CLI command
./scripts/test-cli-infrastructure.sh --phase 4
```

### For CI/CD Pipeline
```bash
# In GitHub Actions/GitLab CI
- name: Test CLI Infrastructure
  run: ./scripts/test-cli-infrastructure.sh --quick
  timeout-minutes: 20

- name: Check test results
  if: failure()
  run: cat /tmp/cli-test-summary.txt
```

### For Debugging
```bash
# Test only startup
./scripts/test-cli-infrastructure.sh --phase 1

# Test only services
./scripts/test-cli-infrastructure.sh --phase 2

# Test only CLI
./scripts/test-cli-infrastructure.sh --phase 4

# Test only shutdown
./scripts/test-cli-infrastructure.sh --phase 5
```

---

## 🎯 What You Can Do Next

### Immediate (After Tests PASS ✅)
1. Commit test plan and scripts to repository
2. Add test instructions to project README
3. Run tests in CI/CD pipeline
4. Archive successful test reports
5. Proceed with Phase 7B (test, deploy, db commands)

### If Tests FAIL ❌
1. Review detailed report: `/tmp/cli-test-report-*.txt`
2. Check specific failing phase logs
3. Follow troubleshooting guide in test plan
4. Fix underlying issue
5. Re-run failing phase only

### Long-term
1. Integrate into CI/CD (GitHub Actions, etc.)
2. Schedule regular test runs
3. Monitor test trends over time
4. Add more comprehensive scenarios
5. Extend to Phase 7B commands as they're implemented

---

## 📚 Document Cross-Reference

```
CLI-TEST-SUMMARY.md (this file)
├── CLI-INFRASTRUCTURE-TEST-PLAN.md    → Detailed procedures
├── CLI-TEST-QUICK-START.md            → Quick reference
├── CLI-COMMANDS-REFERENCE.md          → Command documentation
├── scripts/test-cli-infrastructure.sh → Executable script
├── PHASE_7A_FINAL_REPORT.md           → Implementation details
└── CLAUDE.md                          → Project context
```

---

## ✅ Pre-Flight Checklist

Before running tests, ensure:

- [ ] Node.js >= 20.0.0 installed (`node --version`)
- [ ] Docker installed and running (`docker --version`)
- [ ] npm/pnpm installed (`pnpm --version`)
- [ ] CLI is built (`ls packages/cli/dist/index.js`)
- [ ] Test script is executable (`ls -x scripts/test-cli-infrastructure.sh`)
- [ ] No existing processes running (`pgrep node | wc -l` = 0)
- [ ] Ports 3000, 3001, 3002, 5433, 6380 are free
- [ ] Docker daemon is running
- [ ] At least 2GB free disk space
- [ ] Internet connection (for npm/API calls)
- [ ] 30+ minutes available (if running full suite)

---

## 🆘 Quick Troubleshooting

### Script won't execute
```bash
chmod +x scripts/test-cli-infrastructure.sh
./scripts/test-cli-infrastructure.sh
```

### Port already in use
```bash
lsof -i :3000  # Find process
kill -9 <PID>  # Kill it
./scripts/env/stop-dev.sh  # Or use stop script
```

### CLI command not found
```bash
pnpm build --filter @agentic-sdlc/cli
node packages/cli/dist/index.js status
```

### Tests hanging
```bash
# In another terminal
pkill -9 node
./scripts/env/stop-dev.sh
# Then retry test
```

---

## 📞 Getting Help

### View Documentation
```bash
# Quick start
cat CLI-TEST-QUICK-START.md

# Full plan
less CLI-INFRASTRUCTURE-TEST-PLAN.md

# Command reference
less CLI-COMMANDS-REFERENCE.md
```

### View CLI Help
```bash
agentic-sdlc --help
agentic-sdlc status --help
agentic-sdlc health --help
```

### Check Infrastructure Status
```bash
./scripts/env/check-health.sh --verbose
pnpm pm2:status
docker ps
```

---

## 📝 Test Log Template

After completing tests, record results:

```
CLI Infrastructure Test Log
===========================

Date: ___________
Tester: ________
Environment: ___________

Test Execution:
  Mode: [ ] Full [ ] Quick [ ] Specific Phase: ___
  Start Time: _____  End Time: _____  Duration: _____

Phase Results:
  [ ] Phase 0 (Setup): PASS / FAIL
  [ ] Phase 1 (Cold Start): PASS / FAIL
  [ ] Phase 2 (Services): PASS / FAIL
  [ ] Phase 3 (Processes): PASS / FAIL
  [ ] Phase 4 (CLI Commands): PASS / FAIL
  [ ] Phase 5 (Shutdown): PASS / FAIL
  [ ] Phase 6 (Cleanup): PASS / FAIL
  [ ] Phase 7 (Rapid Cycles): PASS / FAIL / SKIPPED

Overall Result: [ ] PASS [ ] FAIL [ ] PARTIAL

Issues Found:
  1. ___________________________
  2. ___________________________

Performance:
  Startup Time: ___s (target: <60s)
  Shutdown Time: ___s (target: <30s)
  CLI Response: ___ms (target: <5000ms)

Next Steps: ___________________
Notes: _______________________
```

---

## 🎉 Ready to Test!

All documents and scripts are in place. To get started:

```bash
# View quick start guide
cat CLI-TEST-QUICK-START.md

# Run full test suite
./scripts/test-cli-infrastructure.sh

# Check results
cat /tmp/cli-test-summary.txt
```

---

## 📋 Summary of Deliverables

| Document | Lines | Purpose | Audience |
|----------|-------|---------|----------|
| CLI-INFRASTRUCTURE-TEST-PLAN.md | 1,200+ | Detailed test procedures | QA/Developers |
| CLI-TEST-QUICK-START.md | 500+ | Quick reference | Everyone |
| CLI-COMMANDS-REFERENCE.md | 800+ | Command documentation | Users |
| scripts/test-cli-infrastructure.sh | 450+ | Automated test runner | CI/CD/Developers |
| CLI-TEST-SUMMARY.md | 400+ | This summary | Overview |

**Total:** 3,350+ lines of documentation + automated testing

---

**Version:** 1.0
**Status:** ✅ Ready for Execution
**Last Updated:** 2025-11-16
**Created By:** Claude Code (Session #75)

---

**Start testing:**
```bash
./scripts/test-cli-infrastructure.sh
```

**Need help?**
```bash
cat CLI-TEST-QUICK-START.md
```
