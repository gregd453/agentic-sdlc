/**
 * TextAreaInput - Reusable textarea component with dark mode support
 * Standardizes textarea styling across all forms
 */

import React, { TextareaHTMLAttributes } from 'react'
import { INPUT_CLASSES } from '../../constants/theme'

export interface TextAreaInputProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Label text displayed above textarea */
  label?: string
  /** Error message displayed below textarea */
  error?: string | null
  /** Help text displayed below textarea (when no error) */
  helpText?: string
  /** Whether input is required (adds asterisk to label) */
  required?: boolean
  /** Character count limit */
  maxLength?: number
  /** Show remaining character count */
  showCharCount?: boolean
}

/**
 * TextAreaInput Component
 *
 * Usage:
 * ```tsx
 * <TextAreaInput
 *   label="Description"
 *   placeholder="Enter description..."
 *   value={description}
 *   onChange={(e) => setDescription(e.target.value)}
 *   rows={4}
 *   maxLength={500}
 *   showCharCount
 *   required
 * />
 * ```
 */
export const TextAreaInput = React.forwardRef<HTMLTextAreaElement, TextAreaInputProps>(
  ({ label, error, helpText, required, maxLength, showCharCount, value, className, ...props }, ref) => {
    const charCount = typeof value === 'string' ? value.length : 0
    const charRemaining = maxLength ? maxLength - charCount : 0

    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
            {label}
            {required && <span className="text-red-600 ml-1">*</span>}
          </label>
        )}

        <textarea
          ref={ref}
          maxLength={maxLength}
          className={`${INPUT_CLASSES.base} ${INPUT_CLASSES.bordered} resize-none ${
            error ? INPUT_CLASSES.error : ''
          } ${className || ''}`}
          value={value}
          {...props}
        />

        <div className="mt-1 flex justify-between items-start">
          <div>
            {error ? (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            ) : helpText ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">{helpText}</p>
            ) : null}
          </div>

          {showCharCount && maxLength && (
            <p className={`text-sm font-medium ${
              charRemaining < 50
                ? 'text-red-600 dark:text-red-400'
                : 'text-gray-500 dark:text-gray-400'
            }`}>
              {charCount} / {maxLength}
            </p>
          )}
        </div>
      </div>
    )
  }
)

TextAreaInput.displayName = 'TextAreaInput'
