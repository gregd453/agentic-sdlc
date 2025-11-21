# EPCC Implementation Plan: Phase 7 - Unified Command Center CLI

**Date:** 2025-11-16 | **Session:** #75 | **Status:** PLANNING

---

## 1. Implementation Overview

### 1.1 Objective

**Goal:** Build a unified Command Center CLI (`agentic-sdlc` command) that consolidates ~45 scattered shell scripts into a single, cohesive interface.

**Why It's Needed:**
- ❌ Current: Users must know which of 45 scripts to run
- ✅ Future: Single `agentic-sdlc` command with subcommands
- ❌ Current: No structured output (AI agents can't parse colored text)
- ✅ Future: JSON output support for machine readability
- ❌ Current: Manual orchestration of complex workflows
- ✅ Future: Automated workflow execution with error recovery

**Business Value:**
1. **10x Operational Efficiency** - Consolidate 45 scripts into 1 CLI
2. **AI Agent Integration** - Structured output enables autonomous operations
3. **Developer Experience** - Self-documenting CLI with help system
4. **Production Ready** - Deployment management, health monitoring, rollback
5. **Lower Maintenance** - Single codebase vs 45 shell scripts

### 1.2 Success Criteria

**Functional:**
- ✅ All 45+ existing scripts consolidated into CLI
- ✅ All existing functionality preserved (100% backward compatible)
- ✅ Structured output (--json flag works everywhere)
- ✅ Works for both humans AND AI agents
- ✅ Zero breaking changes to existing workflows

**Quality:**
- ✅ 100% test coverage (CLI code)
- ✅ 0 TypeScript errors (strict mode)
- ✅ All services health checks pass
- ✅ All 41 test suites still pass
- ✅ Build completes without warnings

**Performance:**
- ✅ Start environment: < 2 minutes (maintain current speed)
- ✅ Health check: < 5 seconds
- ✅ Status query: < 1 second
- ✅ Log tailing: Real-time

**User Experience:**
- ✅ Command discoverability (help system)
- ✅ Clear error messages
- ✅ Progress indicators for long operations
- ✅ Exit codes for scripting

### 1.3 Non-Goals (Out of Scope)

**NOT Implementing:**
- ❌ Kubernetes integration (future Phase 8)
- ❌ Multi-cloud support (future Phase 9)
- ❌ Advanced monitoring dashboards (future Phase 9)
- ❌ Cost optimization tools (future Phase 9)
- ❌ Slack/Pagerduty integration (future Phase 10)

**Keeping as-is:**
- ✅ PM2 for process management (query via API)
- ✅ Docker Compose (orchestrate via CLI)
- ✅ GitHub Actions (can call CLI for validation)
- ✅ Turbo build system (leverage turbo API)
- ✅ Prisma ORM (use for DB operations)

---

## 2. Technical Approach

### 2.1 Architecture Design

```
┌─────────────────────────────────────────────────────┐
│            agentic-sdlc CLI Entry Point             │
│          (packages/cli/src/index.ts)                │
└────────────────┬────────────────────────────────────┘
                 │
        ┌────────┴──────────────────┬─────────────────┐
        │                           │                 │
    ┌───▼────────┐         ┌────────▼────┐    ┌──────▼─────┐
    │  Commands  │         │   Services  │    │   Utils    │
    │  (20+)     │         │   (7 core)  │    │   (5)      │
    └────────────┘         └─────────────┘    └────────────┘
        │                       │                  │
        ├─ start                ├─ environment     ├─ output-formatter
        ├─ stop                 ├─ health          ├─ logger
        ├─ restart              ├─ logs            ├─ shell
        ├─ status               ├─ test            ├─ validators
        ├─ health               ├─ deploy          └─ spinner
        ├─ logs                 ├─ db              
        ├─ test                 ├─ api-client      
        ├─ deploy               └─ database        
        ├─ db                                      
        ├─ workflows                              
        ├─ agents                                 
        └─ config                                 
        
        Each command:
        └─ Parses input
        └─ Validates (required flags, options)
        └─ Calls service(s)
        └─ Formats output (human or JSON)
        └─ Returns exit code
```

### 2.2 Package Structure

```
packages/cli/
├── src/
│   ├── index.ts                 # Entry point + main dispatch
│   │
│   ├── commands/                # 20+ command implementations
│   │   ├── environment/         # start, stop, restart, reset, status
│   │   │   ├── start.ts
│   │   │   ├── stop.ts
│   │   │   ├── restart.ts
│   │   │   ├── reset.ts
│   │   │   └── status.ts
│   │   ├── diagnostics/         # health, logs, metrics
│   │   │   ├── health.ts
│   │   │   ├── health-services.ts
│   │   │   ├── health-database.ts
│   │   │   ├── health-agents.ts
│   │   │   ├── logs.ts
│   │   │   └── metrics.ts
│   │   ├── testing/             # test, validate
│   │   │   ├── test.ts
│   │   │   ├── test-units.ts
│   │   │   ├── test-integration.ts
│   │   │   ├── test-e2e.ts
│   │   │   ├── test-performance.ts
│   │   │   └── validate-ci.ts
│   │   ├── deployment/          # deploy, rollback
│   │   │   ├── deploy.ts
│   │   │   ├── deploy-validate.ts
│   │   │   └── deploy-rollback.ts
│   │   ├── database/            # db operations
│   │   │   ├── db-setup.ts
│   │   │   ├── db-migrate.ts
│   │   │   ├── db-reset.ts
│   │   │   ├── db-seed.ts
│   │   │   └── db-backup.ts
│   │   ├── operations/          # workflows, agents
│   │   │   ├── workflows.ts
│   │   │   ├── workflows-list.ts
│   │   │   ├── workflows-get.ts
│   │   │   ├── agents.ts
│   │   │   ├── agents-list.ts
│   │   │   └── agents-status.ts
│   │   └── config/              # configuration
│   │       └── config.ts
│   │
│   ├── services/                # 7 core services
│   │   ├── environment.service.ts      # Docker, PM2, processes
│   │   ├── health.service.ts          # Health check aggregation
│   │   ├── logs.service.ts            # Log collection & streaming
│   │   ├── test.service.ts            # Test orchestration
│   │   ├── deploy.service.ts          # Deployment logic
│   │   ├── api-client.ts              # Orchestrator API client
│   │   └── database.service.ts        # Prisma DB operations
│   │
│   ├── utils/                   # 5 core utilities
│   │   ├── output-formatter.ts         # JSON, YAML, table formats
│   │   ├── logger.ts                   # Structured logging
│   │   ├── shell.ts                    # Command execution
│   │   ├── validators.ts               # Input validation
│   │   └── spinner.ts                  # Progress indicators
│   │
│   ├── types/
│   │   ├── commands.ts          # Command types
│   │   ├── services.ts          # Service types
│   │   └── config.ts            # Configuration types
│   │
│   └── config/
│       ├── defaults.ts          # Default values
│       └── project.ts           # Project configuration
│
├── tests/
│   ├── commands.test.ts         # Command tests
│   ├── services.test.ts         # Service tests
│   ├── integration.test.ts      # Integration tests
│   └── output.test.ts           # Output format tests
│
├── package.json                 # CLI package config
├── tsconfig.json                # TypeScript config
└── README.md                    # CLI documentation
```

### 2.3 Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| CLI Framework | Commander.js | Simple, popular, TypeScript support |
| Output Colors | chalk | Standard in Node.js CLIs |
| Tables | table | ASCII tables for output |
| Process Mgmt | Query PM2 API | Don't interfere with cluster mode |
| Testing | Vitest | Already in project, faster |
| Output Format | JSON + Text | Both humans and AI agents |
| Shell Exec | child_process.exec | Standard Node.js |

### 2.4 Integration Points

```
CLI Package Integration:
├─ Turbo Build System
│  ├─ Use: turbo run build
│  ├─ Use: turbo run test
│  ├─ Use: turbo run typecheck
│  └─ Use: Turbo API for caching
│
├─ PM2 Process Management
│  ├─ Query: pm2 status (via child_process)
│  ├─ Control: pm2 start/stop/restart
│  ├─ Logs: pm2 logs (stream)
│  └─ Avoid: Don't send signals directly
│
├─ Docker Compose
│  ├─ Up: docker-compose up -d
│  ├─ Down: docker-compose down
│  ├─ Logs: docker logs (stream)
│  └─ Exec: docker exec for commands
│
├─ Prisma ORM
│  ├─ Migrations: prisma migrate
│  ├─ DB Ops: prisma db
│  ├─ Seed: prisma db seed
│  └─ Client: Prisma client for queries
│
├─ Orchestrator API
│  ├─ HTTP: axios or node-fetch
│  ├─ Endpoints: /api/v1/workflows, /api/v1/agents, etc.
│  ├─ Health: /api/v1/health
│  └─ WebSocket: ws for real-time
│
├─ Redis
│  ├─ Connect: node-redis or redis
│  ├─ Streams: Consumer group status
│  ├─ Keys: Introspection for health
│  └─ Avoid: Direct pub/sub (reserved for platform)
│
└─ Vitest
   ├─ Run: vitest run
   ├─ Coverage: vitest --coverage
   └─ Watch: vitest --watch
```

---

## 3. Task Breakdown & Estimates

### Phase 7A: Core CLI Foundation (Weeks 1-2, ~40 hours)

#### Task 1: Project Setup & Structure (2 hours)
- [ ] Create @agentic-sdlc/cli monorepo package
  - Package: @agentic-sdlc/cli
  - Location: packages/cli/
  - Dependencies: commander, chalk, table, etc.
  - Bin: "agentic-sdlc" → dist/index.js
- [ ] Add pnpm workspace entry (pnpm-workspace.yaml)
- [ ] Create TypeScript configuration (tsconfig.json)
- [ ] Setup package.json with scripts (dev, build, test)
- [ ] Create basic README.md

**Testing:** Verify package builds with `pnpm build`

---

#### Task 2: Core CLI Architecture (3 hours)
- [ ] Create src/index.ts entry point with Commander setup
  - Global options: --verbose, --json, --help
  - Command registration system
  - Error handling wrapper
  - Exit code management
- [ ] Create command dispatcher (route to subcommands)
- [ ] Create output-formatter.ts utility
  - Text output with colors
  - JSON output (--json flag)
  - YAML output (--yaml flag)
  - Error formatting
- [ ] Create logger.ts utility (structured logging)
- [ ] Create validators.ts utility (input validation)

**Testing:** 
- Unit tests for CLI dispatcher
- Unit tests for output formatter
- Test global flags work

---

#### Task 3: Environment Commands - Start (4 hours)
- [ ] Implement `start` command
  - Check prerequisites (Docker, Node, pnpm)
  - Start Docker containers (postgres, redis, dashboard, analytics)
  - Wait for container health
  - Build packages if needed (turbo run build)
  - Start PM2 processes (pnpm pm2:start)
  - Wait for service health
  - Return status summary
- [ ] Create environment.service.ts
  - Docker container management
  - PM2 process management
  - Health check integration
- [ ] Input validation (--services, --skip-build, --wait flags)
- [ ] Error recovery (rollback on failure)

**Testing:**
- Unit tests for environment service
- Integration test with Docker (if available)
- Test with --json flag
- Test error cases (port conflict, etc.)

**Output Example:**
```
$ agentic-sdlc start
Starting environment...
✓ Docker containers ready
✓ Packages built
✓ PM2 processes started
✓ Health checks passed
✅ Ready in 45s
```

---

#### Task 4: Environment Commands - Stop/Restart (3 hours)
- [ ] Implement `stop` command
  - Graceful shutdown (SIGTERM → wait → SIGKILL)
  - PM2 process stop
  - Docker container cleanup
  - Orphaned process cleanup
  - --force flag for immediate kill
- [ ] Implement `restart` command
  - Stop existing processes
  - Start new processes
  - --service flag for selective restart
- [ ] Create graceful shutdown patterns

**Testing:**
- Unit tests for shutdown logic
- Integration tests (actual process killing)
- Test --force flag
- Test --service selective restart

---

#### Task 5: Status & Health Commands (4 hours)
- [ ] Implement `status` command
  - Check all services (Docker, PM2, API)
  - Return structured status
  - --watch flag for continuous updates
  - --json for machine output
- [ ] Create health.service.ts
  - Infrastructure health (Docker, ports, disk)
  - Database health (connectivity, migrations)
  - Message bus health (Redis, streams)
  - Service health (API, agents)
  - Application health (error rate, latency)
- [ ] Implement health subcommands
  - `health:services` - Service status only
  - `health:database` - Database connectivity
  - `health:agents` - Agent registration

**Testing:**
- Unit tests for health checks
- Integration tests with real services
- Test output formats (text, JSON)
- Test timeout handling

---

#### Task 6: Logs Command (3 hours)
- [ ] Implement `logs` command
  - Aggregate logs from multiple services
  - Stream real-time logs (--follow)
  - Filter by service (--service=NAME)
  - Limit output (--lines=100)
  - Search in logs (--grep=PATTERN)
- [ ] Create logs.service.ts
  - PM2 log file reading
  - Docker container log streaming
  - Log aggregation logic

**Testing:**
- Unit tests for log aggregation
- Integration tests with real log files
- Test streaming (--follow)
- Test filtering (--service, --grep)

---

#### Task 7: CLI Framework Polish (2 hours)
- [ ] Create help system
  - `agentic-sdlc help`
  - `agentic-sdlc --help`
  - `agentic-sdlc <command> --help`
- [ ] Add command aliases
  - `start` = `up`
  - `stop` = `down`
  - `restart` = `reload`
- [ ] Add shell completion support
  - Bash completion script
  - Zsh completion script
- [ ] Create CHANGELOG.md for CLI

**Testing:**
- Unit tests for help rendering
- Manual testing of completion

---

#### Task 8: Core Testing & Validation (4 hours)
- [ ] Write unit tests for all Phase 7A commands
  - Test command parsing
  - Test option handling
  - Test output formats
  - Test error cases
- [ ] Write integration tests
  - Test with mock services
  - Test Docker interaction (if available)
  - Test PM2 interaction
- [ ] Setup test environment
  - Mock Docker Compose
  - Mock PM2 API
  - Mock Orchestrator API
- [ ] Achieve 85%+ coverage
- [ ] Verify `pnpm build` succeeds (zero errors)
- [ ] Verify `pnpm test` passes all

**Testing:**
- Run `turbo run test --filter=@agentic-sdlc/cli`
- Verify coverage report
- No TypeScript errors

---

**Phase 7A Summary:**
- **Deliverables:** Core CLI, start/stop/restart/status/health/logs commands
- **Files Created:** ~50 TypeScript files (~5,000 lines)
- **Tests Created:** ~200 test cases (unit + integration)
- **Total Hours:** ~40 hours
- **Quality:** 85%+ coverage, 0 TS errors

---

### Phase 7B: Testing & Deployment (Weeks 3-4, ~35 hours)

#### Task 9: Test Command (4 hours)
- [ ] Implement `test` command
  - `test --tier 1` (run Tier 1 tests)
  - `test --tier 2|3|4` (Tier 2, 3, 4)
  - `test --match pattern` (filter tests)
  - `test --parallel` (parallel execution)
  - `test --timeout seconds` (custom timeout)
  - `test --output json|table` (output format)
- [ ] Create test.service.ts
  - Parse test files from scripts/tests/
  - Execute tests in sequence or parallel
  - Aggregate results
  - Generate report
- [ ] Implement test subcommands
  - `test:units` (Vitest unit tests)
  - `test:integration` (Vitest integration)
  - `test:e2e` (Full E2E pipeline tests)
  - `test:performance` (Load tests)

**Testing:**
- Unit tests for test runner
- Integration tests with actual test scripts
- Test parallelization
- Test result aggregation

---

#### Task 10: Deployment Commands (4 hours)
- [ ] Implement `deploy` command
  - `deploy --env staging` (deploy to staging)
  - `deploy --env production` (deploy to prod)
  - `deploy --dry-run` (show what would deploy)
  - `deploy --validate` (run validation first)
  - `deploy --approve` (require approval for prod)
- [ ] Create deploy.service.ts
  - Environment validation
  - Docker image verification
  - Database migration checks
  - API endpoint checks
  - Deployment execution (via AWS CLI or script)
- [ ] Implement deployment subcommands
  - `deploy:validate` (comprehensive checks)
  - `deploy:rollback --env prod` (automatic rollback)
  - `deploy:status --env prod` (deployment status)

**Testing:**
- Unit tests for validation logic
- Integration tests with dry-run mode
- Test rollback logic

---

#### Task 11: Database Commands (3 hours)
- [ ] Implement `db` commands
  - `db:setup` (initial database setup)
  - `db:migrate` (apply pending migrations)
  - `db:reset --confirm` (clear all data)
  - `db:seed` (populate default data)
  - `db:backup` (backup current state)
  - `db:status` (show migration status)
- [ ] Create database.service.ts
  - Use Prisma client
  - Handle migrations safely
  - Backup/restore logic
  - Seed data management

**Testing:**
- Unit tests for DB service
- Integration tests with real Prisma
- Test migration safety
- Test backup/restore

---

#### Task 12: Workflow & Agent Commands (3 hours)
- [ ] Implement `workflows` command
  - `workflows:list` (list all workflows)
  - `workflows:list --status running` (filter)
  - `workflows:get <id>` (get workflow details)
  - `workflows:create --definition app|feature|bugfix` (create)
  - `workflows:cancel <id>` (cancel workflow)
  - `workflows:logs <id> --follow` (stream logs)
- [ ] Implement `agents` command
  - `agents:list` (list agents)
  - `agents:status` (agent health)
  - `agents:status --platform NAME` (by platform)
  - `agents:register <type>` (register new agent)
  - `agents:deregister <id>` (deregister agent)
- [ ] Create api-client.ts
  - HTTP client to Orchestrator API
  - Endpoint wrappers
  - Error handling
  - Retry logic

**Testing:**
- Unit tests for API client
- Mock Orchestrator endpoints
- Test filtering and pagination

---

#### Task 13: Configuration Management (2 hours)
- [ ] Implement `config` command
  - `config:show` (current configuration)
  - `config:set <key> <value>` (set config)
  - `config:get <key>` (get config value)
  - `config:reset` (reset to defaults)
- [ ] Configuration sources (in order)
  1. Command-line flags
  2. Environment variables
  3. .env file
  4. .agentic-sdlc.json (project config)
  5. ~/.agentic-sdlc/config.json (user config)
  6. Hardcoded defaults
- [ ] Create config/ directory
  - defaults.ts (default values)
  - project.ts (project-specific config)

**Testing:**
- Unit tests for config loading
- Test config precedence
- Test .env parsing

---

#### Task 14: Metrics & Monitoring (3 hours)
- [ ] Implement `metrics` command
  - `metrics` (show all metrics)
  - `metrics --service NAME` (service-specific)
  - `metrics --period 1h|24h|7d` (time period)
- [ ] Collect metrics
  - CPU usage
  - Memory usage
  - Response times
  - Error rates
  - Workflow throughput
  - Agent utilization
- [ ] Output formats (text table, JSON, CSV)

**Testing:**
- Unit tests for metric collection
- Integration tests with real services

---

#### Task 15: Advanced Features (3 hours)
- [ ] Error recovery & retry logic
  - Automatic retry on transient failures
  - Exponential backoff
  - Max retry limits
- [ ] Progress indicators
  - Spinner for long operations
  - Progress bar for multi-step operations
  - ETA calculation
- [ ] Interactive mode
  - Prompts for required inputs
  - Confirmation before destructive operations
  - Suggested next steps

**Testing:**
- Unit tests for retry logic
- Integration tests for interactive mode

---

#### Task 16: Build & Deploy Validation (3 hours)
- [ ] Implement `validate:ci` command
  - Check for common issues before commit
  - Lint check
  - Type check
  - Test check
  - Coverage check
  - Build check
  - Security audit
- [ ] Create validation.service.ts
  - Run all pre-commit checks
  - Generate report
  - Exit with appropriate code
- [ ] Support `--local` flag
  - Test deployment locally
  - Validate environment readiness

**Testing:**
- Unit tests for validators
- Integration tests with real build

---

#### Task 17: Documentation & Examples (2 hours)
- [ ] Create comprehensive CLI documentation
  - README.md (quick start, examples)
  - docs/COMMANDS.md (all commands)
  - docs/EXAMPLES.md (common workflows)
  - docs/OUTPUT.md (output format reference)
  - docs/INTEGRATION.md (integration with CI/CD)
- [ ] Add inline code comments
- [ ] Create command examples file

**Testing:**
- Manual verification of docs
- Example execution

---

#### Task 18: Testing & Quality Assurance (4 hours)
- [ ] Write comprehensive tests for Phase 7B
  - Test all commands
  - Test error cases
  - Test output formats
  - Test edge cases
- [ ] Coverage target: 85%+
- [ ] Integration tests
  - Test actual workflows
  - Test with mock services
- [ ] Manual testing checklist
  - All commands work
  - Help system works
  - JSON output valid
  - Error messages clear

**Testing:**
- Run `turbo run test --filter=@agentic-sdlc/cli`
- Coverage 85%+
- Zero TypeScript errors

---

**Phase 7B Summary:**
- **Deliverables:** Test/deploy/db/workflows/agents/config commands
- **Files Created:** ~30 TypeScript files (~3,500 lines)
- **Tests Created:** ~150 test cases
- **Total Hours:** ~35 hours
- **Quality:** 85%+ coverage, 0 TS errors

---

### Phase 7C: Monitoring & Polish (Weeks 5-6, ~25 hours)

#### Task 19: Observability & Monitoring (4 hours)
- [ ] Implement structured logging
  - JSON logging for machine parsing
  - Structured fields (timestamp, level, service, etc.)
  - Log rotation support
- [ ] Add metrics collection
  - Execution time tracking
  - Error rate tracking
  - Resource usage monitoring
- [ ] Create logs dashboard integration
  - Export metrics to file
  - Integration with monitoring tools

**Testing:**
- Unit tests for logging
- Integration tests with real services

---

#### Task 20: Performance Optimization (3 hours)
- [ ] Optimize startup time
  - Lazy load heavy dependencies
  - Parallel initialization
  - Caching for repeated queries
- [ ] Optimize command execution
  - Batch operations where possible
  - Reduce redundant checks
  - Cache health check results
- [ ] Memory optimization
  - Stream large outputs
  - Limit in-memory data structures

**Testing:**
- Performance benchmarks
- Memory profiling
- Startup time measurement

---

#### Task 21: Error Messages & UX (3 hours)
- [ ] Improve error messages
  - Clear, actionable messages
  - Suggestions for common errors
  - Links to documentation
  - Error codes for automation
- [ ] Add helpful hints
  - "Did you mean?" suggestions
  - Common next steps
  - Related commands
- [ ] Better formatting
  - Consistent spacing
  - Color-coded severity
  - Clear visual hierarchy

**Testing:**
- Manual review of all error messages
- User feedback gathering

---

#### Task 22: Production Hardening (4 hours)
- [ ] Add safety checks
  - Confirmation prompts for destructive operations
  - Backup before reset
  - Dry-run mode for dangerous commands
- [ ] Add recovery mechanisms
  - Rollback on failure
  - Cleanup on interrupt (Ctrl+C)
  - Graceful degradation
- [ ] Add security
  - Input sanitization
  - No secrets in logs
  - Secure configuration storage

**Testing:**
- Security review
- Manual testing of safety mechanisms
- Interrupt handling tests

---

#### Task 23: Integration & Automation (3 hours)
- [ ] GitHub Actions integration
  - CLI callable from workflows
  - Status checks for PR gates
  - Deployment validation before merge
- [ ] Git hooks integration
  - Pre-commit validation
  - Pre-push validation
  - Post-merge deployment
- [ ] CI/CD documentation
  - Example workflows
  - Best practices
  - Troubleshooting guide

**Testing:**
- Integration tests with GitHub Actions
- Manual testing of git hooks

---

#### Task 24: Documentation & Training (2 hours)
- [ ] Create comprehensive documentation
  - User guide (getting started)
  - Reference guide (all commands)
  - Example workflows
  - Troubleshooting guide
  - FAQ
- [ ] Create tutorial videos (optional)
- [ ] Create interactive examples
- [ ] Update CLAUDE.md with CLI information

**Testing:**
- Manual verification of docs
- User testing (have others try it)

---

#### Task 25: Final Testing & QA (3 hours)
- [ ] Comprehensive testing
  - All commands tested
  - All workflows tested
  - All error paths tested
  - Edge cases covered
- [ ] Performance verification
  - Startup < 2 minutes
  - Health check < 5 seconds
  - All tests pass
- [ ] Build verification
  - `turbo run build` succeeds
  - `turbo run test` all pass
  - `turbo run typecheck` 0 errors
  - Coverage 85%+

**Testing:**
- Full test suite execution
- Manual acceptance testing
- Performance benchmarks

---

#### Task 26: Backward Compatibility (2 hours)
- [ ] Maintain old shell scripts
  - Mark as deprecated in QUICK_REFERENCE.md
  - Point users to new CLI
  - Keep working for at least 1 version
- [ ] Add CLI wrapper around old scripts (optional)
- [ ] Migration guide for users
  - Old command → new command mapping
  - How to update scripts
  - Deprecation timeline

**Testing:**
- Verify old scripts still work
- Test CLI wrappers if added

---

**Phase 7C Summary:**
- **Deliverables:** Observability, optimization, hardening, documentation
- **Files Created:** ~15 TypeScript files + docs (~2,000 lines)
- **Tests Created:** ~100 test cases
- **Documentation:** ~50 pages
- **Total Hours:** ~25 hours
- **Quality:** 85%+ coverage, 0 TS errors, production-ready

---

## 4. Task Summary Table

| Phase | Tasks | Hours | Deliverables | Priority |
|-------|-------|-------|--------------|----------|
| **7A** | 1-8 | 40 | Core CLI, env commands | CRITICAL |
| **7B** | 9-18 | 35 | Test/deploy/db commands | HIGH |
| **7C** | 19-26 | 25 | Monitoring, polish, docs | MEDIUM |
| **TOTAL** | 26 | **100** | **Unified CLI** | **SHIP** |

---

## 5. Dependencies & Build Order

### 5.1 Package Dependencies

```
@agentic-sdlc/cli depends on:
  ├─ @agentic-sdlc/shared-types (for types)
  ├─ commander (CLI framework)
  ├─ chalk (colors)
  ├─ table (ASCII tables)
  ├─ inquirer (interactive prompts)
  ├─ ora (spinners)
  ├─ node-fetch (HTTP client)
  ├─ node-redis (Redis client)
  ├─ @prisma/client (database client)
  └─ vitest (testing)

Build Order:
1. @agentic-sdlc/shared-types (no deps)
2. @agentic-sdlc/cli (depends on shared-types)
3. All other packages (unchanged)

Turbo Build Command:
$ turbo run build --filter=@agentic-sdlc/cli
$ turbo run test --filter=@agentic-sdlc/cli
```

### 5.2 Internal Dependencies

```
CLI → Orchestrator API (via HTTP)
CLI → PM2 API (via child_process)
CLI → Docker (via child_process)
CLI → Prisma (via @prisma/client)
CLI → Redis (via node-redis)
CLI → Turbo (via child_process)
CLI → Vitest (via child_process)
```

**No circular dependencies** - CLI is purely a consumer layer

---

## 6. Risk Assessment & Mitigation

### 6.1 Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| **PM2 API changes** | Low | Medium | Version lock, API wrapper layer |
| **Docker socket unavailable** | Low | High | Graceful degradation, error message |
| **Database migration fails** | Low | Critical | Backup before migrate, rollback script |
| **Redis connection fails** | Low | Medium | Retry logic, fallback endpoints |
| **Orchestrator API unreachable** | Medium | Medium | Health check first, timeout handling |
| **Performance degradation** | Medium | Medium | Benchmarking, optimization passes |
| **Memory leak in CLI** | Low | Medium | Streaming for large outputs, monitoring |

### 6.2 Operational Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| **Users still use old scripts** | High | Low | Deprecation period, dual support |
| **Breaking changes in deps** | Medium | Medium | Lock dependencies, update strategy |
| **Slow startup times** | Medium | Medium | Profiling, optimization |
| **Complex error messages** | Medium | Low | UX review, testing with users |
| **Missing edge cases** | Medium | Low | Comprehensive testing, user feedback |

### 6.3 Mitigation Strategies

**Code Quality:**
- ✅ 100% test coverage (unit + integration)
- ✅ TypeScript strict mode (0 errors)
- ✅ Linting with ESLint
- ✅ Code review before merge

**Testing:**
- ✅ Unit tests (Vitest)
- ✅ Integration tests (with mocks)
- ✅ Manual acceptance tests
- ✅ Performance benchmarks

**Backwards Compatibility:**
- ✅ Keep old scripts functional
- ✅ Deprecation period (v1.x → v2.0)
- ✅ Migration guide
- ✅ Gradual rollout

**Documentation:**
- ✅ User guide
- ✅ API reference
- ✅ Examples
- ✅ Troubleshooting

---

## 7. Testing Strategy

### 7.1 Unit Tests (Vitest)

**Coverage Target:** 85%+

**Test Files:**
- `commands.test.ts` - All command logic
- `services.test.ts` - All services
- `utils.test.ts` - Utilities
- `integration.test.ts` - Service integration

**Key Test Scenarios:**
- Command parsing
- Option handling
- Output formatting
- Error cases
- Edge cases

**Run Command:**
```bash
pnpm --filter @agentic-sdlc/cli test
```

### 7.2 Integration Tests

**Scenarios:**
- Docker interaction (if available)
- PM2 interaction (if available)
- Orchestrator API (mocked)
- Database operations (mocked)
- Redis operations (mocked)
- File system operations

**Run Command:**
```bash
pnpm --filter @agentic-sdlc/cli test
```

### 7.3 End-to-End Tests

**Scenarios (after full stack running):**
- `agentic-sdlc start` → environment ready
- `agentic-sdlc health` → all checks pass
- `agentic-sdlc status` → correct status
- `agentic-sdlc test --tier 1` → tests pass
- `agentic-sdlc logs` → logs available
- `agentic-sdlc stop` → clean shutdown

**Prerequisites:**
- `./scripts/env/start-dev.sh` (manual)
- All services running
- Database ready

**Run Command:**
```bash
# Manual testing with running environment
./scripts/env/start-dev.sh
agentic-sdlc status --json
./scripts/env/stop-dev.sh
```

### 7.4 Build Validation

**Requirements:**
- `pnpm build` succeeds (no TS errors)
- `pnpm typecheck` passes (strict mode)
- `pnpm lint` no warnings
- `pnpm test` all pass
- Coverage 85%+

---

## 8. Success Metrics

### 8.1 Functional Metrics

- ✅ All 45 scripts consolidated (0 duplicate logic)
- ✅ All commands tested (100% coverage)
- ✅ Backward compatible (old scripts still work)
- ✅ JSON output working (--json flag)
- ✅ Error codes correct (exit codes)

### 8.2 Quality Metrics

- ✅ Test coverage: 85%+
- ✅ TypeScript errors: 0
- ✅ Code duplication: < 5%
- ✅ Cyclomatic complexity: < 10
- ✅ Response time: < 5 seconds

### 8.3 User Experience Metrics

- ✅ Command discoverability: 100% (help works)
- ✅ Error clarity: Users understand what went wrong
- ✅ Time to first command: < 2 minutes
- ✅ Help system: Complete documentation

### 8.4 Production Metrics

- ✅ Uptime: Services stay running
- ✅ Performance: Start < 2 min, health < 5 sec
- ✅ Error recovery: Automatic retry works
- ✅ Deployment: Validation before deploy

---

## 9. Timeline & Milestones

### Phase 7A: Weeks 1-2 (40 hours)
- Week 1:
  - Day 1-2: Project setup (Task 1-2)
  - Day 3-5: Core commands (Task 3-5)
- Week 2:
  - Day 6-8: Status/logs (Task 6-7)
  - Day 9-10: Testing (Task 8)
- **Milestone:** Core CLI working, basic commands functional

### Phase 7B: Weeks 3-4 (35 hours)
- Week 3:
  - Day 11-13: Test/deploy (Task 9-11)
  - Day 14-15: DB/workflows (Task 12)
- Week 4:
  - Day 16-18: Config/metrics (Task 13-14)
  - Day 19-20: Features/validation (Task 15-18)
- **Milestone:** All commands implemented, comprehensive testing

### Phase 7C: Weeks 5-6 (25 hours)
- Week 5:
  - Day 21-23: Monitoring/optimization (Task 19-20)
  - Day 24-25: Error handling/docs (Task 21-22)
- Week 6:
  - Day 26: Integration/final (Task 23-26)
- **Milestone:** Production-ready, fully documented

**Total Timeline:** 6 weeks (1 FTE) or 12 weeks (0.5 FTE)

---

## 10. Success Criteria & Acceptance

### 10.1 Acceptance Tests

**Before shipping Phase 7:**

```bash
# 1. Build succeeds
pnpm build
# Expected: 0 errors, warnings only if non-critical

# 2. Tests pass
pnpm test
# Expected: All tests pass, 85%+ coverage

# 3. TypeScript strict
pnpm typecheck
# Expected: 0 errors

# 4. Basic commands work
agentic-sdlc start
agentic-sdlc status
agentic-sdlc health
agentic-sdlc stop
# Expected: All complete successfully

# 5. JSON output
agentic-sdlc status --json | jq .
# Expected: Valid JSON output

# 6. Help system
agentic-sdlc help
agentic-sdlc start --help
# Expected: Clear, helpful output

# 7. Error handling
agentic-sdlc invalid-command
# Expected: Clear error, helpful suggestion

# 8. All 41 tests still pass
agentic-sdlc test --tier 1
# Expected: All tier 1 tests pass
```

### 10.2 Definition of Done

- ✅ Code complete (all tasks done)
- ✅ Tests passing (100% of unit tests)
- ✅ Coverage adequate (85%+)
- ✅ No TypeScript errors (strict mode)
- ✅ Documentation complete (README, examples, API docs)
- ✅ Manual testing done (all commands tested)
- ✅ Code reviewed (peer review)
- ✅ Build validated (turbo build succeeds)
- ✅ Performance verified (< 2 min startup)
- ✅ Backward compatible (old scripts still work)

---

## 11. Post-Implementation (Phase 7 Follow-up)

### 11.1 Immediate Actions (Week 7)

- [ ] User feedback collection
- [ ] Bug fix sprint (if any issues found)
- [ ] Performance tuning (if needed)
- [ ] Documentation refinement (based on feedback)

### 11.2 Future Enhancements (Phase 8+)

- [ ] Kubernetes integration (Phase 8)
- [ ] Multi-cloud support (Phase 9)
- [ ] Advanced monitoring dashboard (Phase 9)
- [ ] Slack/Pagerduty alerts (Phase 10)
- [ ] Cost optimization (Phase 10)

---

## 12. Rollout Plan

### 12.1 Development Phase
- [ ] Develop in feature branch
- [ ] Continuous testing
- [ ] Daily CI/CD validation

### 12.2 Beta Phase
- [ ] Internal testing with team
- [ ] Feedback collection
- [ ] Bug fixes and refinements

### 12.3 Release Phase
- [ ] Version 1.0.0 release
- [ ] Documentation finalization
- [ ] User communication
- [ ] Deprecation notice for old scripts

### 12.4 Sunset Phase
- [ ] Keep old scripts for 2-3 releases (backward compat)
- [ ] Point users to new CLI
- [ ] Remove old scripts in v2.0.0 (breaking change)

---

## Conclusion

This plan provides a clear path to build a unified **Command Center CLI** that consolidates 45+ scattered shell scripts into a single, cohesive interface. The phased approach ensures:

- ✅ **Quality:** 85%+ coverage, strict TypeScript
- ✅ **Functionality:** All existing features preserved
- ✅ **Usability:** Easy for developers and AI agents
- ✅ **Reliability:** Comprehensive testing and error handling
- ✅ **Documentation:** Complete user guides and examples

**Status:** Ready for CODE phase implementation

**Next:** EPCC_CODE_PHASE7_PROGRESS.md (during implementation)

---

**Plan Created:** 2025-11-16 | **Ready to Code**
