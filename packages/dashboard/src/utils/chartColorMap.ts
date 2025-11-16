/**
 * Color mapping utilities for dashboard charts
 * Maps workflow/task statuses to visual colors
 */

export const statusColors = {
  // Workflow statuses
  initiated: '#6b7280',    // gray-500
  running: '#3b82f6',      // blue-500
  completed: '#10b981',    // green-500
  failed: '#ef4444',       // red-500
  cancelled: '#6b7280',    // gray-500
  paused: '#f59e0b',       // amber-500

  // Task statuses
  pending: '#6b7280',      // gray-500
  assigned: '#3b82f6',     // blue-500
};

export const chartColors = {
  primary: '#3b82f6',      // blue
  success: '#10b981',      // green
  danger: '#ef4444',       // red
  warning: '#f59e0b',      // amber
  accent: '#8b5cf6',       // purple
  neutral: '#6b7280',      // gray
};

export const chartColorArray = [
  '#3b82f6',  // blue
  '#10b981',  // green
  '#ef4444',  // red
  '#f59e0b',  // amber
  '#8b5cf6',  // purple
  '#06b6d4',  // cyan
];

/**
 * Get color for workflow status
 */
export function getStatusColor(status: string): string {
  return statusColors[status as keyof typeof statusColors] || '#6b7280';
}

/**
 * Get color for chart data (Recharts compatible)
 */
export function getChartColor(status: string): string {
  return getStatusColor(status);
}
