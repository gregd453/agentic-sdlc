/**
 * PlatformFormModal - Create/Edit platform modal
 * Allows users to create new platforms or edit existing ones
 */

import { useState, useEffect } from 'react'

export interface Platform {
  id?: string
  name: string
  layer: 'APPLICATION' | 'DATA' | 'INFRASTRUCTURE' | 'ENTERPRISE' | string
  description?: string | null
  config?: Record<string, any>
  enabled: boolean
  created_at?: string
  updated_at?: string
}

interface PlatformFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (platform: Partial<Platform>) => Promise<void>
  platform?: Platform | null
  isLoading?: boolean
  error?: string | null
}

const PLATFORM_LAYERS = [
  { value: 'APPLICATION', label: 'Application Layer' },
  { value: 'DATA', label: 'Data Layer' },
  { value: 'INFRASTRUCTURE', label: 'Infrastructure Layer' },
  { value: 'ENTERPRISE', label: 'Enterprise Layer' }
]

export default function PlatformFormModal({
  isOpen,
  onClose,
  onSave,
  platform,
  isLoading = false,
  error: externalError = null
}: PlatformFormModalProps) {
  const [name, setName] = useState('')
  const [layer, setLayer] = useState<'APPLICATION' | 'DATA' | 'INFRASTRUCTURE' | 'ENTERPRISE'>('APPLICATION')
  const [description, setDescription] = useState('')
  const [config, setConfig] = useState('{}')
  const [enabled, setEnabled] = useState(true)
  const [localError, setLocalError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [saving, setSaving] = useState(false)

  const isEdit = !!platform
  const error = externalError || localError

  // Populate form when platform is provided (edit mode)
  useEffect(() => {
    if (platform) {
      setName(platform.name)
      setLayer(platform.layer as 'APPLICATION' | 'DATA' | 'INFRASTRUCTURE' | 'ENTERPRISE')
      setDescription(platform.description || '')
      setConfig(JSON.stringify(platform.config || {}, null, 2))
      setEnabled(platform.enabled)
    } else {
      // Reset form for create mode
      setName('')
      setLayer('APPLICATION')
      setDescription('')
      setConfig('{}')
      setEnabled(true)
    }
    setLocalError(null)
    setSuccess(false)
  }, [platform, isOpen])

  const handleSave = async () => {
    setLocalError(null)
    setSuccess(false)

    // Validation
    if (!name.trim()) {
      setLocalError('Platform name is required')
      return
    }

    if (!layer) {
      setLocalError('Platform layer is required')
      return
    }

    // Validate config is valid JSON
    let configObj: Record<string, any> = {}
    try {
      configObj = config.trim() ? JSON.parse(config) : {}
    } catch {
      setLocalError('Configuration must be valid JSON')
      return
    }

    setSaving(true)

    try {
      await onSave({
        name: name.trim(),
        layer,
        description: description.trim() || null,
        config: configObj,
        enabled
      })

      setSuccess(true)
      setTimeout(() => {
        onClose()
      }, 1000)
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to save platform')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-md w-full mx-4">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {isEdit ? 'Edit Platform' : 'Create New Platform'}
          </h2>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          {/* Error message */}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded text-red-700 dark:text-red-200 text-sm">
              {error}
            </div>
          )}

          {/* Success message */}
          {success && (
            <div className="p-3 bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-700 rounded text-green-700 dark:text-green-200 text-sm">
              Platform {isEdit ? 'updated' : 'created'} successfully!
            </div>
          )}

          {/* Platform name field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Platform Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Web Application"
              disabled={saving || isLoading}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
            />
          </div>

          {/* Layer field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Platform Layer <span className="text-red-500">*</span>
            </label>
            <select
              value={layer}
              onChange={(e) => setLayer(e.target.value as any)}
              disabled={saving || isLoading}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
            >
              {PLATFORM_LAYERS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Description field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this platform"
              rows={3}
              disabled={saving || isLoading}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 dark:disabled:bg-gray-600 disabled:cursor-not-allowed resize-none"
            />
          </div>

          {/* Configuration field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Configuration (JSON)
            </label>
            <textarea
              value={config}
              onChange={(e) => setConfig(e.target.value)}
              placeholder="{}"
              rows={4}
              disabled={saving || isLoading}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm disabled:bg-gray-100 dark:disabled:bg-gray-600 disabled:cursor-not-allowed resize-none"
            />
          </div>

          {/* Enabled toggle */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="enabled"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              disabled={saving || isLoading}
              className="h-4 w-4 border-gray-300 rounded text-blue-600 focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed"
            />
            <label htmlFor="enabled" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
              Platform Enabled
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={saving || isLoading}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || isLoading}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {saving || isLoading ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                Saving...
              </>
            ) : (
              <>{isEdit ? 'Update Platform' : 'Create Platform'}</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
