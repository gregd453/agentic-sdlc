import { formatDistanceToNow, format } from 'date-fns'

export function formatDate(date: string | Date): string {
  return format(new Date(date), 'MMM d, yyyy HH:mm')
}

export function formatRelativeTime(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true })
}

export function formatDuration(ms: number | null): string {
  if (ms === null) return 'N/A'

  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`
  } else {
    return `${seconds}s`
  }
}

export function formatPercentage(value: number): string {
  return `${Math.round(value)}%`
}

export function truncateId(id: string, length: number = 8): string {
  return id.substring(0, length)
}

/**
 * Calculate progress percentage based on workflow stage
 * Each stage completed = 15% progress (7 stages max = 105%, capped at 100%)
 */
export function calculateProgressFromStage(
  stage: string,
  workflowType: string = 'app'
): number {
  // Define stage sequences for each workflow type
  const stageSequences: Record<string, string[]> = {
    app: [
      'initialization',
      'scaffolding',
      'validation',
      'e2e_testing',
      'integration',
      'deployment',
      'monitoring',
    ],
    feature: [
      'initialization',
      'scaffolding',
      'validation',
      'e2e_testing',
    ],
    bugfix: [
      'initialization',
      'validation',
      'e2e_testing',
    ],
  }

  const stages = stageSequences[workflowType] || stageSequences.app
  const stageIndex = stages.indexOf(stage)

  if (stageIndex === -1) {
    return 0 // Unknown stage
  }

  // Each completed stage = 15%, current stage gets its credit
  // (index 0 = 15%, index 1 = 30%, index 2 = 45%, etc.)
  return Math.min(100, (stageIndex + 1) * 15)
}
