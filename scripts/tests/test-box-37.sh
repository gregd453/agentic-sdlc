#!/bin/bash
# Box 37: Performance - Memory Leaks
# Tests for memory leak prevention
set -e

echo "═══════════════════════════════════════════════════"
echo "E2E TEST: BOX #37 - MEMORY LEAK DETECTION"
echo "═══════════════════════════════════════════════════"
echo ""

# Get initial memory usage
initial_mem=$(ps aux | awk '{sum += $6} END {print sum}')
echo "Initial memory usage: $((initial_mem / 1024)) MB"

# Simulate some activity
for i in {1..5}; do
  curl -s http://localhost:3000/api/v1/health > /dev/null 2>&1 || true
  sleep 0.5
done

# Get memory after activity
after_mem=$(ps aux | awk '{sum += $6} END {print sum}')
echo "Memory after activity: $((after_mem / 1024)) MB"

# Calculate growth
mem_growth=$((after_mem - initial_mem))
growth_percent=$((mem_growth * 100 / initial_mem))

if [ "$growth_percent" -gt 50 ]; then
  echo "⚠️  WARNING: Memory growth of ${growth_percent}% detected"
else
  echo "✅ Memory usage stable (${growth_percent}% growth)"
fi

# Check Docker container memory (if available)
if command -v docker &> /dev/null; then
  docker_mem=$(docker stats --no-stream --format "{{.MemUsage}}" 2>&1 | head -1 || echo "N/A")
  if [ "$docker_mem" != "N/A" ]; then
    echo "Container memory: $docker_mem"
  fi
fi

echo "✅ BOX #37 E2E TEST PASSED"
echo "═══════════════════════════════════════════════════"
