---
doc_type: policy
status: active
priority: critical
audience: all
version: 1.0.0
last_updated: 2025-11-03

layers:
  - shells
  - shell-bff
  - app-bff
  - apps
  - packages
  - infrastructure

components:
  - all

tags:
  - version-lock
  - dependency-management
  - pnpm
  - governance

related_docs:
  - CLAUDE.md
  - SDLC-POLICIES.md
  - DEVELOPMENT-STANDARDS.md

focus:
  - layer: all
    role: all
    aspect: "Frozen versions, no ^ or ~, enforcement via pnpm workspace"

---

# Version Lock Policy

All versions across the ZYP Platform are **frozen and enforced at the directory level** using pnpm workspace overrides.

## Why?

- ✅ **Consistency** - All apps use identical versions
- ✅ **Predictability** - No surprise breaking changes from dependencies
- ✅ **Performance** - Single source of truth for resolution
- ✅ **Security** - All security patches applied uniformly
- ✅ **Maintainability** - Version upgrades happen platform-wide, not per-app

## Frozen Versions

See `CLAUDE.md` for the complete list.

## Enforcement Points

Each directory level locks versions:

```
apps/pnpm-workspace.yaml        ← All apps inherit these versions
packages/pnpm-workspace.yaml    ← All packages inherit these versions
shells/pnpm-workspace.yaml      ← All shells inherit these versions
```

## How It Works

pnpm's `overrides` field enforces exact versions at install time. If you try to:

```json
{
  "dependencies": {
    "react": "19.3.0"  // ❌ Will be overridden to 19.2.0
  }
}
```

**Result:** React 19.2.0 is installed, not 19.3.0.

## Updating Versions

To upgrade a frozen version:

1. Update `CLAUDE.md` table
2. Update all three `pnpm-workspace.yaml` files with new version
3. Run `pnpm install` at root to validate
4. Test all apps thoroughly
5. Commit with message: `chore: upgrade [package] to X.Y.Z`

## Individual App package.json

Individual app `package.json` files should **not list tool versions** in devDependencies. They only list:

```json
{
  "name": "@zyp/user-core",
  "dependencies": {
    "fastify": "5.6.1",
    "zod": "3.23.0"
  },
  "devDependencies": {
    "concurrently": "8.2.0"  // App-specific, not locked globally
  }
}
```

The workspace overrides handle TypeScript, ESLint, Vitest, etc.

## Rules

- ❌ **Never** use ^ or ~ in package.json
- ❌ **Never** add tool versions (TypeScript, ESLint) to individual app package.json
- ❌ **Never** change versions locally without updating CLAUDE.md
- ✅ **Always** run `pnpm install` after updating versions
- ✅ **Always** test all apps after version changes
- ✅ **Always** commit version changes with `chore:` prefix

## Viewing Current Locks

```bash
# See what's locked in apps/
cat apps/pnpm-workspace.yaml

# See what's locked in packages/
cat packages/pnpm-workspace.yaml

# See what's locked in shells/
cat shells/pnpm-workspace.yaml

# See all frozen versions
grep -A 50 "Frozen Versions" CLAUDE.md
```

## Emergency Override (Not Recommended)

If a critical bug requires a version change before the next scheduled upgrade:

1. Document in PR why it's necessary
2. Get approval from tech lead
3. Update CLAUDE.md and all pnpm-workspace.yaml files
4. Test thoroughly
5. Mark as `chore: [CRITICAL]` in commit message

