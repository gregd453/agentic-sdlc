/**
 * SurfaceConfigModal - Enable/disable surfaces for a platform
 * Part of Phase 5: Dashboard Components
 *
 * Allows platform administrators to:
 * - Enable/disable surfaces (REST, WEBHOOK, CLI, DASHBOARD, MOBILE_API)
 * - Configure surface-specific settings (rate limits, auth, etc.)
 * - Persist configuration to database via Phase 4 Surface API
 */

import { useState, useEffect } from 'react'
import { BaseModal } from '../Common/BaseModal'
import {
  getPlatformSurfaces,
  enablePlatformSurface,
  disablePlatformSurface
} from '../../api/client'

export interface SurfaceConfigModalProps {
  isOpen: boolean
  onClose: () => void
  platformId: string
  platformName: string
}

type SurfaceType = 'REST' | 'WEBHOOK' | 'CLI' | 'DASHBOARD' | 'MOBILE_API'

interface SurfaceState {
  type: SurfaceType
  enabled: boolean
  config: string
  modified: boolean
}

const SURFACE_TYPES: Array<{ type: SurfaceType; label: string; description: string }> = [
  {
    type: 'REST',
    label: 'REST API',
    description: 'RESTful HTTP API access'
  },
  {
    type: 'WEBHOOK',
    label: 'GitHub Webhook',
    description: 'Event-driven webhook triggers'
  },
  {
    type: 'CLI',
    label: 'CLI',
    description: 'Command-line interface'
  },
  {
    type: 'DASHBOARD',
    label: 'Dashboard',
    description: 'Web-based dashboard UI'
  },
  {
    type: 'MOBILE_API',
    label: 'Mobile API',
    description: 'Mobile-optimized API'
  }
]

const DEFAULT_CONFIGS: Record<SurfaceType, string> = {
  REST: JSON.stringify({ rateLimit: 100 }, null, 2),
  WEBHOOK: JSON.stringify({ verifySignature: true, retries: 3 }, null, 2),
  CLI: JSON.stringify({ offlineMode: false }, null, 2),
  DASHBOARD: JSON.stringify({ theme: 'dark' }, null, 2),
  MOBILE_API: JSON.stringify({ compression: 'gzip', offlineSync: true }, null, 2)
}

/**
 * SurfaceConfigModal Component
 *
 * Features:
 * - Checkbox toggle for each surface type
 * - JSON config editor for each enabled surface
 * - Real-time validation of JSON syntax
 * - Persists changes to database
 */
export default function SurfaceConfigModal({
  isOpen,
  onClose,
  platformId,
  platformName
}: SurfaceConfigModalProps) {
  const [surfaces, setSurfaces] = useState<Map<SurfaceType, SurfaceState>>(new Map())
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Load current surfaces from API
  useEffect(() => {
    if (isOpen && platformId) {
      loadSurfaces()
    }
  }, [isOpen, platformId])

  const loadSurfaces = async () => {
    setLoading(true)
    setError(null)

    try {
      const platformSurfaces = await getPlatformSurfaces(platformId)

      // Create a map of surface states
      const newSurfaces = new Map<SurfaceType, SurfaceState>()

      SURFACE_TYPES.forEach(({ type }) => {
        const existing = platformSurfaces.find(s => s.surface_type === type)

        newSurfaces.set(type, {
          type,
          enabled: existing?.enabled ?? false,
          config: existing?.config
            ? JSON.stringify(existing.config, null, 2)
            : DEFAULT_CONFIGS[type],
          modified: false
        })
      })

      setSurfaces(newSurfaces)
    } catch (err: any) {
      setError(err.message || 'Failed to load surfaces')
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = (type: SurfaceType) => {
    const surface = surfaces.get(type)
    if (!surface) return

    const newSurfaces = new Map(surfaces)
    newSurfaces.set(type, {
      ...surface,
      enabled: !surface.enabled,
      modified: true
    })
    setSurfaces(newSurfaces)
    setError(null)
  }

  const handleConfigChange = (type: SurfaceType, newConfig: string) => {
    const surface = surfaces.get(type)
    if (!surface) return

    const newSurfaces = new Map(surfaces)
    newSurfaces.set(type, {
      ...surface,
      config: newConfig,
      modified: true
    })
    setSurfaces(newSurfaces)
    setError(null)
  }

  const validateConfig = (config: string): { valid: boolean; error?: string } => {
    if (!config.trim()) {
      return { valid: true } // Empty is valid
    }

    try {
      JSON.parse(config)
      return { valid: true }
    } catch (err: any) {
      return { valid: false, error: `Invalid JSON: ${err.message}` }
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSuccess(false)

    try {
      // Validate all configs first
      for (const [type, surface] of surfaces.entries()) {
        if (surface.enabled && surface.config) {
          const validation = validateConfig(surface.config)
          if (!validation.valid) {
            setError(`${type}: ${validation.error}`)
            setSaving(false)
            return
          }
        }
      }

      // Save each modified surface
      const promises: Promise<any>[] = []

      for (const [type, surface] of surfaces.entries()) {
        if (!surface.modified) continue

        const configObj = surface.config.trim()
          ? JSON.parse(surface.config)
          : {}

        if (surface.enabled) {
          // Enable/update surface
          promises.push(
            enablePlatformSurface(platformId, {
              surface_type: type,
              config: configObj,
              enabled: true
            })
          )
        } else {
          // Disable surface (if it exists)
          promises.push(
            disablePlatformSurface(platformId, type).catch(err => {
              // Ignore 404 errors (surface doesn't exist)
              if (!err.message.includes('404') && !err.message.includes('not found')) {
                throw err
              }
            })
          )
        }
      }

      await Promise.all(promises)

      setSuccess(true)

      // Close modal after brief delay
      setTimeout(() => {
        onClose()
        setSuccess(false)
      }, 1500)
    } catch (err: any) {
      setError(err.message || 'Failed to save surface configuration')
    } finally {
      setSaving(false)
    }
  }

  const hasModifications = Array.from(surfaces.values()).some(s => s.modified)

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Configure Platform Surfaces"
      subtitle={`Platform: ${platformName}`}
      size="large"
      isLoading={loading || saving}
      error={error}
      success={success}
      successMessage="Surface configuration saved successfully!"
      submitLabel="Save Configuration"
      onSubmit={handleSave}
    >
      <div className="space-y-6">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Enable or disable surfaces for this platform. Each surface can have custom configuration.
        </p>

        {SURFACE_TYPES.map(({ type, label, description }) => {
          const surface = surfaces.get(type)
          if (!surface) return null

          return (
            <div key={type} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              {/* Surface Toggle */}
              <div className="flex items-start gap-3 mb-3">
                <input
                  type="checkbox"
                  id={`surface-${type}`}
                  checked={surface.enabled}
                  onChange={() => handleToggle(type)}
                  disabled={loading || saving}
                  className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 disabled:opacity-50"
                />
                <label
                  htmlFor={`surface-${type}`}
                  className="flex-1 cursor-pointer select-none"
                >
                  <div className="font-medium text-gray-900 dark:text-white">
                    {label}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {description}
                  </div>
                </label>
              </div>

              {/* Config Editor (shown when enabled) */}
              {surface.enabled && (
                <div className="mt-3 ml-7">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Configuration (JSON)
                  </label>
                  <textarea
                    value={surface.config}
                    onChange={(e) => handleConfigChange(type, e.target.value)}
                    disabled={loading || saving}
                    rows={5}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg font-mono text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                    placeholder={DEFAULT_CONFIGS[type]}
                  />
                  {surface.config && !validateConfig(surface.config).valid && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                      {validateConfig(surface.config).error}
                    </p>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {!hasModifications && (
          <p className="text-sm text-gray-500 dark:text-gray-400 italic">
            Make changes above to enable the Save button
          </p>
        )}
      </div>
    </BaseModal>
  )
}
