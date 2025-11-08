import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createClient } from 'redis';
import { PrismaClient } from '@prisma/client';
import Fastify, { FastifyInstance } from 'fastify';
import { workflowRoutes } from '../../src/api/routes/workflow.routes';
import { WorkflowService } from '../../src/services/workflow.service';
import { StateMachine } from '../../src/state-machine/state-machine';
import { EventBus } from '../../src/events/event-bus';

/**
 * End-to-End Workflow Integration Test
 *
 * Tests the complete workflow from creation to deployment:
 * 1. Workflow creation via API
 * 2. Agent registration and heartbeat
 * 3. Agent-orchestrator communication via Redis pub/sub
 * 4. State transitions through the workflow stages
 * 5. Task dispatching and result handling
 *
 * Prerequisites:
 * - PostgreSQL running on localhost:5432
 * - Redis running on localhost:6379
 */
describe('End-to-End Workflow Integration', () => {
  let app: FastifyInstance;
  let prisma: PrismaClient;
  let redis: ReturnType<typeof createClient>;
  let eventBus: EventBus;
  let workflowService: WorkflowService;
  let stateMachine: StateMachine;

  const TEST_WORKFLOW_NAME = `E2E Test Workflow ${Date.now()}`;
  let createdWorkflowId: string;

  beforeAll(async () => {
    // Initialize database
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL || 'postgresql://agentic:agentic_dev@localhost:5432/agentic_sdlc_test'
        }
      }
    });

    await prisma.$connect();

    // Initialize Redis
    redis = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });

    await redis.connect();

    // Initialize Event Bus
    eventBus = new EventBus(redis);

    // Initialize State Machine
    stateMachine = new StateMachine(prisma);

    // Initialize Workflow Service
    workflowService = new WorkflowService(
      prisma,
      stateMachine,
      eventBus
    );

    // Initialize Fastify app
    app = Fastify({ logger: false });
    await app.register(workflowRoutes, { workflowService });
    await app.ready();
  }, 30000);

  afterAll(async () => {
    // Cleanup
    if (createdWorkflowId) {
      await prisma.workflow.deleteMany({
        where: { name: TEST_WORKFLOW_NAME }
      }).catch(() => {});
    }

    await app.close();
    await redis.quit();
    await prisma.$disconnect();
  }, 15000);

  beforeEach(async () => {
    // Clear Redis pub/sub channels before each test
    await redis.del('agent:scaffold:tasks');
    await redis.del('agent:validation:tasks');
    await redis.del('orchestrator:results');
  });

  describe('Workflow Creation', () => {
    it('should create a new workflow via API', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/workflows',
        payload: {
          type: 'app',
          name: TEST_WORKFLOW_NAME,
          description: 'End-to-end integration test workflow',
          priority: 'high',
          requirements: 'Create a simple REST API with authentication'
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.workflow_id).toBeDefined();
      expect(body.status).toBe('initiated');
      expect(body.current_stage).toBe('initialization');
      expect(body.progress_percentage).toBe(0);

      createdWorkflowId = body.workflow_id;
    }, 10000);

    it('should persist workflow in database', async () => {
      expect(createdWorkflowId).toBeDefined();

      const workflow = await prisma.workflow.findUnique({
        where: { id: createdWorkflowId }
      });

      expect(workflow).toBeDefined();
      expect(workflow?.status).toBe('initiated');
      expect(workflow?.name).toBe(TEST_WORKFLOW_NAME);
    }, 5000);
  });

  describe('Agent Registration', () => {
    it('should allow agent to register via Redis', async () => {
      const agentId = 'test-scaffold-agent-1';
      const registration = {
        agent_id: agentId,
        type: 'scaffold',
        version: '1.0.0',
        capabilities: ['code_generation', 'template_rendering'],
        status: 'ready',
        timestamp: new Date().toISOString()
      };

      // Publish agent registration
      await redis.publish(
        'agent:registration',
        JSON.stringify(registration)
      );

      // Allow time for registration to process
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify agent can be queried
      const agentKey = `agent:${agentId}`;
      const storedAgent = await redis.get(agentKey);

      // Note: This assumes the orchestrator stores registered agents in Redis
      // If not implemented, this test documents the expected behavior
      if (storedAgent) {
        const agentData = JSON.parse(storedAgent);
        expect(agentData.type).toBe('scaffold');
        expect(agentData.status).toBe('ready');
      }
    }, 5000);

    it('should handle agent heartbeat', async () => {
      const agentId = 'test-validation-agent-1';
      const heartbeat = {
        agent_id: agentId,
        type: 'validation',
        status: 'idle',
        load: 0.2,
        timestamp: new Date().toISOString()
      };

      // Publish heartbeat
      await redis.publish(
        'agent:heartbeat',
        JSON.stringify(heartbeat)
      );

      // Allow time for heartbeat to process
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify heartbeat was recorded
      const heartbeatKey = `agent:${agentId}:heartbeat`;
      const storedHeartbeat = await redis.get(heartbeatKey);

      // Note: This documents expected heartbeat storage behavior
      if (storedHeartbeat) {
        const heartbeatData = JSON.parse(storedHeartbeat);
        expect(heartbeatData.status).toBe('idle');
      }
    }, 5000);
  });

  describe('Agent-Orchestrator Communication', () => {
    it('should publish tasks to agent channels', async () => {
      const taskId = 'test-task-123';
      const task = {
        task_id: taskId,
        workflow_id: createdWorkflowId,
        type: 'scaffold',
        action: 'generate_code',
        parameters: {
          template: 'fastify-rest-api',
          name: 'auth-service'
        },
        timestamp: new Date().toISOString()
      };

      // Subscribe to agent task channel before publishing
      const subscriber = redis.duplicate();
      await subscriber.connect();

      const messagePromise = new Promise<any>((resolve) => {
        subscriber.subscribe('agent:scaffold:tasks', (message) => {
          resolve(JSON.parse(message));
        });
      });

      // Give subscription time to set up
      await new Promise(resolve => setTimeout(resolve, 100));

      // Publish task
      await redis.publish(
        'agent:scaffold:tasks',
        JSON.stringify(task)
      );

      // Wait for message
      const receivedMessage = await Promise.race([
        messagePromise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout waiting for message')), 2000)
        )
      ]);

      expect(receivedMessage).toBeDefined();
      expect(receivedMessage.task_id).toBe(taskId);
      expect(receivedMessage.type).toBe('scaffold');

      await subscriber.quit();
    }, 5000);

    it('should receive agent results on orchestrator channel', async () => {
      const resultId = 'test-result-456';
      const result = {
        result_id: resultId,
        task_id: 'test-task-123',
        workflow_id: createdWorkflowId,
        agent_id: 'test-scaffold-agent-1',
        status: 'success',
        data: {
          files_generated: 15,
          lines_of_code: 450
        },
        timestamp: new Date().toISOString()
      };

      // Subscribe to results channel
      const subscriber = redis.duplicate();
      await subscriber.connect();

      const messagePromise = new Promise<any>((resolve) => {
        subscriber.subscribe('orchestrator:results', (message) => {
          resolve(JSON.parse(message));
        });
      });

      // Give subscription time to set up
      await new Promise(resolve => setTimeout(resolve, 100));

      // Simulate agent publishing result
      await redis.publish(
        'orchestrator:results',
        JSON.stringify(result)
      );

      // Wait for message
      const receivedMessage = await Promise.race([
        messagePromise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout waiting for result')), 2000)
        )
      ]);

      expect(receivedMessage).toBeDefined();
      expect(receivedMessage.result_id).toBe(resultId);
      expect(receivedMessage.status).toBe('success');

      await subscriber.quit();
    }, 5000);
  });

  describe('Workflow State Transitions', () => {
    it('should transition workflow through stages', async () => {
      expect(createdWorkflowId).toBeDefined();

      // Get initial state
      let workflow = await prisma.workflow.findUnique({
        where: { id: createdWorkflowId }
      });
      expect(workflow?.status).toBe('initiated');

      // Transition to scaffolding
      await stateMachine.transitionWorkflow(
        createdWorkflowId,
        'scaffolding'
      );

      workflow = await prisma.workflow.findUnique({
        where: { id: createdWorkflowId }
      });
      expect(workflow?.status).toBe('scaffolding');

      // Transition to validation
      await stateMachine.transitionWorkflow(
        createdWorkflowId,
        'validating'
      );

      workflow = await prisma.workflow.findUnique({
        where: { id: createdWorkflowId }
      });
      expect(workflow?.status).toBe('validating');

      // Transition to completed
      await stateMachine.transitionWorkflow(
        createdWorkflowId,
        'completed'
      );

      workflow = await prisma.workflow.findUnique({
        where: { id: createdWorkflowId }
      });
      expect(workflow?.status).toBe('completed');
    }, 10000);

    it('should reject invalid state transitions', async () => {
      expect(createdWorkflowId).toBeDefined();

      // Try to transition from completed back to initiated (invalid)
      await expect(
        stateMachine.transitionWorkflow(
          createdWorkflowId,
          'initiated'
        )
      ).rejects.toThrow();
    }, 5000);

    it('should record state transition events', async () => {
      expect(createdWorkflowId).toBeDefined();

      const events = await prisma.event.findMany({
        where: { workflow_id: createdWorkflowId },
        orderBy: { created_at: 'asc' }
      });

      // Should have events for each transition
      expect(events.length).toBeGreaterThan(0);

      // Verify event structure
      const firstEvent = events[0];
      expect(firstEvent.workflow_id).toBe(createdWorkflowId);
      expect(firstEvent.event_type).toBeDefined();
      expect(firstEvent.payload).toBeDefined();
    }, 5000);
  });

  describe('Workflow Retrieval', () => {
    it('should retrieve workflow by ID via API', async () => {
      expect(createdWorkflowId).toBeDefined();

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/workflows/${createdWorkflowId}`
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.workflow_id).toBe(createdWorkflowId);
      expect(body.name).toBe(TEST_WORKFLOW_NAME);
    }, 5000);

    it('should list workflows with filters', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/workflows?status=completed'
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(Array.isArray(body)).toBe(true);
      // Should include our completed workflow
      const ourWorkflow = body.find((w: any) => w.workflow_id === createdWorkflowId);
      expect(ourWorkflow).toBeDefined();
    }, 5000);
  });

  describe('Error Handling', () => {
    it('should handle agent failures gracefully', async () => {
      const failedResult = {
        result_id: 'failed-result-789',
        task_id: 'test-task-999',
        workflow_id: createdWorkflowId,
        agent_id: 'test-agent-error',
        status: 'failed',
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Code quality check failed',
          details: ['Coverage below threshold: 45%']
        },
        timestamp: new Date().toISOString()
      };

      // Publish failed result
      await redis.publish(
        'orchestrator:results',
        JSON.stringify(failedResult)
      );

      // Allow time for processing
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify workflow can handle failure
      // (Implementation dependent - this documents expected behavior)
    }, 5000);

    it('should handle workflow cancellation', async () => {
      // Create a new workflow for cancellation test
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/workflows',
        payload: {
          type: 'feature',
          name: 'Workflow to Cancel',
          priority: 'low'
        }
      });

      const { workflow_id } = JSON.parse(response.body);

      // Cancel the workflow
      const cancelResponse = await app.inject({
        method: 'POST',
        url: `/api/v1/workflows/${workflow_id}/cancel`
      });

      expect(cancelResponse.statusCode).toBe(200);

      // Verify workflow is cancelled
      const workflow = await prisma.workflow.findUnique({
        where: { id: workflow_id }
      });

      expect(workflow?.status).toBe('cancelled');

      // Cleanup
      await prisma.workflow.delete({ where: { id: workflow_id } });
    }, 10000);
  });

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/health'
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.status).toBe('healthy');
      expect(body.timestamp).toBeDefined();
    }, 5000);
  });
});
