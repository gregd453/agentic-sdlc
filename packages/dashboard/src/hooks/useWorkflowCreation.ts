import { WORKFLOW_TYPES, TASK_PRIORITY } from "@agentic-sdlc/shared-types"
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

interface WorkflowFormData {
  name: string
  description: string
  type: WORKFLOW_TYPES.APP | WORKFLOW_TYPES.FEATURE | WORKFLOW_TYPES.BUGFIX
  priority: TASK_PRIORITY.LOW | TASK_PRIORITY.MEDIUM | TASK_PRIORITY.HIGH | TASK_PRIORITY.CRITICAL
  platformId?: string
}

const API_BASE = '/api/v1'

/**
 * Custom hook for workflow creation form handling
 * Manages form state, validation, API calls, and navigation
 */
export function useWorkflowCreation() {
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState<WorkflowFormData>({
    name: '',
    description: '',
    type: WORKFLOW_TYPES.FEATURE,
    priority: TASK_PRIORITY.MEDIUM
  })

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const validateForm = (): boolean => {
    if (!formData.name.trim()) {
      setError('Workflow name is required')
      return false
    }
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    try {
      setIsSubmitting(true)
      setError(null)

      const response = await fetch(`${API_BASE}/workflows`, {
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

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      type: WORKFLOW_TYPES.FEATURE,
      priority: TASK_PRIORITY.MEDIUM
    })
    setError(null)
  }

  return {
    formData,
    isSubmitting,
    error,
    handleInputChange,
    handleSubmit,
    resetForm,
    setError
  }
}
