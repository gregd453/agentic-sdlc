import { ReactNode } from 'react'

interface ChartContainerProps {
  title: string
  subtitle?: string
  children: ReactNode
  height?: number
  isLoading?: boolean
  error?: Error | null
}

export default function ChartContainer({
  title,
  subtitle,
  children,
  height = 350,
  isLoading = false,
  error = null,
}: ChartContainerProps) {
  return (
    <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow border border-gray-200">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      </div>

      {/* Content */}
      <div style={{ height }}>
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-red-600 font-medium">Error loading chart</p>
              <p className="text-sm text-gray-500 mt-1">{error.message}</p>
            </div>
          </div>
        ) : (
          <div className="p-6 h-full overflow-auto">
            {children}
          </div>
        )}
      </div>
    </div>
  )
}
