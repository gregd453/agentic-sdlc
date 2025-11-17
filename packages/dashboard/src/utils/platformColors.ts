/**
 * Platform layer color mapping utilities
 */

export type PlatformLayer = 'APPLICATION' | 'DATA' | 'INFRASTRUCTURE' | 'ENTERPRISE'

/**
 * Tailwind CSS classes for each platform layer
 */
export const PLATFORM_LAYER_COLORS: Record<PlatformLayer, string> = {
  APPLICATION: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  DATA: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  INFRASTRUCTURE: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  ENTERPRISE: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
}

/**
 * Get Tailwind classes for a platform layer
 * @param layer Platform layer name
 * @returns Tailwind CSS classes
 */
export function getPlatformLayerColor(layer: string): string {
  const normalizedLayer = layer.toUpperCase() as PlatformLayer
  return PLATFORM_LAYER_COLORS[normalizedLayer] ||
    'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
}

/**
 * Format platform layer name for display
 * @param layer Platform layer name
 * @returns Formatted display name
 */
export function formatLayerName(layer: string): string {
  return layer.charAt(0) + layer.slice(1).toLowerCase()
}
