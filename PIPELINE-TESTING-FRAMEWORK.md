# Pipeline Testing Framework

Complete automation system for testing and iterating on the Agentic SDLC pipeline.

## Overview

This framework provides:
- **One-command startup/shutdown** for the entire development environment
- **Repeatable test cases** defined in markdown with JSON payloads
- **Automated workflow execution** with progress monitoring
- **Test result capture** for analysis and debugging
- **Health checks** to verify all services are running

## Quick Start

### 1. Start the Environment

```bash
./scripts/env/start-dev.sh
```

This starts:
- PostgreSQL 16 on :5433
- Redis 7 on :6380
- Orchestrator API on :3000
- Scaffold Agent (listening for tasks)

### 2. Run a Test

```bash
# List available tests
./scripts/run-pipeline-test.sh --list

# Run a specific test
./scripts/run-pipeline-test.sh "Simple Calculator"

# Run all tests (marathon mode)
./scripts/run-pipeline-test.sh --all
```

### 3. Stop the Environment

```bash
./scripts/env/stop-dev.sh
```

## Architecture

```
Pipeline Testing Framework
├── scripts/env/
│   ├── start-dev.sh          # Start all services
│   ├── stop-dev.sh           # Stop all services gracefully
│   ├── reset-dev.sh          # Nuke and reset everything
│   └── check-health.sh       # Verify service health
├── scripts/
│   └── run-pipeline-test.sh  # Execute test cases
├── PIPELINE-TEST-CASES.md    # Test definitions
└── .test-results/            # Test results (auto-created)
```

## Scripts Reference

### Environment Management

#### `./scripts/env/start-dev.sh`

Start all development services.

```bash
# Start core services (PostgreSQL, Redis, Orchestrator, Scaffold Agent)
./scripts/env/start-dev.sh

# Start all services including Validation & E2E agents
./scripts/env/start-dev.sh --all

# Show verbose startup output
./scripts/env/start-dev.sh --verbose
```

**Output:**
- Service health checks
- Process IDs saved to `.pids/services.pids`
- Logs in `scripts/logs/`

#### `./scripts/env/stop-dev.sh`

Gracefully stop all services.

```bash
# Graceful shutdown
./scripts/env/stop-dev.sh

# Force kill processes
./scripts/env/stop-dev.sh --force

# Stop only Docker containers (keep Node services)
./scripts/env/stop-dev.sh --containers
```

#### `./scripts/env/reset-dev.sh`

⚠️ **WARNING: This DESTROYS all data!**

Reset the environment to clean state.

```bash
# Interactive reset (prompts for confirmation)
./scripts/env/reset-dev.sh

# Force reset without prompt
./scripts/env/reset-dev.sh --force

# Keep generated apps but reset databases
./scripts/env/reset-dev.sh --keep-apps
```

#### `./scripts/env/check-health.sh`

Verify all services are healthy.

```bash
# Quick health check
./scripts/env/check-health.sh

# Detailed status
./scripts/env/check-health.sh --verbose

# Wait for services to be ready (blocks until all healthy)
./scripts/env/check-health.sh --wait
```

### Test Execution

#### `./scripts/run-pipeline-test.sh`

Execute test cases from `PIPELINE-TEST-CASES.md`.

```bash
# List all available test cases
./scripts/run-pipeline-test.sh --list

# Run a specific test
./scripts/run-pipeline-test.sh "Simple Calculator"

# Run with verbose output (shows payloads, responses)
./scripts/run-pipeline-test.sh "Simple Calculator" --verbose

# Run all tests in sequence
./scripts/run-pipeline-test.sh --all
```

**Test Execution Flow:**
1. Validates environment health
2. Submits workflow to orchestrator
3. Monitors progress in real-time (progress bar)
4. Captures completion status
5. Saves results to `.test-results/`
6. Displays summary

## Test Cases

Define test cases in `PIPELINE-TEST-CASES.md` using this format:

```markdown
### Test Name

Description of what the test validates.

**Expected Result:** What should be generated

```json
{
  "type": "app",
  "name": "app-name",
  "description": "Brief description",
  "priority": "high|medium|low",
  "requirements": "Natural language requirements for Claude"
}
```
```

### Built-in Test Cases

1. **Simple Calculator** - React calculator with math operations
2. **Hello World API** - Node.js REST API with health endpoints
3. **React Dashboard** - Multi-page dashboard with routing
4. **Form Application** - CRUD form with validation
5. **Todo List** - Todo management with persistence
6. **Fullstack Notes** - Complete React + Node + Database app
7. **Performance Test** - Large app with optimization metrics
8. **Component Library** - Reusable components with Storybook

## Test Results

After running a test, results are saved to `.test-results/`:

```
.test-results/
├── test-simple-calculator-result.json  # Full workflow response
├── test-simple-calculator-20251110-120000.log  # Execution log
└── ...
```

### Result JSON Structure

```json
{
  "workflow_id": "2b103d30-64bc-4f5a-89bc-05065c47ce2b",
  "status": "completed",
  "current_stage": "validation",
  "progress_percentage": 100,
  "output": {
    "app_path": "/tmp/agentic-sdlc-output/{workflow-id}/app-name",
    "generated_files": [
      "package.json",
      "src/App.tsx",
      "src/main.tsx",
      "tsconfig.json"
    ]
  }
}
```

## Logs

Service logs are saved in `scripts/logs/`:

```bash
# Tail orchestrator logs in real-time
tail -f scripts/logs/orchestrator.log

# Tail scaffold agent
tail -f scripts/logs/scaffold-agent.log

# Search for errors
grep -i error scripts/logs/*.log
```

## Workflow Lifecycle

```
Submission
  ↓
[Initiated] → Orchestrator receives request
  ↓
[Scaffolding] → Scaffold Agent generates code
  ↓
[Validation] → Validation Agent checks quality
  ↓
[E2E Testing] → E2E Agent runs tests (optional)
  ↓
[Completed/Failed] → Results available
```

## Typical Testing Session

### Session 1: Simple Test

```bash
# Start environment
./scripts/env/start-dev.sh

# Wait for health check
./scripts/env/check-health.sh --wait

# Run one test
./scripts/run-pipeline-test.sh "Simple Calculator"

# Stop when done
./scripts/env/stop-dev.sh
```

**Time:** ~3-5 minutes

### Session 2: Marathon Testing

```bash
# Start fresh environment
./scripts/env/reset-dev.sh --force
./scripts/env/start-dev.sh --all

# Run all test cases
./scripts/run-pipeline-test.sh --all

# Monitor results
ls -la .test-results/

# Stop
./scripts/env/stop-dev.sh
```

**Time:** ~20-30 minutes (8 tests × 3-5 min each)

### Session 3: Debug Specific Test

```bash
# Start
./scripts/env/start-dev.sh

# Run test with verbose output
./scripts/run-pipeline-test.sh "Simple Calculator" --verbose

# Check logs if failed
tail -f scripts/logs/orchestrator.log
tail -f scripts/logs/scaffold-agent.log

# Manual workflow submission for debugging
curl -X POST http://localhost:3000/api/v1/workflows \
  -H "Content-Type: application/json" \
  -d '{...}'

# Monitor manually
curl http://localhost:3000/api/v1/workflows/{id}

# Stop
./scripts/env/stop-dev.sh
```

## Troubleshooting

### Issue: Services Won't Start

```bash
# Check if ports are already in use
lsof -i :3000   # Orchestrator
lsof -i :5433   # PostgreSQL
lsof -i :6380   # Redis

# Kill conflicting processes
kill -9 $(lsof -t -i :3000)

# Start fresh
./scripts/env/reset-dev.sh --force
./scripts/env/start-dev.sh
```

### Issue: Workflow Stuck

```bash
# Check agent logs
tail -f scripts/logs/scaffold-agent.log

# Restart scaffold agent
./scripts/env/stop-dev.sh
sleep 2
./scripts/env/start-dev.sh

# Or manually restart just the agent
pkill -f "scaffold-agent"
cd packages/agents/scaffold-agent && npm run dev &
```

### Issue: Test Timeout

Default timeout is 300 seconds (5 minutes). If a test times out:

```bash
# 1. Check what stage workflow is stuck on
curl http://localhost:3000/api/v1/workflows/{workflow_id}

# 2. Check logs for errors
grep -i error scripts/logs/*.log

# 3. Try rerunning the test
./scripts/run-pipeline-test.sh "Test Name" --verbose
```

### Issue: Database Connection Errors

```bash
# Reset database
./scripts/env/reset-dev.sh --force

# Or manually reset
docker-compose down -v
docker-compose up -d postgres redis

# Check connection
docker exec agentic-sdlc-postgres pg_isready -U agentic
```

## Performance Metrics

Track in `PIPELINE-TEST-CASES.md`:

| Test | Cold Start | Warm Start | Total | Status |
|------|-----------|-----------|-------|--------|
| Simple Calculator | 12s | 4s | 18s | ✓ |
| Hello World API | 11s | 3s | 16s | ✓ |
| React Dashboard | 15s | 5s | 22s | ⏳ |

## Adding Custom Tests

1. **Add test case to `PIPELINE-TEST-CASES.md`:**

```markdown
### My Custom Test

Test description.

```json
{
  "type": "app",
  "name": "my-app",
  "description": "...",
  "priority": "high",
  "requirements": "..."
}
```
```

2. **Run the test:**

```bash
./scripts/run-pipeline-test.sh "My Custom Test"
```

3. **View results:**

```bash
cat .test-results/test-my-custom-test-result.json
```

## Integration with CI/CD

Use in GitHub Actions:

```yaml
- name: Run Pipeline Tests
  run: |
    ./scripts/env/start-dev.sh
    ./scripts/run-pipeline-test.sh --all
    ./scripts/env/stop-dev.sh
```

## Environment Variables

Customize behavior with:

```bash
# Override orchestrator URL
ORCHESTRATOR_URL=http://remote-host:3000 ./scripts/run-pipeline-test.sh "Test"

# Custom timeout (seconds)
TEST_TIMEOUT=600 ./scripts/run-pipeline-test.sh "Slow Test"

# Keep containers running after shutdown
KEEP_CONTAINERS=1 ./scripts/env/stop-dev.sh
```

## Next Steps

1. Review `PIPELINE-TEST-CASES.md` for available tests
2. Run `./scripts/run-pipeline-test.sh --list` to see test options
3. Start with a simple test: `./scripts/run-pipeline-test.sh "Simple Calculator"`
4. Use `--verbose` flag to debug issues
5. Add custom test cases as needed

## Support

For issues or questions:
1. Check logs in `scripts/logs/`
2. Review troubleshooting section above
3. Run health check: `./scripts/env/check-health.sh --verbose`
4. Reset and try again: `./scripts/env/reset-dev.sh --force`
