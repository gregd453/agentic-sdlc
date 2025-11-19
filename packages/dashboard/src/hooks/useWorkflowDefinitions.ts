import { useState, useCallback, useEffect } from 'react'
import {
  fetchWorkflowDefinitions,
  fetchWorkflowDefinition,
  createWorkflowDefinition,
  updateWorkflowDefinition,
  deleteWorkflowDefinition,
  setWorkflowDefinitionEnabled,
  WorkflowDefinition,
  CreateWorkflowDefinitionRequest,
  UpdateWorkflowDefinitionRequest
} from '../api/client'

interface UseWorkflowDefinitionsOptions {
  platformId?: string
  autoFetch?: boolean
  includeDisabled?: boolean
}

export function useWorkflowDefinitions(options: UseWorkflowDefinitionsOptions = {}) {
  const { platformId, autoFetch = true, includeDisabled = false } = options
  const [definitions, setDefinitions] = useState<WorkflowDefinition[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch all definitions for a platform
  const fetchDefinitions = useCallback(async (id: string) => {
    if (!id) return

    setLoading(true)
    setError(null)
    try {
      const defs = await fetchWorkflowDefinitions(id, includeDisabled)
      setDefinitions(defs)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch workflow definitions'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [includeDisabled])

  // Create new definition
  const createDefinition = useCallback(async (id: string, data: CreateWorkflowDefinitionRequest) => {
    try {
      const newDef = await createWorkflowDefinition(id, data)
      setDefinitions(prev => [newDef, ...prev])
      return newDef
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create workflow definition'
      setError(message)
      throw err
    }
  }, [])

  // Update definition
  const updateDefinition = useCallback(async (id: string, data: UpdateWorkflowDefinitionRequest) => {
    try {
      const updated = await updateWorkflowDefinition(id, data)
      setDefinitions(prev => prev.map(d => d.id === id ? updated : d))
      return updated
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update workflow definition'
      setError(message)
      throw err
    }
  }, [])

  // Delete definition
  const deleteDefinition = useCallback(async (id: string) => {
    try {
      await deleteWorkflowDefinition(id)
      setDefinitions(prev => prev.filter(d => d.id !== id))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete workflow definition'
      setError(message)
      throw err
    }
  }, [])

  // Toggle enabled status
  const toggleEnabled = useCallback(async (id: string, enabled: boolean) => {
    try {
      const updated = await setWorkflowDefinitionEnabled(id, enabled)
      setDefinitions(prev => prev.map(d => d.id === id ? updated : d))
      return updated
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update workflow definition status'
      setError(message)
      throw err
    }
  }, [])

  // Auto-fetch on mount or when platformId changes
  useEffect(() => {
    if (autoFetch && platformId) {
      fetchDefinitions(platformId)
    }
  }, [platformId, autoFetch, fetchDefinitions])

  return {
    definitions,
    loading,
    error,
    refetch: () => platformId && fetchDefinitions(platformId),
    create: createDefinition,
    update: updateDefinition,
    delete: deleteDefinition,
    toggleEnabled
  }
}

// Single definition hook
export function useWorkflowDefinition(id?: string) {
  const [definition, setDefinition] = useState<WorkflowDefinition | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async (definitionId: string) => {
    setLoading(true)
    setError(null)
    try {
      const def = await fetchWorkflowDefinition(definitionId)
      setDefinition(def)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch workflow definition'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (id) {
      fetch(id)
    }
  }, [id, fetch])

  return {
    definition,
    loading,
    error,
    refetch: () => id && fetch(id)
  }
}
