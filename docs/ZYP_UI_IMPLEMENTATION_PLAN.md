# Zyp Platform - UI Implementation Plan

**Version:** 1.0.0
**Date:** 2025-11-22
**Status:** Design Phase
**Based On:** Zyp Platform UI Design Document

---

## Executive Summary

This document provides a phased implementation plan for the Zyp Platform UI, transforming the existing Agentic SDLC dashboard into a comprehensive multi-platform orchestration interface. The implementation is broken into 6 phases over 16-20 weeks, with each phase delivering incremental value.

### Timeline Overview

| Phase | Duration | Focus | Deliverables |
|-------|----------|-------|--------------|
| Phase 1 | 3 weeks | Foundation & Design System | Component library, navigation, theming |
| Phase 2 | 4 weeks | Platform Management | Platform CRUD, surface configuration, agent registry |
| Phase 3 | 4 weeks | Workflow System | Workflow execution, monitoring, templates |
| Phase 4 | 3 weeks | Analytics & Monitoring | Dashboards, metrics, real-time updates |
| Phase 5 | 3 weeks | Polish & UX | Search, notifications, help system |
| Phase 6 | 3 weeks | Testing & Launch | E2E tests, performance, documentation |

**Total: 20 weeks (5 months)**

---

## Phase 1: Foundation & Design System (Weeks 1-3)

### Goals
- Establish design system and component library
- Implement core navigation and layout
- Set up theming and accessibility foundation

### 1.1 Design System Setup

**Week 1: Core Configuration**

**Tasks:**
1. **Install shadcn/ui with Tailwind CSS**
   ```bash
   npx shadcn-ui@latest init
   ```
   - Configure theme tokens
   - Set up color palette (Blue-800, Violet-600, etc.)
   - Configure typography (Inter, JetBrains Mono)
   - Set up 4px spacing system

2. **Create Theme Provider**
   ```typescript
   // File: packages/dashboard/src/providers/ThemeProvider.tsx
   interface ThemeConfig {
     mode: 'light' | 'dark' | 'system';
     primaryColor: string;
     radius: number;
   }
   ```
   - Light/dark/system themes
   - Theme persistence in localStorage
   - System preference detection

3. **Configure Tailwind Custom Colors**
   ```javascript
   // tailwind.config.js
   colors: {
     primary: {
       DEFAULT: '#1e40af', // Blue-800
       50: '#eff6ff',
       // ... full scale
     },
     secondary: {
       DEFAULT: '#7c3aed', // Violet-600
       // ... full scale
     }
   }
   ```

**Week 2: Base Components**

**Components to Build (using shadcn/ui):**

1. **Layout Components**
   - `AppShell` - Main application wrapper
   - `Sidebar` - Navigation sidebar with collapse
   - `Header` - Top navigation bar
   - `PageContainer` - Consistent page wrapper
   - `ContentArea` - Main content region

2. **Navigation Components**
   - `NavItem` - Sidebar navigation item
   - `NavGroup` - Grouped navigation items
   - `Breadcrumbs` - Page hierarchy breadcrumbs
   - `CommandPalette` - Cmd+K global search

3. **Data Display Components**
   - `MetricCard` - KPI display with sparkline
   - `StatWidget` - Statistic with trend indicator
   - `DataTable` - Enhanced table with sorting/filtering
   - `EmptyState` - No data placeholder

**File Structure:**
```
packages/dashboard/src/
├── components/
│   ├── ui/              # shadcn/ui components
│   ├── layout/          # Layout components
│   │   ├── AppShell.tsx
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   └── PageContainer.tsx
│   ├── navigation/      # Navigation components
│   │   ├── NavItem.tsx
│   │   ├── NavGroup.tsx
│   │   ├── Breadcrumbs.tsx
│   │   └── CommandPalette.tsx
│   └── common/          # Shared components
│       ├── MetricCard.tsx
│       ├── StatWidget.tsx
│       └── EmptyState.tsx
├── lib/
│   ├── utils.ts         # Utility functions
│   └── constants.ts     # App constants
└── styles/
    ├── globals.css      # Global styles
    └── themes.css       # Theme variables
```

**Week 3: Navigation & Routing**

**Tasks:**

1. **Implement Main Navigation Structure**
   ```typescript
   // File: packages/dashboard/src/config/navigation.ts
   export const navigationConfig = {
     main: [
       {
         label: 'Dashboard',
         href: '/',
         icon: LayoutDashboard,
         description: 'Overview and metrics'
       },
       {
         label: 'Platforms',
         href: '/platforms',
         icon: Layers,
         description: 'Manage platforms and configurations'
       },
       {
         label: 'Surfaces',
         href: '/surfaces',
         icon: Grid,
         description: 'Surface registry and designer'
       },
       {
         label: 'Workflows',
         href: '/workflows',
         icon: GitBranch,
         description: 'Active and historical workflows'
       },
       {
         label: 'Agents',
         href: '/agents',
         icon: Bot,
         description: 'Agent registry and configuration'
       },
       {
         label: 'Analytics',
         href: '/analytics',
         icon: BarChart3,
         description: 'Platform metrics and insights'
       }
     ],
     settings: [
       { label: 'Settings', href: '/settings', icon: Settings },
       { label: 'Policies', href: '/policies', icon: Shield },
       { label: 'Users', href: '/users', icon: Users }
     ]
   }
   ```

2. **Create AppShell with Sidebar**
   ```typescript
   // File: packages/dashboard/src/components/layout/AppShell.tsx
   export function AppShell({ children }: { children: React.ReactNode }) {
     const [collapsed, setCollapsed] = useState(false)

     return (
       <div className="flex h-screen bg-background">
         <Sidebar collapsed={collapsed} onToggle={setCollapsed} />
         <div className="flex-1 flex flex-col overflow-hidden">
           <Header />
           <main className="flex-1 overflow-auto">
             {children}
           </main>
         </div>
       </div>
     )
   }
   ```

3. **Implement Command Palette (Cmd+K)**
   ```typescript
   // File: packages/dashboard/src/components/navigation/CommandPalette.tsx
   import { Command } from 'cmdk'

   export function CommandPalette() {
     const [open, setOpen] = useState(false)

     useEffect(() => {
       const down = (e: KeyboardEvent) => {
         if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
           e.preventDefault()
           setOpen((open) => !open)
         }
       }
       document.addEventListener('keydown', down)
       return () => document.removeEventListener('keydown', down)
     }, [])

     return (
       <Command.Dialog open={open} onOpenChange={setOpen}>
         <Command.Input placeholder="Search..." />
         <Command.List>
           <Command.Group heading="Platforms">
             {/* Platform items */}
           </Command.Group>
           <Command.Group heading="Workflows">
             {/* Workflow items */}
           </Command.Group>
         </Command.List>
       </Command.Dialog>
     )
   }
   ```

**Deliverables:**
- ✅ Complete design system configuration
- ✅ 20+ reusable components
- ✅ Main navigation structure
- ✅ Command palette (Cmd+K)
- ✅ Responsive layout foundation
- ✅ Light/dark theme support

---

## Phase 2: Platform Management (Weeks 4-7)

### Goals
- Implement complete platform CRUD
- Build surface configuration UI
- Create agent registry interface

### 2.1 Enhanced Platform Pages

**Week 4: Platform List & Detail**

**Tasks:**

1. **Enhance PlatformsPage (Already Exists)**
   ```typescript
   // File: packages/dashboard/src/pages/PlatformsPage.tsx

   // Add new features:
   - Grid view (existing is list-only)
   - Advanced filtering (type, layer, status)
   - Bulk operations (enable/disable multiple)
   - Platform templates (pre-configured platforms)
   - Export/import platform configs
   ```

2. **Create PlatformCard Component**
   ```typescript
   // File: packages/dashboard/src/components/platforms/PlatformCard.tsx

   interface PlatformCardProps {
     platform: Platform
     view: 'grid' | 'list'
     onEdit: () => void
     onClone: () => void
     onDelete: () => void
     showMetrics?: boolean
   }

   export function PlatformCard({ platform, view, ... }: PlatformCardProps) {
     return (
       <Card className={cn(
         'transition-all hover:shadow-lg',
         view === 'grid' ? 'h-64' : 'h-auto'
       )}>
         <CardHeader>
           <div className="flex items-start justify-between">
             <div className="flex items-center gap-3">
               <PlatformIcon type={platform.type} />
               <div>
                 <CardTitle>{platform.name}</CardTitle>
                 <CardDescription>{platform.layer}</CardDescription>
               </div>
             </div>
             <Badge variant={platform.enabled ? 'success' : 'secondary'}>
               {platform.enabled ? 'Active' : 'Inactive'}
             </Badge>
           </div>
         </CardHeader>
         <CardContent>
           {showMetrics && (
             <div className="grid grid-cols-3 gap-4 text-sm">
               <div>
                 <div className="text-muted-foreground">Surfaces</div>
                 <div className="text-2xl font-bold">{platform.surfaceCount}</div>
               </div>
               <div>
                 <div className="text-muted-foreground">Workflows</div>
                 <div className="text-2xl font-bold">{platform.workflowCount}</div>
               </div>
               <div>
                 <div className="text-muted-foreground">Agents</div>
                 <div className="text-2xl font-bold">{platform.agentCount}</div>
               </div>
             </div>
           )}
         </CardContent>
         <CardFooter className="gap-2">
           <Button variant="outline" size="sm" onClick={onEdit}>
             <Edit className="h-4 w-4 mr-1" /> Edit
           </Button>
           <Button variant="outline" size="sm" onClick={onClone}>
             <Copy className="h-4 w-4 mr-1" /> Clone
           </Button>
           <Button variant="destructive" size="sm" onClick={onDelete}>
             <Trash className="h-4 w-4 mr-1" /> Delete
           </Button>
         </CardFooter>
       </Card>
     )
   }
   ```

3. **Enhance PlatformDetailsPage (Already Exists)**
   ```typescript
   // File: packages/dashboard/src/pages/PlatformDetailsPage.tsx

   // Add tabs:
   <Tabs defaultValue="overview">
     <TabsList>
       <TabsTrigger value="overview">Overview</TabsTrigger>
       <TabsTrigger value="surfaces">Surfaces</TabsTrigger>
       <TabsTrigger value="workflows">Workflows</TabsTrigger>
       <TabsTrigger value="agents">Agents</TabsTrigger>
       <TabsTrigger value="settings">Settings</TabsTrigger>
     </TabsList>

     <TabsContent value="overview">
       <PlatformOverview platform={platform} />
     </TabsContent>

     <TabsContent value="surfaces">
       <SurfaceManagementPanel platform={platform} />
     </TabsContent>

     {/* Other tabs... */}
   </Tabs>
   ```

**Week 5: Surface Management**

**Tasks:**

1. **Create Surface Registry Page**
   ```typescript
   // File: packages/dashboard/src/pages/SurfaceRegistryPage.tsx

   export function SurfaceRegistryPage() {
     const [view, setView] = useState<'grid' | 'list' | 'dependency'>('grid')
     const [filters, setFilters] = useState({
       type: 'all',
       layer: 'all',
       platform: 'all'
     })

     return (
       <PageContainer
         title="Surface Registry"
         description="Manage and configure platform surfaces"
         actions={
           <>
             <Button onClick={() => navigate('/surfaces/new')}>
               <Plus className="mr-2 h-4 w-4" /> Create Surface
             </Button>
             <Button variant="outline">
               <Upload className="mr-2 h-4 w-4" /> Import
             </Button>
           </>
         }
       >
         <div className="space-y-6">
           {/* Filters */}
           <div className="flex gap-4">
             <Select value={filters.type} onValueChange={(v) => setFilters({...filters, type: v})}>
               <SelectTrigger className="w-48">
                 <SelectValue placeholder="Surface Type" />
               </SelectTrigger>
               <SelectContent>
                 <SelectItem value="all">All Types</SelectItem>
                 <SelectItem value="REST">REST API</SelectItem>
                 <SelectItem value="WEBHOOK">Webhook</SelectItem>
                 <SelectItem value="CLI">CLI</SelectItem>
                 <SelectItem value="DASHBOARD">Dashboard</SelectItem>
               </SelectContent>
             </Select>

             {/* Layer filter */}
             {/* Platform filter */}
           </div>

           {/* View toggle */}
           <div className="flex justify-end gap-2">
             <Button
               variant={view === 'grid' ? 'default' : 'outline'}
               size="sm"
               onClick={() => setView('grid')}
             >
               <Grid className="h-4 w-4" />
             </Button>
             <Button
               variant={view === 'list' ? 'default' : 'outline'}
               size="sm"
               onClick={() => setView('list')}
             >
               <List className="h-4 w-4" />
             </Button>
             <Button
               variant={view === 'dependency' ? 'default' : 'outline'}
               size="sm"
               onClick={() => setView('dependency')}
             >
               <Network className="h-4 w-4" />
             </Button>
           </div>

           {/* Surface grid/list */}
           {view === 'grid' && <SurfaceGrid surfaces={surfaces} />}
           {view === 'list' && <SurfaceList surfaces={surfaces} />}
           {view === 'dependency' && <SurfaceDependencyGraph surfaces={surfaces} />}
         </div>
       </PageContainer>
     )
   }
   ```

2. **Create Surface Designer**
   ```typescript
   // File: packages/dashboard/src/pages/SurfaceDesignerPage.tsx

   export function SurfaceDesignerPage() {
     const [surface, setSurface] = useState<SurfaceConfig>()
     const [selectedAgents, setSelectedAgents] = useState<string[]>([])

     return (
       <PageContainer
         title="Surface Designer"
         actions={
           <>
             <Button variant="outline" onClick={handlePreview}>
               <Eye className="mr-2 h-4 w-4" /> Preview
             </Button>
             <Button onClick={handleSave}>
               <Save className="mr-2 h-4 w-4" /> Save
             </Button>
           </>
         }
       >
         <div className="grid grid-cols-4 gap-6">
           {/* Left sidebar: Properties */}
           <Card className="col-span-1">
             <CardHeader>
               <CardTitle>Properties</CardTitle>
             </CardHeader>
             <CardContent className="space-y-4">
               <div>
                 <Label>Surface Name</Label>
                 <Input
                   value={surface?.name}
                   onChange={(e) => setSurface({...surface, name: e.target.value})}
                 />
               </div>

               <div>
                 <Label>Type</Label>
                 <Select value={surface?.type}>
                   <SelectTrigger>
                     <SelectValue />
                   </SelectTrigger>
                   <SelectContent>
                     <SelectItem value="REST">REST API</SelectItem>
                     <SelectItem value="WEBHOOK">Webhook</SelectItem>
                     <SelectItem value="CLI">CLI</SelectItem>
                   </SelectContent>
                 </Select>
               </div>

               {/* More fields... */}
             </CardContent>
           </Card>

           {/* Center: Visual Designer */}
           <Card className="col-span-2">
             <CardHeader>
               <CardTitle>Visual Designer</CardTitle>
             </CardHeader>
             <CardContent>
               <SurfaceCanvas surface={surface} />
             </CardContent>
           </Card>

           {/* Right sidebar: Agents & Config */}
           <div className="col-span-1 space-y-6">
             <Card>
               <CardHeader>
                 <CardTitle>Agents</CardTitle>
               </CardHeader>
               <CardContent>
                 <AgentSelector
                   selected={selectedAgents}
                   onChange={setSelectedAgents}
                 />
               </CardContent>
             </Card>

             <Card>
               <CardHeader>
                 <CardTitle>Patterns & Policies</CardTitle>
               </CardHeader>
               <CardContent>
                 <PolicyEditor surface={surface} />
               </CardContent>
             </Card>
           </div>
         </div>
       </PageContainer>
     )
   }
   ```

**Week 6-7: Agent Registry**

**Tasks:**

1. **Create Enhanced Agent Registry Page**
   ```typescript
   // File: packages/dashboard/src/pages/AgentRegistryPage.tsx

   export function AgentRegistryPage() {
     const { data: agents } = useQuery(['agents'], fetchAgents)
     const [filters, setFilters] = useState({
       type: 'all',
       status: 'all',
       platform: 'all'
     })

     return (
       <PageContainer
         title="Agent Registry"
         description="Manage and monitor platform agents"
         actions={
           <>
             <Button onClick={() => navigate('/agents/register')}>
               <Plus className="mr-2 h-4 w-4" /> Register Agent
             </Button>
             <Button variant="outline">
               <Upload className="mr-2 h-4 w-4" /> Import
             </Button>
           </>
         }
       >
         <div className="space-y-6">
           {/* Agent Stats */}
           <div className="grid grid-cols-4 gap-4">
             <MetricCard
               title="Total Agents"
               value={agents?.length}
               icon={Bot}
               trend={{ value: 12, direction: 'up' }}
             />
             <MetricCard
               title="Active"
               value={agents?.filter(a => a.status === 'active').length}
               icon={CheckCircle}
             />
             <MetricCard
               title="Avg Success Rate"
               value="94.5%"
               icon={TrendingUp}
               trend={{ value: 2.3, direction: 'up' }}
             />
             <MetricCard
               title="Platforms Covered"
               value={uniquePlatforms.length}
               icon={Layers}
             />
           </div>

           {/* Agent Table */}
           <Card>
             <CardHeader>
               <CardTitle>Registered Agents</CardTitle>
               <CardDescription>
                 {agents?.length} agents registered
               </CardDescription>
             </CardHeader>
             <CardContent>
               <DataTable
                 columns={agentColumns}
                 data={filteredAgents}
                 searchPlaceholder="Search agents..."
                 filters={[
                   { key: 'type', label: 'Type', options: agentTypes },
                   { key: 'status', label: 'Status', options: statuses },
                   { key: 'platform', label: 'Platform', options: platforms }
                 ]}
               />
             </CardContent>
           </Card>

           {/* Agent Performance Chart */}
           <Card>
             <CardHeader>
               <CardTitle>Agent Performance</CardTitle>
             </CardHeader>
             <CardContent>
               <AgentPerformanceChart agents={agents} />
             </CardContent>
           </Card>
         </div>
       </PageContainer>
     )
   }
   ```

2. **Create Agent Configuration Panel**
   ```typescript
   // File: packages/dashboard/src/components/agents/AgentConfigPanel.tsx

   export function AgentConfigPanel({ agent }: { agent: Agent }) {
     const [config, setConfig] = useState(agent.config)

     return (
       <Card>
         <CardHeader>
           <CardTitle>{agent.name} Configuration</CardTitle>
         </CardHeader>
         <CardContent className="space-y-6">
           <div>
             <Label>Timeout (ms)</Label>
             <Input
               type="number"
               value={config.timeout_ms}
               onChange={(e) => setConfig({...config, timeout_ms: parseInt(e.target.value)})}
             />
           </div>

           <div>
             <Label>Max Retries</Label>
             <Input
               type="number"
               value={config.max_retries}
               onChange={(e) => setConfig({...config, max_retries: parseInt(e.target.value)})}
             />
           </div>

           <div>
             <Label>Platform Scope</Label>
             <MultiSelect
               options={platforms}
               selected={config.platforms}
               onChange={(platforms) => setConfig({...config, platforms})}
             />
           </div>

           <div>
             <Label>Capabilities</Label>
             <div className="space-y-2">
               {config.capabilities.map(cap => (
                 <Badge key={cap}>{cap}</Badge>
               ))}
             </div>
             <Button variant="outline" size="sm" onClick={handleAddCapability}>
               <Plus className="h-3 w-3 mr-1" /> Add Capability
             </Button>
           </div>

           <div>
             <Label>Custom Config (JSON)</Label>
             <CodeEditor
               language="json"
               value={JSON.stringify(config.custom, null, 2)}
               onChange={(value) => setConfig({...config, custom: JSON.parse(value)})}
             />
           </div>
         </CardContent>
         <CardFooter>
           <Button onClick={handleSave}>Save Configuration</Button>
         </CardFooter>
       </Card>
     )
   }
   ```

**Deliverables:**
- ✅ Enhanced platform list with grid/list views
- ✅ Platform card with metrics
- ✅ Surface registry with 3 view modes
- ✅ Surface designer (visual builder)
- ✅ Agent registry with performance metrics
- ✅ Agent configuration panel

---

## Phase 3: Workflow System (Weeks 8-11)

### Goals
- Build comprehensive workflow execution UI
- Implement real-time workflow monitoring
- Create workflow template system

### 3.1 Workflow Pages

**Week 8: Active Workflows View**

**Tasks:**

1. **Enhance WorkflowsPage (Already Exists)**
   ```typescript
   // File: packages/dashboard/src/pages/WorkflowsPage.tsx

   export function WorkflowsPage() {
     const { data: workflows } = useQuery(['workflows', 'active'], fetchActiveWorkflows)
     const [filter, setFilter] = useState({ status: 'all', platform: 'all' })

     return (
       <PageContainer
         title="Workflows"
         description="Manage and monitor workflow executions"
         actions={
           <>
             <Button onClick={() => navigate('/workflows/new')}>
               <Plus className="mr-2 h-4 w-4" /> New Workflow
             </Button>
             <Button variant="outline" onClick={() => navigate('/workflows/templates')}>
               <FileTemplate className="mr-2 h-4 w-4" /> Templates
             </Button>
           </>
         }
       >
         <Tabs defaultValue="running">
           <TabsList>
             <TabsTrigger value="running">
               Running ({runningCount})
             </TabsTrigger>
             <TabsTrigger value="queued">
               Queued ({queuedCount})
             </TabsTrigger>
             <TabsTrigger value="completed">
               Completed ({completedCount})
             </TabsTrigger>
             <TabsTrigger value="failed">
               Failed ({failedCount})
             </TabsTrigger>
           </TabsList>

           <TabsContent value="running">
             <div className="space-y-4">
               {runningWorkflows.map(workflow => (
                 <WorkflowCard
                   key={workflow.id}
                   workflow={workflow}
                   variant="running"
                 />
               ))}
             </div>
           </TabsContent>

           {/* Other tabs... */}
         </Tabs>
       </PageContainer>
     )
   }
   ```

2. **Create WorkflowCard Component**
   ```typescript
   // File: packages/dashboard/src/components/workflows/WorkflowCard.tsx

   export function WorkflowCard({
     workflow,
     variant
   }: {
     workflow: Workflow
     variant: 'running' | 'queued' | 'completed' | 'failed'
   }) {
     return (
       <Card>
         <CardHeader>
           <div className="flex items-center justify-between">
             <div>
               <CardTitle className="flex items-center gap-2">
                 #{workflow.id} {workflow.name}
                 {variant === 'running' && (
                   <Badge variant="default" className="animate-pulse">
                     <Zap className="h-3 w-3 mr-1" /> Running
                   </Badge>
                 )}
               </CardTitle>
               <CardDescription>
                 Platform: {workflow.platform} • Started: {formatRelative(workflow.started_at)}
               </CardDescription>
             </div>
             <WorkflowActions workflow={workflow} />
           </div>
         </CardHeader>

         <CardContent>
           {variant === 'running' && (
             <>
               <Progress value={workflow.progress} className="mb-4" />
               <div className="flex items-center justify-between text-sm text-muted-foreground">
                 <span>Current: {workflow.current_stage}</span>
                 <span>Time: {formatDuration(workflow.duration)} • ETA: {formatDuration(workflow.eta)}</span>
               </div>
             </>
           )}

           {variant === 'completed' && (
             <div className="flex items-center gap-4 text-sm">
               <Badge variant="success">
                 <CheckCircle className="h-3 w-3 mr-1" /> Complete
               </Badge>
               <span className="text-muted-foreground">
                 Duration: {formatDuration(workflow.duration)}
               </span>
             </div>
           )}

           {variant === 'failed' && (
             <div className="space-y-2">
               <Badge variant="destructive">
                 <XCircle className="h-3 w-3 mr-1" /> Failed
               </Badge>
               <Alert variant="destructive">
                 <AlertCircle className="h-4 w-4" />
                 <AlertTitle>Error at {workflow.failed_stage}</AlertTitle>
                 <AlertDescription>{workflow.error_message}</AlertDescription>
               </Alert>
             </div>
           )}
         </CardContent>

         <CardFooter className="gap-2">
           <Button
             variant="outline"
             size="sm"
             onClick={() => navigate(`/workflows/${workflow.id}`)}
           >
             <Eye className="h-4 w-4 mr-1" /> View Details
           </Button>

           {variant === 'running' && (
             <>
               <Button variant="outline" size="sm" onClick={() => pauseWorkflow(workflow.id)}>
                 <Pause className="h-4 w-4 mr-1" /> Pause
               </Button>
               <Button variant="destructive" size="sm" onClick={() => cancelWorkflow(workflow.id)}>
                 <X className="h-4 w-4 mr-1" /> Cancel
               </Button>
             </>
           )}

           {variant === 'failed' && (
             <Button variant="outline" size="sm" onClick={() => retryWorkflow(workflow.id)}>
               <RotateCcw className="h-4 w-4 mr-1" /> Retry
             </Button>
           )}
         </CardFooter>
       </Card>
     )
   }
   ```

**Week 9-10: Workflow Detail View**

**Tasks:**

1. **Create Enhanced WorkflowPage (Already Exists)**
   ```typescript
   // File: packages/dashboard/src/pages/WorkflowPage.tsx

   export function WorkflowPage() {
     const { id } = useParams()
     const { data: workflow } = useQuery(['workflow', id], () => fetchWorkflow(id))

     // Real-time updates via WebSocket
     useWorkflowUpdates(id, (update) => {
       queryClient.setQueryData(['workflow', id], update)
     })

     return (
       <PageContainer
         title={`Workflow #${workflow.id}`}
         breadcrumbs={[
           { label: 'Workflows', href: '/workflows' },
           { label: `#${workflow.id}` }
         ]}
         actions={
           <WorkflowActions workflow={workflow} />
         }
       >
         <div className="space-y-6">
           {/* Workflow Header */}
           <Card>
             <CardHeader>
               <div className="flex items-center justify-between">
                 <div>
                   <CardTitle>{workflow.name}</CardTitle>
                   <CardDescription>
                     Platform: {workflow.platform} • Created: {formatDate(workflow.created_at)}
                   </CardDescription>
                 </div>
                 <WorkflowStatusBadge status={workflow.status} />
               </div>
             </CardHeader>
             <CardContent>
               <div className="grid grid-cols-4 gap-6">
                 <div>
                   <div className="text-sm text-muted-foreground">Duration</div>
                   <div className="text-2xl font-bold">{formatDuration(workflow.duration)}</div>
                 </div>
                 <div>
                   <div className="text-sm text-muted-foreground">Progress</div>
                   <div className="text-2xl font-bold">{workflow.progress}%</div>
                 </div>
                 <div>
                   <div className="text-sm text-muted-foreground">Current Stage</div>
                   <div className="text-2xl font-bold">{workflow.current_stage}</div>
                 </div>
                 <div>
                   <div className="text-sm text-muted-foreground">ETA</div>
                   <div className="text-2xl font-bold">{formatDuration(workflow.eta)}</div>
                 </div>
               </div>
             </CardContent>
           </Card>

           {/* Progress Timeline */}
           <Card>
             <CardHeader>
               <CardTitle>Progress Timeline</CardTitle>
             </CardHeader>
             <CardContent>
               <WorkflowTimeline workflow={workflow} />
             </CardContent>
           </Card>

           {/* Current Stage Details */}
           <Card>
             <CardHeader>
               <CardTitle>Current Stage: {workflow.current_stage}</CardTitle>
             </CardHeader>
             <CardContent>
               <StageDetails stage={workflow.stages[workflow.current_stage]} />
             </CardContent>
           </Card>

           {/* Stage History */}
           <div className="grid grid-cols-2 gap-6">
             <Card>
               <CardHeader>
                 <CardTitle>Stage History</CardTitle>
               </CardHeader>
               <CardContent>
                 <StageHistoryList stages={workflow.completed_stages} />
               </CardContent>
             </Card>

             <Card>
               <CardHeader>
                 <CardTitle>Actions</CardTitle>
               </CardHeader>
               <CardContent className="space-y-2">
                 <Button variant="outline" className="w-full" onClick={handleViewLogs}>
                   <FileText className="mr-2 h-4 w-4" /> View Logs
                 </Button>
                 <Button variant="outline" className="w-full" onClick={handleDownloadArtifacts}>
                   <Download className="mr-2 h-4 w-4" /> Download Artifacts
                 </Button>
                 <Button variant="outline" className="w-full" onClick={handleRetryStage}>
                   <RotateCcw className="mr-2 h-4 w-4" /> Retry Stage
                 </Button>
                 <Button variant="destructive" className="w-full" onClick={handleCancelWorkflow}>
                   <X className="mr-2 h-4 w-4" /> Cancel Workflow
                 </Button>
               </CardContent>
             </Card>
           </div>
         </div>
       </PageContainer>
     )
   }
   ```

2. **Create WorkflowTimeline Component**
   ```typescript
   // File: packages/dashboard/src/components/workflows/WorkflowTimeline.tsx

   export function WorkflowTimeline({ workflow }: { workflow: Workflow }) {
     const stages = workflow.definition.stages

     return (
       <div className="relative">
         {/* Progress bar */}
         <div className="absolute top-6 left-0 right-0 h-1 bg-muted">
           <div
             className="h-full bg-primary transition-all duration-500"
             style={{ width: `${workflow.progress}%` }}
           />
         </div>

         {/* Stage nodes */}
         <div className="relative flex justify-between">
           {stages.map((stage, index) => {
             const status = getStageStatus(workflow, stage.name)

             return (
               <div key={stage.name} className="flex flex-col items-center gap-2">
                 <div
                   className={cn(
                     'w-12 h-12 rounded-full border-4 bg-background flex items-center justify-center transition-all',
                     status === 'completed' && 'border-green-500 bg-green-50',
                     status === 'running' && 'border-blue-500 bg-blue-50 animate-pulse',
                     status === 'pending' && 'border-muted',
                     status === 'failed' && 'border-red-500 bg-red-50'
                   )}
                 >
                   {status === 'completed' && <CheckCircle className="h-6 w-6 text-green-500" />}
                   {status === 'running' && <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />}
                   {status === 'pending' && <Circle className="h-6 w-6 text-muted-foreground" />}
                   {status === 'failed' && <XCircle className="h-6 w-6 text-red-500" />}
                 </div>

                 <div className="text-center">
                   <div className="font-medium text-sm">{stage.name}</div>
                   {status === 'completed' && (
                     <div className="text-xs text-muted-foreground">
                       {formatDuration(workflow.stage_durations[stage.name])}
                     </div>
                   )}
                 </div>
               </div>
             )
           })}
         </div>
       </div>
     )
   }
   ```

**Week 11: Workflow Templates**

**Tasks:**

1. **Create Workflow Templates Page**
   ```typescript
   // File: packages/dashboard/src/pages/WorkflowTemplatesPage.tsx

   export function WorkflowTemplatesPage() {
     const { data: templates } = useQuery(['workflow-templates'], fetchTemplates)

     return (
       <PageContainer
         title="Workflow Templates"
         description="Pre-configured workflow templates for common use cases"
         actions={
           <Button onClick={() => navigate('/workflows/templates/new')}>
             <Plus className="mr-2 h-4 w-4" /> Create Template
           </Button>
         }
       >
         <div className="grid grid-cols-3 gap-6">
           {templates.map(template => (
             <TemplateCard
               key={template.id}
               template={template}
               onUse={() => createWorkflowFromTemplate(template)}
               onEdit={() => navigate(`/workflows/templates/${template.id}/edit`)}
             />
           ))}
         </div>
       </PageContainer>
     )
   }
   ```

2. **Create Template Card**
   ```typescript
   // File: packages/dashboard/src/components/workflows/TemplateCard.tsx

   export function TemplateCard({ template, onUse, onEdit }: TemplateCardProps) {
     return (
       <Card className="hover:shadow-lg transition-all">
         <CardHeader>
           <div className="flex items-start justify-between">
             <div>
               <CardTitle>{template.name}</CardTitle>
               <CardDescription>{template.description}</CardDescription>
             </div>
             <Badge>{template.category}</Badge>
           </div>
         </CardHeader>
         <CardContent>
           <div className="space-y-4">
             <div className="flex items-center gap-2 text-sm text-muted-foreground">
               <Layers className="h-4 w-4" />
               <span>{template.stages.length} stages</span>
             </div>
             <div className="flex items-center gap-2 text-sm text-muted-foreground">
               <Clock className="h-4 w-4" />
               <span>~{formatDuration(template.estimated_duration)}</span>
             </div>
             <div className="flex items-center gap-2 text-sm text-muted-foreground">
               <TrendingUp className="h-4 w-4" />
               <span>{template.usage_count} uses</span>
             </div>
           </div>
         </CardContent>
         <CardFooter className="gap-2">
           <Button onClick={onUse} className="flex-1">
             <Play className="h-4 w-4 mr-1" /> Use Template
           </Button>
           <Button variant="outline" onClick={onEdit}>
             <Edit className="h-4 w-4" />
           </Button>
         </CardFooter>
       </Card>
     )
   }
   ```

**Deliverables:**
- ✅ Active workflows view with filtering
- ✅ Workflow cards with real-time updates
- ✅ Detailed workflow page with timeline
- ✅ Stage history and execution details
- ✅ Workflow template library
- ✅ Template creation and editing

---

## Phase 4: Analytics & Monitoring (Weeks 12-14)

### Goals
- Build analytics dashboards
- Implement real-time monitoring
- Create reporting system

### 4.1 Analytics Pages

**Week 12: Platform Analytics**

**Tasks:**

1. **Create Analytics Dashboard**
   ```typescript
   // File: packages/dashboard/src/pages/AnalyticsDashboardPage.tsx

   export function AnalyticsDashboardPage() {
     const [timeRange, setTimeRange] = useState<TimeRange>('7d')
     const { data: metrics } = useQuery(
       ['analytics', timeRange],
       () => fetchAnalytics(timeRange)
     )

     return (
       <PageContainer
         title="Analytics"
         description="Platform performance and insights"
         actions={
           <>
             <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
             <Button variant="outline">
               <Download className="mr-2 h-4 w-4" /> Export
             </Button>
             <Button variant="outline">
               <Calendar className="mr-2 h-4 w-4" /> Schedule Report
             </Button>
           </>
         }
       >
         <div className="space-y-6">
           {/* Key Metrics */}
           <div className="grid grid-cols-4 gap-6">
             <MetricCard
               title="Total Workflows"
               value={metrics.workflow_count}
               icon={GitBranch}
               trend={metrics.workflow_trend}
               description="Executed in selected period"
             />
             <MetricCard
               title="Success Rate"
               value={`${metrics.success_rate}%`}
               icon={CheckCircle}
               trend={metrics.success_rate_trend}
               description="Workflows completed successfully"
             />
             <MetricCard
               title="Avg Duration"
               value={formatDuration(metrics.avg_duration)}
               icon={Clock}
               trend={metrics.duration_trend}
               description="Average workflow execution time"
             />
             <MetricCard
               title="Code Generated"
               value={formatNumber(metrics.lines_of_code)}
               icon={Code}
               trend={metrics.loc_trend}
               description="Total lines of code"
             />
           </div>

           {/* Workflow Trend Chart */}
           <Card>
             <CardHeader>
               <CardTitle>Workflow Execution Trend</CardTitle>
               <CardDescription>Daily workflow executions over time</CardDescription>
             </CardHeader>
             <CardContent>
               <WorkflowTrendChart data={metrics.daily_workflows} />
             </CardContent>
           </Card>

           {/* Platform Utilization & Surface Performance */}
           <div className="grid grid-cols-2 gap-6">
             <Card>
               <CardHeader>
                 <CardTitle>Platform Utilization</CardTitle>
                 <CardDescription>Workflow distribution across platforms</CardDescription>
               </CardHeader>
               <CardContent>
                 <PlatformUtilizationHeatmap data={metrics.platform_usage} />
               </CardContent>
             </Card>

             <Card>
               <CardHeader>
                 <CardTitle>Surface Performance</CardTitle>
                 <CardDescription>Metrics by surface type</CardDescription>
               </CardHeader>
               <CardContent>
                 <SurfacePerformanceTable data={metrics.surface_metrics} />
               </CardContent>
             </Card>
           </div>

           {/* Agent Performance */}
           <Card>
             <CardHeader>
               <CardTitle>Agent Performance</CardTitle>
               <CardDescription>Execution times and success rates by agent</CardDescription>
             </CardHeader>
             <CardContent>
               <AgentPerformanceChart data={metrics.agent_metrics} />
             </CardContent>
           </Card>
         </div>
       </PageContainer>
     )
   }
   ```

**Week 13: Real-Time Monitoring**

**Tasks:**

1. **Enhance MonitoringDashboardPage (Already Exists)**
   ```typescript
   // File: packages/dashboard/src/pages/MonitoringDashboardPage.tsx

   export function MonitoringDashboardPage() {
     // WebSocket connection for real-time updates
     const { status, metrics } = useRealtimeMonitoring()

     return (
       <PageContainer
         title="System Monitoring"
         description="Real-time platform health and performance"
       >
         <div className="space-y-6">
           {/* System Status Banner */}
           <SystemStatusBanner status={status} />

           {/* Real-time Metrics */}
           <div className="grid grid-cols-4 gap-6">
             <RealtimeMetricCard
               title="Active Workflows"
               value={metrics.active_workflows}
               icon={Activity}
               updateFrequency={1000} // Update every second
             />
             <RealtimeMetricCard
               title="Queue Depth"
               value={metrics.queue_depth}
               icon={Inbox}
               alert={metrics.queue_depth > 10 ? 'warning' : undefined}
             />
             <RealtimeMetricCard
               title="Agent Utilization"
               value={`${metrics.agent_utilization}%`}
               icon={Cpu}
             />
             <RealtimeMetricCard
               title="Error Rate"
               value={`${metrics.error_rate}%`}
               icon={AlertTriangle}
               alert={metrics.error_rate > 5 ? 'error' : undefined}
             />
           </div>

           {/* Agent Health Matrix */}
           <Card>
             <CardHeader>
               <CardTitle>Agent Health Matrix</CardTitle>
             </CardHeader>
             <CardContent>
               <AgentHealthMatrix agents={metrics.agents} />
             </CardContent>
           </Card>

           {/* Live Activity Feed */}
           <Card>
             <CardHeader>
               <CardTitle>Live Activity</CardTitle>
               <CardDescription>Real-time system events</CardDescription>
             </CardHeader>
             <CardContent>
               <ActivityFeed
                 events={metrics.recent_events}
                 maxItems={50}
                 autoScroll
               />
             </CardContent>
           </Card>

           {/* Performance Metrics */}
           <div className="grid grid-cols-2 gap-6">
             <Card>
               <CardHeader>
                 <CardTitle>Response Times</CardTitle>
               </CardHeader>
               <CardContent>
                 <ResponseTimeChart data={metrics.response_times} />
               </CardContent>
             </Card>

             <Card>
               <CardHeader>
                 <CardTitle>Throughput</CardTitle>
               </CardHeader>
               <CardContent>
                 <ThroughputChart data={metrics.throughput} />
               </CardContent>
             </Card>
           </div>
         </div>
       </PageContainer>
     )
   }
   ```

2. **Create Real-time Monitoring Hook**
   ```typescript
   // File: packages/dashboard/src/hooks/useRealtimeMonitoring.ts

   export function useRealtimeMonitoring() {
     const [metrics, setMetrics] = useState<MonitoringMetrics>()
     const [status, setStatus] = useState<SystemStatus>('healthy')

     useEffect(() => {
       // WebSocket connection
       const ws = new WebSocket(WS_URL)

       ws.onmessage = (event) => {
         const update = JSON.parse(event.data)

         switch (update.type) {
           case 'metrics':
             setMetrics(update.data)
             break
           case 'status':
             setStatus(update.data)
             break
           case 'alert':
             toast({
               title: update.data.title,
               description: update.data.message,
               variant: update.data.severity
             })
             break
         }
       }

       return () => ws.close()
     }, [])

     return { metrics, status }
   }
   ```

**Week 14: Reporting System**

**Tasks:**

1. **Create Report Builder**
   ```typescript
   // File: packages/dashboard/src/pages/ReportBuilderPage.tsx

   export function ReportBuilderPage() {
     const [config, setConfig] = useState<ReportConfig>({
       name: '',
       type: 'workflow_summary',
       timeRange: '7d',
       metrics: [],
       groupBy: [],
       filters: []
     })

     return (
       <PageContainer
         title="Report Builder"
         description="Create custom reports and dashboards"
       >
         <div className="grid grid-cols-3 gap-6">
           {/* Left: Configuration */}
           <Card className="col-span-1">
             <CardHeader>
               <CardTitle>Report Configuration</CardTitle>
             </CardHeader>
             <CardContent className="space-y-4">
               <div>
                 <Label>Report Name</Label>
                 <Input
                   value={config.name}
                   onChange={(e) => setConfig({...config, name: e.target.value})}
                 />
               </div>

               <div>
                 <Label>Report Type</Label>
                 <Select value={config.type}>
                   <SelectTrigger>
                     <SelectValue />
                   </SelectTrigger>
                   <SelectContent>
                     <SelectItem value="workflow_summary">Workflow Summary</SelectItem>
                     <SelectItem value="platform_analytics">Platform Analytics</SelectItem>
                     <SelectItem value="agent_performance">Agent Performance</SelectItem>
                     <SelectItem value="custom">Custom</SelectItem>
                   </SelectContent>
                 </Select>
               </div>

               <div>
                 <Label>Time Range</Label>
                 <TimeRangeSelector
                   value={config.timeRange}
                   onChange={(range) => setConfig({...config, timeRange: range})}
                 />
               </div>

               <div>
                 <Label>Metrics</Label>
                 <MetricSelector
                   selected={config.metrics}
                   onChange={(metrics) => setConfig({...config, metrics})}
                 />
               </div>
             </CardContent>
           </Card>

           {/* Center & Right: Preview */}
           <Card className="col-span-2">
             <CardHeader>
               <CardTitle>Report Preview</CardTitle>
               <CardDescription>Live preview of your report</CardDescription>
             </CardHeader>
             <CardContent>
               <ReportPreview config={config} />
             </CardContent>
             <CardFooter className="gap-2">
               <Button onClick={handleSaveReport}>
                 <Save className="mr-2 h-4 w-4" /> Save Report
               </Button>
               <Button variant="outline" onClick={handleScheduleReport}>
                 <Calendar className="mr-2 h-4 w-4" /> Schedule
               </Button>
               <Button variant="outline" onClick={handleExportReport}>
                 <Download className="mr-2 h-4 w-4" /> Export
               </Button>
             </CardFooter>
           </Card>
         </div>
       </PageContainer>
     )
   }
   ```

**Deliverables:**
- ✅ Analytics dashboard with key metrics
- ✅ Real-time monitoring with WebSocket
- ✅ Agent health matrix
- ✅ Performance charts and heatmaps
- ✅ Report builder and scheduler
- ✅ Export functionality (CSV, PDF)

---

## Phase 5: Polish & UX (Weeks 15-17)

### Goals
- Implement global search
- Build notification system
- Add help and documentation
- Enhance accessibility

### 5.1 Search & Navigation

**Week 15: Global Search**

**Tasks:**

1. **Enhance Command Palette**
   ```typescript
   // File: packages/dashboard/src/components/navigation/CommandPalette.tsx

   export function CommandPalette() {
     const [open, setOpen] = useState(false)
     const [search, setSearch] = useState('')
     const { data: results } = useQuery(
       ['search', search],
       () => globalSearch(search),
       { enabled: search.length > 2 }
     )

     useEffect(() => {
       const down = (e: KeyboardEvent) => {
         if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
           e.preventDefault()
           setOpen((open) => !open)
         }
       }
       document.addEventListener('keydown', down)
       return () => document.removeEventListener('keydown', down)
     }, [])

     return (
       <CommandDialog open={open} onOpenChange={setOpen}>
         <CommandInput
           placeholder="Search platforms, workflows, agents..."
           value={search}
           onValueChange={setSearch}
         />
         <CommandList>
           <CommandEmpty>No results found.</CommandEmpty>

           {results?.platforms && (
             <CommandGroup heading="Platforms">
               {results.platforms.map(platform => (
                 <CommandItem
                   key={platform.id}
                   onSelect={() => {
                     navigate(`/platforms/${platform.id}`)
                     setOpen(false)
                   }}
                 >
                   <Layers className="mr-2 h-4 w-4" />
                   <span>{platform.name}</span>
                   <Badge variant="secondary" className="ml-auto">
                     {platform.layer}
                   </Badge>
                 </CommandItem>
               ))}
             </CommandGroup>
           )}

           {results?.workflows && (
             <CommandGroup heading="Workflows">
               {results.workflows.map(workflow => (
                 <CommandItem
                   key={workflow.id}
                   onSelect={() => {
                     navigate(`/workflows/${workflow.id}`)
                     setOpen(false)
                   }}
                 >
                   <GitBranch className="mr-2 h-4 w-4" />
                   <span>#{workflow.id} {workflow.name}</span>
                   <WorkflowStatusBadge status={workflow.status} className="ml-auto" />
                 </CommandItem>
               ))}
             </CommandGroup>
           )}

           {results?.agents && (
             <CommandGroup heading="Agents">
               {results.agents.map(agent => (
                 <CommandItem
                   key={agent.id}
                   onSelect={() => {
                     navigate(`/agents/${agent.id}`)
                     setOpen(false)
                   }}
                 >
                   <Bot className="mr-2 h-4 w-4" />
                   <span>{agent.name}</span>
                   <span className="ml-auto text-xs text-muted-foreground">
                     v{agent.version}
                   </span>
                 </CommandItem>
               ))}
             </CommandGroup>
           )}

           <CommandSeparator />

           <CommandGroup heading="Actions">
             <CommandItem onSelect={() => navigate('/platforms/new')}>
               <Plus className="mr-2 h-4 w-4" />
               Create Platform
             </CommandItem>
             <CommandItem onSelect={() => navigate('/workflows/new')}>
               <Plus className="mr-2 h-4 w-4" />
               New Workflow
             </CommandItem>
             <CommandItem onSelect={() => navigate('/settings')}>
               <Settings className="mr-2 h-4 w-4" />
               Settings
             </CommandItem>
           </CommandGroup>
         </CommandList>
       </CommandDialog>
     )
   }
   ```

2. **Add Recent Items**
   ```typescript
   // File: packages/dashboard/src/hooks/useRecentItems.ts

   export function useRecentItems() {
     const [recent, setRecent] = useState<RecentItem[]>(() => {
       const stored = localStorage.getItem('recent_items')
       return stored ? JSON.parse(stored) : []
     })

     const addRecentItem = useCallback((item: RecentItem) => {
       setRecent(prev => {
         const filtered = prev.filter(i => i.id !== item.id)
         const updated = [item, ...filtered].slice(0, 10)
         localStorage.setItem('recent_items', JSON.stringify(updated))
         return updated
       })
     }, [])

     return { recent, addRecentItem }
   }
   ```

**Week 16: Notification System**

**Tasks:**

1. **Create Notification Center**
   ```typescript
   // File: packages/dashboard/src/components/notifications/NotificationCenter.tsx

   export function NotificationCenter() {
     const { notifications, markAsRead, clearAll } = useNotifications()
     const [open, setOpen] = useState(false)
     const unreadCount = notifications.filter(n => !n.read).length

     return (
       <Popover open={open} onOpenChange={setOpen}>
         <PopoverTrigger asChild>
           <Button variant="ghost" size="icon" className="relative">
             <Bell className="h-5 w-5" />
             {unreadCount > 0 && (
               <Badge
                 variant="destructive"
                 className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
               >
                 {unreadCount}
               </Badge>
             )}
           </Button>
         </PopoverTrigger>
         <PopoverContent className="w-80" align="end">
           <div className="space-y-4">
             <div className="flex items-center justify-between">
               <h4 className="font-semibold">Notifications</h4>
               {notifications.length > 0 && (
                 <Button variant="ghost" size="sm" onClick={clearAll}>
                   Clear all
                 </Button>
               )}
             </div>

             <ScrollArea className="h-[400px]">
               <div className="space-y-2">
                 {notifications.map(notification => (
                   <NotificationItem
                     key={notification.id}
                     notification={notification}
                     onRead={() => markAsRead(notification.id)}
                   />
                 ))}
               </div>
             </ScrollArea>

             {notifications.length === 0 && (
               <div className="text-center py-8 text-muted-foreground">
                 <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                 <p>No notifications</p>
               </div>
             )}
           </div>
         </PopoverContent>
       </Popover>
     )
   }
   ```

2. **Create Toast System**
   ```typescript
   // File: packages/dashboard/src/hooks/useToast.ts

   export function useToast() {
     const { toast } = useToastPrimitive()

     return {
       success: (message: string, description?: string) => {
         toast({
           title: message,
           description,
           variant: 'default',
           duration: 3000
         })
       },
       error: (message: string, description?: string) => {
         toast({
           title: message,
           description,
           variant: 'destructive',
           duration: 5000
         })
       },
       warning: (message: string, description?: string) => {
         toast({
           title: message,
           description,
           className: 'border-orange-500',
           duration: 4000
         })
       },
       info: (message: string, description?: string) => {
         toast({
           title: message,
           description,
           variant: 'default',
           duration: 3000
         })
       }
     }
   }
   ```

**Week 17: Help System**

**Tasks:**

1. **Create Help Panel**
   ```typescript
   // File: packages/dashboard/src/components/help/HelpPanel.tsx

   export function HelpPanel() {
     const [open, setOpen] = useState(false)
     const { pathname } = useLocation()
     const contextualHelp = getContextualHelp(pathname)

     return (
       <Sheet open={open} onOpenChange={setOpen}>
         <SheetTrigger asChild>
           <Button variant="ghost" size="icon">
             <HelpCircle className="h-5 w-5" />
           </Button>
         </SheetTrigger>
         <SheetContent className="w-96">
           <SheetHeader>
             <SheetTitle>Help & Documentation</SheetTitle>
           </SheetHeader>

           <Tabs defaultValue="contextual">
             <TabsList className="w-full">
               <TabsTrigger value="contextual" className="flex-1">
                 This Page
               </TabsTrigger>
               <TabsTrigger value="docs" className="flex-1">
                 Docs
               </TabsTrigger>
               <TabsTrigger value="shortcuts" className="flex-1">
                 Shortcuts
               </TabsTrigger>
             </TabsList>

             <TabsContent value="contextual" className="space-y-4">
               <div>
                 <h3 className="font-semibold mb-2">{contextualHelp.title}</h3>
                 <p className="text-sm text-muted-foreground">
                   {contextualHelp.description}
                 </p>
               </div>

               <div>
                 <h4 className="font-medium mb-2">Quick Actions</h4>
                 <div className="space-y-2">
                   {contextualHelp.actions.map(action => (
                     <Button
                       key={action.label}
                       variant="outline"
                       className="w-full justify-start"
                       onClick={action.onClick}
                     >
                       {action.icon}
                       <span className="ml-2">{action.label}</span>
                     </Button>
                   ))}
                 </div>
               </div>

               <div>
                 <h4 className="font-medium mb-2">Related Guides</h4>
                 <div className="space-y-1">
                   {contextualHelp.guides.map(guide => (
                     <a
                       key={guide.title}
                       href={guide.url}
                       className="block text-sm text-blue-600 hover:underline"
                       target="_blank"
                       rel="noopener noreferrer"
                     >
                       {guide.title} →
                     </a>
                   ))}
                 </div>
               </div>
             </TabsContent>

             <TabsContent value="docs">
               <DocumentationViewer />
             </TabsContent>

             <TabsContent value="shortcuts">
               <KeyboardShortcuts />
             </TabsContent>
           </Tabs>
         </SheetContent>
       </Sheet>
     )
   }
   ```

2. **Create Onboarding Tour**
   ```typescript
   // File: packages/dashboard/src/components/help/OnboardingTour.tsx

   export function OnboardingTour() {
     const { isFirstVisit } = useUser()
     const [currentStep, setCurrentStep] = useState(0)
     const [open, setOpen] = useState(isFirstVisit)

     const steps = [
       {
         target: '[data-tour="sidebar"]',
         title: 'Welcome to Zyp Platform!',
         content: 'Navigate between different sections using the sidebar.'
       },
       {
         target: '[data-tour="command-palette"]',
         title: 'Quick Navigation',
         content: 'Press Cmd+K to open the command palette for fast navigation.'
       },
       {
         target: '[data-tour="create-platform"]',
         title: 'Create Your First Platform',
         content: 'Start by creating a platform to organize your workflows.'
       }
     ]

     return (
       <Tour
         steps={steps}
         currentStep={currentStep}
         onNext={() => setCurrentStep(prev => prev + 1)}
         onPrev={() => setCurrentStep(prev => prev - 1)}
         onComplete={() => {
           setOpen(false)
           markOnboardingComplete()
         }}
       />
     )
   }
   ```

**Deliverables:**
- ✅ Enhanced command palette with fuzzy search
- ✅ Recent items tracking
- ✅ Notification center with badges
- ✅ Toast notification system
- ✅ Contextual help panel
- ✅ Documentation viewer
- ✅ Keyboard shortcuts guide
- ✅ Onboarding tour

---

## Phase 6: Testing & Launch (Weeks 18-20)

### Goals
- Comprehensive testing
- Performance optimization
- Production deployment

### 6.1 Testing

**Week 18: Unit & Integration Tests**

**Tasks:**

1. **Component Tests**
   ```typescript
   // File: packages/dashboard/src/components/__tests__/PlatformCard.test.tsx

   describe('PlatformCard', () => {
     it('renders platform information correctly', () => {
       const platform = mockPlatform()
       render(<PlatformCard platform={platform} />)

       expect(screen.getByText(platform.name)).toBeInTheDocument()
       expect(screen.getByText(platform.layer)).toBeInTheDocument()
     })

     it('shows metrics when showMetrics is true', () => {
       const platform = mockPlatform()
       render(<PlatformCard platform={platform} showMetrics />)

       expect(screen.getByText(/Surfaces/i)).toBeInTheDocument()
       expect(screen.getByText(/Workflows/i)).toBeInTheDocument()
     })

     it('calls onEdit when edit button is clicked', () => {
       const onEdit = jest.fn()
       const platform = mockPlatform()
       render(<PlatformCard platform={platform} onEdit={onEdit} />)

       fireEvent.click(screen.getByText(/Edit/i))
       expect(onEdit).toHaveBeenCalled()
     })
   })
   ```

2. **Hook Tests**
   ```typescript
   // File: packages/dashboard/src/hooks/__tests__/useRealtimeMonitoring.test.ts

   describe('useRealtimeMonitoring', () => {
     it('establishes WebSocket connection', () => {
       const { result } = renderHook(() => useRealtimeMonitoring())

       expect(WebSocket).toHaveBeenCalledWith(expect.any(String))
     })

     it('updates metrics on message', async () => {
       const { result } = renderHook(() => useRealtimeMonitoring())

       act(() => {
         mockWebSocket.onmessage({
           data: JSON.stringify({
             type: 'metrics',
             data: { active_workflows: 5 }
           })
         })
       })

       await waitFor(() => {
         expect(result.current.metrics.active_workflows).toBe(5)
       })
     })
   })
   ```

**Week 19: E2E Tests & Performance**

**Tasks:**

1. **E2E Tests with Playwright**
   ```typescript
   // File: packages/dashboard/e2e/platform-management.spec.ts

   test.describe('Platform Management', () => {
     test('create new platform', async ({ page }) => {
       await page.goto('/platforms')
       await page.click('button:has-text("New Platform")')

       await page.fill('[name="name"]', 'Test Platform')
       await page.selectOption('[name="layer"]', 'APPLICATION')
       await page.fill('[name="description"]', 'Test description')

       await page.click('button:has-text("Create")')

       await expect(page.locator('text=Test Platform')).toBeVisible()
     })

     test('edit platform configuration', async ({ page }) => {
       await page.goto('/platforms/test-platform')
       await page.click('button:has-text("Edit")')

       await page.fill('[name="name"]', 'Updated Platform')
       await page.click('button:has-text("Save")')

       await expect(page.locator('text=Updated Platform')).toBeVisible()
     })

     test('workflow execution from start to finish', async ({ page }) => {
       await page.goto('/workflows/new')

       // Select platform
       await page.selectOption('[name="platform"]', 'test-platform')

       // Configure workflow
       await page.fill('[name="name"]', 'Test Workflow')

       // Start workflow
       await page.click('button:has-text("Execute")')

       // Wait for completion
       await expect(page.locator('text=Completed')).toBeVisible({ timeout: 60000 })
     })
   })
   ```

2. **Performance Testing**
   ```typescript
   // File: packages/dashboard/tests/performance/lighthouse.test.ts

   describe('Lighthouse Performance', () => {
     it('meets performance budget', async () => {
       const result = await runLighthouse('http://localhost:3050')

       expect(result.lhr.categories.performance.score).toBeGreaterThan(0.9)
       expect(result.lhr.categories.accessibility.score).toBeGreaterThan(0.9)
       expect(result.lhr.categories['best-practices'].score).toBeGreaterThan(0.9)
     })

     it('loads dashboard in under 2 seconds', async () => {
       const start = Date.now()
       await page.goto('http://localhost:3050')
       await page.waitForSelector('[data-testid="dashboard"]')
       const duration = Date.now() - start

       expect(duration).toBeLessThan(2000)
     })
   })
   ```

3. **Bundle Analysis**
   ```bash
   # Add bundle analyzer
   pnpm add -D @next/bundle-analyzer

   # Analyze bundle size
   ANALYZE=true pnpm build
   ```

**Week 20: Launch Preparation**

**Tasks:**

1. **Production Optimization**
   - Enable production build optimizations
   - Configure CDN for static assets
   - Set up error tracking (Sentry)
   - Configure analytics (PostHog/Plausible)
   - Set up monitoring (Prometheus/Grafana)

2. **Documentation**
   - User guide
   - Admin guide
   - API documentation
   - Deployment guide
   - Troubleshooting guide

3. **Launch Checklist**
   ```markdown
   ## Pre-Launch Checklist

   ### Technical
   - [ ] All tests passing (unit, integration, E2E)
   - [ ] Lighthouse score > 90
   - [ ] Bundle size < 500KB gzipped
   - [ ] Error tracking configured
   - [ ] Analytics configured
   - [ ] Monitoring dashboards set up
   - [ ] Backup strategy in place
   - [ ] SSL certificates configured
   - [ ] Security headers configured
   - [ ] Rate limiting enabled

   ### Content
   - [ ] User documentation complete
   - [ ] API documentation published
   - [ ] Help content reviewed
   - [ ] Onboarding tour tested
   - [ ] Demo workflows prepared

   ### Operations
   - [ ] Staging environment validated
   - [ ] Production deployment tested
   - [ ] Rollback procedure documented
   - [ ] Support team trained
   - [ ] Incident response plan ready
   ```

**Deliverables:**
- ✅ 200+ unit tests
- ✅ 50+ integration tests
- ✅ 20+ E2E tests
- ✅ Performance score > 90
- ✅ Accessibility WCAG 2.1 AA
- ✅ Complete documentation
- ✅ Production deployment

---

## Technology Stack Summary

### Frontend
- **Framework:** Next.js 14 (App Router)
- **UI Library:** shadcn/ui + Radix UI
- **Styling:** Tailwind CSS
- **State Management:** Zustand + React Query
- **Forms:** React Hook Form + Zod
- **Charts:** Recharts
- **Tables:** TanStack Table
- **Icons:** Lucide React
- **Command Palette:** cmdk
- **WebSocket:** Socket.io-client

### Development
- **Language:** TypeScript 5.x
- **Build Tool:** Turbo
- **Testing:** Vitest + React Testing Library + Playwright
- **Linting:** ESLint + Prettier
- **Component Docs:** Storybook

### Deployment
- **Hosting:** Vercel/Docker
- **CDN:** CloudFlare
- **Monitoring:** Prometheus + Grafana
- **Error Tracking:** Sentry
- **Analytics:** PostHog

---

## Success Metrics

### Performance
- First Contentful Paint (FCP): < 1.8s
- Largest Contentful Paint (LCP): < 2.5s
- Time to Interactive (TTI): < 3.8s
- Cumulative Layout Shift (CLS): < 0.1
- First Input Delay (FID): < 100ms

### User Experience
- Command palette response: < 100ms
- Page navigation: < 500ms
- API response time: < 1s
- Real-time update latency: < 200ms
- Search results: < 300ms

### Code Quality
- Test coverage: > 80%
- Lighthouse score: > 90
- Bundle size: < 500KB gzipped
- Type safety: 100%
- Accessibility: WCAG 2.1 AA

---

## Risk Mitigation

### Technical Risks
1. **Performance degradation with large datasets**
   - Mitigation: Virtual scrolling, pagination, lazy loading

2. **WebSocket connection stability**
   - Mitigation: Automatic reconnection, fallback to polling

3. **Complex state management**
   - Mitigation: Clear data flow, React Query caching

### Timeline Risks
1. **Scope creep**
   - Mitigation: Strict phase boundaries, MVP focus

2. **Integration delays**
   - Mitigation: Mock APIs, parallel development

3. **Testing bottlenecks**
   - Mitigation: Continuous testing, automated CI/CD

---

## Next Steps

1. **Review and approve this implementation plan**
2. **Set up development environment**
3. **Begin Phase 1: Foundation & Design System**
4. **Weekly progress reviews**
5. **Adjust timeline as needed**

---

**END OF IMPLEMENTATION PLAN**

**Status:** Ready for Development
**Estimated Completion:** 20 weeks
**Team Size:** 2-3 frontend developers
**Total Estimated Effort:** 2,400-3,000 hours
