# API URL Configuration Fix

**Issue Date:** 2025-11-21
**Status:** ✅ FIXED with validation
**Severity:** Critical - Prevents all API calls from working

---

## Problem Statement

The dashboard was making API calls to **incorrect URLs without the `/api/v1` prefix**:

```javascript
// ❌ WRONG (what was happening)
GET http://localhost:3051/workflows?status=running  // 404 Not Found

// ✅ CORRECT (what should happen)
GET http://localhost:3051/api/v1/workflows?status=running  // 200 OK
```

This caused **all dashboard functionality to break** because the orchestrator API serves endpoints under `/api/v1/*`, not at the root.

---

## Root Cause

### 1. **Environment Variable Missing Suffix**

In `.env.development`:
```bash
# ❌ WRONG - Missing /api/v1
VITE_API_URL=http://localhost:3051

# ✅ CORRECT - Includes /api/v1
VITE_API_URL=http://localhost:3051/api/v1
```

### 2. **Client Code Logic**

In `packages/dashboard/src/api/client.ts`:
```typescript
export function getAPIBase(): string {
  const apiUrl = (import.meta.env as Record<string, any>).VITE_API_URL

  // If VITE_API_URL is set, it's used AS-IS (no validation)
  if (apiUrl) {
    return apiUrl  // ⚠️ Trusts the env var completely
  }

  // Fallback only applies if VITE_API_URL is NOT set
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:3051/api/v1'  // ✅ Correct fallback
  }

  return '/api/v1'
}
```

**The Problem:**
When `VITE_API_URL` is set (even incorrectly), the fallback logic is **never reached**. The code trusts the environment variable completely.

### 3. **Vite Bundling**

Vite bakes environment variables into the built JavaScript at **build time**:
```javascript
// At build time, Vite replaces:
import.meta.env.VITE_API_URL

// With the literal value from .env:
"http://localhost:3051"  // ❌ Without /api/v1
```

This means:
- ❌ Once built, the API URL is **hardcoded** into JavaScript files
- ❌ Changing `.env` after build has **no effect**
- ❌ Browser cache can serve stale builds with wrong URLs
- ✅ **Must rebuild** for changes to take effect

---

## Why This Keeps Happening

1. **Silent Failure** - No build-time validation that `VITE_API_URL` includes `/api/v1`
2. **Build Caching** - Vite/Docker cache can serve old builds even after fixing `.env`
3. **Browser Caching** - Browsers cache JavaScript files, serving stale versions
4. **Documentation Gap** - Not obvious that `/api/v1` suffix is required
5. **Terraform Rebuild** - Terraform recreates dashboard container but may not rebuild image

---

## Permanent Fix (Implemented)

### 1. ✅ Fix Environment Variables

**`.env.development`:**
```bash
# Dashboard API URL for local development (MUST include /api/v1 prefix)
VITE_API_URL=http://localhost:3051/api/v1
```

**`.env.example`:**
```bash
# Dashboard configuration (CRITICAL: MUST include /api/v1 prefix)
VITE_API_URL=http://localhost:3051/api/v1
```

### 2. ✅ Add Build-Time Validation

**`packages/dashboard/vite.config.ts`:**
```typescript
// Validate VITE_API_URL includes /api/v1 suffix (critical for correct API calls)
const apiUrl = process.env.VITE_API_URL;
if (apiUrl && !apiUrl.includes('/api/v1')) {
  console.error('❌ ERROR: VITE_API_URL must include the /api/v1 prefix');
  console.error('');
  console.error(`  Current value: ${apiUrl}`);
  console.error(`  Correct value: ${apiUrl}/api/v1`);
  console.error('');
  console.error('This is required for API calls to work correctly.');
  console.error('Update your .env file to include /api/v1 in VITE_API_URL');
  console.error('');
  process.exit(1);  // ⛔ Build FAILS if validation fails
}
```

**Result:**
Now if someone sets `VITE_API_URL` without `/api/v1`, **the build will fail immediately** with a clear error message.

### 3. ✅ Rebuild Process

To ensure the fix is applied:
```bash
./dev rebuild-dashboard

# This script:
# 1. Loads .env.development ✅
# 2. Runs Vite build (validates API URL) ✅
# 3. Builds Docker image ✅
# 4. Restarts container ✅
# 5. Verifies health check ✅
```

### 4. ✅ Cache Busting

The rebuild script ensures:
- Fresh React build (no Vite cache)
- New Docker image (no layer cache for changed files)
- Container restart (no runtime cache)
- Browser must hard refresh: **Ctrl+Shift+R** (Cmd+Shift+R on Mac)

---

## How to Verify the Fix

### 1. Check Environment Variable
```bash
grep VITE_API_URL .env.development
# Should show: VITE_API_URL=http://localhost:3051/api/v1
```

### 2. Check Built JavaScript
```bash
grep -r "localhost:3051" packages/dashboard/dist/assets/*.js | grep -o "localhost:3051[^\"]*" | head -1
# Should show: localhost:3051/api/v1
```

### 3. Check Network Tab in Browser
1. Open http://localhost:3050
2. Open DevTools → Network tab
3. Click on any workflow or agent
4. Check API calls - should be: `http://localhost:3051/api/v1/workflows`

### 4. Verify Health
```bash
curl http://localhost:3051/api/v1/health
# Should return: {"status":"healthy","timestamp":"..."}
```

---

## Prevention Checklist

✅ **Environment Files Updated**
- `.env.development` has `/api/v1` suffix
- `.env.example` has `/api/v1` suffix and warning comment

✅ **Build-Time Validation Added**
- `vite.config.ts` validates `VITE_API_URL` includes `/api/v1`
- Build fails with clear error if validation fails

✅ **Rebuild Automation**
- `./dev rebuild-dashboard` script rebuilds everything
- No manual steps required

✅ **Documentation**
- This file documents the issue and fix
- Comments in `.env` files warn about requirement

---

## If the Issue Recurs

If you see `404` errors on API calls again:

### 1. Check Environment Variable
```bash
cat .env.development | grep VITE_API_URL
```

**Should show:** `VITE_API_URL=http://localhost:3051/api/v1`

If missing `/api/v1`, update and rebuild:
```bash
# Fix .env.development
vim .env.development  # Add /api/v1 suffix

# Rebuild
./dev rebuild-dashboard
```

### 2. Clear All Caches
```bash
# 1. Full infrastructure reset
./infrastructure/local/full-reset.sh

# 2. Hard refresh browser
# Chrome/Linux: Ctrl+Shift+R
# Mac: Cmd+Shift+R
```

### 3. Check Docker Image
```bash
# Verify image is using latest build
docker exec agentic-sdlc-dev-dashboard cat /app/packages/dashboard/dist/assets/index-*.js | grep -o "localhost:3051[^\"]*" | head -1

# Should show: localhost:3051/api/v1
```

### 4. Verify Build Validation Ran
```bash
# Rebuild and check for validation error
cd packages/dashboard
pnpm build

# If VITE_API_URL is wrong, build should FAIL with:
# ❌ ERROR: VITE_API_URL must include the /api/v1 prefix
```

---

## Technical Details

### Vite Environment Variable Injection

**Build time:**
```typescript
// Source code:
const apiUrl = import.meta.env.VITE_API_URL

// Vite transforms to:
const apiUrl = "http://localhost:3051/api/v1"  // Literal value baked in
```

**This means:**
- Environment variables are **not dynamic** in the browser
- They're **hardcoded** into JavaScript during build
- **Must rebuild** for changes to take effect

### Docker Multi-Stage Build

**Dockerfile.prod:**
```dockerfile
# Stage 1: Build React app
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}
RUN pnpm run build  # Bakes env vars into static files

# Stage 2: Production image
COPY --from=builder /app/packages/dashboard/dist ./packages/dashboard/dist
```

**Important:** `VITE_API_URL` must be provided as **build-arg** to Docker:
```bash
docker build --build-arg VITE_API_URL=http://localhost:3051/api/v1 ...
```

The `./dev rebuild-dashboard` script handles this automatically by loading from `.env.development`.

---

## Files Modified

| File | Change | Purpose |
|------|--------|---------|
| `.env.development` | Added `/api/v1` suffix + comment | Correct API URL for local dev |
| `.env.example` | Added `/api/v1` suffix + warning | Document requirement for all envs |
| `packages/dashboard/vite.config.ts` | Added validation | Fail build if API URL is wrong |
| `docs/API_URL_CONFIGURATION_FIX.md` | Created this file | Document issue and solution |

---

## Summary

**Root Cause:** `VITE_API_URL` environment variable was missing the `/api/v1` suffix

**Impact:** All dashboard API calls returned 404 because they went to wrong URLs

**Fix:**
1. Updated `.env.development` and `.env.example` with correct value
2. Added build-time validation to prevent incorrect values
3. Rebuilt dashboard to apply fix

**Prevention:** Build now **fails fast** with clear error if `VITE_API_URL` is configured incorrectly

**Result:** ✅ This issue should **never happen again** because builds will fail before deployment
