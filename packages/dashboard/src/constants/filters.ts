/**
 * Dashboard filter constants
 */

export const TRACE_STATUSES = ['initiated', 'running', 'completed', 'failed'] as const
export type TraceStatus = typeof TRACE_STATUSES[number]

export const AGENT_TYPES = ['scaffold', 'validation', 'e2e_test', 'integration', 'deployment'] as const
export type AgentType = typeof AGENT_TYPES[number]

export const TIME_PERIODS = ['1h', '24h', '7d', '30d'] as const
export type TimePeriod = typeof TIME_PERIODS[number]

export const WORKFLOW_TYPES = ['app', 'feature', 'bugfix'] as const
export type WorkflowType = typeof WORKFLOW_TYPES[number]

export const WORKFLOW_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const
export type WorkflowPriority = typeof WORKFLOW_PRIORITIES[number]
