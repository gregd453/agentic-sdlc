# Scripts & Node.js Processes Review
**Date:** 2025-11-08
**Project:** Agentic SDLC
**Review Status:** ✅ Good / ⚠️ Needs Improvement / ❌ Critical

---

## Executive Summary

**Overall Score: 8.5/10** - The project follows most best practices with some areas for improvement.

**Strengths:**
- ✅ Comprehensive error handling in shell scripts
- ✅ Good use of colors and user feedback
- ✅ Proper graceful shutdown handling in Node.js
- ✅ Well-structured package.json scripts
- ✅ Good separation of concerns

**Areas for Improvement:**
- ⚠️ Missing `set -o pipefail` in some scripts
- ⚠️ Some scripts lack trap cleanup
- ⚠️ Node.js processes missing uncaught exception handlers
- ⚠️ CLI tools lack --version flag
- ⚠️ Missing process monitoring/restart strategy

---

## 1. Shell Scripts Review

### 1.1 `/scripts/start.sh` - Basic Startup Script
**Status:** ✅ Good | **Score: 7/10**

**✅ Strengths:**
- Uses `set -e` for error handling
- Checks for Docker availability
- Creates `.env` from example if missing
- Good user feedback with emojis
- Waits for services to be ready

**⚠️ Issues:**
```bash
# Missing:
set -o pipefail  # ⚠️ Pipeline errors not caught
set -u           # ⚠️ Undefined variables not caught

# Line 26: Fixed sleep is unreliable
sleep 5  # ❌ Should use wait_for_service function

# Line 41: Suppressed errors
pnpm exec prisma migrate deploy || true  # ⚠️ Silent failure
```

**✏️ Recommendations:**
```bash
#!/bin/bash
set -euo pipefail  # Add missing flags

# Replace fixed sleep with proper wait
wait_for_postgres() {
    local max_attempts=30
    local attempt=1
    while [ $attempt -le $max_attempts ]; do
        if docker exec agentic-sdlc-postgres pg_isready -q; then
            return 0
        fi
        sleep 1
        attempt=$((attempt + 1))
    done
    return 1
}

# Don't suppress errors silently
pnpm exec prisma migrate deploy || {
    echo "Migration failed - this may be expected on first run"
    return 0
}
```

---

### 1.2 `/start.sh` - Comprehensive Startup Script
**Status:** ✅ Excellent | **Score: 9/10**

**✅ Strengths:**
- Excellent error handling with `set -e`
- Comprehensive prerequisite checks
- Good use of functions for organization
- Colored output with timestamps
- Interactive prompts for optional steps
- Proper trap for cleanup
- Version checks for dependencies

**⚠️ Minor Issues:**
```bash
# Line 195: nc may not be available on all systems
if nc -z localhost $port 2>/dev/null; then
    # ⚠️ Use platform-independent alternative
fi

# Line 129: alias in script won't persist
alias docker-compose="docker compose"  # ❌ Won't work as expected
```

**✏️ Recommendations:**
```bash
# Better port check that works everywhere
wait_for_port() {
    local port=$1
    local max_attempts=$2

    timeout $max_attempts bash -c "
        until (echo > /dev/tcp/localhost/$port) 2>/dev/null; do
            sleep 1
        done
    "
}

# Set function instead of alias
docker-compose() {
    docker compose "$@"
}
export -f docker-compose
```

---

### 1.3 `/stop.sh` - Shutdown Script
**Status:** ✅ Good | **Score: 8/10**

**✅ Strengths:**
- Proper error handling
- Interactive confirmation for destructive operations
- Graceful process killing
- Clear status messages

**⚠️ Issues:**
```bash
# Line 34: pkill may kill unrelated processes
pkill -f "tsx watch src/index.ts" 2>/dev/null || true
# ⚠️ Too broad, could kill other tsx processes

# Missing: No PID file management
# Missing: No verification that processes stopped
```

**✏️ Recommendations:**
```bash
# Better process management
PID_FILE=".orchestrator.pid"

stop_orchestrator() {
    if [ -f "$PID_FILE" ]; then
        local pid=$(cat "$PID_FILE")
        if ps -p $pid > /dev/null 2>&1; then
            echo "Stopping orchestrator (PID: $pid)..."
            kill $pid

            # Wait for graceful shutdown
            local timeout=30
            while [ $timeout -gt 0 ] && ps -p $pid > /dev/null 2>&1; do
                sleep 1
                timeout=$((timeout - 1))
            done

            # Force kill if still running
            if ps -p $pid > /dev/null 2>&1; then
                echo "Force killing..."
                kill -9 $pid
            fi
        fi
        rm -f "$PID_FILE"
    fi
}
```

---

### 1.4 `/scripts/backlog-manager.sh` - Task Management CLI
**Status:** ✅ Excellent | **Score: 9.5/10**

**✅ Strengths:**
- Comprehensive help system
- Excellent error handling
- Good use of jq for JSON parsing
- Color-coded output
- Input validation
- Git integration
- Confirmation prompts for important actions

**⚠️ Very Minor Issues:**
```bash
# Line 216: Git branch creation could fail silently
git checkout -b "$branch_name" 2>/dev/null || git checkout "$branch_name"
# ⚠️ Should log the failure

# Missing: No check if jq is installed
```

**✏️ Recommendations:**
```bash
# Check for required tools at startup
check_requirements() {
    local missing=()

    command -v jq >/dev/null 2>&1 || missing+=("jq")
    command -v curl >/dev/null 2>&1 || missing+=("curl")

    if [ ${#missing[@]} -gt 0 ]; then
        echo "Missing required tools: ${missing[*]}"
        echo "Install with: brew install ${missing[*]}"  # or apt-get
        exit 1
    fi
}

check_requirements
```

---

### 1.5 `/scripts/setup-anthropic.sh` - API Key Setup
**Status:** ✅ Excellent | **Score: 9/10**

**✅ Strengths:**
- Secure input with `read -s`
- API key format validation
- Optional testing
- Good error messages
- Interactive and user-friendly

**⚠️ Minor Issues:**
```bash
# Line 63: sed -i works differently on macOS and Linux
sed -i.bak "s/^ANTHROPIC_API_KEY=.*/ANTHROPIC_API_KEY=$api_key/" .env
# ⚠️ Creates .bak file not cleaned up

# Line 80-126: Inline JavaScript could be external file
```

**✏️ Recommendations:**
```bash
# Cross-platform sed
if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '.bak' "s/^ANTHROPIC_API_KEY=.*/ANTHROPIC_API_KEY=$api_key/" .env
else
    sed -i.bak "s/^ANTHROPIC_API_KEY=.*/ANTHROPIC_API_KEY=$api_key/" .env
fi
rm -f .env.bak  # Clean up

# Move test script to separate file
./scripts/test-anthropic.js
```

---

## 2. Node.js Server Review

### 2.1 `/packages/orchestrator/src/server.ts`
**Status:** ⚠️ Needs Improvement | **Score: 7/10**

**✅ Strengths:**
- Good service initialization
- Proper dependency injection
- Swagger/OpenAPI documentation
- CORS configuration
- Trust proxy configuration
- Clean separation of concerns

**❌ Critical Issues:**
```typescript
// Missing: No uncaught exception handler
process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception:', error);
    // Graceful shutdown
    process.exit(1);
});

// Missing: No unhandled rejection handler
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled rejection:', { reason, promise });
    process.exit(1);
});

// Missing: No graceful shutdown
process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down gracefully');
    await fastify.close();
    await prisma.$disconnect();
    await eventBus.disconnect();
    process.exit(0);
});
```

**✏️ Recommendations:**
```typescript
// Add to server.ts or index.ts
export async function createServer() {
    const fastify = Fastify({...});

    // ... existing setup ...

    // Add graceful shutdown
    const signals = ['SIGTERM', 'SIGINT'] as const;
    signals.forEach(signal => {
        process.on(signal, async () => {
            logger.info(`${signal} received, shutting down gracefully`);

            try {
                await fastify.close();
                logger.info('Fastify closed');

                await prisma.$disconnect();
                logger.info('Database disconnected');

                await eventBus.disconnect();
                logger.info('Event bus disconnected');

                process.exit(0);
            } catch (error) {
                logger.error('Error during shutdown:', error);
                process.exit(1);
            }
        });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
        logger.error('Uncaught exception:', error);
        process.exit(1);
    });

    process.on('unhandledRejection', (reason) => {
        logger.error('Unhandled rejection:', reason);
        process.exit(1);
    });

    return fastify;
}
```

---

### 2.2 Base Agent Framework
**Status:** ✅ Good | **Score: 8/10**

**✅ Strengths:**
- Proper Redis cleanup in cleanup() method
- Error handling with retry logic
- Structured logging
- Abstract base class pattern

**⚠️ Issues:**
```typescript
// Missing: Process signal handling in standalone agents
// Missing: Heartbeat/keep-alive mechanism
// Missing: Circuit breaker for external services
```

**✏️ Recommendations:**
```typescript
// Add to BaseAgent
protected setupSignalHandlers(): void {
    const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];

    signals.forEach(signal => {
        process.on(signal, async () => {
            this.logger.info(`${signal} received, cleaning up...`);
            await this.cleanup();
            process.exit(0);
        });
    });
}

// Add heartbeat
private startHeartbeat(): void {
    setInterval(async () => {
        await this.redisPublisher.set(
            `agent:${this.agentId}:heartbeat`,
            Date.now().toString(),
            'EX',
            30
        );
    }, 10000);  // Every 10 seconds
}
```

---

## 3. CLI Tools Review

### 3.1 `/ops/agentic/cli/index.ts`
**Status:** ⚠️ Needs Improvement | **Score: 7/10**

**✅ Strengths:**
- Good help documentation
- Proper exit codes
- Error handling with try/catch
- Clear command structure

**❌ Missing Features:**
```typescript
// Missing: --version flag
// Missing: --quiet flag
// Missing: --verbose flag
// Missing: --json output mode
// Missing: Configuration file support
// Missing: Better argument parsing (use commander or yargs)
```

**✏️ Recommendations:**
```typescript
import { program } from 'commander';

program
    .name('cc-agentic')
    .description('Agentic SDLC CLI - Decision & Clarification System')
    .version('1.0.0')
    .option('-q, --quiet', 'Suppress output')
    .option('-v, --verbose', 'Verbose output')
    .option('--json', 'Output as JSON');

program
    .command('decisions')
    .description('Decision evaluation and management')
    .command('evaluate')
    .requiredOption('--workflow-id <id>', 'Workflow ID')
    .requiredOption('--item-id <id>', 'Item ID')
    .option('--category <cat>', 'Decision category')
    .action(async (options) => {
        // Handle command
    });

// Support config file
const configPath = path.join(os.homedir(), '.cc-agentic.json');
if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    // Merge config with CLI args
}
```

---

## 4. Package.json Scripts Review

### 4.1 Root `package.json`
**Status:** ✅ Good | **Score: 8/10**

**✅ Strengths:**
- Standard scripts (dev, build, test)
- Coverage scripts
- Monorepo-aware with turbo and pnpm
- Clean script for removing artifacts

**⚠️ Issues:**
```json
{
  "scripts": {
    "dev": "pnpm run --parallel dev",  // ⚠️ No way to run single service
    "clean": "turbo run clean && rm -rf node_modules"  // ❌ Not cross-platform
  }
}
```

**✏️ Recommendations:**
```json
{
  "scripts": {
    "dev": "pnpm run --parallel dev",
    "dev:orchestrator": "pnpm --filter @agentic-sdlc/orchestrator dev",
    "dev:agents": "pnpm --filter '@agentic-sdlc/*-agent' dev",
    "clean": "turbo run clean && rimraf node_modules",
    "clean:deep": "turbo run clean && rimraf node_modules **/*.tsbuildinfo",
    "preinstall": "npx only-allow pnpm",
    "prepare": "husky install",
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  }
}
```

---

### 4.2 Orchestrator `package.json`
**Status:** ✅ Good | **Score: 8/10**

**✅ Strengths:**
- Separation of dev and prod scripts
- Database management scripts
- Test coverage scripts

**⚠️ Missing:**
```json
{
  "scripts": {
    // Missing: Production start with PM2
    "start:prod": "pm2 start ecosystem.config.js",

    // Missing: Health check script
    "healthcheck": "node scripts/healthcheck.js",

    // Missing: Database backup
    "db:backup": "node scripts/db-backup.js",

    // Missing: Seed script
    "db:seed": "prisma db seed"
  }
}
```

---

## 5. Critical Recommendations

### 5.1 HIGH PRIORITY

1. **Add Process Signal Handlers**
```typescript
// packages/orchestrator/src/index.ts
import { createServer } from './server';

async function start() {
    const server = await createServer();

    const port = parseInt(process.env.PORT || '3000');
    await server.listen({ port, host: '0.0.0.0' });

    // ✅ Add graceful shutdown
    const shutdown = async (signal: string) => {
        console.log(`${signal} received, shutting down gracefully`);
        await server.close();
        process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('uncaughtException', (error) => {
        console.error('Uncaught exception:', error);
        process.exit(1);
    });
    process.on('unhandledRejection', (error) => {
        console.error('Unhandled rejection:', error);
        process.exit(1);
    });
}

start().catch(console.error);
```

2. **Add PID File Management**
```bash
# start.sh
PID_FILE=".orchestrator.pid"

# Store PID when starting
pnpm orchestrator:dev &
echo $! > "$PID_FILE"

# stop.sh - use PID file
if [ -f "$PID_FILE" ]; then
    kill $(cat "$PID_FILE")
    rm "$PID_FILE"
fi
```

3. **Add Health Check Endpoint Verification**
```bash
# start.sh - after starting orchestrator
echo "Waiting for orchestrator to be healthy..."
for i in {1..30}; do
    if curl -sf http://localhost:3000/api/v1/health > /dev/null; then
        echo "✅ Orchestrator is healthy"
        break
    fi
    sleep 2
done
```

### 5.2 MEDIUM PRIORITY

4. **Add .nvmrc for Node version**
```bash
# .nvmrc
20.11.0
```

5. **Add PM2 Ecosystem File**
```javascript
// ecosystem.config.js
module.exports = {
    apps: [{
        name: 'agentic-orchestrator',
        script: './packages/orchestrator/dist/index.js',
        instances: 'max',
        exec_mode: 'cluster',
        env: {
            NODE_ENV: 'production',
            PORT: 3000
        },
        error_file: './logs/err.log',
        out_file: './logs/out.log',
        log_date_format: 'YYYY-MM-DD HH:mm:ss',
        autorestart: true,
        max_restarts: 10,
        min_uptime: '10s'
    }]
};
```

6. **Add Pre-commit Hooks**
```json
// package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged",
      "commit-msg": "commitlint -E HUSKY_GIT_PARAMS"
    }
  },
  "lint-staged": {
    "*.ts": ["eslint --fix", "prettier --write"],
    "*.{json,md}": ["prettier --write"]
  }
}
```

### 5.3 LOW PRIORITY

7. **Add Script to Check System Requirements**
```bash
#!/bin/bash
# scripts/check-requirements.sh

check_version() {
    local tool=$1
    local min_version=$2
    local current=$3

    if [ "$(printf '%s\n' "$min_version" "$current" | sort -V | head -n1)" = "$min_version" ]; then
        echo "✅ $tool: $current (>= $min_version)"
    else
        echo "❌ $tool: $current (need >= $min_version)"
        return 1
    fi
}

# Check Node.js
NODE_VERSION=$(node -v | sed 's/v//')
check_version "Node.js" "20.0.0" "$NODE_VERSION"

# Check pnpm
PNPM_VERSION=$(pnpm -v)
check_version "pnpm" "8.0.0" "$PNPM_VERSION"

# ... more checks
```

---

## 6. Security Audit

### 6.1 Environment Variables
**Status:** ⚠️ Needs Improvement

**Issues:**
- API keys printed to console (first 10 chars)
- No validation of .env file permissions
- No secrets management integration

**Recommendations:**
```bash
# Check .env permissions
if [ -f .env ]; then
    perms=$(stat -c '%a' .env 2>/dev/null || stat -f '%A' .env)
    if [ "$perms" != "600" ]; then
        echo "⚠️  .env file has insecure permissions: $perms"
        echo "Setting to 600..."
        chmod 600 .env
    fi
fi

# Never log API keys
# ❌ echo "API key: ${key:0:10}..."
# ✅ echo "API key: sk-***...${key: -4}"
```

### 6.2 Docker Security
**Status:** ⚠️ Review Needed

```yaml
# docker-compose.yml - Add security options
services:
  postgres:
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    cap_add:
      - CHOWN
      - SETGID
      - SETUID
```

---

## 7. Testing & CI/CD

### 7.1 Missing Test Scripts
```json
{
  "scripts": {
    "test:unit": "vitest run --coverage src/**/*.test.ts",
    "test:integration": "vitest run tests/integration",
    "test:e2e": "playwright test",
    "test:watch": "vitest",
    "test:ci": "vitest run --reporter=junit --outputFile=test-results.xml"
  }
}
```

### 7.2 Add GitHub Actions / CI Configuration
```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test
```

---

## 8. Final Checklist Status

| Category | Status | Score | Priority Fixes |
|----------|--------|-------|----------------|
| Shell Scripts | ✅ Good | 8.5/10 | Add pipefail, better wait functions |
| Node.js Server | ⚠️ Needs Work | 7/10 | Signal handlers, error handlers |
| CLI Tools | ⚠️ Needs Work | 7/10 | Add --version, use commander |
| Package Scripts | ✅ Good | 8/10 | Cross-platform, add PM2 |
| Error Handling | ⚠️ Needs Work | 7/10 | Uncaught exceptions |
| Security | ⚠️ Needs Review | 7/10 | .env permissions, secrets |
| Testing | ✅ Good | 8.5/10 | Add CI scripts |
| Documentation | ✅ Excellent | 9/10 | - |

---

## 9. Action Items (Prioritized)

### 🔴 Critical (Do First)
1. ✅ Create CLI-NODE-CHECKLIST.md (DONE)
2. Add signal handlers to Node.js processes
3. Add uncaught exception/rejection handlers
4. Fix .env file permissions check

### 🟡 High Priority (This Week)
5. Add PID file management to scripts
6. Add --version to CLI tools
7. Use commander.js for better argument parsing
8. Add PM2 ecosystem configuration
9. Add health check verification to startup

### 🟢 Medium Priority (This Month)
10. Add pre-commit hooks with husky
11. Create system requirements checker
12. Add .nvmrc file
13. Improve cross-platform compatibility
14. Add integration tests

### 🔵 Low Priority (Nice to Have)
15. Add Dockerfile best practices (multi-stage, non-root)
16. Add monitoring/observability (Prometheus, Grafana)
17. Add automated security scanning
18. Create deployment playbooks

---

## 10. Conclusion

The Agentic SDLC project demonstrates solid engineering practices with room for improvement in process management and error handling. The shell scripts are well-crafted with good user experience, while the Node.js processes need additional robustness for production deployment.

**Recommended Next Steps:**
1. Implement critical signal handlers
2. Add process monitoring strategy
3. Enhance CLI tools with standard flags
4. Set up CI/CD pipeline
5. Conduct security audit

**Overall Assessment:** The codebase is production-ready after addressing the critical items above. 🚀
