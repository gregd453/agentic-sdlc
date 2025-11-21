




Perfect — let’s update your

✅ Complete Sprint Planning Process Flow Diagram

to fully align with the ZYP EPCC model, your Git-based backlog architecture, and the domain-capability system (multi-repo, agent-driven, ADR-governed).

Below is the new Agentic EPCC Sprint Planning Process Flow, reflecting both entry paths (New Capability / Existing Capability), Git-based backlog management, and agent orchestration across your phases.

⸻

🧩 COMPLETE SPRINT PLANNING PROCESS FLOW DIAGRAM

Framework: EPCC (Explore → Plan → Code → Certify)
Version: 2.0 — Domain-Capability Aligned
Purpose: Show how backlog items (from Git) flow through the agentic SDLC pipeline with full governance, ADR enforcement, and shared-component awareness.

⸻


┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                AGENTIC EPCC SPRINT PLANNING PROCESS                              │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
│
▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 0: BACKLOG ENTRY (TWO PATHS)                                                               │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                  │
│   🆕 New Capability / Feature → issue template: 01_new_capability.yml                             │
│   ♻️ Existing Capability / Change → issue template: 02_change_request.yml                         │
│                                                                                                  │
│   Fields: domain, capability_id, problem, AC(G/W/T), dependencies, shared_components, ADR_refs    │
│   Managed in:  zyp-backlog/.github/issues/                                                       │
│                                                                                                  │
│   → CI validates schema + ADR refs → label: status:ready-for-plan                                │
│                                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
│
▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 1: EXPLORE (Context + Governance Discovery)                                                │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                  │
│  Agents: Context Agent, ADR Agent, Dependency Mapper                                             │
│  Inputs: issue metadata, /manifests/capabilities-catalog.json, /policies/governance.json          │
│  Actions:                                                                                        │
│    - Parse domain + capability context                                                           │
│    - Resolve linked ADRs, frozen rules, and shared components                                    │
│    - Populate /backlog/domains/<domain>/<capability>/queue/*.yml                                 │
│    - Output summary → /backlog/domains/.../backlog.md                                            │
│                                                                                                  │
│  Output Artifacts:                                                                               │
│    - context-report.json                                                                         │
│    - capability-scope.md                                                                         │
│    - validated manifest.json (seed for new capabilities)                                         │
│                                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
│
▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 2: PLAN (Prioritization + Sprint Assembly)                                                 │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                  │
│  Agents: Planner Agent, Clarifier Agent, Priority Calculator, ADR Validator                      │
│                                                                                                  │
│  Inputs:                                                                                         │
│    - validated backlog items                                                                     │
│    - /reports/pipeline-metrics.json (for existing capabilities)                                  │
│    - /manifests/shared-components.json                                                           │
│                                                                                                  │
│  Actions:                                                                                        │
│    - Calculate priority (value × risk × dep-cost × effort)                                       │
│    - Verify shared components + dependencies exist                                               │
│    - Assemble sprint-plan.json with ADR links + repo targets                                     │
│    - Generate sprint-summary.md for human approval                                               │
│                                                                                                  │
│  Output Artifacts:                                                                               │
│    - /sprints/<milestone>/sprint-plan.json (machine plan)                                        │
│    - /sprints/<milestone>/sprint-summary.md (human summary)                                      │
│    - /sprints/<milestone>/risk-register.md                                                       │
│                                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
│
▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 3: CODE (Scaffolding + Implementation)                                                     │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                  │
│  Agents: Scaffold Agent, Dev Agent, Dependency Integrator                                        │
│  Inputs: sprint-plan.json, manifests, contracts, ADR guidance                                    │
│  Actions:                                                                                        │
│    - Create feature/fix branches per capability (feat/<domain>-<cap>/<slug>)                     │
│    - Scaffold new capability packages (api/ui/contracts/tests)                                   │
│    - Update shared components if approved                                                        │
│    - Open PRs in target monorepo(s) with plan-link.json for traceability                         │
│                                                                                                  │
│  Output Artifacts:                                                                               │
│    - PR(s) in monorepos                                                                          │
│    - scaffold logs & generated manifests                                                         │
│    - /backlog/.../implementation-report.md                                                       │
│                                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
│
▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 4: CERTIFY (Validation + Governance Enforcement)                                           │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                  │
│  Agents: QA Agent, ADR Validator, Policy Enforcer, Coverage Auditor                              │
│  Inputs: PR artifacts, ADR index, governance.json, telemetry reports                             │
│  Actions:                                                                                        │
│    - Run automated tests, coverage checks, contract validation                                   │
│    - Evaluate ADR compliance, version locks, layer boundaries                                    │
│    - Generate certification reports                                                              │
│    - Approve merge + tag release if all criteria met                                             │
│                                                                                                  │
│  Output Artifacts:                                                                               │
│    - adr-check-report.md                                                                         │
│    - validation.log                                                                              │
│    - release-notes.md                                                                            │
│                                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
│
▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 5: DEPLOY + LEARN                                                                          │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                  │
│  Agents: Release Agent, Telemetry Agent                                                          │
│  Actions:                                                                                        │
│    - Deploy capability to environment                                                            │
│    - Extract metrics (deployment frequency, change failure rate, coverage)                       │
│    - Update /reports/pipeline-metrics.json + /reports/coverage-summary.json                      │
│    - Feed results back into next Explore phase                                                   │
│                                                                                                  │
│  Outcome:                                                                                        │
│    - New or improved capability live                                                             │
│    - Backlog + metrics auto-updated                                                              │
│    - Continuous feedback loop established                                                        │
│                                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘


⸻

🧠 KEY ALIGNMENTS WITH YOUR DOMAIN–CAPABILITY ARCHITECTURE

Layer   EPCC Alignment  Notes
Domains Govern “Explore” context and ADR scope  Ensures backlog reflects domain-level goals
Capabilities    Each runs its own EPCC mini-cycle   Enables parallelism & autonomy
Packages / Shared Components    Enforced during “Plan” & “Certify”  Prevents duplication & drift
Backlog Repo (zyp-backlog)  Houses Explore & Plan phases    Keeps code repos clean
Code Monorepos (/domains, /shells, /packages)   Execute Code & Certify phases   Ensures consistency through linked PRs
Policies + ADRs Checked in every phase  Architecture and governance enforcement baked in


⸻

⚙️ TOOL & AUTOMATION MAP

Phase   Primary Repo    Workflow    Artifacts   Human Checkpoint
Explore zyp-backlog plan.yml    context-report.json PO review
Plan    zyp-backlog plan.yml    sprint-plan.json    Sprint approval
Code    monorepo(s) build.yml   PRs, plan-link.json Code review
Certify monorepo(s) validate-artifacts.yml  adr-check-report.md Merge approval
Deploy  monorepo(s) release.yml release-notes.md    Optional


⸻

🚀 Summary
•   EPCC gives the structure and guardrails.
•   Git-based backlogs give the truth and traceability.
•   Domain-capability boundaries give modular scalability.
•   Agents + CI keep it autonomous yet auditable.
•   Outcome: a repeatable, policy-enforced loop for creating or improving any capability — seamlessly through your pipelines.

⸻

Would you like me to now visualize this as an SVG swimlane diagram (humans vs. agents vs. repos vs. pipelines) for insertion into your documentation?




Love it. Here’s how to embed a JSON Knowledge Base (KB)—covering ADRs, patterns, and policies—straight into your EPCC design so agents can query it deterministically and CI can enforce it.

What changes
•   Add a /knowledge folder (in zyp-backlog) with machine-readable JSON indices of ADRs, patterns, and policies.
•   Agents treat the KB as the authoritative lookup for governance, reusable patterns, and design decisions during Explore/Plan/Certify.
•   CI validates that every backlog item and PR references KB IDs (not free text).

⸻

Repo updates (planning/backlog repo)

zyp-backlog/
├─ knowledge/
│  ├─ kb.json                       # Top-level index & metadata
│  ├─ adr.json                      # Flattened ADR catalog (machine-readable)
│  ├─ patterns.json                 # UX/API/infra patterns (IDs, constraints, refs)
│  ├─ policies.json                 # Frozen rules, naming, version floors
│  ├─ components.json               # Shared components catalog (ids, versions, owners)
│  └─ schemas/
│     ├─ kb.schema.json
│     ├─ adr.schema.json
│     ├─ pattern.schema.json
│     ├─ policy.schema.json
│     └─ component.schema.json
├─ policies/
│  └─ adr/                          # Human ADR markdowns remain here
│     ├─ 0001-architecture-boundaries.md
│     └─ 0002-shared-components.md
├─ scripts/
│  ├─ kb-build.ts                   # Parse ADR markdown → adr.json; validate all KB files
│  └─ kb-validate.ts                # CI validator (refs resolve, schemas pass)
└─ .github/workflows/
├─ plan.yml                      # Now loads KB for planning/validation
├─ validate-artifacts.yml        # Runs kb-validate.ts
└─ publish-reports.yml


⸻

Minimal JSON shapes (idiomatic, agent-friendly)

knowledge/kb.json

{
"version": "2025.11.11",
"indexes": {
"adr": "knowledge/adr.json",
"patterns": "knowledge/patterns.json",
"policies": "knowledge/policies.json",
"components": "knowledge/components.json"
}
}

knowledge/adr.json (excerpt)

[
{
"id": "ADR-0001",
"title": "Architecture Boundaries",
"status": "accepted",
"decision_date": "2025-10-15",
"applies_to": ["domains/*"],
"rules": [
{"type": "layer", "from": "shells", "to": "domains/*", "allow": false},
{"type": "dependency", "from": "capabilities/*", "to": "packages/ui-kit", "allow": true}
],
"doc_ref": "policies/adr/0001-architecture-boundaries.md"
}
]



knowledge/patterns.json (excerpt)

[
{
"id": "PAT-UI-CARD-GRID",
"name": "Card Grid Layout",
"category": "ui",
"constraints": {
"min_columns": 3,
"max_columns": 5,
"spacing": "8px-24px"
},
"lint_rules": ["ui-grid-columns", "ui-spacing-scale"],
"examples": ["packages/ui-kit/examples/card-grid"],
"applies_to": ["shells/*", "domains/*"]
}
]

knowledge/policies.json (excerpt)

{
"naming": {
"capability_id": "^[a-z0-9-]+$",
"branch_feat": "^feat\\/[a-z0-9-]+\\/[a-z0-9-]+$"
},
"versions": {
"react": "19.2.0",
"next": "15.0.3",
"tailwind": "3.4.0"
},
"frozen_rules": [
{"id": "POL-LAYER-001", "type": "layer", "from": "domains/*", "to": "shells/*", "allow": false}
]
}

knowledge/components.json (excerpt)

[
{
"id": "COMP-UI-CARD",
"name": "UICard",
"package": "@zyp/ui-kit",
"version": "2.3.1",
"owners": ["@design-systems"],
"usage": ["shells/*", "domains/*"],
"replaces": ["COMP-LEGACY-CARD"]
}
]


⸻

How EPCC uses the KB (phase-by-phase)

PHASE 1 — Explore
•   Inputs: issue data + knowledge/*
•   Agent behavior:
•   Resolve ADR implications (e.g., can this capability depend on X?).
•   Suggest patterns (UI/API) and shared components by ID.
•   Write a normalized queue YAML with kb_refs: { adrs:[], patterns:[], policies:[], components:[] }.

Output additions
•   context-report.json includes kb_matches and any policy risks detected early.

PHASE 2 — Plan
•   Use policies.json to enforce naming, version floors, and branch formats.
•   Use components.json to force reuse (block plan if re-implementing an existing component).
•   Priority may factor policy_risk_penalty and component_reuse_bonus.

Output additions
•   sprint-plan.json embeds KB references per item, e.g.:

{
"item_id": 123,
"kb_refs": { "adrs": ["ADR-0001"], "patterns": ["PAT-UI-CARD-GRID"], "components": ["COMP-UI-CARD"] }
}



PHASE 3 — Code
•   Scaffold agent imports components by ID; if a component is missing, it opens a component request issue.
•   PR template checks for KB IDs in the changed capability manifest and test plan.

PHASE 4 — Certify
•   ADR Validator converts adr.json.rules into static checks (layer/dependency).
•   UI lint runs pattern rules mapped from patterns.json.lint_rules.
•   Policy Enforcer checks naming/version rules from policies.json.
•   Coverage Auditor verifies presence of tests for AC and at least one pattern example if applicable.

Output additions
•   adr-check-report.md and validation.log list KB rule passes/fails by ID.

PHASE 5 — Deploy + Learn
•   On release, update components.json version usage stats (optional).
•   Feed KB usage + violations into /reports/planning-audit.json to guide future patterns/policies.

⸻

Diagram (updated text sketch with KB)

PHASE 0: BACKLOG ENTRY
Issues → schema check → status:ready-for-plan
│
▼
PHASE 1: EXPLORE ──────────────┐
(Context, ADR discovery)     │   Uses KB:
• Load knowledge/kb.json    │   • adr.json
• Suggest patterns & comps  │   • patterns.json
• Write kb_refs into queue  │   • policies.json
│          │   • components.json
▼          │
PHASE 2: PLAN ─────────────────┘
• Enforce policies.json (names/versions)
• Force components reuse (components.json)
• Prioritize w/ kb-derived risk/bonus
• Output sprint-plan.json (w/ kb_refs)
│
▼
PHASE 3: CODE
• Scaffold imports by component IDs
• PR carries kb_refs in plan-link.json
│
▼
PHASE 4: CERTIFY
• ADR rules → static checks
• Patterns → UI lint rules
• Policies → naming/version gates
• Produce adr-check-report.md
│
▼
PHASE 5: DEPLOY + LEARN
• Update reports + (optional) KB usage stats
• Telemetry informs next Explore


⸻

CI wiring (what actually enforces this)
•   plan.yml
•   kb-validate.ts (schema & referential integrity)
•   Planner loads knowledge/*.json to:
•   annotate issues with kb_refs
•   block items missing required ADR or pattern references (per domain)
•   validate-artifacts.yml
•   Static rule checks from adr.json.rules
•   Pattern lint rules
•   Policy gates (naming/versions)
•   Component reuse enforcement


Authoring rules (practical guidance)
•   Start small: 5–10 ADRs, 8–12 patterns, 10–20 policies, 10–30 components.
•   Every backlog item must reference at least:
•   1 ADR (or “ADR-N/A” for pure UI tweaks),
•   1 pattern (UI or API), and
•   0+ components (if UI/API is involved).
•   Maintain ADRs in Markdown; generate adr.json via scripts/kb-build.ts.
•   Treat patterns.json as design-system contracts (not just docs).
•   Keep policies.json the single place for frozen rules; don’t duplicate in code.

⸻

Why this works
•   Deterministic for agents (IDs, schemas).
•   Auditable for humans (Markdown ADRs + JSON indexes).
•   Scalable for the platform (enforces reuse, prevents drift).
•   Plug-and-play with EPCC (each phase knows exactly how to query and apply the KB).

If you’d like, I can generate starter files for knowledge/*.json and the kb.schema.json so you can drop them in today


awesome—here’s your updated ASCII with a tall, thin right-hand column labeled AI API, listing the API calls each phase would make. i kept your five big phase boxes and added the API column that runs top-to-bottom.

⸻

EPCC – Multi-Agent Orchestrations + AI API (right column)

┌──────────────────────────────────────────────────────────────────────────────┐ ┌───────────────┐
│                                PHASE 1: EXPLORE                              │ │    AI API     │
│──────────────────────────────────────────────────────────────────────────────│ │ (calls by     │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐            │ │   phase)      │
│  │ Context Agent    │  │ ADR Agent        │  │ Dependency Mapper│            │ │               │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘            │ │  EXPLORE      │
│  ┌──────────────────┐  ┌──────────────────┐                                   │ │  • kb.query() │
│  │ Component Reuse  │  │ Impact Analyzer  │                                   │ │  • adr.lookup(│
│  │ Agent            │  │ (optional)       │                                   │ │    ids|topic) │
│  └──────────────────┘  └──────────────────┘                                   │ │  • patterns.  │
│      ↓ outputs context-report.json, dependency-map.json, kb_refs              │ │    suggest()  │
└──────────────────────────────────────────────────────────────────────────────┘ │  • comps.suggest│
│  • deps.graph() │
┌──────────────────────────────────────────────────────────────────────────────┐ │  • risk.estimate│
│                                PHASE 2: PLAN                                 │ │               │
│──────────────────────────────────────────────────────────────────────────────│ │  PLAN          │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐            │ │  • plan.build()│
│  │ Planner Agent    │  │ Clarifier Agent  │  │ Priority Agent   │            │ │  • ac.refine() │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘            │ │  • priority.   │
│  ┌──────────────────┐  ┌──────────────────┐                                   │ │    score()     │
│  │ Dependency       │  │ ADR Validator    │                                   │ │  • deps.validate│
│  │ Validator Agent  │  │ Agent            │                                   │ │  • adr.validate│
│  └──────────────────┘  └──────────────────┘                                   │ │  • policy.check│
│      ↓ outputs sprint-plan.json, sprint-summary.md, risk-register.md          │ │  • kb.linkRefs()│
└──────────────────────────────────────────────────────────────────────────────┘ │               │

┌──────────────────────────────────────────────────────────────────────────────┐ │  CODE          │
│                                PHASE 3: CODE                                 │ │  • scaffold.   │
│──────────────────────────────────────────────────────────────────────────────│ │    generate()  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐            │ │  • contracts.  │
│  │ Scaffold Agent   │  │ Integration Agent│  │ Dev Agent        │            │ │    synthesize()│
│  └──────────────────┘  └──────────────────┘  └──────────────────┘            │ │  • comps.bind()│
│  ┌──────────────────┐  ┌──────────────────┐                                   │ │  • code.modify()│
│  │ Test Generator   │  │ Merge Preparer   │                                   │ │  • tests.gen() │
│  │ Agent            │  │ Agent            │                                   │ │  • pr.prepare()│
│  └──────────────────┘  └──────────────────┘                                   │ │  • docs.generate│
│      ↓ outputs feature branches, PRs, plan-link.json, tests                   │ │               │
└──────────────────────────────────────────────────────────────────────────────┘ │  CERTIFY       │
│  • tests.run()  │
┌──────────────────────────────────────────────────────────────────────────────┐ │  • coverage.calc│
│                               PHASE 4: CERTIFY                               │ │  • adr.validate│
│──────────────────────────────────────────────────────────────────────────────│ │  • policy.check│
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐            │ │  • patterns.audit│
│  │ QA Agent         │  │ ADR Validator    │  │ Policy Enforcer  │            │ │  • security.scan │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘            │ │  • certify.bundle│
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐            │ │    .create()    │
│  │ Pattern Auditor  │  │ Coverage Auditor │  │ Certifier Coord. │            │ │               │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘            │ │  DEPLOY+LEARN  │
│      ↓ outputs adr-check-report.md, validation.log, certification-bundle.zip │ │  • release.notes│
└──────────────────────────────────────────────────────────────────────────────┘ │  • deploy.trigger│
│  • telemetry.ingest│
┌──────────────────────────────────────────────────────────────────────────────┐ │  • dora.report()│
│                             PHASE 5: DEPLOY + LEARN                          │ │  • kb.updateUsage│
│──────────────────────────────────────────────────────────────────────────────│ │  • lessons.extract│
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐            │ │  • backlog.raise │
│  │ Release Agent    │  │ Telemetry Agent  │  │ Learning Agent   │            │ │    (improvement) │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘            │ │               │
│      ↓ outputs release-notes.md, pipeline-metrics.json,                       │ │ (column spans │
│        improvement-proposals.yml (feeds next Explore)                         │ │  top→bottom)  │
└──────────────────────────────────────────────────────────────────────────────┘ └───────────────┘


⸻


Excellent strategic question — and this one hits the heart of how you scale the agentic SDLC cleanly without ending up with “function sprawl.”
Let’s unpack it precisely 👇

⸻

🧩 Short Answer

Not every API is unique to one agent — most are reusable across phases and agents.

Your AI API is designed as a shared cognitive service layer, not one-off calls.
Each agent uses a subset of this API according to its role and phase.

Think of it this way:

🧠 The agents represent “who does the work,”
🔧 The API endpoints represent “how they think or interact.”

⸻

🧭 Architectural Principle

➤ Few APIs, many agents

You want a small, stable AI API surface that’s:
•   Phase-agnostic (usable in multiple phases),
•   Functionally cohesive (grouped by capability: knowledge, reasoning, validation, synthesis, telemetry),
•   Governance-aware (always context + policy bound).

This ensures every new agent you add (say, a Security Analyzer or Cost Optimizer) can call the same primitives without API proliferation.

⸻

🧠 Breakdown by API Category

API Group   Common Prefix   Used By Phases  Description Reuse Level
Knowledge Base  kb.*    All (esp. Explore, Plan, Certify, Learn)    Query, link, update, and audit KB entries (ADRs, patterns, policies).   🔁 High reuse
ADR / Policy Validation adr.*, policy.* Explore, Plan, Certify  Enforce architecture, dependency, and frozen rule constraints.  🔁 High reuse
Patterns & Components   patterns.*, comps.* Explore, Plan, Code, Certify    Recommend or validate design and code reuse patterns.   🔁 High reuse
Planning / Prioritization   plan.*, priority.*, deps.*, risk.*  Plan, Explore, Deploy+Learn Build sprint plans, resolve dependencies, rank by value/risk.   🔁 Moderate reuse
Scaffolding / Coding    scaffold.*, contracts.*, code.*, tests.*, pr.*, docs.*  Code    Generate, integrate, and document new or changed capabilities.  🔁 Medium reuse (in Code & Learn)
Validation / Certification  tests.*, coverage.*, certify.*, security.*  Certify Execute validation pipelines and produce cert bundles.  🔁 Moderate reuse (Certify + Plan)
Telemetry / Learning    telemetry.*, dora.*, lessons.*, backlog.*   Deploy + Learn, Explore Collect metrics, extract lessons, and generate new backlog items.   🔁 High reuse (Learn → Explore feedback)


⸻

🧠 Practical Mapping — Agent ↔ API Reuse Example

Agent   Core APIs Called    Shared With
Context Agent   kb.query, adr.lookup, patterns.suggest  ADR Agent, Component Agent
ADR Agent   adr.lookup, adr.validate, policy.check  ADR Validator (Certify)
Planner Agent   plan.build, priority.score, deps.validate   Priority Agent, Dependency Validator
Clarifier Agent ac.refine, kb.linkRefs  Test Generator Agent
Scaffold Agent  scaffold.generate, contracts.synthesize, comps.bind Integration Agent, Dev Agent
QA Agent    tests.run, coverage.calc, policy.check  Coverage Auditor, Certifier Coordinator
Telemetry Agent telemetry.ingest, dora.report, kb.updateUsage   Learning Agent
Learning Agent  lessons.extract, backlog.raise, kb.updateUsage  Context Agent (next sprint Explore)

🟢 Notice the reuse: most API groups (especially kb.*, adr.*, patterns.*, policy.*) span multiple agents and multiple phases.

⸻

⚙️ Design Implication — The AI API Should Be Layered

You can think of the AI API like this:

┌───────────────────────────────────────────────┐
│                AI API LAYER                   │
├───────────────────────────────────────────────┤
│  [Shared Services]                            │
│   kb.*, adr.*, patterns.*, comps.*, policy.*  │ ← universal governance / context
│                                               │
│  [Phase Services]                             │
│   plan.*, scaffold.*, tests.*, telemetry.*,   │
│   certify.*, learn.*                          │ ← task-specific orchestration
└───────────────────────────────────────────────┘

Then, each agent orchestration binds to this layer via an API manifest, e.g.:

{
"agent": "clarifier",
"allowed_calls": ["kb.query", "ac.refine", "patterns.suggest", "kb.linkRefs"]
}

✅ That gives you:
•   Security: agents can only use whitelisted calls.
•   Traceability: audit which calls were made, by which agent, in which phase.
•   Flexibility: add new agents with zero new endpoints—reuse existing ones.

⸻

🧠 TL;DR — Reuse vs. Uniqueness

Aspect  Reality
Unique APIs ~25–30% (mostly generation or orchestration-specific: scaffold.generate, plan.build, certify.bundle.create)
Reusable APIs   ~70–75% (knowledge, policy, ADR, telemetry, patterns)
Architectural Goal  Small, stable, composable AI API that every agent can draw from contextually
Analogy Think of it like AWS SDK: many services share get, validate, link, and update primitives; specialized APIs only appear at orchestration points


⸻

If you want, I can now draft the AI API schema itself — showing reusable endpoints grouped under each category (Knowledge, Policy, Plan, Code, Certify, Learn) with example request/response formats.
Would you like me to generate that next?




quick reference: API call purposes
•   kb.query / kb.linkRefs / kb.updateUsage — read & write into your JSON knowledge-base (ADRs, patterns, policies, components).
•   adr.lookup / adr.validate — fetch ADRs and run static boundary checks (layer, dependency, version).
•   patterns.suggest / patterns.audit — propose or verify design-system patterns (UI/API).
•   comps.suggest / comps.bind — discover and bind shared components by ID.
•   deps.graph / deps.validate — compute and verify cross-capability dependencies.
•   risk.estimate — produce risk profile using deps + telemetry.
•   plan.build / priority.score — assemble and rank the sprint plan.
•   ac.refine — convert rough AC to Given/When/Then + contracts.
•   scaffold.generate / contracts.synthesize / code.modify — create or change code/defs.
•   tests.gen / tests.run / coverage.calc — generate & execute tests and compute coverage.
•   policy.check / security.scan — enforce naming/version/frozen rules; run sec checks.
•   pr.prepare / docs.generate / certify.bundle.create — create PRs, human docs, and certification bundles.
•   deploy.trigger / release.notes — push artifacts and emit notes.
•   telemetry.ingest / dora.report / lessons.extract / backlog.raise — feedback loop; auto-raise improvements.

if you want, i can turn these API names into a typed interface (TypeScript) and a mock service your agents can call right away.
















⸻

🧠 EPCC → Multi-Agent Orchestration Model

Each phase = a micro-ecosystem of cooperating agents
Each agent = single responsibility, policy-aware, KB-connected

⸻

🧩 PHASE 1 — EXPLORE

Goal: Understand context, dependencies, policies, and patterns before planning begins.

Agents in this phase

Agent   Responsibility  Consumes    Produces
🧭 Context Agent Reads issue + KB to establish problem scope, domain ownership, dependencies.    Backlog issue, knowledge/kb.json    context-report.json
📚 ADR Agent Cross-references ADRs/policies relevant to the capability.  knowledge/adr.json, knowledge/policies.json ADR summary, warnings
🔗 Dependency Mapper Resolves upstream/downstream capabilities and shared components.    manifests/capabilities-catalog.json dependency-map.json
🧩 Component Reuse Agent Suggests reusable components & UI/API patterns from KB. knowledge/components.json, knowledge/patterns.json  component-suggestions.json
🧮 Impact Analyzer (optional)    Estimates cross-domain impact / risk using telemetry + deps.    reports/pipeline-metrics.json   risk-profile.json

Coordinator: Explore Coordinator merges all outputs → context-report.json + updates issue labels (status:ready-for-plan).

⸻

🧩 PHASE 2 — PLAN

Goal: Convert context into a sprint plan that’s dependency-aware, prioritized, and policy-compliant.

Agents in this phase

Agent   Responsibility  Consumes    Produces
🗺️ Planner Agent    Builds sprint-plan.json; assembles items by domain/capability.  Context reports, backlog queue  sprint-plan.json
🧠 Clarifier Agent   Expands vague AC → concrete Given/When/Then & data contracts.   Issue body, patterns.json   updated queue YAML
⚖️ Priority Calculator  Scores by business value × risk × dependency cost × effort. Metrics, KB policies    weighted plan
🧩 Dependency Validator  Confirms cross-capability links are resolvable. manifests/* validation-report.json
🧾 ADR Validator Confirms every plan item has at least one ADR and no conflicts. knowledge/adr.json  adr-check-report.json

Coordinator: Sprint Planner Orchestrator aggregates these into /sprints/<id>/sprint-plan.json + summary.

⸻

🧩 PHASE 3 — CODE

Goal: Generate or modify capability codebases and integrate shared components.

Agents in this phase

Agent   Responsibility  Consumes    Produces
🧱 Scaffold Agent    Generates folder structure, manifests, Zod contracts.   sprint-plan.json, KB policies   PR branch with scaffolds
🧩 Integration Agent Connects shared components / APIs per KB IDs.   components.json, manifests  integration-report.json
✍️ Dev Agent    Implements described features/tests with human-in-loop review.  clarified AC, context   code commits
🧪 Test Generator Agent  Builds baseline tests from Given/When/Then & contracts. queue YAML, plan    test files
🔀 Merge Preparer    Opens PR, inserts .zyp/plan-link.json, triggers CI. repo metadata   PR URL


⸻

🧩 PHASE 4 — CERTIFY

Goal: Verify technical, architectural, and governance compliance.

Agents in this phase

Agent   Responsibility  Consumes    Produces
✅ QA Agent  Executes test suites, collects coverage metrics.    code repo   test-report.json
🧩 ADR Validator (repeat)    Runs static ADR rules (layer/dependency).   adr.json    adr-check-report.md
🔒 Policy Enforcer   Checks naming, version locks, security policies.    policies.json   compliance-log.json
🧩 Pattern Auditor   Validates UI/API design adherence.  patterns.json   pattern-audit.json
🧮 Coverage Auditor  Measures coverage and maps to AC IDs.   reports from CI coverage-summary.json
🤝 Certifier Coordinator Aggregates all validation outputs and signs-off merge readiness.    all above   certification-bundle.zip


⸻

🧩 PHASE 5 — DEPLOY + LEARN

Goal: Release, observe, and feed learnings back into EPCC.

Agents in this phase

Agent   Responsibility  Consumes    Produces
🚀 Release Agent Performs deployment, updates version catalogs.  CI build artifacts  release-notes.md
📊 Telemetry Agent   Extracts DORA metrics, logs coverage deltas, failure rates. CI/CD telemetry pipeline-metrics.json
🧠 Learning Agent    Feeds outcomes into next Explore phase (auto-creates issues).   pipeline-metrics.json, backlog status   improvement-proposals.yml


⸻

🔄 Agent Orchestration Model

              ┌───────────────────────────────────────────────────┐
              │                 EPCC COORDINATOR                  │
              │ orchestrates phase transitions & dependencies     │
              └───────────────────────────────────────────────────┘
                     │
                     ▼
    ┌───────────────┐  ┌──────────────┐  ┌─────────────┐  ┌────────────┐  ┌─────────────┐
    │ EXPLORE       │→│ PLAN          │→│ CODE        │→│ CERTIFY     │→│ DEPLOY+LEARN│
    │ (Context set) │  │ (Sprint plan)│  │ (PRs)      │  │ (Validation)│  │ (Feedback)  │
    └───────────────┘  └──────────────┘  └─────────────┘  └────────────┘  └─────────────┘
        │    ▲             │   ▲            │   ▲           │   ▲            │   ▲
        ▼    │             ▼   │            ▼   │           ▼   │            ▼   │
multiple agents     multiple agents  multiple agents multiple agents  multiple agents
(context, adr,      (planner, clarifier, scaffold,   (qa, adr, policy, release,
deps, components)   priority, validator) integrator)  pattern, coverage) telemetry)


⸻

🧠 Why Multi-Agent > Single Agent

Benefit Explanation
Isolation of responsibility Each agent can be tested, audited, and upgraded independently.
Governance enforcement  Agents query KB rules and ADRs relevant only to their task.
Parallelism Multiple capabilities/domains can run the same phase concurrently.
Resilience  A single failure doesn’t stall the entire pipeline; orchestration retries per agent.
Extensibility   New agents (e.g., Cost Analyzer, UX Auditor) can plug into existing phases.


⸻

⚙️ Technical Implementation Pattern
•   Each agent is a Node service or function under packages/agents/<agent-name>.
•   All share:
•   @zyp/agent-core (common SDK)
•   @zyp/knowledge-client (reads knowledge/*.json)
•   @zyp/event-bus (Redis pub/sub or queue for coordination)
•   EPCC Orchestrator manages:
•   Phase registry (phases.json)
•   Agent routing tables (agents.json)
•   State persistence (/reports/epcc-state.json)

⸻

TL;DR

✅ Yes — each phase deliberately uses multiple agents.
•   Explore = discover & contextualize
•   Plan = prioritize & validate
•   Code = scaffold & implement
•   Certify = verify & enforce
•   Deploy+Learn = release & feed back

Each agent is small, composable, KB-aware, and policy-bounded.
Together they form your Agentic Mesh — the heart of a scalable, self-governing SDLC.

Would you like me to chart this as a multi-lane diagram (Agents × EPCC Phases) showing which agents live in which phase and how they interact through the Knowledge Base?
