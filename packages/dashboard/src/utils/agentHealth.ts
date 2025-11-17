/**
 * Agent health status utilities
 */

export type AgentHealthStatus = 'healthy' | 'degraded' | 'unhealthy'

/**
 * Thresholds for agent health determination
 * Based on average task duration
 */
export const AGENT_HEALTH_THRESHOLDS = {
  HEALTHY_MAX_MS: 5000,      // < 5s is healthy
  DEGRADED_MAX_MS: 15000,    // < 15s is degraded, >= 15s is unhealthy
}

/**
 * Color mapping for agent health status
 */
export const AGENT_HEALTH_COLORS = {
  healthy: '#10b981',    // green
  degraded: '#f59e0b',   // amber
  unhealthy: '#ef4444'   // red
}

/**
 * Determine agent health status based on average task duration
 * @param avgDurationMs Average duration in milliseconds
 * @returns Health status: 'healthy' | 'degraded' | 'unhealthy'
 */
export function getAgentHealthStatus(avgDurationMs: number | null | undefined): AgentHealthStatus {
  if (!avgDurationMs) {
    return 'unhealthy'
  }

  if (avgDurationMs < AGENT_HEALTH_THRESHOLDS.HEALTHY_MAX_MS) {
    return 'healthy'
  }

  if (avgDurationMs < AGENT_HEALTH_THRESHOLDS.DEGRADED_MAX_MS) {
    return 'degraded'
  }

  return 'unhealthy'
}

/**
 * Get the color for an agent's health status
 * @param status Agent health status
 * @returns Hex color code
 */
export function getHealthColor(status: AgentHealthStatus): string {
  return AGENT_HEALTH_COLORS[status]
}
