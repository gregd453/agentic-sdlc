import { useQuery } from '@tanstack/react-query'
import { fetchWorkflows, fetchWorkflow, fetchWorkflowTasks, fetchWorkflowTimeline } from '../api/client'

export function useWorkflows(filters?: {
  status?: string
  type?: string
  priority?: string
}, refetchInterval: number = 5000) {
  return useQuery({
    queryKey: ['workflows', filters],
    queryFn: () => fetchWorkflows(filters),
    refetchInterval,
  })
}

export function useWorkflow(id: string | undefined, refetchInterval: number = 5000) {
  return useQuery({
    queryKey: ['workflow', id],
    queryFn: () => {
      if (!id) throw new Error('Workflow ID is required')
      return fetchWorkflow(id)
    },
    enabled: !!id,
    refetchInterval: id ? refetchInterval : false,
  })
}

export function useWorkflowTasks(id: string | undefined, refetchInterval: number = 5000) {
  return useQuery({
    queryKey: ['workflow', id, 'tasks'],
    queryFn: () => {
      if (!id) throw new Error('Workflow ID is required')
      return fetchWorkflowTasks(id)
    },
    enabled: !!id,
    refetchInterval: id ? refetchInterval : false,  // Session #82: Enable polling to detect task changes
  })
}

/**
 * Fetch workflow timeline (tasks and events)
 * @note Currently disabled - backend timeline endpoint not yet implemented
 * When available, enable by setting enabled: true or add conditional logic
 */
export function useWorkflowTimeline(id: string | undefined) {
  return useQuery({
    queryKey: ['workflow', id, 'timeline'],
    queryFn: () => {
      if (!id) throw new Error('Workflow ID is required')
      return fetchWorkflowTimeline(id)
    },
    enabled: false, // Disabled until backend timeline endpoint is implemented
    refetchInterval: false,
  })
}
