# ADR Governance Integration with Agentic SDLC

**Date:** 2025-11-10
**Status:** Framework Ready for Implementation
**Scope:** How ADRs integrate with sprint phases, agents, and quality gates

---

## Overview

ADRs (Architecture Decision Records) form the **policy backbone** of the agentic SDLC system. They are:

1. **Decision Log** - What choices we've made and why
2. **Machine-Readable Policy** - Policies that agents and scripts can consume
3. **Enforcement Rules** - Where and how policies are validated
4. **Audit Trail** - Full traceability of platform governance

---

## How ADRs Flow Through Your Sprint Sketch

### Phase 1: Sprint Initiation (Day 1)

**What happens:**
- Sprint Manager Agent loads sprint backlog
- Sprint Planning Agent begins refinement
- Backlog Refinement Agent looks up requirements

**ADR Integration:**
```typescript
// sprint-planning-agent.ts
const ADR_INDEX = loadAdrIndex() // Load platform policies

// Phase 1 ADRs: Planning rules
const archGuardrails = ADR_INDEX.findById('0001')  // Architecture Guardrails
const priorityPolicy = ADR_INDEX.findById('0004')  // Priority Policy

// Use ADR exports
const weights = priorityPolicy.exports.planning.priority.weights
const wipLimit = priorityPolicy.exports.planning.wip_limit

// Prioritize backlog using ADR-defined weights
const prioritized = items.sort((a, b) =>
  scoreItem(a, weights) - scoreItem(b, weights)
)
```

**Result:** Backlog is prioritized according to ADR-0004 policy, WIP limit enforced.

---

### Phase 2: Daily Development Cycles

**What happens:**
- Daily Standup reported
- Scaffold Agent generates code
- CI/CD pipeline runs validation
- Quality gates check pass/fail

**ADR Integration (Pre-Commit):**
```bash
# .husky/pre-commit (runs before commit)
#!/bin/bash

# Load ADR policies
ADR_POLICY=$(cat platform/governance/adr/adr-index.json)

# Validate code against ADRs
pnpm run validate:adr:imports      # ADR-0006 (layering rules)
pnpm run validate:adr:naming       # ADR-0005 (naming conventions)
pnpm run validate:adr:versions     # ADR-0008 (no semver ranges)
pnpm run validate:adr:typescript   # ADR-0007 (strict mode)

# Block commit if violations
if [ $? -ne 0 ]; then
  echo "❌ ADR violations detected. Fix and retry."
  exit 1
fi
```

**ADR Integration (CI/CD Pipeline):**
```yaml
# .github/workflows/ci.yml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Load ADR Policy
        run: |
          export ADR_INDEX=$(cat platform/governance/adr/adr-index.json)
          export MIN_COVERAGE=$(jq '.policies_export.quality.coverage_minimum' <<< $ADR_INDEX)

      - name: Type Check (ADR-0007)
        run: tsc --noEmit

      - name: Lint (ADR-0007)
        run: eslint .

      - name: Unit Tests (ADR-0003)
        run: vitest --coverage
        env:
          COVERAGE_THRESHOLD: ${{ env.MIN_COVERAGE }}

      - name: Security Scan (ADR-0010)
        run: npm audit
        env:
          FAIL_ON_HIGH: true

      - name: Performance Check (ADR-0011)
        run: |
          BUNDLE_SIZE=$(npm run build:size)
          LIMIT=$(jq '.policies_export.performance.bundle_size_limit_kb' <<< $ADR_INDEX)
          [ $BUNDLE_SIZE -lt $LIMIT ] || exit 1

      - name: Report ADR Compliance
        if: failure()
        run: |
          echo "❌ ADR violations in stage: Build"
          # Report which ADR(s) failed and why
```

**ADR Integration (Scaffold Agent):**
```typescript
// scaffold-agent.ts - when generating new app
async execute(task: TaskAssignment) {
  const ADR_INDEX = loadAdrIndex()

  // Check: only approved frameworks (ADR-0001, ADR-0008)
  const frameworks = ADR_INDEX
    .findById('0001')
    .exports.architecture.frameworks

  const isApproved = frameworks.some(f =>
    task.tech_stack === f.framework
  )

  if (!isApproved) {
    throw new Error(`Framework not in ADR-0001: approved frameworks`)
  }

  // Use ADR-approved versions
  const pinnedVersions = ADR_INDEX
    .findById('0008')
    .exports.dependencies.frozen_versions

  const packageJson = generatePackageJson({
    ...pinnedVersions  // Exact versions from ADR
  })

  // Enforce ADR-0005 naming conventions
  validateNaming(structure, ADR_INDEX.findById('0005'))

  // Generate files using ADR-0006 layering rules
  enforceLayering(directories, ADR_INDEX.findById('0006'))
}
```

**Result:** Generated code conforms to all Phase 2 ADRs (0003-0011).

---

### Phase 3: Orchestration & Decision Engine

**What happens:**
- Orchestrator evaluates task decisions
- Agents are dispatched to queues
- State transitions occur

**ADR Integration:**
```typescript
// orchestrator/decision-engine.ts
async evaluateTask(task: Task) {
  const ADR_POLICY = loadAdrIndex()

  // Use ADR-0004 priority scoring
  const weights = ADR_POLICY.findById('0004').exports.planning.priority.weights
  const priority = scoreTask(task, weights)

  // Use ADR-0011 for decision confidence threshold
  const minConfidence = ADR_POLICY
    .findById('0011')  // (Actually orchestrator.decision config)
    .exports.orchestrator?.decision?.minConfidence ?? 0.80

  if (confidence < minConfidence) {
    return {
      decision: 'HUMAN_REVIEW',
      reason: `Confidence ${confidence} below ADR threshold ${minConfidence}`,
      adr_reference: 'ADR-0011'
    }
  }

  return {
    decision: 'AUTO_APPLY',
    reason: `Confidence ${confidence} meets ADR-0011 threshold`,
    adr_reference: 'ADR-0011'
  }
}
```

**Result:** All orchestration decisions are traceable to ADRs.

---

### Phase 4: Agent↔Pipeline Integration

**What happens:**
- Agents register with orchestrator
- Pipeline invokes agents via API
- Events flow through message bus

**ADR Integration:**
```typescript
// orchestrator/api-gateway.ts
async registerAgent(payload: RegisterAgentRequest) {
  const ADR_POLICY = loadAdrIndex()

  // Validate payload against ADR-0020 (Agent↔Pipeline API Contract)
  const apiContract = ADR_POLICY.findById('0020')

  const schema = z.object({
    agent_id: z.string().uuid(),
    agent_type: z.enum(['scaffold', 'validation', 'e2e', 'deployment']),
    version: z.string(),
    capabilities: z.array(z.string())
  })

  const result = schema.safeParse(payload)
  if (!result.success) {
    throw new ValidationError(
      `Payload violates ADR-0020: ${result.error.message}`,
      { adr_id: '0020', schema: apiContract }
    )
  }

  // Register agent
  return { agent_id: payload.agent_id, registered: true }
}

async publishEvent(event: WorkflowEvent) {
  const ADR_POLICY = loadAdrIndex()

  // Validate event schema against ADR-0021 (Eventing & Schema Versioning)
  const eventPolicy = ADR_POLICY.findById('0021')
  const allowedTopics = eventPolicy.exports.events.topics

  if (!allowedTopics.includes(event.topic)) {
    throw new Error(
      `Event topic '${event.topic}' not in ADR-0021 allowed topics: ${allowedTopics.join(', ')}`
    )
  }

  // Publish with version (ADR-0021 N-2 compatibility)
  await this.eventBus.publish({
    ...event,
    version: eventPolicy.exports.events.version
  })
}
```

**Result:** All API contracts and events conform to ADRs-0020 and 0021.

---

### Phase 5: Sprint Completion

**What happens:**
- Code freeze applied
- Sprint review & retro
- RC released

**ADR Integration:**
```typescript
// sprint-completion-handler.ts
async createReleaseCandidate() {
  const ADR_POLICY = loadAdrIndex()

  // Validate all ADR requirements met (ADR-0030)
  const releasePolicy = ADR_POLICY.findById('0030') // (hypothetical)

  const rcRequirements = [
    {
      check: 'all_gates_passed',
      adrs: ['0003', '0007', '0010']
    },
    {
      check: 'no_adrs_violated',
      adrs: ['0001', '0005', '0006', '0008']
    },
    {
      check: 'security_baseline_met',
      adrs: ['0010']
    }
  ]

  for (const req of rcRequirements) {
    const valid = await checkRequirement(req)
    if (!valid) {
      const adrRefs = req.adrs.join(', ')
      throw new Error(`RC failed requirement: ${req.check} (ADRs: ${adrRefs})`)
    }
  }

  // Record any ADR updates from Retro (ADR-0031)
  if (retrospectiveTriggeredUpdates) {
    await this.createAdrUpdatePR({
      source: 'retrospective',
      updates: retrospectiveTriggeredUpdates,
      related_adrs: ['0031']
    })
  }
}
```

**Result:** RC is validated against all ADRs; systemic fixes trigger ADR updates.

---

## ADR Coverage by App Type

### Calculator-Slate Template
**Applies:**
- ADR-0001: Architecture Guardrails ✓ (SPA architecture)
- ADR-0005: Scaffolding Templates ✓ (calculator-slate)
- ADR-0007: TypeScript & Linting ✓ (strict mode)
- ADR-0008: Dependency Pinning ✓ (exact versions)
- ADR-0003: Testing Thresholds ⚠️ (missing tests)

**Compliance:** 4/5 = 80%

### Fastify API (Future Template)
**Applies:**
- ADR-0001: Architecture Guardrails ✓
- ADR-0002: Contract Standards ✓ (Zod schemas)
- ADR-0005: Scaffolding Templates ✓
- ADR-0007: TypeScript & Linting ✓
- ADR-0008: Dependency Pinning ✓
- ADR-0009: Database Isolation ✓ (Prisma)
- ADR-0010: Security Baseline ✓
- ADR-0003: Testing Thresholds ⚠️ (needs setup)

**Compliance:** 7/8 = 87.5%

### Full-Stack App (Future Template)
**Applies:** All 21 ADRs
**Compliance:** 100% (when complete)

---

## Key Files & Locations

```
platform/governance/adr/
├── adr-index.json                    # Machine-readable policy registry
├── adr-template.md                   # Template for writing new ADRs
├── 0001-architecture-guardrails.md   # To be written (framework choices)
├── 0002-contract-standards.md        # To be written (Zod/OpenAPI)
├── 0003-testing-thresholds.md        # To be written (80% coverage, gates)
├── 0004-priority-policy.md           # To be written (sprint planning weights)
├── 0005-scaffold-templates.md        # To be written (naming, file structure)
├── 0006-layering-and-import-rules.md # To be written (cross-layer isolation)
├── 0007-lint-ts-standards.md         # To be written (ESLint, strict TS)
├── 0008-dependency-pinning.md        # To be written (exact versions)
├── 0009-database-isolation.md        # To be written (Prisma, per-app DB)
├── 0010-security-policy.md           # To be written (OWASP, npm audit)
├── 0011-performance-budgets.md       # To be written (bundle sizes, Lighthouse)
├── 0020-agent-pipeline-api.md        # To be written (API contract)
└── 0021-eventing-and-schema.md       # To be written (event schemas)

Enforcement Scripts (read adr-index.json):
├── scripts/validate-adr-imports.ts
├── scripts/validate-adr-naming.ts
├── scripts/validate-adr-versions.ts
├── scripts/validate-adr-typescript.ts
├── scripts/validate-adr-coverage.ts
├── scripts/validate-adr-security.ts
└── scripts/validate-adr-performance.ts

CI/CD Integration:
├── .husky/pre-commit                 # Runs pre-commit ADR validators
├── .github/workflows/ci.yml          # Runs pipeline ADR validators per stage
└── .github/workflows/release.yml     # Validates RC meets ADR requirements
```

---

## Next Steps: Implementation (Sessions #17-18)

### Week 1: Write Core ADRs
1. **Session #17 Part A:** Write ADRs 0001-0011 (12 hours)
   - Architecture Guardrails
   - Contract Standards
   - Testing & Quality
   - Code Quality
   - Database & Security
   - Performance

2. **Session #17 Part B:** Create validation scripts (8 hours)
   - Pre-commit validators
   - CI/CD stage validators
   - Orchestrator policy loaders

### Week 2: Integrate with Pipeline
3. **Session #18 Part A:** Wire up .husky + CI/CD (6 hours)
   - Update GitHub Actions workflows
   - Add ADR policy checks
   - Add ADR reporting

4. **Session #18 Part B:** Update agents to load ADRs (8 hours)
   - Scaffold-Agent reads ADR-0001, 0005, 0008
   - Orchestrator reads ADR-0004, decision thresholds
   - Pipeline loader for all ADRs

### Week 3: Validation & Documentation
5. **Session #19:** Validate end-to-end (4 hours)
   - Test pre-commit on calculator
   - Test CI/CD stages
   - Generate compliance reports

---

## Summary

**ADRs are the Policy Engine.**

They translate governance into:
- ✅ Enforcement rules (pre-commit, CI/CD)
- ✅ Agent policies (scaffold decisions, queue priorities)
- ✅ Validation scripts (every stage gates)
- ✅ Audit trails (which ADR was violated?)

**With adr-index.json and enforcement scripts**, you have a **declarative policy system** where:
- Policies are human-readable (ADR documents)
- Policies are machine-readable (adr-index.json exports)
- Policies are automatically enforced (scripts, pre-commit, CI/CD)
- Violations are traced back to ADRs (audit trail)

**Result:** Platform governance that scales with the system.
