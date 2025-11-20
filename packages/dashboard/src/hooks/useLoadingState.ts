/**
 * useLoadingState - Custom hook for managing multiple loading states
 * Standardizes inconsistent loading state variable naming across components
 * Eliminates scattered loading state management patterns
 */

import { useState, useCallback } from 'react'

export interface LoadingStateReturn {
  /** Main loading state (e.g., page load) */
  loading: boolean
  /** Saving/creating state (e.g., form submission) */
  saving: boolean
  /** Deleting state */
  deleting: boolean
  /** Modal/dialog loading state */
  modal: boolean
  /** Set specific loading state */
  setLoading: (type: LoadingType, value: boolean) => void
  /** Set all loading states to false */
  clearAll: () => void
  /** Check if any loading state is active */
  isAnyLoading: () => boolean
}

export type LoadingType = 'loading' | 'saving' | 'deleting' | 'modal'

/**
 * useLoadingState - Manages multiple loading states with consistent naming
 *
 * Usage:
 * ```tsx
 * const { loading, saving, setLoading, isAnyLoading } = useLoadingState()
 *
 * useEffect(() => {
 *   setLoading('loading', true)
 *   fetchData()
 *     .then(data => setData(data))
 *     .finally(() => setLoading('loading', false))
 * }, [])
 *
 * const handleSave = async () => {
 *   setLoading('saving', true)
 *   try {
 *     await saveData()
 *   } finally {
 *     setLoading('saving', false)
 *   }
 * }
 *
 * return (
 *   <div>
 *     {loading && <Spinner />}
 *     <button disabled={isAnyLoading()} onClick={handleSave}>
 *       {saving ? 'Saving...' : 'Save'}
 *     </button>
 *   </div>
 * )
 * ```
 */
export function useLoadingState(): LoadingStateReturn {
  const [state, setState] = useState({
    loading: false,
    saving: false,
    deleting: false,
    modal: false
  })

  /**
   * Set specific loading state
   */
  const setLoading = useCallback((type: LoadingType, value: boolean) => {
    setState(prev => ({
      ...prev,
      [type]: value
    }))
  }, [])

  /**
   * Clear all loading states
   */
  const clearAll = useCallback(() => {
    setState({
      loading: false,
      saving: false,
      deleting: false,
      modal: false
    })
  }, [])

  /**
   * Check if any loading state is active
   */
  const isAnyLoading = useCallback(() => {
    return state.loading || state.saving || state.deleting || state.modal
  }, [state])

  return {
    ...state,
    setLoading,
    clearAll,
    isAnyLoading
  }
}
