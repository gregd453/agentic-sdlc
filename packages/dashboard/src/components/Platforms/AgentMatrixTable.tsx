import React from 'react'
import { AgentMetadata } from '../../api/client'

interface AgentMatrixTableProps {
  agents: AgentMetadata[]
  loading?: boolean
  error?: string | null
}

export const AgentMatrixTable: React.FC<AgentMatrixTableProps> = ({
  agents,
  loading = false,
  error = null
}) => {
  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
      </div>
    )
  }

  if (agents.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 dark:text-gray-400">No agents available for this platform</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto bg-white dark:bg-slate-800 rounded-lg shadow border border-gray-200 dark:border-slate-700">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 dark:bg-slate-700 border-b border-gray-200 dark:border-slate-600">
            <th className="px-6 py-3 text-left font-semibold text-gray-900 dark:text-white">
              Agent Type
            </th>
            <th className="px-6 py-3 text-left font-semibold text-gray-900 dark:text-white">
              Name
            </th>
            <th className="px-6 py-3 text-left font-semibold text-gray-900 dark:text-white">
              Version
            </th>
            <th className="px-6 py-3 text-left font-semibold text-gray-900 dark:text-white">
              Scope
            </th>
            <th className="px-6 py-3 text-left font-semibold text-gray-900 dark:text-white">
              Timeout
            </th>
            <th className="px-6 py-3 text-left font-semibold text-gray-900 dark:text-white">
              Retries
            </th>
            <th className="px-6 py-3 text-left font-semibold text-gray-900 dark:text-white">
              Capabilities
            </th>
          </tr>
        </thead>
        <tbody>
          {agents.map((agent, index) => (
            <tr
              key={`${agent.type}-${index}`}
              className="border-b border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
            >
              <td className="px-6 py-4">
                <code className="bg-gray-100 dark:bg-slate-700 px-2 py-1 rounded text-gray-900 dark:text-white font-mono text-xs">
                  {agent.type}
                </code>
              </td>
              <td className="px-6 py-4 text-gray-900 dark:text-white font-medium">
                {agent.name}
              </td>
              <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                {agent.version}
              </td>
              <td className="px-6 py-4">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  agent.scope === 'platform'
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                    : 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200'
                }`}>
                  {agent.scope === 'platform' ? 'Platform' : 'Global'}
                </span>
              </td>
              <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                {(agent.timeout_ms / 1000).toFixed(1)}s
              </td>
              <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                {agent.max_retries}
              </td>
              <td className="px-6 py-4">
                <div className="flex flex-wrap gap-1">
                  {agent.capabilities && agent.capabilities.length > 0 ? (
                    agent.capabilities.slice(0, 2).map((cap, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
                      >
                        {cap}
                      </span>
                    ))
                  ) : (
                    <span className="text-gray-400 dark:text-gray-500 text-xs">—</span>
                  )}
                  {agent.capabilities && agent.capabilities.length > 2 && (
                    <span className="text-gray-500 dark:text-gray-400 text-xs">
                      +{agent.capabilities.length - 2} more
                    </span>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
