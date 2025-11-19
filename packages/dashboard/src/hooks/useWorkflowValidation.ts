import { useEffect, useState, useCallback } from 'react'
import { fetchAgents, AgentMetadata } from '../api/client'
import type { WorkflowStage } from '../components/Workflows/workflowTemplates'

export interface ValidationError {
  stageId: string
  stageIndex: number
  stageName: string
  agentType: string
  error: string
  suggestions?: string[]
}

export interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
  validatedAgents: Map<string, AgentMetadata>
}

/**
 * Hook to validate workflow stages before submission
 * Checks if agents exist and provides suggestions for typos
 */
export function useWorkflowValidation(stages: WorkflowStage[]) {
  const [validation, setValidation] = useState<ValidationResult>({
    isValid: true,
    errors: [],
    validatedAgents: new Map()
  })
  const [isValidating, setIsValidating] = useState(false)

  /**
   * Calculate Levenshtein distance for typo suggestions
   */
  const levenshteinDistance = useCallback((str1: string, str2: string): number => {
    const matrix: number[][] = []

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i]
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          )
        }
      }
    }

    return matrix[str2.length][str1.length]
  }, [])

  /**
   * Get suggestions for a typo
   */
  const getSuggestions = useCallback((agentType: string, availableAgents: AgentMetadata[]): string[] => {
    const suggestions = availableAgents
      .map(agent => ({
        type: agent.type,
        distance: levenshteinDistance(agentType.toLowerCase(), agent.type.toLowerCase())
      }))
      .filter(({ distance }) => distance <= 2) // Allow up to 2 character differences
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 3) // Return top 3 suggestions
      .map(({ type }) => type)

    return suggestions
  }, [levenshteinDistance])

  /**
   * Validate stages
   */
  const validate = useCallback(async () => {
    if (stages.length === 0) {
      setValidation({
        isValid: true,
        errors: [],
        validatedAgents: new Map()
      })
      return
    }

    setIsValidating(true)
    const errors: ValidationError[] = []
    const validatedAgents = new Map<string, AgentMetadata>()

    try {
      // Fetch all available agents once
      const allAgents = await fetchAgents()

      // Validate each stage
      for (let i = 0; i < stages.length; i++) {
        const stage = stages[i]
        const agentType = stage.agentType?.trim()

        // Skip validation if no agent type specified
        if (!agentType) {
          continue
        }

        // Check if agent exists
        const agent = allAgents.find(a => a.type === agentType)

        if (agent) {
          validatedAgents.set(agentType, agent)
        } else {
          // Agent not found - add error with suggestions
          const suggestions = getSuggestions(agentType, allAgents)
          errors.push({
            stageId: stage.id,
            stageIndex: i,
            stageName: stage.name,
            agentType,
            error: `Agent type "${agentType}" not found. Did you mean one of these?`,
            suggestions
          })
        }
      }

      setValidation({
        isValid: errors.length === 0,
        errors,
        validatedAgents
      })
    } catch (err) {
      // If we can't fetch agents, mark as unable to validate but don't block
      console.error('Failed to validate workflow:', err)
      setValidation({
        isValid: true, // Don't block on validation error
        errors: [],
        validatedAgents: new Map()
      })
    } finally {
      setIsValidating(false)
    }
  }, [stages, getSuggestions])

  // Auto-validate when stages change
  useEffect(() => {
    validate()
  }, [stages, validate])

  return {
    validation,
    isValidating,
    validate
  }
}
