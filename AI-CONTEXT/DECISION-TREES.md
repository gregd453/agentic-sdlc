# DECISION TREES FOR AI AGENTS

**Purpose:** Decision-making guidelines for autonomous agent operations

---

## Master Decision Flow

```
START
  │
  ├─> Is this a new task?
  │     ├─ Yes: Go to TASK_ACCEPTANCE
  │     └─ No: Go to TASK_CONTINUATION
  │
  ├─> Did an error occur?
  │     ├─ Yes: Go to ERROR_HANDLING
  │     └─ No: Continue current operation
  │
  └─> Is human input needed?
        ├─ Yes: Go to HUMAN_ESCALATION
        └─ No: Continue autonomously
```

---

## Task Acceptance Decision Tree

```
TASK_ACCEPTANCE:
  │
  ├─> Is the task schema valid?
  │     ├─ No: REJECT with validation error
  │     └─ Yes: Continue
  │
  ├─> Do I have required capabilities?
  │     ├─ No: TRANSFER to appropriate agent
  │     └─ Yes: Continue
  │
  ├─> Are dependencies satisfied?
  │     ├─ No: QUEUE until dependencies ready
  │     └─ Yes: Continue
  │
  ├─> Is confidence > 80%?
  │     ├─ No: REQUEST_CLARIFICATION
  │     └─ Yes: Continue
  │
  └─> ACCEPT_TASK and begin execution
```

### Implementation

```typescript
async function evaluateTaskAcceptance(task: Task): Promise<TaskDecision> {
  // Validate schema
  try {
    TaskSchema.parse(task);
  } catch (error) {
    return {
      decision: 'reject',
      reason: 'Invalid task schema',
      details: error
    };
  }

  // Check capabilities
  const requiredCapabilities = extractRequiredCapabilities(task);
  const hasCapabilities = checkCapabilities(this.capabilities, requiredCapabilities);

  if (!hasCapabilities) {
    return {
      decision: 'transfer',
      targetAgent: findCapableAgent(requiredCapabilities),
      reason: 'Missing required capabilities'
    };
  }

  // Check dependencies
  const dependencies = await checkDependencies(task.dependencies);

  if (!dependencies.allSatisfied) {
    return {
      decision: 'queue',
      waitingFor: dependencies.missing,
      reason: 'Dependencies not satisfied'
    };
  }

  // Assess confidence
  const confidence = await assessConfidence(task);

  if (confidence < 80) {
    return {
      decision: 'clarify',
      questions: generateClarifyingQuestions(task),
      confidence: confidence
    };
  }

  return {
    decision: 'accept',
    confidence: confidence
  };
}
```

---

## Error Handling Decision Tree

```
ERROR_HANDLING:
  │
  ├─> Is error recoverable?
  │     ├─ No: Go to FAILURE_HANDLING
  │     └─ Yes: Continue
  │
  ├─> Have we retried < 3 times?
  │     ├─ No: Go to ESCALATION
  │     └─ Yes: Continue
  │
  ├─> Is it a timeout error?
  │     ├─ Yes: INCREASE_TIMEOUT and retry
  │     └─ No: Continue
  │
  ├─> Is it a dependency error?
  │     ├─ Yes: RESOLVE_DEPENDENCY and retry
  │     └─ No: Continue
  │
  ├─> Is it a validation error?
  │     ├─ Yes: FIX_VALIDATION and retry
  │     └─ No: USE_FALLBACK strategy
  │
  └─> RETRY with exponential backoff
```

### Implementation

```typescript
async function handleError(error: Error, context: ErrorContext): Promise<ErrorResolution> {
  // Check if recoverable
  if (!isRecoverable(error)) {
    return handleFailure(error, context);
  }

  // Check retry count
  if (context.retryCount >= 3) {
    return escalateError(error, context);
  }

  // Specific error handlers
  if (error instanceof TimeoutError) {
    return {
      action: 'retry',
      modifications: {
        timeout: context.timeout * 2
      },
      delay: 1000
    };
  }

  if (error instanceof DependencyError) {
    await resolveDependency(error.dependency);
    return {
      action: 'retry',
      delay: 5000
    };
  }

  if (error instanceof ValidationError) {
    const fixed = await attemptAutoFix(error);
    if (fixed) {
      return {
        action: 'retry',
        modifications: fixed,
        delay: 0
      };
    }
  }

  // Default: retry with backoff
  return {
    action: 'retry',
    delay: Math.pow(2, context.retryCount) * 1000
  };
}
```

---

## Scaffold Agent Decision Tree

```
SCAFFOLD_DECISION:
  │
  ├─> What type of scaffold?
  │     ├─ App: Use APP_TEMPLATE
  │     ├─ Service: Use SERVICE_TEMPLATE
  │     ├─ Library: Use LIBRARY_TEMPLATE
  │     └─ Custom: ANALYZE_REQUIREMENTS
  │
  ├─> Does template exist?
  │     ├─ No: GENERATE_FROM_REQUIREMENTS
  │     └─ Yes: Continue
  │
  ├─> Are there special requirements?
  │     ├─ Yes: CUSTOMIZE_TEMPLATE
  │     └─ No: Use default
  │
  ├─> Should include tests?
  │     ├─ Yes: ADD_TEST_STRUCTURE
  │     └─ No: Continue
  │
  ├─> Should include CI/CD?
  │     ├─ Yes: ADD_PIPELINE_CONFIG
  │     └─ No: Continue
  │
  └─> GENERATE_PROJECT
```

---

## Validation Agent Decision Tree

```
VALIDATION_DECISION:
  │
  ├─> What validation level?
  │     ├─ Quick: BASIC_CHECKS only
  │     ├─ Standard: STANDARD_VALIDATION
  │     └─ Comprehensive: FULL_VALIDATION
  │
  ├─> TypeScript compilation check
  │     ├─ Failed: Can auto-fix?
  │     │     ├─ Yes: FIX_TYPES and retry
  │     │     └─ No: REPORT_ERROR
  │     └─ Passed: Continue
  │
  ├─> Linting check
  │     ├─ Warnings: AUTO_FIX_LINT
  │     ├─ Errors: REPORT_ISSUES
  │     └─ Clean: Continue
  │
  ├─> Test coverage check
  │     ├─ < 80%: Generate missing tests?
  │     │     ├─ Yes: GENERATE_TESTS
  │     │     └─ No: REPORT_LOW_COVERAGE
  │     └─ >= 80%: Continue
  │
  ├─> Security scan
  │     ├─ Critical issues: BLOCK_PROGRESS
  │     ├─ High issues: Can remediate?
  │     │     ├─ Yes: AUTO_REMEDIATE
  │     │     └─ No: REQUEST_REVIEW
  │     └─ Clean: Continue
  │
  └─> VALIDATION_COMPLETE
```

---

## Deployment Agent Decision Tree

```
DEPLOYMENT_DECISION:
  │
  ├─> What environment?
  │     ├─ Development: QUICK_DEPLOY
  │     ├─ Staging: STANDARD_DEPLOY
  │     └─ Production: CAREFUL_DEPLOY
  │
  ├─> Are all tests passing?
  │     ├─ No: BLOCK_DEPLOYMENT
  │     └─ Yes: Continue
  │
  ├─> Is this a breaking change?
  │     ├─ Yes: Use BLUE_GREEN deployment
  │     └─ No: Use ROLLING deployment
  │
  ├─> Health check after deployment
  │     ├─ Failed: ROLLBACK immediately
  │     └─ Passed: Continue
  │
  ├─> Monitor for 5 minutes
  │     ├─ Errors detected: Assess severity
  │     │     ├─ Critical: ROLLBACK
  │     │     └─ Minor: LOG_ISSUES
  │     └─ Stable: Continue
  │
  └─> DEPLOYMENT_SUCCESS
```

---

## Sprint Management Decision Tree

```
SPRINT_DECISION:
  │
  ├─> Is this sprint start?
  │     ├─ Yes: PLAN_SPRINT
  │     └─ No: Continue
  │
  ├─> Is this daily standup time?
  │     ├─ Yes: COLLECT_UPDATES
  │     └─ No: Continue
  │
  ├─> Are there blockers?
  │     ├─ Yes: Can resolve automatically?
  │     │     ├─ Yes: RESOLVE_BLOCKER
  │     │     └─ No: ESCALATE_BLOCKER
  │     └─ No: Continue
  │
  ├─> Is sprint ending?
  │     ├─ Yes: Are all tests passing?
  │     │     ├─ Yes: COMPLETE_SPRINT
  │     │     └─ No: EXTEND_OR_REDUCE scope
  │     └─ No: Continue normal work
  │
  └─> CONTINUE_SPRINT_WORK
```

---

## Human Escalation Decision Tree

```
HUMAN_ESCALATION:
  │
  ├─> What type of escalation?
  │     ├─ Decision needed: Go to DECISION_REQUEST
  │     ├─ Clarification: Go to CLARIFICATION_REQUEST
  │     ├─ Approval: Go to APPROVAL_REQUEST
  │     └─ Emergency: Go to EMERGENCY_ALERT
  │
  ├─> DECISION_REQUEST:
  │     ├─ Generate options with pros/cons
  │     ├─ Calculate confidence for each
  │     ├─ Present via UI/Slack/Email
  │     └─ Wait for response (timeout: 30 min)
  │
  ├─> CLARIFICATION_REQUEST:
  │     ├─ Generate specific questions
  │     ├─ Provide context
  │     ├─ Suggest possible answers
  │     └─ Wait for response (timeout: 1 hour)
  │
  ├─> APPROVAL_REQUEST:
  │     ├─ Summarize action to be taken
  │     ├─ List risks and mitigation
  │     ├─ Request approval
  │     └─ Wait for response (timeout: 2 hours)
  │
  └─> EMERGENCY_ALERT:
        ├─ Send immediate notification
        ├─ Include error details
        ├─ Suggest immediate actions
        └─ Escalate if no response in 15 min
```

---

## Resource Management Decision Tree

```
RESOURCE_DECISION:
  │
  ├─> Is resource available?
  │     ├─ No: Can create new instance?
  │     │     ├─ Yes: CREATE_RESOURCE
  │     │     └─ No: QUEUE_REQUEST
  │     └─ Yes: Continue
  │
  ├─> Is resource healthy?
  │     ├─ No: Can heal resource?
  │     │     ├─ Yes: HEAL_RESOURCE
  │     │     └─ No: USE_ALTERNATIVE
  │     └─ Yes: Continue
  │
  ├─> Will this exceed limits?
  │     ├─ Cost limit: CHECK_BUDGET
  │     ├─ Rate limit: APPLY_THROTTLING
  │     └─ Resource limit: QUEUE_OR_SCALE
  │
  └─> ALLOCATE_RESOURCE
```

---

## Quality Gate Decision Tree

```
QUALITY_GATE:
  │
  ├─> Which quality gate?
  │     ├─ Coverage: >= 80%?
  │     ├─ Security: No critical issues?
  │     ├─ Performance: < 500ms P95?
  │     └─ E2E Tests: 100% pass?
  │
  ├─> Gate failed?
  │     ├─ Is auto-remediation possible?
  │     │     ├─ Yes: ATTEMPT_REMEDIATION
  │     │     └─ No: Continue
  │     │
  │     ├─ Is this blocking?
  │     │     ├─ Yes: STOP_PIPELINE
  │     │     └─ No: WARN_AND_CONTINUE
  │     │
  │     └─ Can reduce scope?
  │           ├─ Yes: ADJUST_SCOPE
  │           └─ No: REQUEST_OVERRIDE
  │
  └─> Gate passed: PROCEED
```

---

## Common Decision Patterns

### Confidence-Based Decisions

```typescript
function makeConfidenceBasedDecision(
  options: DecisionOption[]
): DecisionResult {
  // Sort by confidence
  const sorted = options.sort((a, b) => b.confidence - a.confidence);

  const best = sorted[0];

  if (best.confidence >= 90) {
    return {
      decision: 'execute',
      option: best,
      reason: 'High confidence'
    };
  }

  if (best.confidence >= 70) {
    return {
      decision: 'execute_with_monitoring',
      option: best,
      reason: 'Moderate confidence'
    };
  }

  if (best.confidence >= 50) {
    return {
      decision: 'request_confirmation',
      option: best,
      alternatives: sorted.slice(1, 3),
      reason: 'Low confidence'
    };
  }

  return {
    decision: 'escalate',
    options: sorted,
    reason: 'Insufficient confidence'
  };
}
```

### Risk-Based Decisions

```typescript
function makeRiskBasedDecision(
  action: Action,
  context: Context
): DecisionResult {
  const risk = assessRisk(action, context);

  if (risk.level === 'low') {
    return { decision: 'proceed' };
  }

  if (risk.level === 'medium') {
    if (risk.reversible) {
      return { decision: 'proceed_with_rollback_plan' };
    }
    return { decision: 'request_approval' };
  }

  if (risk.level === 'high') {
    if (context.environment === 'production') {
      return { decision: 'block' };
    }
    return { decision: 'request_explicit_approval' };
  }

  return { decision: 'escalate_to_human' };
}
```

### Time-Based Decisions

```typescript
function makeTimeBasedDecision(
  deadline: Date,
  estimatedDuration: number
): DecisionResult {
  const timeRemaining = deadline.getTime() - Date.now();

  if (timeRemaining > estimatedDuration * 2) {
    return { decision: 'proceed_normal' };
  }

  if (timeRemaining > estimatedDuration * 1.5) {
    return { decision: 'proceed_optimized' };
  }

  if (timeRemaining > estimatedDuration) {
    return { decision: 'proceed_minimal' };
  }

  return { decision: 'request_deadline_extension' };
}
```

---

## Decision Logging

### Every Decision Should Log:

```typescript
interface DecisionLog {
  decision_id: string;
  timestamp: Date;
  context: {
    agent_id: string;
    task_id: string;
    workflow_id: string;
  };
  decision_type: string;
  options_considered: DecisionOption[];
  selected_option: DecisionOption;
  confidence: number;
  reasoning: string;
  outcome?: 'success' | 'failure';
  lessons_learned?: string;
}

function logDecision(decision: DecisionLog): void {
  // Store for analysis and learning
  logger.info('Decision made', decision);

  // Send to analytics
  metrics.recordDecision(decision);

  // Store in database for audit
  database.decisions.create({ data: decision });
}
```

---

## Important Rules for Decision Making

### ALWAYS:
1. ✅ Log every decision with reasoning
2. ✅ Consider confidence levels
3. ✅ Have a fallback strategy
4. ✅ Set timeouts for human responses
5. ✅ Consider the environment (dev/staging/prod)
6. ✅ Assess reversibility of actions
7. ✅ Check resource availability first
8. ✅ Validate inputs before deciding

### NEVER:
1. ❌ Make irreversible changes without confirmation
2. ❌ Ignore low confidence scores
3. ❌ Skip quality gates in production
4. ❌ Exceed cost/resource limits
5. ❌ Retry indefinitely
6. ❌ Make decisions without context
7. ❌ Ignore error patterns
8. ❌ Proceed when dependencies are failing