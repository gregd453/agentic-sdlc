import { useFilters, type TimeRange, type AgentType } from '../../contexts/FilterContext'

export default function GlobalFiltersBar() {
  const { timeRange, setTimeRange, environment, setEnvironment, agentTypes, setAgentTypes, resetFilters } = useFilters()

  const handleAgentTypeChange = (agent: AgentType) => {
    setAgentTypes(
      agentTypes.includes(agent)
        ? agentTypes.filter(a => a !== agent)
        : [...agentTypes, agent]
    )
  }

  const allAgentTypes: AgentType[] = ['scaffold', 'validation', 'e2e_test', 'integration', 'deployment']

  return (
    <div className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Monitoring Filters</h2>
          <button
            onClick={resetFilters}
            className="text-sm text-blue-600 hover:text-blue-900 font-medium"
          >
            Reset All
          </button>
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Time Range Dropdown */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Time Range
            </label>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as TimeRange)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
            >
              <option value="1h">Last 1 hour</option>
              <option value="24h">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
            </select>
          </div>

          {/* Environment Dropdown */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Environment
            </label>
            <select
              value={environment}
              onChange={(e) => setEnvironment(e.target.value as any)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
            >
              <option value="dev">Development</option>
              <option value="staging">Staging</option>
              <option value="prod">Production</option>
            </select>
          </div>

          {/* Agent Types Multi-Select */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Agent Types ({agentTypes.length})
            </label>
            <div className="flex flex-wrap gap-2">
              {allAgentTypes.map(agent => (
                <label key={agent} className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agentTypes.includes(agent)}
                    onChange={() => handleAgentTypeChange(agent)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700 capitalize">
                    {agent.replace('_', ' ')}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Active Filters Display */}
        {(timeRange !== '24h' || environment !== 'prod' || agentTypes.length !== allAgentTypes.length) && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-600 font-medium mb-2">Active Filters:</p>
            <div className="flex flex-wrap gap-2">
              {timeRange !== '24h' && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                  Time: {timeRange}
                </span>
              )}
              {environment !== 'prod' && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                  Env: {environment}
                </span>
              )}
              {agentTypes.length !== allAgentTypes.length && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                  Agents: {agentTypes.length}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
