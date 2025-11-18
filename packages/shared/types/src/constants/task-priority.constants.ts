/**
 * Task Priority Constants
 * Session #80: Consolidated from 136 hardcoded occurrences
 */

export const TASK_PRIORITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
} as const;

export type TaskPriorityType = typeof TASK_PRIORITY[keyof typeof TASK_PRIORITY];
