import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Platform } from '../../api/client'

interface PlatformCardProps {
  platform: Platform
  agentCount?: number
  workflowCount?: number
}

export const PlatformCard: React.FC<PlatformCardProps> = ({
  platform,
  agentCount = 0,
  workflowCount = 0
}) => {
  const navigate = useNavigate()

  return (
    <div
      onClick={() => navigate(`/platforms/${platform.id}`)}
      className="cursor-pointer group"
    >
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow hover:shadow-lg transition-all duration-200 p-6 border border-gray-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500">
        {/* Header */}
        <div className="mb-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {platform.name}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {platform.layer}
              </p>
            </div>
            <div className="flex-shrink-0">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                platform.enabled
                  ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
              }`}>
                {platform.enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </div>
          {platform.description && (
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
              {platform.description}
            </p>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-slate-700">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Agents</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {agentCount}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Workflows</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {workflowCount}
            </p>
          </div>
        </div>

        {/* Timestamp */}
        {platform.created_at && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">
            Created {new Date(platform.created_at).toLocaleDateString()}
          </p>
        )}
      </div>
    </div>
  )
}
