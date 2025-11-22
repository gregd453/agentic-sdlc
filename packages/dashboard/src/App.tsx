import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { FilterProvider } from './contexts/FilterContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { AppShell } from './components/Layout/AppShell'
import { CommandPalette } from './components/navigation/CommandPalette'
import Dashboard from './pages/Dashboard'
import WorkflowsPage from './pages/WorkflowsPage'
import WorkflowPage from './pages/WorkflowPage'
import TracesPage from './pages/TracesPage'
import TraceDetailPage from './pages/TraceDetailPage'
import { AgentsPageEnhanced } from './pages/AgentsPageEnhanced'
import { PlatformsPage } from './pages/PlatformsPage'
import { PlatformDetailsPage } from './pages/PlatformDetailsPage'
import { SurfaceRegistryPage } from './pages/SurfaceRegistryPage'
import { WorkflowBuilderPage } from './pages/WorkflowBuilderPage'
import WorkflowPipelineBuilderPage from './pages/WorkflowPipelineBuilderPage'
import WorkflowDefinitionsPage from './pages/WorkflowDefinitionsPage'
import MonitoringDashboardPage from './pages/MonitoringDashboardPage'
import { SchedulerJobsPage } from './pages/SchedulerJobsPage'
import { SchedulerExecutionsPage } from './pages/SchedulerExecutionsPage'
import { SchedulerEventsPage } from './pages/SchedulerEventsPage'
import NotFoundPage from './pages/NotFoundPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <FilterProvider>
          <BrowserRouter
            future={{
              v7_startTransition: true,
              v7_relativeSplatPath: true
            }}
          >
            <AppShell>
              <CommandPalette />
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/monitoring" element={<MonitoringDashboardPage />} />
                <Route path="/workflows">
                  <Route index element={<WorkflowsPage />} />
                  <Route path="new" element={<WorkflowBuilderPage />} />
                  <Route path="pipeline" element={<WorkflowPipelineBuilderPage />} />
                  <Route path=":id" element={<WorkflowPage />} />
                </Route>
                <Route path="/platforms">
                  <Route index element={<PlatformsPage />} />
                  <Route path=":id" element={<PlatformDetailsPage />} />
                  <Route path=":platformId/definitions" element={<WorkflowDefinitionsPage />} />
                </Route>
                <Route path="/surfaces" element={<SurfaceRegistryPage />} />
                <Route path="/scheduler">
                  <Route index element={<SchedulerJobsPage />} />
                  <Route path="jobs" element={<SchedulerJobsPage />} />
                  <Route path="executions" element={<SchedulerExecutionsPage />} />
                  <Route path="events" element={<SchedulerEventsPage />} />
                </Route>
                <Route path="/traces" element={<TracesPage />} />
                <Route path="/traces/:traceId" element={<TraceDetailPage />} />
                <Route path="/agents" element={<AgentsPageEnhanced />} />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </AppShell>
          </BrowserRouter>
        </FilterProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

export default App
