#!/bin/bash
# Box #2: Code Freeze
# Initiates a code freeze lock for the test run

set -e

FREEZE_TIME=$(date '+%Y-%m-%d %H:%M:%S')
FREEZE_FILE=".code-freeze-lock"
FREEZE_LOG="logs/code-freeze-$(date +%Y%m%d-%H%M%S).log"

# Create logs directory if it doesn't exist
mkdir -p logs

# Create freeze lock file
{
    echo "CODE FREEZE INITIATED"
    echo "═══════════════════════════════════════════════════"
    echo "Time: $FREEZE_TIME"
    echo "User: $(whoami)"
    echo "Hostname: $(hostname)"
    echo "Branch: $(git rev-parse --abbrev-ref HEAD)"
    echo "Commit: $(git rev-parse HEAD)"
    echo ""
    echo "Status: LOCKED - No new changes permitted"
    echo ""
    echo "═══════════════════════════════════════════════════"
} | tee "$FREEZE_FILE"

# Also log to the logs directory
cp "$FREEZE_FILE" "$FREEZE_LOG"

echo ""
echo "🔒 Code Freeze Lock Created"
echo "   Lock file: $FREEZE_FILE"
echo "   Log file: $FREEZE_LOG"
echo ""

# Display freeze info
cat "$FREEZE_FILE"
