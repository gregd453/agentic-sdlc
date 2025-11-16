import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchPlatforms } from '../api/client'
import LoadingSpinner from '../components/Common/LoadingSpinner'
import ErrorDisplay from '../components/Common/ErrorDisplay'
import PageTransition from '../components/Animations/PageTransition'

interface Platform {
  id: string
  name: string
  layer: string
  description?: string
  enabled: boolean
  created_at?: string
  updated_at?: string
}

interface WorkflowFormData {
  name: string
  description: string
  type: 'app' | 'feature' | 'bugfix'
  priority: 'low' | 'medium' | 'high' | 'critical'
  platformId?: string
}

export const WorkflowBuilderPage: React.FC = () => {
  const navigate = useNavigate()
  const [platforms, setPlatforms] = useState<Platform[]>([])
  const [isLoadingPlatforms, setIsLoadingPlatforms] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState<WorkflowFormData>({
    name: '',
    description: '',
    type: 'feature',
    priority: 'medium'
  })

  React.useEffect(() => {
    loadPlatforms()
  }, [])

  const loadPlatforms = async () => {
    try {
      setIsLoadingPlatforms(true)
      const data = await fetchPlatforms()
      setPlatforms(data.filter(p => p.enabled))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load platforms')
    } finally {
      setIsLoadingPlatforms(false)
    }
  }

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate form
    if (!formData.name.trim()) {
      setError('Workflow name is required')
      return
    }

    try {
      setIsSubmitting(true)
      setError(null)

      // Create workflow via API
      const response = await fetch('http://localhost:3000/api/v1/workflows', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          type: formData.type,
          priority: formData.priority,
          platform_id: formData.platformId || null
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to create workflow: ${response.statusText}`)
      }

      const result = await response.json()

      // Navigate to the new workflow
      navigate(`/workflows/${result.id || result.workflow_id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create workflow')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoadingPlatforms) {
    return <LoadingSpinner />
  }

  return (
    <PageTransition>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Create Workflow</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Define a new workflow to automate your software development lifecycle
          </p>
        </div>

        {error && <ErrorDisplay error={error} retry={() => setError(null)} />}

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-8 space-y-6">

          {/* Workflow Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Workflow Name *
            </label>
            <input
              id="name"
              name="name"
              type="text"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="e.g., Build User Dashboard"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:focus:ring-blue-400 transition-colors"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Describe what this workflow will do..."
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:focus:ring-blue-400 transition-colors"
            />
          </div>

          {/* Workflow Type */}
          <div>
            <label htmlFor="type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Workflow Type *
            </label>
            <select
              id="type"
              name="type"
              value={formData.type}
              onChange={handleInputChange}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:focus:ring-blue-400 transition-colors"
            >
              <option value="app">New Application</option>
              <option value="feature">New Feature</option>
              <option value="bugfix">Bug Fix</option>
            </select>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Different types follow different workflow stages
            </p>
          </div>

          {/* Priority */}
          <div>
            <label htmlFor="priority" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Priority *
            </label>
            <select
              id="priority"
              name="priority"
              value={formData.priority}
              onChange={handleInputChange}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:focus:ring-blue-400 transition-colors"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          {/* Platform Selection */}
          {platforms.length > 0 && (
            <div>
              <label htmlFor="platformId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Target Platform (Optional)
              </label>
              <select
                id="platformId"
                name="platformId"
                value={formData.platformId || ''}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:focus:ring-blue-400 transition-colors"
              >
                <option value="">Auto-detect Platform</option>
                {platforms.map(platform => (
                  <option key={platform.id} value={platform.id}>
                    {platform.name} ({platform.layer.charAt(0) + platform.layer.slice(1).toLowerCase()})
                  </option>
                ))}
              </select>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Select a specific platform or leave blank for auto-detection
              </p>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors"
            >
              {isSubmitting ? 'Creating...' : 'Create Workflow'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/workflows')}
              className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-medium rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>

        {/* Info Panel */}
        <div className="bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-lg p-4 space-y-2">
          <h3 className="font-semibold text-blue-900 dark:text-blue-100">How Workflows Work</h3>
          <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
            <li><strong>New Application:</strong> Complete development lifecycle with 8 stages (scaffold, validate, e2e, integration, deployment, etc.)</li>
            <li><strong>New Feature:</strong> Feature development with 5 stages (design, develop, test, review, deploy)</li>
            <li><strong>Bug Fix:</strong> Quick fix workflow with 3 stages (analyze, fix, verify)</li>
            <li><strong>Platform:</strong> Optionally select a platform to apply platform-specific routing and configuration</li>
          </ul>
        </div>
      </div>
    </PageTransition>
  )
}
