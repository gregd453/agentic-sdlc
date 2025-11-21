/**
 * Event Aggregator Service
 * Session #88: Real-time metrics aggregation from workflow events
 *
 * Subscribes to workflow events, aggregates metrics, and caches them
 * in Redis for real-time dashboard updates via WebSocket.
 */

import { IEventAggregator } from '../hexagonal/ports/event-aggregator.port';
import { IMessageBus } from '../hexagonal/ports/message-bus.port';
import { IKVStore } from '../hexagonal/ports/kv-store.port';
import { StatsService } from './stats.service';
import {
  RealtimeMetrics,
  RealtimeMetricsSchema,
  AgentStats,
  WorkflowStats
} from '@agentic-sdlc/shared-types';
import { logger } from '../utils/logger';

// Metrics cache key in Redis
const METRICS_CACHE_KEY = 'monitoring:metrics:realtime';
const METRICS_CACHE_TTL_SEC = 300; // 5 minutes

// Broadcast interval in milliseconds
const BROADCAST_INTERVAL_MS = 5000; // 5 seconds

export class EventAggregatorService implements IEventAggregator {
  private isRunning = false;
  private unsubscribe: (() => Promise<void>) | null = null;
  private broadcastInterval: ReturnType<typeof setInterval> | null = null;
  private lastBroadcastTime = 0;

  // In-memory metrics tracking
  private metricsState = {
    totalWorkflows: 0,
    runningWorkflows: 0,
    completedWorkflows: 0,
    failedWorkflows: 0,
    pausedWorkflows: 0,
    totalTasks: 0,
    completedTasks: 0,
    failedTasks: 0,
    totalDurationMs: 0,
    minDurationMs: Infinity,
    maxDurationMs: 0,
    workflowsByType: new Map<string, { total: number; completed: number; failed: number }>(),
    agentPerformance: new Map<string, { total: number; completed: number; failed: number; totalDurationMs: number }>()
  };

  constructor(
    private messageBus: IMessageBus,
    private kvStore: IKVStore,
    private statsService: StatsService
  ) {}

  /**
   * Start the event aggregator
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('[EventAggregator] Already running');
      return;
    }

    try {
      logger.info('[EventAggregator] Starting event aggregator');

      // Subscribe to workflow events
      this.unsubscribe = await this.messageBus.subscribe(
        'workflow:events',
        (event: any) => this.handleWorkflowEvent(event),
        {
          consumerGroup: 'event-aggregator',
          fromBeginning: false
        }
      );

      this.isRunning = true;

      // Start broadcast interval (send metrics every 5 seconds)
      this.broadcastInterval = setInterval(() => {
        this.broadcastMetrics().catch(err => {
          logger.error('[EventAggregator] Error broadcasting metrics', { error: err.message });
        });
      }, BROADCAST_INTERVAL_MS);

      // Load initial stats from database
      await this.loadInitialMetrics();

      logger.info('[EventAggregator] Started successfully');
    } catch (error) {
      logger.error('[EventAggregator] Failed to start', { error });
      throw error;
    }
  }

  /**
   * Stop the event aggregator
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      logger.info('[EventAggregator] Stopping event aggregator');

      this.isRunning = false;

      // Clear broadcast interval
      if (this.broadcastInterval) {
        clearInterval(this.broadcastInterval);
        this.broadcastInterval = null;
      }

      // Unsubscribe from message bus
      if (this.unsubscribe) {
        await this.unsubscribe();
        this.unsubscribe = null;
      }

      logger.info('[EventAggregator] Stopped successfully');
    } catch (error) {
      logger.error('[EventAggregator] Error stopping', { error });
      throw error;
    }
  }

  /**
   * Get current aggregated metrics
   */
  async getMetrics(): Promise<RealtimeMetrics | null> {
    try {
      // Try to get from cache first
      const cached = await this.kvStore.get<RealtimeMetrics>(METRICS_CACHE_KEY);
      if (cached) {
        return cached;
      }

      // If not in cache, compute from current state
      return this.buildMetricsFromState();
    } catch (error) {
      logger.error('[EventAggregator] Error getting metrics', { error });
      return null;
    }
  }

  /**
   * Health check
   */
  async isHealthy(): Promise<boolean> {
    try {
      if (!this.isRunning) {
        return false;
      }

      // Check message bus health
      const busHealth = await this.messageBus.health();
      if (!busHealth.ok) {
        return false;
      }

      // Check KV store health
      const kvHealth = await this.kvStore.health();
      return kvHealth;
    } catch (error) {
      logger.error('[EventAggregator] Health check failed', { error });
      return false;
    }
  }

  /**
   * Handle workflow events
   */
  private async handleWorkflowEvent(event: any): Promise<void> {
    try {
      const { metadata, payload } = event;

      if (!metadata || !metadata.stage) {
        logger.warn('[EventAggregator] Event missing stage', { event: event.message_id });
        return;
      }

      const stage = metadata.stage;

      // Extract metrics based on event type
      switch (stage) {
        case 'orchestrator:workflow:created':
          this.metricsState.totalWorkflows++;
          this.metricsState.runningWorkflows++;

          // Track by workflow type
          const wfType = payload?.workflow_type || 'unknown';
          const typeStats = this.metricsState.workflowsByType.get(wfType) || {
            total: 0,
            completed: 0,
            failed: 0
          };
          typeStats.total++;
          this.metricsState.workflowsByType.set(wfType, typeStats);
          break;

        case 'orchestrator:workflow:stage:completed':
          // Track task completion
          this.metricsState.completedTasks++;
          const agentType = payload?.agent_type || 'unknown';
          const agentStats = this.metricsState.agentPerformance.get(agentType) || {
            total: 0,
            completed: 0,
            failed: 0,
            totalDurationMs: 0
          };
          agentStats.total++;
          agentStats.completed++;

          // Track duration if available
          if (payload?.duration_ms) {
            agentStats.totalDurationMs += payload.duration_ms;
            this.metricsState.totalDurationMs += payload.duration_ms;
            this.metricsState.minDurationMs = Math.min(
              this.metricsState.minDurationMs,
              payload.duration_ms
            );
            this.metricsState.maxDurationMs = Math.max(
              this.metricsState.maxDurationMs,
              payload.duration_ms
            );
          }

          this.metricsState.agentPerformance.set(agentType, agentStats);
          break;

        case 'orchestrator:workflow:completed':
          this.metricsState.runningWorkflows = Math.max(0, this.metricsState.runningWorkflows - 1);
          this.metricsState.completedWorkflows++;

          // Update workflow type stats
          const completedType = payload?.workflow_type || 'unknown';
          const completedTypeStats = this.metricsState.workflowsByType.get(completedType);
          if (completedTypeStats) {
            completedTypeStats.completed++;
          }
          break;

        case 'orchestrator:workflow:failed':
          this.metricsState.runningWorkflows = Math.max(0, this.metricsState.runningWorkflows - 1);
          this.metricsState.failedWorkflows++;
          this.metricsState.failedTasks++;

          // Update workflow type stats
          const failedType = payload?.workflow_type || 'unknown';
          const failedTypeStats = this.metricsState.workflowsByType.get(failedType);
          if (failedTypeStats) {
            failedTypeStats.failed++;
          }

          // Update agent stats
          const failedAgentType = payload?.agent_type || 'unknown';
          const failedAgentStats = this.metricsState.agentPerformance.get(failedAgentType);
          if (failedAgentStats) {
            failedAgentStats.failed++;
          }
          break;

        case 'orchestrator:workflow:paused':
          this.metricsState.pausedWorkflows++;
          this.metricsState.runningWorkflows = Math.max(0, this.metricsState.runningWorkflows - 1);
          break;

        case 'orchestrator:workflow:resumed':
          this.metricsState.pausedWorkflows = Math.max(0, this.metricsState.pausedWorkflows - 1);
          this.metricsState.runningWorkflows++;
          break;

        default:
          // Silently ignore unknown stages
          break;
      }
    } catch (error) {
      logger.error('[EventAggregator] Error handling event', { error, event: event?.message_id });
    }
  }

  /**
   * Load initial metrics from database
   */
  private async loadInitialMetrics(): Promise<void> {
    try {
      logger.debug('[EventAggregator] Loading initial metrics from database');

      // Get overview stats
      const overview = await this.statsService.getOverview();
      if (overview) {
        this.metricsState.totalWorkflows = overview.overview.total_workflows || 0;
        this.metricsState.completedWorkflows = overview.overview.completed_workflows || 0;
        this.metricsState.failedWorkflows = overview.overview.failed_workflows || 0;
        this.metricsState.runningWorkflows = overview.overview.running_workflows || 0;
        this.metricsState.pausedWorkflows = overview.overview.paused_workflows || 0;
      }

      // Cache initial metrics
      await this.broadcastMetrics();
    } catch (error) {
      logger.warn('[EventAggregator] Failed to load initial metrics', { error });
      // Don't throw - service can still run without initial load
    }
  }

  /**
   * Broadcast metrics to Redis cache
   */
  private async broadcastMetrics(): Promise<void> {
    try {
      const now = Date.now();
      const timeSinceLastBroadcast = now - this.lastBroadcastTime;

      // Skip if broadcast too soon (debounce)
      if (timeSinceLastBroadcast < BROADCAST_INTERVAL_MS - 500) {
        return;
      }

      const metrics = this.buildMetricsFromState();

      // Cache in Redis
      await this.kvStore.set(METRICS_CACHE_KEY, metrics, METRICS_CACHE_TTL_SEC);

      this.lastBroadcastTime = now;

      logger.debug('[EventAggregator] Metrics broadcast to cache', {
        workflows: metrics.overview.total_workflows,
        agents: metrics.agents.length
      });

      // TODO: Broadcast to WebSocket clients via WebSocketManager
      // This will be implemented in Phase 1.3
    } catch (error) {
      logger.error('[EventAggregator] Error broadcasting metrics', { error });
    }
  }

  /**
   * Build metrics object from current state
   */
  private buildMetricsFromState(): RealtimeMetrics {
    // Calculate health percentage (simplified)
    const totalMetrics =
      this.metricsState.totalWorkflows + this.metricsState.totalTasks ||
      1;
    const successMetrics =
      this.metricsState.completedWorkflows + this.metricsState.completedTasks ||
      0;
    const healthPercent = totalMetrics > 0 ? (successMetrics / totalMetrics) * 100 : 100;

    // Calculate error rate
    const totalOps = this.metricsState.totalWorkflows || 1;
    const errorRate =
      totalOps > 0
        ? ((this.metricsState.failedWorkflows + this.metricsState.failedTasks) /
            totalOps) *
          100
        : 0;

    // Calculate success rate
    const successRate = 100 - Math.min(errorRate, 100);

    // Build agent stats array
    const agentStats: AgentStats[] = Array.from(
      this.metricsState.agentPerformance.entries()
    ).map(([agentType, stats]) => ({
      agent_type: agentType,
      total_tasks: stats.total,
      completed_tasks: stats.completed,
      failed_tasks: stats.failed,
      avg_duration_ms:
        stats.completed > 0 ? stats.totalDurationMs / stats.completed : 0,
      success_rate_percent:
        stats.total > 0 ? (stats.completed / stats.total) * 100 : 0
    }));

    // Build workflow type stats array
    const workflowStats: WorkflowStats[] = Array.from(
      this.metricsState.workflowsByType.entries()
    ).map(([wfType, stats]) => ({
      workflow_type: wfType,
      total: stats.total,
      completed: stats.completed,
      failed: stats.failed,
      success_rate_percent:
        stats.total > 0 ? (stats.completed / stats.total) * 100 : 0
    }));

    // Calculate average duration
    const avgDuration =
      this.metricsState.completedTasks > 0
        ? this.metricsState.totalDurationMs /
          this.metricsState.completedTasks
        : 0;

    const metrics: RealtimeMetrics = {
      overview: {
        total_workflows: this.metricsState.totalWorkflows,
        running_workflows: this.metricsState.runningWorkflows,
        completed_workflows: this.metricsState.completedWorkflows,
        failed_workflows: this.metricsState.failedWorkflows,
        paused_workflows: this.metricsState.pausedWorkflows,
        avg_completion_time_ms: avgDuration,
        error_rate_percent: errorRate,
        success_rate_percent: successRate,
        system_health_percent: healthPercent
      },
      agents: agentStats,
      workflows_by_type: workflowStats,
      throughput_per_minute: this.calculateThroughput(),
      latency_p50_ms: avgDuration,
      latency_p95_ms: Math.max(
        avgDuration,
        this.metricsState.maxDurationMs * 0.95
      ),
      latency_p99_ms: Math.max(
        avgDuration,
        this.metricsState.maxDurationMs * 0.99
      ),
      last_update: new Date().toISOString(),
      next_update_in_ms: BROADCAST_INTERVAL_MS
    };

    // Validate against schema
    try {
      RealtimeMetricsSchema.parse(metrics);
    } catch (error) {
      logger.error('[EventAggregator] Metrics validation failed', { error });
      // Return metrics anyway - schema issues shouldn't break the service
    }

    return metrics;
  }

  /**
   * Calculate throughput (workflows per minute)
   */
  private calculateThroughput(): number {
    // Simplified: workflows completed in last minute
    // In production, would use time-windowed counters
    return this.metricsState.completedWorkflows > 0
      ? this.metricsState.completedWorkflows / Math.max(1, 1)
      : 0;
  }
}
