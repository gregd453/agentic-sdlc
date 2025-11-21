/**
 * Event Aggregator Port (Interface)
 * Session #88: Real-time metrics aggregation
 *
 * Abstraction for subscribing to workflow events and aggregating metrics.
 * Implementations: EventAggregatorService
 */

import { RealtimeMetrics } from '@agentic-sdlc/shared-types';

/**
 * Event Aggregator Port
 *
 * Subscribes to workflow events from the message bus and aggregates
 * real-time metrics for the monitoring dashboard.
 */
export interface IEventAggregator {
  /**
   * Start the aggregator - subscribe to workflow events
   * @returns Promise that resolves when subscription is established
   */
  start(): Promise<void>;

  /**
   * Get current aggregated metrics
   * @returns Current metrics or null if not ready
   */
  getMetrics(): Promise<RealtimeMetrics | null>;

  /**
   * Stop the aggregator - unsubscribe from events
   * @returns Promise that resolves when stopped
   */
  stop(): Promise<void>;

  /**
   * Health check
   * @returns true if aggregator is running and healthy
   */
  isHealthy(): Promise<boolean>;
}
