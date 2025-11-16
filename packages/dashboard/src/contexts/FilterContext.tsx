import React, { createContext, useState, useCallback, ReactNode } from 'react'

export type TimeRange = '1h' | '24h' | '7d' | '30d'
export type Environment = 'dev' | 'staging' | 'prod'
export type AgentType = 'scaffold' | 'validation' | 'e2e_test' | 'integration' | 'deployment'

export interface FilterContextType {
  // Global filters
  timeRange: TimeRange
  setTimeRange: (range: TimeRange) => void

  environment: Environment
  setEnvironment: (env: Environment) => void

  // Agent type filter (multi-select)
  agentTypes: AgentType[]
  setAgentTypes: (types: AgentType[]) => void

  // Status filter (single select, used by tables)
  statusFilter: string | null
  setStatusFilter: (status: string | null) => void

  // Reset all filters
  resetFilters: () => void
}

const defaultFilters: Omit<FilterContextType, 'setTimeRange' | 'setEnvironment' | 'setAgentTypes' | 'setStatusFilter' | 'resetFilters'> = {
  timeRange: '24h',
  environment: 'prod',
  agentTypes: ['scaffold', 'validation', 'e2e_test', 'integration', 'deployment'],
  statusFilter: null,
}

export const FilterContext = createContext<FilterContextType | undefined>(undefined)

interface FilterProviderProps {
  children: ReactNode
}

export function FilterProvider({ children }: FilterProviderProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>(defaultFilters.timeRange)
  const [environment, setEnvironment] = useState<Environment>(defaultFilters.environment)
  const [agentTypes, setAgentTypes] = useState<AgentType[]>(defaultFilters.agentTypes)
  const [statusFilter, setStatusFilter] = useState<string | null>(defaultFilters.statusFilter)

  const resetFilters = useCallback(() => {
    setTimeRange(defaultFilters.timeRange)
    setEnvironment(defaultFilters.environment)
    setAgentTypes(defaultFilters.agentTypes)
    setStatusFilter(defaultFilters.statusFilter)
  }, [])

  const value: FilterContextType = {
    timeRange,
    setTimeRange,
    environment,
    setEnvironment,
    agentTypes,
    setAgentTypes,
    statusFilter,
    setStatusFilter,
    resetFilters,
  }

  return (
    <FilterContext.Provider value={value}>
      {children}
    </FilterContext.Provider>
  )
}

export function useFilters(): FilterContextType {
  const context = React.useContext(FilterContext)
  if (!context) {
    throw new Error('useFilters must be used within a FilterProvider')
  }
  return context
}
