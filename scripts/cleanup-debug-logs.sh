#!/bin/bash
# Script to remove DEBUG console.log statements from TypeScript files
# Part of Phase 6: Documentation & Polish

echo "🧹 Cleaning DEBUG console.log statements..."

# Files with DEBUG statements
FILES=(
  "packages/orchestrator/src/services/workflow.service.ts"
  "packages/orchestrator/src/state-machine/workflow-state-machine.ts"
  "packages/orchestrator/src/hexagonal/adapters/redis-bus.adapter.ts"
)

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "  Cleaning $file"

    # Create backup
    cp "$file" "$file.backup"

    # Remove lines containing [DEBUG
    # This preserves surrounding code and only removes the console.log lines
    grep -v "console\.log.*\[DEBUG" "$file.backup" > "$file"

    echo "    ✓ Removed DEBUG statements from $file"
    echo "    Backup saved to $file.backup"
  else
    echo "    ⚠️  File not found: $file"
  fi
done

echo ""
echo "✅ Cleanup complete!"
echo ""
echo "Next steps:"
echo "1. Review changes: git diff"
echo "2. Run linter: turbo run lint --filter=@agentic-sdlc/orchestrator"
echo "3. Run build: turbo run build --filter=@agentic-sdlc/orchestrator"
echo "4. If satisfied, remove backups: find . -name '*.backup' -delete"
echo "5. Commit changes: git add . && git commit -m 'chore: remove DEBUG console.log statements'"
