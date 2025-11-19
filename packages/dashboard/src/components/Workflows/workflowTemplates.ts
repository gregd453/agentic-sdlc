/**
 * Workflow Pipeline Templates
 * Phase 3: Multi-Stage Workflow Builder
 * Session #82: Pre-built workflow scenarios for testing
 */

export interface WorkflowStage {
  id: string
  order: number
  name: string
  agentType?: string
  behaviorMetadata: any
  constraints?: {
    timeout_ms?: number
    max_retries?: number
  }
  description?: string
}

export interface WorkflowTemplate {
  id: string
  name: string
  platform: 'web' | 'data' | 'mobile' | 'infra' | 'custom'
  stages: WorkflowStage[]
  estimatedDurationMs?: number
  description?: string
  categoryIcon: string
}

/**
 * Happy Path Template
 * All stages complete successfully with default timing
 */
export const TEMPLATE_HAPPY_PATH: WorkflowTemplate = {
  id: 'template-happy-path',
  name: 'Happy Path',
  platform: 'custom',
  categoryIcon: '✓',
  description: 'All stages succeed normally - baseline happy path testing',
  estimatedDurationMs: 5000,
  stages: [
    {
      id: 'stage-1-scaffold',
      order: 1,
      name: 'Scaffold',
      agentType: 'scaffold-agent',
      description: 'Generate project structure',
      behaviorMetadata: { mode: 'success', timing: { execution_delay_ms: 500 } },
      constraints: { timeout_ms: 10000, max_retries: 0 }
    },
    {
      id: 'stage-2-validate',
      order: 2,
      name: 'Validate',
      agentType: 'validation-agent',
      description: 'Type check and lint',
      behaviorMetadata: { mode: 'success', timing: { execution_delay_ms: 300 } },
      constraints: { timeout_ms: 10000, max_retries: 0 }
    },
    {
      id: 'stage-3-test',
      order: 3,
      name: 'Test',
      agentType: 'e2e-agent',
      description: 'Run test suite',
      behaviorMetadata: { mode: 'success', timing: { execution_delay_ms: 800 } },
      constraints: { timeout_ms: 30000, max_retries: 0 }
    },
    {
      id: 'stage-4-integrate',
      order: 4,
      name: 'Integration',
      agentType: 'integration-agent',
      description: 'Integration testing',
      behaviorMetadata: { mode: 'success', timing: { execution_delay_ms: 600 } },
      constraints: { timeout_ms: 20000, max_retries: 0 }
    },
    {
      id: 'stage-5-deploy',
      order: 5,
      name: 'Deploy',
      agentType: 'deployment-agent',
      description: 'Deploy to production',
      behaviorMetadata: { mode: 'success', timing: { execution_delay_ms: 700 } },
      constraints: { timeout_ms: 30000, max_retries: 0 }
    }
  ]
}

/**
 * Error Recovery Template
 * Mix of success and failure scenarios to test error handling
 */
export const TEMPLATE_ERROR_RECOVERY: WorkflowTemplate = {
  id: 'template-error-recovery',
  name: 'Error Recovery',
  platform: 'custom',
  categoryIcon: '⚡',
  description: 'Test error handling and recovery flows',
  estimatedDurationMs: 8000,
  stages: [
    {
      id: 'stage-1-scaffold',
      order: 1,
      name: 'Scaffold',
      description: 'Generate project',
      behaviorMetadata: { mode: 'success', timing: { execution_delay_ms: 500 } },
      constraints: { timeout_ms: 10000, max_retries: 0 }
    },
    {
      id: 'stage-2-validate-fail',
      order: 2,
      name: 'Validate (Fail)',
      description: 'Validation fails with type errors',
      behaviorMetadata: {
        mode: 'failure',
        error: {
          code: 'VALIDATION_ERROR',
          message: 'TypeScript compilation errors detected',
          retryable: true,
          recovery_suggestion: 'Fix type errors and retry'
        }
      },
      constraints: { timeout_ms: 10000, max_retries: 3 }
    },
    {
      id: 'stage-3-test-partial',
      order: 3,
      name: 'Test (Partial)',
      description: 'Some tests pass, some fail',
      behaviorMetadata: {
        mode: 'partial',
        partial: { total_items: 10, successful_items: 8, failed_items: 2, failure_rate: 0.2, first_failure_at: 3 },
        output: { tests_run: 10, tests_passed: 8, tests_failed: 2 }
      },
      constraints: { timeout_ms: 30000, max_retries: 1 }
    },
    {
      id: 'stage-4-integrate-retry',
      order: 4,
      name: 'Integration (Retry)',
      description: 'Integration fails then succeeds on retry',
      behaviorMetadata: { mode: 'success', timing: { execution_delay_ms: 1000 } },
      constraints: { timeout_ms: 20000, max_retries: 2 }
    },
    {
      id: 'stage-5-deploy-success',
      order: 5,
      name: 'Deploy',
      description: 'Final deployment succeeds',
      behaviorMetadata: { mode: 'success', timing: { execution_delay_ms: 700 } },
      constraints: { timeout_ms: 30000, max_retries: 1 }
    }
  ]
}

/**
 * Timeout Chain Template
 * Multiple stages with timeout scenarios
 */
export const TEMPLATE_TIMEOUT_CHAIN: WorkflowTemplate = {
  id: 'template-timeout-chain',
  name: 'Timeout Chain',
  platform: 'custom',
  categoryIcon: '⏱️',
  description: 'Test timeout handling across multiple stages',
  estimatedDurationMs: 12000,
  stages: [
    {
      id: 'stage-1-scaffold',
      order: 1,
      name: 'Scaffold',
      description: 'Succeeds normally',
      behaviorMetadata: { mode: 'success', timing: { execution_delay_ms: 500 } },
      constraints: { timeout_ms: 10000, max_retries: 0 }
    },
    {
      id: 'stage-2-validate-timeout',
      order: 2,
      name: 'Validate (Timeout)',
      description: 'Validation times out',
      behaviorMetadata: {
        mode: 'timeout',
        timing: { timeout_at_ms: 3000 },
        error: { code: 'TIMEOUT', message: 'Validation exceeded timeout', retryable: true }
      },
      constraints: { timeout_ms: 5000, max_retries: 2 }
    },
    {
      id: 'stage-3-test-success',
      order: 3,
      name: 'Test',
      description: 'Tests complete successfully',
      behaviorMetadata: { mode: 'success', timing: { execution_delay_ms: 1000 } },
      constraints: { timeout_ms: 30000, max_retries: 0 }
    },
    {
      id: 'stage-4-integrate-slow',
      order: 4,
      name: 'Integration (Slow)',
      description: 'Slow integration execution',
      behaviorMetadata: { mode: 'success', metrics: { duration_ms: 8000, memory_mb: 300, cpu_percent: 70 } },
      constraints: { timeout_ms: 15000, max_retries: 0 }
    }
  ]
}

/**
 * Load Test Template
 * High resource usage scenarios
 */
export const TEMPLATE_LOAD_TEST: WorkflowTemplate = {
  id: 'template-load-test',
  name: 'Load Test',
  platform: 'custom',
  categoryIcon: '📈',
  description: 'Test high resource usage scenarios',
  estimatedDurationMs: 25000,
  stages: [
    {
      id: 'stage-1-scaffold',
      order: 1,
      name: 'Scaffold',
      description: 'Generate large project',
      behaviorMetadata: {
        mode: 'success',
        metrics: { duration_ms: 5000, memory_mb: 400, cpu_percent: 80 }
      },
      constraints: { timeout_ms: 15000, max_retries: 0 }
    },
    {
      id: 'stage-2-validate-heavy',
      order: 2,
      name: 'Validate (Heavy)',
      description: 'Heavy type checking',
      behaviorMetadata: {
        mode: 'success',
        metrics: { duration_ms: 8000, memory_mb: 600, cpu_percent: 90 }
      },
      constraints: { timeout_ms: 20000, max_retries: 0 }
    },
    {
      id: 'stage-3-test-intensive',
      order: 3,
      name: 'Test (Intensive)',
      description: 'Run all tests (intensive)',
      behaviorMetadata: {
        mode: 'success',
        metrics: { duration_ms: 12000, memory_mb: 800, cpu_percent: 95 }
      },
      constraints: { timeout_ms: 45000, max_retries: 0 }
    }
  ]
}

/**
 * Fast Iteration Template
 * Optimized for rapid feedback
 */
export const TEMPLATE_FAST_ITERATION: WorkflowTemplate = {
  id: 'template-fast-iteration',
  name: 'Fast Iteration',
  platform: 'custom',
  categoryIcon: '⚡',
  description: 'Optimized for rapid development feedback',
  estimatedDurationMs: 2000,
  stages: [
    {
      id: 'stage-1-scaffold',
      order: 1,
      name: 'Scaffold',
      description: 'Quick scaffold',
      behaviorMetadata: { mode: 'success', timing: { execution_delay_ms: 100 } },
      constraints: { timeout_ms: 5000, max_retries: 0 }
    },
    {
      id: 'stage-2-validate',
      order: 2,
      name: 'Validate',
      description: 'Quick validation',
      behaviorMetadata: { mode: 'success', timing: { execution_delay_ms: 100 } },
      constraints: { timeout_ms: 5000, max_retries: 0 }
    },
    {
      id: 'stage-3-test',
      order: 3,
      name: 'Test',
      description: 'Unit tests only',
      behaviorMetadata: { mode: 'success', timing: { execution_delay_ms: 200 } },
      constraints: { timeout_ms: 10000, max_retries: 0 }
    }
  ]
}

/**
 * Crash Scenario Template
 * Test agent crash handling
 */
export const TEMPLATE_CRASH_SCENARIO: WorkflowTemplate = {
  id: 'template-crash-scenario',
  name: 'Crash Scenario',
  platform: 'custom',
  categoryIcon: '💥',
  description: 'Test agent crash and recovery',
  estimatedDurationMs: 5000,
  stages: [
    {
      id: 'stage-1-scaffold',
      order: 1,
      name: 'Scaffold',
      description: 'Succeeds normally',
      behaviorMetadata: { mode: 'success', timing: { execution_delay_ms: 500 } },
      constraints: { timeout_ms: 10000, max_retries: 0 }
    },
    {
      id: 'stage-2-validate-crash',
      order: 2,
      name: 'Validate (Crash)',
      description: 'Agent crashes during validation',
      behaviorMetadata: {
        mode: 'crash',
        error: { code: 'AGENT_CRASH', message: 'Agent process crashed unexpectedly', retryable: true },
        timing: { crash_after_ms: 800 }
      },
      constraints: { timeout_ms: 10000, max_retries: 3 }
    },
    {
      id: 'stage-3-test',
      order: 3,
      name: 'Test',
      description: 'Continues after recovery',
      behaviorMetadata: { mode: 'success', timing: { execution_delay_ms: 600 } },
      constraints: { timeout_ms: 30000, max_retries: 0 }
    }
  ]
}

/**
 * All Templates Registry
 */
export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  TEMPLATE_HAPPY_PATH,
  TEMPLATE_ERROR_RECOVERY,
  TEMPLATE_TIMEOUT_CHAIN,
  TEMPLATE_LOAD_TEST,
  TEMPLATE_FAST_ITERATION,
  TEMPLATE_CRASH_SCENARIO
]

/**
 * Get template by ID
 */
export function getTemplateById(id: string): WorkflowTemplate | undefined {
  return WORKFLOW_TEMPLATES.find(t => t.id === id)
}

/**
 * Get templates by platform
 */
export function getTemplatesByPlatform(platform: string): WorkflowTemplate[] {
  return WORKFLOW_TEMPLATES.filter(t => t.platform === 'custom' || t.platform === platform)
}

/**
 * Create a blank template (custom canvas)
 */
export function createBlankTemplate(): WorkflowTemplate {
  return {
    id: 'template-blank',
    name: 'Custom Workflow',
    platform: 'custom',
    categoryIcon: '✏️',
    description: 'Start with a blank canvas',
    estimatedDurationMs: 0,
    stages: []
  }
}
