/**
 * Event Handler Strategies for EventAggregatorService
 * Session #88: Refactored event handling to reduce duplication
 */

import { WORKFLOW_EVENT_STAGES, METRICS_DEFAULTS } from '../constants/monitoring.constants';
import { logger } from '../utils/logger';

/**
 * Metrics state interface
 */
export interface MetricsState {
  totalWorkflows: number;
  runningWorkflows: number;
  completedWorkflows: number;
  failedWorkflows: number;
  pausedWorkflows: number;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  totalDurationMs: number;
  minDurationMs: number;
  maxDurationMs: number;
  workflowsByType: Map<string, { total: number; completed: number; failed: number }>;
  agentPerformance: Map<string, { total: number; completed: number; failed: number; totalDurationMs: number }>;
}

/**
 * Event handler function type
 */
export type EventHandler = (event: any, state: MetricsState) => void;

/**
 * Create initial metrics state
 */
export function createInitialMetricsState(): MetricsState {
  return {
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
    workflowsByType: new Map(),
    agentPerformance: new Map()
  };
}

/**
 * Handle workflow created event
 */
export const handleWorkflowCreated: EventHandler = (event: any, state: MetricsState) => {
  const { payload } = event;

  state.totalWorkflows++;
  state.runningWorkflows++;

  // Track by workflow type
  const wfType = payload?.workflow_type || METRICS_DEFAULTS.UNKNOWN_TYPE;
  const typeStats = state.workflowsByType.get(wfType) || {
    total: 0,
    completed: 0,
    failed: 0
  };
  typeStats.total++;
  state.workflowsByType.set(wfType, typeStats);
};

/**
 * Handle stage completion event
 */
export const handleStageCompleted: EventHandler = (event: any, state: MetricsState) => {
  const { payload } = event;

  state.completedTasks++;
  const agentType = payload?.agent_type || METRICS_DEFAULTS.UNKNOWN_TYPE;
  const agentStats = state.agentPerformance.get(agentType) || {
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
    state.totalDurationMs += payload.duration_ms;
    state.minDurationMs = Math.min(state.minDurationMs, payload.duration_ms);
    state.maxDurationMs = Math.max(state.maxDurationMs, payload.duration_ms);
  }

  state.agentPerformance.set(agentType, agentStats);
};

/**
 * Handle workflow completion event
 */
export const handleWorkflowCompleted: EventHandler = (event: any, state: MetricsState) => {
  const { payload } = event;

  state.runningWorkflows = Math.max(0, state.runningWorkflows - 1);
  state.completedWorkflows++;

  // Update workflow type stats
  const completedType = payload?.workflow_type || METRICS_DEFAULTS.UNKNOWN_TYPE;
  const completedTypeStats = state.workflowsByType.get(completedType);
  if (completedTypeStats) {
    completedTypeStats.completed++;
  }
};

/**
 * Handle workflow failure event
 */
export const handleWorkflowFailed: EventHandler = (event: any, state: MetricsState) => {
  const { payload } = event;

  state.runningWorkflows = Math.max(0, state.runningWorkflows - 1);
  state.failedWorkflows++;
  state.failedTasks++;

  // Update workflow type stats
  const failedType = payload?.workflow_type || METRICS_DEFAULTS.UNKNOWN_TYPE;
  const failedTypeStats = state.workflowsByType.get(failedType);
  if (failedTypeStats) {
    failedTypeStats.failed++;
  }

  // Update agent stats
  const failedAgentType = payload?.agent_type || METRICS_DEFAULTS.UNKNOWN_TYPE;
  const failedAgentStats = state.agentPerformance.get(failedAgentType);
  if (failedAgentStats) {
    failedAgentStats.failed++;
  }
};

/**
 * Handle workflow paused event
 */
export const handleWorkflowPaused: EventHandler = (event: any, state: MetricsState) => {
  state.pausedWorkflows++;
  state.runningWorkflows = Math.max(0, state.runningWorkflows - 1);
};

/**
 * Handle workflow resumed event
 */
export const handleWorkflowResumed: EventHandler = (event: any, state: MetricsState) => {
  state.pausedWorkflows = Math.max(0, state.pausedWorkflows - 1);
  state.runningWorkflows++;
};

/**
 * Event handler registry - maps event stages to handlers
 */
export const EVENT_HANDLER_REGISTRY: Record<string, EventHandler> = {
  [WORKFLOW_EVENT_STAGES.WORKFLOW_CREATED]: handleWorkflowCreated,
  [WORKFLOW_EVENT_STAGES.WORKFLOW_STAGE_COMPLETED]: handleStageCompleted,
  [WORKFLOW_EVENT_STAGES.WORKFLOW_COMPLETED]: handleWorkflowCompleted,
  [WORKFLOW_EVENT_STAGES.WORKFLOW_FAILED]: handleWorkflowFailed,
  [WORKFLOW_EVENT_STAGES.WORKFLOW_PAUSED]: handleWorkflowPaused,
  [WORKFLOW_EVENT_STAGES.WORKFLOW_RESUMED]: handleWorkflowResumed
};

/**
 * Get handler for a given stage, or return null if not found
 */
export function getEventHandler(stage: string): EventHandler | null {
  return EVENT_HANDLER_REGISTRY[stage] || null;
}
