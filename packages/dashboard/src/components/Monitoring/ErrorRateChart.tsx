/**
 * ErrorRateChart Component
 * Displays error rate percentage over time
 */

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import ChartContainer from '../Common/ChartContainer'

interface ErrorRateDataPoint {
  timestamp: string
  error_rate_percent: number
}

interface ErrorRateChartProps {
  data: ErrorRateDataPoint[]
  isLoading?: boolean
  height?: number
  threshold?: number // Error rate threshold for warning (default 5%)
}

export default function ErrorRateChart({
  data,
  isLoading = false,
  height = 300,
  threshold = 5
}: ErrorRateChartProps) {
  // Format data for display
  const displayData = data.slice(-24).map((point) => ({
    ...point,
    time: new Date(point.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  }))

  // Calculate trend
  const currentRate = displayData.length > 0 ? displayData[displayData.length - 1].error_rate_percent : 0
  const previousRate = displayData.length > 1 ? displayData[displayData.length - 2].error_rate_percent : currentRate
  const trend = currentRate > previousRate ? 'increasing' : currentRate < previousRate ? 'decreasing' : 'stable'

  return (
    <ChartContainer
      title="Error Rate"
      subtitle={`Current: ${currentRate.toFixed(2)}% (${trend})`}
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
              label={{ value: 'Error %', angle: -90, position: 'insideLeft' }}
              domain={[0, 100]}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: '8px'
              }}
              formatter={(value: any) => {
                if (typeof value === 'number') {
                  return `${value.toFixed(2)}%`
                }
                return value
              }}
              labelFormatter={(label) => `Time: ${label}`}
            />
            {/* Warning threshold line */}
            <ReferenceLine
              y={threshold}
              stroke="#f59e0b"
              strokeDasharray="5 5"
              label={{ value: `Warning (${threshold}%)`, position: 'right', fill: '#f59e0b', fontSize: 12 }}
            />
            {/* Critical threshold line */}
            <ReferenceLine
              y={10}
              stroke="#ef4444"
              strokeDasharray="5 5"
              label={{ value: 'Critical (10%)', position: 'right', fill: '#ef4444', fontSize: 12 }}
            />
            <Line
              type="monotone"
              dataKey="error_rate_percent"
              stroke="#ef4444"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
              name="Error Rate"
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex items-center justify-center h-full text-gray-500">No error data available</div>
      )}
    </ChartContainer>
  )
}
