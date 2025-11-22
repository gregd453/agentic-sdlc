/**
 * Platform Surfaces API - Handles platform surface management
 * Part of modularized API client
 *
 * Connects to Phase 4 Surface Binding Enforcement backend
 */

import { getAPIBase } from './client'

// Types
export interface PlatformSurface {
  id: string
  platform_id: string
  surface_type: 'REST' | 'WEBHOOK' | 'CLI' | 'DASHBOARD' | 'MOBILE_API'
  config?: Record<string, any>
  enabled: boolean
  created_at: string
  updated_at: string
}

export interface EnablePlatformSurfaceRequest {
  surface_type: 'REST' | 'WEBHOOK' | 'CLI' | 'DASHBOARD' | 'MOBILE_API'
  config?: Record<string, any>
  enabled?: boolean
}

export interface UpdatePlatformSurfaceRequest {
  config?: Record<string, any>
  enabled?: boolean
}

// List Surfaces
export async function getPlatformSurfaces(platformId: string): Promise<PlatformSurface[]> {
  const response = await fetch(`${getAPIBase()}/platforms/${platformId}/surfaces`)

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  return response.json()
}

// Enable/Create Surface
export async function enablePlatformSurface(
  platformId: string,
  data: EnablePlatformSurfaceRequest
): Promise<PlatformSurface> {
  const response = await fetch(`${getAPIBase()}/platforms/${platformId}/surfaces`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to enable surface' }))
    throw new Error(error.error || 'Failed to enable surface')
  }

  return response.json()
}

// Update Surface
export async function updatePlatformSurface(
  platformId: string,
  surfaceType: string,
  data: UpdatePlatformSurfaceRequest
): Promise<PlatformSurface> {
  const response = await fetch(`${getAPIBase()}/platforms/${platformId}/surfaces/${surfaceType}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to update surface' }))
    throw new Error(error.error || 'Failed to update surface')
  }

  return response.json()
}

// Disable Surface
export async function disablePlatformSurface(
  platformId: string,
  surfaceType: string
): Promise<void> {
  const response = await fetch(`${getAPIBase()}/platforms/${platformId}/surfaces/${surfaceType}`, {
    method: 'DELETE'
  })

  if (!response.ok && response.status !== 204) {
    const error = await response.json().catch(() => ({ error: 'Failed to disable surface' }))
    throw new Error(error.error || 'Failed to disable surface')
  }
}
