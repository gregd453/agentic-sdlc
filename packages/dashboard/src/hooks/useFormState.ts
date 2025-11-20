/**
 * useFormState - Custom hook for managing form state
 * Consolidates form validation, error handling, and loading states
 * Eliminates duplicated form logic across multiple components
 */

import { useState, useCallback } from 'react'

export interface FormStateOptions<T> {
  /** Initial form data */
  initialData: T
  /** Called when form is successfully submitted */
  onSuccess?: (data: T) => void
}

export interface FormStateReturn<T> {
  /** Current form data */
  data: T
  /** Update entire form data */
  setData: (data: T) => void
  /** Error message (if any) */
  error: string | null
  /** Set error message */
  setError: (error: string | null) => void
  /** Whether form is currently submitting */
  isLoading: boolean
  /** Set loading state */
  setLoading: (loading: boolean) => void
  /** Whether form submission was successful */
  success: boolean
  /** Set success state */
  setSuccess: (success: boolean) => void
  /** Handle field change */
  handleChange: <K extends keyof T>(field: K, value: T[K]) => void
  /** Handle form submission */
  handleSubmit: (onSubmit: (data: T) => Promise<void> | void) => Promise<void>
  /** Reset form to initial state */
  reset: () => void
}

/**
 * useFormState - Consolidates form state management logic
 *
 * Usage:
 * ```tsx
 * const { data, handleChange, handleSubmit, error, isLoading } = useFormState({
 *   initialData: { name: '', email: '' }
 * })
 *
 * return (
 *   <form onSubmit={(e) => {
 *     e.preventDefault()
 *     handleSubmit(async (data) => {
 *       await api.createUser(data)
 *     })
 *   }}>
 *     <input
 *       value={data.name}
 *       onChange={(e) => handleChange('name', e.target.value)}
 *     />
 *     {error && <p>{error}</p>}
 *     <button disabled={isLoading}>
 *       {isLoading ? 'Saving...' : 'Save'}
 *     </button>
 *   </form>
 * )
 * ```
 */
export function useFormState<T extends Record<string, any>>({
  initialData,
  onSuccess
}: FormStateOptions<T>): FormStateReturn<T> {
  const [data, setData] = useState<T>(initialData)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  /**
   * Handle field change
   * @param field - Field name
   * @param value - New value
   */
  const handleChange = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setData(prev => ({
      ...prev,
      [field]: value
    }))
    // Clear error when user modifies form
    if (error) {
      setError(null)
    }
  }, [error])

  /**
   * Handle form submission
   * @param onSubmit - Async function to execute on submit
   */
  const handleSubmit = useCallback(async (onSubmit: (data: T) => Promise<void> | void) => {
    // Clear previous states
    setError(null)
    setSuccess(false)

    // Set loading state
    setLoading(true)

    try {
      // Execute submission
      await onSubmit(data)

      // Mark as successful
      setSuccess(true)

      // Call optional success callback
      onSuccess?.(data)
    } catch (err) {
      // Handle error
      const errorMessage = err instanceof Error ? err.message : 'An error occurred'
      setError(errorMessage)
    } finally {
      // Clear loading state
      setLoading(false)
    }
  }, [data, onSuccess])

  /**
   * Reset form to initial state
   */
  const reset = useCallback(() => {
    setData(initialData)
    setError(null)
    setSuccess(false)
    setLoading(false)
  }, [initialData])

  return {
    data,
    setData,
    error,
    setError,
    isLoading,
    setLoading,
    success,
    setSuccess,
    handleChange,
    handleSubmit,
    reset
  }
}
