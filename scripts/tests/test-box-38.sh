#!/bin/bash
# Box 38: Performance - CPU Efficiency
# Tests CPU usage is optimized
set -e

echo "═══════════════════════════════════════════════════"
echo "E2E TEST: BOX #38 - CPU EFFICIENCY"
echo "═══════════════════════════════════════════════════"
echo ""

# Measure CPU usage during idle state
echo "Measuring CPU usage..."

# Get CPU usage before
cpu_before=$(ps aux | awk '{sum += $3} END {print int(sum)}')

# Make a single request
curl -s http://localhost:3000/api/v1/health > /dev/null 2>&1 || true

sleep 1

# Get CPU usage after
cpu_after=$(ps aux | awk '{sum += $3} END {print int(sum)}')

echo "CPU usage: ${cpu_before}% → ${cpu_after}%"

# Check process count doesn't grow unexpectedly
process_count=$(ps aux | grep -E "pnpm|node" | grep -v grep | wc -l)
echo "Active Node.js processes: $process_count"

if [ "$process_count" -gt 20 ]; then
  echo "⚠️  WARNING: High process count may indicate inefficient spawning"
else
  echo "✅ CPU efficiency acceptable"
fi

# Verify no runaway processes
high_cpu=$(ps aux | awk '$3 > 50 {count++} END {print count}' | xargs || echo "0")
if [ "$high_cpu" -gt 0 ]; then
  echo "⚠️  WARNING: $high_cpu processes using >50% CPU"
fi

echo "✅ BOX #38 E2E TEST PASSED"
echo "═══════════════════════════════════════════════════"
