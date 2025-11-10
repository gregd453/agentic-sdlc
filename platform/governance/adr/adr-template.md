# ADR-NNNN: [Title]

**Date:** YYYY-MM-DD
**Status:** [Proposed | Accepted | Superseded | Deprecated]
**Scope:** [Which phase(s): Plan | Dev/Pipeline | Orchestration | Integration | Completion]
**Urgency:** [Low | Medium | High | Critical]
**Author:** [Name]
**Reviewed By:** [Role/Team]

---

## 1. Context

### Problem Statement
Describe the issue, constraint, or decision point that prompted this ADR.

### Current State
What exists today? What is broken or missing?

### Stakeholders
- Who is impacted?
- Whose approval/sign-off is required?
- Who will enforce this?

---

## 2. Decision

### The Choice
A clear, concise statement of what we are deciding to do.

### Rationale
**Why this decision?**
- Benefits
- Trade-offs considered
- Alternatives rejected and why

---

## 3. Consequences

### Positive
- Outcomes that improve the system
- Risks mitigated
- Efficiency/quality gains

### Negative
- New constraints introduced
- Complexity added
- Effort required to implement

### Open Risks
- Unresolved questions
- Monitoring needed
- Future review triggers

---

## 4. Implementation

### Affected Artifacts
- Code files/directories
- Configuration/scripts
- CI/CD stages
- Agent policies
- Documentation

### Enforcement Points
**Where & how is this policy enforced?**

| System | Enforcer | Trigger | Action |
|--------|----------|---------|--------|
| Pre-commit | Git hook | `commit` | Validate + block |
| Pre-push | Git hook | `push` | Validate + block |
| CI/CD | Job stage | Stage enter | Gate pass/fail |
| Orchestrator | Config read | Agent init | Apply policy |
| Runtime | Script/Agent | Task execution | Validate + report |

### Rollout Plan
- Phase 1 (passive): Warning/logging only
- Phase 2 (soft-enforcement): Block with override option
- Phase 3 (strict): Block without override

### Reversal/Supersede Plan
How to safely change this decision if needed?

---

## 5. Machine-Readable Export

```json
{
  "id": "AAAA",
  "title": "[Title]",
  "status": "[status]",
  "phase": ["Plan", "Dev/Pipeline", "Orchestration", "Integration", "Completion"],
  "enforced_by": [
    {
      "system": "pre-commit",
      "script": "path/to/validator.ts",
      "condition": "always"
    },
    {
      "system": "ci-pipeline",
      "stage": "Build|Unit|Integration|E2E|Security|Perf|Package|Deploy",
      "script": "path/to/validator.ts"
    },
    {
      "system": "orchestrator",
      "component": "decision-engine|queue-mgr|resource-mgr",
      "export_key": "orchestrator.[component].[param]"
    }
  ],
  "exports": {
    "[category].[subcategory].[param]": "[value]",
    "example": "lint.rules.forbiddenImports = ['@prisma/client']"
  },
  "linked_adr": ["ADR-XXXX"],
  "supersedes": ["ADR-YYYY"],
  "revisions": [
    {
      "date": "YYYY-MM-DD",
      "change": "description"
    }
  ]
}
```

---

## 6. References

**Related ADRs**
- ADR-XXXX (dependency)
- ADR-YYYY (context)

**External References**
- Zod documentation
- Platform architecture guide
- Security baseline

**Approval Metadata**
- Architecture Board: [approved/pending]
- Security Lead: [approved/pending]
- Date approved: YYYY-MM-DD

---

## 7. Review Schedule

**Next Review:** [6 months, on sprint X, or on event trigger]
**Sunset Date (if applicable):** [date]
**Supersede Candidate:** [ADR-ZZZZ when X condition is met]

---

## Appendix: Examples & Deep Dives

### Example 1: Enforcement via Pre-Commit
```bash
# .husky/pre-commit
pnpm run validate-adr-policy
# Reads ADR exports, validates code against policies
```

### Example 2: CI/CD Stage Integration
```yaml
# .github/workflows/ci.yml
- name: Validate ADR Policy (Unit Tests)
  run: npm run validate:adr:coverage
  env:
    ADR_MIN_COVERAGE: ${{ env.ADR_EXPORTS_TESTING_COVERAGE }}
```

### Example 3: Orchestrator Integration
```typescript
// orchestrator/decision-engine.ts
const ADR_POLICY = loadAdrIndex()
const MIN_CONFIDENCE = ADR_POLICY.exports['orchestrator.decision.minConfidence']
if (confidence < MIN_CONFIDENCE) {
  // Route to human review
}
```

---

**Document Version:** 1.0
**Last Updated:** YYYY-MM-DD
