import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Layers, Edit, Copy, Trash2, MoreVertical } from 'lucide-react'
import { Platform } from '../../api/client'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
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

interface PlatformCardProps {
  platform: Platform
  agentCount?: number
  workflowCount?: number
  surfaceCount?: number
  view?: 'grid' | 'list'
  onEdit?: () => void
  onClone?: () => void
  onDelete?: () => void
  showMetrics?: boolean
  isSelected?: boolean
  onSelect?: (selected: boolean) => void
  showCheckbox?: boolean
}

export const PlatformCard: React.FC<PlatformCardProps> = ({
  platform,
  agentCount = 0,
  workflowCount = 0,
  surfaceCount = 0,
  view = 'grid',
  onEdit,
  onClone,
  onDelete,
  showMetrics = true,
  isSelected = false,
  onSelect,
  showCheckbox = false,
}) => {
  const navigate = useNavigate()

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on action buttons or checkbox
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input[type="checkbox"]')) {
      e.stopPropagation()
      return
    }
    navigate(`/platforms/${platform.id}`)
  }

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation()
    onSelect?.(e.target.checked)
  }

  if (view === 'list') {
    return (
      <Card
        className={cn(
          "transition-all hover:shadow-md cursor-pointer",
          isSelected && "ring-2 ring-primary"
        )}
        onClick={handleCardClick}
      >
        <CardContent className="flex items-center justify-between p-6">
          <div className="flex items-center gap-4">
            {showCheckbox && (
              <input
                type="checkbox"
                checked={isSelected}
                onChange={handleCheckboxChange}
                className="h-5 w-5 rounded border-gray-300"
                onClick={(e) => e.stopPropagation()}
              />
            )}
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <Layers className="h-6 w-6 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">{platform.name}</h3>
                <Badge variant={platform.enabled ? 'success' : 'secondary'}>
                  {platform.enabled ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{platform.layer}</p>
              {platform.description && (
                <p className="text-sm text-muted-foreground mt-1">
                  {platform.description}
                </p>
              )}
            </div>
          </div>

          {showMetrics && (
            <div className="flex gap-6 text-sm">
              <div className="text-center">
                <div className="text-muted-foreground">Surfaces</div>
                <div className="text-2xl font-bold">{surfaceCount}</div>
              </div>
              <div className="text-center">
                <div className="text-muted-foreground">Workflows</div>
                <div className="text-2xl font-bold">{workflowCount}</div>
              </div>
              <div className="text-center">
                <div className="text-muted-foreground">Agents</div>
                <div className="text-2xl font-bold">{agentCount}</div>
              </div>
            </div>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onClone}>
                <Copy className="mr-2 h-4 w-4" />
                Clone
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card
      className={cn(
        'transition-all hover:shadow-lg cursor-pointer h-full',
        'group',
        isSelected && "ring-2 ring-primary"
      )}
      onClick={handleCardClick}
    >
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {showCheckbox && (
              <input
                type="checkbox"
                checked={isSelected}
                onChange={handleCheckboxChange}
                className="h-5 w-5 rounded border-gray-300 mt-1"
                onClick={(e) => e.stopPropagation()}
              />
            )}
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Layers className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">{platform.name}</CardTitle>
              <CardDescription>{platform.layer}</CardDescription>
            </div>
          </div>
          <Badge variant={platform.enabled ? 'success' : 'secondary'}>
            {platform.enabled ? 'Active' : 'Inactive'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {platform.description && (
          <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
            {platform.description}
          </p>
        )}
        {showMetrics && (
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="text-center">
              <div className="text-muted-foreground">Surfaces</div>
              <div className="text-2xl font-bold">{surfaceCount}</div>
            </div>
            <div className="text-center">
              <div className="text-muted-foreground">Workflows</div>
              <div className="text-2xl font-bold">{workflowCount}</div>
            </div>
            <div className="text-center">
              <div className="text-muted-foreground">Agents</div>
              <div className="text-2xl font-bold">{agentCount}</div>
            </div>
          </div>
        )}
        {platform.created_at && (
          <p className="text-xs text-muted-foreground mt-4">
            Created {new Date(platform.created_at).toLocaleDateString()}
          </p>
        )}
      </CardContent>
      <CardFooter className="gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="outline" size="sm" onClick={onEdit} className="flex-1">
          <Edit className="h-4 w-4 mr-1" /> Edit
        </Button>
        <Button variant="outline" size="sm" onClick={onClone} className="flex-1">
          <Copy className="h-4 w-4 mr-1" /> Clone
        </Button>
        <Button variant="outline" size="sm" onClick={onDelete} className="flex-1">
          <Trash2 className="h-4 w-4 mr-1" /> Delete
        </Button>
      </CardFooter>
    </Card>
  )
}
