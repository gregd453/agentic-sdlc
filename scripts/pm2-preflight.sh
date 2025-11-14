#!/usr/bin/env bash
#
# PM2 Preflight Check
#
# Ensures all build artifacts exist before PM2 attempts to start processes.
# PM2 runs compiled JavaScript from dist/ directories, not source TypeScript.
#
# Usage:
#   ./scripts/pm2-preflight.sh
#
# Exit codes:
#   0 - All artifacts present
#   1 - Missing artifacts (run pnpm build)

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "🔍 PM2 Preflight Check - Validating build artifacts..."
echo ""

# Track failures
MISSING_ARTIFACTS=0

# Check orchestrator build
echo "Checking orchestrator..."
if [ ! -f "$PROJECT_ROOT/packages/orchestrator/dist/server.js" ]; then
  echo "  ❌ Missing: packages/orchestrator/dist/server.js"
  MISSING_ARTIFACTS=1
else
  echo "  ✅ packages/orchestrator/dist/server.js"
fi

# Check agent builds
# Note: Some agents use run-agent.js, others use index.js as entry point
AGENTS_WITH_RUN_AGENT=("scaffold-agent" "validation-agent" "e2e-agent")
AGENTS_WITH_INDEX=("integration-agent" "deployment-agent")

for agent in "${AGENTS_WITH_RUN_AGENT[@]}"; do
  echo "Checking $agent..."
  if [ ! -f "$PROJECT_ROOT/packages/agents/$agent/dist/run-agent.js" ]; then
    echo "  ❌ Missing: packages/agents/$agent/dist/run-agent.js"
    MISSING_ARTIFACTS=1
  else
    echo "  ✅ packages/agents/$agent/dist/run-agent.js"
  fi
done

for agent in "${AGENTS_WITH_INDEX[@]}"; do
  echo "Checking $agent..."
  if [ ! -f "$PROJECT_ROOT/packages/agents/$agent/dist/index.js" ]; then
    echo "  ❌ Missing: packages/agents/$agent/dist/index.js"
    MISSING_ARTIFACTS=1
  else
    echo "  ✅ packages/agents/$agent/dist/index.js"
  fi
done

echo ""

# Final verdict
if [ $MISSING_ARTIFACTS -eq 1 ]; then
  echo "❌ PM2 Preflight Failed - Missing build artifacts"
  echo ""
  echo "Run the following command to build all packages:"
  echo "  pnpm build"
  echo ""
  exit 1
fi

echo "✅ PM2 Preflight Passed - All build artifacts present"
exit 0
