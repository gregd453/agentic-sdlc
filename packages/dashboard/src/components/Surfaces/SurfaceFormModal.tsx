import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { PlatformSurface } from '../../api/surfaces'
import type { Platform } from '../../api/client'

interface SurfaceFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: SurfaceFormData) => Promise<void>
  platforms: Platform[]
  surface?: PlatformSurface
  isLoading?: boolean
  error?: string | null
}

export interface SurfaceFormData {
  platform_id: string
  surface_type: 'REST' | 'WEBHOOK' | 'CLI' | 'DASHBOARD' | 'MOBILE_API'
  config: Record<string, any>
  enabled: boolean
}

const surfaceTypeTemplates = {
  REST: {
    name: 'REST API',
    description: 'RESTful HTTP API endpoint',
    defaultConfig: {
      base_url: 'https://api.example.com',
      auth_type: 'bearer',
      rate_limit: 100,
      timeout_ms: 30000,
    },
    fields: [
      { key: 'base_url', label: 'Base URL', type: 'text', required: true },
      { key: 'auth_type', label: 'Auth Type', type: 'select', options: ['none', 'bearer', 'api_key', 'oauth2'] },
      { key: 'rate_limit', label: 'Rate Limit (req/min)', type: 'number' },
      { key: 'timeout_ms', label: 'Timeout (ms)', type: 'number' },
    ],
  },
  WEBHOOK: {
    name: 'Webhook',
    description: 'HTTP webhook receiver',
    defaultConfig: {
      endpoint: '/webhooks/incoming',
      secret: '',
      verify_signature: true,
      retry_policy: 'exponential',
    },
    fields: [
      { key: 'endpoint', label: 'Endpoint Path', type: 'text', required: true },
      { key: 'secret', label: 'Webhook Secret', type: 'password' },
      { key: 'verify_signature', label: 'Verify Signature', type: 'checkbox' },
      { key: 'retry_policy', label: 'Retry Policy', type: 'select', options: ['none', 'linear', 'exponential'] },
    ],
  },
  CLI: {
    name: 'CLI',
    description: 'Command-line interface',
    defaultConfig: {
      command: 'agentic',
      install_path: '/usr/local/bin',
      shell: 'bash',
    },
    fields: [
      { key: 'command', label: 'Command Name', type: 'text', required: true },
      { key: 'install_path', label: 'Install Path', type: 'text' },
      { key: 'shell', label: 'Shell', type: 'select', options: ['bash', 'zsh', 'fish', 'powershell'] },
    ],
  },
  DASHBOARD: {
    name: 'Dashboard',
    description: 'Web-based dashboard UI',
    defaultConfig: {
      url: 'https://dashboard.example.com',
      port: 3000,
      theme: 'auto',
    },
    fields: [
      { key: 'url', label: 'Dashboard URL', type: 'text', required: true },
      { key: 'port', label: 'Port', type: 'number' },
      { key: 'theme', label: 'Theme', type: 'select', options: ['light', 'dark', 'auto'] },
    ],
  },
  MOBILE_API: {
    name: 'Mobile API',
    description: 'Mobile app API endpoint',
    defaultConfig: {
      base_url: 'https://api.mobile.example.com',
      version: 'v1',
      platform: 'ios',
    },
    fields: [
      { key: 'base_url', label: 'Base URL', type: 'text', required: true },
      { key: 'version', label: 'API Version', type: 'text' },
      { key: 'platform', label: 'Platform', type: 'select', options: ['ios', 'android', 'both'] },
    ],
  },
}

export const SurfaceFormModal: React.FC<SurfaceFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  platforms,
  surface,
  isLoading = false,
  error = null,
}) => {
  const [formData, setFormData] = useState<SurfaceFormData>({
    platform_id: '',
    surface_type: 'REST',
    config: {},
    enabled: true,
  })
  const [configMode, setConfigMode] = useState<'form' | 'json'>('form')
  const [jsonConfig, setJsonConfig] = useState('')

  useEffect(() => {
    if (surface) {
      // Edit mode
      setFormData({
        platform_id: surface.platform_id,
        surface_type: surface.surface_type,
        config: surface.config || {},
        enabled: surface.enabled,
      })
      setJsonConfig(JSON.stringify(surface.config || {}, null, 2))
    } else {
      // Create mode - use template defaults
      const template = surfaceTypeTemplates[formData.surface_type]
      setFormData({
        ...formData,
        config: template.defaultConfig,
      })
      setJsonConfig(JSON.stringify(template.defaultConfig, null, 2))
    }
  }, [surface, isOpen])

  const handleSurfaceTypeChange = (type: string) => {
    const surfaceType = type as SurfaceFormData['surface_type']
    const template = surfaceTypeTemplates[surfaceType]
    setFormData({
      ...formData,
      surface_type: surfaceType,
      config: template.defaultConfig,
    })
    setJsonConfig(JSON.stringify(template.defaultConfig, null, 2))
  }

  const handleConfigFieldChange = (key: string, value: any) => {
    const newConfig = { ...formData.config, [key]: value }
    setFormData({ ...formData, config: newConfig })
    setJsonConfig(JSON.stringify(newConfig, null, 2))
  }

  const handleJsonConfigChange = (value: string) => {
    setJsonConfig(value)
    try {
      const parsed = JSON.parse(value)
      setFormData({ ...formData, config: parsed })
    } catch (err) {
      // Invalid JSON, don't update formData
    }
  }

  const handleSubmit = async () => {
    try {
      await onSave(formData)
    } catch (err) {
      // Error handled by parent
    }
  }

  const template = surfaceTypeTemplates[formData.surface_type]

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{surface ? 'Edit Surface' : 'Create New Surface'}</DialogTitle>
          <DialogDescription>
            {surface ? 'Update surface configuration' : 'Configure a new platform surface'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Platform Selection */}
          <div className="space-y-2">
            <Label htmlFor="platform">Platform *</Label>
            <Select
              value={formData.platform_id}
              onValueChange={(value) => setFormData({ ...formData, platform_id: value })}
              disabled={!!surface}
            >
              <SelectTrigger id="platform">
                <SelectValue placeholder="Select a platform" />
              </SelectTrigger>
              <SelectContent>
                {platforms.map((platform) => (
                  <SelectItem key={platform.id} value={platform.id}>
                    {platform.name} ({platform.layer})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Surface Type */}
          <div className="space-y-2">
            <Label htmlFor="type">Surface Type *</Label>
            <Select
              value={formData.surface_type}
              onValueChange={handleSurfaceTypeChange}
              disabled={!!surface}
            >
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(surfaceTypeTemplates).map(([key, template]) => (
                  <SelectItem key={key} value={key}>
                    {template.name} - {template.description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Configuration */}
          <div className="space-y-2">
            <Label>Configuration</Label>
            <Tabs value={configMode} onValueChange={(value) => setConfigMode(value as 'form' | 'json')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="form">Form</TabsTrigger>
                <TabsTrigger value="json">JSON</TabsTrigger>
              </TabsList>

              <TabsContent value="form" className="space-y-4 mt-4">
                {template.fields.map((field) => (
                  <div key={field.key} className="space-y-2">
                    <Label htmlFor={field.key}>
                      {field.label} {field.required && '*'}
                    </Label>
                    {field.type === 'text' || field.type === 'password' ? (
                      <Input
                        id={field.key}
                        type={field.type}
                        value={formData.config[field.key] || ''}
                        onChange={(e) => handleConfigFieldChange(field.key, e.target.value)}
                        required={field.required}
                      />
                    ) : field.type === 'number' ? (
                      <Input
                        id={field.key}
                        type="number"
                        value={formData.config[field.key] || ''}
                        onChange={(e) => handleConfigFieldChange(field.key, parseInt(e.target.value))}
                      />
                    ) : field.type === 'checkbox' ? (
                      <div className="flex items-center">
                        <input
                          id={field.key}
                          type="checkbox"
                          checked={formData.config[field.key] || false}
                          onChange={(e) => handleConfigFieldChange(field.key, e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                      </div>
                    ) : field.type === 'select' && field.options ? (
                      <Select
                        value={formData.config[field.key] || field.options[0]}
                        onValueChange={(value) => handleConfigFieldChange(field.key, value)}
                      >
                        <SelectTrigger id={field.key}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {field.options.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : null}
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="json" className="mt-4">
                <textarea
                  value={jsonConfig}
                  onChange={(e) => handleJsonConfigChange(e.target.value)}
                  className="w-full h-64 p-3 font-mono text-sm border rounded-md bg-background"
                  placeholder='{"key": "value"}'
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Edit configuration as JSON. Invalid JSON will not be saved.
                </p>
              </TabsContent>
            </Tabs>
          </div>

          {/* Enabled Toggle */}
          <div className="flex items-center space-x-2">
            <input
              id="enabled"
              type="checkbox"
              checked={formData.enabled}
              onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="enabled">Enable surface immediately</Label>
          </div>

          {/* Error Display */}
          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading || !formData.platform_id}>
            {isLoading ? 'Saving...' : surface ? 'Update Surface' : 'Create Surface'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
