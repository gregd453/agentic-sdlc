/**
 * Integration Tests for Workflow Definition-Driven Routing
 *
 * Tests Session #88 Phase 3 implementation:
 * - Definition-driven stage routing
 * - Custom workflow stage sequences
 * - Fallback to legacy routing
 * - Progress calculation with definitions
 *
 * @see EPCC_CODE.md - Phase 3 Audit & P3-T4 Implementation
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { WorkflowDefinitionAdapter } from '../../services/workflow-definition-adapter.service';
import { PlatformAwareWorkflowEngine } from '../../services/platform-aware-workflow-engine.service';
import { WorkflowStateMachineService } from '../../state-machine/workflow-state-machine';
import { WorkflowRepository } from '../../repositories/workflow.repository';
import { EventBus } from '../../events/event-bus';

describe('Workflow Definition Integration Tests', () => {
  let prisma: PrismaClient;
  let platformAwareEngine: PlatformAwareWorkflowEngine;
  let workflowDefinitionAdapter: WorkflowDefinitionAdapter;
  let workflowRepository: WorkflowRepository;
  let eventBus: EventBus;
  let stateMachineService: WorkflowStateMachineService;

  // Test data IDs
  let testPlatformId: string;
  let testWorkflowDefinitionId: string;

  beforeAll(async () => {
    // Initialize test database connection
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL
        }
      }
    });

    await prisma.$connect();

    // Initialize services
    platformAwareEngine = new PlatformAwareWorkflowEngine(prisma);
    workflowDefinitionAdapter = new WorkflowDefinitionAdapter(platformAwareEngine);
    workflowRepository = new WorkflowRepository(prisma);
    eventBus = new EventBus(process.env.TEST_REDIS_URL || 'redis://localhost:6380');

    // Initialize state machine service WITH adapter (definition-driven mode)
    stateMachineService = new WorkflowStateMachineService(
      workflowRepository,
      eventBus,
      undefined, // No message bus for tests
      undefined, // No state manager for tests
      workflowDefinitionAdapter // SESSION #88: Enable definition-driven routing
    );
  });

  afterAll(async () => {
    // Cleanup test data
    if (testWorkflowDefinitionId) {
      await prisma.workflowDefinition.delete({
        where: { id: testWorkflowDefinitionId }
      }).catch(() => {/* ignore if already deleted */});
    }

    if (testPlatformId) {
      await prisma.platform.delete({
        where: { id: testPlatformId }
      }).catch(() => {/* ignore if already deleted */});
    }

    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up any leftover test data before each test
    await prisma.workflowDefinition.deleteMany({
      where: { name: { startsWith: 'test-' } }
    });

    await prisma.platform.deleteMany({
      where: { name: { startsWith: 'test-' } }
    });
  });

  describe('Scenario 1: Custom 3-Stage Workflow Definition', () => {
    it('should create platform with custom 3-stage workflow definition', async () => {
      // Create test platform
      const platform = await prisma.platform.create({
        data: {
          name: 'test-ml-platform',
          layer: 'DATA',
          description: 'Test ML platform for definition-driven workflows'
        }
      });

      testPlatformId = platform.id;

      // Create custom 3-stage workflow definition
      const workflowDefinition = await prisma.workflowDefinition.create({
        data: {
          platform_id: platform.id,
          name: 'test-ml-training-workflow',
          version: '1.0.0',
          description: 'Test 3-stage ML training workflow',
          enabled: true,
          definition: {
            workflow_type: 'ml-training',
            stages: [
              {
                name: 'data-preparation',
                agent_type: 'data-validation',
                timeout_ms: 300000,
                retry_strategy: { max_retries: 3, backoff_ms: 1000 },
                on_success: 'model-training',
                on_failure: 'skip',
                weight: 30
              },
              {
                name: 'model-training',
                agent_type: 'ml-training',
                timeout_ms: 600000,
                retry_strategy: { max_retries: 2, backoff_ms: 2000 },
                on_success: 'model-evaluation',
                on_failure: 'END',
                weight: 50
              },
              {
                name: 'model-evaluation',
                agent_type: 'validation',
                timeout_ms: 300000,
                retry_strategy: { max_retries: 1, backoff_ms: 1000 },
                on_success: 'END',
                on_failure: 'END',
                weight: 20
              }
            ]
          }
        }
      });

      testWorkflowDefinitionId = workflowDefinition.id;

      // Verify definition was created
      expect(workflowDefinition).toBeDefined();
      expect(workflowDefinition.platform_id).toBe(platform.id);
      expect(workflowDefinition.enabled).toBe(true);

      // Verify definition structure
      const definition = workflowDefinition.definition as any;
      expect(definition.stages).toHaveLength(3);
      expect(definition.stages[0].name).toBe('data-preparation');
      expect(definition.stages[1].name).toBe('model-training');
      expect(definition.stages[2].name).toBe('model-evaluation');
    });

    it('should use definition-driven routing for next stage', async () => {
      // Get next stage using adapter
      const transition = await workflowDefinitionAdapter.getNextStageWithFallback({
        workflow_id: 'test-wf-1',
        workflow_type: 'ml-training',
        current_stage: 'data-preparation',
        platform_id: testPlatformId,
        progress: 0
      });

      // Should use definition (not legacy fallback)
      expect(transition.is_fallback).toBe(false);
      expect(transition.next_stage).toBe('model-training'); // From definition on_success
      expect(transition.agent_type).toBe('ml-training');
      expect(transition.timeout_ms).toBe(600000);
    });

    it('should calculate progress with definition weights', async () => {
      // Test progress calculation for 3-stage workflow
      // Stage 1 complete (weight: 30) → 30% progress
      const progress1 = await workflowDefinitionAdapter.getProgressWithFallback({
        workflow_id: 'test-wf-1',
        workflow_type: 'ml-training',
        current_stage: 'data-preparation',
        platform_id: testPlatformId,
        progress: 0
      });

      expect(progress1).toBe(30); // Stage 1 weight

      // Stage 2 complete (weight: 30 + 50) → 80% progress
      const progress2 = await workflowDefinitionAdapter.getProgressWithFallback({
        workflow_id: 'test-wf-1',
        workflow_type: 'ml-training',
        current_stage: 'model-training',
        platform_id: testPlatformId,
        progress: 30
      });

      expect(progress2).toBe(80); // Stage 1 + Stage 2 weights

      // Stage 3 complete (weight: 30 + 50 + 20) → 100% progress
      const progress3 = await workflowDefinitionAdapter.getProgressWithFallback({
        workflow_id: 'test-wf-1',
        workflow_type: 'ml-training',
        current_stage: 'model-evaluation',
        platform_id: testPlatformId,
        progress: 80
      });

      expect(progress3).toBe(100); // All stages complete
    });
  });

  describe('Scenario 2: Legacy Fallback When No Definition', () => {
    it('should fallback to legacy routing when no definition exists', async () => {
      // Try to get next stage for workflow type WITHOUT definition
      const transition = await workflowDefinitionAdapter.getNextStageWithFallback({
        workflow_id: 'test-wf-legacy',
        workflow_type: 'app', // Built-in workflow type (no custom definition)
        current_stage: 'initialization',
        platform_id: undefined, // No platform ID
        progress: 0
      });

      // Should use legacy fallback
      expect(transition.is_fallback).toBe(true);
      expect(transition.next_stage).toBeDefined();
    });

    it('should fallback to legacy when platform_id is missing', async () => {
      // Even if definition exists, without platform_id should fallback
      const transition = await workflowDefinitionAdapter.getNextStageWithFallback({
        workflow_id: 'test-wf-no-platform',
        workflow_type: 'ml-training',
        current_stage: 'data-preparation',
        platform_id: undefined, // Missing platform_id
        progress: 0
      });

      // Should use legacy fallback
      expect(transition.is_fallback).toBe(true);
    });
  });

  describe('Scenario 3: State Machine Integration', () => {
    it('should create state machine with platform_id for definition-driven routing', () => {
      // Create state machine with platform_id
      const stateMachine = stateMachineService.createStateMachine(
        'test-wf-state-1',
        'ml-training',
        testPlatformId // Pass platform_id
      );

      // Verify state machine was created
      expect(stateMachine).toBeDefined();
      expect(stateMachine.getSnapshot).toBeDefined();

      // Get current state snapshot
      const snapshot = stateMachine.getSnapshot();
      expect(snapshot.context.workflow_id).toBe('test-wf-state-1');
      expect(snapshot.context.type).toBe('ml-training');
      expect(snapshot.context.platform_id).toBe(testPlatformId);
      expect(snapshot.context.current_stage).toBe('initialization');
    });

    it('should create state machine without platform_id for legacy routing', () => {
      // Create state machine WITHOUT platform_id
      const stateMachine = stateMachineService.createStateMachine(
        'test-wf-state-legacy',
        'app'
        // No platform_id → legacy routing
      );

      // Verify state machine was created
      expect(stateMachine).toBeDefined();

      const snapshot = stateMachine.getSnapshot();
      expect(snapshot.context.workflow_id).toBe('test-wf-state-legacy');
      expect(snapshot.context.type).toBe('app');
      expect(snapshot.context.platform_id).toBeUndefined();
    });
  });

  describe('Scenario 4: Workflow Validation', () => {
    it('should validate workflow definition exists for platform', async () => {
      const validation = await workflowDefinitionAdapter.validateWorkflowDefinition(
        'ml-training',
        testPlatformId
      );

      expect(validation.valid).toBe(true);
      expect(validation.message).toContain('definition-driven routing');
    });

    it('should validate legacy workflow type without definition', async () => {
      const validation = await workflowDefinitionAdapter.validateWorkflowDefinition(
        'app' // Built-in type, no custom definition
      );

      expect(validation.valid).toBe(true);
      expect(validation.message).toContain('legacy');
    });

    it('should fail validation for invalid workflow type', async () => {
      const validation = await workflowDefinitionAdapter.validateWorkflowDefinition(
        'invalid-workflow-type-xyz'
      );

      expect(validation.valid).toBe(false);
      expect(validation.message).toContain('No definition');
    });
  });

  describe('Scenario 5: Adapter Cache Statistics', () => {
    it('should track cache statistics', async () => {
      // Clear cache first
      workflowDefinitionAdapter.clearCache();

      // First call - cache miss
      await workflowDefinitionAdapter.getNextStageWithFallback({
        workflow_id: 'test-cache-1',
        workflow_type: 'ml-training',
        current_stage: 'data-preparation',
        platform_id: testPlatformId,
        progress: 0
      });

      // Second call - cache hit
      await workflowDefinitionAdapter.getNextStageWithFallback({
        workflow_id: 'test-cache-2',
        workflow_type: 'ml-training',
        current_stage: 'data-preparation',
        platform_id: testPlatformId,
        progress: 0
      });

      // Get statistics
      const stats = workflowDefinitionAdapter.getStats();

      expect(stats).toBeDefined();
      expect(stats.engine_stats).toBeDefined();
    });

    it('should clear cache for specific platform and workflow type', () => {
      // Clear specific cache entry
      workflowDefinitionAdapter.clearCache(testPlatformId, 'ml-training');

      // Should not throw error
      expect(true).toBe(true);
    });
  });
});
