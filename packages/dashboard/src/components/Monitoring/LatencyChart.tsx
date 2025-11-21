/**
 * LatencyChart Component
 * Displays workflow latency percentiles (p50, p95, p99) over time
 */

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import ChartContainer from '../Common/ChartContainer'

interface LatencyDataPoint {
  timestamp: string
  p50_latency_ms: number
  p95_latency_ms: number
  p99_latency_ms: number
}

interface LatencyChartProps {
  data: LatencyDataPoint[]
  isLoading?: boolean
  height?: number
}

export default function LatencyChart({ data, isLoading = false, height = 300 }: LatencyChartProps) {
  // Format data for display
  const displayData = data.slice(-24).map((point) => ({
    ...point,
    time: new Date(point.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  }))

  return (
    <ChartContainer
      title="Workflow Latency"
      subtitle="Latency percentiles (p50, p95, p99) in milliseconds"
      height={height}
      isLoading={isLoading}
    >
      {displayData.length > 0 ? (
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={displayData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id="colorP50" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorP95" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.1}/>
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorP99" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/>
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="time"
              tick={{ fill: '#6b7280', fontSize: 12 }}
              stroke="#d1d5db"
            />
            <YAxis
              tick={{ fill: '#6b7280', fontSize: 12 }}
              stroke="#d1d5db"
              label={{ value: 'Milliseconds', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: '8px'
              }}
              formatter={(value: any) => {
                if (typeof value === 'number') {
                  return `${value.toFixed(0)}ms`
                }
                return value
              }}
              labelFormatter={(label) => `Time: ${label}`}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="p50_latency_ms"
              stroke="#3b82f6"
              fillOpacity={0.3}
              fill="url(#colorP50)"
              isAnimationActive={false}
              name="p50"
            />
            <Area
              type="monotone"
              dataKey="p95_latency_ms"
              stroke="#f59e0b"
              fillOpacity={0.2}
              fill="url(#colorP95)"
              isAnimationActive={false}
              name="p95"
            />
            <Area
              type="monotone"
              dataKey="p99_latency_ms"
              stroke="#ef4444"
              fillOpacity={0.1}
              fill="url(#colorP99)"
              isAnimationActive={false}
              name="p99"
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex items-center justify-center h-full text-gray-500">No latency data available</div>
      )}
    </ChartContainer>
  )
}
