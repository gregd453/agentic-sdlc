/**
 * Format Utilities - Consolidated formatting functions
 * Merged from formatters.ts and numberFormatters.ts
 * Single source of truth for all formatting logic
 */

import { formatDistanceToNow, format } from 'date-fns'

// ============================================
// DATE & TIME FORMATTING
// ============================================

/**
 * Format date to readable string
 * @example formatDate('2025-11-20') => "Nov 20, 2025 14:30"
 */
export function formatDate(date: string | Date): string {
  return format(new Date(date), 'MMM d, yyyy HH:mm')
}

/**
 * Format date as relative time (e.g., "2 hours ago")
 * @example formatRelativeTime('2025-11-20T12:00:00Z') => "2 hours ago"
 */
export function formatRelativeTime(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true })
}

// ============================================
// DURATION FORMATTING
// ============================================

/**
 * Format milliseconds to human-readable duration
 * @example
 * formatDuration(1000) => "1s"
 * formatDuration(60000) => "1m 0s"
 * formatDuration(3661000) => "1h 1m 1s"
 */
export function formatDuration(ms: number | null): string {
  if (ms === null) return 'N/A'
  if (ms < 1000) return `${ms}ms`

  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`
  }
  return `${seconds}s`
}

// ============================================
// PERCENTAGE FORMATTING
// ============================================

/**
 * Format number as percentage
 * @example
 * formatPercentage(95.5) => "95.5%"
 * formatPercentage(95) => "95%"
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  const formatted = value % 1 === 0 ? value.toString() : value.toFixed(decimals)
  return `${formatted}%`
}

// ============================================
// NUMBER FORMATTING
// ============================================

/**
 * Format large numbers with K/M/B suffix
 * @example
 * formatLargeNumber(1000) => "1K"
 * formatLargeNumber(1500) => "1.5K"
 * formatLargeNumber(1000000) => "1M"
 */
export function formatLargeNumber(value: number): string {
  if (value >= 1000000) {
    return (value / 1000000).toFixed(1).replace(/\.0$/, '') + 'M'
  }
  if (value >= 1000) {
    return (value / 1000).toFixed(1).replace(/\.0$/, '') + 'K'
  }
  return value.toString()
}

/**
 * Format number with comma separators
 * @example
 * formatNumber(1000) => "1,000"
 * formatNumber(1000000) => "1,000,000"
 */
export function formatNumber(value: number): string {
  return value.toLocaleString('en-US')
}

/**
 * Format as currency (USD)
 * @example formatCurrency(1000) => "$1,000.00"
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value)
}

// ============================================
// STRING FORMATTING
// ============================================

/**
 * Truncate ID to shorter format
 * @example truncateId('abc123def456', 8) => "abc123de"
 */
export function truncateId(id: string, length: number = 8): string {
  return id.substring(0, length)
}

// ============================================
// PROGRESS CALCULATION
// ============================================

/**
 * Calculate progress percentage based on workflow stage
 * Each stage completed = 15% progress (7 stages max = 105%, capped at 100%)
 */
export function calculateProgressFromStage(
  stage: string,
  workflowType: string = 'app'
): number {
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
  return Math.min(100, (stageIndex + 1) * 15)
}
