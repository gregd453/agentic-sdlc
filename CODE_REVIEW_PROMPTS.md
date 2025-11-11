# CODE_REVIEW_PROMPTS.md
**Project:** Agentic SDLC – Production Readiness Track  
**Date:** 2025-11-08 (context captured)  
**Scope:** Monorepo (agents, orchestrator), PM2, Docker/ECS, PostgreSQL, Redis, GitHub Actions, Security Agent, Mock Factories

> Use these prompts as copy‑paste checklists in PR descriptions or as reviewer scripts. They’re grouped so specialists (security, infra, test) can focus quickly. Each section ends with **Blockers** (must fix before merge) and **Nits** (non‑blocking).

---

## 0) One‑Minute PR Intake (for every reviewer)
- **Intent & Risk**: What problem does this PR solve? What could it break (state machine, deployments, credential flow)?
- **Scope Control**: Is the change reasonably small and cohesive? Any unrelated refactors?
- **Repro**: Are clear **how‑to‑run** steps included (pnpm commands, env vars, docker compose)?
- **Tests**: What tests changed/added? Are failure cases covered?
- **Rollout**: Is there a rollback plan or feature flag?

**Blockers**: Missing description; failing CI; unexplained prod config changes.  
**Nits**: Naming, comments, minor formatting.

---

## 1) Application & Orchestrator Logic
**Prompt**  
- Does the **pipeline state machine** define clear transitions, timeouts, and idempotency on each stage (initialization → scaffolding → validation → e2e → integration → deploy)?
- Are **side effects** (Redis pub/sub, DB writes, external calls) wrapped with retry + dedupe (eventId, TTL, at‑least‑once semantics)?
- Is **dependency injection** used for testability (mocks plugged via constructor or context)?
- Are **errors typed** and observable (error code, category, remediation hint)?
- Does the PR impact **agent concurrency** (PM2 cluster size, graceful shutdown, backoff)?
- Is cross‑agent **contract** change (schemas, messages) versioned and backward compatible?

**Blockers**: Un‑guarded state transitions; non‑idempotent handlers; hidden global state.  
**Nits**: Verbose logs; redundant awaits; small DRY issues.

---

## 2) Testing & Mock Factories
**Prompt**  
- Do mocks in `packages/agents/*/__tests__/mock-factories.ts` align with **Zod schemas** and real runtime constraints?
- Are **happy + unhappy paths** tested (timeouts, retries, partial failures, rollbacks)?
- Are **integration tests** stable (use containers or testcontainers, seeded data, non‑flaky clocks)?
- Is **coverage meaningful** for the changed code (critical branches, error paths, race conditions)?
- Do tests assert **contract fields** (ids, timestamps, status enums) rather than brittle strings?

**Blockers**: Failing or flaky tests; schema drift; nondeterministic timers without control.  
**Nits**: Test names; duplicate fixtures.

---

## 3) Security (OWASP Top 10 + API)
**Prompt**  
- Does the change degrade **authz/authn** (route `config.roles`, `public: true`, JWT validation)?
- Are inputs/params validated with **Zod** on all Fastify routes (body, params, query)?
- Are secrets/configs sourced from **env** (no plaintext in repo); `.env.production.example` updated?
- Do Next.js headers/Helmet enforce **CSP/HSTS/COOP/COEP/Permissions‑Policy**; CORS is allow‑list?
- Any raw SQL or unsafe fetch/axios targets? Enforce **Prisma parameterization** and **egress allowlist**.
- Did CI security jobs (Semgrep/OSV/Trivy/ZAP) pass? Were Medium+ findings triaged or waived with expiry?

**Blockers**: Unvalidated inputs; permissive CORS; secrets in code; missing auth guards.  
**Nits**: Over‑broad CSP `unsafe-inline` for scripts; missing `x-request-id` propagation.

---

## 4) CI/CD (GitHub Actions) & Release Hygiene
**Prompt**  
- Do pipeline changes keep **stages** (quality/test/security/build/deploy‑staging/prod/rollback) intact?
- Are **caches** and **matrix** strategies sane (pnpm store, buildx cache, concurrency groups)?
- Are **environments/secrets** referenced by correct names (staging vs prod)?
- Is the **SARIF** upload wired for security scans; failures correctly gate PRs?
- Are **image tags** correct (branch, SHA, semver) and immutable for production?

**Blockers**: Broken pipeline; secrets mis‑scoped; release artifacts not reproducible.  
**Nits**: Over‑chattiness in logs.

---

## 5) Containers, PM2, and Runtime Ops
**Prompt**  
- **Dockerfile.production**: Multi‑stage, non‑root, minimal runtime, no dev deps; healthcheck present.
- **docker-compose.production.yml**: Resource limits/requests match SLOs; health checks are meaningful.
- **PM2**: Cluster mode defaults acceptable; graceful shutdown signals handled; log rotation configured.
- Verify **image size** and **CVE** scan results (Trivy) for this change. Any base image updates needed?

**Blockers**: Runs as root; missing healthchecks; known critical CVEs introduced.  
**Nits**: Unnecessary layers; inconsistent labels.

---

## 6) Data Layer (PostgreSQL/Prisma) & Caching (Redis)
**Prompt**  
- Are migrations backward compatible for blue/green (add‑then‑migrate‑then‑cleanup)?
- Is **tenant scoping** enforced on writes/reads; no cross‑tenant leakage?
- Are long‑running queries paginated and indexed; N+1 avoided?
- Redis keys use namespacing and reasonable TTL; pub/sub channels are partitioned per environment.

**Blockers**: Destructive migrations without guards; cross‑tenant access; unbounded scans.  
**Nits**: Missing partial indexes; minor TTL tuning.

---

## 7) Observability & Operations
**Prompt**  
- Are logs **structured** (JSON), include `x-request-id`, and avoid PII?
- Are metrics added/updated for critical paths (state transitions, retries, queue depth, latency, error rate)?
- Are alerts defined or documented for new failure modes?
- Is the **/health** endpoint truthful (DB/Redis checks, build info, git sha)?

**Blockers**: PII logs; silent failures; no visibility into new components.  
**Nits**: Log verbosity on success paths.

---

## 8) Documentation, ADRs & Governance
**Prompt**  
- PR includes a short **design note** or links to an **ADR** when changing contracts, states, or security posture.
- Updated **README/Runbook** for new ops steps, env vars, dashboards.
- Security exceptions documented under `/security/waivers/` with owner + expiry.
- Version changes reflected in `.nvmrc`, lockfile, and any pinned images.

**Blockers**: Missing ADR for architectural change; outdated runbooks; undocumented waivers.  
**Nits**: Minor doc formatting.

---

## 9) Performance & Resilience
**Prompt**  
- Are hot paths efficient (no synchronous CPU spikes; batched I/O; connection pooling)?
- Backoff/retry policies avoid thundering herd (jitter, max attempts, circuit breakers)?
- Reasonable **SLOs** referenced (p95 latency, error budgets) and no obvious regressions in code paths?

**Blockers**: Infinite retries; blocking calls on event loops; O(n^2) on large inputs.  
**Nits**: Micro‑optimizations without measurement.

---

## 10) PR Author Self‑Checklist (paste in PR body)
- [ ] I explained the risk/impact and provided repro steps
- [ ] I added/updated tests (unit/integration/e2e negative cases)
- [ ] I updated `.env.production.example` and docs
- [ ] I ran `pnpm -w sec:all` and addressed Medium+ findings or added a waiver
- [ ] I verified Docker image builds, runs as non‑root, and passes health checks
- [ ] I updated or referenced an ADR for any protocol/contract change
- [ ] I confirmed CI/CD jobs pass, and staging deploy is non‑disruptive

---

## 11) Copy‑Paste Review Prompts for LLM/Agent Reviewer

### A) Full‑Stack Review Prompt
> You are a senior reviewer for an agentic SDLC monorepo. Review the diff for correctness, safety, and production impact. Focus on state machine transitions, idempotency, schema alignment (Zod/Prisma), authZ on Fastify routes, Dockerfile security (non‑root, healthchecks), and CI gates. Identify Blockers vs Nits. Propose minimal diffs to fix Blockers. Output:
> 1) Summary of intent
> 2) Risks & failure modes
> 3) Findings (Blockers/Nits) with file:line
> 4) Suggested patches
> 5) Tests to add

### B) Security‑Focused Prompt
> Act as a security engineer. Evaluate this PR against OWASP Top 10 (Web + API). Check Zod validation coverage, route RBAC, JWT usage, CSP/CORS, secret handling, SSRF risks, raw SQL, and CI scan results. List **Medium+** issues as Blockers with precise file:line and a patch. Provide a waiver template if risk‑accepted.

### C) CI/CD & Ops Prompt
> Review GitHub Actions, PM2 config, Dockerfile, and docker‑compose changes. Ensure build cache efficiency, correct secret scoping, immutable image tags, healthchecks, resource limits, and rollback paths. Flag any production‑affecting change without a runbook update.

### D) Testing Prompt
> Review tests for completeness and determinism. Ensure mocks match Zod schemas, include negative cases, control time and randomness, and cover race conditions in the state machine. Propose 2–3 additional tests that would have caught historical bugs.

---

## 12) Waiver Template (when blocking issues are risk‑accepted)
```md
# Security/Quality Waiver
- **PR**: <link>
- **Owner**: <name>
- **Issue**: <describe finding>
- **Severity**: <Low|Medium|High|Critical>
- **Temporary Mitigation**: <steps>
- **Expiry Date**: YYYY‑MM‑DD
- **Plan to Remediate**: <issue link / milestone>
- **Approval**: <name/role>
```

---

## 13) Quick Commands (Reviewer Toolkit)
```bash
# typecheck + lint + tests
pnpm -w typecheck && pnpm -w lint && pnpm -w test

# run security agent bundle
pnpm -w sec:all && pnpm -w sec:test

# build and run prod image locally
docker build -f Dockerfile.production -t agentic/app:pr .
docker run --rm -p 3000:3000 --user 10001:10001 agentic/app:pr

# compose (db + redis + app)
docker compose -f docker-compose.production.yml up -d
```

---

### Reviewer Definition of Done
- No Blockers remain; CI green; docs updated; rollback path clear; security posture unchanged or explicitly improved.
