/**
 * Monitoring Constants
 * Session #88: Constants for event aggregation and real-time metrics
 */

// Redis cache configuration
export const MONITORING_CACHE = {
  METRICS_KEY: 'monitoring:metrics:realtime',
  TTL_SECONDS: 300 // 5 minutes
} as const;

// Broadcast intervals
export const MONITORING_INTERVALS = {
  METRICS_BROADCAST_MS: 5000, // 5 seconds
  DEBOUNCE_MS: 500 // Minimum time between broadcasts
} as const;

// Workflow event stages
export const WORKFLOW_EVENT_STAGES = {
  WORKFLOW_CREATED: 'orchestrator:workflow:created',
  WORKFLOW_STAGE_COMPLETED: 'orchestrator:workflow:stage:completed',
  WORKFLOW_COMPLETED: 'orchestrator:workflow:completed',
  WORKFLOW_FAILED: 'orchestrator:workflow:failed',
  WORKFLOW_PAUSED: 'orchestrator:workflow:paused',
  WORKFLOW_RESUMED: 'orchestrator:workflow:resumed'
} as const;

// Message bus configuration
export const MESSAGE_BUS_CONFIG = {
  CONSUMER_GROUP: 'event-aggregator',
  TOPIC: 'workflow:events'
} as const;

// Default values for metrics
export const METRICS_DEFAULTS = {
  UNKNOWN_TYPE: 'unknown',
  INITIAL_VALUE: Infinity,
  LATENCY_PERCENTILE_P95: 0.95,
  LATENCY_PERCENTILE_P99: 0.99
} as const;

// Logging context prefix
export const LOG_CONTEXT = '[EventAggregator]' as const;
