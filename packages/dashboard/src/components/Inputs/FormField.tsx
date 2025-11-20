/**
 * FormField - Wrapper component for consistent form field layout
 * Handles label, error display, and help text alignment
 */

import { ReactNode } from 'react'

export interface FormFieldProps {
  /** Label text displayed above field */
  label?: string
  /** Error message displayed below field */
  error?: string | null
  /** Help text displayed below field (when no error) */
  helpText?: string
  /** Whether field is required (adds asterisk to label) */
  required?: boolean
  /** Child form input element */
  children: ReactNode
  /** Optional CSS class for container */
  className?: string
}

/**
 * FormField Component
 *
 * Usage:
 * ```tsx
 * <FormField
 *   label="Email"
 *   error={emailError}
 *   required
 * >
 *   <input
 *     type="email"
 *     value={email}
 *     onChange={(e) => setEmail(e.target.value)}
 *   />
 * </FormField>
 * ```
 */
export function FormField({
  label,
  error,
  helpText,
  required,
  children,
  className = ''
}: FormFieldProps) {
  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
          {label}
          {required && <span className="text-red-600 ml-1">*</span>}
        </label>
      )}

      {children}

      {error ? (
        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : helpText ? (
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{helpText}</p>
      ) : null}
    </div>
  )
}
