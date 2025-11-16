/**
 * Hook utilities for transforming API responses into chart-compatible formats
 */

export interface ChartDataPoint {
  name: string
  value: number
  [key: string]: any
}

/**
 * Transform status count data into pie/donut chart format
 * Input: { status: string, count: number }[]
 * Output: Recharts compatible format
 */
export function transformToChartData(data: Array<{ status?: string; count?: number; [key: string]: any }>) {
  return data.map(item => ({
    name: item.status || item.name || 'Unknown',
    value: item.count || 0,
    ...item,
  }))
}

/**
 * Transform time series data for area/line charts
 */
export function transformTimeSeries(
  data: Array<{ timestamp: string; [key: string]: any }>,
  dateFormat = 'short' // 'short' for HH:mm, 'long' for MMM DD HH:mm
) {
  return data.map(item => {
    const date = new Date(item.timestamp)
    const formattedDate = dateFormat === 'short'
      ? date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      : date.toLocaleDateString('en-US', { month: 'short', day: '2-digit' }) +
        ' ' + date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

    return {
      name: formattedDate,
      ...item,
      timestamp: item.timestamp,
    }
  })
}

/**
 * Aggregate multiple values by key
 * Useful for combining similar data points
 */
export function aggregateByKey<T extends Record<string, any>>(
  data: T[],
  key: keyof T,
  sumKey: keyof T
): Array<{ key: string; value: number }> {
  const map = new Map<string, number>()

  data.forEach(item => {
    const k = String(item[key])
    const v = Number(item[sumKey]) || 0
    map.set(k, (map.get(k) || 0) + v)
  })

  return Array.from(map, ([key, value]) => ({ key, value }))
}
