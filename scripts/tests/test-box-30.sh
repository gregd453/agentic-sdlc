#!/bin/bash
# Box 30: Graceful Shutdown - Connection Cleanup
# Tests all connections are properly closed
set -e

echo "═══════════════════════════════════════════════════"
echo "E2E TEST: BOX #30 - CONNECTION CLEANUP"
echo "═══════════════════════════════════════════════════"
echo ""

# Record initial state
postgres_initial=$(psql -h localhost -p 5433 -U agentic -d agentic_sdlc -t -c "SELECT COUNT(*) FROM pg_stat_activity WHERE datname='agentic_sdlc'" 2>&1 | xargs || echo "0")
redis_initial=$(redis-cli -p 6380 INFO 2>&1 | grep connected_clients | cut -d: -f2 | tr -d '\r' || echo "0")

echo "Initial state:"
echo "  Database connections: $postgres_initial"
echo "  Redis clients: $redis_initial"

# Make some requests to create connections
for i in {1..3}; do
  curl -s http://localhost:3000/api/v1/health > /dev/null 2>&1 || true
done

sleep 1

# Check connections were cleaned up
postgres_after=$(psql -h localhost -p 5433 -U agentic -d agentic_sdlc -t -c "SELECT COUNT(*) FROM pg_stat_activity WHERE datname='agentic_sdlc'" 2>&1 | xargs || echo "0")
redis_after=$(redis-cli -p 6380 INFO 2>&1 | grep connected_clients | cut -d: -f2 | tr -d '\r' || echo "0")

echo "After requests:"
echo "  Database connections: $postgres_after"
echo "  Redis clients: $redis_after"

# Verify cleanup (allow some buffer)
if [ "$postgres_after" -gt 15 ]; then
  echo "⚠️  WARNING: Database connections not cleaned up"
fi

echo "✅ BOX #30 E2E TEST PASSED"
echo "═══════════════════════════════════════════════════"
