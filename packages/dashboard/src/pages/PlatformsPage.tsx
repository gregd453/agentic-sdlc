import React, { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Grid, List, Plus, Filter, CheckSquare, Square, Trash2, Power, PowerOff } from 'lucide-react'
import { fetchPlatforms, fetchPlatformAnalytics, createPlatform, updatePlatform, deletePlatform, type Platform } from '../api/client'
import { logger } from '../utils/logger'
import type { PlatformAnalytics } from '../types'
import { PageContainer } from '@/components/Layout/PageContainer'
import { PlatformCard } from '@/components/Platforms/PlatformCard'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/Common/EmptyState'
import PlatformFormModal from '../components/Platforms/PlatformFormModal'
import DeleteConfirmationModal from '../components/Common/DeleteConfirmationModal'
import CreateMockWorkflowModal from '../components/Workflows/CreateMockWorkflowModal'

interface PlatformWithAnalytics extends Platform {
  analytics?: PlatformAnalytics
  config?: Record<string, any> // Extended for clone functionality
}

export const PlatformsPage: React.FC = () => {
  const navigate = useNavigate()
  const [platforms, setPlatforms] = useState<PlatformWithAnalytics[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPeriod] = useState('24h')
  const [isFormModalOpen, setIsFormModalOpen] = useState(false)
  const [editingPlatform, setEditingPlatform] = useState<Platform | null>(null)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [platformToDelete, setPlatformToDelete] = useState<Platform | null>(null)
  const [isSaving, setSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)
  const [isCreateWorkflowModalOpen, setIsCreateWorkflowModalOpen] = useState(false)

  // New Phase 2 state
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [filterLayer, setFilterLayer] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Phase 2.2: Bulk operations
  const [selectedPlatformIds, setSelectedPlatformIds] = useState<Set<string>>(new Set())
  const [showCheckboxes, setShowCheckboxes] = useState(false)

  useEffect(() => {
    loadPlatforms()
  }, [])

  useEffect(() => {
    loadAnalytics()
  }, [selectedPeriod, platforms.length])

  const loadPlatforms = async () => {
    try {
      setIsLoading(true)
      const data = await fetchPlatforms()
      setPlatforms(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load platforms')
    } finally {
      setIsLoading(false)
    }
  }

  const loadAnalytics = async () => {
    if (platforms.length === 0) return

    try {
      const updatedPlatforms = await Promise.all(
        platforms.map(async (platform) => {
          try {
            const analytics = await fetchPlatformAnalytics(platform.id, selectedPeriod)
            return { ...platform, analytics }
          } catch (err) {
            logger.warn(
              `Failed to load analytics for platform`,
              `PlatformsPage.loadAnalytics`,
              err
            )
            return platform
          }
        })
      )
      setPlatforms(updatedPlatforms)
    } catch (err) {
      logger.error(
        'Failed to load platform analytics',
        'PlatformsPage.loadAnalytics',
        err
      )
    }
  }

  const handleOpenCreateModal = () => {
    setEditingPlatform(null)
    setModalError(null)
    setIsFormModalOpen(true)
  }

  const handleOpenEditModal = (platform: Platform) => {
    setEditingPlatform(platform)
    setModalError(null)
    setIsFormModalOpen(true)
  }

  const handleSavePlatform = async (data: any) => {
    setSaving(true)
    setModalError(null)

    try {
      if (editingPlatform) {
        await updatePlatform(editingPlatform.id, data)
        logger.info(`Platform updated successfully (${editingPlatform.id})`)
      } else {
        await createPlatform(data)
        logger.info(`Platform created successfully (${data.name})`)
      }
      await loadPlatforms()
      setIsFormModalOpen(false)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save platform'
      setModalError(errorMessage)
      const errMsg = err instanceof Error ? err.message : 'Unknown error'
      logger.error(errMsg)
    } finally {
      setSaving(false)
    }
  }

  const handleOpenDeleteModal = (platform: Platform) => {
    setPlatformToDelete(platform)
    setIsDeleteModalOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!platformToDelete) return

    setIsDeleting(true)

    try {
      await deletePlatform(platformToDelete.id)
      logger.info(`Platform deleted successfully (${platformToDelete.id})`)
      await loadPlatforms()
      setIsDeleteModalOpen(false)
      setPlatformToDelete(null)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete platform'
      setError(errorMessage)
      const errMsg = err instanceof Error ? err.message : 'Unknown error'
      logger.error(errMsg)
      setIsDeleteModalOpen(false)
      setPlatformToDelete(null)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleWorkflowCreated = (workflowId: string) => {
    setIsCreateWorkflowModalOpen(false)
    navigate(`/workflows/${workflowId}`)
  }

  const handleClonePlatform = async (platform: PlatformWithAnalytics) => {
    const clonedData = {
      name: `${platform.name} (Copy)`,
      layer: platform.layer as 'APPLICATION' | 'DATA' | 'INFRASTRUCTURE' | 'ENTERPRISE',
      description: platform.description,
      config: platform.config,
      enabled: false, // Start disabled
    }
    setEditingPlatform(null)
    setModalError(null)

    try {
      await createPlatform(clonedData)
      logger.info(`Platform cloned successfully (${clonedData.name})`)
      await loadPlatforms()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to clone platform'
      setError(errorMessage)
      logger.error(errorMessage)
    }
  }

  // Bulk selection handlers
  const handleToggleSelection = (platformId: string, selected: boolean) => {
    const newSelection = new Set(selectedPlatformIds)
    if (selected) {
      newSelection.add(platformId)
    } else {
      newSelection.delete(platformId)
    }
    setSelectedPlatformIds(newSelection)
  }

  const handleSelectAll = () => {
    if (selectedPlatformIds.size === filteredPlatforms.length) {
      setSelectedPlatformIds(new Set())
    } else {
      setSelectedPlatformIds(new Set(filteredPlatforms.map(p => p.id)))
    }
  }

  const handleBulkEnable = async () => {
    const count = selectedPlatformIds.size
    if (!confirm(`Enable ${count} selected platform${count > 1 ? 's' : ''}?`)) return

    try {
      await Promise.all(
        Array.from(selectedPlatformIds).map(id =>
          updatePlatform(id, { enabled: true })
        )
      )
      logger.info(`Bulk enabled ${count} platforms`)
      await loadPlatforms()
      setSelectedPlatformIds(new Set())
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to enable platforms'
      setError(errorMessage)
      logger.error(errorMessage)
    }
  }

  const handleBulkDisable = async () => {
    const count = selectedPlatformIds.size
    if (!confirm(`Disable ${count} selected platform${count > 1 ? 's' : ''}?`)) return

    try {
      await Promise.all(
        Array.from(selectedPlatformIds).map(id =>
          updatePlatform(id, { enabled: false })
        )
      )
      logger.info(`Bulk disabled ${count} platforms`)
      await loadPlatforms()
      setSelectedPlatformIds(new Set())
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to disable platforms'
      setError(errorMessage)
      logger.error(errorMessage)
    }
  }

  const handleBulkDelete = async () => {
    const count = selectedPlatformIds.size
    if (!confirm(`Delete ${count} selected platform${count > 1 ? 's' : ''}? This action cannot be undone.`)) return

    try {
      await Promise.all(
        Array.from(selectedPlatformIds).map(id => deletePlatform(id))
      )
      logger.info(`Bulk deleted ${count} platforms`)
      await loadPlatforms()
      setSelectedPlatformIds(new Set())
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete platforms'
      setError(errorMessage)
      logger.error(errorMessage)
    }
  }

  // Filter and search logic
  const filteredPlatforms = useMemo(() => {
    return platforms.filter((platform) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesSearch =
          platform.name.toLowerCase().includes(query) ||
          platform.description?.toLowerCase().includes(query) ||
          platform.layer.toLowerCase().includes(query)
        if (!matchesSearch) return false
      }

      // Layer filter
      if (filterLayer !== 'all' && platform.layer !== filterLayer) {
        return false
      }

      // Status filter
      if (filterStatus === 'active' && !platform.enabled) return false
      if (filterStatus === 'inactive' && platform.enabled) return false

      return true
    })
  }, [platforms, searchQuery, filterLayer, filterStatus])

  return (
    <PageContainer
      title="Platforms"
      description={`Manage and monitor multi-platform workflows (${platforms.length} total, ${filteredPlatforms.length} shown)`}
      breadcrumbs={[
        { label: 'Dashboard', href: '/' },
        { label: 'Platforms' }
      ]}
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant={showCheckboxes ? 'default' : 'outline'}
            onClick={() => {
              setShowCheckboxes(!showCheckboxes)
              setSelectedPlatformIds(new Set())
            }}
          >
            {showCheckboxes ? <CheckSquare className="mr-2 h-4 w-4" /> : <Square className="mr-2 h-4 w-4" />}
            Select
          </Button>
          <Button onClick={handleOpenCreateModal}>
            <Plus className="mr-2 h-4 w-4" />
            New Platform
          </Button>
          <Button variant="outline" onClick={() => setIsCreateWorkflowModalOpen(true)}>
            + Mock Workflow
          </Button>
        </div>
      }
      error={error}
      isLoading={isLoading}
      onErrorDismiss={() => setError(null)}
    >
      {/* Bulk Action Toolbar */}
      {showCheckboxes && selectedPlatformIds.size > 0 && (
        <div className="bg-primary/10 border border-primary rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="font-medium">
                {selectedPlatformIds.size} platform{selectedPlatformIds.size > 1 ? 's' : ''} selected
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
              >
                {selectedPlatformIds.size === filteredPlatforms.length ? 'Deselect All' : 'Select All'}
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkEnable}
              >
                <Power className="mr-2 h-4 w-4" />
                Enable
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkDisable}
              >
                <PowerOff className="mr-2 h-4 w-4" />
                Disable
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Filters and View Toggle */}
      <div className="space-y-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          {/* Search and Filters */}
          <div className="flex flex-1 gap-4 flex-wrap">
            <Input
              placeholder="Search platforms..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-xs"
            />
            <Select value={filterLayer} onValueChange={setFilterLayer}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Layers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Layers</SelectItem>
                <SelectItem value="APPLICATION">Application</SelectItem>
                <SelectItem value="DATA">Data</SelectItem>
                <SelectItem value="INFRASTRUCTURE">Infrastructure</SelectItem>
                <SelectItem value="ENTERPRISE">Enterprise</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
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

      {/* Platform List */}
      {platforms.length === 0 ? (
        <EmptyState
          icon={Plus}
          title="No platforms configured"
          description="Create your first platform to start managing workflows"
          action={{
            label: 'Create Platform',
            onClick: handleOpenCreateModal
          }}
        />
      ) : filteredPlatforms.length === 0 ? (
        <EmptyState
          icon={Filter}
          title="No platforms match your filters"
          description="Try adjusting your search or filter criteria"
        />
      ) : (
        <div className={view === 'grid' ? 'grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6' : 'space-y-4'}>
          {filteredPlatforms.map((platform) => (
            <PlatformCard
              key={platform.id}
              platform={platform as Platform}
              view={view}
              workflowCount={platform.analytics?.total_workflows || 0}
              showMetrics={true}
              onEdit={() => handleOpenEditModal(platform as Platform)}
              onClone={() => handleClonePlatform(platform)}
              onDelete={() => handleOpenDeleteModal(platform as Platform)}
              showCheckbox={showCheckboxes}
              isSelected={selectedPlatformIds.has(platform.id)}
              onSelect={(selected) => handleToggleSelection(platform.id, selected)}
            />
          ))}
        </div>
      )}

      <PlatformFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false)
          setEditingPlatform(null)
          setModalError(null)
        }}
        onSave={handleSavePlatform}
        platform={editingPlatform}
        isLoading={isSaving}
        error={modalError}
      />

      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false)
          setPlatformToDelete(null)
        }}
        onConfirm={handleConfirmDelete}
        title="Delete Platform"
        message="Are you sure you want to delete this platform? This action cannot be undone."
        itemName={platformToDelete?.name}
        isLoading={isDeleting}
        isDangerous={true}
      />

      <CreateMockWorkflowModal
        isOpen={isCreateWorkflowModalOpen}
        onClose={() => setIsCreateWorkflowModalOpen(false)}
        onWorkflowCreated={handleWorkflowCreated}
      />
    </PageContainer>
  )
}
