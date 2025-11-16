/**
 * Number formatting utilities for dashboard display
 */

/**
 * Format large numbers with K/M/B suffix
 * @example
 * formatLargeNumber(1000) => "1K"
 * formatLargeNumber(1500) => "1.5K"
 * formatLargeNumber(1000000) => "1M"
 */
export function formatLargeNumber(value: number): string {
  if (value >= 1000000) {
    return (value / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (value >= 1000) {
    return (value / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return value.toString();
}

/**
 * Format percentage with % symbol
 * @example
 * formatPercentage(95.5) => "95.5%"
 * formatPercentage(95) => "95%"
 */
export function formatPercentage(value: number, decimals = 1): string {
  const formatted = value % 1 === 0 ? value.toString() : value.toFixed(decimals);
  return `${formatted}%`;
}

/**
 * Format milliseconds to human-readable duration
 * @example
 * formatDuration(1000) => "1.0s"
 * formatDuration(60000) => "1m 0s"
 * formatDuration(3661000) => "1h 1m 1s"
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }

  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

/**
 * Format number with comma separators
 * @example
 * formatNumber(1000) => "1,000"
 * formatNumber(1000000) => "1,000,000"
 */
export function formatNumber(value: number): string {
  return value.toLocaleString('en-US');
}

/**
 * Format as currency (USD)
 * @example
 * formatCurrency(1000) => "$1,000.00"
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}
