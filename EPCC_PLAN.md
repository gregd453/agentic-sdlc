# Implementation Plan: Surface Architecture V3 - Multi-Platform Orchestration

**Version:** 1.0.0
**Date:** 2025-11-21
**Status:** Ready for Execution
**Reference Documents:**
- docs/SURFACE-ARCH-V3.md
- docs/SURFACE-ARCH-V3-REVIEW.md

---

## Executive Summary

### What We're Building

A complete **multi-platform orchestration layer** that enables the agentic SDLC platform to support unlimited platform types (web apps, data pipelines, infrastructure) with:

- **Definition-driven workflows** - YAML/JSON workflow templates instead of hard-coded stages
- **Platform-scoped agents** - Custom agents per platform (ml-training, data-validation, etc.)
- **Surface binding enforcement** - Security layer controlling which surfaces trigger which platforms
- **Dashboard management** - Visual tools for creating/managing workflow definitions

### Why It's Needed

**Current Limitations:**
1. ❌ Hard-coded workflow stages (scaffold → validation → e2e → deployment)
2. ❌ AgentType enum restriction (only 8 predefined agent types)
3. ❌ No security enforcement for surface-to-platform bindings
4. ❌ Manual workflow definition management

**Business Value:**
- ✅ Unlimited platform types (expand beyond web apps to data pipelines, infrastructure, ML workflows)
- ✅ Custom agent types (ml-training, data-validation, compliance-checker, etc.)
- ✅ Flexible workflow sequencing (different platforms have different stages)
- ✅ Enhanced security (control which surfaces can trigger platforms)
- ✅ Improved UX (visual workflow builders in dashboard)

### Success Criteria

#### Phase 1 (Critical Fixes)
- [ ] Prisma migration converts AgentType enum to String
- [ ] TypeScript builds with 0 errors after migration
- [ ] Can create workflow with custom agent_type (e.g., "ml-training")
- [ ] AgentRegistry validates custom agent types with typo suggestions

#### Phase 2 (Workflow Definition Services)
- [ ] Can create workflow definition via API with 5+ stages
- [ ] Can update/delete workflow definitions
- [ ] Validation rejects circular dependencies
- [ ] Validation rejects invalid agent types

#### Phase 3 (Workflow Engine Integration)
- [ ] Execute workflow with custom definition (not hard-coded)
- [ ] Progress calculation adapts to stage count (3 stages = 33%, 66%, 100%)
- [ ] on_success routing works (stage1 → stage3, skipping stage2)
- [ ] on_failure='skip' allows workflow to continue past failures

#### Phase 4 (Surface Binding Enforcement)
- [ ] REST request to platform without REST surface binding fails with clear error
- [ ] Enabling surface binding allows workflow creation
- [ ] Disabled surfaces reject requests

#### Phase 5 (Dashboard Components)
- [ ] Create workflow definition in UI (form-based builder)
- [ ] Edit existing workflow definition
- [ ] Agent type dropdown shows only platform-scoped agents
- [ ] Surface config persists to database

#### Phase 6 (Documentation & Polish)
- [ ] WORKFLOW_DEFINITION_GUIDE.md created with examples
- [ ] YAML/JSON templates provided
- [ ] All DEBUG console.log statements removed
- [ ] JSDoc comments added to new services

### Non-Goals (What We're NOT Doing)

- ❌ Drag-and-drop workflow builder (Phase 5 uses forms initially)
- ❌ SurfaceMapping table (proposed for future enhancement)
- ❌ Advanced trace tree visualization (optional polish)
- ❌ File-based log rotation (optional enhancement)
- ❌ Pipeline pause/resume persistence (requires separate migration)

---

## Technical Approach

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ SURFACE LAYER (5 surfaces: REST, Webhook, CLI, Dashboard, Mobile)│
│  → SurfaceRouterService.routeRequest()                          │
│     ↓ Query PlatformSurface (NEW: Phase 4)                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ PLATFORM ORCHESTRATION LAYER                                     │
│  → WorkflowService.createWorkflow()                             │
│     ↓ Accept surface_context (NEW: Phase 3)                     │
│  → WorkflowDefinitionAdapter.getNextStageWithFallback()         │
│     ↓ Load definition from database (ENHANCE: Phase 2)          │
│  → WorkflowEngine.getNextStage(stageName, outcome)              │
│     ↓ Use definition.stages[] (ENHANCE: Phase 3)                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ AGENT LAYER (Unbounded agent types)                             │
│  → AgentRegistry.validateAgentExists(agent_type, platform_id)   │
│     ↓ Accept ANY string (FIX: Phase 1 - remove enum)            │
│  → BaseAgent subclasses execute tasks                           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ DATABASE LAYER (PostgreSQL + Prisma)                            │
│  → Platform, WorkflowDefinition, PlatformSurface tables         │
│  → AgentTask.agent_type: String (FIX: Phase 1)                  │
│  → Agent.type: String (FIX: Phase 1)                            │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

**1. Surface Request → Platform Workflow:**
```
User/System → Surface (REST/Webhook/CLI/etc.)
    ↓ SurfaceRequest
SurfaceRouterService.routeRequest()
    ↓ Query PlatformSurface (validate enabled)
    ↓ SurfaceContext (surface_id, surface_type, platform_id, metadata)
WorkflowService.createWorkflow(request, createdBy, surface_context)
    ↓ Query WorkflowDefinition (platform_id + name)
    ↓ Create Workflow record in DB
    ↓ Publish to Redis Streams
Agents subscribe and execute tasks
```

**2. Workflow Execution (Definition-Driven):**
```
WorkflowStateMachineService.transitionToNextStage()
    ↓
WorkflowDefinitionAdapter.getNextStageWithFallback(context)
    ↓ Load definition from DB
    ↓ PlatformAwareWorkflowEngine.getNextStage(currentStage, outcome)
    ↓ WorkflowEngine.getNextStage() uses definition.stages[].on_success
    ↓ Return next stage name or 'END'
WorkflowService.createTaskForStage()
    ↓ Validate agent exists (AgentRegistry)
    ↓ Create AgentTask in DB
    ↓ Publish AgentEnvelope to Redis
```

### Design Decisions

| Decision | Option Chosen | Rationale |
|----------|--------------|-----------|
| **Agent Type Validation** | String (unbounded) | Allows custom platforms to define custom agent types (ml-training, etc.) without core schema changes |
| **Workflow Definition Storage** | JSON in database | Flexible schema evolution without migrations; supports complex stage graphs |
| **Surface Binding** | PlatformSurface table | Explicit security control; platform owners choose which surfaces to enable |
| **Definition Loading** | Database-first with fallback | Backward compatible with legacy hard-coded workflows |
| **Progress Calculation** | Adaptive (completed_stages / total_stages) | Works with variable stage counts (3 stages ≠ 6 stages) |
| **Migration Strategy** | Phased rollout | Minimize risk; validate each phase before proceeding |

---

## Phase-by-Phase Task Breakdown

### Phase 1: Critical Fixes (BLOCKING - Week 1)

**Priority:** P0 (Must complete before Phase 2+)
**Estimated Time:** 5 hours
**Package:** `@agentic-sdlc/orchestrator`
**Layer:** Database + Type System

#### Tasks

**1.1 Create Prisma Migration for AgentType Enum → String**
- **ID:** P1-T1
- **Description:** Create migration script to convert AgentType columns
- **Package:** `@agentic-sdlc/orchestrator`
- **Files:**
  - `packages/orchestrator/prisma/schema.prisma` (MODIFY)
  - `packages/orchestrator/prisma/migrations/YYYYMMDD_agent_type_string/migration.sql` (NEW)
- **Steps:**
  1. Update schema.prisma:
     - Line 76: `agent_type AgentType` → `agent_type String`
     - Line 147: `type AgentType` → `type String`
     - Lines 197-206: Add `@deprecated` comment to enum
  2. Run `pnpm prisma migrate dev --name agent_type_enum_to_string`
  3. Verify migration SQL includes:
     - ALTER COLUMN agent_type TYPE TEXT USING agent_type::TEXT
     - ALTER COLUMN type TYPE TEXT USING type::TEXT
     - DROP TYPE IF EXISTS "AgentType"
  4. Review migration for data safety
- **Testing:**
  - SQL migration runs without errors
  - Existing AgentTask/Agent records preserved
  - pnpm prisma generate succeeds
- **Estimate:** 1.5 hours
- **Dependencies:** None
- **Risk:** Medium (database schema change)

**1.2 Update TypeScript Types**
- **ID:** P1-T2
- **Description:** Remove AgentType enum references in TypeScript
- **Package:** `@agentic-sdlc/orchestrator`
- **Files:**
  - `packages/orchestrator/src/types/index.ts` (MODIFY)
  - `packages/orchestrator/src/services/workflow.service.ts` (MODIFY)
  - Any files using AgentType enum imports
- **Steps:**
  1. Search codebase for `AgentType` enum usage: `grep -r "AgentType" --include="*.ts"`
  2. Replace enum references with `string` type
  3. Update Zod schemas to use `z.string().min(1)` for agent_type
  4. Run `turbo run typecheck` to verify 0 errors
- **Testing:**
  - `turbo run typecheck` passes
  - `turbo run build --filter=@agentic-sdlc/orchestrator` succeeds
- **Estimate:** 1 hour
- **Dependencies:** P1-T1 (migration must complete first)
- **Risk:** Low

**1.3 Run Migration in Development Environment**
- **ID:** P1-T3
- **Description:** Execute Prisma migration in local environment
- **Package:** `@agentic-sdlc/orchestrator`
- **Steps:**
  1. Backup current database: `pg_dump -h localhost -p 5433 -U agentic agentic_sdlc > backup.sql`
  2. Run migration: `cd packages/orchestrator && pnpm prisma migrate deploy`
  3. Verify schema updated: `pnpm prisma db pull` (should match schema.prisma)
  4. Regenerate Prisma client: `pnpm prisma generate`
- **Testing:**
  - Query AgentTask table: `SELECT agent_type FROM "AgentTask" LIMIT 1` (should be text)
  - Query Agent table: `SELECT type FROM "Agent" LIMIT 1` (should be text)
- **Estimate:** 0.5 hours
- **Dependencies:** P1-T1, P1-T2
- **Risk:** Medium (production-like operation)

**1.4 Validate Agent Registry with Custom Types**
- **ID:** P1-T4
- **Description:** Test AgentRegistry accepts custom agent_type strings
- **Package:** `@agentic-sdlc/shared-agent-registry`
- **Files:**
  - `packages/shared/agent-registry/src/__tests__/agent-registry.test.ts` (NEW test cases)
- **Steps:**
  1. Create test workflow with agent_type: "ml-training"
  2. Verify AgentRegistry.validateAgentExists() accepts string
  3. Test typo detection (ml-trainng → Did you mean ml-training?)
  4. Test platform-scoped lookup (agent exists on platform A but not B)
- **Testing:**
  - Unit tests pass
  - Create workflow via API with custom agent_type succeeds
  - Invalid agent_type returns helpful error message
- **Estimate:** 2 hours
- **Dependencies:** P1-T1, P1-T2, P1-T3
- **Risk:** Low

#### Phase 1 Validation Checklist
- [ ] `turbo run typecheck` → 0 errors
- [ ] `turbo run build --filter=@agentic-sdlc/orchestrator` → succeeds
- [ ] Database query `SELECT agent_type FROM "AgentTask" LIMIT 1` → returns text type
- [ ] Create workflow with `agent_type: "ml-training"` via API → succeeds
- [ ] Create workflow with `agent_type: "nonexistent-agent"` → fails with suggestions

---

### Phase 2: Workflow Definition Services (Week 2)

**Priority:** P1 (High - enables definition-driven workflows)
**Estimated Time:** 16 hours
**Package:** `@agentic-sdlc/orchestrator`
**Layer:** Services + API Routes

#### Tasks

**2.1 Audit WorkflowDefinitionAdapter Service**
- **ID:** P2-T1
- **Description:** Review existing service and add missing CRUD methods
- **Package:** `@agentic-sdlc/orchestrator`
- **Files:**
  - `packages/orchestrator/src/services/workflow-definition-adapter.service.ts` (MODIFY)
- **Existing Methods (verified):**
  - ✅ getNextStageWithFallback() - lines 39-78
  - ✅ getProgressWithFallback() - lines 121-143
  - ✅ validateWorkflowDefinition() - lines 148-182
  - ✅ getNextStageLegacy() - lines 83-116
- **Methods to Add:**
  ```typescript
  async getPlatformDefinitions(platform_id: string): Promise<WorkflowDefinition[]>
  async createDefinition(platform_id: string, request: CreateWorkflowDefinitionRequest): Promise<WorkflowDefinition>
  async updateDefinition(definition_id: string, request: UpdateWorkflowDefinitionRequest): Promise<WorkflowDefinition>
  async deleteDefinition(definition_id: string): Promise<void>
  async getDefinitionByName(platform_id: string, name: string): Promise<WorkflowDefinition | null>
  ```
- **Testing:**
  - Unit tests for each new method
  - Mock Prisma client
  - Test unique constraint violations
- **Estimate:** 8 hours
- **Dependencies:** Phase 1 complete
- **Risk:** Medium (service already exists, lower risk than building from scratch)

**2.2 Create Workflow Definition API Routes**
- **ID:** P2-T2
- **Description:** Add REST endpoints for definition CRUD
- **Package:** `@agentic-sdlc/orchestrator`
- **Files:**
  - `packages/orchestrator/src/api/routes/platform.routes.ts` (MODIFY - add endpoints)
  - `packages/orchestrator/src/types/index.ts` (MODIFY - add schemas)
- **Endpoints to Add:**
  ```typescript
  GET    /api/v1/platforms/:platformId/definitions          // List definitions
  POST   /api/v1/platforms/:platformId/definitions          // Create definition
  GET    /api/v1/platforms/:platformId/definitions/:defId   // Get single definition
  PUT    /api/v1/platforms/:platformId/definitions/:defId   // Update definition
  DELETE /api/v1/platforms/:platformId/definitions/:defId   // Delete definition
  ```
- **Zod Schemas:**
  ```typescript
  CreateWorkflowDefinitionSchema (name, version, description, definition, enabled)
  UpdateWorkflowDefinitionSchema (partial update)
  WorkflowDefinitionResponseSchema
  WorkflowDefinitionsListSchema
  ```
- **Testing:**
  - Integration tests with Fastify test client
  - Test 400 (validation errors), 404 (not found), 201 (created), 200 (updated), 204 (deleted)
- **Estimate:** 4 hours
- **Dependencies:** P2-T1
- **Risk:** Low (standard CRUD routes)

**2.3 Create WorkflowDefinitionSpec Type & Validation**
- **ID:** P2-T3
- **Description:** Define TypeScript types for workflow definitions
- **Package:** `@agentic-sdlc/shared-types`
- **Files:**
  - `packages/shared/types/src/workflow-definition.ts` (NEW)
- **Types to Create:**
  ```typescript
  StageDefinitionSchema (name, agent_type, timeout_ms, max_retries, on_success, on_failure, config)
  WorkflowDefinitionSpecSchema (name, version, stages[], metadata)
  ```
- **Validation Rules:**
  - Stage names must be unique
  - on_success references must exist in stages[] or be 'END'
  - No circular dependencies (topological sort)
  - All agent_type values must be non-empty strings
- **Testing:**
  - Unit tests for schema validation
  - Test circular dependency detection
  - Test invalid on_success references
- **Estimate:** 4 hours
- **Dependencies:** None (can be done in parallel with P2-T1)
- **Risk:** Low

#### Phase 2 Validation Checklist
- [ ] Create definition with 5 stages via API → 201 Created
- [ ] Create definition with duplicate name → 409 Conflict
- [ ] Create definition with circular dependencies → 400 Bad Request with error details
- [ ] Create definition with invalid agent_type → 400 Bad Request
- [ ] Update definition → 200 OK with updated data
- [ ] Delete definition → 204 No Content
- [ ] List definitions for platform → 200 OK with array

---

### Phase 3: Workflow Engine Integration (Week 3)

**Priority:** P1 (High - executes definition-driven workflows)
**Estimated Time:** 24 hours
**Package:** `@agentic-sdlc/shared-workflow-engine`, `@agentic-sdlc/orchestrator`
**Layer:** Services + Core

#### Tasks

**3.1 Enhance WorkflowEngine with Missing Methods**
- **ID:** P3-T1
- **Description:** Add calculateProgress() and validateExecution() to WorkflowEngine
- **Package:** `@agentic-sdlc/shared-workflow-engine`
- **Files:**
  - `packages/shared/workflow-engine/src/workflow-engine.ts` (MODIFY)
- **Note:** `getNextStage(stageName, outcome)` already exists (line 104) - doc misunderstood this as "missing"
- **Methods to Add:**
  ```typescript
  calculateProgress(completed_stages: string[]): number {
    // Adaptive: (completed / total) * 100
    // Example: 3 completed out of 5 total = 60%
  }

  async validateExecution(platform_id: string, agentRegistry: IAgentRegistry): Promise<{ valid: boolean; errors: string[] }> {
    // Validate all agent_types in stages[] exist in AgentRegistry
    // Return helpful errors if agents missing
  }
  ```
- **Testing:**
  - Unit tests for calculateProgress (3/5 stages = 60%, 6/6 stages = 100%)
  - Unit tests for validateExecution with mock AgentRegistry
  - Test error messages for missing agents
- **Estimate:** 8 hours
- **Dependencies:** Phase 2 complete (need WorkflowDefinitionSpec types)
- **Risk:** Low (adding to existing well-structured service)

**3.2 Integrate AgentRegistry Validation in WorkflowService**
- **ID:** P3-T2
- **Description:** Validate agent exists BEFORE creating task
- **Package:** `@agentic-sdlc/orchestrator`
- **Files:**
  - `packages/orchestrator/src/services/workflow.service.ts` (MODIFY)
- **Current Issue (from SURFACE-ARCH-V3.md:195-201):**
  - validateAgentExists() happens AFTER task creation
  - Should happen BEFORE to prevent orphaned tasks
- **Fix:**
  ```typescript
  async createTaskForStage(workflow: Workflow, stage: string, agentType: string) {
    // NEW: Validate agent exists FIRST
    const validation = await this.agentRegistry.validateAgentExists(agentType, workflow.platform_id)
    if (!validation.exists) {
      // Update workflow to 'failed' status
      await this.updateWorkflowStatus(workflow.id, 'failed')
      // Publish WORKFLOW_FAILED event
      await this.messageBus.publish('workflow:failed', {...})
      throw new Error(`Agent ${agentType} not found. ${validation.suggestion || ''}`)
    }

    // THEN create task
    const task = await this.prisma.agentTask.create({...})
  }
  ```
- **Testing:**
  - Integration test: create workflow with invalid agent_type → fails immediately, no orphaned task
  - Integration test: create workflow with valid agent_type → succeeds
- **Estimate:** 4 hours
- **Dependencies:** P3-T1
- **Risk:** Medium (critical path in workflow execution)

**3.3 Update WorkflowService to Accept surface_context**
- **ID:** P3-T3
- **Description:** Add surface_context parameter to createWorkflow() and buildAgentEnvelope()
- **Package:** `@agentic-sdlc/orchestrator`
- **Files:**
  - `packages/orchestrator/src/services/workflow.service.ts` (MODIFY)
- **Changes:**
  ```typescript
  // Update method signature
  async createWorkflow(
    request: CreateWorkflowRequest,
    createdBy: string,
    surface_context?: SurfaceContext  // NEW optional parameter
  ): Promise<Workflow>

  // Update buildAgentEnvelope to include surface metadata
  private buildAgentEnvelope(
    workflow: Workflow,
    task: AgentTask,
    agentType: string,
    payload: Record<string, unknown>,
    surface_context?: SurfaceContext  // NEW optional parameter
  ): AgentEnvelope {
    const envelope = { /* existing envelope */ }

    // Add surface metadata if present
    if (surface_context) {
      envelope.metadata = {
        ...envelope.metadata,
        surface_id: surface_context.surface_id,
        surface_type: surface_context.surface_type,
        entry_metadata: surface_context.entry_metadata
      }
    }

    return envelope
  }
  ```
- **Testing:**
  - Unit test: createWorkflow with surface_context → envelope includes surface metadata
  - Unit test: createWorkflow without surface_context → backward compatible
- **Estimate:** 3 hours
- **Dependencies:** None (can be done in parallel)
- **Risk:** Low (backward compatible change)

**3.4 Update WorkflowStateMachineService to Use Definition Adapter**
- **ID:** P3-T4
- **Description:** Ensure state machine uses WorkflowDefinitionAdapter for stage transitions
- **Package:** `@agentic-sdlc/orchestrator`
- **Files:**
  - `packages/orchestrator/src/services/workflow-state-machine.service.ts` (MODIFY)
- **Changes:**
  ```typescript
  async transitionToNextStage(workflow: Workflow, current_stage_result: 'success' | 'failure') {
    // Use WorkflowDefinitionAdapter instead of hard-coded logic
    const transition = await this.workflowDefinitionAdapter.getNextStageWithFallback({
      workflow_id: workflow.id,
      platform_id: workflow.platform_id,
      workflow_definition_id: workflow.workflow_definition_id,
      current_stage: workflow.current_stage,
      stage_result: current_stage_result
    })

    // Update workflow with next stage
    if (transition.next_stage === 'END') {
      await this.completeWorkflow(workflow.id)
    } else {
      await this.updateWorkflowStage(workflow.id, transition.next_stage)
    }
  }
  ```
- **Testing:**
  - Integration test: workflow with custom definition follows on_success routing
  - Integration test: workflow with on_failure='skip' skips failed stage
  - Integration test: legacy workflow (no definition) uses fallback
- **Estimate:** 6 hours
- **Dependencies:** P3-T1, P3-T2
- **Risk:** Medium (core workflow execution logic)

**3.5 End-to-End Integration Tests**
- **ID:** P3-T5
- **Description:** Test complete workflow lifecycle with custom definitions
- **Package:** `@agentic-sdlc/orchestrator`
- **Files:**
  - `packages/orchestrator/src/__tests__/integration/workflow-definition.integration.test.ts` (NEW)
- **Test Scenarios:**
  1. Create platform with 2 workflow definitions (3 stages, 5 stages)
  2. Execute both workflows in parallel
  3. Verify independent progress tracking (3/3 = 100%, 3/5 = 60%)
  4. Verify stage sequencing per definition
  5. Verify on_success routing (stage1 → stage3, skipping stage2)
  6. Verify on_failure='skip' allows continuation
  7. Verify legacy workflow fallback still works
- **Estimate:** 3 hours
- **Dependencies:** P3-T1, P3-T2, P3-T3, P3-T4
- **Risk:** Low (validates all prior work)

#### Phase 3 Validation Checklist
- [ ] Execute workflow with custom 3-stage definition → completes with 100% progress
- [ ] Execute workflow with custom 5-stage definition → progress adapts (20%, 40%, 60%, 80%, 100%)
- [ ] on_success routing works (stage1.on_success='stage3' skips stage2)
- [ ] on_failure='skip' allows workflow to continue past failed stage
- [ ] Parallel workflows on different platforms don't interfere
- [ ] Legacy workflows (no definition) still work via fallback
- [ ] Agent validation blocks workflow creation if agent doesn't exist

---

### Phase 4: Surface Binding Enforcement (Week 4)

**Priority:** P2 (Medium - security and validation)
**Estimated Time:** 8 hours
**Package:** `@agentic-sdlc/orchestrator`
**Layer:** Services + API Routes

#### Tasks

**4.1 Add PlatformSurface Validation in SurfaceRouterService**
- **ID:** P4-T1
- **Description:** Query PlatformSurface table to enforce bindings
- **Package:** `@agentic-sdlc/orchestrator`
- **Files:**
  - `packages/orchestrator/src/services/surface-router.service.ts` (MODIFY)
- **Current Issue (from SURFACE-ARCH-V3-REVIEW.md:234-271):**
  - routeRequest() doesn't query PlatformSurface table
  - No enforcement of surface bindings
  - Security gap: any surface can trigger any platform
- **Fix:**
  ```typescript
  async routeRequest(request: SurfaceRequest): Promise<SurfaceContext> {
    // Existing validation
    const validation = this.validateSurfaceRequest(request)
    if (!validation.valid) {
      throw new Error(`Surface validation failed: ${validation.errors.join(', ')}`)
    }

    // NEW: Validate surface binding if platform_id provided
    if (request.platform_id) {
      const platformSurface = await this.prisma.platformSurface.findUnique({
        where: {
          platform_id_surface_type: {
            platform_id: request.platform_id,
            surface_type: request.surface_type
          }
        }
      })

      if (!platformSurface) {
        throw new Error(
          `Surface ${request.surface_type} not configured for platform ${request.platform_id}. ` +
          `Enable this surface in platform settings.`
        )
      }

      if (!platformSurface.enabled) {
        throw new Error(
          `Surface ${request.surface_type} is disabled for platform ${request.platform_id}.`
        )
      }
    }

    // Continue with existing routing logic
    switch (request.surface_type) {
      case 'REST': return await this.routeRestSurface(request, validation.normalized_payload!)
      // ... rest
    }
  }
  ```
- **Testing:**
  - Integration test: REST request to platform without REST surface → 403 Forbidden
  - Integration test: Enable REST surface → workflow creation succeeds
  - Integration test: Disable surface → workflow creation fails
  - Integration test: Request without platform_id → backward compatible (no validation)
- **Estimate:** 3 hours
- **Dependencies:** None
- **Risk:** Medium (security-critical change)

**4.2 Create Surface Management API Routes**
- **ID:** P4-T2
- **Description:** Add endpoints to manage platform surface bindings
- **Package:** `@agentic-sdlc/orchestrator`
- **Files:**
  - `packages/orchestrator/src/api/routes/platform.routes.ts` (MODIFY)
- **Endpoints to Add:**
  ```typescript
  GET    /api/v1/platforms/:platformId/surfaces              // List enabled surfaces
  POST   /api/v1/platforms/:platformId/surfaces              // Enable surface
  PUT    /api/v1/platforms/:platformId/surfaces/:surfaceType // Update surface config
  DELETE /api/v1/platforms/:platformId/surfaces/:surfaceType // Disable surface
  ```
- **Schemas:**
  ```typescript
  PlatformSurfaceConfigSchema (surface_type, config, enabled)
  PlatformSurfacesListSchema (array of surfaces)
  ```
- **Testing:**
  - Integration test: Enable REST surface → creates PlatformSurface record
  - Integration test: Update surface config → updates JSON config
  - Integration test: Disable surface → sets enabled=false
  - Integration test: List surfaces → returns enabled surfaces
- **Estimate:** 3 hours
- **Dependencies:** P4-T1
- **Risk:** Low (standard CRUD routes)

**4.3 Integration Tests for Surface Binding**
- **ID:** P4-T3
- **Description:** End-to-end tests for surface binding enforcement
- **Package:** `@agentic-sdlc/orchestrator`
- **Files:**
  - `packages/orchestrator/src/__tests__/integration/surface-binding.integration.test.ts` (NEW)
- **Test Scenarios:**
  1. Create platform without any surfaces
  2. Attempt REST workflow creation → 403 Forbidden
  3. Enable REST surface via API
  4. Attempt REST workflow creation → 201 Created
  5. Disable REST surface
  6. Attempt REST workflow creation → 403 Forbidden
  7. Legacy workflow (no platform_id) → succeeds (backward compatible)
- **Estimate:** 2 hours
- **Dependencies:** P4-T1, P4-T2
- **Risk:** Low

#### Phase 4 Validation Checklist
- [ ] Create workflow via REST on platform without REST surface → 403 Forbidden with clear error
- [ ] Enable REST surface for platform → PlatformSurface record created
- [ ] Create workflow via REST after enabling → 201 Created
- [ ] Disable surface → enabled=false in database
- [ ] Create workflow on disabled surface → 403 Forbidden
- [ ] Legacy workflow creation (no platform_id) → backward compatible

---

### Phase 5: Dashboard Components (Week 5-6)

**Priority:** P2 (Medium - improves user experience)
**Estimated Time:** 26 hours
**Package:** `@agentic-sdlc/dashboard`
**Layer:** Frontend (React + TypeScript)

#### Tasks

**5.1 Create WorkflowDefinitionsPage Component**
- **ID:** P5-T1
- **Description:** List workflow definitions for a platform
- **Package:** `@agentic-sdlc/dashboard`
- **Files:**
  - `packages/dashboard/src/pages/WorkflowDefinitionsPage.tsx` (NEW)
  - `packages/dashboard/src/lib/api.ts` (MODIFY - add API client methods)
- **Component Features:**
  - Table: name, version, stages count, enabled status, actions
  - Actions: Edit, Clone, Enable/Disable, Delete
  - Button: "+ New Workflow Definition" → opens WorkflowDefinitionBuilder
  - Filters: enabled/disabled, search by name
  - Responsive design with Tailwind CSS
  - Dark mode support
- **API Client Methods:**
  ```typescript
  async getWorkflowDefinitions(platformId: string): Promise<WorkflowDefinition[]>
  async deleteWorkflowDefinition(platformId: string, defId: string): Promise<void>
  async toggleWorkflowDefinition(platformId: string, defId: string, enabled: boolean): Promise<void>
  ```
- **Testing:**
  - Manual: Create platform → Navigate to definitions page → See empty state
  - Manual: Create definition → Appears in table
  - Manual: Delete definition → Removed from table
  - Manual: Toggle enabled → Status updates
- **Estimate:** 8 hours
- **Dependencies:** Phase 2 complete (API routes must exist)
- **Risk:** Low (standard CRUD UI)

**5.2 Create WorkflowDefinitionBuilder Component**
- **ID:** P5-T2
- **Description:** Visual form-based workflow definition builder
- **Package:** `@agentic-sdlc/dashboard`
- **Files:**
  - `packages/dashboard/src/components/WorkflowDefinitionBuilder.tsx` (NEW)
  - `packages/dashboard/src/lib/api.ts` (MODIFY - add create/update methods)
- **Component Features:**
  - Form fields:
    - Name (text input, required)
    - Version (text input, semver format, default: 1.0.0)
    - Description (textarea, optional)
  - Stage builder (form-based, NOT drag-and-drop initially):
    - Add stage button → opens stage form modal
    - Stage form: name, agent_type (dropdown), timeout_ms, max_retries, on_success (dropdown), on_failure (dropdown)
    - Agent type dropdown: filtered by platform (uses /api/v1/platforms/:id/agents)
    - Stage list with reorder buttons (up/down)
    - Delete stage button
  - Validation:
    - Duplicate stage names → error
    - Circular dependencies → error (topological sort)
    - Invalid agent_type → error
    - Invalid on_success reference → error
  - Preview: Show workflow graph (simple text representation initially)
  - Save button: POST /api/v1/platforms/:id/definitions
- **API Client Methods:**
  ```typescript
  async createWorkflowDefinition(platformId: string, definition: CreateWorkflowDefinitionRequest): Promise<WorkflowDefinition>
  async updateWorkflowDefinition(platformId: string, defId: string, definition: UpdateWorkflowDefinitionRequest): Promise<WorkflowDefinition>
  ```
- **Testing:**
  - Manual: Create definition with 3 stages → saves to database
  - Manual: Edit definition → updates correctly
  - Manual: Add circular dependency → validation error shown
  - Manual: Select invalid agent type → validation error
  - Manual: Preview shows stage sequence
- **Estimate:** 12 hours (largest component)
- **Dependencies:** P5-T1, Phase 2 complete
- **Risk:** Medium (complex form logic)

**5.3 Create SurfaceConfigModal Component**
- **ID:** P5-T3
- **Description:** Enable/disable surfaces for a platform
- **Package:** `@agentic-sdlc/dashboard`
- **Files:**
  - `packages/dashboard/src/components/SurfaceConfigModal.tsx` (NEW)
  - `packages/dashboard/src/lib/api.ts` (MODIFY - add surface API methods)
- **Component Features:**
  - Modal dialog triggered from PlatformDetailsPage
  - Checkboxes for each surface type:
    - ☐ REST API
    - ☐ GitHub Webhook
    - ☐ CLI
    - ☐ Dashboard
    - ☐ Mobile API
  - JSON config editor for each enabled surface (CodeMirror or Monaco)
  - Surface-specific config examples shown in placeholder
  - Save button: POST /api/v1/platforms/:id/surfaces
  - Cancel button: close without saving
- **API Client Methods:**
  ```typescript
  async getPlatformSurfaces(platformId: string): Promise<PlatformSurface[]>
  async updatePlatformSurface(platformId: string, surfaceType: string, config: any): Promise<void>
  async enablePlatformSurface(platformId: string, surfaceType: string, config?: any): Promise<void>
  async disablePlatformSurface(platformId: string, surfaceType: string): Promise<void>
  ```
- **Testing:**
  - Manual: Open modal → See enabled surfaces checked
  - Manual: Enable REST surface → checkbox checked, config editor shown
  - Manual: Save → PlatformSurface record created
  - Manual: Disable surface → checkbox unchecked, record updated
- **Estimate:** 6 hours
- **Dependencies:** Phase 4 complete (surface API routes must exist)
- **Risk:** Low

#### Phase 5 Validation Checklist
- [ ] Navigate to /platforms/:id/definitions → See definitions list
- [ ] Click "+ New Workflow Definition" → Builder modal opens
- [ ] Create definition with 5 stages → Saves successfully
- [ ] Edit definition → Updates correctly
- [ ] Agent type dropdown shows only platform-scoped agents
- [ ] Circular dependency validation → Error shown
- [ ] Open surface config modal → See enabled surfaces
- [ ] Enable REST surface → Config editor shown
- [ ] Save surface config → Database updated

---

### Phase 6: Documentation & Polish (Week 6-7)

**Priority:** P3 (Low - improves maintainability)
**Estimated Time:** 13 hours
**Package:** All
**Layer:** Documentation

#### Tasks

**6.1 Create Workflow Definition Guide**
- **ID:** P6-T1
- **Description:** Comprehensive guide for creating workflow definitions
- **Files:**
  - `docs/WORKFLOW_DEFINITION_GUIDE.md` (NEW)
- **Content Sections:**
  1. Overview (what are workflow definitions, why use them)
  2. Quick start (create your first definition in 5 minutes)
  3. Definition structure (JSON schema with examples)
  4. Stage configuration (agent_type, timeout, retries, routing)
  5. Advanced features (parallel execution, conditional routing, error handling)
  6. Best practices (naming conventions, versioning, testing)
  7. API reference (all endpoints with curl examples)
  8. Troubleshooting (common errors and solutions)
  9. Migration guide (converting legacy hard-coded workflows)
- **Examples:**
  - Simple 3-stage web app workflow
  - Complex 7-stage data pipeline with conditional routing
  - ML training workflow with parallel validation stages
- **Estimate:** 4 hours
- **Dependencies:** Phases 1-5 complete
- **Risk:** None

**6.2 Create Workflow Definition Templates**
- **ID:** P6-T2
- **Description:** YAML/JSON templates for common workflow patterns
- **Files:**
  - `docs/templates/workflow-definition.yaml` (NEW)
  - `docs/templates/web-app-workflow.yaml` (NEW)
  - `docs/templates/data-pipeline-workflow.yaml` (NEW)
  - `docs/templates/platform-config.json` (NEW)
  - `docs/templates/surface-config-rest.json` (NEW)
  - `docs/templates/surface-config-webhook.json` (NEW)
- **Templates:**
  ```yaml
  # workflow-definition.yaml
  name: my-workflow
  version: 1.0.0
  description: Template workflow
  stages:
    - name: init
      agent_type: scaffold
      timeout_ms: 300000
      max_retries: 3
      on_success: validate
      on_failure: fail_workflow
    - name: validate
      agent_type: validation
      on_success: deploy
    - name: deploy
      agent_type: deployment
      on_success: END
  ```
- **Estimate:** 2 hours
- **Dependencies:** P6-T1
- **Risk:** None

**6.3 Update CLAUDE.md**
- **ID:** P6-T3
- **Description:** Document Surface Architecture V3 completion
- **Files:**
  - `CLAUDE.md` (MODIFY)
- **Updates:**
  1. Update status to "Phase Surface-V3 Complete"
  2. Add workflow definition guide to key resources
  3. Document new API endpoints
  4. Update architecture diagram
  5. Add troubleshooting section for common issues
  6. Update session history
- **Estimate:** 1 hour
- **Dependencies:** Phases 1-5 complete
- **Risk:** None

**6.4 Update Platform Onboarding Guide**
- **ID:** P6-T4
- **Description:** Add workflow definition creation to onboarding
- **Files:**
  - `docs/PLATFORM_ONBOARDING.md` (MODIFY)
- **Updates:**
  1. Add "Step 3: Create Workflow Definition" section
  2. Link to WORKFLOW_DEFINITION_GUIDE.md
  3. Add example workflow definition
  4. Update platform creation workflow diagram
- **Estimate:** 1 hour
- **Dependencies:** P6-T1
- **Risk:** None

**6.5 Code Cleanup & JSDoc**
- **ID:** P6-T5
- **Description:** Remove DEBUG statements and add comprehensive comments
- **Files:**
  - `packages/orchestrator/src/**/*.ts` (MODIFY)
  - `packages/shared/workflow-engine/src/**/*.ts` (MODIFY)
  - `packages/dashboard/src/**/*.tsx` (MODIFY)
- **Tasks:**
  1. Search for console.log/console.debug: `grep -r "console\." --include="*.ts" --include="*.tsx"`
  2. Remove DEBUG statements (keep ERROR/WARN logs)
  3. Add JSDoc comments to all public methods:
     ```typescript
     /**
      * Creates a new workflow definition for a platform.
      *
      * @param platform_id - UUID of the platform
      * @param request - Workflow definition specification
      * @returns Created workflow definition
      * @throws {ValidationError} if definition is invalid
      * @throws {ConflictError} if definition name already exists
      */
     async createDefinition(platform_id: string, request: CreateWorkflowDefinitionRequest): Promise<WorkflowDefinition>
     ```
  4. Refactor duplicate code (DRY principle)
  5. Run linter: `turbo run lint`
- **Estimate:** 4 hours
- **Dependencies:** None (can be done in parallel)
- **Risk:** Low

**6.6 Create Migration Guide**
- **ID:** P6-T6
- **Description:** Guide for migrating existing hard-coded workflows to definitions
- **Files:**
  - `docs/WORKFLOW_MIGRATION_GUIDE.md` (NEW)
- **Content:**
  1. Why migrate (benefits of definition-driven workflows)
  2. Pre-migration checklist
  3. Step-by-step migration process
  4. Converting hard-coded stages to definition
  5. Testing migrated workflows
  6. Rollback procedure
  7. FAQ
- **Estimate:** 1 hour
- **Dependencies:** P6-T1
- **Risk:** None

#### Phase 6 Validation Checklist
- [ ] WORKFLOW_DEFINITION_GUIDE.md created with 9 sections
- [ ] 6+ workflow templates created (YAML/JSON)
- [ ] CLAUDE.md updated with Surface Architecture V3 status
- [ ] PLATFORM_ONBOARDING.md includes workflow definition creation
- [ ] All console.log DEBUG statements removed
- [ ] JSDoc comments added to all new public methods
- [ ] `turbo run lint` passes with 0 warnings
- [ ] WORKFLOW_MIGRATION_GUIDE.md created

---

## Risk Assessment

### Phase 1 Risks

| Risk | Probability | Impact | Mitigation Strategy |
|------|------------|--------|-------------------|
| **Database migration fails** | Low | CRITICAL | 1. Backup database before migration<br>2. Test migration in separate environment first<br>3. Create rollback script<br>4. Verify data integrity after migration |
| **Type errors after enum removal** | Medium | High | 1. Run typecheck incrementally<br>2. Search all AgentType usage before removing<br>3. Update types file-by-file |
| **Existing workflows break** | Low | High | 1. Migration preserves existing agent_type values<br>2. Test workflow creation after migration<br>3. Keep backward compatibility |

### Phase 2 Risks

| Risk | Probability | Impact | Mitigation Strategy |
|------|------------|--------|-------------------|
| **Circular dependency detection bug** | Medium | Medium | 1. Use proven topological sort algorithm<br>2. Comprehensive unit tests with edge cases<br>3. Clear error messages |
| **Definition schema too rigid** | Low | Medium | 1. Use JSON for flexibility<br>2. Version definitions (1.0.0)<br>3. Allow optional fields |
| **API route conflicts** | Low | Low | 1. Follow RESTful conventions<br>2. Use nested routes (/platforms/:id/definitions)<br>3. Test with Fastify routing |

### Phase 3 Risks

| Risk | Probability | Impact | Mitigation Strategy |
|------|------------|--------|-------------------|
| **Workflow execution regression** | Medium | CRITICAL | 1. Comprehensive integration tests<br>2. Test legacy workflows (no definition)<br>3. Gradual rollout with feature flag<br>4. Monitor error rates |
| **Progress calculation edge cases** | Low | Medium | 1. Test with 1-stage, 3-stage, 10-stage workflows<br>2. Handle division by zero<br>3. Round to 2 decimal places |
| **Agent validation performance** | Low | Low | 1. Cache AgentRegistry lookups<br>2. Batch validation for parallel stages<br>3. Monitor query latency |

### Phase 4 Risks

| Risk | Probability | Impact | Mitigation Strategy |
|------|------------|--------|-------------------|
| **Breaking backward compatibility** | Medium | High | 1. Make platform_id optional in SurfaceRequest<br>2. Only validate if platform_id provided<br>3. Test legacy workflows |
| **PlatformSurface query performance** | Low | Low | 1. Add database index on [platform_id, surface_type]<br>2. Cache surface bindings in Redis<br>3. Monitor query time |
| **Unclear error messages** | Medium | Medium | 1. Provide actionable errors ("Enable REST surface in platform settings")<br>2. Include platform_id in error<br>3. Test UX with real users |

### Phase 5 Risks

| Risk | Probability | Impact | Mitigation Strategy |
|------|------------|--------|-------------------|
| **Complex UI state management** | High | Medium | 1. Use React hooks (useState, useEffect)<br>2. Break into smaller components<br>3. Test form validation thoroughly |
| **JSON config editor bugs** | Medium | Medium | 1. Use established library (Monaco/CodeMirror)<br>2. Validate JSON before save<br>3. Show syntax errors inline |
| **Responsive design issues** | Low | Low | 1. Test on mobile devices<br>2. Use Tailwind responsive classes<br>3. Follow existing dashboard patterns |

### Phase 6 Risks

| Risk | Probability | Impact | Mitigation Strategy |
|------|------------|--------|-------------------|
| **Documentation becomes outdated** | High | Low | 1. Link docs to code (line references)<br>2. Version documentation<br>3. Review during future changes |
| **Templates don't match reality** | Medium | Medium | 1. Test templates in real environment<br>2. Keep templates minimal<br>3. Update with platform changes |

---

## Testing Strategy

### Unit Tests (Vitest)

**Phase 1:**
- [ ] AgentRegistry.validateAgentExists() with string agent_type
- [ ] AgentRegistry typo detection (Levenshtein distance)
- [ ] Platform-scoped agent lookup

**Phase 2:**
- [ ] WorkflowDefinitionAdapter CRUD methods
- [ ] WorkflowDefinitionSpec schema validation
- [ ] Circular dependency detection (topological sort)
- [ ] Invalid agent_type validation
- [ ] Unique constraint validation

**Phase 3:**
- [ ] WorkflowEngine.calculateProgress() - edge cases (0 stages, 1 stage, 10 stages)
- [ ] WorkflowEngine.validateExecution() - missing agents
- [ ] WorkflowEngine.getNextStage() - on_success/on_failure routing
- [ ] WorkflowService.createTaskForStage() - agent validation before task creation

**Phase 4:**
- [ ] SurfaceRouterService PlatformSurface validation
- [ ] Error messages for disabled surfaces
- [ ] Backward compatibility (no platform_id)

**Phase 5:**
- [ ] Form validation in WorkflowDefinitionBuilder
- [ ] Circular dependency detection in UI
- [ ] JSON config editor validation

**Command:** `turbo run test --filter=@agentic-sdlc/orchestrator`
**Coverage Target:** 85%+

---

### Integration Tests (Vitest with Real Components)

**Phase 2:**
- [ ] Create workflow definition via API → 201 Created
- [ ] Create duplicate definition → 409 Conflict
- [ ] Create definition with circular dependencies → 400 Bad Request
- [ ] Update definition → 200 OK
- [ ] Delete definition → 204 No Content

**Phase 3:**
- [ ] Create platform with 2 definitions
- [ ] Execute workflows in parallel
- [ ] Verify independent progress tracking
- [ ] Verify stage sequencing per definition
- [ ] Test legacy workflow fallback

**Phase 4:**
- [ ] REST request to platform without REST surface → 403 Forbidden
- [ ] Enable surface → workflow creation succeeds
- [ ] Disable surface → workflow creation fails

**Command:** `turbo run test --filter=@agentic-sdlc/orchestrator`
**Coverage Target:** 80%

---

### End-to-End Pipeline Tests

**Phase 3:**
```bash
# Test workflow with custom 3-stage definition
./scripts/run-pipeline-test.sh "Custom 3-stage workflow"

# Test workflow with custom 5-stage definition (adaptive progress)
./scripts/run-pipeline-test.sh "Custom 5-stage workflow with adaptive progress"

# Test on_success routing (skip stages)
./scripts/run-pipeline-test.sh "Conditional routing workflow"

# Test on_failure='skip' (continue past failures)
./scripts/run-pipeline-test.sh "Error-tolerant workflow"

# Test parallel execution on different platforms
./scripts/run-pipeline-test.sh "Multi-platform parallel workflows"
```

**Phase 4:**
```bash
# Test surface binding enforcement
./scripts/run-pipeline-test.sh "Surface binding validation"
```

**Setup:** `./scripts/env/start-dev.sh` (start all 7 PM2 services)
**Teardown:** `./scripts/env/stop-dev.sh`
**Coverage:** All critical paths (~30 min execution time per phase)

---

### Build Validation

**After each phase:**
```bash
# TypeScript compilation
turbo run build

# Type checking
turbo run typecheck

# Linting
turbo run lint

# All packages build in dependency order
turbo run build --filter=@agentic-sdlc/shared-types
turbo run build --filter=@agentic-sdlc/orchestrator
turbo run build --filter=@agentic-sdlc/dashboard
```

**Validation:**
- [ ] 0 TypeScript errors
- [ ] 0 linting warnings
- [ ] All 21 packages build successfully
- [ ] No /src/ imports in dist files

---

### Deployment Validation

**After each phase:**
```bash
# Health checks
./scripts/env/check-health.sh

# Verify dashboard accessible
curl http://localhost:3050

# Verify orchestrator API
curl http://localhost:3051/api/v1/health

# Check PM2 processes
pnpm pm2:status

# Check logs for errors
pnpm pm2:logs | grep -i "ERROR\|CRITICAL"
```

**Validation:**
- [ ] Dashboard returns 200 OK
- [ ] Orchestrator API returns 200 OK
- [ ] All 7 PM2 processes in "online" status
- [ ] No ERROR or CRITICAL logs in last 5 minutes

---

### Security Tests

**Phase 1:**
- [ ] Verify agent_type accepts only non-empty strings
- [ ] Verify AgentRegistry prevents SQL injection

**Phase 4:**
- [ ] Verify PlatformSurface binding prevents unauthorized access
- [ ] Verify surface config doesn't expose secrets
- [ ] Verify error messages don't leak sensitive data

**Command:** `pnpm audit`
**Validation:**
- [ ] No high/critical vulnerabilities
- [ ] Dependencies up to date

---

## Implementation Timeline

### Phase 1: Critical Fixes (Week 1)
**Days 1-2 (5 hours):**
- Day 1: P1-T1, P1-T2 (migration + types)
- Day 2: P1-T3, P1-T4 (run migration + validation)

**Milestone:** AgentType enum removed, custom agent types work

---

### Phase 2: Workflow Definition Services (Week 2)
**Days 3-5 (16 hours):**
- Day 3: P2-T1 (audit adapter - 8 hours)
- Day 4: P2-T2, P2-T3 (API routes + types - 8 hours)
- Day 5: Testing and validation

**Milestone:** Workflow definition CRUD API operational

---

### Phase 3: Workflow Engine Integration (Week 3)
**Days 6-9 (24 hours):**
- Day 6: P3-T1 (enhance engine - 8 hours)
- Day 7: P3-T2, P3-T3 (service updates - 7 hours)
- Day 8: P3-T4 (state machine - 6 hours)
- Day 9: P3-T5 (E2E tests - 3 hours)

**Milestone:** Definition-driven workflows executing

---

### Phase 4: Surface Binding Enforcement (Week 4)
**Days 10-11 (8 hours):**
- Day 10: P4-T1, P4-T2 (router + API - 6 hours)
- Day 11: P4-T3 (tests - 2 hours)

**Milestone:** Surface bindings enforced

---

### Phase 5: Dashboard Components (Week 5-6)
**Days 12-17 (26 hours):**
- Day 12-13: P5-T1 (definitions page - 8 hours)
- Day 14-16: P5-T2 (builder - 12 hours)
- Day 17: P5-T3 (surface config - 6 hours)

**Milestone:** Dashboard UI complete

---

### Phase 6: Documentation & Polish (Week 6-7)
**Days 18-20 (13 hours):**
- Day 18: P6-T1, P6-T2 (guide + templates - 6 hours)
- Day 19: P6-T3, P6-T4, P6-T6 (doc updates - 3 hours)
- Day 20: P6-T5 (cleanup - 4 hours)

**Milestone:** Production-ready with complete documentation

---

## Dependencies

### External Dependencies
- **Anthropic Claude API** - Required for agent intelligence (already integrated)
- **PostgreSQL 16+** - Database (already running)
- **Redis 7+** - Message bus + cache (already running)
- **Docker** - Container orchestration (already configured)
- **PM2** - Process management (already configured)

### Internal Package Dependencies

**Build Order (Turbo monorepo):**
```
1. @agentic-sdlc/shared-types (Phase 2)
2. @agentic-sdlc/shared-workflow-engine (Phase 3)
3. @agentic-sdlc/shared-agent-registry (Phase 1)
4. @agentic-sdlc/orchestrator (Phases 1-4)
5. @agentic-sdlc/dashboard (Phase 5)
```

**Phase Dependencies:**
- Phase 2 requires Phase 1 complete (types depend on String agent_type)
- Phase 3 requires Phase 2 complete (engine needs WorkflowDefinitionSpec types)
- Phase 4 independent (can be done in parallel with Phase 3)
- Phase 5 requires Phases 2-4 complete (UI needs API routes)
- Phase 6 requires Phases 1-5 complete (documentation covers all features)

---

## Success Metrics

### Performance Metrics
- **Workflow Creation:** < 500ms (API response time)
- **Definition Validation:** < 100ms (synchronous validation)
- **Stage Transition:** < 200ms (state machine update)
- **Surface Routing:** < 150ms (including PlatformSurface query)
- **Dashboard Load:** < 2s (initial page load)

### Quality Metrics
- **TypeScript Errors:** 0
- **Linting Warnings:** 0
- **Unit Test Coverage:** 85%+
- **Integration Test Coverage:** 80%+
- **E2E Test Pass Rate:** 100%
- **Build Success Rate:** 100%

### User Experience Metrics
- **Error Clarity:** All errors include actionable suggestions
- **API Response Times:** 95th percentile < 1s
- **Dashboard Responsiveness:** Works on mobile/tablet/desktop
- **Documentation Completeness:** All API endpoints documented with examples

### Business Metrics
- **Platform Flexibility:** Support 3+ platform types (web apps, data pipelines, infrastructure)
- **Agent Extensibility:** Support custom agent types (no enum restrictions)
- **Security Compliance:** 100% of surface requests validated against bindings
- **Migration Success:** 0 breaking changes to existing workflows

---

## Rollout Plan

### Phase 1: Development Environment
- Execute Prisma migration in local dev
- Test with GenericMockAgent
- Verify TypeScript builds

### Phase 2: Staging Environment (After Phase 3)
- Deploy Phase 1-3 changes to staging
- Run full integration test suite
- Test workflow definitions with real agents
- Performance testing with 100+ workflows

### Phase 3: Production (After Phase 6)
- Deploy all phases to production
- Monitor error rates for 24 hours
- Gradual rollout (10% → 50% → 100%)
- Feature flag for definition-driven workflows

### Rollback Procedure

**If Phase 1 migration fails:**
```bash
# Restore database from backup
psql -h localhost -p 5433 -U agentic agentic_sdlc < backup.sql

# Revert Prisma schema
git checkout HEAD~1 packages/orchestrator/prisma/schema.prisma
pnpm prisma generate
```

**If Phase 3 execution issues:**
```bash
# Feature flag: disable definition-driven workflows
# Fallback to legacy hard-coded stages
# WorkflowDefinitionAdapter already has getNextStageLegacy()
```

**If Phase 4 breaks workflows:**
```bash
# Remove PlatformSurface validation temporarily
# git revert <commit-hash>
# Deploy hotfix
```

---

## Next Steps After Planning

### Immediate Actions
1. **Review Plan with Stakeholders** - Ensure alignment on scope and timeline
2. **Confirm Phase 1 Priority** - Get approval to execute database migration
3. **Prepare Development Environment** - Ensure ./dev start works smoothly
4. **Create Feature Branch** - `git checkout -b feature/surface-arch-v3`

### Ready to Execute?
Once this plan is approved, proceed to **CODE phase** with:
```bash
# Start with Phase 1
/epcc-code "Phase 1: Critical Fixes - AgentType Enum Migration"
```

---

## Appendix: File Manifest

### Files to Create (NEW)

```
packages/shared/types/src/
└── workflow-definition.ts                    (Phase 2)

packages/orchestrator/prisma/migrations/
└── YYYYMMDD_agent_type_string/
    └── migration.sql                          (Phase 1)

packages/orchestrator/src/__tests__/
├── integration/
│   ├── workflow-definition.integration.test.ts (Phase 3)
│   └── surface-binding.integration.test.ts     (Phase 4)

packages/dashboard/src/
├── pages/
│   └── WorkflowDefinitionsPage.tsx            (Phase 5)
├── components/
│   ├── WorkflowDefinitionBuilder.tsx          (Phase 5)
│   └── SurfaceConfigModal.tsx                 (Phase 5)

docs/
├── WORKFLOW_DEFINITION_GUIDE.md               (Phase 6)
├── WORKFLOW_MIGRATION_GUIDE.md                (Phase 6)
└── templates/
    ├── workflow-definition.yaml               (Phase 6)
    ├── web-app-workflow.yaml                  (Phase 6)
    ├── data-pipeline-workflow.yaml            (Phase 6)
    ├── platform-config.json                   (Phase 6)
    ├── surface-config-rest.json               (Phase 6)
    └── surface-config-webhook.json            (Phase 6)
```

### Files to Modify (EXISTING)

```
packages/orchestrator/prisma/
└── schema.prisma                              (Phase 1: lines 76, 147, 197-206)

packages/orchestrator/src/
├── types/index.ts                             (Phase 1: remove AgentType)
├── services/
│   ├── workflow.service.ts                    (Phase 3: add surface_context param)
│   ├── surface-router.service.ts              (Phase 4: add PlatformSurface query)
│   └── workflow-definition-adapter.service.ts (Phase 2: add CRUD methods)
├── api/routes/
│   └── platform.routes.ts                     (Phase 2: add /definitions routes)
│                                              (Phase 4: add /surfaces routes)

packages/shared/workflow-engine/src/
└── workflow-engine.ts                         (Phase 3: add calculateProgress, validateExecution)

packages/dashboard/src/
└── lib/api.ts                                 (Phase 5: add API client methods)

docs/
├── CLAUDE.md                                  (Phase 6: update status)
└── PLATFORM_ONBOARDING.md                     (Phase 6: add workflow definitions)
```

---

**END OF PLAN**

**Status:** ✅ Ready for Execution
**Next Phase:** Phase 1 (Critical Fixes) - Estimated 5 hours
**Total Estimated Time:** 92 hours across 6 phases

Remember: **This is a PLAN. No implementation code should be written until the CODE phase.**
