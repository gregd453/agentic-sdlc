# Agentic SDLC - Phase 10: Decision & Clarification System

**Version:** 1.0.0
**Status:** Implemented
**Phase:** 10 - Decision & Clarification Flow (CLI-inline)

## Overview

This module implements the **Decision & Clarification Flow** for the Agentic SDLC system, enabling interactive decision-making and requirement clarification through CLI commands.

## Features

### Decision Engine
- **Policy-based decision evaluation** - Automatic approval or human review based on confidence and category
- **Interactive CLI prompts** - Present options, risks, time/cost estimates to operators
- **Decision recording** - Full auditability with trace IDs and artifacts
- **Escalation routing** - Automatic routing to appropriate stakeholders
- **Non-interactive mode** - Support for CI/CD with exit code 10 for required approvals

### Clarification Engine
- **Ambiguity detection** - Identify vague or conflicting requirements
- **Question generation** - Auto-generate clarification questions
- **Multi-round support** - Handle iterative clarification up to 3 rounds
- **Multiple question types** - open_text, multiple_choice, yes_no, numeric

## Architecture

```
ops/agentic/
├── cli/                      # CLI command handlers
│   ├── index.ts             # Main entry point
│   ├── decisions.ts         # Decision commands
│   └── clarify.ts           # Clarification commands
├── core/                    # Core engines
│   ├── decisions.ts         # Decision evaluation logic
│   ├── decisions.test.ts    # Decision tests (90% coverage)
│   ├── clarify.ts           # Clarification logic
│   └── clarify.test.ts      # Clarification tests (90% coverage)
├── backlog/
│   └── policy.yaml          # Decision thresholds and gates
├── schema-registry/         # JSON Schemas
│   ├── decision-result.schema.json
│   ├── clarification-request.schema.json
│   └── versions.yml
└── runs/                    # Persisted decisions/clarifications (YYYY-MM-DD/)
```

## Installation

```bash
cd ops/agentic
pnpm install
pnpm test
pnpm typecheck
```

## Usage

### Decision Commands

**Evaluate a decision:**
```bash
pnpm dev decisions evaluate \
  --workflow-id WF-2025-1107-001 \
  --item-id BI-2025-00123 \
  --category security_affecting \
  --action "Deploy new authentication system" \
  --confidence 0.88
```

**Show decision policy:**
```bash
pnpm dev decisions policy
```

**Show decision details:**
```bash
pnpm dev decisions show --decision-id DEC-2025-00001
```

### Clarification Commands

**Evaluate if clarification is needed:**
```bash
pnpm dev clarify evaluate \
  --requirements "Build a dashboard" \
  --acceptance-criteria "User can view data,Data updates hourly" \
  --confidence 0.65
```

**Create clarification request (interactive):**
```bash
pnpm dev clarify create \
  --workflow-id WF-2025-1107-001 \
  --item-id BI-2025-00123 \
  --requirements "Build a dashboard with some charts" \
  --confidence 0.65 \
  --interactive
```

**Answer clarification:**
```bash
pnpm dev clarify answer --id CLR-2025-00001
```

**Show clarification details:**
```bash
pnpm dev clarify show --id CLR-2025-00001
```

## Decision Categories & Thresholds

| Category | Auto Threshold | Human Required | Description |
|----------|----------------|----------------|-------------|
| `technical_refactor` | 85% | No | Code refactoring, optimization |
| `cost_impacting` | 92% | Yes | Infrastructure cost changes |
| `security_affecting` | 100% | Yes | Security-related changes |
| `architectural_change` | 90% | Yes | System architecture changes |
| `data_migration` | 95% | Yes | Database migrations |

## Decision Options

All decisions present 4 options:
1. **Approve** - Proceed with the action
2. **Revise** - Request modifications
3. **Escalate** - Route to stakeholders
4. **Abort** - Cancel and fail workflow

## Escalation Rules

- **Low Confidence** (< 80%) → platform-arch@company.com
- **High Cost** (> $1000/month) → eng-leadership@company.com
- **Security Critical** → security@company.com

## Non-Interactive Mode

For CI/CD pipelines:
```bash
pnpm dev decisions evaluate \
  --workflow-id WF-2025-1107-001 \
  --item-id BI-2025-00123 \
  --category cost_impacting \
  --action "Scale infrastructure" \
  --confidence 0.85 \
  --non-interactive
```

**Exit Codes:**
- `0` - Success (auto-approved or decision completed)
- `1` - Error
- `10` - Human approval required in non-interactive mode

## Testing

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test:coverage

# Watch mode
pnpm test:watch
```

**Test Coverage:** 90%+ (thresholds enforced)

## Integration with Orchestrator

The decision and clarification engines are designed to integrate with the orchestrator service:

```typescript
import { evaluateDecision, DecisionRequest } from '@agentic-sdlc/ops/core/decisions';

const request: DecisionRequest = {
  workflow_id: 'WF-2025-1107-001',
  item_id: 'BI-2025-00123',
  category: 'security_affecting',
  action: 'Update OAuth configuration',
  confidence: 0.88,
  trace_id: 'T-12345',
};

const evaluation = evaluateDecision(request);

if (evaluation.requires_human_approval) {
  // Block workflow and wait for operator decision
  // ...
}
```

## Artifacts & Provenance

All decisions and clarifications are persisted to:
```
ops/agentic/runs/YYYY-MM-DD/
  ├── DEC-2025-00001.json
  ├── DEC-2025-00002.json
  ├── CLR-2025-00001.json
  └── CLR-2025-00002.json
```

Each artifact includes:
- Full decision/clarification context
- Operator identity
- Timestamps
- Trace IDs for observability
- Selected options and rationale

## Schema Version Policy

**N-2 Compatibility:** Current version and two previous major versions supported.

Current schema versions:
- `decision-result`: 1.0.0
- `clarification-request`: 1.0.0

## Configuration

Edit `backlog/policy.yaml` to customize:
- Decision thresholds
- Escalation routes
- Quality gates
- Cost budgets
- Observability settings

## References

- **Design Document:** `/Agentic_SDLC_CLI_Design.md` (Section 10)
- **Phase 1 Playbook:** `/PHASE-1-CAPABILITY-PLAYBOOK.md`
- **API Contracts:** `/AI-CONTEXT/API-CONTRACTS.md`

## License

MIT
