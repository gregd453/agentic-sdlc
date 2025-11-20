/**
 * Workflow Definitions API - Handles workflow definition management
 * Part of modularized API client
 */

import { getAPIBase } from './client'

const API_BASE = getAPIBase()

// Types
export interface WorkflowDefinition {
  id: string
  platform_id: string
  name: string
  version: string
  description?: string | null
  definition: Record<string, any>
  enabled: boolean
  created_at: string
  updated_at: string
}

export interface CreateWorkflowDefinitionRequest {
  name: string
  version?: string
  description?: string
  definition: Record<string, any>
}

export interface UpdateWorkflowDefinitionRequest {
  name?: string
  version?: string
  description?: string
  definition?: Record<string, any>
  enabled?: boolean
}

// Create Definition
export async function createWorkflowDefinition(
  platformId: string,
  data: CreateWorkflowDefinitionRequest
): Promise<WorkflowDefinition> {
  const response = await fetch(`${API_BASE}/platforms/${platformId}/workflow-definitions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  return response.json()
}

// Read Definition
export async function fetchWorkflowDefinition(id: string): Promise<WorkflowDefinition> {
  const response = await fetch(`${API_BASE}/workflow-definitions/${id}`)
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  return response.json()
}

// List Definitions
export async function fetchWorkflowDefinitions(
  platformId: string,
  includeDisabled: boolean = false
): Promise<WorkflowDefinition[]> {
  const params = new URLSearchParams()
  if (includeDisabled) params.append('includeDisabled', 'true')

  const url = `${API_BASE}/platforms/${platformId}/workflow-definitions${
    params.toString() ? `?${params}` : ''
  }`

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  return response.json()
}

// Update Definition
export async function updateWorkflowDefinition(
  id: string,
  data: UpdateWorkflowDefinitionRequest
): Promise<WorkflowDefinition> {
  const response = await fetch(`${API_BASE}/workflow-definitions/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  return response.json()
}

// Delete Definition
export async function deleteWorkflowDefinition(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/workflow-definitions/${id}`, {
    method: 'DELETE'
  })

  if (!response.ok && response.status !== 204) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
}

// Set Definition Enabled Status
export async function setWorkflowDefinitionEnabled(
  id: string,
  enabled: boolean
): Promise<WorkflowDefinition> {
  const response = await fetch(`${API_BASE}/workflow-definitions/${id}/enabled`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled })
  })

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  return response.json()
}
