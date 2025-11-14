#!/bin/bash
# Debug script to inspect Redis Stream messages
# Shows what agents are actually receiving

set -euo pipefail

REDIS_PORT="${REDIS_PORT:-6380}"
STREAM_KEY="${1:-stream:agent:scaffold:tasks}"
COUNT="${2:-5}"

echo "========================================="
echo "Redis Stream Debugger"
echo "========================================="
echo "Stream: $STREAM_KEY"
echo "Port: $REDIS_PORT"
echo "Count: $COUNT"
echo "========================================="
echo ""

# Read last N messages from stream
echo "📊 Last $COUNT messages:"
echo ""

docker exec -it agentic-redis-1 redis-cli -p "$REDIS_PORT" \
  XREVRANGE "$STREAM_KEY" + - COUNT "$COUNT" | \
  awk '
    BEGIN { msg_num = 1 }
    /^[0-9]+-[0-9]+$/ {
      print "\n=== Message " msg_num " ==="
      print "ID:", $0
      msg_num++
      next
    }
    /^topic$/ { getline; print "Topic:", $0; next }
    /^payload$/ {
      getline
      print "\nPayload:"
      # Pretty print JSON (basic)
      print $0 | "python3 -m json.tool"
      close("python3 -m json.tool")
      next
    }
    { print }
  '

echo ""
echo "========================================="
echo "Stream Info:"
echo "========================================="

docker exec -it agentic-redis-1 redis-cli -p "$REDIS_PORT" \
  XINFO STREAM "$STREAM_KEY" | \
  grep -E "(length|first-entry|last-entry)" || echo "Stream info unavailable"

echo ""
echo "========================================="
echo "Consumer Groups:"
echo "========================================="

docker exec -it agentic-redis-1 redis-cli -p "$REDIS_PORT" \
  XINFO GROUPS "$STREAM_KEY" 2>/dev/null || echo "No consumer groups"

echo ""
