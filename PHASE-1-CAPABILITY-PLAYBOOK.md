# 🚀 Phase 1 Playbook — Cookie‑Cutter Capability (Scaffold ➜ E2E Green ➜ Integrate)

**Scope:** How to create a brand‑new, cookie‑cutter capability with **end‑to‑end (E2E) scaffolding** and **E2E tests** that must pass **before** integration into any shell. Applies again for **each new feature** inside that capability.

**Applies To:** `/apps/<domain>/<capability>-ui` and (optionally) `/services/<domain>-bff`


---

## 0) Objectives & Principles

- **Isolation first:** Scaffold in **isolated mode**. No manifest/CI wiring until green.
- **Same gates everywhere:** Local and CI use the same `./scripts/validate.sh` and `./scripts/e2e.sh`.
- **Contracts‑first:** Zod/OpenAPI contracts drive both UI mocks and API handlers.
- **Automatable:** Every step is scriptable and reproducible by agents and humans.
- **Fast feedback:** Smoke tests + E2E run headless and in parallel, < 3 minutes target.

---

## 1) Preconditions (must be green before starting a new capability)

Run from repo root:

```bash
pnpm install
./scripts/validate.sh          # typecheck + lint + unit + build
./scripts/dev-up.sh            # boots local stack (UI shell(s) + BFFs + DB/mocks)
./scripts/e2e.sh --smoke       # minimal cross‑shell smoke tests (Playwright)
```

✅ If all pass: you’re clear to scaffold.  
❌ If anything fails: fix baseline first — never scaffold onto red.

---

## 2) Cookie‑Cutter Scaffolding (isolated)

Create a new capability **without** touching manifests or CI:

```bash
./scripts/scaffold.sh capability <domain> <capability-name> --isolated
# example:
./scripts/scaffold.sh capability user user-rewards-ui --isolated
```

### 2.1 What gets generated

```
/apps/<domain>/<capability>-ui/
  ├─ src/
  │  ├─ pages/{userHome.tsx, adminHome.tsx}
  │  ├─ components/{CapCard.tsx, EmptyState.tsx}
  │  ├─ hooks/useCap.ts
  │  ├─ api/client.ts                 # typed client (OpenAPI or fetch+zod)
  │  ├─ mocks/handlers.ts             # MSW or lightweight handlers
  │  └─ zod/capability.schema.ts
  ├─ tests/e2e/capability.spec.ts     # Playwright
  ├─ tests/smoke/capability.smoke.ts  # very fast sanity
  ├─ package.json
  └─ README.md
```

If API is included in the slice:

```
/services/<domain>-bff/
  └─ routes/<capability>.ts           # stub handler matching schema
```

### 2.2 Local dev loop

```bash
pnpm turbo run dev --filter=apps/<domain>/<capability>-ui
# or full stack
./scripts/dev-up.sh
```

---

## 3) Tests You Must Add Before Integration

### 3.1 Unit + Contract Tests

- Validate Zod schemas round‑trip sample payloads.
- Client adapter transforms API → ViewModel (and back) with type safety.

Example (Vitest):

```ts
import { Reward } from '../src/zod/cability.schema';

test('reward schema: valid sample', () => {
  const data = { id: 'r1', name: 'Welcome', points: 100 };
  const parsed = Reward.parse(data);
  expect(parsed.points).toBe(100);
});
```

### 3.2 E2E Smoke (Playwright)

- Route loads without errors.
- Primary CTA renders & works with mocked API.
- Accessibility check (axe or playwright‑accessibility‑audit is fine).
- Basic auth/role visibility (user vs admin route guarded).

`tests/e2e/capability.spec.ts` template:

```ts
import { test, expect } from '@playwright/test';

test.describe('Capability: User Rewards', () => {
  test('user can view rewards list', async ({ page }) => {
    await page.goto('http://localhost:3000/capabilities/user-rewards');
    await expect(page.getByRole('heading', { name: /rewards/i })).toBeVisible();
    await expect(page.getByTestId('reward-card')).toHaveCountGreaterThan(0);
  });

  test('admin panel is access‑guarded', async ({ page }) => {
    await page.goto('http://localhost:3000/admin/rewards');
    await expect(page.getByText(/unauthorized|sign in/i)).toBeVisible();
  });
});
```

### 3.3 API Route (if applicable)

- Handler returns 200 with contract‑correct payload for a happy path.
- Error path returns typed problem+json (or error shape) and is asserted.

---

## 4) Required Scripts

Add or reuse these top‑level scripts (called by CI and humans).

**`./scripts/validate.sh`** (already standardized)  
Runs: install → typecheck → lint → unit → build.

**`./scripts/e2e.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail

# Boot stack if not running (idempotent)
docker compose ps >/dev/null 2>&1 || docker compose up -d

# Optionally filter capability
CAP_FILTER="${1:-}"

echo "Running Playwright E2E..."
if [ -n "$CAP_FILTER" ]; then
  pnpm --filter="apps/**" exec playwright test "tests/e2e/${CAP_FILTER}.spec.ts" --reporter=line
else
  pnpm --filter="apps/**" exec playwright test --reporter=line
fi
```

**`./scripts/dev-up.sh`**  
Brings up Next shells, BFFs, and mocks with seeded data.

---

## 5) Green‑Before‑Integration Gate (Definition of Ready)

All must be ✅ **on the feature branch** before you touch manifests/CI:

- `./scripts/validate.sh` passes
- `./scripts/e2e.sh <capability>` passes (headless)
- Lighthouse (or simple perf check) LCP < 3.0s local (optional budget)
- No ESLint warnings in new app (strict: warn‑as‑error)
- README.md includes:
  - Routes, roles, flags
  - Contracts and sample payloads
  - Known limitations / TODOs

> Reviewer checklist lives in `/.github/CAPABILITY_DOR.md`

---

## 6) Integration PR (Promotion to Dev visibility)

Once green, open a **separate PR** that does only:

1. **Manifest registration** (now non‑isolated):
   - Add capability key to `runtime.<shell>.json`
2. **CI/CD registration** (if independent deployable):
   - Add to matrix or list in `.github/workflows/dev-deploy.yml`
   - Ensure `deploy-aws.sh` knows how to containerize/deploy it
3. **Shell exposure (optional)**:
   - Toggle a feature flag to show entry points in nav/tiles

**Never mix integration with feature work.** One PR = one promotion.

---

## 7) Per‑Feature Playbook (inside an existing capability)

Repeat a lighter version of the above **for each new feature** (e.g., “redeem reward”):

1. **Branch & contracts**
   ```bash
   git checkout -b feat/user-rewards/redeem
   # Update zod + OpenAPI first
   ```
2. **Unit tests first**
   - Zod contract, VM transforms, small component behavior
3. **UI/API implementation**
   - Respect existing folder structure and patterns
4. **E2E coverage**
   - Add a focused Playwright test for the new flow
5. **Validate + E2E**
   ```bash
   ./scripts/validate.sh
   ./scripts/e2e.sh user-rewards
   ```
6. **PR → main (no manifest change if already integrated)**
   - CI runs same gates and deploys to Dev

**Feature DoD:**  
- Contract updated & versioned (semver on API and UI where applicable)  
- Unit + E2E added and passing  
- Docs updated (`CHANGELOG.md`, feature section in capability README)  
- Flags defaulted to off/on per release plan

---

## 8) CI Pipeline Sketch (verify → integrate)

**.github/workflows/verify.yml** (on PRs)

```yaml
name: Verify
on:
  pull_request:
    branches: [ main ]
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: pnpm install
      - run: ./scripts/validate.sh
      - run: ./scripts/dev-up.sh
      - run: ./scripts/e2e.sh "${{ github.head_ref }}"  # optional filter
```

**.github/workflows/dev-deploy.yml** (on merge to main)

```yaml
name: Dev Deploy
on:
  push:
    branches: [ main ]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: pnpm install
      - run: ./scripts/validate.sh
      - run: ./scripts/dev-up.sh
      - run: ./scripts/e2e.sh --smoke
      - run: ./scripts/build-images.sh
      - run: ./scripts/deploy-aws.sh
```

> Guard `deploy-aws.sh` with `if [ -z "${CI:-}" ]; then exit 1; fi`

---

## 9) Data & Mocks Strategy

- **Default:** MSW (browser/node) with handlers in `src/mocks/handlers.ts`
- **Fixture seed:** JSON fixtures under `tests/fixtures/`
- **API opt‑in:** Switch mocks off via `NEXT_PUBLIC_USE_MOCKS=false` to hit BFF

This ensures E2E can run without real backends and flips to live easily.

---

## 10) Rollback Plan (Phase 1)

- Every capability and service is built/tagged by `GIT_SHA`
- Re‑deploy by SHA using `deploy-aws.sh --sha <commit>`
- Feature flags gate visibility in shells

---

## 11) Checklists

**New Capability — Pre‑Integration**  
- [ ] Validate passes  
- [ ] E2E (capability scope) passes  
- [ ] Docs present (README, routes, contracts)  
- [ ] No warnings, no eslint disables  
- [ ] Feature flags defined (default off)  

**Integration PR**  
- [ ] Manifest updated  
- [ ] CI matrix updated (if needed)  
- [ ] Smoke tests green against integrated shell  
- [ ] Rollback/flag plan noted in PR description  

**Per Feature**  
- [ ] Contract + unit tests first  
- [ ] UI + API implemented  
- [ ] E2E added/updated  
- [ ] Validate + E2E green locally  
- [ ] PR → main; CI green; Dev verifies

---

## 12) Quick Commands Reference

```bash
# Start clean
pnpm install && ./scripts/validate.sh

# Scaffold isolated capability
./scripts/scaffold.sh capability user user-rewards-ui --isolated

# Dev loop (capability-only)
pnpm turbo run dev --filter=apps/user/user-rewards-ui

# Full stack up
./scripts/dev-up.sh

# Run E2E (all or filtered)
./scripts/e2e.sh
./scripts/e2e.sh user-rewards

# Promote (in separate PR)
# 1) Add to runtime.<shell>.json
# 2) Update CI matrix if independently deployable
```

---

### Outcome

By following this playbook, every new capability (and each feature within it) arrives **production‑shaped**: isolated, validated, contract‑aligned, with E2E coverage — and only then is **promoted** to shells and CI/CD for Dev deployment.
