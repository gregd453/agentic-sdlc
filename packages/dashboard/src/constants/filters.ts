import { WORKFLOW_TYPES, TASK_PRIORITY } from "@agentic-sdlc/shared-types"
/**
 * Dashboard filter constants
 */

export const TRACE_STATUSES = [WORKFLOW_STATUS.INITIATED, WORKFLOW_STATUS.RUNNING, WORKFLOW_STATUS.COMPLETED, WORKFLOW_STATUS.FAILED] as const
export type TraceStatus = typeof TRACE_STATUSES[number]

export const AGENT_TYPES = [AGENT_TYPES.SCAFFOLD, AGENT_TYPES.VALIDATION, AGENT_TYPES.E2E_TEST, AGENT_TYPES.INTEGRATION, AGENT_TYPES.DEPLOYMENT] as const
export type AgentType = typeof AGENT_TYPES[number]

export const TIME_PERIODS = ['1h', '24h', '7d', '30d'] as const
export type TimePeriod = typeof TIME_PERIODS[number]

export const WORKFLOW_TYPES = [WORKFLOW_TYPES.APP, WORKFLOW_TYPES.FEATURE, WORKFLOW_TYPES.BUGFIX] as const
export type WorkflowType = typeof WORKFLOW_TYPES[number]

export const WORKFLOW_PRIORITIES = [TASK_PRIORITY.LOW, TASK_PRIORITY.MEDIUM, TASK_PRIORITY.HIGH, TASK_PRIORITY.CRITICAL] as const
export type WorkflowPriority = typeof WORKFLOW_PRIORITIES[number]
