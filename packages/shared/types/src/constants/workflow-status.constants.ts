/**
 * Workflow & Task Status Constants
 * Session #80: Consolidated from 298 hardcoded occurrences
 */

export const WORKFLOW_STATUS = {
  INITIATED: 'initiated',
  RUNNING: 'running',
  PAUSED: 'paused',
  SUCCESS: 'success',  // Legacy: also 'completed'
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  ERROR: 'error'
} as const;

export type WorkflowStatusType = typeof WORKFLOW_STATUS[keyof typeof WORKFLOW_STATUS];

export const TASK_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  SUCCESS: 'success',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  RETRY: 'retry',
  SKIPPED: 'skipped'
} as const;

export type TaskStatusType = typeof TASK_STATUS[keyof typeof TASK_STATUS];

/**
 * Check if status indicates success
 */
export function isSuccessStatus(status: string): boolean {
  return status === WORKFLOW_STATUS.SUCCESS ||
         status === WORKFLOW_STATUS.COMPLETED ||
         status === TASK_STATUS.SUCCESS ||
         status === TASK_STATUS.COMPLETED;
}

/**
 * Check if status indicates failure
 */
export function isFailureStatus(status: string): boolean {
  return status === WORKFLOW_STATUS.FAILED ||
         status === WORKFLOW_STATUS.ERROR ||
         status === TASK_STATUS.FAILED;
}

/**
 * Check if status is terminal (workflow/task is done)
 */
export function isTerminalStatus(status: string | null | undefined): boolean {
  return status === WORKFLOW_STATUS.COMPLETED ||
         status === WORKFLOW_STATUS.FAILED ||
         status === WORKFLOW_STATUS.CANCELLED ||
         status === WORKFLOW_STATUS.ERROR ||
         status === TASK_STATUS.COMPLETED ||
         status === TASK_STATUS.FAILED ||
         status === TASK_STATUS.CANCELLED;
}
