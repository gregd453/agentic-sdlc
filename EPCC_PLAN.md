# EPCC Implementation Plan: Dashboard API Refactoring

**Session:** #88 (Planning Phase)
**Date:** 2025-11-20
**Status:** ✅ PLAN COMPLETE
**Reference:** DASHBOARD-API-REFACTOR.md

---

## Executive Summary

The dashboard codebase contains approximately **50% code duplication** across ~5,000 lines, primarily in modal components, form validation logic, API client organization, and page state management. This refactoring plan will systematically eliminate duplication and establish reusable component patterns.

**Key Problem:** Scattered, duplicated logic in modals (6 files, 1,217 LOC), monolithic API client (598 LOC), repeated form validation, and inconsistent page layouts.

**Scope:** Extract reusable components (BaseModal, Alert), consolidate hooks (useFormState, useCRUD), modularize API client, and refactor all 12 pages to use new patterns.

**Estimated Effort:** 8-10 days across 4 phases (Foundation → Hooks → Pages → Polish)

---

## Feature Objectives

### What We're Building

**Goal:** Reduce code duplication from 50% to <10%, improve maintainability by 60-70%, and establish reusable component patterns that accelerate development velocity.

#### Phase 1: Foundation Components
1. **BaseModal** - Reusable modal wrapper eliminating 40-60% duplication across 6 modals
2. **useFormState Hook** - Consolidate form validation logic repeated in 5+ components
3. **Alert Component** - Replace 15+ duplicated error/success message displays
4. **Modularized API Client** - Split 598-line monolithic file into 6 focused modules

#### Phase 2: Hooks & Utilities
1. **useCRUD Hook** - CRUD state management for pages (PlatformsPage, TracesPage, WorkflowsPage)
2. **useLoadingState Hook** - Standardize inconsistent loading state naming
3. **Theme Constants** - Replace 200+ duplicated Tailwind class combinations
4. **Consolidated Formatters** - Merge formatters.ts + numberFormatters.ts

#### Phase 3: Page Components & Templates
1. **PageTemplate** - Extract common page header/footer structure used in 12+ pages
2. **Refactor All Pages** - Use PageTemplate, new hooks, and theme constants
3. **Modal Refactoring** - Replace all modal implementations with BaseModal wrapper

#### Phase 4: Polish & Completion
1. **Input Components** - Extracted form input library (Input, TextArea, Select, Checkbox)
2. **Status Components** - StatusBadge, ProgressIndicator, EmptyState, LoadingSpinner
3. **Naming Standardization** - Consistent variable naming across codebase
4. **Type Consolidation** - Move scattered component types to single location

### Success Criteria

- [ ] All 6 modals refactored to use BaseModal component
- [ ] All forms use useFormState hook (no duplicated form validation)
- [ ] All error/success messages use Alert component
- [ ] API client split into 6 focused modules
- [ ] All 12 pages use PageTemplate component
- [ ] useCRUD hook implemented and used in 4+ pages
- [ ] Theme constants replace 200+ duplicated Tailwind classes
- [ ] 50% code reduction achieved (5,000 → 2,500 LOC)
- [ ] 80% duplication reduction
- [ ] Zero TypeScript errors across all changes
- [ ] All tests passing (>80% coverage for new code)
- [ ] E2E tests validate no regressions
- [ ] Code review approved
- [ ] Dashboard functionality preserved (no breaking changes)
- [ ] Build completes successfully with turbo

---

## Technical Approach

### Architecture Overview

**Refactoring Strategy: Component Composition & Hook Consolidation**

```
BEFORE: Scattered, Duplicated Logic
├── Modal 1-6: 40-60% duplicate structure (header, body, footer, errors)
├── Forms: Repeated validation patterns in 5+ components
├── API Client: 598 LOC monolithic file with repeated patterns
├── Pages: 12 pages with identical CRUD state logic
└── Utilities: Scattered formatters, theme classes

AFTER: Abstracted, Reusable Components & Hooks
├── BaseModal: Single source of truth for modal structure
├── useFormState: Consolidated form state management
├── Alert: Reusable error/success display
├── API Modules: 6 focused modules (workflows, platforms, traces, etc)
├── useCRUD: CRUD state management hook
├── useLoadingState: Standardized loading state
├── PageTemplate: Common page header/footer/layout
├── Theme Constants: Centralized Tailwind classes
└── Input/Status Components: Extracted reusable component library
```

### Design Decisions

| Decision | Option Chosen | Rationale | Trade-offs |
|----------|--------------|-----------|-----------|
| **Modal Extraction** | BaseModal wrapper + composition | Eliminates 370 lines, maintains flexibility | Requires prop mapping in child modals |
| **Form Management** | Custom useFormState hook | Simplifies form logic, consistent pattern | Additional hook to learn/maintain |
| **API Organization** | Split into 6 modules (concern-based) | Better organization, easier to find code | Slightly more files, import path changes |
| **Theme Management** | Constants + Tailwind utility classes | Centralized theming, easier changes | Build time for constant resolution |
| **Page Templates** | Shared PageTemplate component | 30% boilerplate reduction | Custom pages need restructuring |
| **Hook Strategy** | Combine logic into custom hooks | DRY principle, reusability | Testing complexity (hook behavior) |
| **Testing Approach** | Incremental validation after each phase | Early bug detection | Slightly slower initial progress |
| **Backward Compatibility** | Zero breaking changes | No migration needed | Slightly more complexity in transitions |

---

## Detailed Task Breakdown

### Phase 1: Foundation Components (2-3 days, High Priority)

#### Task 1.1: Create BaseModal Component (3-4 hours)
- **File:** `components/Common/BaseModal.tsx`
- **Effort:** 3-4 hours
- **Priority:** HIGH
- **Dependencies:** None
- **Acceptance Criteria:**
  - Component renders overlay with proper styling
  - Dark mode support for all elements
  - Header with title, subtitle, close button
  - Body slot for children content
  - Footer with configurable buttons
  - Error/success message support
  - Loading state with spinner overlay
  - All props optional/configurable
  - TypeScript types complete
  - Unit tests passing

#### Task 1.2: Create useFormState Hook (2-3 hours)
- **File:** `hooks/useFormState.ts`
- **Effort:** 2-3 hours
- **Priority:** HIGH
- **Dependencies:** None
- **Acceptance Criteria:**
  - Hook manages form data, error, loading states
  - Handles field changes with handleChange
  - Implements handleSubmit with error handling
  - Provides reset functionality
  - TypeScript strict mode passing
  - Comprehensive unit tests
  - Integration tests with validation

#### Task 1.3: Create Alert Component (2-3 hours)
- **File:** `components/Common/Alert.tsx`
- **Effort:** 2-3 hours
- **Priority:** HIGH
- **Dependencies:** None
- **Acceptance Criteria:**
  - 4 variants (error, success, warning, info)
  - Dark mode support
  - Icon indicators for each type
  - Dismissible functionality
  - Danger styling for critical alerts
  - Unit tests for all variants
  - TypeScript complete

#### Task 1.4: Modularize API Client (4-5 hours)
- **Files:** Split `api/client.ts` (598 LOC) into 6 modules:
  - `api/workflows.ts` (120 lines)
  - `api/platforms.ts` (100 lines)
  - `api/traces.ts` (80 lines)
  - `api/agents.ts` (60 lines)
  - `api/definitions.ts` (70 lines)
  - `api/stats.ts` (50 lines)
  - Update `api/client.ts` to export from modules (30 lines)
- **Effort:** 4-5 hours
- **Priority:** HIGH
- **Dependencies:** None
- **Acceptance Criteria:**
  - API functions correctly organized by concern
  - All imports updated in 30+ component files
  - No import errors
  - TypeScript clean
  - Build succeeds
  - All tests passing

### Phase 2: Hooks & Utilities (2-3 days, High Priority)

#### Task 2.1: Create useCRUD Hook (3-4 hours)
- **File:** `hooks/useCRUD.ts`
- **Effort:** 3-4 hours
- **Priority:** HIGH
- **Dependencies:** Task 1.4 (API modules)
- **Acceptance Criteria:**
  - Manages item list state
  - Implements create with auto-refetch
  - Implements update with item refresh
  - Implements delete with removal
  - Implements auto-refetch interval
  - Error handling for all operations
  - Comprehensive tests
  - TypeScript strict mode

#### Task 2.2: Create useLoadingState Hook (1-2 hours)
- **File:** `hooks/useLoadingState.ts`
- **Effort:** 1-2 hours
- **Priority:** HIGH
- **Dependencies:** None
- **Acceptance Criteria:**
  - Manages multiple loading states (main, saving, deleting, modal)
  - setLoading helper function
  - JSDoc documentation
  - Unit tests
  - TypeScript complete

#### Task 2.3: Extract Theme Constants (2-3 hours)
- **File:** `constants/theme.ts`
- **Effort:** 2-3 hours
- **Priority:** HIGH
- **Dependencies:** None
- **Acceptance Criteria:**
  - Text, background, border color combinations
  - Status colors (success, error, warning, info)
  - Transitions and spacing utilities
  - All combinations documented with examples
  - Tests validate exports
  - TypeScript complete

#### Task 2.4: Consolidate Formatter Utilities (1-2 hours)
- **File:** Merge `utils/formatters.ts` + `utils/numberFormatters.ts` → `utils/format.ts`
- **Effort:** 1-2 hours
- **Priority:** MEDIUM
- **Dependencies:** None
- **Acceptance Criteria:**
  - All formatters in single file
  - No duplication
  - All imports updated in 10+ files
  - Old file deleted
  - Tests passing
  - Build succeeds

### Phase 3: Page Components & Templates (2-3 days, High Priority)

#### Task 3.1: Create PageTemplate Component (3-4 hours)
- **File:** `components/Layout/PageTemplate.tsx`
- **Effort:** 3-4 hours
- **Priority:** HIGH
- **Dependencies:** Task 1.3 (Alert component)
- **Acceptance Criteria:**
  - Header with title, subtitle, action buttons
  - Error alert display
  - Loading skeleton state
  - Content area (children)
  - Dark mode support
  - Responsive mobile layout
  - Component tests
  - Usage examples documented

#### Task 3.2: Refactor PlatformsPage (2-3 hours)
- **File:** `pages/PlatformsPage.tsx`
- **Effort:** 2-3 hours
- **Priority:** HIGH
- **Dependencies:** Tasks 1.1-1.4, 2.1-2.4, 3.1
- **Acceptance Criteria:**
  - Uses useCRUD hook instead of manual state
  - Uses useLoadingState for consistent naming
  - Uses PageTemplate for layout
  - Uses Alert component for errors
  - Uses theme constants
  - Uses updated API imports
  - ~48% code reduction
  - All tests passing
  - E2E scenario works

#### Task 3.3: Refactor TracesPage (2-3 hours)
- **File:** `pages/TracesPage.tsx`
- **Effort:** 2-3 hours
- **Priority:** HIGH
- **Dependencies:** Phase 1 & 2 complete
- **Acceptance Criteria:**
  - Uses useCRUD hook
  - Uses PageTemplate
  - Uses theme constants
  - ~40% code reduction
  - Tests passing
  - E2E scenario works

#### Task 3.4: Refactor WorkflowsPage (2-3 hours)
- **File:** `pages/WorkflowsPage.tsx`
- **Effort:** 2-3 hours
- **Priority:** HIGH
- **Dependencies:** Phase 1 & 2 complete
- **Acceptance Criteria:**
  - Same refactoring as TracesPage
  - Code simplified
  - Tests passing

#### Task 3.5: Refactor Remaining 9 Pages (4-5 hours)
- **Files:** All other pages (DashboardPage, WorkflowDefinitionsPage, etc)
- **Effort:** 4-5 hours
- **Priority:** HIGH
- **Dependencies:** Phase 1, 2, 3.1 complete
- **Acceptance Criteria:**
  - All pages use PageTemplate
  - All use theme constants
  - All use new hooks as applicable
  - Tests passing
  - No broken functionality
  - Consistent styling

### Phase 4: Polish & Completion (2-3 days, Medium Priority)

#### Task 4.1: Extract Input Components (2-3 hours)
- **Files:** Create `components/Form/` with:
  - `Input.tsx` (70 lines)
  - `TextArea.tsx` (70 lines)
  - `Select.tsx` (80 lines)
  - `Checkbox.tsx` (60 lines)
  - `FormField.tsx` (90 lines)
- **Effort:** 2-3 hours
- **Priority:** MEDIUM
- **Dependencies:** Theme constants (Task 2.3)
- **Acceptance Criteria:**
  - All input components with consistent styling
  - Dark mode support
  - Accessibility features (labels, ARIA)
  - Tests for each component
  - Usage examples documented

#### Task 4.2: Create Status Component Library (1-2 hours)
- **Files:** Create `components/Status/` with:
  - `StatusBadge.tsx` (70 lines)
  - `ProgressIndicator.tsx` (60 lines)
  - `EmptyState.tsx` (70 lines)
  - `LoadingSpinner.tsx` (40 lines)
- **Effort:** 1-2 hours
- **Priority:** MEDIUM
- **Dependencies:** None
- **Acceptance Criteria:**
  - All status components rendering correctly
  - Dark mode support
  - Tests passing
  - Usage documented

#### Task 4.3: Refactor Modal Components (3-4 hours)
- **Files:** All 6 modal files updated to use BaseModal
- **Effort:** 3-4 hours
- **Priority:** MEDIUM
- **Dependencies:** Task 1.1, 1.2, 1.3
- **Modal Files:**
  - SaveWorkflowDefinitionModal
  - CreateMockWorkflowModal
  - StageEditorModal
  - PlatformFormModal
  - DeleteConfirmationModal
  - TaskDetailsModal
- **Acceptance Criteria:**
  - All modals use BaseModal wrapper
  - Form logic uses useFormState if applicable
  - Errors use Alert component
  - ~60 lines reduced per modal
  - Tests passing
  - No functionality lost

#### Task 4.4: Standardize Naming Conventions (1-2 hours)
- **Effort:** 1-2 hours
- **Priority:** MEDIUM
- **Dependencies:** All refactoring complete
- **Acceptance Criteria:**
  - Consistent loading state naming
  - Consistent modal state naming
  - Consistent error state naming
  - No linting errors
  - Tests passing
  - 30+ files updated

#### Task 4.5: Consolidate Type Definitions (1-2 hours)
- **File:** Create `types/components.ts`
- **Effort:** 1-2 hours
- **Priority:** MEDIUM
- **Dependencies:** All components refactored
- **Acceptance Criteria:**
  - All component types in single location
  - No duplicate interfaces
  - All imports updated
  - TypeScript clean
  - Tests passing

#### Task 4.6: Final Validation & Testing (2-3 hours)
- **Effort:** 2-3 hours
- **Priority:** CRITICAL
- **Dependencies:** All tasks complete
- **Validation Steps:**
  - Run full TypeScript check
  - Run linting
  - Run build
  - Run all tests
  - Run E2E dashboard test
  - Manual QA on all pages
  - Dark mode testing
  - Responsive design testing
- **Acceptance Criteria:**
  - Zero TypeScript errors
  - Zero linting errors
  - All tests passing (>80% coverage)
  - Build successful
  - E2E tests pass
  - Manual QA complete
  - No breaking changes

---

## Dependencies & Build Order

### Phase Dependencies

**Phase 1: Foundation (No dependencies)**
- Task 1.1 → 1.2 → 1.3 (can be parallel)
- Task 1.4 (independent)

**Phase 2: Hooks (Depends on Phase 1)**
- Task 2.1 (depends on Task 1.4)
- Tasks 2.2, 2.3, 2.4 (independent)

**Phase 3: Pages (Depends on Phase 1 & 2)**
- Task 3.1 (depends on Task 1.3)
- Tasks 3.2-3.5 (depend on 3.1, Phase 1, Phase 2)

**Phase 4: Polish (Depends on all previous)**
- Tasks 4.1, 4.2 (independent)
- Task 4.3 (depends on 1.1, 1.2, 1.3)
- Tasks 4.4, 4.5 (depend on all refactoring)
- Task 4.6 (final validation, depends on all)

### Build System Integration

**Dashboard package:** `@agentic-sdlc/dashboard`
- No orchestrator dependencies (pure frontend)
- Builds independently: `turbo run build --filter=@agentic-sdlc/dashboard`
- Tests independently: `turbo run test --filter=@agentic-sdlc/dashboard`

### No New External Dependencies Required

- React (existing)
- TypeScript (existing)
- Tailwind CSS (existing)
- Vitest (existing)
- TanStack Query (existing)
- Axios (existing)

---

## Risk Assessment & Mitigation

| # | Risk | Probability | Impact | Severity | Mitigation Strategy |
|---|------|-----------|--------|----------|-------------------|
| 1 | Modal refactoring breaks existing functionality | Low | High | High | Phase testing with E2E, preserve all props, careful prop mapping |
| 2 | API client split causes import errors in 30+ files | Medium | Medium | Medium | Use IDE refactor tools, verify build before commit, systematic updates |
| 3 | Form state consolidation changes form behavior | Low | High | High | Thorough unit testing, manual testing each form, E2E validation |
| 4 | Page refactoring introduces TypeScript errors | Medium | Medium | Medium | Run typecheck after each page, incremental refactoring |
| 5 | Performance regression after refactoring | Low | Medium | Medium | Profile before/after, load testing, monitor bundle size |
| 6 | Naming standardization conflicts with code | Medium | Low | Low | IDE refactor tools, clear standards, review before commit |
| 7 | Dark mode breaks during refactoring | Medium | Low | Medium | Test dark mode on all changes, use theme constants properly |
| 8 | Merge conflicts with concurrent development | Medium | Medium | Medium | Coordinate timing, work on separate branches, frequent syncs |
| 9 | Insufficient test coverage for new components | Medium | Medium | Medium | Require >80% coverage for new files, review tests carefully |
| 10 | Rollback needed after partial refactor | Low | High | High | Incremental commits, E2E test after each phase, easy revert |

### Mitigation Strategies by Phase

**Phase 1:** Create components in isolation, write tests first, use feature branch, run E2E after major components
**Phase 2:** Test hooks with real components, verify imports update correctly, run full build
**Phase 3:** Refactor one page at a time, run E2E after each page, manual QA on each page
**Phase 4:** Final comprehensive testing, manual QA of all pages, E2E scenario validation

---

## Testing Strategy

### Unit Tests (Vitest)
**New Components:**
- BaseModal component rendering and props
- useFormState hook state management
- Alert component variants
- useCRUD hook CRUD operations
- useLoadingState hook
- Input/Status components

**Modified Components:**
- Page components using new hooks
- Modal components with BaseModal wrapper
- Form components using useFormState

**Run:**
```bash
turbo run test --filter=@agentic-sdlc/dashboard
```

**Coverage Targets:**
- New files: >90%
- Modified files: >80%
- Overall: >80%

### Integration Tests (Vitest)
- BaseModal + useFormState + Alert interaction
- PageTemplate + page content integration
- useCRUD + API client integration
- Theme constants + Tailwind classes

### E2E Tests
```bash
./scripts/env/start-dev.sh

# Dashboard functionality
./scripts/run-pipeline-test.sh "Dashboard Page Navigation"
./scripts/run-pipeline-test.sh "Dashboard CRUD Operations"
./scripts/run-pipeline-test.sh "Dashboard Modal Operations"
./scripts/run-pipeline-test.sh "Dashboard Form Submission"
./scripts/run-pipeline-test.sh "Dashboard Dark Mode"

./scripts/env/stop-dev.sh
```

### Build Validation
```bash
# After each phase
turbo run typecheck --filter=@agentic-sdlc/dashboard
turbo run lint --filter=@agentic-sdlc/dashboard
turbo run test --filter=@agentic-sdlc/dashboard

# After Phase 1 & 2
turbo run build --filter=@agentic-sdlc/dashboard

# Final validation
turbo run typecheck
turbo run lint
turbo run test
turbo run build
npm test
./scripts/run-pipeline-test.sh "Dashboard Refactor Final"
```

### Manual QA Checklist
For each refactored page:
- [ ] Page loads without errors
- [ ] All content displays correctly
- [ ] Forms submit successfully
- [ ] Modals open/close
- [ ] Dark mode toggles correctly
- [ ] Mobile layout responsive
- [ ] No console errors

---

## Timeline & Effort

| Phase | Tasks | Hours | Days | Status |
|-------|-------|-------|------|--------|
| Phase 1: Foundation | 1.1-1.4 | 12-15 | 2 days | Pending |
| Phase 2: Hooks & Utilities | 2.1-2.4 | 7-9 | 1 day | Pending |
| Phase 3: Pages & Templates | 3.1-3.5 | 14-17 | 2-3 days | Pending |
| Phase 4: Polish & Completion | 4.1-4.6 | 12-15 | 2 days | Pending |
| **TOTAL** | **18 tasks** | **45-56 hours** | **8-10 days** | |

### Realistic Execution Timeline

- **Week 1:** Phase 1 (Foundation) + Phase 2 (Hooks) = 3-4 days
- **Week 2:** Phase 3 (Pages) = 2-3 days
- **Week 2-3:** Phase 4 (Polish & Completion) = 2-3 days
- **Buffer:** For testing, refactoring, and validation = 1-2 days

**Total: 8-10 business days**

---

## Rollout Plan

### Stage 1: Foundation Components (2-3 days)
- Create BaseModal component
- Create useFormState hook
- Create Alert component
- Modularize API client
- **Commits:**
  - "refactor(dashboard): 1.1 - Extract BaseModal component"
  - "refactor(dashboard): 1.2 - Create useFormState hook"
  - "refactor(dashboard): 1.3 - Create Alert component"
  - "refactor(dashboard): 1.4 - Modularize API client"

### Stage 2: Hooks & Utilities (1-2 days)
- Create useCRUD hook
- Create useLoadingState hook
- Extract theme constants
- Consolidate formatters
- **Commits:**
  - "refactor(dashboard): 2.1 - Create useCRUD hook"
  - "refactor(dashboard): 2.2-2.4 - Add utilities & formatters"

### Stage 3: Page Components (2-3 days)
- Create PageTemplate component
- Refactor all 12 pages
- **Commits:**
  - "refactor(dashboard): 3.1 - Create PageTemplate component"
  - "refactor(dashboard): 3.2-3.5 - Refactor all pages"

### Stage 4: Polish & Completion (2 days)
- Extract input/status components
- Refactor modals to use BaseModal
- Standardize naming
- Final validation
- **Commits:**
  - "refactor(dashboard): 4.1-4.5 - Polish & component extraction"
  - "refactor(dashboard): 4.6 - Final validation & testing"

### Rollback Procedure

**Immediate (15 min):**
```bash
# Revert last commits
git revert HEAD~5..HEAD
./dev rebuild-dashboard  # Rebuild dashboard with previous code
./dev health             # Verify services
```

**Short-term (1-2 hours):**
- Identify which phase broke
- Create fix in separate branch
- Run tests and E2E before merging
- Reapply fixes incrementally

**No Data Loss:**
- Refactoring is code-only (no database changes)
- All existing functionality preserved
- Easy to roll back individual phases

---

## Code Quality Standards

### Component Hierarchy
- **Reusable Components** (components/Common, components/Form, components/Status)
- **Feature Components** (components/Workflows, components/Platforms, etc)
- **Page Components** (pages/)
- **Custom Hooks** (hooks/)
- **Utilities & Constants** (utils/, constants/)

### Standards
- **DRY:** No code duplication (extract shared logic)
- **TypeScript:** Strict mode, no `any` types, 0 errors
- **Naming:** Consistent, clear, self-documenting
- **Dark Mode:** All new components support dark theme
- **Accessibility:** ARIA labels, keyboard navigation
- **Tests:** >80% coverage for new/modified code
- **Performance:** No unnecessary re-renders, efficient hooks
- **Comments:** Only for non-obvious logic

### File Organization After Refactoring

```
dashboard/src/
├── api/
│   ├── client.ts (30 lines - exports)
│   ├── workflows.ts (120 lines)
│   ├── platforms.ts (100 lines)
│   ├── traces.ts (80 lines)
│   ├── agents.ts (60 lines)
│   ├── definitions.ts (70 lines)
│   └── stats.ts (50 lines)
├── components/
│   ├── Common/
│   │   ├── BaseModal.tsx (NEW - Task 1.1)
│   │   ├── Alert.tsx (NEW - Task 1.3)
│   │   └── [existing]
│   ├── Form/ (NEW - Task 4.1)
│   │   ├── Input.tsx
│   │   ├── TextArea.tsx
│   │   ├── Select.tsx
│   │   ├── Checkbox.tsx
│   │   └── FormField.tsx
│   ├── Status/ (NEW - Task 4.2)
│   │   ├── StatusBadge.tsx
│   │   ├── ProgressIndicator.tsx
│   │   ├── EmptyState.tsx
│   │   └── LoadingSpinner.tsx
│   ├── Layout/
│   │   ├── PageTemplate.tsx (NEW - Task 3.1)
│   │   └── [existing]
│   ├── Workflows/ (REFACTORED - Tasks 4.3)
│   ├── Platforms/ (REFACTORED)
│   └── [other components - REFACTORED]
├── hooks/
│   ├── useFormState.ts (NEW - Task 1.2)
│   ├── useCRUD.ts (NEW - Task 2.1)
│   ├── useLoadingState.ts (NEW - Task 2.2)
│   └── [existing]
├── constants/
│   ├── theme.ts (NEW - Task 2.3)
│   └── [existing]
├── types/
│   ├── components.ts (NEW - Task 4.5)
│   └── [existing]
├── utils/
│   ├── format.ts (CONSOLIDATED - Task 2.4)
│   └── [existing]
└── pages/ (ALL REFACTORED - Tasks 3.2-3.5)
```

---

## Implementation Checklist

### Phase 1 Complete
- [ ] BaseModal component created and tested
- [ ] useFormState hook created and tested
- [ ] Alert component created and tested
- [ ] API client split into 6 modules
- [ ] All imports updated (30+ files)
- [ ] Build succeeds
- [ ] TypeScript clean
- [ ] Tests passing

### Phase 2 Complete
- [ ] useCRUD hook implemented and tested
- [ ] useLoadingState hook implemented and tested
- [ ] Theme constants created (200+ classes)
- [ ] Formatters consolidated
- [ ] All imports updated
- [ ] Build succeeds
- [ ] Tests passing

### Phase 3 Complete
- [ ] PageTemplate component created
- [ ] All 12 pages refactored
- [ ] Modal refactoring to use BaseModal
- [ ] Manual QA complete on all pages
- [ ] E2E tests pass
- [ ] Dark mode tested
- [ ] 40-50% code reduction achieved

### Phase 4 Complete
- [ ] Input components extracted
- [ ] Status components created
- [ ] All 6 modals refactored to BaseModal
- [ ] Naming conventions standardized
- [ ] Type definitions consolidated
- [ ] Final validation complete
- [ ] All tests passing
- [ ] No breaking changes

### Overall Success Criteria
- [ ] 50% code reduction (5,000 → 2,500 LOC)
- [ ] 80% duplication reduction
- [ ] Zero TypeScript errors
- [ ] Zero linting errors
- [ ] All tests passing (>80% coverage)
- [ ] E2E tests pass
- [ ] Manual QA complete
- [ ] Code review approved
- [ ] Documentation updated
- [ ] Ready for production merge

---

## Reference Materials

- **Analysis:** DASHBOARD-API-REFACTOR.md
- **Project State:** CLAUDE.md (Session #87-88)
- **Pattern Reference:** Existing modals, pages, hooks
- **Build System:** turbo.json, QUICKSTART-UNIFIED.md
- **Testing:** Vitest configuration, existing test patterns

---

## Next Steps (CODE Phase)

### Immediate Actions
1. Create feature branch: `git checkout -b refactor/dashboard-api`
2. Start with **Phase 1** (Foundation Components)
3. Commit after each task completion
4. Run tests and build validation after each phase

### Phase 1 Tasks (Start Here)
1. **Task 1.1:** Create BaseModal component
   - Reference: Existing modal structure in SaveWorkflowDefinitionModal
   - Render: overlay, header, body, footer, error/success states
   - Test: All props, dark mode, loading states

2. **Task 1.2:** Create useFormState hook
   - Handle: form data, errors, loading, field changes
   - Methods: handleChange, handleSubmit, reset
   - Test: All state transitions

3. **Task 1.3:** Create Alert component
   - Types: error, success, warning, info
   - Features: dismissible, icons, dark mode
   - Test: All variants

4. **Task 1.4:** Split API client
   - Organize: by concern (workflows, platforms, traces, agents, definitions, stats)
   - Update: all 30+ component imports
   - Verify: build succeeds, no errors

### Success Metrics for Phase 1
✅ 4 new foundational components/hooks created
✅ API client properly modularized
✅ All imports updated
✅ Build successful
✅ Tests passing
✅ Ready for Phase 2

### Critical Reminders
- **No breaking changes** - All functionality preserved
- **Dark mode** - All new components support theme toggle
- **TypeScript** - Strict mode, 0 errors, no `any` types
- **Tests** - >80% coverage for new code
- **Incremental** - Commit after each task, test frequently
- **Documentation** - JSDoc for public APIs

---

**Status:** ✅ PLAN COMPLETE
**Ready for CODE Phase:** YES
**Created:** 2025-11-20
**Session:** #88
**Type:** Dashboard Refactoring (Phase 1-4 Implementation)
**Estimated Duration:** 8-10 business days
**Total Tasks:** 18 (organized into 4 phases)
**Expected Outcome:** 50% code reduction, 60-70% maintainability improvement
