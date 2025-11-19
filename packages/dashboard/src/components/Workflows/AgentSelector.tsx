/**
 * AgentSelector - Dynamic Agent Discovery Component
 * Session #85: Dashboard Agent Extensibility
 *
 * Features:
 * - Dynamic agent discovery from orchestrator
 * - Platform-scoped filtering
 * - Agent metadata display (version, capabilities, description)
 * - Loading and error states
 */

import { useState, useEffect } from 'react'
import { fetchAgents, AgentMetadata } from '../../api/client'

interface AgentSelectorProps {
  value: string
  onChange: (agentType: string) => void
  platformId?: string
  showMetadata?: boolean
}

export default function AgentSelector({
  value,
  onChange,
  platformId,
  showMetadata = false
}: AgentSelectorProps) {
  const [agents, setAgents] = useState<AgentMetadata[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedAgent, setSelectedAgent] = useState<AgentMetadata | null>(null)

  // Fetch agents on mount or when platformId changes
  useEffect(() => {
    const loadAgents = async () => {
      try {
        setLoading(true)
        setError(null)
        const agentList = await fetchAgents(platformId)
        setAgents(agentList)

        // If value is set, find and set the selected agent
        if (value) {
          const agent = agentList.find(a => a.type === value)
          setSelectedAgent(agent || null)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load agents')
        console.error('Failed to fetch agents:', err)
      } finally {
        setLoading(false)
      }
    }

    loadAgents()
  }, [platformId, value])

  const handleSelect = (agentType: string) => {
    onChange(agentType)
    const agent = agents.find(a => a.type === agentType)
    setSelectedAgent(agent || null)
  }

  if (loading) {
    return (
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Agent Type</label>
        <div className="flex items-center justify-center p-4 bg-gray-100 rounded-md">
          <div className="text-sm text-gray-600">Loading agents...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Agent Type</label>
        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-700">Error loading agents: {error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">Agent Type *</label>

      {/* Agent Dropdown */}
      <select
        value={value}
        onChange={(e) => handleSelect(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
      >
        <option value="">-- Select Agent --</option>
        {agents.map(agent => (
          <option key={agent.type} value={agent.type}>
            {agent.name} v{agent.version}
            {agent.scope === 'platform' && ' [platform-scoped]'}
          </option>
        ))}
      </select>

      {/* Agent Metadata Display (optional) */}
      {showMetadata && selectedAgent && (
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md space-y-3">
          <div>
            <h4 className="text-sm font-semibold text-gray-900">{selectedAgent.name}</h4>
            {selectedAgent.description && (
              <p className="text-sm text-gray-600 mt-1">{selectedAgent.description}</p>
            )}
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="font-medium text-gray-700">Version:</span>
              <p className="text-gray-600">{selectedAgent.version}</p>
            </div>
            <div>
              <span className="font-medium text-gray-700">Scope:</span>
              <p className="text-gray-600 capitalize">
                {selectedAgent.scope}
                {selectedAgent.scope === 'platform' && selectedAgent.platformId && ` (${selectedAgent.platformId})`}
              </p>
            </div>
            <div>
              <span className="font-medium text-gray-700">Timeout:</span>
              <p className="text-gray-600">{selectedAgent.timeout_ms}ms</p>
            </div>
            <div>
              <span className="font-medium text-gray-700">Max Retries:</span>
              <p className="text-gray-600">{selectedAgent.max_retries}</p>
            </div>
          </div>

          {/* Capabilities */}
          {selectedAgent.capabilities && selectedAgent.capabilities.length > 0 && (
            <div>
              <span className="font-medium text-gray-700 text-sm">Capabilities:</span>
              <div className="flex flex-wrap gap-2 mt-2">
                {selectedAgent.capabilities.map(cap => (
                  <span
                    key={cap}
                    className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                  >
                    {cap}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Config Schema Info */}
          {selectedAgent.configSchema && (
            <div>
              <span className="font-medium text-gray-700 text-sm">Custom Configuration Available</span>
              <p className="text-xs text-gray-600 mt-1">
                This agent supports custom configuration fields
              </p>
            </div>
          )}
        </div>
      )}

      {/* Info Text */}
      {!selectedAgent && (
        <p className="text-xs text-gray-500">
          {agents.length} agent(s) available
          {platformId && ` for this platform`}
        </p>
      )}
    </div>
  )
}
