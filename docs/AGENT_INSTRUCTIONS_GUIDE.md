# How to Give Agents Instructions in the Pipeline Builder

**Question:** How do we give agents instructions on what to do?

**Answer:** Currently, there are **two levels** where you can configure agent behavior:

---

## Current Implementation

### 1. **Workflow-Level Configuration** (✅ Implemented)

**Field:** `input_data` in the workflow creation request

**Location:** Passed when creating the entire workflow

**Usage:**
```typescript
// API Call
POST /api/v1/workflows
{
  "type": "app",
  "name": "My Workflow",
  "description": "Workflow description",
  "priority": "medium",
  "input_data": {
    // ⭐ AGENT INSTRUCTIONS GO HERE
    "application_type": "e-commerce",
    "description": "Build an online marketplace",
    "industry": "retail",
    "target_market": "Small businesses"
  }
}
```

**How it works:**
- The `input_data` object is stored in the Workflow database record
- When each agent executes, it receives the `input_data` as part of the task payload
- Agents can read configuration from `task.payload` or `task.workflow_context.input_data`

**Example: Product Owner Agent**
```javascript
// In product-owner-agent.ts
async execute(task: AgentEnvelope): Promise<TaskResult> {
  // Extract configuration from payload
  const input = task.payload as RequirementsInput;

  const application_type = input.application_type;  // "e-commerce"
  const description = input.description;            // "Build an online marketplace"
  const industry = input.industry;                  // "retail"

  // Use this data to generate requirements
  const requirements = await this.generateRequirements(input);

  return { ...requirements };
}
```

### 2. **Stage-Level Configuration** (⚠️ NOT Currently Implemented)

**Problem:** There's NO WAY to pass stage-specific instructions to individual agents in the pipeline builder.

**Current WorkflowStage Interface:**
```typescript
export interface WorkflowStage {
  id: string
  order: number
  name: string
  agentType?: string           // Which agent to use
  description?: string          // Human-readable description
  behaviorMetadata: any         // For TESTING (mock agent behavior)
  constraints?: {
    timeout_ms?: number
    max_retries?: number
  }
  // ❌ MISSING: config or payload field
}
```

**What's Missing:**
```typescript
// ❌ This doesn't exist yet
config?: Record<string, any>  // Stage-specific agent configuration
```

---

## Recommendation: Add Stage-Level Configuration

### Why It's Needed

Different stages often need different instructions:

```typescript
// Workflow: "Build E-Commerce Platform"

Stage 1: Product Owner Agent
  config: {
    application_type: "e-commerce",
    industry: "retail",
    key_features: "payment, inventory, reviews"
  }

Stage 2: Scaffold Agent
  config: {
    scaffold_type: "app",
    language: "typescript",
    framework: "react"
  }

Stage 3: Validation Agent
  config: {
    strict_mode: true,
    check_security: true
  }
```

Each agent needs **different configuration**, but currently they all receive the same `input_data`.

---

## Implementation Plan

### Phase 1: Backend Changes (30 minutes)

#### 1.1 Update WorkflowStage Type

**File:** `packages/shared/types/src/workflow/workflow-stage.ts` (or similar)

```typescript
export interface WorkflowStage {
  id: string
  order: number
  name: string
  agent_type: string
  description?: string
  config?: Record<string, any>  // ⭐ ADD THIS
  constraints?: {
    timeout_ms?: number
    max_retries?: number
    required?: boolean
  }
}
```

#### 1.2 Update CreateWorkflowSchema

**File:** `packages/orchestrator/src/types/index.ts`

```typescript
export const CreateWorkflowSchema = z.object({
  type: z.enum(['app', 'feature', 'bugfix']),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  platform_id: z.string().uuid().optional(),
  input_data: z.record(z.unknown()).optional(),  // Workflow-level config
  stages: z.array(z.object({                      // ⭐ ADD THIS
    name: z.string(),
    agent_type: z.string(),
    description: z.string().optional(),
    config: z.record(z.unknown()).optional(),    // ⭐ Stage-specific config
    constraints: z.object({
      timeout_ms: z.number().optional(),
      max_retries: z.number().optional(),
      required: z.boolean().optional()
    }).optional()
  })).optional(),
  behavior_metadata: AgentBehaviorMetadataSchema.optional()
});
```

#### 1.3 Update Task Creation to Include Config

**File:** `packages/orchestrator/src/services/workflow.service.ts`

```typescript
// When creating tasks from stages
const task = {
  task_id: uuid(),
  workflow_id: workflow.id,
  agent_type: stage.agent_type,
  payload: {
    ...workflow.input_data,    // Workflow-level config
    ...stage.config,            // ⭐ Stage-specific config (overrides workflow config)
    workflow_id: workflow.id,
    stage_name: stage.name
  },
  // ... other fields
};
```

### Phase 2: Frontend Changes (45 minutes)

#### 2.1 Update WorkflowStage Interface

**File:** `packages/dashboard/src/components/Workflows/workflowTemplates.ts`

```typescript
export interface WorkflowStage {
  id: string
  order: number
  name: string
  agentType?: string
  description?: string
  config?: Record<string, any>  // ⭐ ADD THIS
  behaviorMetadata: any
  constraints?: {
    timeout_ms?: number
    max_retries?: number
  }
}
```

#### 2.2 Add Config Editor to StageEditorModal

**File:** `packages/dashboard/src/components/Workflows/StageEditorModal.tsx`

```typescript
import { useState } from 'react'
import { WorkflowStage } from './workflowTemplates'
import BehaviorMetadataEditor from './BehaviorMetadataEditor'
import AgentSelector from './AgentSelector'
import AgentConfigEditor from './AgentConfigEditor'  // ⭐ NEW COMPONENT

export default function StageEditorModal({ stage, onUpdate, onClose }: StageEditorModalProps) {
  const [name, setName] = useState(stage.name)
  const [description, setDescription] = useState(stage.description || '')
  const [agentType, setAgentType] = useState(stage.agentType || '')
  const [config, setConfig] = useState(stage.config || {})  // ⭐ ADD THIS
  const [timeoutMs, setTimeoutMs] = useState(stage.constraints?.timeout_ms || 30000)
  const [maxRetries, setMaxRetries] = useState(stage.constraints?.max_retries || 0)
  const [behaviorMetadata, setBehaviorMetadata] = useState(stage.behaviorMetadata)

  const handleSave = () => {
    const updatedStage: WorkflowStage = {
      ...stage,
      name,
      description: description || undefined,
      agentType: agentType || undefined,
      config,  // ⭐ INCLUDE CONFIG
      behaviorMetadata,
      constraints: {
        timeout_ms: timeoutMs,
        max_retries: maxRetries
      }
    }
    onUpdate(updatedStage)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-screen overflow-y-auto">
        {/* ... existing header ... */}

        <form onSubmit={(e) => { e.preventDefault(); handleSave() }} className="p-6 space-y-6">
          {/* ... existing fields ... */}

          {/* ⭐ NEW: Agent Configuration Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Agent Configuration</h3>
            <p className="text-sm text-gray-600">
              Provide instructions and settings specific to this agent
            </p>

            <AgentConfigEditor
              agentType={agentType}
              config={config}
              onChange={setConfig}
            />
          </div>

          {/* ... rest of form ... */}
        </form>
      </div>
    </div>
  )
}
```

#### 2.3 Create AgentConfigEditor Component

**File:** `packages/dashboard/src/components/Workflows/AgentConfigEditor.tsx`

```typescript
/**
 * AgentConfigEditor - Dynamic config editor based on agent's configSchema
 * Fetches agent metadata and generates form fields automatically
 */

import { useState, useEffect } from 'react'
import { fetchJSON, getAPIBase } from '../../api/client'

interface AgentConfigEditorProps {
  agentType: string
  config: Record<string, any>
  onChange: (config: Record<string, any>) => void
}

export default function AgentConfigEditor({ agentType, config, onChange }: AgentConfigEditorProps) {
  const [schema, setSchema] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  // Load agent metadata to get configSchema
  useEffect(() => {
    if (!agentType) {
      setSchema(null)
      return
    }

    setLoading(true)
    fetchJSON(`${getAPIBase()}/agents/${agentType}`)
      .then((agent: any) => {
        setSchema(agent.configSchema || {})
      })
      .catch((error) => {
        console.error('Failed to load agent schema:', error)
        setSchema({})
      })
      .finally(() => setLoading(false))
  }, [agentType])

  if (!agentType) {
    return (
      <div className="text-gray-500 text-sm italic">
        Select an agent type to configure
      </div>
    )
  }

  if (loading) {
    return <div className="text-gray-500 text-sm">Loading configuration options...</div>
  }

  if (!schema || Object.keys(schema).length === 0) {
    return (
      <div className="text-gray-500 text-sm">
        This agent has no configuration options
      </div>
    )
  }

  const handleFieldChange = (key: string, value: any) => {
    onChange({ ...config, [key]: value })
  }

  return (
    <div className="space-y-4 border border-gray-200 rounded-lg p-4 bg-gray-50">
      {Object.entries(schema).map(([key, fieldSchema]: [string, any]) => {
        const currentValue = config[key] ?? fieldSchema.default ?? ''

        return (
          <div key={key}>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              {fieldSchema.description && (
                <span className="text-xs text-gray-500 font-normal ml-2">
                  ({fieldSchema.description})
                </span>
              )}
            </label>

            {fieldSchema.enum ? (
              <select
                value={currentValue}
                onChange={(e) => handleFieldChange(key, e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select...</option>
                {fieldSchema.enum.map((option: string) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : fieldSchema.type === 'boolean' ? (
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={currentValue}
                  onChange={(e) => handleFieldChange(key, e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-600">Enabled</span>
              </label>
            ) : fieldSchema.type === 'number' ? (
              <input
                type="number"
                value={currentValue}
                onChange={(e) => handleFieldChange(key, parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            ) : (
              <textarea
                value={currentValue}
                onChange={(e) => handleFieldChange(key, e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                rows={fieldSchema.type === 'array' ? 3 : 2}
                placeholder={fieldSchema.description || `Enter ${key}`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
```

#### 2.4 Update Workflow Creation to Send Stages

**File:** `packages/dashboard/src/pages/WorkflowPipelineBuilderPage.tsx`

```typescript
const handleCreateWorkflow = async () => {
  try {
    const workflow = await createWorkflow({
      name: workflowName,
      description: workflowDescription,
      type: 'feature',
      priority: 'medium',
      platform_id: selectedPlatformId,
      stages: stages.map(stage => ({        // ⭐ SEND STAGES
        name: stage.name,
        agent_type: stage.agentType!,
        description: stage.description,
        config: stage.config,               // ⭐ INCLUDE CONFIG
        constraints: stage.constraints
      })),
      behavior_metadata: stages[0]?.behaviorMetadata  // For mock testing
    })

    onWorkflowCreated?.(workflow)
  } catch (error) {
    console.error('Failed to create workflow:', error)
  }
}
```

---

## Summary

### Current State
✅ **Workflow-level instructions:** Use `input_data` field (all agents receive same config)
❌ **Stage-level instructions:** Not implemented (can't configure individual agents)

### Recommended Enhancement
Add `config` field to WorkflowStage interface to allow per-stage agent configuration.

**Effort:** ~75 minutes total
- Backend: 30 minutes
- Frontend: 45 minutes

### Workaround (Current)
Until stage-level config is implemented, you can:
1. Put all agent instructions in workflow `input_data`
2. Agents read their specific keys from the shared config
3. Example:
   ```json
   {
     "input_data": {
       "product_owner_application_type": "e-commerce",
       "scaffold_language": "typescript",
       "validation_strict_mode": true
     }
   }
   ```

### Future Enhancement (After Stage Config)
Once implemented, you'll be able to:
1. Edit each stage individually in the pipeline builder
2. See agent-specific form fields dynamically generated from `configSchema`
3. Each agent receives only its relevant configuration
4. Configuration is type-safe and validated

---

## Example Usage (After Implementation)

**Pipeline Builder:**
1. User adds "Product Owner" stage
2. Clicks "Edit Stage"
3. Modal shows dynamically generated form based on product-owner's configSchema:
   - Application Type: [dropdown: web-app, mobile-app, api-service]
   - Description: [textarea]
   - Industry: [text input]
   - Target Market: [text input]
   - Key Features: [textarea]
   - Constraints: [textarea]
4. User fills out form, clicks Save
5. Stage config is stored: `{ application_type: "e-commerce", industry: "retail", ... }`
6. When workflow executes, product-owner agent receives this exact config

**Result:** Each agent gets precisely the instructions it needs, with a user-friendly UI that adapts to each agent's schema!
