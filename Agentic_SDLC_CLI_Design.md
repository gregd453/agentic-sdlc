# Agentic SDLC – **CLI‑Invoked, No‑Scheduler** Design Document

**Version:** 1.0.0  
**Status:** Implementation Blueprint (Ready to Build)  
**Audience:** Platform, DevOps, App Teams, Agent Developers  
**Last Updated:** 2025‑11‑06

---

## 1) Purpose & Scope

This document defines a production‑ready, **no‑scheduler** Agentic SDLC framework that is **invoked manually from the Claude Code CLI console**. It replaces cron/timers with **explicit CLI commands** while preserving the orchestration model (agents, gates, artifacts, observability, provenance).

### Goals
- Deterministic, operator‑driven execution (no background jobs).
- Idempotent commands that **advance a state machine** per backlog item or pipeline.
- Policy‑as‑code for decisions, gates, and promotions.
- Strong auditability (traces, logs, artifacts, SBOM, SLSA).

### Non‑Goals
- No time‑based ceremonies (planning, daily standup, sprint timers).
- No auto‑triage or auto‑promotion without an explicit CLI call.

---

## 2) Architecture Overview

```
CLI (Claude Code) ──► Command Router ──► Orchestrator.useCase(cmd)
                                  │
                                  ├─► State Machine    (intake→ready→in‑progress→review→certify→release→done)
                                  ├─► Decision Engine  (negotiate, clarify, approve)
                                  ├─► Agent Dispatcher (Scaffold, Implement, Review, Test, Deploy, Debug, Recovery)
                                  ├─► Gate Bundle      (coverage, security, contracts, performance)
                                  ├─► Artifact Layer   (PRs, packages, SBOM, attestations, reports)
                                  └─► Observability    (OTel traces/logs/metrics, run reports)
```

### Key Differences from the Scheduled Variant
- **Entry points** = CLI subcommands (no cron).  
- **Approvals & clarifications** surface **inline** in CLI (blocking prompts).  
- **SLAs** are informational only; policy thresholds gate actions rather than time.  
- **Snapshots** (obs reports) are on‑demand.

---

## 3) State Machine (unchanged semantics, command‑driven transitions)

```
intake → ready → in‑progress → review → certify → release → done
   ↘────────────── blocked ─────────────↗
```

- Each CLI command proposes a transition; Orchestrator validates **DoR/DoD + gates**, then commits & records a **run** (`/ops/agentic/runs/YYYY‑MM‑DD/<wf>.json`).  
- Transitions are **idempotent** (re‑running applies only missing steps).  
- **Compensations** (e.g., rollback) are modeled as reverse transitions with safety checks.

---

## 4) Repository Layout

```
/ops/agentic/
  cli/                         # CLI command handlers (bin: cc-agentic)
    index.ts
    intake.ts
    plan.ts
    spec.ts
    implement.ts
    review.ts
    test.ts
    release.ts
    rollback.ts
    pipeline.ts
    decisions.ts
    clarify.ts
    obs.ts
    policy.ts
  core/
    orchestrator.ts            # useCase(cmd) → state machine, dispatch, persist
    state-machine.ts           # transitions, guards, compensations
    dispatcher.ts              # agent selection & sandboxing
    decisions.ts               # decision negotiation + thresholds
    clarify.ts                 # requirement clarifier
    gates/
      index.ts                 # composite gate evaluator
      coverage.ts
      security.ts
      contracts.ts
      performance.ts
    schema-registry/           # JSON Schemas + version policy (N-2)
      backlog-item.schema.json
      agent-message.schema.json
      pipeline-event.schema.json
      decision-result.schema.json
      versions.yml
  backlog/
    queue.jsonl                # normalized backlog items (append-only)
    policy.yaml                # thresholds, gates, promotions, approvals
  specs/<id>/SPEC.md
  runs/<yyyy-mm-dd>/*.json     # run logs & evidence map
  reports/scorecards/*.md
  prompts/*.md
  contracts/                   # OpenAPI, Zod baselines
```

---

## 5) CLI Surface (Operator UX)

### Commands
```
cc agentic help
cc agentic intake --from <linear|jira|gh> [--team TEAM] [--since "24h"]
cc agentic plan --item <ID> [--dry-run]
cc agentic spec --item <ID> [--open]
cc agentic implement --item <ID> [--branch feat/... ] [--flag key]
cc agentic review --pr <id|url> [--gate coverage,security,contracts]
cc agentic test --scope unit|int|e2e|perf [--app APP] [--changed-only]
cc agentic release promote --env dev|staging|prod [--canary 10]
cc agentic rollback --to <tag|rc> [--verify]
cc agentic pipeline run --stages build,test,package,deploy [--app APP]
cc agentic decisions evaluate --item <ID>
cc agentic clarify --item <ID> [--interactive]
cc agentic obs snapshot [--workflow <WFID>]
cc agentic policy validate|edit
```

### Behavior
- **Interactive prompts** for low confidence or protected actions (security/cost).  
- `--non-interactive` fails if an approval is required.  
- All commands emit: **trace_id**, **workflow_id**, **artifacts**, **exit code**.

---

## 6) Data Models (excerpt)

### BacklogItem (registry: `schema-registry/backlog-item.schema.json`)
```json
{
  "id": "BI-2025-00123",
  "schema_version": "1.0.0",
  "title": "Ledger export (CSV)",
  "type": "feature",
  "area": "credits-ledger",
  "status": "ready",
  "owner": "dri@company.com",
  "acceptance": [
    "CSV schema=v1.2",
    "Audit event on export"
  ],
  "depends_on": ["BI-2025-00088"],
  "telemetry_kpis": ["export_success_rate","export_latency_p95"]
}
```

### AgentMessage (v1, N‑2 compatibility)
```json
{
  "id": "am_abc123",
  "schema_version": "1.0.0",
  "type": "task_assignment|task_result|error_report",
  "priority": "high|normal|low",
  "source": "orchestrator",
  "destination": "implementer",
  "workflow_id": "WF-2025-1106-001",
  "trace_id": "T-...",
  "payload": { "task": { "item_id": "BI-2025-00123" } }
}
```

### PipelineEvent (v1)
```json
{
  "event_id": "pe_123",
  "schema_version": "1.0.0",
  "pipeline_id": "PL-...",
  "event_type": "STAGE_STARTED|QUALITY_GATE_FAILED|PIPELINE_COMPLETED",
  "stage": "unit_test",
  "data": { "coverage": 83.7 },
  "timestamp": "2025-11-06T17:30:22Z"
}
```

---

## 7) Policy‑as‑Code (no timers)

**`/ops/agentic/backlog/policy.yaml` (sample)**

```yaml
# Decision thresholds by category
decisions:
  thresholds:
    technical_refactor: { auto_min_confidence: 0.85, human_required: false }
    cost_impacting:     { auto_min_confidence: 0.92, human_required: true }
    security_affecting: { auto_min_confidence: 1.00, human_required: true }
  escalation:
    low_confidence: { under: 0.80, route: "platform-arch@org" }

# Quality gates (composite)
gates:
  coverage:   { metric: "line_coverage", op: ">=", threshold: 80 }
  security:   { metric: "critical_vulns", op: "==", threshold: 0 }
  contracts:  { metric: "api_breaking_changes", op: "==", threshold: 0 }
  performance:{ metric: "p95_latency_ms", op: "<", threshold: 500 }

# Promotions
release:
  strategies:
    dev:     { smoke: true }
    staging: { smoke: true, e2e_critical: true }
    prod:    { canary_percent: 10, max_error_budget_burn: 5 }
```

---

## 8) Gate Bundle (implementation notes)

- **Coverage Gate**: parse lcov or junit JSON → fail if `< threshold`.  
- **Security Gate**: SCA (e.g., npm audit + OSV), SAST (optional), block on *critical*.  
- **Contracts Gate**: OpenAPI diff + Zod schema diff → **no breaking** unless feature‑flagged & approved.  
- **Performance Gate**: perf smoke (k6 or autocannon) on changed endpoints; p95 < threshold.  

All gate results are attached to the run artifact and surfaced in CLI output.

---

## 9) Agents (minimal set to start)

- **Spec Writer**: generate/update `specs/<id>/SPEC.md` with user story, constraints, API/UI contract diffs, acceptance tests.  
- **Implementer**: create branch, code + unit tests, update docs, open PR with checklists, optional feature flag.  
- **Reviewer**: run gates; post PR comments; produce **Certification Report**.  
- **Test Orchestrator**: run unit/integration/E2E (critical path) with **flake quarantine** + ≤2 retries.  
- **Release Manager**: package, provenance (SBOM + SLSA), deploy, canary, rollback hooks.  
- **Recovery** (optional): data‑safe rollback, preflight checks on migrations.

> Agents that write code must run in **sandboxed containers**. Read‑only analyzers may run in‑process.

---

## 10) Decision & Clarification Flow (CLI‑inline)

- For actions marked **security_affecting** or **cost_impacting**, the CLI **blocks** and renders: options, risks, time, cost, confidence.  
- Operator chooses: **Approve / Revise / Escalate / Abort**.  
- `--non-interactive` returns exit code `10` when approval is required.

---

## 11) Observability

- **Tracing**: OpenTelemetry; inject `x-request-id`, `trace_id`, `workflow_id`, `decision_id`.  
- **Logging**: structured JSON; redact PII; include gate metrics.  
- **Metrics**: change failure rate, lead time, MTTR, E2E pass rate, flake rate, cost per deployment.  
- **Snapshots**: `cc agentic obs snapshot --workflow WFID` emits a self‑contained report (Markdown + links to artifacts).

---

## 12) Security & Supply Chain

- **Zero‑trust** checks on every CLI call (authZ for protected ops).  
- **Secrets** via Vault/parameter store; short‑lived tokens; rotate ≤ 90 days.  
- **Provenance**: CycloneDX SBOM + SLSA attestations required **before promotion**.  
- **OPA/Rego** policies for deploy gates (vulns, licenses, environment rules).

---

## 13) Performance & Cost Controls

- **Model fallback tree**: haiku → sonnet → gpt (by task).  
- **Semantic cache** with TTLs: refinement (7d), spec (24h), on‑call debug (no cache).  
- **Per‑workflow cost budget**; deny or downshift model when budget exceeded (clear CLI message).

---

## 14) Typical Operator Flows

### A) Single item, end‑to‑end
```bash
cc agentic intake --from linear --team ZYP --since "24h"
cc agentic plan --item BI-2025-00123
cc agentic spec --item BI-2025-00123 --open
cc agentic implement --item BI-2025-00123 --branch feat/ledger-export --flag credits.ledger_export
cc agentic review --pr 456 --gate coverage,security,contracts
cc agentic test --scope e2e --app zyp-home
cc agentic release promote --env prod --canary 10
cc agentic obs snapshot --workflow WF-2025-1106-001
```

### B) One‑shot pipeline
```bash
cc agentic pipeline run --stages build,test,deploy --app zyp-admin --canary 5
```

---

## 15) Error Handling & Recovery

- **Idempotency**: commands include **idempotency key**; re‑runs skip completed steps.  
- **Retry policy**: exponential backoff for transient errors (network, rate limit).  
- **Flake quarantine**: failing E2E moved to quarantine, ticket auto‑opened; pipeline proceeds if **critical path** still green.  
- **Rollback**: blocks if non‑reversible migration detected without export; requires explicit `--verify` flag.

---

## 16) Implementation Plan (4–6 weeks)

**Week 1–2:**  
- Skeleton repo layout; Schema Registry; Orchestrator + State Machine; CLI `index.ts`; `intake|plan|spec`.  
- Coverage/Security/Contracts gates v1; run recorder; OpenTelemetry wiring.

**Week 3–4:**  
- Implementer + Reviewer agents; PR integration; Test Orchestrator (unit/int/critical E2E); flake quarantine.  
- Release Manager (dev/staging), SBOM + SLSA; `obs snapshot` reporter.

**Week 5–6:**  
- Canary deploys to prod; Recovery agent (rollback checks); performance gate; cost governor + model fallback.  
- Polish: `pipeline run`, `policy validate`, documentation + examples.

**Exit Criteria:**  
- Lead time P50 < 24h; CFR < 5%; E2E critical = 100% pass; provenance enforced pre‑prod; rollback tested.

---

## 17) Testing Strategy

- **Unit**: orchestrator transitions, gate evaluators, CLI handlers (arg parsing, exit codes).  
- **Contract**: schema compatibility (N‑2) via json‑schema‑tests; OpenAPI diff “breaking” detection.  
- **Integration**: PR checks end‑to‑end in a sandbox repo; deploy to ephemeral env, run smoke.  
- **E2E (critical)**: golden path features only; ≤2 retries; quarantine on flake.  
- **Chaos**: kill agent container mid‑task; ensure idempotency & resume works.  
- **Security**: OPA policy tests; secret rotation dry‑run; SBOM presence check in pipeline.

---

## 18) Appendix – CLI Handler Sketches

```ts
// ops/agentic/cli/index.ts
import { Command } from 'commander';
import * as UC from '../core/orchestrator';

const program = new Command('cc agentic');

program
  .command('plan')
  .requiredOption('--item <id>')
  .option('--dry-run', 'preview only', false)
  .action(async (opts) => {
    const res = await UC.plan({ itemId: opts.item, dryRun: !!opts.dryRun });
    console.log(res.summary);
    process.exit(res.ok ? 0 : 1);
  });

program
  .command('review')
  .requiredOption('--pr <id>')
  .option('--gate <list>', 'comma-separated gates', 'coverage,security,contracts')
  .action(async (opts) => {
    const gates = String(opts.gate).split(',').map(s => s.trim());
    const res = await UC.review({ pr: opts.pr, gates });
    console.table(res.metrics);
    process.exit(res.ok ? 0 : 2);
  });

program.parseAsync(process.argv);
```

---

## 19) Acceptance Checklist

- [ ] Commands are idempotent and resumable.  
- [ ] Schema Registry enforces N‑2 compatibility.  
- [ ] Composite gates pass locally and in PRs.  
- [ ] Provenance (SBOM + SLSA) attached to artifacts before promotion.  
- [ ] Observability snapshot provides traces, gates, artifacts, decisions.  
- [ ] Rollback preflight blocks unsafe migrations.

---

## 20) Summary

This **CLI‑invoked Agentic SDLC** preserves the rigor of the scheduled system while giving operators **total control**. You get:
- Clear, auditable **state transitions** and **gate outcomes**,
- **Inline approvals/clarifications** where it matters,
- Strong **provenance** and **observability**,
- A small, composable codebase that teams can adopt incrementally.

Build the skeleton in two weeks, layer gates and agents, and you’ll have a dependable “**you‑are‑the‑clock**” SDLC that scales with confidence.
