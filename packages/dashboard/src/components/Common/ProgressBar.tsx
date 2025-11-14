interface ProgressBarProps {
  value: number // 0-100
  className?: string
  showLabel?: boolean
}

export default function ProgressBar({ value, className = '', showLabel = true }: ProgressBarProps) {
  const percentage = Math.min(Math.max(value, 0), 100)

  return (
    <div className={className}>
      <div className="flex justify-between mb-1">
        {showLabel && (
          <span className="text-xs font-medium text-gray-700">{percentage}%</span>
        )}
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-primary-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
