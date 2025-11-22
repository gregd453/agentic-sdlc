-- Migration: Convert agent_type from enum to String
-- Date: 2025-11-22
-- Session: Surface Architecture V3 - Phase 1
-- Purpose: Enable unbounded agent extensibility (Session #85)

BEGIN;

-- 1. Alter AgentTask.agent_type column (preserve existing data)
ALTER TABLE "AgentTask"
  ALTER COLUMN "agent_type" TYPE TEXT
  USING agent_type::TEXT;

-- 2. Alter Agent.type column (preserve existing data)
ALTER TABLE "Agent"
  ALTER COLUMN "type" TYPE TEXT
  USING type::TEXT;

-- 3. Drop the enum (no longer referenced by any columns)
DROP TYPE IF EXISTS "AgentType";

-- 4. Recreate indexes (they were dropped when column type changed)
CREATE INDEX IF NOT EXISTS "Agent_type_idx" ON "Agent"("type");
CREATE INDEX IF NOT EXISTS "AgentTask_agent_type_idx" ON "AgentTask"("agent_type");

-- 5. Verify data integrity (basic check - actual verification in tests)
DO $$
BEGIN
  -- Check that all agent_type values are non-null
  IF EXISTS (SELECT 1 FROM "AgentTask" WHERE agent_type IS NULL) THEN
    RAISE EXCEPTION 'AgentTask has NULL agent_type values after migration';
  END IF;

  IF EXISTS (SELECT 1 FROM "Agent" WHERE type IS NULL) THEN
    RAISE EXCEPTION 'Agent has NULL type values after migration';
  END IF;

  RAISE NOTICE 'Migration completed successfully - all data preserved';
END $$;

COMMIT;
