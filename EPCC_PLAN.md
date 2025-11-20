# EPCC Implementation Plan: Multi-Stage Workflow Builder & Platform CRUD

**Session:** #87 (Planning Phase)
**Date:** 2025-11-20
**Status:** ✅ PLAN COMPLETE
**Reference:** EPCC_EXPLORE.md

---

## Executive Summary

The Multi-Stage Workflow Builder and Platform CRUD features are largely implemented in the backend and dashboard. This plan focuses on **closing the gap between the working API infrastructure and the dashboard UI**.

**Key Gap:** Platform create/update/delete operations have API endpoints (possibly) but lack dashboard UI components and workflows.

**Scope:** Complete platform CRUD dashboard integration, enhance workflow builder to require platform context, and validate end-to-end integration.

**Estimated Effort:** 12-14 hours (Backend verification + Frontend components + Testing + Documentation)

---

## Feature Objectives

### What We're Building

1. **Complete Platform CRUD in Dashboard**
   - Create new platforms with configuration
   - Edit existing platform metadata and settings
   - Delete platforms with confirmation
   - Display platform state and analytics

2. **Enhanced Workflow Builder Integration**
   - Require platform selection when creating workflows
   - Default new workflows to selected platform
   - Show platform-specific agents in builder UI
   - Save workflow definitions scoped to platform

3. **Seamless Platform-Workflow Association**
   - Workflows created from builder automatically tied to platform
   - Platform analytics include related workflows
   - Platform details show available definitions and active workflows

### Success Criteria

- [ ] All platform endpoints verified in backend
- [ ] PlatformFormModal component created and tested
- [ ] Create/Edit/Delete flows implemented in PlatformsPage
- [ ] Workflow builder requires platform selection
- [ ] Platform-workflow associations validated end-to-end
- [ ] TypeScript compilation: 0 errors
- [ ] E2E test validates full workflow
- [ ] CLAUDE.md updated with workflow builder changes
- [ ] All UI components responsive and dark-mode compatible
- [ ] Performance: Dashboard loads in <3 seconds

---

## Technical Approach

### Architecture Overview

**Frontend (Dashboard):**
- PlatformFormModal - Create/edit platform modal component
- PlatformsPage - List with CRUD buttons
- DeleteConfirmationModal - Confirmation for deletion
- WorkflowPipelineBuilder - Add platform selector (required field)
- SaveWorkflowDefinitionModal - Include platform_id in save

**Backend (Orchestrator):**
- Platform routes (POST, PUT, DELETE endpoints)
- PlatformService (business logic for CRUD)
- PlatformRepository (data access)

**Database:**
- Platform model with relationships
- WorkflowDefinition with platform_id FK
- Workflow with optional platform_id FK

### Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Form Component | React Modal | Matches existing SaveWorkflowDefinitionModal pattern |
| Validation | Frontend + Backend | Real-time UX feedback + data integrity |
| Platform Binding | Required on workflow creation | Prevent orphaned workflows |
| Deletion | Cascade with confirmation | Clean database, safe UX |

---

## Task Breakdown

### Phase 1: Backend Verification (1-2 hours)

#### Task 1.1: Verify Platform CRUD Endpoints
- **File:** `packages/orchestrator/src/api/routes/platform.routes.ts`
- **Effort:** 1 hour
- **Acceptance Criteria:**
  - POST /api/v1/platforms creates platform (201)
  - PUT /api/v1/platforms/:id updates platform (200)
  - DELETE /api/v1/platforms/:id deletes platform (204)
  - Proper error handling and validation
  - Input validation rejects invalid data (400)

#### Task 1.2: Enhance PlatformService if Needed
- **File:** `packages/orchestrator/src/services/platform.service.ts`
- **Effort:** 30 min (conditional)
- **Priority:** HIGH
- **Depends on:** Task 1.1
- **Acceptance Criteria:**
  - Create validates inputs, generates UUID
  - Update modifies only provided fields
  - Delete handles cascade properly
  - All methods return typed Platform objects

### Phase 2: Frontend UI Components (4-5 hours)

#### Task 2.1: Create PlatformFormModal Component
- **File:** `packages/dashboard/src/components/Platforms/PlatformFormModal.tsx`
- **Effort:** 2.5 hours
- **Priority:** HIGH
- **Acceptance Criteria:**
  - Modal accepts: isOpen, onClose, platform (optional), onSave props
  - Form fields: name (text), layer (select), description (textarea), config (JSON)
  - Validation: name required/unique, layer required
  - Submit button: "Create Platform" (new) / "Update Platform" (edit)
  - Loading state during API call
  - Error toast on failure, success toast on save
  - Dark mode + responsive design

#### Task 2.2: Enhance PlatformsPage with CRUD Buttons
- **File:** `packages/dashboard/src/pages/PlatformsPage.tsx`
- **Effort:** 1.5 hours
- **Priority:** HIGH
- **Depends on:** Task 2.1
- **Acceptance Criteria:**
  - "New Platform" button opens PlatformFormModal
  - PlatformCard shows edit/delete action icons
  - Edit pre-fills form with platform data
  - Delete shows confirmation modal first
  - List refreshes automatically after operations
  - Toast notifications for all CRUD operations
  - Loading skeleton during fetch
  - Error state with retry button

#### Task 2.3: Create DeleteConfirmationModal Component
- **File:** `packages/dashboard/src/components/Common/DeleteConfirmationModal.tsx`
- **Effort:** 1 hour
- **Priority:** HIGH
- **Acceptance Criteria:**
  - Modal accepts: isOpen, onClose, onConfirm, title, message, isLoading
  - Shows warning with resource name
  - Cancel closes without action
  - Confirm (red button) calls onConfirm
  - Loading state on confirm button
  - Dark mode + keyboard accessible (Esc to close, Enter to confirm)

### Phase 3: Workflow Builder Enhancement (2-3 hours)

#### Task 3.1: Add Platform Selector to WorkflowPipelineBuilder
- **File:** `packages/dashboard/src/components/Workflows/WorkflowPipelineBuilder.tsx`
- **Effort:** 2 hours
- **Priority:** HIGH
- **Depends on:** Task 1.1
- **Acceptance Criteria:**
  - Platform dropdown at top (required field)
  - Loads platforms from fetchPlatforms() on mount
  - Selecting platform fetches platform-specific agents
  - Agent selectors filtered by selected platform
  - Platform context shown visually
  - Error handling for API failures
  - Pass platform to SaveWorkflowDefinitionModal

#### Task 3.2: Update SaveWorkflowDefinitionModal for Platform
- **File:** `packages/dashboard/src/components/Workflows/SaveWorkflowDefinitionModal.tsx`
- **Effort:** 1 hour
- **Priority:** HIGH
- **Depends on:** Task 3.1
- **Acceptance Criteria:**
  - Accept platformId from parent component
  - Include platformId in API request
  - Display platform name in modal header
  - Enforce platform required before save
  - Error handling for missing platform_id

### Phase 4: Testing & Validation (3-4 hours)

#### Task 4.1: Write Backend Integration Tests
- **File:** `packages/orchestrator/src/__tests__/platform.integration.test.ts`
- **Effort:** 1.5 hours
- **Priority:** HIGH
- **Depends on:** Task 1.1, 1.2
- **Coverage:**
  - Create platform (201 success, 400 validation error)
  - Read all platforms (200 with array)
  - Update platform (200 with updated object)
  - Delete platform (204 success, 404 not found)
  - Platform analytics includes workflows
  - Get platform agents (correct list)
  - Use Vitest + supertest + mock database

#### Task 4.2: Write Frontend Component Tests
- **File:** `packages/dashboard/src/components/__tests__/PlatformCRUD.test.tsx`
- **Effort:** 1.5 hours
- **Priority:** HIGH
- **Depends on:** Task 2.1, 2.2
- **Coverage:**
  - PlatformsPage renders platform list
  - Create button opens modal
  - Form validation rejects invalid input
  - Submit creates platform (mocked API)
  - Edit button populates form
  - Update platform via form
  - Delete button shows confirmation
  - Confirmation deletes platform
  - Error handling displays toasts
  - Use Vitest + React Testing Library

#### Task 4.3: Write E2E Pipeline Test
- **File:** E2E test script or Vitest e2e suite
- **Effort:** 1.5 hours
- **Priority:** HIGH
- **Depends on:** Task 4.1, 4.2
- **Scenarios:**
  - Create platform via API → Success
  - Create workflow definition scoped to platform → Success
  - Create workflow from definition → Success
  - Verify workflow has platform_id
  - Platform analytics shows new workflow
  - Workflow builder shows platform's agents
  - Test cascade on platform delete
  - Run: `./dev start` → test flow → verify database → `./dev health`

### Phase 5: Documentation & Polish (1 hour)

#### Task 5.1: Update CLAUDE.md
- **File:** `CLAUDE.md`
- **Effort:** 30 min
- **Priority:** MEDIUM
- **Depends on:** Task 3.1
- **Updates:**
  - Add platform management workflow section
  - Document platform layers and use cases
  - Explain platform-scoped workflow definitions
  - Add workflow builder platform requirement
  - Update API endpoints section with platform CRUD
  - Session #87 accomplishments

#### Task 5.2: Code Quality & Build Validation
- **Effort:** 30 min
- **Priority:** CRITICAL
- **Depends on:** Task 4.1, 4.2, 4.3
- **Validation:**
  - `turbo run build` → 0 errors
  - `turbo run typecheck` → 0 TypeScript errors
  - `turbo run lint` → 0 linting errors
  - `turbo run test` → >85% coverage
  - No console errors in dashboard
  - `pnpm audit` → no vulnerabilities

---

## Dependencies & Build Order

### Package Build Order (Turbo)

```
1. @agentic-sdlc/shared-types
   ↓
2. @agentic-sdlc/orchestrator
   ├─ Platform routes (Task 1.1)
   ├─ Platform service (Task 1.2)
   └─ Integration tests (Task 4.1)
   ↓
3. @agentic-sdlc/dashboard
   ├─ PlatformFormModal (Task 2.1)
   ├─ DeleteConfirmationModal (Task 2.3)
   ├─ PlatformsPage (Task 2.2)
   ├─ WorkflowPipelineBuilder (Task 3.1)
   ├─ SaveWorkflowDefinitionModal (Task 3.2)
   ├─ Component tests (Task 4.2)
   └─ E2E tests (Task 4.3)
```

### No New External Dependencies Required

- React (existing)
- TypeScript (existing)
- Tailwind CSS (existing)
- Vitest (existing)
- Axios (existing)

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| Platform delete cascade too aggressive | Low | High | Implement soft delete + confirmation |
| Platform APIs don't exist | Medium | High | Task 1.1 verifies, Task 1.2 implements if needed |
| Form validation complexity | Low | Medium | Mirror SaveWorkflowDefinitionModal patterns |
| Workflow builder platform-agent coupling | Low | Medium | Comprehensive testing in Task 4.2 |
| Database cascade delete issues | Low | High | Verify with integration tests |
| E2E test flakiness | Medium | Medium | Retries, proper wait conditions, cleanup |
| Breaking changes to existing workflows | Medium | High | Keep platform_id optional (backward compatible) |
| Type safety in API responses | Low | Medium | Strict TypeScript, schema validation |

---

## Testing Strategy

### Unit Tests (Vitest)
- PlatformService CRUD methods
- Form validation logic
- Component rendering
- Error handling
- Input validation

**Run:** `turbo run test --filter=@agentic-sdlc/orchestrator`

### Integration Tests
- Full HTTP request/response cycle
- Database state after operations
- Multi-step workflows (create → update → delete)
- Form submission → API call → UI refresh

**Run:** `turbo run test -- --include="**/*.integration.test.ts"`

### E2E Tests
1. Start services: `./dev start`
2. Execute: Create platform → Create definition → Create workflow
3. Verify data integrity
4. Health check: `./dev health`
5. Cleanup: `./dev stop`

**Coverage:** All critical paths

### Build Validation
```bash
turbo run build        # All packages compile
turbo run typecheck    # 0 TypeScript errors
turbo run lint         # 0 linting errors
pnpm audit             # No vulnerabilities
```

### Coverage Targets
- Unit tests: 85%+
- Integration tests: 80%+
- E2E: All critical paths
- Overall: No untested code changes

---

## Timeline & Effort

| Phase | Tasks | Hours | Status |
|-------|-------|-------|--------|
| Phase 1: Verification | 1.1, 1.2 | 1.5 | Pending |
| Phase 2: Frontend UI | 2.1, 2.2, 2.3 | 4.5 | Pending |
| Phase 3: Builder Enhancement | 3.1, 3.2 | 3.0 | Pending |
| Phase 4: Testing | 4.1, 4.2, 4.3 | 4.5 | Pending |
| Phase 5: Polish & Docs | 5.1, 5.2 | 1.0 | Pending |
| **TOTAL** | **13 tasks** | **14.5 hours** | |

### Execution Order

**Day 1 (Morning):** Phase 1 - Backend verification (1.5h)
**Day 1 (Afternoon):** Phase 2 - Frontend components (4.5h)
**Day 2 (Morning):** Phase 3 - Builder enhancement (3h)
**Day 2 (Afternoon):** Phase 4 - Testing (4.5h)
**Day 3 (Morning):** Phase 5 - Documentation & validation (1h)

---

## Rollout Plan

### Stage 1: Verification & Foundation
- Verify backend endpoints
- Implement missing endpoints if needed
- **Commit:** "chore: Verify platform CRUD backend endpoints"

### Stage 2: Frontend Components
- Build PlatformFormModal
- Add CRUD actions to PlatformsPage
- **Commit:** "feat: Add platform CRUD UI components"

### Stage 3: Integration
- Add platform selector to workflow builder
- Update SaveWorkflowDefinitionModal
- **Commit:** "feat: Integrate platform context into workflow builder"

### Stage 4: Testing & Validation
- Write integration tests
- Write component tests
- Write E2E tests
- Run full test suite
- **Commit:** "test: Add comprehensive platform CRUD tests"

### Stage 5: Documentation & Release
- Update CLAUDE.md
- Run final build validation
- **Commit:** "docs: Update CLAUDE.md with platform CRUD documentation"

### Rollback Procedure

**Immediate (15 min):**
- `git revert <commit-hash>`
- `./dev restart`
- Verify health checks

**Short-term (1 hour):**
- Identify root cause
- Fix in feature branch
- Test locally before re-deploy

**Data Recovery:**
- Platform soft-delete keeps data
- Restore: `UPDATE platforms SET deleted_at = NULL WHERE id = ...`

---

## Code Quality Standards

### Architecture
- Core: Platform business logic (PlatformService)
- Ports: Platform and Workflow repositories
- Adapters: PostgreSQL repos, HTTP routes
- Orchestration: API routes and middleware

### Standards
- No code duplication (one source of truth)
- Strict TypeScript (no `any` types)
- Package imports: `@agentic-sdlc/*` index exports
- Meaningful error messages
- Structured logging (Pino)
- Accessibility: ARIA labels, keyboard nav
- Comments: Only for non-obvious logic

### File Organization

```
orchestrator/
├── src/api/routes/platform.routes.ts (Task 1.1)
├── src/services/platform.service.ts (Task 1.2)
└── src/__tests__/platform.integration.test.ts (Task 4.1)

dashboard/
├── src/components/Platforms/
│   ├── PlatformFormModal.tsx (Task 2.1)
│   └── __tests__/PlatformFormModal.test.tsx (Task 4.2)
├── src/components/Common/
│   ├── DeleteConfirmationModal.tsx (Task 2.3)
│   └── __tests__/DeleteConfirmationModal.test.tsx (Task 4.2)
├── src/components/Workflows/
│   ├── WorkflowPipelineBuilder.tsx (Task 3.1)
│   ├── SaveWorkflowDefinitionModal.tsx (Task 3.2)
│   └── __tests__/PlatformCRUD.test.tsx (Task 4.2)
└── src/pages/PlatformsPage.tsx (Task 2.2)
```

---

## Implementation Checklist

### Phase 1 Complete
- [ ] Platform endpoints verified
- [ ] Missing endpoints implemented if needed

### Phase 2 Complete
- [ ] PlatformFormModal renders correctly
- [ ] PlatformsPage has CRUD buttons
- [ ] DeleteConfirmationModal prevents accidental deletes

### Phase 3 Complete
- [ ] WorkflowPipelineBuilder has platform selector
- [ ] SaveWorkflowDefinitionModal includes platform_id

### Phase 4 Complete
- [ ] Backend integration tests passing (>80% coverage)
- [ ] Frontend component tests passing (>85% coverage)
- [ ] E2E pipeline test passing (create platform → workflow definition → workflow)

### Phase 5 Complete
- [ ] CLAUDE.md updated
- [ ] TypeScript: 0 errors
- [ ] All tests passing
- [ ] Build: all packages compile
- [ ] Linting: 0 errors

---

## Reference Materials

- **Exploration:** EPCC_EXPLORE.md
- **Project State:** CLAUDE.md (Session #86)
- **Pattern Reference:** SaveWorkflowDefinitionModal.tsx
- **Database:** packages/orchestrator/prisma/schema.prisma
- **API Endpoints:** packages/orchestrator/src/api/routes/

---

## Next Steps (CODE Phase)

When moving to CODE phase:

1. Start with **Task 1.1** - Verify backend endpoints
2. Implement **Task 2.1** - PlatformFormModal (reference SaveWorkflowDefinitionModal)
3. Implement **Task 2.2** - Update PlatformsPage
4. Implement **Task 3.1** - Platform selector in builder
5. Test each phase before moving to next

**Critical Reminders:**
- No AgentEnvelopeSchema changes needed
- Keep platform_id optional on Workflow (backward compatibility)
- Dark mode support required
- User-friendly error messages
- TypeScript strict mode (0 errors)
- Reference existing patterns (SaveWorkflowDefinitionModal)

---

**Status:** ✅ PLAN COMPLETE
**Ready for CODE Phase:** YES
**Created:** 2025-11-20
**Session:** #87
