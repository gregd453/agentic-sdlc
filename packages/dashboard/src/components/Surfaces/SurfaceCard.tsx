import React from 'react'
import { Globe, Webhook, Terminal, Layout, Smartphone, MoreVertical, Edit, Trash2, Power } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { PlatformSurface } from '../../api/surfaces'

interface SurfaceCardProps {
  surface: PlatformSurface
  platformName?: string
  view?: 'grid' | 'list'
  onEdit?: () => void
  onToggleEnabled?: () => void
  onDelete?: () => void
}

const surfaceIcons = {
  REST: Globe,
  WEBHOOK: Webhook,
  CLI: Terminal,
  DASHBOARD: Layout,
  MOBILE_API: Smartphone,
}

const surfaceColors = {
  REST: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  WEBHOOK: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  CLI: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  DASHBOARD: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  MOBILE_API: 'bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300',
}

export const SurfaceCard: React.FC<SurfaceCardProps> = ({
  surface,
  platformName,
  view = 'grid',
  onEdit,
  onToggleEnabled,
  onDelete,
}) => {
  const Icon = surfaceIcons[surface.surface_type] || Globe
  const colorClass = surfaceColors[surface.surface_type] || surfaceColors.REST

  if (view === 'list') {
    return (
      <Card className="transition-all hover:shadow-md">
        <CardContent className="flex items-center justify-between p-6">
          <div className="flex items-center gap-4">
            <div className={cn('flex h-12 w-12 items-center justify-center rounded-lg', colorClass)}>
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">{surface.surface_type}</h3>
                <Badge variant={surface.enabled ? 'success' : 'secondary'}>
                  {surface.enabled ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>
              {platformName && (
                <p className="text-sm text-muted-foreground">
                  Platform: {platformName}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Created {new Date(surface.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>

          {surface.config && Object.keys(surface.config).length > 0 && (
            <div className="text-sm text-muted-foreground">
              {Object.keys(surface.config).length} config{Object.keys(surface.config).length > 1 ? 's' : ''}
            </div>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onEdit && (
                <DropdownMenuItem onClick={onEdit}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Config
                </DropdownMenuItem>
              )}
              {onToggleEnabled && (
                <DropdownMenuItem onClick={onToggleEnabled}>
                  <Power className="mr-2 h-4 w-4" />
                  {surface.enabled ? 'Disable' : 'Enable'}
                </DropdownMenuItem>
              )}
              {onDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onDelete} className="text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn('transition-all hover:shadow-lg group h-full')}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', colorClass)}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">{surface.surface_type}</CardTitle>
              {platformName && (
                <CardDescription className="text-xs">{platformName}</CardDescription>
              )}
            </div>
          </div>
          <Badge variant={surface.enabled ? 'success' : 'secondary'}>
            {surface.enabled ? 'Enabled' : 'Disabled'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {surface.config && Object.keys(surface.config).length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">Configuration:</p>
            <div className="space-y-1">
              {Object.entries(surface.config).slice(0, 3).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{key}:</span>
                  <span className="font-mono truncate ml-2 max-w-[150px]">
                    {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                  </span>
                </div>
              ))}
              {Object.keys(surface.config).length > 3 && (
                <p className="text-xs text-muted-foreground">
                  +{Object.keys(surface.config).length - 3} more
                </p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No configuration</p>
        )}
        <p className="text-xs text-muted-foreground mt-4">
          Created {new Date(surface.created_at).toLocaleDateString()}
        </p>
      </CardContent>
      <div className="px-6 pb-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        {onEdit && (
          <Button variant="outline" size="sm" onClick={onEdit} className="flex-1">
            <Edit className="h-4 w-4 mr-1" /> Edit
          </Button>
        )}
        {onToggleEnabled && (
          <Button
            variant="outline"
            size="sm"
            onClick={onToggleEnabled}
            className="flex-1"
          >
            <Power className="h-4 w-4 mr-1" />
            {surface.enabled ? 'Disable' : 'Enable'}
          </Button>
        )}
        {onDelete && (
          <Button variant="outline" size="sm" onClick={onDelete} className="flex-1">
            <Trash2 className="h-4 w-4 mr-1" /> Delete
          </Button>
        )}
      </div>
    </Card>
  )
}
