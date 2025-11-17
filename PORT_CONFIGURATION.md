# Port Configuration Guide

## Overview

All services in the Agentic SDLC platform now **require explicit port configuration** through environment variables. **No default ports are provided** - services will fail immediately if required port environment variables are not set. This ensures clarity and prevents unexpected behavior.

---

## ⚠️ Key Changes

### Before (Old Behavior)
```typescript
// Before - Had defaults
const port = parseInt(process.env.ORCHESTRATOR_PORT || '3000', 10);
```

### After (New Behavior)
```typescript
// After - No defaults, must be explicitly set
if (!process.env.ORCHESTRATOR_PORT) {
  console.error('❌ ERROR: ORCHESTRATOR_PORT environment variable is not set');
  console.error('Set ORCHESTRATOR_PORT in your environment or .env file');
  process.exit(1);
}
```

---

## 📋 Required Ports

### Development Environment (.env.development)

| Service | Port Var | Required | Default Value | Purpose |
|---------|----------|----------|---------------|---------|
| **Dashboard** | `VITE_DASHBOARD_PORT` | ✅ Yes | 3050 | React dev server & web UI |
| **Orchestrator** | `ORCHESTRATOR_PORT` | ✅ Yes | 3051 | Main API & workflow engine |
| **Analytics** | `ANALYTICS_SERVICE_PORT` | ✅ Yes | 3001 | Metrics & analytics API |
| **Redis Host** | `REDIS_HOST` | ✅ Yes | localhost | Redis server hostname |
| **Redis Port** | `REDIS_PORT` | ✅ Yes | 6380 | Redis server port |

### Docker Environment (.env.docker)

| Service | Port Var | Required | Docker Value | Purpose |
|---------|----------|----------|--------------|---------|
| **Dashboard** | `VITE_DASHBOARD_PORT` | ✅ Yes | 3050 | React dev server & web UI |
| **Orchestrator** | `ORCHESTRATOR_PORT` | ✅ Yes | 3000 | Main API & workflow engine |
| **Analytics** | `ANALYTICS_SERVICE_PORT` | ✅ Yes | 3001 | Metrics & analytics API |
| **Redis Host** | `REDIS_HOST` | ✅ Yes | redis | Docker service name |
| **Redis Port** | `REDIS_PORT` | ✅ Yes | 6379 | Redis port inside Docker |

---

## 🚀 Getting Started

### 1. Development Setup

Copy the environment template and fill in required values:

```bash
# Copy the example file
cp .env.example .env.development

# Verify these are set:
cat .env.development | grep -E "ORCHESTRATOR_PORT|VITE_DASHBOARD_PORT|ANALYTICS_SERVICE_PORT|REDIS"
```

### 2. Starting Services

All these must be set or services will fail:

```bash
# Make sure .env.development is loaded
export $(cat .env.development | grep -v '#' | xargs)

# Start all services
./dev start

# If a service fails, check error message for missing env var
```

### 3. Docker Setup

For Docker deployments, use .env.docker:

```bash
# Load Docker environment
export $(cat .env.docker | grep -v '#' | xargs)

# Or use docker-compose (it reads .env file)
docker-compose up
```

---

## ❌ Error Messages & Solutions

### Error: ORCHESTRATOR_PORT not set

```
❌ ERROR: ORCHESTRATOR_PORT environment variable is not set

Usage:
  export ORCHESTRATOR_PORT=3051
  npm start

Or in .env file:
  ORCHESTRATOR_PORT=3051
```

**Solution:**
```bash
# Option 1: Set in environment
export ORCHESTRATOR_PORT=3051
npm start

# Option 2: Add to .env file
echo "ORCHESTRATOR_PORT=3051" >> .env.development
npm start
```

### Error: VITE_DASHBOARD_PORT not set

```
❌ ERROR: VITE_DASHBOARD_PORT environment variable is not set
```

**Solution:**
```bash
export VITE_DASHBOARD_PORT=3050
npm run dev --workspace=dashboard
```

### Error: REDIS_PORT invalid (not a number)

```
❌ ERROR: REDIS_PORT must be a valid port number (1-65535), got: invalid
```

**Solution:**
```bash
# Make sure REDIS_PORT is a valid number
export REDIS_PORT=6380  # ✅ Valid
# NOT: REDIS_PORT=abc   # ❌ Invalid
```

---

## 📍 Services & Configuration Files

### Dashboard (`packages/dashboard/vite.config.ts`)
- **Variables:** `VITE_DASHBOARD_PORT`, `VITE_HOST`
- **Validation:** Checks for missing port, validates 1-65535 range
- **Fails:** During `npm run dev` if port not set
- **Example:** `VITE_DASHBOARD_PORT=3050`

### Orchestrator (`packages/orchestrator/src/server.ts`)
- **Variables:** `ORCHESTRATOR_PORT`, `HOST`
- **Validation:** Checks for missing port, validates 1-65535 range
- **Fails:** During startup if port not set
- **Example:** `ORCHESTRATOR_PORT=3051`

### Analytics Service (`packages/analytics-service/src/index.ts`)
- **Variables:** `ANALYTICS_SERVICE_PORT`, `HOST`
- **Validation:** Checks for missing port, validates 1-65535 range
- **Fails:** During startup if port not set
- **Example:** `ANALYTICS_SERVICE_PORT=3001`

### Base Agent (`packages/agents/base-agent/src/base-agent.ts`)
- **Variables:** `REDIS_HOST`, `REDIS_PORT`
- **Validation:** Checks for missing values, validates port 1-65535
- **Fails:** During initialization if Redis config not set
- **Example:** `REDIS_HOST=localhost REDIS_PORT=6380`

---

## ✅ Validation Behavior

All services now validate ports with these rules:

1. **Environment variable must exist** - No defaults provided
2. **Port must be numeric** - `parseInt()` is applied
3. **Port must be in valid range** - 1-65535 inclusive
4. **Clear error messages** - Shows exactly what's missing

Example validation flow:
```typescript
const portEnv = process.env.ORCHESTRATOR_PORT;

// Check 1: Variable exists
if (!portEnv) {
  console.error('❌ ERROR: ORCHESTRATOR_PORT environment variable is not set');
  process.exit(1);
}

// Check 2: Valid port number
const port = parseInt(portEnv, 10);
if (isNaN(port) || port < 1 || port > 65535) {
  console.error(`❌ ERROR: ORCHESTRATOR_PORT must be 1-65535, got: ${portEnv}`);
  process.exit(1);
}
```

---

## 📊 Port Mapping Summary

### Local Development
```
Dashboard         → localhost:3050
Orchestrator      → localhost:3051
Analytics         → localhost:3001
PostgreSQL        → localhost:5433
Redis             → localhost:6380
```

### Docker
```
Dashboard         → localhost:3050 (external) → 3050 (internal)
Orchestrator      → localhost:3000 (external) → 3000 (internal)
Analytics         → localhost:3002 (external) → 3001 (internal)
PostgreSQL        → localhost:5433 (external) → 5432 (internal)
Redis             → localhost:6380 (external) → 6379 (internal)
```

---

## 🔍 Debugging Tips

### Check if ports are configured
```bash
# Show all port configuration variables
env | grep -E "PORT|HOST" | sort

# Or from .env file
grep -E "PORT|HOST" .env.development
```

### Check if a port is in use
```bash
# macOS/Linux
lsof -i :3050  # Check if port 3050 is in use

# Windows
netstat -ano | findstr :3050
```

### Validate environment before starting
```bash
# Create validation script
cat > validate-env.sh << 'EOF'
#!/bin/bash
REQUIRED=("ORCHESTRATOR_PORT" "VITE_DASHBOARD_PORT" "ANALYTICS_SERVICE_PORT" "REDIS_PORT" "REDIS_HOST")
for var in "${REQUIRED[@]}"; do
  if [ -z "${!var}" ]; then
    echo "❌ Missing: $var"
  else
    echo "✅ Set: $var=${!var}"
  fi
done
EOF

chmod +x validate-env.sh
./validate-env.sh
```

---

## 🚨 Migration Guide (If Upgrading)

If you previously had .env files without port configuration:

1. **Update your .env file:**
   ```bash
   # Add these lines if not present
   ORCHESTRATOR_PORT=3051
   VITE_DASHBOARD_PORT=3050
   ANALYTICS_SERVICE_PORT=3001
   REDIS_HOST=localhost
   REDIS_PORT=6380
   ```

2. **Remove any hardcoded ports:**
   - No more `PORT || 3000` fallbacks
   - Services will now fail loudly if config missing

3. **Test all services start correctly:**
   ```bash
   npm run build
   ./dev start
   ```

---

## 📚 Related Documentation

- **CLAUDE.md** - Overall architecture and quick start
- **.env.example** - Template with all available variables
- **.env.development** - Development configuration
- **.env.docker** - Docker container configuration
- **AGENTIC_SDLC_RUNBOOK.md** - Operational guide

---

## ❓ FAQ

**Q: Why remove default ports?**
A: Explicit configuration prevents unexpected behavior. Services fail fast with clear error messages instead of silently using wrong ports.

**Q: Can I use custom ports?**
A: Yes! Set any valid port number (1-65535) in your environment variables.

**Q: What if I forget to set a port?**
A: The service will exit immediately with a clear error message showing what's missing and how to fix it.

**Q: Do I need to set all ports?**
A: Only the services you're running need their ports set. If you're not using Analytics, you don't strictly need `ANALYTICS_SERVICE_PORT`, but it's recommended to set all in your env file.

**Q: How do I run multiple instances?**
A: Use different ports for each instance. Each must have its own environment with unique port values.
