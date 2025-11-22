# Monitoring Metrics Implementation - What's Needed

**Status:** ⚠️ Partially Implemented
**Issue:** `/api/v1/monitoring/metrics/realtime` returns 500 errors
**Impact:** Dashboard monitoring page crashes

---

## Current State

### ✅ What's Already Implemented

1. **EventAggregatorService** - Service exists and is started
   - Location: `packages/orchestrator/src/services/event-aggregator.service.ts`
   - Started in server.ts: `await eventAggregator.start()`
   - Subscribes to workflow events
   - Caches metrics in Redis
   - Broadcasts metrics every 5 seconds

2. **Monitoring Routes** - API endpoints exist
   - Location: `packages/orchestrator/src/api/routes/monitoring.routes.ts`
   - Endpoint: `GET /api/v1/monitoring/metrics/realtime`
   - Returns cached metrics from EventAggregator

3. **Frontend Monitoring Components** - Dashboard components exist
   - Real-time metrics display
   - Polling fallback (when WebSocket unavailable)
   - Auto-refresh every 5 seconds

### ❌ What's Breaking

**The response schema mismatch causes Fastify validation to fail**

**Expected Schema (line 35-40):**
```typescript
{
  data: RealtimeMetricsSchema,    // ← Wrapped in 'data'
  timestamp: string,
  ttl_ms: number
}
```

**Actual Response (line 80-101):**
```typescript
{
  timestamp: string,               // ← Direct properties
  overview: {...},
  agents: [...],
  error_rate_percent: number,
  // ... more direct properties
}
```

This mismatch causes Fast Response Schema Validation to reject the response with a 500 error.

---

## Fix Required

### Option 1: Fix Response to Match Schema (Recommended)

**Change:** Wrap `transformedMetrics` in a `data` property

**File:** `packages/orchestrator/src/api/routes/monitoring.routes.ts:103-108`

```typescript
// ❌ CURRENT (line 108):
reply
  .header('Cache-Control', 'no-cache, must-revalidate')
  .header('Content-Type', 'application/json')
  .code(200)
  .send(transformedMetrics);

// ✅ FIX:
reply
  .header('Cache-Control', 'no-cache, must-revalidate')
  .header('Content-Type', 'application/json')
  .code(200)
  .send({
    data: transformedMetrics,
    timestamp: new Date().toISOString(),
    ttl_ms: 5000  // Matches broadcast interval
  });
```

### Option 2: Update Schema to Match Current Response

**Change:** Update Fastify schema to expect direct properties

**File:** `packages/orchestrator/src/api/routes/monitoring.routes.ts:34-40`

```typescript
// ❌ CURRENT:
response: {
  200: zodToJsonSchema(
    z.object({
      data: RealtimeMetricsSchema,
      timestamp: z.string().datetime(),
      ttl_ms: z.number().int()
    })
  ),

// ✅ FIX:
response: {
  200: zodToJsonSchema(RealtimeMetricsSchema),  // Expect direct schema
```

**Recommended:** Option 1 - It maintains consistency with other API responses that wrap data.

---

## Additional Fixes Needed

### 1. Frontend Null Safety

**File:** `packages/dashboard/src/pages/MonitoringDashboard.tsx` (or similar)

**Issue:** Component tries to read `metrics.data.total_workflows` when `metrics` is undefined

**Error:**
```
Cannot read properties of undefined (reading 'total_workflows')
```

**Fix:** Add defensive null checks

```typescript
// ❌ CURRENT:
const totalWorkflows = metrics.data.total_workflows;

// ✅ FIX:
const totalWorkflows = metrics?.data?.total_workflows ?? 0;

// OR with fallback:
const totalWorkflows = metrics?.data?.total_workflows || 0;
const running = metrics?.data?.running || 0;
const completed = metrics?.data?.completed || 0;
```

### 2. Error Boundary Component

**Recommendation:** Wrap monitoring dashboard in an error boundary

```typescript
// packages/dashboard/src/components/ErrorBoundary.tsx
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error boundary caught:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <h2 className="text-lg font-semibold text-red-800 dark:text-red-200">
            Something went wrong
          </h2>
          <p className="text-sm text-red-600 dark:text-red-300 mt-2">
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: undefined })}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

**Usage:**
```typescript
// In MonitoringDashboard or parent route
<ErrorBoundary>
  <MonitoringDashboard />
</ErrorBoundary>
```

---

## Implementation Steps

### Step 1: Fix API Response Schema Mismatch (5 minutes)

```bash
# Edit monitoring.routes.ts
vim packages/orchestrator/src/api/routes/monitoring.routes.ts

# Find line 108 and replace with:
reply
  .header('Cache-Control', 'no-cache, must-revalidate')
  .header('Content-Type', 'application/json')
  .code(200)
  .send({
    data: transformedMetrics,
    timestamp: new Date().toISOString(),
    ttl_ms: 5000
  });
```

### Step 2: Add Frontend Null Safety (10 minutes)

```bash
# Find the monitoring dashboard component
find packages/dashboard/src -name "*Monitoring*" -type f

# Add defensive null checks to all metrics.data accesses
# Replace: metrics.data.total_workflows
# With: metrics?.data?.total_workflows ?? 0
```

### Step 3: Rebuild and Test (2 minutes)

```bash
# Rebuild orchestrator
cd packages/orchestrator
pnpm build

# Restart orchestrator
pnpm pm2 restart orchestrator

# Rebuild dashboard
./dev rebuild-dashboard

# Test endpoint
curl http://localhost:3051/api/v1/monitoring/metrics/realtime | jq .
```

### Step 4: Verify in Browser

1. Open http://localhost:3050
2. Navigate to Monitoring Dashboard
3. Check Network tab - should see successful requests
4. Verify metrics display correctly

---

## Testing

### Manual Test

```bash
# 1. Test API endpoint
curl -s http://localhost:3051/api/v1/monitoring/metrics/realtime | jq .

# Expected response:
{
  "data": {
    "timestamp": "2025-11-21T20:00:00Z",
    "overview": {
      "total_workflows": 0,
      "running": 0,
      "completed": 0,
      ...
    },
    "agents": [],
    ...
  },
  "timestamp": "2025-11-21T20:00:00Z",
  "ttl_ms": 5000
}

# 2. Check orchestrator logs
pnpm pm2 logs orchestrator --lines 20

# Should NOT see errors

# 3. Test dashboard
# Open http://localhost:3050/monitoring
# Should display metrics without crashes
```

---

## Files to Modify

| File | Change | Lines | Effort |
|------|--------|-------|--------|
| `packages/orchestrator/src/api/routes/monitoring.routes.ts` | Wrap response in `data` property | 103-108 | 2 min |
| `packages/dashboard/src/pages/MonitoringDashboard.tsx` | Add null safety `?.` operators | Multiple | 5 min |
| `packages/dashboard/src/components/ErrorBoundary.tsx` | Create new component | N/A (new) | 5 min |
| `packages/dashboard/src/App.tsx` or routing file | Wrap monitoring route in ErrorBoundary | 1-2 | 2 min |

**Total estimated time:** 15-20 minutes

---

## Root Cause Summary

The monitoring infrastructure was implemented in Session #88 but has a **schema validation mismatch**:

1. **Fastify schema** expects: `{ data: {...}, timestamp: string, ttl_ms: number }`
2. **Actual response** sends: `{ timestamp: string, overview: {...}, agents: [...], ... }`
3. **Fastify validation** rejects the response → 500 error
4. **Frontend** receives 500 → crashes trying to read undefined `data.total_workflows`

**The fix is simple:** Wrap the response in a `data` property to match the schema, and add null safety to the frontend.

---

## Priority

**Medium-High** - This doesn't affect core workflow functionality, but it breaks the monitoring dashboard which is a useful feature.

**Workaround:** Users can still use the API directly and view workflows/tasks through other dashboard pages.

**Impact if not fixed:**
- Monitoring dashboard unusable
- Real-time metrics unavailable
- Error spam in browser console
- Poor user experience

**Impact if fixed:**
- Real-time workflow monitoring works
- Dashboard provides live system health
- Better operational visibility
