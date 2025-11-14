# Agent Workflow Monitoring Dashboard - Implementation Plan

**Status:** Ready to Implement
**Tech Stack:** React 18 + TypeScript + Vite + TailwindCSS + Recharts
**Port:** 3001 (proxies to orchestrator on 3000)

---

## Dashboard Overview

A real-time monitoring dashboard for visualizing agent workflows, traces, tasks, and system health with interactive graphs and components.

### Key Features

1. **Workflow List View** - Live table of all workflows with filtering
2. **Workflow Detail View** - Detailed workflow info with timeline
3. **Trace Visualization** - Interactive span hierarchy graph
4. **Agent Performance** - Charts showing agent metrics
5. **Real-Time Updates** - Polling/WebSocket for live data
6. **Search & Filter** - By status, trace ID, name, date range

---

## File Structure

```
packages/dashboard/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
├── postcss.config.js
├── index.html
├── src/
│   ├── main.tsx              # App entry point
│   ├── App.tsx               # Root component with routing
│   ├── api/
│   │   └── client.ts         # API client functions
│   ├── components/
│   │   ├── Layout/
│   │   │   ├── Header.tsx    # Top navigation bar
│   │   │   ├── Sidebar.tsx   # Left sidebar menu
│   │   │   └── Layout.tsx    # Main layout wrapper
│   │   ├── Workflows/
│   │   │   ├── WorkflowList.tsx         # Table of workflows
│   │   │   ├── WorkflowCard.tsx         # Workflow summary card
│   │   │   ├── WorkflowDetail.tsx       # Detailed workflow view
│   │   │   ├── WorkflowTimeline.tsx     # Event timeline
│   │   │   └── WorkflowProgress.tsx     # Progress indicator
│   │   ├── Traces/
│   │   │   ├── TraceView.tsx            # Trace search & display
│   │   │   ├── SpanTree.tsx             # Hierarchical span view
│   │   │   └── SpanDetails.tsx          # Individual span info
│   │   ├── Tasks/
│   │   │   ├── TaskList.tsx             # Task table
│   │   │   ├── TaskCard.tsx             # Task summary
│   │   │   └── TaskDetails.tsx          # Full task info
│   │   ├── Charts/
│   │   │   ├── WorkflowStatusChart.tsx  # Pie chart (status distribution)
│   │   │   ├── TimeSeriesChart.tsx      # Line chart (workflows over time)
│   │   │   ├── AgentPerformance.tsx     # Bar chart (agent metrics)
│   │   │   └── DurationHistogram.tsx    # Histogram (task durations)
│   │   └── Common/
│   │       ├── StatusBadge.tsx          # Colored status indicator
│   │       ├── LoadingSpinner.tsx       # Loading state
│   │       ├── ErrorDisplay.tsx         # Error messages
│   │       └── SearchBar.tsx            # Search input
│   ├── pages/
│   │   ├── Dashboard.tsx     # Main dashboard page
│   │   ├── WorkflowsPage.tsx # Workflows list page
│   │   ├── WorkflowPage.tsx  # Single workflow page
│   │   ├── TracesPage.tsx    # Trace visualization page
│   │   └── AgentsPage.tsx    # Agent monitoring page
│   ├── hooks/
│   │   ├── useWorkflows.ts   # Fetch workflows
│   │   ├── useWorkflow.ts    # Fetch single workflow
│   │   ├── useTasks.ts       # Fetch tasks
│   │   ├── useTrace.ts       # Fetch trace data
│   │   └── usePolling.ts     # Auto-refresh hook
│   ├── types/
│   │   └── index.ts          # TypeScript types
│   └── utils/
│       ├── formatters.ts     # Date/duration formatters
│       └── colors.ts         # Status color mapping
└── public/
    └── favicon.ico
```

---

## Component Specifications

### 1. Dashboard Page (Main View)

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│  Agentic SDLC Dashboard             [Search] [User] │
├──────┬──────────────────────────────────────────────┤
│      │  📊 Overview                                  │
│ Nav  │  ┌──────────┬──────────┬──────────┬─────────┐│
│      │  │ Total    │ Running  │ Complete │ Failed  ││
│ •Home│  │  137     │    5     │   98     │   34    ││
│ •Work│  └──────────┴──────────┴──────────┴─────────┘│
│ •Trac│                                               │
│ •Agen│  📈 Workflows Over Time (Last 24h)           │
│      │  [Line Chart]                                 │
│      │                                               │
│      │  🔄 Active Workflows                          │
│      │  [Live Table with Status, Progress, Actions] │
└──────┴───────────────────────────────────────────────┘
```

**Components:**
- 4 metric cards (Total, Running, Complete, Failed)
- Time series chart (workflows created per hour)
- Status distribution pie chart
- Live table of active workflows
- Auto-refresh every 5 seconds

### 2. Workflow List Page

**Features:**
- Filterable table (status, type, date range)
- Sortable columns (created_at, progress, duration)
- Pagination
- Search by name or workflow ID
- Bulk actions (cancel, retry)
- Export to CSV

**Table Columns:**
- Workflow ID (shortened, clickable)
- Name
- Type (app/feature/bugfix)
- Status (badge with color)
- Current Stage
- Progress (bar + percentage)
- Trace ID (hoverable, copyable)
- Created At (relative time)
- Duration
- Actions (View, Cancel, Retry)

### 3. Workflow Detail Page

**URL:** `/workflows/:id`

**Sections:**
1. **Header**
   - Workflow name
   - Status badge
   - Progress bar
   - Action buttons (Cancel, Retry, Delete)

2. **Metadata**
   - ID, Type, Priority
   - Trace ID (copyable link to trace view)
   - Current Span ID
   - Created/Updated/Completed timestamps
   - Creator

3. **Progress Timeline**
   - Visual timeline of stages
   - Stage status indicators
   - Click to expand stage details

4. **Tasks Table**
   - All tasks for this workflow
   - Status, Agent Type, Duration, Retries
   - Link to task details

5. **Events Log**
   - Chronological list of workflow events
   - Timestamps, event types, payloads

6. **Stage Outputs**
   - Collapsible JSON viewer
   - Pretty-printed stage results

### 4. Trace Visualization Page

**URL:** `/traces/:traceId`

**Components:**

**A. Span Tree (Hierarchical View)**
```
🔍 Trace: ec339c58-031b-4a04-a76e-2fc5fbcaebf5

├─ 📦 Workflow: Trace E2E Test
│  ├─ Span: 11f9cfb5e245434f
│  ├─ Duration: 1.97s
│  └─ Status: initiated
│
├─ 📋 Task: ff83e044-26a9-4b8a-8b81-3194aa0b6f72
│  ├─ Agent: scaffold
│  ├─ Span: a1b2c3d4e5f6g7h8
│  ├─ Parent: 11f9cfb5e245434f
│  ├─ Duration: 0.5s
│  └─ Status: failed
```

**B. Flame Graph**
- Horizontal bars showing span durations
- Color-coded by status
- Nested by parent-child relationship
- Click to see span details

**C. Trace Timeline**
- Time-based view of all spans
- Shows overlapping operations
- Highlights critical path

**D. Trace Metadata**
- Total duration
- Number of spans
- Error count
- Related workflows/tasks

### 5. Agent Performance Page

**Charts:**

**A. Agent Success Rate**
- Stacked bar chart per agent type
- Success vs Failed tasks
- Percentage labels

**B. Agent Response Times**
- Box plot showing p50, p95, p99
- By agent type
- Identify slow agents

**C. Task Distribution**
- Pie chart of tasks by agent type
- Shows workload distribution

**D. Retry Analysis**
- Bar chart of average retries per agent
- Identify problematic agents

**E. Agent Timeline**
- Gantt chart showing agent activity
- See concurrent execution

---

## API Endpoints Needed

### Add to Orchestrator

```typescript
// packages/orchestrator/src/api/routes/dashboard.routes.ts

// Workflow endpoints (extend existing)
GET  /api/v1/workflows              # List with filters & pagination
GET  /api/v1/workflows/:id          # Get single workflow
GET  /api/v1/workflows/:id/tasks    # Get all tasks for workflow
GET  /api/v1/workflows/:id/events   # Get workflow events
GET  /api/v1/workflows/:id/timeline # Get workflow timeline

// Trace endpoints (NEW)
GET  /api/v1/traces/:traceId                 # Get trace info
GET  /api/v1/traces/:traceId/spans           # Get all spans (hierarchy)
GET  /api/v1/traces/:traceId/workflows       # Get workflows with trace
GET  /api/v1/traces/:traceId/tasks           # Get tasks with trace

// Task endpoints (NEW)
GET  /api/v1/tasks                  # List all tasks with filters
GET  /api/v1/tasks/:taskId          # Get single task

// Stats endpoints (NEW)
GET  /api/v1/stats/overview         # Dashboard overview metrics
GET  /api/v1/stats/workflows        # Workflow statistics
GET  /api/v1/stats/agents           # Agent performance metrics
GET  /api/v1/stats/timeseries       # Time series data for charts

// Search endpoints (NEW)
GET  /api/v1/search?q=...          # Search workflows/tasks/traces
```

---

## TypeScript Types

```typescript
// src/types/index.ts

export interface Workflow {
  id: string;
  name: string;
  type: 'app' | 'feature' | 'bugfix';
  status: WorkflowStatus;
  current_stage: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  progress: number;
  trace_id?: string;
  current_span_id?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  created_by: string;
  stage_outputs?: Record<string, any>;
}

export type WorkflowStatus = 'initiated' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

export interface Task {
  task_id: string;
  workflow_id: string;
  agent_type: AgentType;
  status: TaskStatus;
  priority: string;
  trace_id?: string;
  span_id?: string;
  parent_span_id?: string;
  assigned_at: string;
  started_at?: string;
  completed_at?: string;
  retry_count: number;
  max_retries: number;
  payload?: any;
  result?: any;
}

export type AgentType = 'scaffold' | 'validation' | 'e2e' | 'integration' | 'deployment';
export type TaskStatus = 'pending' | 'assigned' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface TraceSpan {
  span_id: string;
  parent_span_id?: string;
  trace_id: string;
  entity_type: 'Workflow' | 'Task';
  entity_id: string;
  timestamp: string;
  duration?: number;
  status: string;
}

export interface DashboardStats {
  total_workflows: number;
  running_workflows: number;
  completed_workflows: number;
  failed_workflows: number;
  total_tasks: number;
  avg_workflow_duration: number;
  agent_stats: AgentStats[];
}

export interface AgentStats {
  agent_type: AgentType;
  total_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  avg_duration: number;
  avg_retries: number;
}
```

---

## Key React Components Code

### useWorkflows Hook

```typescript
// src/hooks/useWorkflows.ts
import { useQuery } from '@tanstack/react-query';
import { fetchWorkflows } from '../api/client';

export function useWorkflows(filters?: WorkflowFilters, options?: { refreshInterval?: number }) {
  return useQuery({
    queryKey: ['workflows', filters],
    queryFn: () => fetchWorkflows(filters),
    refetchInterval: options?.refreshInterval || false,
  });
}
```

### WorkflowList Component

```typescript
// src/components/Workflows/WorkflowList.tsx
import { useWorkflows } from '../../hooks/useWorkflows';
import { StatusBadge } from '../Common/StatusBadge';
import { formatDistanceToNow } from 'date-fns';

export function WorkflowList() {
  const { data: workflows, isLoading, error } = useWorkflows({}, { refreshInterval: 5000 });

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorDisplay error={error} />;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th>Name</th>
            <th>Status</th>
            <th>Progress</th>
            <th>Trace ID</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {workflows?.map(workflow => (
            <tr key={workflow.id}>
              <td>
                <Link to={`/workflows/${workflow.id}`}>
                  {workflow.name}
                </Link>
              </td>
              <td><StatusBadge status={workflow.status} /></td>
              <td>
                <ProgressBar value={workflow.progress} />
              </td>
              <td>
                {workflow.trace_id && (
                  <CopyableText value={workflow.trace_id} />
                )}
              </td>
              <td>{formatDistanceToNow(new Date(workflow.created_at))} ago</td>
              <td>
                <ActionButtons workflow={workflow} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

### SpanTree Component

```typescript
// src/components/Traces/SpanTree.tsx
import { useTrace } from '../../hooks/useTrace';

export function SpanTree({ traceId }: { traceId: string }) {
  const { data: spans } = useTrace(traceId);

  const buildTree = (spans: TraceSpan[]) => {
    const map = new Map();
    const roots: TraceSpan[] = [];

    // Build parent-child relationships
    spans.forEach(span => {
      map.set(span.span_id, { ...span, children: [] });
    });

    spans.forEach(span => {
      const node = map.get(span.span_id);
      if (span.parent_span_id) {
        const parent = map.get(span.parent_span_id);
        parent?.children.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  };

  const tree = buildTree(spans || []);

  return (
    <div className="space-y-2">
      {tree.map(root => (
        <TreeNode key={root.span_id} node={root} level={0} />
      ))}
    </div>
  );
}

function TreeNode({ node, level }: { node: any; level: number }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div style={{ marginLeft: `${level * 20}px` }}>
      <div className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded">
        {node.children.length > 0 && (
          <button onClick={() => setExpanded(!expanded)}>
            {expanded ? '▼' : '▶'}
          </button>
        )}
        <span className="font-mono text-sm">{node.entity_type}</span>
        <span className="text-gray-500">{node.entity_id.slice(0, 8)}</span>
        <StatusBadge status={node.status} />
        <span className="text-xs text-gray-400">{node.duration}ms</span>
      </div>
      {expanded && node.children.map((child: any) => (
        <TreeNode key={child.span_id} node={child} level={level + 1} />
      ))}
    </div>
  );
}
```

---

## Styling with TailwindCSS

### Status Colors

```typescript
// src/utils/colors.ts
export const statusColors = {
  initiated: 'bg-blue-100 text-blue-800',
  running: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-800',
  paused: 'bg-purple-100 text-purple-800',
};
```

---

## Installation & Setup

```bash
cd packages/dashboard
pnpm install
pnpm dev  # Starts on http://localhost:3001
```

---

## Next Steps

1. **Create dashboard package structure**
2. **Install dependencies**
3. **Implement API endpoints in orchestrator**
4. **Build core components (Layout, WorkflowList, WorkflowDetail)**
5. **Add charts (WorkflowStatusChart, TimeSeriesChart)**
6. **Implement trace visualization**
7. **Add real-time updates**
8. **Polish UI/UX**
9. **Deploy to production**

---

## Estimated Timeline

- **Core Setup:** 2 hours (package, routing, layout)
- **API Endpoints:** 3 hours (orchestrator routes)
- **Workflow Components:** 4 hours (list, detail, timeline)
- **Trace Visualization:** 3 hours (span tree, timeline)
- **Charts & Metrics:** 3 hours (recharts integration)
- **Polish & Testing:** 2 hours
- **Total:** ~17 hours

---

**Ready to implement!** This provides a complete blueprint for the React dashboard with all necessary components, API endpoints, and visualizations for monitoring agent workflows.
