/**
 * Monitoring API - Handles real-time metrics and control operations
 * Provides WebSocket subscription with HTTP fallback for metrics
 * Part of modularized API client
 */

import { getAPIBase, fetchJSON } from './client'
import type { DashboardOverview, AgentStats } from '../types'

/**
 * Real-time metrics data structure
 * Updated every 5 seconds via WebSocket or polling
 */
export interface RealtimeMetrics {
  timestamp: string
  overview: DashboardOverview
  agents: AgentStats[]
  error_rate_percent: number
  throughput_workflows_per_sec: number
  avg_latency_ms: number
  p50_latency_ms: number
  p95_latency_ms: number
  p99_latency_ms: number
  active_workflows: number
  agent_health: Record<string, {
    status: 'healthy' | 'degraded' | 'offline'
    tasks_completed: number
    tasks_failed: number
    success_rate: number
    avg_latency_ms: number
  }>
}

/**
 * WebSocket message types for metrics subscription
 */
interface WebSocketMessage {
  type: 'subscribe' | 'metrics:update' | 'error' | 'ping' | 'pong'
  channels?: string[]
  data?: any
  error?: string
  timestamp?: string
}

/**
 * WebSocket manager for handling reconnection and message delivery
 */
class WebSocketManager {
  private ws: WebSocket | null = null
  private url: string
  private reconnectAttempts = 0
  private maxReconnectAttempts = 10
  private reconnectDelay = 1000
  private isIntentionallyClosed = false
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null

  constructor() {
    // Convert HTTP(S) to WS(S)
    const base = getAPIBase()
    const protocol = base.includes('https') ? 'wss' : 'ws'
    const host = base.replace(/^https?:\/\//i, '').split('/')[0]
    this.url = `${protocol}://${host}/ws/monitoring`
  }

  /**
   * Connect to WebSocket server
   */
  connect(onMessage: (msg: WebSocketMessage) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url)
        this.isIntentionallyClosed = false

        this.ws.onopen = () => {
          console.log('[Monitoring WS] Connected to metrics stream')
          this.reconnectAttempts = 0
          this.reconnectDelay = 1000

          // Subscribe to metrics channel
          this.send({
            type: 'subscribe',
            channels: ['metrics:realtime', 'events:critical']
          })

          // Start heartbeat
          this.startHeartbeat()
          resolve()
        }

        this.ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data)
            onMessage(msg)
          } catch (err) {
            console.error('[Monitoring WS] Failed to parse message:', err)
          }
        }

        this.ws.onerror = (error) => {
          console.error('[Monitoring WS] Connection error:', error)
          reject(error)
        }

        this.ws.onclose = () => {
          console.log('[Monitoring WS] Connection closed')
          this.stopHeartbeat()
          if (!this.isIntentionallyClosed) {
            this.attemptReconnect(onMessage)
          }
        }
      } catch (error) {
        console.error('[Monitoring WS] Failed to create connection:', error)
        reject(error)
      }
    })
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  private attemptReconnect(onMessage: (msg: WebSocketMessage) => void) {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[Monitoring WS] Max reconnection attempts reached')
      return
    }

    this.reconnectAttempts++
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1)
    console.log(`[Monitoring WS] Reconnecting in ${delay}ms... (attempt ${this.reconnectAttempts})`)

    setTimeout(() => {
      this.connect(onMessage).catch((err) => {
        console.error('[Monitoring WS] Reconnection failed:', err)
      })
    }, delay)
  }

  /**
   * Send message to server
   */
  send(msg: WebSocketMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg))
    }
  }

  /**
   * Start heartbeat to detect stale connections
   */
  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.send({ type: 'ping' })
    }, 30000) // Send ping every 30 seconds
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  /**
   * Close connection gracefully
   */
  close() {
    this.isIntentionallyClosed = true
    this.stopHeartbeat()
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN
  }
}

// Global WebSocket manager instance
let wsManager: WebSocketManager | null = null

/**
 * Fetch real-time metrics via HTTP (fallback if WebSocket unavailable)
 * Polls the monitoring API for current metrics
 */
export async function fetchRealtimeMetrics(): Promise<RealtimeMetrics> {
  try {
    // API returns { data: RealtimeMetrics, timestamp, ttl_ms }
    const response = await fetchJSON<{ data: RealtimeMetrics, timestamp: string, ttl_ms: number }>(`${getAPIBase()}/monitoring/metrics/realtime`)
    return response.data  // Extract data from wrapper
  } catch (error) {
    console.error('[Monitoring API] Failed to fetch metrics:', error)
    // Return a minimal metrics object as fallback
    return {
      timestamp: new Date().toISOString(),
      overview: {
        overview: {
          total_workflows: 0,
          initiated_workflows: 0,
          running_workflows: 0,
          completed_workflows: 0,
          failed_workflows: 0,
          cancelled_workflows: 0,
          paused_workflows: 0,
        },
        recent_workflows_count: 0,
        avg_completion_time_ms: null,
      },
      agents: [],
      error_rate_percent: 0,
      throughput_workflows_per_sec: 0,
      avg_latency_ms: 0,
      p50_latency_ms: 0,
      p95_latency_ms: 0,
      p99_latency_ms: 0,
      active_workflows: 0,
      agent_health: {},
    }
  }
}

/**
 * Subscribe to real-time metrics updates via WebSocket
 * Falls back to HTTP polling if WebSocket is unavailable
 *
 * @param callback Function to call when metrics are updated
 * @param interval Polling interval in ms if WebSocket fails (default 5000)
 * @returns Unsubscribe function to close connection
 */
export function subscribeToMetrics(
  callback: (metrics: RealtimeMetrics) => void,
  interval: number = 5000
): () => void {
  let pollingInterval: ReturnType<typeof setInterval> | null = null

  // Try WebSocket first
  wsManager = new WebSocketManager()

  wsManager.connect((msg: WebSocketMessage) => {
    if (msg.type === 'metrics:update' && msg.data) {
      callback(msg.data)
      // Clear polling if we got metrics via WebSocket
      if (pollingInterval) {
        clearInterval(pollingInterval)
        pollingInterval = null
      }
    } else if (msg.type === 'error') {
      console.error('[Monitoring] Metrics error:', msg.error)
    }
  }).catch((error) => {
    console.warn('[Monitoring] WebSocket failed, falling back to polling:', error)
    // Fall back to HTTP polling
    startPolling()
  })

  function startPolling() {
    if (!pollingInterval) {
      console.log(`[Monitoring] Starting polling interval (${interval}ms)`)
      pollingInterval = setInterval(async () => {
        try {
          const metrics = await fetchRealtimeMetrics()
          callback(metrics)
        } catch (error) {
          console.error('[Monitoring] Polling error:', error)
        }
      }, interval)

      // Initial fetch
      fetchRealtimeMetrics().then(callback).catch(console.error)
    }
  }

  // Return unsubscribe function
  return () => {
    if (pollingInterval) {
      clearInterval(pollingInterval)
      pollingInterval = null
    }
    if (wsManager) {
      wsManager.close()
      wsManager = null
    }
    console.log('[Monitoring] Unsubscribed from metrics')
  }
}

/**
 * Control workflow operations (pause, resume, cancel)
 *
 * @param workflowId Workflow ID to control
 * @param action Control action: 'pause', 'resume', or 'cancel'
 */
export async function controlWorkflow(
  workflowId: string,
  action: 'pause' | 'resume' | 'cancel'
): Promise<{ status: string }> {
  const response = await fetch(`${getAPIBase()}/workflows/${workflowId}/control`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action })
  })

  if (!response.ok) {
    throw new Error(`Failed to ${action} workflow: HTTP ${response.status}`)
  }

  return response.json()
}

/**
 * Cancel a workflow immediately
 *
 * @param workflowId Workflow ID to cancel
 */
export async function cancelWorkflow(workflowId: string): Promise<void> {
  const response = await fetch(`${getAPIBase()}/workflows/${workflowId}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })

  if (!response.ok) {
    throw new Error(`Failed to cancel workflow: HTTP ${response.status}`)
  }
}

/**
 * Pause a workflow (halts current stage, queues can resume)
 *
 * @param workflowId Workflow ID to pause
 */
export async function pauseWorkflow(workflowId: string): Promise<{ status: string }> {
  return controlWorkflow(workflowId, 'pause')
}

/**
 * Resume a paused workflow
 *
 * @param workflowId Workflow ID to resume
 */
export async function resumeWorkflow(workflowId: string): Promise<{ status: string }> {
  return controlWorkflow(workflowId, 'resume')
}
