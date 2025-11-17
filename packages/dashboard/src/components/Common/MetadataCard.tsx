/**
 * Metadata card component for displaying labeled information
 */

interface MetadataCardProps {
  label: string
  value: React.ReactNode
}

export default function MetadataCard({ label, value }: MetadataCardProps) {
  return (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <dt className="text-sm font-medium text-gray-500 truncate">{label}</dt>
        <dd className="mt-1 text-sm text-gray-900">{value}</dd>
      </div>
    </div>
  )
}
