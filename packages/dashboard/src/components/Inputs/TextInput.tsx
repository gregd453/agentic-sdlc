/**
 * TextInput - Reusable text input component with dark mode support
 * Standardizes input styling across all forms
 */

import React, { InputHTMLAttributes } from 'react'
import { INPUT_CLASSES } from '../../constants/theme'

export interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Label text displayed above input */
  label?: string
  /** Error message displayed below input */
  error?: string | null
  /** Help text displayed below input (when no error) */
  helpText?: string
  /** Whether input is required (adds asterisk to label) */
  required?: boolean
}

/**
 * TextInput Component
 *
 * Usage:
 * ```tsx
 * <TextInput
 *   label="Email"
 *   type="email"
 *   placeholder="your@email.com"
 *   value={email}
 *   onChange={(e) => setEmail(e.target.value)}
 *   error={emailError}
 *   required
 * />
 * ```
 */
export const TextInput = React.forwardRef<HTMLInputElement, TextInputProps>(
  ({ label, error, helpText, required, className, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
            {label}
            {required && <span className="text-red-600 ml-1">*</span>}
          </label>
        )}

        <input
          ref={ref}
          className={`${INPUT_CLASSES.base} ${INPUT_CLASSES.bordered} ${
            error ? INPUT_CLASSES.error : ''
          } ${className || ''}`}
          {...props}
        />

        {error ? (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : helpText ? (
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{helpText}</p>
        ) : null}
      </div>
    )
  }
)

TextInput.displayName = 'TextInput'
