import React, { useEffect, useState, useMemo } from 'react'
import { Grid, List, Plus, Filter } from 'lucide-react'
import {
  getPlatformSurfaces,
  enablePlatformSurface,
  updatePlatformSurface,
  disablePlatformSurface,
  type PlatformSurface,
} from '../api/surfaces'
import { fetchPlatforms, type Platform } from '../api/client'
import { logger } from '../utils/logger'
import { PageContainer } from '@/components/Layout/PageContainer'
import { SurfaceCard } from '@/components/Surfaces/SurfaceCard'
import { SurfaceFormModal, type SurfaceFormData } from '@/components/Surfaces/SurfaceFormModal'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/Common/EmptyState'

interface SurfaceWithPlatform extends PlatformSurface {
  platform_name?: string
}

export const SurfaceRegistryPage: React.FC = () => {
  const [surfaces, setSurfaces] = useState<SurfaceWithPlatform[]>([])
  const [platforms, setPlatforms] = useState<Platform[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterPlatform, setFilterPlatform] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Form modal state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false)
  const [editingSurface, setEditingSurface] = useState<SurfaceWithPlatform | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setIsLoading(true)

      // Load platforms first
      const platformsData = await fetchPlatforms()
      setPlatforms(platformsData)

      // Load surfaces for all platforms
      const allSurfaces: SurfaceWithPlatform[] = []
      await Promise.all(
        platformsData.map(async (platform) => {
          try {
            const platformSurfaces = await getPlatformSurfaces(platform.id)
            platformSurfaces.forEach((surface) => {
              allSurfaces.push({
                ...surface,
                platform_name: platform.name,
              })
            })
          } catch (err) {
            logger.warn(
              `Failed to load surfaces for platform ${platform.id}`,
              'SurfaceRegistryPage.loadData',
              err
            )
          }
        })
      )

      setSurfaces(allSurfaces)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load surfaces')
      logger.error('Failed to load surfaces', 'SurfaceRegistryPage.loadData', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleToggleEnabled = async (surface: SurfaceWithPlatform) => {
    try {
      await updatePlatformSurface(surface.platform_id, surface.surface_type, {
        enabled: !surface.enabled,
      })
      logger.info(`Surface ${surface.surface_type} ${surface.enabled ? 'disabled' : 'enabled'}`)
      await loadData()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to toggle surface'
      setError(errorMessage)
      logger.error(errorMessage)
    }
  }

  const handleDelete = async (surface: SurfaceWithPlatform) => {
    if (!confirm(`Are you sure you want to delete the ${surface.surface_type} surface?`)) {
      return
    }

    try {
      await disablePlatformSurface(surface.platform_id, surface.surface_type)
      logger.info(`Surface ${surface.surface_type} deleted`)
      await loadData()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete surface'
      setError(errorMessage)
      logger.error(errorMessage)
    }
  }

  const handleOpenCreateModal = () => {
    setEditingSurface(null)
    setModalError(null)
    setIsFormModalOpen(true)
  }

  const handleOpenEditModal = (surface: SurfaceWithPlatform) => {
    setEditingSurface(surface)
    setModalError(null)
    setIsFormModalOpen(true)
  }

  const handleSaveSurface = async (data: SurfaceFormData) => {
    setIsSaving(true)
    setModalError(null)

    try {
      if (editingSurface) {
        // Update existing surface
        await updatePlatformSurface(data.platform_id, editingSurface.surface_type, {
          config: data.config,
          enabled: data.enabled,
        })
        logger.info(`Surface updated successfully (${editingSurface.surface_type})`)
      } else {
        // Create new surface
        await enablePlatformSurface(data.platform_id, {
          surface_type: data.surface_type,
          config: data.config,
          enabled: data.enabled,
        })
        logger.info(`Surface created successfully (${data.surface_type})`)
      }
      await loadData()
      setIsFormModalOpen(false)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save surface'
      setModalError(errorMessage)
      logger.error(errorMessage)
    } finally {
      setIsSaving(false)
    }
  }

  // Filter logic
  const filteredSurfaces = useMemo(() => {
    return surfaces.filter((surface) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesSearch =
          surface.surface_type.toLowerCase().includes(query) ||
          surface.platform_name?.toLowerCase().includes(query) ||
          surface.platform_id.toLowerCase().includes(query)
        if (!matchesSearch) return false
      }

      // Type filter
      if (filterType !== 'all' && surface.surface_type !== filterType) {
        return false
      }

      // Platform filter
      if (filterPlatform !== 'all' && surface.platform_id !== filterPlatform) {
        return false
      }

      // Status filter
      if (filterStatus === 'enabled' && !surface.enabled) return false
      if (filterStatus === 'disabled' && surface.enabled) return false

      return true
    })
  }, [surfaces, searchQuery, filterType, filterPlatform, filterStatus])

  return (
    <PageContainer
      title="Surface Registry"
      description={`Manage platform surfaces (${surfaces.length} total, ${filteredSurfaces.length} shown)`}
      breadcrumbs={[
        { label: 'Dashboard', href: '/' },
        { label: 'Surfaces' }
      ]}
      actions={
        <Button onClick={handleOpenCreateModal}>
          <Plus className="mr-2 h-4 w-4" />
          New Surface
        </Button>
      }
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
              placeholder="Search surfaces..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-xs"
            />
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="REST">REST API</SelectItem>
                <SelectItem value="WEBHOOK">Webhook</SelectItem>
                <SelectItem value="CLI">CLI</SelectItem>
                <SelectItem value="DASHBOARD">Dashboard</SelectItem>
                <SelectItem value="MOBILE_API">Mobile API</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterPlatform} onValueChange={setFilterPlatform}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Platforms" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Platforms</SelectItem>
                {platforms.map((platform) => (
                  <SelectItem key={platform.id} value={platform.id}>
                    {platform.name}
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
                <SelectItem value="enabled">Enabled</SelectItem>
                <SelectItem value="disabled">Disabled</SelectItem>
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

      {/* Surface List */}
      {surfaces.length === 0 ? (
        <EmptyState
          icon={Plus}
          title="No surfaces configured"
          description="Surfaces will appear here once platforms have configured API endpoints, webhooks, or other interfaces"
        />
      ) : filteredSurfaces.length === 0 ? (
        <EmptyState
          icon={Filter}
          title="No surfaces match your filters"
          description="Try adjusting your search or filter criteria"
        />
      ) : (
        <div className={view === 'grid' ? 'grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6' : 'space-y-4'}>
          {filteredSurfaces.map((surface) => (
            <SurfaceCard
              key={`${surface.platform_id}-${surface.surface_type}`}
              surface={surface}
              platformName={surface.platform_name}
              view={view}
              onEdit={() => handleOpenEditModal(surface)}
              onToggleEnabled={() => handleToggleEnabled(surface)}
              onDelete={() => handleDelete(surface)}
            />
          ))}
        </div>
      )}

      <SurfaceFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false)
          setEditingSurface(null)
          setModalError(null)
        }}
        onSave={handleSaveSurface}
        platforms={platforms}
        surface={editingSurface || undefined}
        isLoading={isSaving}
        error={modalError}
      />
    </PageContainer>
  )
}
