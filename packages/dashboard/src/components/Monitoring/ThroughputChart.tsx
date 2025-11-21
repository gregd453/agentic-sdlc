/**
 * ThroughputChart Component
 * Displays workflow throughput (creation/completion rates) over time
 */

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import ChartContainer from '../Common/ChartContainer'

interface ThroughputDataPoint {
  timestamp: string
  workflows_created: number
  workflows_completed: number
  workflows_per_sec: number
}

interface ThroughputChartProps {
  data: ThroughputDataPoint[]
  isLoading?: boolean
  height?: number
}

export default function ThroughputChart({ data, isLoading = false, height = 300 }: ThroughputChartProps) {
  // Format data for display (show last 24 data points, each ~1 hour)
  const displayData = data.slice(-24).map((point) => ({
    ...point,
    time: new Date(point.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  }))

  return (
    <ChartContainer
      title="Workflow Throughput"
      subtitle="Workflows created/completed per second"
      height={height}
      isLoading={isLoading}
    >
      {displayData.length > 0 ? (
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={displayData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="time"
              tick={{ fill: '#6b7280', fontSize: 12 }}
              stroke="#d1d5db"
            />
            <YAxis
              tick={{ fill: '#6b7280', fontSize: 12 }}
              stroke="#d1d5db"
              label={{ value: 'Workflows/sec', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: '8px'
              }}
              formatter={(value: any) => {
                if (typeof value === 'number') {
                  return value.toFixed(2)
                }
                return value
              }}
              labelFormatter={(label) => `Time: ${label}`}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="workflows_created"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
              name="Created"
            />
            <Line
              type="monotone"
              dataKey="workflows_completed"
              stroke="#10b981"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
              name="Completed"
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex items-center justify-center h-full text-gray-500">No throughput data available</div>
      )}
    </ChartContainer>
  )
}
