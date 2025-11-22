# Workflow Definition Guide

**Version:** 1.0.0
**Last Updated:** 2025-11-22
**Status:** Production Ready

---

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Definition Structure](#definition-structure)
4. [Stage Configuration](#stage-configuration)
5. [Advanced Features](#advanced-features)
6. [Best Practices](#best-practices)
7. [API Reference](#api-reference)
8. [Troubleshooting](#troubleshooting)
9. [Examples](#examples)

---

## Overview

### What are Workflow Definitions?

**Workflow Definitions** are declarative specifications that define how work flows through your platform. Instead of hard-coding workflow stages in application code, you define them as data—enabling dynamic, customizable workflows without code changes.

### Why Use Workflow Definitions?

**Benefits:**
- ✅ **Flexibility** - Change workflow stages without redeploying code
- ✅ **Platform-Specific** - Different platforms can have different workflows (web apps ≠ data pipelines)
- ✅ **Custom Agent Types** - Use any agent type (ml-training, data-validation, compliance-checker)
- ✅ **Conditional Routing** - Skip stages based on outcomes (on_success, on_failure)
- ✅ **Version Control** - Track workflow changes over time
- ✅ **Multi-tenant** - Each platform can have multiple workflow variants

### Key Concepts

| Concept | Description |
|---------|-------------|
| **Platform** | A logical grouping of workflows (e.g., "web-app-platform", "ml-platform") |
| **Workflow Definition** | Template specification for how workflows execute |
| **Stage** | A single step in the workflow, executed by an agent |
| **Agent Type** | The type of agent that executes a stage (e.g., "scaffold", "ml-training") |
| **Routing** | Logic for determining the next stage (on_success, on_failure) |

---

## Quick Start

### Create Your First Workflow Definition in 5 Minutes

**Prerequisites:**
- Platform created in the system
- Orchestrator API running on `http://localhost:3051`

**Step 1: Define the Workflow (JSON)**

Create `my-first-workflow.json`:

```json
{
  "name": "simple-web-app",
  "version": "1.0.0",
  "description": "Basic 3-stage web app workflow",
  "enabled": true,
  "definition": {
    "name": "simple-web-app",
    "version": "1.0.0",
    "stages": [
      {
        "name": "scaffold",
        "agent_type": "scaffold",
        "timeout_ms": 300000,
        "max_retries": 3,
        "on_success": "validate",
        "on_failure": "fail_workflow",
        "config": {}
      },
      {
        "name": "validate",
        "agent_type": "validation",
        "timeout_ms": 180000,
        "max_retries": 2,
        "on_success": "deploy",
        "on_failure": "fail_workflow",
        "config": {}
      },
      {
        "name": "deploy",
        "agent_type": "deployment",
        "timeout_ms": 600000,
        "max_retries": 1,
        "on_success": "END",
        "on_failure": "fail_workflow",
        "config": {}
      }
    ],
    "metadata": {
      "author": "your-name",
      "created_at": "2025-11-22",
      "tags": ["web-app", "production"]
    }
  }
}
```

**Step 2: Create the Definition via API**

```bash
# Replace PLATFORM_ID with your platform ID
PLATFORM_ID="550e8400-e29b-41d4-a716-446655440000"

curl -X POST http://localhost:3051/api/v1/platforms/${PLATFORM_ID}/workflow-definitions \
  -H "Content-Type: application/json" \
  -d @my-first-workflow.json
```

**Step 3: Verify Creation**

```bash
curl http://localhost:3051/api/v1/platforms/${PLATFORM_ID}/workflow-definitions
```

**Step 4: Use the Definition**

When creating a workflow, reference the definition:

```bash
curl -X POST http://localhost:3051/api/v1/workflows \
  -H "Content-Type: application/json" \
  -d '{
    "platform_id": "'${PLATFORM_ID}'",
    "workflow_type": "feature",
    "workflow_definition_id": "<DEFINITION_ID_FROM_STEP_2>",
    "metadata": {
      "description": "My first workflow using definitions"
    }
  }'
```

**That's it!** Your workflow will now execute the stages defined in your workflow definition.

---

## Definition Structure

### Top-Level Schema

```typescript
interface WorkflowDefinitionFull {
  // Identification
  name: string;                  // Unique name within platform
  version: string;               // Semver format (1.0.0)
  description?: string;          // Human-readable description

  // Status
  enabled: boolean;              // If false, cannot be used for new workflows

  // Specification
  definition: WorkflowDefinitionSpec;
}
```

### WorkflowDefinitionSpec Schema

```typescript
interface WorkflowDefinitionSpec {
  name: string;                  // Definition name (matches parent)
  version: string;               // Definition version (matches parent)

  // Stages
  stages: StageDefinition[];     // Array of stage configurations

  // Optional metadata
  metadata?: {
    author?: string;
    created_at?: string;
    tags?: string[];
    [key: string]: unknown;
  };
}
```

### StageDefinition Schema

```typescript
interface StageDefinition {
  // Identification
  name: string;                  // Unique stage name (within definition)
  agent_type: string;            // Agent that executes this stage

  // Execution config
  timeout_ms?: number;           // Stage timeout (default: 300000 = 5 min)
  max_retries?: number;          // Retry attempts (default: 3)

  // Routing
  on_success: string;            // Next stage on success ('END' to complete)
  on_failure?: string;           // Next stage on failure ('fail_workflow' | stage name | 'skip')

  // Agent-specific config
  config?: Record<string, unknown>;
}
```

### Validation Rules

1. **Unique Stage Names** - No duplicate `stage.name` within definition
2. **Valid Routing** - `on_success` must reference existing stage or 'END'
3. **No Circular Dependencies** - Topological sort must succeed
4. **Valid Agent Types** - All `agent_type` values must exist in AgentRegistry
5. **First Stage** - First stage in array is the entry point

---

## Stage Configuration

### Agent Types

**Built-in Agent Types:**
- `scaffold` - Project scaffolding
- `validation` - Code validation
- `e2e_test` - End-to-end testing
- `integration` - Integration testing
- `deployment` - Production deployment
- `monitoring` - Health monitoring
- `debug` - Debugging assistance
- `recovery` - Error recovery

**Custom Agent Types** (Platform-specific):
- `ml-training` - Machine learning model training
- `data-validation` - Data quality checks
- `compliance-checker` - Regulatory compliance
- `security-scan` - Security vulnerability scanning
- `performance-test` - Load testing
- Any kebab-case string you define!

### Timeout Configuration

**Guidelines:**
- **Quick tasks:** 60000ms (1 minute)
- **Standard tasks:** 300000ms (5 minutes) - **DEFAULT**
- **Complex tasks:** 600000ms (10 minutes)
- **Long-running:** 1800000ms (30 minutes)

**Example:**

```json
{
  "name": "ml-training",
  "agent_type": "ml-training",
  "timeout_ms": 1800000,  // 30 minutes for model training
  "on_success": "model-evaluation"
}
```

### Retry Configuration

**Guidelines:**
- **Critical stages:** 1-2 retries (deployment, production changes)
- **Standard stages:** 3 retries - **DEFAULT**
- **Flaky operations:** 5+ retries (external API calls, network operations)

**Example:**

```json
{
  "name": "deploy-to-production",
  "agent_type": "deployment",
  "max_retries": 1,  // Don't retry deployments excessively
  "timeout_ms": 600000,
  "on_success": "END"
}
```

### Routing Logic

#### Success Routing

**Options:**
1. **Next Stage:** `"on_success": "validation"` - Continue to validation stage
2. **End Workflow:** `"on_success": "END"` - Complete workflow successfully
3. **Skip Stages:** `"on_success": "deploy"` - Jump directly to deploy (skip intermediate stages)

**Example: Conditional Routing**

```json
{
  "stages": [
    {
      "name": "test",
      "agent_type": "e2e_test",
      "on_success": "deploy",  // Skip manual review if tests pass
      "on_failure": "manual-review"
    },
    {
      "name": "manual-review",
      "agent_type": "validation",
      "on_success": "deploy",
      "on_failure": "fail_workflow"
    },
    {
      "name": "deploy",
      "agent_type": "deployment",
      "on_success": "END"
    }
  ]
}
```

#### Failure Routing

**Options:**
1. **Fail Workflow:** `"on_failure": "fail_workflow"` - Stop and mark workflow as failed
2. **Recovery Stage:** `"on_failure": "error-recovery"` - Attempt automated recovery
3. **Skip Stage:** `"on_failure": "skip"` - Continue to next stage despite failure
4. **Alternative Path:** `"on_failure": "manual-intervention"` - Route to human review

**Example: Error-Tolerant Workflow**

```json
{
  "stages": [
    {
      "name": "optional-optimization",
      "agent_type": "performance-optimizer",
      "on_success": "deploy",
      "on_failure": "skip"  // Continue even if optimization fails
    },
    {
      "name": "deploy",
      "agent_type": "deployment",
      "on_success": "END",
      "on_failure": "rollback"
    },
    {
      "name": "rollback",
      "agent_type": "recovery",
      "on_success": "END",
      "on_failure": "fail_workflow"
    }
  ]
}
```

### Stage Config Object

The `config` object is passed to the agent for stage-specific configuration.

**Example:**

```json
{
  "name": "ml-training",
  "agent_type": "ml-training",
  "config": {
    "model_type": "random-forest",
    "hyperparameters": {
      "n_estimators": 100,
      "max_depth": 10
    },
    "dataset": "s3://my-bucket/training-data.csv",
    "output_path": "s3://my-bucket/models/"
  },
  "on_success": "model-evaluation"
}
```

The agent receives this config in the task payload and can customize behavior.

---

## Advanced Features

### Parallel Execution

**Coming Soon:** Parallel stage execution is planned for a future release.

**Current Workaround:** Use multiple workflows triggered simultaneously.

### Conditional Routing Patterns

#### Pattern 1: Fast Path / Slow Path

```json
{
  "stages": [
    {
      "name": "quick-validation",
      "agent_type": "validation",
      "timeout_ms": 60000,
      "on_success": "deploy",  // Fast path - skip thorough checks
      "on_failure": "thorough-validation"  // Slow path - detailed checks
    },
    {
      "name": "thorough-validation",
      "agent_type": "validation",
      "timeout_ms": 600000,
      "config": { "deep_scan": true },
      "on_success": "deploy",
      "on_failure": "fail_workflow"
    },
    {
      "name": "deploy",
      "agent_type": "deployment",
      "on_success": "END"
    }
  ]
}
```

#### Pattern 2: Progressive Enhancement

```json
{
  "stages": [
    {
      "name": "basic-features",
      "agent_type": "scaffold",
      "on_success": "advanced-features",
      "on_failure": "fail_workflow"
    },
    {
      "name": "advanced-features",
      "agent_type": "scaffold",
      "on_success": "premium-features",
      "on_failure": "skip"  // Continue with basic features only
    },
    {
      "name": "premium-features",
      "agent_type": "scaffold",
      "on_success": "deploy",
      "on_failure": "skip"  // Continue with basic + advanced
    },
    {
      "name": "deploy",
      "agent_type": "deployment",
      "on_success": "END"
    }
  ]
}
```

#### Pattern 3: Cleanup on Failure

```json
{
  "stages": [
    {
      "name": "provision-resources",
      "agent_type": "infrastructure",
      "on_success": "deploy-app",
      "on_failure": "cleanup-resources"
    },
    {
      "name": "deploy-app",
      "agent_type": "deployment",
      "on_success": "END",
      "on_failure": "cleanup-resources"
    },
    {
      "name": "cleanup-resources",
      "agent_type": "infrastructure",
      "config": { "action": "destroy" },
      "on_success": "fail_workflow",
      "on_failure": "fail_workflow"
    }
  ]
}
```

### Error Handling Strategies

#### Strategy 1: Fail Fast

Best for: Critical workflows where any failure should stop execution.

```json
{
  "stages": [
    {
      "name": "security-scan",
      "agent_type": "security-scan",
      "on_success": "deploy",
      "on_failure": "fail_workflow"  // Stop immediately on security issues
    }
  ]
}
```

#### Strategy 2: Best Effort

Best for: Optional enhancements, non-critical features.

```json
{
  "stages": [
    {
      "name": "performance-optimization",
      "agent_type": "performance-optimizer",
      "on_success": "deploy",
      "on_failure": "skip"  // Continue even if optimization fails
    }
  ]
}
```

#### Strategy 3: Automated Recovery

Best for: Transient failures, infrastructure issues.

```json
{
  "stages": [
    {
      "name": "deploy",
      "agent_type": "deployment",
      "on_success": "health-check",
      "on_failure": "rollback"
    },
    {
      "name": "rollback",
      "agent_type": "recovery",
      "config": { "action": "rollback-to-previous" },
      "on_success": "notify-team",
      "on_failure": "fail_workflow"
    },
    {
      "name": "notify-team",
      "agent_type": "monitoring",
      "config": { "alert_level": "critical" },
      "on_success": "fail_workflow",  // Workflow failed, but cleanup succeeded
      "on_failure": "fail_workflow"
    }
  ]
}
```

### Dynamic Configuration

Use the `config` object to parameterize agent behavior:

```json
{
  "stages": [
    {
      "name": "test",
      "agent_type": "e2e_test",
      "config": {
        "test_suite": "regression",
        "environment": "staging",
        "parallel_workers": 4,
        "browser": "chromium"
      },
      "on_success": "deploy"
    }
  ]
}
```

The agent receives `stage.config` in the task envelope and can customize execution.

---

## Best Practices

### Naming Conventions

**Workflow Names:**
- ✅ Use kebab-case: `web-app-production`, `ml-training-pipeline`
- ✅ Be descriptive: `simple-web-app` > `workflow1`
- ✅ Include variant: `web-app-prod`, `web-app-staging`

**Stage Names:**
- ✅ Use lowercase: `scaffold`, `validate`, `deploy`
- ✅ Use verbs or nouns: `test-integration`, `deploy-production`
- ✅ Be specific: `validate-security` > `validate`

**Agent Types:**
- ✅ Use kebab-case: `ml-training`, `data-validation`
- ✅ Be descriptive: `security-scan` > `scan`
- ✅ Namespace if needed: `aws-deploy`, `gcp-deploy`

### Versioning

**Semantic Versioning (semver):**
- **MAJOR.MINOR.PATCH** (e.g., `1.2.3`)
- **MAJOR:** Breaking changes (remove stages, change routing)
- **MINOR:** New features (add optional stages)
- **PATCH:** Bug fixes (fix timeouts, clarify descriptions)

**Example Evolution:**

```
1.0.0 - Initial release (3 stages)
1.1.0 - Added optional security-scan stage
1.2.0 - Added deployment rollback stage
2.0.0 - Changed routing logic (breaking change)
```

**Version Strategy:**
- ✅ Create new version instead of modifying existing
- ✅ Keep old versions for active workflows
- ✅ Disable old versions when obsolete
- ✅ Document version changes in `description`

### Testing Workflow Definitions

**Validation Checklist:**

1. **Schema Validation** - API validates structure automatically
2. **Agent Existence** - Verify all `agent_type` values exist
3. **Routing Logic** - Test all success/failure paths
4. **Timeout Tuning** - Ensure timeouts are realistic
5. **End-to-End Test** - Execute the workflow in staging

**Test Workflow Pattern:**

```bash
# 1. Create test platform
curl -X POST http://localhost:3051/api/v1/platforms \
  -H "Content-Type: application/json" \
  -d '{
    "name": "test-platform",
    "layer": "APPLICATION",
    "description": "Platform for testing workflow definitions"
  }'

# 2. Create workflow definition
curl -X POST http://localhost:3051/api/v1/platforms/${PLATFORM_ID}/workflow-definitions \
  -d @workflow-definition.json

# 3. Execute workflow
curl -X POST http://localhost:3051/api/v1/workflows \
  -d '{
    "platform_id": "'${PLATFORM_ID}'",
    "workflow_type": "test",
    "workflow_definition_id": "'${DEF_ID}'"
  }'

# 4. Monitor execution
curl http://localhost:3051/api/v1/workflows/${WORKFLOW_ID}

# 5. Validate result
# - Did it complete successfully?
# - Did routing work as expected?
# - Were timeouts appropriate?
```

### Security Considerations

**1. Validate Agent Types**

Before deploying, ensure all agent types in your definition are trusted:

```bash
# List available agents for platform
curl http://localhost:3051/api/v1/platforms/${PLATFORM_ID}/agents
```

**2. Limit Retries**

For stages that interact with external systems or perform destructive actions:

```json
{
  "name": "send-notification",
  "agent_type": "notification",
  "max_retries": 1,  // Don't spam users with duplicate notifications
  "on_failure": "fail_workflow"
}
```

**3. Timeout Protection**

Always set reasonable timeouts to prevent runaway processes:

```json
{
  "name": "long-running-task",
  "agent_type": "ml-training",
  "timeout_ms": 1800000,  // 30 minutes max
  "on_failure": "fail_workflow"
}
```

**4. Sensitive Config**

Never store secrets in `config`:

```json
// ❌ WRONG
{
  "name": "deploy",
  "config": {
    "api_key": "secret123"  // NEVER do this!
  }
}

// ✅ CORRECT
{
  "name": "deploy",
  "config": {
    "secret_name": "prod-api-key"  // Reference to secret manager
  }
}
```

### Performance Optimization

**1. Minimize Stage Count**

Each stage adds latency (state transitions, network overhead).

```json
// ❌ EXCESSIVE
["prepare", "validate-step1", "validate-step2", "validate-step3", "deploy"]

// ✅ OPTIMIZED
["prepare", "validate", "deploy"]  // Combine related steps
```

**2. Tune Timeouts**

Don't use excessive timeouts for quick operations:

```json
// ❌ WASTEFUL
{
  "name": "quick-check",
  "timeout_ms": 600000  // 10 minutes for a 10-second task
}

// ✅ OPTIMIZED
{
  "name": "quick-check",
  "timeout_ms": 60000  // 1 minute is sufficient
}
```

**3. Progressive Timeouts**

Use shorter timeouts for early stages:

```json
{
  "stages": [
    {
      "name": "quick-validation",
      "timeout_ms": 60000  // 1 minute
    },
    {
      "name": "thorough-validation",
      "timeout_ms": 300000  // 5 minutes
    },
    {
      "name": "deployment",
      "timeout_ms": 600000  // 10 minutes
    }
  ]
}
```

---

## API Reference

### Base URL

```
http://localhost:3051/api/v1
```

Replace `localhost:3051` with your orchestrator API host.

---

### Create Workflow Definition

**Endpoint:** `POST /platforms/:platformId/workflow-definitions`

**Description:** Creates a new workflow definition for a platform.

**Request:**

```bash
curl -X POST http://localhost:3051/api/v1/platforms/${PLATFORM_ID}/workflow-definitions \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-workflow",
    "version": "1.0.0",
    "description": "My custom workflow",
    "enabled": true,
    "definition": {
      "name": "my-workflow",
      "version": "1.0.0",
      "stages": [
        {
          "name": "stage1",
          "agent_type": "scaffold",
          "on_success": "END"
        }
      ]
    }
  }'
```

**Response (201 Created):**

```json
{
  "id": "def-550e8400-e29b-41d4-a716-446655440000",
  "platform_id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "my-workflow",
  "version": "1.0.0",
  "description": "My custom workflow",
  "enabled": true,
  "definition": { /* full definition */ },
  "created_at": "2025-11-22T10:00:00Z",
  "updated_at": "2025-11-22T10:00:00Z"
}
```

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 400 | Validation Error | Invalid definition structure |
| 404 | Platform Not Found | Platform ID doesn't exist |
| 409 | Conflict | Definition with name already exists |

---

### List Workflow Definitions

**Endpoint:** `GET /platforms/:platformId/workflow-definitions`

**Description:** Lists all workflow definitions for a platform.

**Request:**

```bash
curl http://localhost:3051/api/v1/platforms/${PLATFORM_ID}/workflow-definitions
```

**Response (200 OK):**

```json
{
  "platform_id": "550e8400-e29b-41d4-a716-446655440000",
  "definitions": [
    {
      "id": "def-1",
      "name": "simple-workflow",
      "version": "1.0.0",
      "enabled": true,
      "stage_count": 3
    },
    {
      "id": "def-2",
      "name": "complex-workflow",
      "version": "2.1.0",
      "enabled": false,
      "stage_count": 7
    }
  ],
  "total": 2
}
```

---

### Get Workflow Definition

**Endpoint:** `GET /workflow-definitions/:id`

**Description:** Retrieves a specific workflow definition by ID.

**Request:**

```bash
curl http://localhost:3051/api/v1/workflow-definitions/${DEF_ID}
```

**Response (200 OK):**

```json
{
  "id": "def-550e8400-e29b-41d4-a716-446655440000",
  "platform_id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "my-workflow",
  "version": "1.0.0",
  "description": "My custom workflow",
  "enabled": true,
  "definition": {
    "name": "my-workflow",
    "version": "1.0.0",
    "stages": [
      {
        "name": "scaffold",
        "agent_type": "scaffold",
        "timeout_ms": 300000,
        "max_retries": 3,
        "on_success": "validate",
        "on_failure": "fail_workflow"
      }
    ]
  }
}
```

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 404 | Not Found | Definition ID doesn't exist |

---

### Update Workflow Definition

**Endpoint:** `PUT /workflow-definitions/:id`

**Description:** Updates an existing workflow definition.

**Request:**

```bash
curl -X PUT http://localhost:3051/api/v1/workflow-definitions/${DEF_ID} \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Updated description",
    "enabled": false
  }'
```

**Response (200 OK):**

```json
{
  "id": "def-550e8400-e29b-41d4-a716-446655440000",
  "description": "Updated description",
  "enabled": false,
  "updated_at": "2025-11-22T11:00:00Z"
}
```

---

### Delete Workflow Definition

**Endpoint:** `DELETE /workflow-definitions/:id`

**Description:** Deletes a workflow definition. Active workflows using this definition are not affected.

**Request:**

```bash
curl -X DELETE http://localhost:3051/api/v1/workflow-definitions/${DEF_ID}
```

**Response (204 No Content):**

```
(empty body)
```

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 404 | Not Found | Definition ID doesn't exist |

---

### Toggle Workflow Definition

**Endpoint:** `PATCH /workflow-definitions/:id/enabled`

**Description:** Enables or disables a workflow definition.

**Request:**

```bash
curl -X PATCH http://localhost:3051/api/v1/workflow-definitions/${DEF_ID}/enabled \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": false
  }'
```

**Response (200 OK):**

```json
{
  "id": "def-550e8400-e29b-41d4-a716-446655440000",
  "enabled": false,
  "updated_at": "2025-11-22T11:00:00Z"
}
```

---

### Create Workflow Using Definition

**Endpoint:** `POST /workflows`

**Description:** Creates a new workflow instance using a workflow definition.

**Request:**

```bash
curl -X POST http://localhost:3051/api/v1/workflows \
  -H "Content-Type: application/json" \
  -d '{
    "platform_id": "'${PLATFORM_ID}'",
    "workflow_type": "feature",
    "workflow_definition_id": "'${DEF_ID}'",
    "metadata": {
      "feature_name": "user-authentication"
    }
  }'
```

**Response (201 Created):**

```json
{
  "id": "wf-550e8400-e29b-41d4-a716-446655440000",
  "platform_id": "550e8400-e29b-41d4-a716-446655440000",
  "workflow_definition_id": "def-550e8400-e29b-41d4-a716-446655440000",
  "status": "pending",
  "current_stage": "scaffold",
  "progress": 0,
  "created_at": "2025-11-22T12:00:00Z"
}
```

---

## Troubleshooting

### Common Errors

#### Error: "Definition with name already exists"

**Cause:** Attempting to create a definition with a name that already exists on the platform.

**Solution:**
```bash
# Option 1: Use a different name
"name": "my-workflow-v2"

# Option 2: Delete the existing definition
curl -X DELETE http://localhost:3051/api/v1/workflow-definitions/${OLD_DEF_ID}

# Option 3: Update the existing definition
curl -X PUT http://localhost:3051/api/v1/workflow-definitions/${DEF_ID} -d '{...}'
```

---

#### Error: "Circular dependency detected"

**Cause:** Stages reference each other in a cycle (A → B → C → A).

**Solution:**

```json
// ❌ WRONG (circular)
{
  "stages": [
    { "name": "A", "on_success": "B" },
    { "name": "B", "on_success": "C" },
    { "name": "C", "on_success": "A" }  // Points back to A!
  ]
}

// ✅ CORRECT
{
  "stages": [
    { "name": "A", "on_success": "B" },
    { "name": "B", "on_success": "C" },
    { "name": "C", "on_success": "END" }  // Terminates
  ]
}
```

---

#### Error: "Invalid on_success reference"

**Cause:** `on_success` points to a stage that doesn't exist.

**Solution:**

```json
// ❌ WRONG
{
  "stages": [
    { "name": "A", "on_success": "nonexistent-stage" }
  ]
}

// ✅ CORRECT
{
  "stages": [
    { "name": "A", "on_success": "B" },
    { "name": "B", "on_success": "END" }
  ]
}
```

Valid `on_success` values:
- Existing stage name: `"validate"`
- End workflow: `"END"`

---

#### Error: "Agent type 'ml-trainng' not found. Did you mean 'ml-training'?"

**Cause:** Typo in `agent_type` value.

**Solution:**

```bash
# List available agents for your platform
curl http://localhost:3051/api/v1/platforms/${PLATFORM_ID}/agents

# Fix typo in definition
{
  "agent_type": "ml-training"  // Corrected spelling
}
```

---

#### Error: "Workflow definition is disabled"

**Cause:** Attempting to use a disabled definition for a new workflow.

**Solution:**

```bash
# Enable the definition
curl -X PATCH http://localhost:3051/api/v1/workflow-definitions/${DEF_ID}/enabled \
  -d '{"enabled": true}'
```

---

### Debugging Workflows

**Check Workflow Status:**

```bash
curl http://localhost:3051/api/v1/workflows/${WORKFLOW_ID}
```

**Check Current Stage:**

```json
{
  "id": "wf-123",
  "current_stage": "validate",  // Stage workflow is stuck on
  "status": "in_progress",
  "progress": 33
}
```

**Check Stage Tasks:**

```bash
curl http://localhost:3051/api/v1/workflows/${WORKFLOW_ID}/tasks
```

**Check Agent Logs:**

```bash
# View orchestrator logs
pnpm pm2:logs orchestrator

# View specific agent logs
pnpm pm2:logs scaffold-agent
```

**Common Issues:**

| Symptom | Possible Cause | Solution |
|---------|---------------|----------|
| Workflow stuck on stage | Agent timeout too short | Increase `timeout_ms` |
| Workflow fails immediately | Invalid agent_type | Verify agent exists |
| Progress not updating | State machine not running | Check orchestrator logs |
| Routing doesn't work | Incorrect `on_success` value | Verify stage names |

---

## Examples

### Example 1: Simple 3-Stage Web App Workflow

**Use Case:** Basic web application development workflow.

**Stages:**
1. Scaffold - Generate project structure
2. Validate - Run linters and type checks
3. Deploy - Deploy to production

```json
{
  "name": "simple-web-app",
  "version": "1.0.0",
  "description": "Basic 3-stage web app workflow",
  "enabled": true,
  "definition": {
    "name": "simple-web-app",
    "version": "1.0.0",
    "stages": [
      {
        "name": "scaffold",
        "agent_type": "scaffold",
        "timeout_ms": 300000,
        "max_retries": 3,
        "on_success": "validate",
        "on_failure": "fail_workflow",
        "config": {
          "template": "react-typescript",
          "package_manager": "pnpm"
        }
      },
      {
        "name": "validate",
        "agent_type": "validation",
        "timeout_ms": 180000,
        "max_retries": 2,
        "on_success": "deploy",
        "on_failure": "fail_workflow",
        "config": {
          "run_linter": true,
          "run_type_check": true
        }
      },
      {
        "name": "deploy",
        "agent_type": "deployment",
        "timeout_ms": 600000,
        "max_retries": 1,
        "on_success": "END",
        "on_failure": "fail_workflow",
        "config": {
          "environment": "production",
          "region": "us-west-2"
        }
      }
    ],
    "metadata": {
      "author": "platform-team",
      "created_at": "2025-11-22",
      "tags": ["web-app", "production", "simple"]
    }
  }
}
```

**Create this definition:**

```bash
curl -X POST http://localhost:3051/api/v1/platforms/${PLATFORM_ID}/workflow-definitions \
  -H "Content-Type: application/json" \
  -d @examples/simple-web-app.json
```

---

### Example 2: Complex Data Pipeline with Conditional Routing

**Use Case:** Data processing pipeline with optional optimization and validation stages.

**Stages:**
1. Ingest - Load raw data
2. Validate - Check data quality (skip on failure)
3. Transform - Apply transformations
4. Optimize - Optional performance tuning (skip on failure)
5. Load - Write to database
6. Verify - Confirm data integrity

```json
{
  "name": "data-pipeline-advanced",
  "version": "2.0.0",
  "description": "7-stage data pipeline with conditional routing",
  "enabled": true,
  "definition": {
    "name": "data-pipeline-advanced",
    "version": "2.0.0",
    "stages": [
      {
        "name": "ingest",
        "agent_type": "data-ingestion",
        "timeout_ms": 600000,
        "max_retries": 3,
        "on_success": "validate-raw",
        "on_failure": "fail_workflow",
        "config": {
          "source": "s3://data-lake/raw/",
          "format": "parquet"
        }
      },
      {
        "name": "validate-raw",
        "agent_type": "data-validation",
        "timeout_ms": 300000,
        "max_retries": 2,
        "on_success": "transform",
        "on_failure": "skip",
        "config": {
          "schema_validation": true,
          "null_check": true,
          "duplicate_check": true
        }
      },
      {
        "name": "transform",
        "agent_type": "data-transformation",
        "timeout_ms": 900000,
        "max_retries": 2,
        "on_success": "optimize",
        "on_failure": "fail_workflow",
        "config": {
          "transformations": ["normalize", "aggregate", "enrich"]
        }
      },
      {
        "name": "optimize",
        "agent_type": "data-optimizer",
        "timeout_ms": 600000,
        "max_retries": 1,
        "on_success": "load",
        "on_failure": "skip",
        "config": {
          "compression": "snappy",
          "partition_by": "date"
        }
      },
      {
        "name": "load",
        "agent_type": "data-loader",
        "timeout_ms": 600000,
        "max_retries": 3,
        "on_success": "verify",
        "on_failure": "cleanup",
        "config": {
          "destination": "postgresql://data-warehouse/analytics",
          "batch_size": 10000
        }
      },
      {
        "name": "verify",
        "agent_type": "data-validation",
        "timeout_ms": 300000,
        "max_retries": 2,
        "on_success": "END",
        "on_failure": "cleanup",
        "config": {
          "row_count_check": true,
          "integrity_check": true
        }
      },
      {
        "name": "cleanup",
        "agent_type": "data-cleanup",
        "timeout_ms": 180000,
        "max_retries": 1,
        "on_success": "fail_workflow",
        "on_failure": "fail_workflow",
        "config": {
          "delete_temp_files": true
        }
      }
    ],
    "metadata": {
      "author": "data-engineering-team",
      "created_at": "2025-11-22",
      "tags": ["data-pipeline", "etl", "conditional-routing"]
    }
  }
}
```

**Key Features:**
- ✅ Skip validation failures (best-effort data quality)
- ✅ Skip optimization failures (continue with unoptimized data)
- ✅ Cleanup on load/verify failure

---

### Example 3: ML Training Workflow with Parallel Validation

**Use Case:** Machine learning model training with comprehensive validation.

**Stages:**
1. Prepare Data - Feature engineering
2. Train Model - Model training
3. Evaluate Model - Performance metrics
4. Validate Bias - Fairness checks
5. Deploy Model - Production deployment
6. Monitor - Real-time monitoring

```json
{
  "name": "ml-training-production",
  "version": "1.2.0",
  "description": "ML model training with validation stages",
  "enabled": true,
  "definition": {
    "name": "ml-training-production",
    "version": "1.2.0",
    "stages": [
      {
        "name": "prepare-data",
        "agent_type": "data-preparation",
        "timeout_ms": 900000,
        "max_retries": 2,
        "on_success": "train-model",
        "on_failure": "fail_workflow",
        "config": {
          "feature_engineering": true,
          "train_test_split": 0.8,
          "normalization": "standard-scaler"
        }
      },
      {
        "name": "train-model",
        "agent_type": "ml-training",
        "timeout_ms": 1800000,
        "max_retries": 1,
        "on_success": "evaluate-model",
        "on_failure": "fail_workflow",
        "config": {
          "model_type": "gradient-boosting",
          "hyperparameters": {
            "n_estimators": 100,
            "learning_rate": 0.1,
            "max_depth": 5
          },
          "early_stopping": true
        }
      },
      {
        "name": "evaluate-model",
        "agent_type": "ml-evaluation",
        "timeout_ms": 300000,
        "max_retries": 2,
        "on_success": "validate-bias",
        "on_failure": "fail_workflow",
        "config": {
          "metrics": ["accuracy", "precision", "recall", "f1"],
          "threshold": 0.85
        }
      },
      {
        "name": "validate-bias",
        "agent_type": "ml-bias-validation",
        "timeout_ms": 300000,
        "max_retries": 1,
        "on_success": "deploy-model",
        "on_failure": "fail_workflow",
        "config": {
          "fairness_metrics": ["demographic-parity", "equal-opportunity"],
          "protected_attributes": ["gender", "age"]
        }
      },
      {
        "name": "deploy-model",
        "agent_type": "ml-deployment",
        "timeout_ms": 600000,
        "max_retries": 2,
        "on_success": "monitor-model",
        "on_failure": "rollback",
        "config": {
          "deployment_strategy": "canary",
          "traffic_split": 0.1,
          "endpoint": "https://api.example.com/predict"
        }
      },
      {
        "name": "monitor-model",
        "agent_type": "ml-monitoring",
        "timeout_ms": 180000,
        "max_retries": 1,
        "on_success": "END",
        "on_failure": "skip",
        "config": {
          "metrics": ["latency", "prediction-drift"],
          "alert_threshold": 0.95
        }
      },
      {
        "name": "rollback",
        "agent_type": "ml-deployment",
        "timeout_ms": 300000,
        "max_retries": 1,
        "on_success": "fail_workflow",
        "on_failure": "fail_workflow",
        "config": {
          "action": "rollback-to-previous"
        }
      }
    ],
    "metadata": {
      "author": "ml-platform-team",
      "created_at": "2025-11-22",
      "tags": ["machine-learning", "production", "bias-validation"]
    }
  }
}
```

**Key Features:**
- ✅ Long timeouts for model training (30 minutes)
- ✅ Automated rollback on deployment failure
- ✅ Optional monitoring (skip on failure)
- ✅ Bias validation before deployment

---

## Additional Resources

**Documentation:**
- [Platform Onboarding Guide](./PLATFORM_ONBOARDING.md)
- [Workflow Migration Guide](./WORKFLOW_MIGRATION_GUIDE.md)
- [Agent Creation Guide](./AGENT_CREATION_GUIDE.md)
- [Surface Architecture V3](./SURFACE-ARCH-V3.md)

**Templates:**
- [Web App Workflow Template](./templates/web-app-workflow.yaml)
- [Data Pipeline Workflow Template](./templates/data-pipeline-workflow.yaml)
- [Platform Configuration Template](./templates/platform-config.json)
- [REST Surface Configuration Template](./templates/surface-config-rest.json)

**API Documentation:**
- [Orchestrator API Reference](../packages/orchestrator/README.md)
- [Workflow API Endpoints](../packages/orchestrator/src/api/routes/README.md)

**Support:**
- GitHub Issues: [agentic-sdlc/issues](https://github.com/gregd453/agentic-sdlc/issues)
- CLAUDE.md: [Platform Overview](../CLAUDE.md)

---

**END OF GUIDE**

**Version:** 1.0.0
**Last Updated:** 2025-11-22
**Maintained by:** Platform Team
