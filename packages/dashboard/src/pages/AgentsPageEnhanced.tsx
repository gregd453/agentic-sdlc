import React, { useEffect, useState, useMemo } from 'react'
import { Grid, List, Filter, Bot, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { fetchAgents, type AgentMetadata } from '../api/client'
import { logger } from '../utils/logger'
import { PageContainer } from '@/components/Layout/PageContainer'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/Common/EmptyState'
import { cn } from '@/lib/utils'

interface AgentWithStats extends AgentMetadata {
  tasks_completed?: number
  tasks_failed?: number
  avg_duration_ms?: number
  success_rate?: number
}

export const AgentsPageEnhanced: React.FC = () => {
  const [agents, setAgents] = useState<AgentWithStats[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    loadAgents()
  }, [])

  const loadAgents = async () => {
    try {
      setIsLoading(true)
      const data = await fetchAgents()
      setAgents(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agents')
      logger.error('Failed to load agents', 'AgentsPageEnhanced.loadAgents', err)
    } finally {
      setIsLoading(false)
    }
  }

  // Filter logic
  const filteredAgents = useMemo(() => {
    return agents.filter((agent) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesSearch =
          agent.type.toLowerCase().includes(query) ||
          agent.version?.toLowerCase().includes(query)
        if (!matchesSearch) return false
      }

      // Type filter
      if (filterType !== 'all' && agent.type !== filterType) {
        return false
      }

      // Status filter (mock - based on success rate)
      const successRate = agent.success_rate || 0
      if (filterStatus === 'healthy' && successRate < 90) return false
      if (filterStatus === 'degraded' && (successRate < 70 || successRate >= 90)) return false
      if (filterStatus === 'unhealthy' && successRate >= 70) return false

      return true
    })
  }, [agents, searchQuery, filterType, filterStatus])

  // Get unique agent types for filter
  const agentTypes = useMemo(() => {
    return Array.from(new Set(agents.map(a => a.type)))
  }, [agents])

  const getStatusBadge = (agent: AgentWithStats) => {
    const successRate = agent.success_rate || 0
    if (successRate >= 90) {
      return <Badge variant="success">Healthy</Badge>
    } else if (successRate >= 70) {
      return <Badge variant="secondary">Degraded</Badge>
    } else {
      return <Badge variant="destructive">Unhealthy</Badge>
    }
  }

  const renderAgentCard = (agent: AgentWithStats) => {
    if (view === 'list') {
      return (
        <Card key={agent.type} className="transition-all hover:shadow-md">
          <CardContent className="flex items-center justify-between p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Bot className="h-6 w-6 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold capitalize">{agent.type.replace(/_/g, ' ')}</h3>
                  {getStatusBadge(agent)}
                </div>
                <p className="text-sm text-muted-foreground">
                  Version: {agent.version || 'N/A'}
                </p>
              </div>
            </div>

            <div className="flex gap-8 text-sm">
              <div className="text-center">
                <div className="flex items-center gap-1 text-muted-foreground mb-1">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span>Completed</span>
                </div>
                <div className="text-2xl font-bold">{agent.tasks_completed || 0}</div>
              </div>
              <div className="text-center">
                <div className="flex items-center gap-1 text-muted-foreground mb-1">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <span>Failed</span>
                </div>
                <div className="text-2xl font-bold">{agent.tasks_failed || 0}</div>
              </div>
              <div className="text-center">
                <div className="flex items-center gap-1 text-muted-foreground mb-1">
                  <Clock className="h-4 w-4" />
                  <span>Avg Time</span>
                </div>
                <div className="text-lg font-bold">
                  {agent.avg_duration_ms ? `${(agent.avg_duration_ms / 1000).toFixed(1)}s` : 'N/A'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )
    }

    return (
      <Card key={agent.type} className="transition-all hover:shadow-lg h-full">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Bot className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base capitalize">{agent.type.replace(/_/g, ' ')}</CardTitle>
                <CardDescription>v{agent.version || '1.0.0'}</CardDescription>
              </div>
            </div>
            {getStatusBadge(agent)}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                  Completed
                </div>
                <div className="text-xl font-bold">{agent.tasks_completed || 0}</div>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                  <XCircle className="h-3 w-3 text-red-600" />
                  Failed
                </div>
                <div className="text-xl font-bold">{agent.tasks_failed || 0}</div>
              </div>
            </div>
            {agent.success_rate !== undefined && (
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Success Rate</span>
                  <span className="font-semibold">{agent.success_rate.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className={cn(
                      "h-2 rounded-full transition-all",
                      agent.success_rate >= 90 ? "bg-green-600" : agent.success_rate >= 70 ? "bg-yellow-600" : "bg-red-600"
                    )}
                    style={{ width: `${agent.success_rate}%` }}
                  />
                </div>
              </div>
            )}
            {agent.avg_duration_ms !== undefined && (
              <div className="flex justify-between text-sm pt-2">
                <span className="text-muted-foreground">Avg Duration</span>
                <span className="font-semibold">{(agent.avg_duration_ms / 1000).toFixed(2)}s</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <PageContainer
      title="Agent Registry"
      description={`Manage and monitor agents (${agents.length} total, ${filteredAgents.length} shown)`}
      breadcrumbs={[
        { label: 'Dashboard', href: '/' },
        { label: 'Agents' }
      ]}
      error={error}
      isLoading={isLoading}
      onErrorDismiss={() => setError(null)}
    >
      {/* Filters and View Toggle */}
      <div className="space-y-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          {/* Search and Filters */}
          <div className="flex flex-1 gap-4 flex-wrap">
            <Input
              placeholder="Search agents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-xs"
            />
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {agentTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type.replace(/_/g, ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="healthy">Healthy (≥90%)</SelectItem>
                <SelectItem value="degraded">Degraded (70-90%)</SelectItem>
                <SelectItem value="unhealthy">Unhealthy (&lt;70%)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* View Toggle */}
          <div className="flex gap-2">
            <Button
              variant={view === 'grid' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setView('grid')}
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              variant={view === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setView('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Agent List */}
      {agents.length === 0 ? (
        <EmptyState
          icon={Bot}
          title="No agents registered"
          description="Agents will appear here once they register with the platform"
        />
      ) : filteredAgents.length === 0 ? (
        <EmptyState
          icon={Filter}
          title="No agents match your filters"
          description="Try adjusting your search or filter criteria"
        />
      ) : (
        <div className={view === 'grid' ? 'grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6' : 'space-y-4'}>
          {filteredAgents.map(renderAgentCard)}
        </div>
      )}
    </PageContainer>
  )
}
