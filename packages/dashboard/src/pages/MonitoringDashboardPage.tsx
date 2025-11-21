/**
 * MonitoringDashboardPage
 * Real-time monitoring dashboard combining system status, metrics, and event streams
 */

import { useEffect, useState } from 'react'
import LoadingSpinner from '../components/Common/LoadingSpinner'
import ErrorDisplay from '../components/Common/ErrorDisplay'
import { PageTemplate } from '../components/Layout/PageTemplate'
import SystemStatusBanner from '../components/Monitoring/SystemStatusBanner'
import ThroughputChart from '../components/Monitoring/ThroughputChart'
import LatencyChart from '../components/Monitoring/LatencyChart'
import ErrorRateChart from '../components/Monitoring/ErrorRateChart'
import AgentHealthMatrix from '../components/Monitoring/AgentHealthMatrix'
import EventStreamPanel from '../components/Monitoring/EventStreamPanel'
import { useRealtimeMetrics } from '../hooks/useRealtimeMetrics'
import { useWorkflows } from '../hooks/useWorkflows'
import { useTimeSeries } from '../hooks/useStats'

/**
 * Main monitoring dashboard page
 * Displays real-time system metrics, charts, and event stream
 */
export default function MonitoringDashboardPage() {
  const { metrics, status, error, isLoading } = useRealtimeMetrics()
  const { data: allWorkflows } = useWorkflows()
  const { data: timeSeries } = useTimeSeries('24h')

  // Mock event data from workflows (in real implementation, would come from WebSocket)
  const [events, setEvents] = useState<Array<{
    id: string
    workflow_id: string
    event_type: string
    payload: Record<string, any>
    timestamp: string
    trace_id: string | null
  }>>([])

  // Generate events from workflows for demonstration
  useEffect(() => {
    if (allWorkflows && allWorkflows.length > 0) {
      const generatedEvents = allWorkflows.slice(0, 10).map((workflow, index) => ({
        id: `event-${index}`,
        workflow_id: workflow.id,
        event_type: workflow.status === 'failed' ? 'WORKFLOW_FAILED' :
                   workflow.status === 'completed' ? 'WORKFLOW_COMPLETED' :
                   workflow.status === 'running' ? 'WORKFLOW_STARTED' :
                   'WORKFLOW_CREATED',
        payload: { status: workflow.status, priority: workflow.priority },
        timestamp: workflow.updated_at || new Date().toISOString(),
        trace_id: workflow.trace_id
      }))
      setEvents(generatedEvents)
    }
  }, [allWorkflows])

  // Prepare chart data
  const throughputData = timeSeries?.map((point) => ({
    timestamp: point.timestamp,
    workflows_created: Math.floor(Math.random() * 100),
    workflows_completed: Math.floor(Math.random() * 80),
    workflows_per_sec: Math.floor(Math.random() * 10)
  })) || []

  const latencyData = timeSeries?.map((point) => ({
    timestamp: point.timestamp,
    p50_latency_ms: Math.floor(Math.random() * 500 + 100),
    p95_latency_ms: Math.floor(Math.random() * 1500 + 500),
    p99_latency_ms: Math.floor(Math.random() * 3000 + 1000)
  })) || []

  const errorRateData = timeSeries?.map((point) => ({
    timestamp: point.timestamp,
    error_rate_percent: Math.random() * 10
  })) || []

  // Handle loading and error states
  if (isLoading) {
    return (
      <PageTemplate
        title="Real-Time Monitoring"
        subtitle="System metrics and event stream"
      >
        <LoadingSpinner size="lg" className="py-12" />
      </PageTemplate>
    )
  }

  if (error) {
    return (
      <PageTemplate
        title="Real-Time Monitoring"
        subtitle="System metrics and event stream"
      >
        <ErrorDisplay error={error} />
      </PageTemplate>
    )
  }

  return (
    <PageTemplate
      title="Real-Time Monitoring"
      subtitle={`System status: ${status} • Last update: ${metrics?.timestamp ? new Date(metrics.timestamp).toLocaleTimeString() : 'N/A'}`}
    >
      {/* System Status Banner */}
      <SystemStatusBanner metrics={metrics} connectionStatus={status} />

      {/* Top Row: Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* Throughput Chart */}
        <div className="md:col-span-2">
          <ThroughputChart data={throughputData} isLoading={false} />
        </div>

        {/* Error Rate Chart */}
        <div>
          <ErrorRateChart data={errorRateData} isLoading={false} height={300} />
        </div>
      </div>

      {/* Middle Row: Latency and Event Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Latency Chart - spans 2 columns */}
        <div className="lg:col-span-2">
          <LatencyChart data={latencyData} isLoading={false} height={300} />
        </div>

        {/* Event Stream - spans 1 column */}
        <div>
          <EventStreamPanel events={events} maxEvents={50} autoScroll={true} />
        </div>
      </div>

      {/* Bottom Row: Agent Health Matrix */}
      <div className="grid grid-cols-1 gap-6">
        <AgentHealthMatrix metrics={metrics} />
      </div>

      {/* Connection Status Info */}
      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800 text-sm text-blue-800 dark:text-blue-200">
        <p className="font-semibold mb-1">ℹ️ Monitoring Information</p>
        <ul className="space-y-1 text-xs">
          <li>• Connection Status: <span className="font-semibold capitalize">{status}</span></li>
          <li>• Metrics Update Interval: 5 seconds</li>
          <li>• Data Retention: Last 24 hours</li>
          <li>• Chart Data: Mock data (replace with real metrics once backend is ready)</li>
        </ul>
      </div>
    </PageTemplate>
  )
}
