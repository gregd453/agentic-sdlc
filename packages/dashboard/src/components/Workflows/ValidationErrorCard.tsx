import React from 'react'
import type { ValidationError } from '../../hooks/useWorkflowValidation'

interface ValidationErrorCardProps {
  error: ValidationError
  onSuggestionClick?: (suggestion: string, stageId: string) => void
}

export const ValidationErrorCard: React.FC<ValidationErrorCardProps> = ({
  error,
  onSuggestionClick
}) => {
  return (
    <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 rounded-r-lg p-4 mb-3">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div className="flex-1">
          <p className="font-medium text-red-800 dark:text-red-200 mb-1">
            {error.stageName} (Stage {error.stageIndex + 1})
          </p>
          <p className="text-sm text-red-700 dark:text-red-300 mb-3">
            {error.error}
          </p>

          {error.suggestions && error.suggestions.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase">
                Suggestions:
              </p>
              <div className="flex flex-wrap gap-2">
                {error.suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => onSuggestionClick?.(suggestion, error.stageId)}
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
                  >
                    <code className="font-mono">{suggestion}</code>
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-red-600 dark:text-red-400 mt-3">
            <strong>Current value:</strong> <code className="bg-red-100 dark:bg-red-800 px-1 rounded text-xs">{error.agentType}</code>
          </p>
        </div>
      </div>
    </div>
  )
}
