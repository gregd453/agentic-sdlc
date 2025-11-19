# Phase 3: Multi-Stage Workflow Builder - Design Document

**Date:** 2025-11-19
**Session:** #82 (Continued) - EPCC CODE Phase
**Status:** DESIGN PHASE
**Estimated Effort:** 2-3 days

---

## Vision

Enable users to visually build complex workflows by:
1. Defining multiple stages/steps in a workflow
2. Assigning behavior to each stage independently
3. Using pre-built templates for common scenarios
4. Preview complete workflow execution flow

---

## Component Architecture

```
WorkflowBuilderPage (existing - Phase 1)
└── CreateMockWorkflowModal
    ├── Basic Form (Phase 1)
    ├── Behavior Selector (Phase 1)
    ├── Advanced Editor (Phase 2)
    └── NEW: WorkflowPipelineBuilder (Phase 3)
        ├── TemplateSelector
        ├── StageList (drag-drop enabled)
        │   └── StageCard (per-stage behavior editor)
        ├── PipelinePreview
        └── Actions (Preview/Execute/Save)
```

---

## Key Features

### 1. Template Selector
**Purpose:** Quick-start workflows for common scenarios

**Templates:**
- **Happy Path:** All stages succeed
- **Error Recovery:** Mix of success/failure scenarios
- **Load Test:** High resource usage scenarios
- **Timeout Chain:** Multiple timeouts at different stages
- **Custom:** Start from blank canvas

**UI:**
- Radio button/card selector
- Shows stages preview for each template
- Descriptions and estimated execution time

### 2. Stage Management
**Capabilities:**
- Add stage (append or insert)
- Remove stage (with confirmation)
- Reorder stages (drag-drop)
- Edit stage properties (name, behavior, constraints)
- Duplicate stage with same behavior

**Stage Properties:**
- Stage name (auto: "Stage 1", "Stage 2", etc.)
- Agent type selector (optional - defaults to auto-assign)
- Behavior configuration (use BehaviorMetadataEditor from Phase 2)
- Stage-specific constraints (timeout, retries)
- Skip/conditional logic (future enhancement)

### 3. Workflow Pipeline Editor (Visual)
**Visual Representation:**
- Stages as connected boxes/cards
- Arrows showing execution flow
- Color coding for behavior type (green=success, red=failure, yellow=timeout, etc.)
- Stage status badges (success rate, error count, etc.)

**Interactions:**
- Click stage to edit in modal
- Drag-drop to reorder
- Hover for quick preview
- Delete button on card

### 4. Per-Stage Behavior Configuration
**UI Integration:**
- Click "Configure" on stage card
- Opens modal with BehaviorMetadataEditor
- Saves configuration to stage
- Shows summary preview on card

**Configuration Scope:**
- Each stage has independent behavior
- Can have different modes (success, failure, timeout, etc.)
- Separate constraints per stage

### 5. Platform-Specific Templates
**Template Categories:**
- Web Apps (8 stages typical)
- Data Pipelines (5-7 stages)
- Mobile Apps (6 stages)
- Infrastructure (4-5 stages)

**Template Structure:**
```typescript
interface WorkflowTemplate {
  id: string
  name: string
  platform: 'web' | 'data' | 'mobile' | 'infra' | 'custom'
  stages: Array<{
    name: string
    behaviorPreset: string
    description?: string
  }>
  estimatedDurationMs?: number
  description?: string
}
```

### 6. Workflow Preview & Execution
**Preview Panel:**
- Visual representation of complete workflow
- Stage execution order
- Behavior summary per stage
- Total estimated duration
- Success rate estimation

**Execute Button:**
- Submit workflow with all stage configurations
- Each stage's behavior metadata included
- Creates single workflow with multi-stage definition

---

## Data Model

### Workflow with Stages
```typescript
interface MultiStageWorkflow {
  name: string
  description?: string
  type: 'app' | 'feature' | 'bugfix'
  priority: 'low' | 'medium' | 'high' | 'critical'
  platform?: string
  stages: WorkflowStage[]
  templateId?: string
}

interface WorkflowStage {
  id: string // UUID for uniqueness
  order: number // Execution order
  name: string // Stage name
  agentType?: string // Optional agent type
  behaviorMetadata: any // From BehaviorMetadataEditor
  constraints?: {
    timeout_ms?: number
    max_retries?: number
  }
}
```

### API Contract
```typescript
POST /api/v1/workflows
{
  name: "Multi-stage test workflow",
  type: "app",
  priority: "medium",
  stages: [
    {
      order: 1,
      name: "Scaffold",
      behaviorMetadata: { mode: 'success', ... }
    },
    {
      order: 2,
      name: "Validate",
      behaviorMetadata: { mode: 'failure', error: { ... } }
    },
    ...
  ]
}
```

---

## Implementation Phases

### Phase 3A: Core Pipeline Editor (Day 1)
1. WorkflowPipelineBuilder component (main container)
2. TemplateSelector component (template chooser)
3. StageList component (drag-drop stage management)
4. StageCard component (individual stage display)
5. Basic stage CRUD operations

### Phase 3B: Stage Configuration (Day 2)
1. StageEditorModal (edit individual stage)
2. Per-stage BehaviorMetadataEditor integration
3. Stage property persistence
4. Stage-specific constraints

### Phase 3C: Templates & Polish (Day 3)
1. WorkflowTemplates service/data
2. Template loading and application
3. PipelinePreview component
4. ExecuteWorkflow integration
5. Tests and documentation

---

## Technical Decisions

### Drag-Drop Implementation
**Choice:** React Beautiful DnD or native HTML5 Drag-Drop
**Rationale:**
- React Beautiful DnD: Better UX, accessibility, but adds dependency
- Native HTML5: Lighter, no deps, but more code
**Decision:** Start with native HTML5, upgrade if needed

### Stage State Management
**Choice:** React Context vs. Local component state
**Rationale:**
- Context: Global access, easier to pass to child components
- Local state: Simpler, less boilerplate
**Decision:** Local state in WorkflowPipelineBuilder, lift to modal as needed

### Behavior Configuration
**Choice:** Reuse BehaviorMetadataEditor or create StageSpecificEditor
**Rationale:**
- Reuse: DRY principle, consistent UX
- New: Stage-specific constraints, less clutter
**Decision:** Reuse BehaviorMetadataEditor with optional stage constraints

### Template Storage
**Choice:** Hardcoded constants vs. database vs. JSON files
**Rationale:**
- Hardcoded: Simple, no DB dependency
- Database: Scalable, user templates
- JSON files: Middle ground
**Decision:** Hardcoded for Phase 3, upgrade to DB in Phase 4+

---

## UX Flow

### User Journey 1: Quick Template
```
1. User opens "Create Mock Workflow"
2. Selects "Phase 3: Multi-stage" (new tab/option)
3. Chooses "Happy Path" template
4. Reviews 5 stages visually
5. Clicks "Execute" → workflow runs with preset behaviors
```

### User Journey 2: Custom Build
```
1. User opens pipeline builder
2. Selects "Custom" (blank canvas)
3. Clicks "Add Stage" 5 times
4. For each stage:
   - Enters stage name
   - Clicks "Configure"
   - Opens BehaviorMetadataEditor
   - Sets failure mode, timeout, etc.
5. Drags stages to reorder
6. Clicks "Preview" to see full flow
7. Clicks "Execute" → workflow runs
```

### User Journey 3: Template Customize
```
1. User selects "Error Recovery" template
2. Template auto-loads 6 stages
3. User clicks stage 3 to edit
4. Changes behavior from "success" to "timeout"
5. Adjusts timeout value
6. Saves and returns to pipeline
7. Reviews updated preview
8. Executes modified template
```

---

## Success Criteria

### Functional
- ✅ Add/remove/reorder stages
- ✅ Per-stage behavior configuration
- ✅ 5+ built-in templates
- ✅ Visual pipeline preview
- ✅ Execute multi-stage workflow
- ✅ Save as template (future)

### Non-Functional
- ✅ Responsive design
- ✅ Keyboard accessible
- ✅ <2 second pipeline render
- ✅ No console errors
- ✅ TypeScript strict mode
- ✅ 80%+ test coverage

### Quality
- ✅ Comprehensive test suite
- ✅ Error handling
- ✅ Input validation
- ✅ Type safety

---

## Dependencies & Constraints

**No new npm packages** (avoid lucide-react issue from Phase 2)
- Use Unicode/emoji for icons
- Use native HTML5 for drag-drop
- Tailwind CSS for styling

**Existing integrations:**
- BehaviorMetadataEditor (Phase 2)
- CreateMockWorkflowModal (Phase 1)
- Workflow API (existing)

---

## Timeline Estimate

| Phase | Task | Estimate |
|-------|------|----------|
| 3A | Core Pipeline Editor | 6-8 hours |
| 3B | Stage Configuration | 4-6 hours |
| 3C | Templates & Polish | 4-6 hours |
| **Total** | **Phase 3** | **14-20 hours** |

---

## Files to Create

1. `WorkflowPipelineBuilder.tsx` (~600 lines)
2. `TemplateSelector.tsx` (~300 lines)
3. `StageList.tsx` (~400 lines)
4. `StageCard.tsx` (~300 lines)
5. `StageEditorModal.tsx` (~300 lines)
6. `PipelinePreview.tsx` (~250 lines)
7. `workflowTemplates.ts` (~200 lines - constants)
8. `WorkflowPipelineBuilder.test.tsx` (~400 lines)

**Total Expected Code:** ~2,350 lines

---

## Next Steps

1. Create WorkflowPipelineBuilder component
2. Implement TemplateSelector
3. Build StageList with drag-drop
4. Add stage configuration modal
5. Create visual preview component
6. Build comprehensive tests
7. Integrate with CreateMockWorkflowModal
8. Document and deploy

---

**Design Complete - Ready for Implementation**
