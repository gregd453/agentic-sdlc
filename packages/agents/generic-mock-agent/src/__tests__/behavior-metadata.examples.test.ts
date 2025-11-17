/**
 * Behavior Metadata Examples & Test Scenarios
 *
 * This file demonstrates how to use AgentBehaviorMetadata to:
 * 1. Create complex test scenarios without code changes
 * 2. Inject failures at specific stages
 * 3. Test error handling and retry logic
 * 4. Simulate timeouts and partial failures
 * 5. Control output and metrics
 *
 * Use these patterns in your integration tests to:
 * - Test happy path workflows
 * - Test failure injection at specific stages
 * - Test state machine transitions
 * - Test retry behavior
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { GenericMockAgent } from '../generic-mock-agent.js'
import { BEHAVIOR_SAMPLES } from '@agentic-sdlc/shared-types'
import type { AgentEnvelope } from '@agentic-sdlc/base-agent'

// Mock message bus for examples
class MockMessageBus {
  async subscribe(_channel: string, _handler: any): Promise<void> {}
  async publish(_channel: string, _message: any): Promise<void> {}
  async health(): Promise<{ ok: boolean }> {
    return { ok: true }
  }
}

describe('Behavior Metadata Examples', () => {
  let agent: GenericMockAgent
  let messageBus: MockMessageBus

  beforeEach(() => {
    messageBus = new MockMessageBus()
    agent = new GenericMockAgent(messageBus, 'scaffold', undefined, 0) // No delay for tests
  })

  // ============================================================================
  // EXAMPLE 1: Happy Path - All Stages Succeed
  // ============================================================================

  describe('Example 1: Happy Path Workflow', () => {
    it('should complete workflow with all stages succeeding', async () => {
      // Stage 1: Initialization (success)
      const initTask = createMockTask('initialization', 'app', {
        behavior_metadata: BEHAVIOR_SAMPLES.success
      })
      const initResult = await agent.execute(initTask)
      expect(initResult.status).toBe('success')
      expect(initResult.errors).toBeUndefined()

      // Stage 2: Scaffolding (success)
      const scaffoldTask = createMockTask('scaffolding', 'app', {
        behavior_metadata: BEHAVIOR_SAMPLES.success
      })
      const scaffoldResult = await agent.execute(scaffoldTask)
      expect(scaffoldResult.status).toBe('success')

      // Stage 3: Validation (success)
      const validationTask = createMockTask('validation', 'app', {
        behavior_metadata: BEHAVIOR_SAMPLES.success
      })
      const validationResult = await agent.execute(validationTask)
      expect(validationResult.status).toBe('success')

      // ... continue through all 8 stages
    })
  })

  // ============================================================================
  // EXAMPLE 2: Failure Injection at Specific Stage
  // ============================================================================

  describe('Example 2: Failure Injection', () => {
    it('should fail at validation stage, allowing earlier stages to succeed', async () => {
      // Stage 1: Scaffolding succeeds
      const scaffoldTask = createMockTask('scaffolding', 'app', {
        behavior_metadata: BEHAVIOR_SAMPLES.success
      })
      const scaffoldResult = await agent.execute(scaffoldTask)
      expect(scaffoldResult.status).toBe('success')

      // Stage 2: Validation FAILS (inject failure)
      const validationTask = createMockTask('validation', 'app', {
        behavior_metadata: BEHAVIOR_SAMPLES.validation_error
      })
      const validationResult = await agent.execute(validationTask)

      // Verify failure
      expect(validationResult.status).toBe('failed')
      expect(validationResult.errors).toBeDefined()
      expect(validationResult.errors?.[0].code).toBe('VALIDATION_ERROR')
      expect(validationResult.errors?.[0].recoverable).toBe(true)

      // State machine would handle this - try retry
      const retryTask = createMockTask('validation', 'app', {
        behavior_metadata: BEHAVIOR_SAMPLES.success // Retry succeeds
      })
      const retryResult = await agent.execute(retryTask)
      expect(retryResult.status).toBe('success')
    })

    it('should fail with unrecoverable error', async () => {
      const task = createMockTask('deployment', 'app', {
        behavior_metadata: BEHAVIOR_SAMPLES.unrecoverable_error
      })
      const result = await agent.execute(task)

      expect(result.status).toBe('failed')
      expect(result.errors?.[0].code).toBe('FATAL_ERROR')
      expect(result.errors?.[0].recoverable).toBe(false)
      // State machine would not retry this
    })
  })

  // ============================================================================
  // EXAMPLE 3: Custom Failure Messages
  // ============================================================================

  describe('Example 3: Custom Error Messages', () => {
    it('should support custom error details', async () => {
      const task = createMockTask('validation', 'app', {
        behavior_metadata: {
          mode: 'failure',
          error: {
            code: 'TYPE_CHECK_FAILED',
            message: 'src/components/Button.tsx:45: Property "onClick" is missing',
            details: {
              file: 'src/components/Button.tsx',
              line: 45,
              column: 12,
              expected_property: 'onClick',
              error_type: 'property_missing'
            },
            retryable: true,
            recovery_suggestion: 'Add missing onClick property to component definition'
          }
        }
      })

      const result = await agent.execute(task)

      expect(result.status).toBe('failed')
      expect(result.errors?.[0].code).toBe('TYPE_CHECK_FAILED')
      expect(result.errors?.[0].details?.file).toBe('src/components/Button.tsx')
    })
  })

  // ============================================================================
  // EXAMPLE 4: Partial Success (e.g., Some Tests Fail)
  // ============================================================================

  describe('Example 4: Partial Success', () => {
    it('should report partial success when some tests fail', async () => {
      const task = createMockTask('e2e_testing', 'app', {
        behavior_metadata: BEHAVIOR_SAMPLES.tests_partial_pass // 8/10 tests passed
      })

      const result = await agent.execute(task)

      // Partial success is still a failure
      expect(result.status).toBe('failed')

      // But we have output data
      expect(result.result.data).toBeDefined()
      expect(result.result.data.tests_run).toBe(10)
      expect(result.result.data.tests_passed).toBe(8)
      expect(result.result.data.tests_failed).toBe(2)

      // Error details show partial success
      expect(result.errors?.[0].code).toBe('PARTIAL_SUCCESS')
      expect(result.errors?.[0].recoverable).toBe(true)

      // Confidence score reflects partial success
      expect(result.metadata.confidence_score).toBe(80) // 8/10 = 80%
    })

    it('should allow custom partial success metrics', async () => {
      const task = createMockTask('integration', 'app', {
        behavior_metadata: {
          mode: 'partial',
          partial: {
            total_items: 20,
            successful_items: 18,
            failed_items: 2,
            failure_rate: 0.1,
            first_failure_at: 5
          },
          output: {
            tests_run: 20,
            tests_passed: 18,
            tests_failed: 2,
            duration_ms: 15000,
            failed_tests: [
              { name: 'database-connection', error: 'Timeout' },
              { name: 'api-integration', error: 'Service unavailable' }
            ]
          }
        }
      })

      const result = await agent.execute(task)

      expect(result.status).toBe('failed')
      expect(result.result.data.failed_tests).toHaveLength(2)
      expect(result.result.data.duration_ms).toBe(15000)
    })
  })

  // ============================================================================
  // EXAMPLE 5: Timeout Simulation
  // ============================================================================

  describe('Example 5: Timeout Handling', () => {
    it('should simulate stage timeout', async () => {
      const task = createMockTask('e2e_testing', 'app', {
        behavior_metadata: BEHAVIOR_SAMPLES.timeout
      })

      const result = await agent.execute(task)

      expect(result.status).toBe('failed')
      expect(result.errors?.[0].code).toBe('TIMEOUT')
      expect(result.errors?.[0].message).toBe('Agent execution exceeded timeout')
      expect(result.errors?.[0].recoverable).toBe(true)
    })

    it('should support custom timeout details', async () => {
      const task = createMockTask('deployment', 'app', {
        behavior_metadata: {
          mode: 'timeout',
          timing: { timeout_at_ms: 3000 },
          error: {
            code: 'DEPLOYMENT_TIMEOUT',
            message: 'Deployment to production did not complete within 3 seconds',
            details: {
              timeout_ms: 3000,
              elapsed_ms: 3005,
              stage: 'waiting-for-health-check'
            },
            retryable: true,
            recovery_suggestion: 'Increase timeout or check infrastructure health'
          }
        }
      })

      const result = await agent.execute(task)

      expect(result.status).toBe('failed')
      expect(result.errors?.[0].details?.stage).toBe('waiting-for-health-check')
    })
  })

  // ============================================================================
  // EXAMPLE 6: Custom Metrics & Output
  // ============================================================================

  describe('Example 6: Custom Output & Metrics', () => {
    it('should override metrics with custom values', async () => {
      const task = createMockTask('scaffolding', 'app', {
        behavior_metadata: {
          mode: 'success',
          output: {
            project_name: 'my-custom-project',
            files_generated: 127,
            bytes_written: 2048000
          },
          metrics: {
            duration_ms: 8500,
            memory_mb: 256,
            cpu_percent: 75,
            custom_metrics: {
              files_created: 127,
              directories_created: 45,
              templates_applied: 12
            }
          }
        }
      })

      const result = await agent.execute(task)

      expect(result.status).toBe('success')
      expect(result.result.data.project_name).toBe('my-custom-project')
      expect(result.result.data.files_generated).toBe(127)
      expect(result.result.metrics.duration_ms).toBe(8500)
    })
  })

  // ============================================================================
  // EXAMPLE 7: Timing Control - Fast vs Slow Execution
  // ============================================================================

  describe('Example 7: Timing Control', () => {
    it('should execute quickly when configured', async () => {
      const task = createMockTask('validation', 'app', {
        behavior_metadata: BEHAVIOR_SAMPLES.fast_success
      })

      const startTime = Date.now()
      const result = await agent.execute(task)
      const duration = Date.now() - startTime

      expect(result.status).toBe('success')
      expect(duration).toBeLessThan(100) // Should be quick
    })

    it('should execute slowly when configured', async () => {
      const task = createMockTask('validation', 'app', {
        behavior_metadata: BEHAVIOR_SAMPLES.slow_success
      })

      const startTime = Date.now()
      const result = await agent.execute(task)
      const duration = Date.now() - startTime

      expect(result.status).toBe('success')
      expect(duration).toBeGreaterThan(4900) // Should be ~5000ms
    })

    it('should add variance to delays', async () => {
      const task = createMockTask('scaffolding', 'app', {
        behavior_metadata: {
          mode: 'success',
          timing: {
            execution_delay_ms: 1000,
            variance_ms: 500 // +/- 500ms
          }
        }
      })

      // Run multiple times to see variance
      const durations: number[] = []
      for (let i = 0; i < 3; i++) {
        const startTime = Date.now()
        await agent.execute(task)
        durations.push(Date.now() - startTime)
      }

      // Should vary (not all exactly 1000ms)
      const isVariable = durations.some(d => Math.abs(d - 1000) > 50)
      expect(isVariable).toBe(true)
    })
  })

  // ============================================================================
  // EXAMPLE 8: Multi-Stage Complex Scenario
  // ============================================================================

  describe('Example 8: Complex Multi-Stage Scenario', () => {
    it('should execute complex workflow with mixed behaviors', async () => {
      // Stage 1: Initialization (success)
      const stage1 = await agent.execute(
        createMockTask('initialization', 'app', {
          behavior_metadata: BEHAVIOR_SAMPLES.success
        })
      )
      expect(stage1.status).toBe('success')

      // Stage 2: Scaffolding (slow success)
      const stage2 = await agent.execute(
        createMockTask('scaffolding', 'app', {
          behavior_metadata: BEHAVIOR_SAMPLES.slow_success
        })
      )
      expect(stage2.status).toBe('success')

      // Stage 3: Dependency installation (success)
      const stage3 = await agent.execute(
        createMockTask('dependency_installation', 'app', {
          behavior_metadata: BEHAVIOR_SAMPLES.success
        })
      )
      expect(stage3.status).toBe('success')

      // Stage 4: Validation (FAIL - inject failure)
      const stage4 = await agent.execute(
        createMockTask('validation', 'app', {
          behavior_metadata: BEHAVIOR_SAMPLES.validation_error
        })
      )
      expect(stage4.status).toBe('failed')

      // RETRY: Validation (success on retry)
      const stage4Retry = await agent.execute(
        createMockTask('validation', 'app', {
          behavior_metadata: BEHAVIOR_SAMPLES.success
        })
      )
      expect(stage4Retry.status).toBe('success')

      // Stage 5: E2E Testing (partial success)
      const stage5 = await agent.execute(
        createMockTask('e2e_testing', 'app', {
          behavior_metadata: BEHAVIOR_SAMPLES.tests_partial_pass
        })
      )
      expect(stage5.status).toBe('failed')
      expect(stage5.errors?.[0].code).toBe('PARTIAL_SUCCESS')

      // RETRY: E2E Testing (success on retry)
      const stage5Retry = await agent.execute(
        createMockTask('e2e_testing', 'app', {
          behavior_metadata: BEHAVIOR_SAMPLES.success
        })
      )
      expect(stage5Retry.status).toBe('success')

      // Continue with remaining stages...
    })
  })

  // ============================================================================
  // EXAMPLE 9: Platform-Specific Behavior
  // ============================================================================

  describe('Example 9: Platform-Specific Behaviors', () => {
    it('should support different behaviors per platform', async () => {
      // Web app: deployment succeeds quickly
      const webAgent = new GenericMockAgent(messageBus, 'deployment', 'web-app-platform', 0)
      const webDeployTask = createMockTask('deployment', 'app', {
        behavior_metadata: {
          mode: 'success',
          timing: { execution_delay_ms: 500 },
          output: { endpoint: 'https://my-app.vercel.app' }
        }
      })
      const webResult = await webAgent.execute(webDeployTask)
      expect(webResult.result.data.endpoint).toBe('https://my-app.vercel.app')

      // Data pipeline: deployment times out
      const pipelineAgent = new GenericMockAgent(messageBus, 'deployment', 'data-pipeline-platform', 0)
      const pipelineDeployTask = createMockTask('deployment', 'app', {
        behavior_metadata: {
          mode: 'timeout',
          error: { code: 'PIPELINE_DEPLOYMENT_TIMEOUT' }
        }
      })
      const pipelineResult = await pipelineAgent.execute(pipelineDeployTask)
      expect(pipelineResult.status).toBe('failed')
    })
  })

  // ============================================================================
  // EXAMPLE 10: Using Available Presets
  // ============================================================================

  describe('Example 10: Available Behavior Presets', () => {
    it('should expose available presets', () => {
      const presets = agent.getAvailableBehaviors()

      expect(presets).toContain('success')
      expect(presets).toContain('fast_success')
      expect(presets).toContain('slow_success')
      expect(presets).toContain('validation_error')
      expect(presets).toContain('deployment_failed')
      expect(presets).toContain('timeout')
      expect(presets).toContain('tests_partial_pass')
      expect(presets).toContain('crash')
    })

    it('should retrieve preset by name', () => {
      const preset = agent.getBehaviorPreset('validation_error')

      expect(preset).toBeDefined()
      expect(preset.mode).toBe('failure')
      expect(preset.error.code).toBe('VALIDATION_ERROR')
    })

    it('should show agent capabilities including behaviors', () => {
      const info = agent.getAgentInfo()

      expect(info.availableBehaviors).toContain('success')
      expect(info.capabilities).toContain('failure-injection')
      expect(info.capabilities).toContain('metadata-driven-behavior')
    })
  })
})

// ============================================================================
// HELPER: Create mock task
// ============================================================================

function createMockTask(
  stage: string,
  workflowType: string,
  payload: Record<string, any> = {}
): AgentEnvelope {
  return {
    message_id: 'msg-' + Math.random().toString(36).substr(2, 9),
    task_id: 'task-' + Math.random().toString(36).substr(2, 9),
    workflow_id: 'wf-' + Math.random().toString(36).substr(2, 9),
    agent_type: 'scaffold',
    priority: 'medium',
    status: 'pending',
    constraints: {
      timeout_ms: 300000,
      max_retries: 3,
      required_confidence: 80
    },
    retry_count: 0,
    payload: {
      name: 'test-project',
      project_type: workflowType,
      ...payload
    },
    metadata: {
      created_at: new Date().toISOString(),
      created_by: 'test',
      envelope_version: '2.0.0'
    },
    trace: {
      trace_id: 'trace-' + Math.random().toString(36).substr(2, 9),
      span_id: 'span-' + Math.random().toString(36).substr(2, 9),
      parent_span_id: undefined
    },
    workflow_context: {
      workflow_type: workflowType,
      workflow_name: 'test-workflow',
      current_stage: stage,
      stage_outputs: {},
      platform_id: 'test-platform'
    }
  } as any
}
