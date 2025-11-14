#!/bin/bash
# Rollback Script for Nuclear Cleanup Option A
# Session #64 - Created: 2025-11-14
#
# This script rolls back changes from the Nuclear Cleanup implementation
# if something goes wrong during execution.
#
# USAGE:
#   ./scripts/rollback-cleanup.sh

set -e

echo "🔄 Nuclear Cleanup Rollback Script"
echo "===================================="
echo ""

# Get current branch
CURRENT_BRANCH=$(git branch --show-current)

if [ "$CURRENT_BRANCH" != "fix/nuclear-cleanup-option-a" ]; then
    echo "⚠️  Warning: You are not on the fix/nuclear-cleanup-option-a branch"
    echo "   Current branch: $CURRENT_BRANCH"
    read -p "   Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Rollback cancelled"
        exit 1
    fi
fi

echo "📋 Rollback Plan:"
echo "  1. Stop all PM2 services"
echo "  2. Checkout main branch"
echo "  3. Delete feature branch"
echo "  4. Rebuild all packages"
echo "  5. Restart services"
echo ""

read -p "Proceed with rollback? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Rollback cancelled"
    exit 1
fi

echo ""
echo "Step 1: Stopping PM2 services..."
pnpm pm2:stop || true

echo ""
echo "Step 2: Checking out main branch..."
git checkout main

echo ""
echo "Step 3: Deleting feature branch..."
git branch -D fix/nuclear-cleanup-option-a || echo "⚠️  Branch already deleted"

echo ""
echo "Step 4: Rebuilding packages..."
pnpm build

echo ""
echo "Step 5: Restarting services..."
./scripts/env/start-dev.sh

echo ""
echo "✅ Rollback complete!"
echo ""
echo "📊 Verification:"
echo "  - Check PM2 status: pnpm pm2:status"
echo "  - Check logs: pnpm pm2:logs"
echo "  - Run test workflow: ./scripts/run-pipeline-test.sh \"Rollback Test\""
echo ""
