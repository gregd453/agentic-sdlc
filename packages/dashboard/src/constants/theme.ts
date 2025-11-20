/**
 * Theme Constants - Centralized Tailwind class combinations
 * Replaces 200+ duplicated dark mode class strings throughout dashboard
 * Enables consistent theming and easy theme changes
 */

/**
 * Text color combinations with dark mode support
 */
export const TEXT_COLORS = {
  primary: 'text-gray-900 dark:text-white',
  secondary: 'text-gray-700 dark:text-gray-300',
  muted: 'text-gray-600 dark:text-gray-400',
  light: 'text-gray-500 dark:text-gray-500',
  inverse: 'text-white dark:text-gray-900',
  error: 'text-red-700 dark:text-red-200',
  success: 'text-green-700 dark:text-green-200',
  warning: 'text-yellow-700 dark:text-yellow-200',
  info: 'text-blue-700 dark:text-blue-200',
} as const

/**
 * Background color combinations with dark mode support
 */
export const BG_COLORS = {
  light: 'bg-white dark:bg-gray-800',
  surface: 'bg-gray-50 dark:bg-gray-700',
  input: 'bg-white dark:bg-gray-800',
  elevated: 'bg-white dark:bg-gray-700',
  hover: 'hover:bg-gray-100 dark:hover:bg-gray-700',
  active: 'bg-gray-100 dark:bg-gray-700',
  disabled: 'bg-gray-100 dark:bg-gray-800 opacity-50',
  error: 'bg-red-50 dark:bg-red-900/20',
  success: 'bg-green-50 dark:bg-green-900/20',
  warning: 'bg-yellow-50 dark:bg-yellow-900/20',
  info: 'bg-blue-50 dark:bg-blue-900/20',
} as const

/**
 * Border color combinations with dark mode support
 */
export const BORDER_COLORS = {
  default: 'border-gray-300 dark:border-gray-600',
  light: 'border-gray-200 dark:border-gray-700',
  dark: 'border-gray-400 dark:border-gray-500',
  error: 'border-red-200 dark:border-red-800',
  success: 'border-green-200 dark:border-green-800',
  warning: 'border-yellow-200 dark:border-yellow-800',
  info: 'border-blue-200 dark:border-blue-800',
} as const

/**
 * Combined status classes (bg + border + text)
 */
export const STATUS_COLORS = {
  error: `${BG_COLORS.error} ${BORDER_COLORS.error} ${TEXT_COLORS.error}`,
  success: `${BG_COLORS.success} ${BORDER_COLORS.success} ${TEXT_COLORS.success}`,
  warning: `${BG_COLORS.warning} ${BORDER_COLORS.warning} ${TEXT_COLORS.warning}`,
  info: `${BG_COLORS.info} ${BORDER_COLORS.info} ${TEXT_COLORS.info}`,
} as const

/**
 * Transition/animation classes
 */
export const TRANSITIONS = {
  fast: 'transition-all duration-150 ease-in-out',
  normal: 'transition-all duration-300 ease-in-out',
  slow: 'transition-all duration-500 ease-in-out',
} as const

/**
 * Spacing utilities
 */
export const SPACING = {
  xs: 'space-y-1',
  sm: 'space-y-2',
  md: 'space-y-4',
  lg: 'space-y-6',
  xl: 'space-y-8',
} as const

/**
 * Button classes by variant
 */
export const BUTTON_VARIANTS = {
  primary: 'bg-blue-600 hover:bg-blue-700 text-white disabled:bg-blue-400',
  secondary: 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white',
  danger: 'bg-red-600 hover:bg-red-700 text-white disabled:bg-red-400',
  ghost: 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700',
} as const

/**
 * Input field classes
 */
export const INPUT_CLASSES = {
  base: 'px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500',
  bordered: 'border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500',
  error: 'border-red-300 dark:border-red-700 focus:ring-red-500',
} as const

/**
 * Card classes
 */
export const CARD_CLASSES = {
  base: 'rounded-lg shadow-sm dark:shadow-lg',
  bg: 'bg-white dark:bg-gray-800',
  border: 'border border-gray-200 dark:border-gray-700',
  padding: 'p-6',
} as const

/**
 * Combined card class (use this for consistent card styling)
 */
export const CARD = `${CARD_CLASSES.base} ${CARD_CLASSES.bg} ${CARD_CLASSES.border} ${CARD_CLASSES.padding}` as const

/**
 * Modal overlay classes
 */
export const MODAL_OVERLAY = 'fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50' as const

/**
 * Page padding (for consistent page layout)
 */
export const PAGE_PADDING = 'p-6 dark:p-6' as const

/**
 * Section container classes
 */
export const SECTION_CONTAINER = `rounded-lg border ${BORDER_COLORS.light} ${BG_COLORS.surface} p-6` as const

/**
 * Utility function to combine classes
 */
export function combineClasses(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}

/**
 * Example usage:
 *
 * Instead of:
 * ```tsx
 * className="text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-700"
 * ```
 *
 * Use:
 * ```tsx
 * className={combineClasses(TEXT_COLORS.secondary, BG_COLORS.surface, 'border', BORDER_COLORS.light)}
 * ```
 *
 * Or for predefined combinations:
 * ```tsx
 * className={STATUS_COLORS.error}
 * className={BUTTON_VARIANTS.primary}
 * className={CARD}
 * ```
 */
