import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { FilterProvider } from './contexts/FilterContext'
import { ThemeProvider } from './contexts/ThemeContext'
import Layout from './components/Layout/Layout'
import Dashboard from './pages/Dashboard'
import WorkflowsPage from './pages/WorkflowsPage'
import WorkflowPage from './pages/WorkflowPage'
import TracesPage from './pages/TracesPage'
import TraceDetailPage from './pages/TraceDetailPage'
import AgentsPage from './pages/AgentsPage'
import { PlatformsPage } from './pages/PlatformsPage'
import { PlatformDetailsPage } from './pages/PlatformDetailsPage'
import { WorkflowBuilderPage } from './pages/WorkflowBuilderPage'
import WorkflowPipelineBuilderPage from './pages/WorkflowPipelineBuilderPage'
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
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/workflows">
                  <Route index element={<WorkflowsPage />} />
                  <Route path="new" element={<WorkflowBuilderPage />} />
                  <Route path="pipeline" element={<WorkflowPipelineBuilderPage />} />
                  <Route path=":id" element={<WorkflowPage />} />
                </Route>
                <Route path="/platforms">
                  <Route index element={<PlatformsPage />} />
                  <Route path=":id" element={<PlatformDetailsPage />} />
                </Route>
                <Route path="/traces" element={<TracesPage />} />
                <Route path="/traces/:traceId" element={<TraceDetailPage />} />
                <Route path="/agents" element={<AgentsPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Layout>
          </BrowserRouter>
        </FilterProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

export default App
