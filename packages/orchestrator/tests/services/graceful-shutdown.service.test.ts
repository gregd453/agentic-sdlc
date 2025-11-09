import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { EventBus } from '../../src/events/event-bus';
import { AgentDispatcherService } from '../../src/services/agent-dispatcher.service';
import { PipelineExecutorService } from '../../src/services/pipeline-executor.service';
import { PipelineWebSocketHandler } from '../../src/websocket/pipeline-websocket.handler';
import { WorkflowService } from '../../src/services/workflow.service';
import { GracefulShutdownService, ShutdownPhase } from '../../src/services/graceful-shutdown.service';

describe('GracefulShutdownService', () => {
  let fastify: FastifyInstance;
  let prisma: PrismaClient;
  let eventBus: EventBus;
  let agentDispatcher: AgentDispatcherService;
  let pipelineExecutor: PipelineExecutorService;
  let pipelineWebSocketHandler: PipelineWebSocketHandler;
  let workflowService: WorkflowService;
  let gracefulShutdown: GracefulShutdownService;

  beforeEach(() => {
    // Create mock instances
    fastify = {
      close: vi.fn().mockResolvedValue(undefined)
    } as any;

    prisma = {
      $disconnect: vi.fn().mockResolvedValue(undefined)
    } as any;

    eventBus = {
      disconnect: vi.fn().mockResolvedValue(undefined)
    } as any;

    agentDispatcher = {
      disconnect: vi.fn().mockResolvedValue(undefined)
    } as any;

    pipelineExecutor = {
      getActivePipelines: vi.fn().mockResolvedValue([]),
      savePipelineState: vi.fn().mockResolvedValue(undefined),
      cleanup: vi.fn().mockResolvedValue(undefined)
    } as any;

    pipelineWebSocketHandler = {
      cleanup: vi.fn().mockResolvedValue(undefined)
    } as any;

    workflowService = {
      cleanup: vi.fn().mockResolvedValue(undefined)
    } as any;

    gracefulShutdown = new GracefulShutdownService(
      fastify,
      prisma,
      eventBus,
      agentDispatcher,
      pipelineExecutor,
      pipelineWebSocketHandler,
      workflowService
    );
  });

  describe('initialize', () => {
    it('should register SIGTERM handler', () => {
      const onSpy = vi.spyOn(process, 'on');

      gracefulShutdown.initialize();

      expect(onSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    });

    it('should register SIGINT handler', () => {
      const onSpy = vi.spyOn(process, 'on');

      gracefulShutdown.initialize();

      expect(onSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    });

    it('should register uncaughtException handler', () => {
      const onSpy = vi.spyOn(process, 'on');

      gracefulShutdown.initialize();

      expect(onSpy).toHaveBeenCalledWith('uncaughtException', expect.any(Function));
    });
  });

  describe('getStatus', () => {
    it('should return current shutdown status', () => {
      const status = gracefulShutdown.getStatus();

      expect(status).toBeDefined();
      expect(status.phase).toBe(ShutdownPhase.INITIATED);
      expect(status.startTime).toBe(0);
      expect(status.message).toBe('');
    });
  });

  describe('isShuttingDown', () => {
    it('should return false initially', () => {
      expect(gracefulShutdown.isShuttingDown()).toBe(false);
    });
  });
});
