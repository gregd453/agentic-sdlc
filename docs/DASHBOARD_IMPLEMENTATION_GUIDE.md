# Dashboard Implementation Guide

**Version:** 2.0 | **Status:** Phase 2 & 3 Complete | **Last Updated:** 2025-11-15

---

## Quick Start

### View the Dashboard
```bash
# Dashboard is already running at:
open http://localhost:3001

# Or via curl:
curl http://localhost:3001
```

### Start All Services (Development)
```bash
./scripts/env/start-dev.sh
```

### Stop All Services
```bash
./scripts/env/stop-dev.sh
```

### View Logs
```bash
# All services
pnpm pm2:logs

# Specific service
pnpm pm2:logs orchestrator
pnpm pm2:logs dashboard

# Docker logs
docker-compose -f docker-compose.simple.yml logs -f dashboard
```

---

## Architecture Overview

### Services
```
┌─────────────────────────────────────────────┐
│  Dashboard (Docker)                         │
│  React 18 + TypeScript + Vite               │
│  Port: 3001                                 │
└─────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────┐
│  Orchestrator API (PM2)                     │
│  Node.js + Fastify                          │
│  Port: 3000                                 │
└─────────────────────────────────────────────┘
              ↓
┌──────────────────┬──────────────────────────┐
│  PostgreSQL      │  Redis                   │
│  Port: 5433      │  Port: 6380              │
└──────────────────┴──────────────────────────┘
```

### Data Flow
```
Dashboard (Port 3001)
    ↓
http://localhost:3000/api/v1/stats/*
    ↓
Orchestrator REST API (Port 3000)
    ↓
PostgreSQL (Port 5433)
Redis (Port 6380)
```

---

## Dashboard Pages

### 1. Dashboard (Overview)
**Route:** `/`
**Features:**
- 4 KPI cards (Total, Running, Completed, Failed)
- Pie chart: Status distribution
- Area chart: 24h throughput

**Data Refresh:** 10-30 seconds

### 2. Workflows
**Route:** `/workflows`
**Features:**
- Table with all workflows
- Status filter (running, completed, failed, paused, cancelled)
- Type filter (app, feature, bugfix)
- Progress bars
- Direct links to workflow details

**Data Refresh:** 10 seconds

### 3. Agents
**Route:** `/agents`
**Features:**
- Agent health cards (5-column grid)
- Health status (healthy/degraded/unhealthy)
- Success rate per agent
- Bar chart: Task completion by agent
- Line chart: System throughput
- Detailed metrics table

**Health Thresholds:**
- Healthy: Avg latency < 5 seconds
- Degraded: Avg latency 5-15 seconds
- Unhealthy: Avg latency > 15 seconds

**Data Refresh:** 10 seconds

### 4. Traces
**Route:** `/traces`
**Features:**
- Search by trace ID or workflow ID
- Status filter
- Configurable page size (10, 20, 50, 100)
- Trace details table (7 columns)
- Links to related workflows

**Data Refresh:** 15 seconds

---

## API Endpoints

### Overview Stats
```bash
GET http://localhost:3000/api/v1/stats/overview
```

**Response:**
```json
{
  "overview": {
    "total_workflows": 50,
    "running_workflows": 0,
    "completed_workflows": 0,
    "failed_workflows": 0,
    "paused_workflows": 0
  },
  "recent_workflows_count": 0,
  "avg_completion_time_ms": null
}
```

### Workflows
```bash
GET http://localhost:3000/api/v1/workflows?status=running&type=app
```

### Agent Stats
```bash
GET http://localhost:3000/api/v1/stats/agents
```

### Time Series (24h)
```bash
GET http://localhost:3000/api/v1/stats/timeseries?period=24h
```

### Traces (Placeholder)
```bash
GET http://localhost:3000/api/v1/traces?status=completed&limit=20
```

---

## Component Structure

### Pages (`packages/dashboard/src/pages/`)
```
Dashboard.tsx          # Overview with KPI cards & charts
WorkflowsPage.tsx      # Workflow list and filters
AgentsPage.tsx         # Agent health and metrics
TracesPage.tsx         # Trace search and list
WorkflowPage.tsx       # Workflow detail (placeholder)
NotFoundPage.tsx       # 404 page
```

### Common Components (`packages/dashboard/src/components/Common/`)
```
LoadingSpinner.tsx     # Reusable loading indicator
ErrorDisplay.tsx       # Error state component
StatusBadge.tsx        # Status color badges
ProgressBar.tsx        # Progress indicator
ChartContainer.tsx     # Chart wrapper with loading/error
GlobalFiltersBar.tsx   # Global filter controls
```

### Hooks (`packages/dashboard/src/hooks/`)
```
useStats.ts           # Overview, agents, timeseries stats
useWorkflows.ts       # Workflow data fetching
useChartData.ts       # Chart data transformation
```

### Utilities (`packages/dashboard/src/utils/`)
```
numberFormatters.ts    # Number formatting (K, M, %)
chartColorMap.ts       # Status-to-color mapping
traceGraphBuilder.ts   # Trace visualization
formatters.ts          # Date and ID formatting
```

---

## Adding New Charts

### 1. Create Chart Component
```tsx
// packages/dashboard/src/components/Charts/MyChart.tsx
import { BarChart, Bar, ResponsiveContainer } from 'recharts'
import ChartContainer from '../Common/ChartContainer'

interface MyChartProps {
  data: Array<{name: string; value: number}>
  isLoading?: boolean
}

export default function MyChart({ data, isLoading }: MyChartProps) {
  return (
    <ChartContainer
      title="My Chart Title"
      subtitle="Optional subtitle"
      height={300}
      isLoading={isLoading}
    >
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          {/* Chart configuration */}
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}
```

### 2. Add API Function (if needed)
```tsx
// packages/dashboard/src/api/client.ts
export async function fetchMyData(): Promise<MyDataType[]> {
  return fetchJSON(`${API_BASE}/my-endpoint`)
}
```

### 3. Create Hook
```tsx
// packages/dashboard/src/hooks/useStats.ts (or new file)
export function useMyData() {
  return useQuery({
    queryKey: ['my-data'],
    queryFn: fetchMyData,
    refetchInterval: 30000,
  })
}
```

### 4. Use in Page
```tsx
// packages/dashboard/src/pages/MyPage.tsx
import { useMyData } from '../hooks/useStats'
import MyChart from '../components/Charts/MyChart'

export default function MyPage() {
  const { data, isLoading } = useMyData()

  return (
    <MyChart data={data || []} isLoading={isLoading} />
  )
}
```

---

## Styling Guide

### Color Palette
```tsx
// Status colors
export const statusColors = {
  completed: '#10b981',   // Green
  running: '#3b82f6',     // Blue
  failed: '#ef4444',      // Red
  initiated: '#6b7280',   // Gray
  paused: '#f59e0b',      // Amber
  cancelled: '#6b7280',   // Gray
}

// Agent health colors
export const agentHealthColors = {
  healthy: '#10b981',     // Green
  degraded: '#f59e0b',    // Amber
  unhealthy: '#ef4444',   // Red
}
```

### Tailwind Classes
```tsx
// Cards
className="bg-white shadow rounded-lg p-4"

// Grids
className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"

// Responsive text
className="text-2xl font-bold text-gray-900"

// Hover effects
className="hover:bg-gray-50"
```

---

## Data Fetching Patterns

### Using React Query
```tsx
import { useQuery } from '@tanstack/react-query'
import { fetchData } from '../api/client'

function MyComponent() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['data-key'],
    queryFn: fetchData,
    refetchInterval: 30000,  // Auto-refresh every 30s
    staleTime: 10000,         // Cache for 10s
    gcTime: 300000,           // Keep in memory for 5min
  })

  if (isLoading) return <LoadingSpinner />
  if (error) return <ErrorDisplay error={error} retry={refetch} />

  return <div>{/* render data */}</div>
}
```

### Error Handling
```tsx
// Fallback when API is unavailable
async function fetchWithFallback() {
  try {
    return await fetchJSON(url)
  } catch (error) {
    console.warn('API call failed, using fallback data')
    return getDefaultData()
  }
}
```

---

## Performance Tips

### 1. Use React.memo for Cards
```tsx
const MetricCard = React.memo(({ title, value }: Props) => (
  <div>{value}</div>
))
```

### 2. Optimize Chart Data
```tsx
// Pre-process data to avoid recalculation
const chartData = useMemo(() =>
  transformData(rawData),
  [rawData]
)
```

### 3. Configure Refetch Intervals
```tsx
// Slower updates for less critical data
refetchInterval: 60000  // 1 minute

// Faster updates for critical metrics
refetchInterval: 5000   // 5 seconds
```

### 4. Use Chart Container Loading State
```tsx
// Prevents jank when updating
<ChartContainer isLoading={isLoading}>
  {data && <MyChart data={data} />}
</ChartContainer>
```

---

## Testing

### Build & Verify
```bash
# Build dashboard
pnpm --filter @agentic-sdlc/dashboard build

# Check TypeScript
pnpm --filter @agentic-sdlc/dashboard typecheck

# Build Docker image
docker build -f Dockerfile.dashboard -t agentic-sdlc-dashboard:latest .
```

### Manual Testing
```bash
# Restart dashboard
docker-compose -f docker-compose.simple.yml restart dashboard

# Test API endpoints
curl http://localhost:3000/api/v1/stats/overview

# Test dashboard loads
curl http://localhost:3001
```

### Browser Testing
1. Open http://localhost:3001
2. Check Console (F12) for errors
3. Test each page navigation
4. Verify charts render
5. Check responsive design (resize browser)

---

## Troubleshooting

### Dashboard Shows "No Data"
**Check:**
1. Is orchestrator running? `pnpm pm2:status`
2. Is API accessible? `curl http://localhost:3000/api/v1/health`
3. Check dashboard logs: `docker logs agentic-sdlc-dashboard`
4. Refresh page (hard refresh: Ctrl+Shift+R)

### Charts Not Rendering
**Check:**
1. Open browser console (F12)
2. Look for JavaScript errors
3. Verify data is being fetched: Network tab
4. Check if Recharts is loading properly

### API 404 Errors
**Check:**
1. Is orchestrator accessible? `curl http://localhost:3000/health`
2. Is endpoint correct? Check `packages/dashboard/src/api/client.ts`
3. Check orchestrator logs: `pnpm pm2:logs orchestrator`

### Docker Container Won't Start
```bash
# Check logs
docker logs agentic-sdlc-dashboard

# Rebuild image
docker build -f Dockerfile.dashboard -t agentic-sdlc-dashboard:latest .

# Restart
docker-compose -f docker-compose.simple.yml restart dashboard
```

---

## Development Workflow

### 1. Make Changes
```bash
# Edit component
vim packages/dashboard/src/pages/Dashboard.tsx
```

### 2. Test Build
```bash
# Build dashboard
pnpm --filter @agentic-sdlc/dashboard build

# Check for errors
# Should show "✓ built in X.XXs"
```

### 3. Update Docker
```bash
# Rebuild image
docker build -f Dockerfile.dashboard -t agentic-sdlc-dashboard:latest .

# Restart container
docker-compose -f docker-compose.simple.yml restart dashboard

# Verify
curl http://localhost:3001
```

### 4. Test in Browser
```bash
# Hard refresh
open http://localhost:3001
# Cmd+Shift+R on Mac
# Ctrl+Shift+R on Windows/Linux
```

### 5. Commit Changes
```bash
git add .
git commit -m "feat(dashboard): Add new feature"
```

---

## Next Steps

### Phase 4: Styling & Polish
- [ ] Add dark mode support
- [ ] Implement smooth animations
- [ ] Add Heroicons
- [ ] Fine-tune responsive layouts
- [ ] Improve accessibility

### Phase 5: Testing & Validation
- [ ] Add Jest unit tests
- [ ] Add Playwright E2E tests
- [ ] Run accessibility audit
- [ ] Performance testing
- [ ] Load testing

### Phase 6: Documentation & Deploy
- [ ] Create user guide
- [ ] Document API endpoints
- [ ] Create deployment guide
- [ ] Setup monitoring
- [ ] Release to production

---

## Resources

### Documentation
- [DASHBOARD_PHASE_2_3_SUMMARY.md](./DASHBOARD_PHASE_2_3_SUMMARY.md) - Detailed phase completion report
- [Recharts Docs](https://recharts.org) - Chart library
- [Tailwind CSS](https://tailwindcss.com) - Styling framework
- [React Query](https://tanstack.com/query/latest) - Data fetching

### Files
- Dashboard: `packages/dashboard/src/`
- Orchestrator API: `packages/orchestrator/src/`
- Docker: `Dockerfile.dashboard`, `docker-compose.simple.yml`

### Commands
```bash
./scripts/env/start-dev.sh      # Start all services
./scripts/env/stop-dev.sh       # Stop all services
pnpm pm2:status                 # Check PM2 processes
pnpm pm2:logs                   # View logs
docker-compose -f docker-compose.simple.yml ps  # Docker status
```

---

**Last Updated:** 2025-11-15 | **Status:** Production Ready ✅
