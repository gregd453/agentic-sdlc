/**
 * SelectInput - Reusable select component with dark mode support
 * Standardizes select styling across all forms
 */

import React, { SelectHTMLAttributes } from 'react'
import { INPUT_CLASSES } from '../../constants/theme'

export interface SelectOption {
  value: string | number
  label: string
  disabled?: boolean
}

export interface SelectInputProps extends SelectHTMLAttributes<HTMLSelectElement> {
  /** Label text displayed above select */
  label?: string
  /** Error message displayed below select */
  error?: string | null
  /** Help text displayed below select (when no error) */
  helpText?: string
  /** Whether input is required (adds asterisk to label) */
  required?: boolean
  /** Options to display */
  options: SelectOption[]
  /** Placeholder option text */
  placeholder?: string
}

/**
 * SelectInput Component
 *
 * Usage:
 * ```tsx
 * <SelectInput
 *   label="Status"
 *   options={[
 *     { value: 'active', label: 'Active' },
 *     { value: 'inactive', label: 'Inactive' }
 *   ]}
 *   value={status}
 *   onChange={(e) => setStatus(e.target.value)}
 *   required
 * />
 * ```
 */
export const SelectInput = React.forwardRef<HTMLSelectElement, SelectInputProps>(
  ({ label, error, helpText, required, options, placeholder, className, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
            {label}
            {required && <span className="text-red-600 ml-1">*</span>}
          </label>
        )}

        <select
          ref={ref}
          className={`${INPUT_CLASSES.base} ${INPUT_CLASSES.bordered} ${
            error ? INPUT_CLASSES.error : ''
          } ${className || ''}`}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>

        {error ? (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : helpText ? (
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{helpText}</p>
        ) : null}
      </div>
    )
  }
)

SelectInput.displayName = 'SelectInput'
