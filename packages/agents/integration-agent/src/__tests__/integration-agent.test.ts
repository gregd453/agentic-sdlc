import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IntegrationAgent } from '../integration-agent';
import { GitService } from '../services/git.service';
import { ConflictResolverService } from '../services/conflict-resolver.service';
import { DependencyUpdaterService } from '../services/dependency-updater.service';
import { IntegrationTestRunnerService } from '../services/integration-test-runner.service';
import {
  createMockMergeResult,
  createMockResolvedConflict,
  createMockDependencyUpdate,
  createMockDependencyUpdateResult,
  createMockIntegrationTestResult
} from './mock-factories';

// Mock services
vi.mock('../services/git.service');
vi.mock('../services/conflict-resolver.service');
vi.mock('../services/dependency-updater.service');
vi.mock('../services/integration-test-runner.service');

describe('IntegrationAgent', () => {
  let agent: IntegrationAgent;

  beforeEach(() => {
    vi.clearAllMocks();
    agent = new IntegrationAgent('/tmp/test-repo');
  });

  describe('executeTask', () => {
    it('should handle merge_branch task successfully', async () => {
      const mockTask = {
        task_id: 'task_test-123',
        workflow_id: 'wf_test-123',
        agent_type: 'integration' as const,
        action: 'merge_branch' as const,
        status: 'pending' as const,
        priority: 50,
        payload: {
          source_branch: 'feature/test',
          target_branch: 'main',
          strategy: 'merge' as const,
          auto_resolve_conflicts: false,
          conflict_strategy: 'ai' as const,
          delete_source_after_merge: false,
          run_tests_before_merge: false
        },
        version: '1.0.0',
        timeout_ms: 120000,
        retry_count: 0,
        max_retries: 3,
        created_at: new Date().toISOString()
      };

      // Mock git service methods
      const mockGitService = GitService.prototype;
      vi.spyOn(mockGitService, 'createBranch').mockResolvedValue(undefined);
      vi.spyOn(mockGitService, 'mergeBranch').mockResolvedValue(
        createMockMergeResult({ merge_commit: 'abc123', files_changed: 5 })
      );

      const result = await agent.executeTask(mockTask);

      expect(result.action).toBe('merge_branch');
      expect(result.result.success).toBe(true);
      expect(result.result.merge_commit).toBe('abc123');
    });

    it('should handle resolve_conflict task successfully', async () => {
      const mockTask = {
        task_id: 'task_test-456',
        workflow_id: 'wf_test-123',
        agent_type: 'integration' as const,
        action: 'resolve_conflict' as const,
        status: 'pending' as const,
        priority: 50,
        payload: {
          conflicts: [{
            file_path: 'src/index.ts',
            conflict_markers: {
              ours: 'const x = 1;',
              theirs: 'const x = 2;'
            },
            conflict_type: 'content' as const
          }],
          strategy: 'ai' as const,
          target_branch: 'main'
        },
        version: '1.0.0',
        timeout_ms: 120000,
        retry_count: 0,
        max_retries: 3,
        created_at: new Date().toISOString()
      };

      // Mock services
      vi.spyOn(ConflictResolverService.prototype, 'resolveConflict').mockResolvedValue({
        resolved_content: 'const x = 2;',
        confidence: 95,
        reasoning: 'Chose theirs as it has newer logic',
        strategy_used: 'ai' as const
      });

      vi.spyOn(GitService.prototype, 'applyResolution').mockResolvedValue(undefined);
      vi.spyOn(GitService.prototype, 'createCommit').mockResolvedValue('def456');

      const result = await agent.executeTask(mockTask);

      expect(result.action).toBe('resolve_conflict');
      expect(result.result.success).toBe(true);
      expect(result.result.resolved_conflicts.length).toBe(1);
    });

    it('should handle update_dependencies task successfully', async () => {
      const mockTask = {
        task_id: 'task_test-789',
        workflow_id: 'wf_test-123',
        agent_type: 'integration' as const,
        action: 'update_dependencies' as const,
        status: 'pending' as const,
        priority: 50,
        payload: {
          package_manager: 'pnpm' as const,
          update_type: 'minor' as const,
          run_tests: false,
          create_pull_request: false
        },
        version: '1.0.0',
        timeout_ms: 120000,
        retry_count: 0,
        max_retries: 3,
        created_at: new Date().toISOString()
      };

      vi.spyOn(GitService.prototype, 'getCurrentCommitSha').mockResolvedValue('sha123');
      vi.spyOn(DependencyUpdaterService.prototype, 'updateDependencies').mockResolvedValue([
        createMockDependencyUpdate()
      ]);

      const result = await agent.executeTask(mockTask);

      expect(result.action).toBe('update_dependencies');
      expect(result.result.success).toBe(true);
      expect(result.result.updates.length).toBe(1);
    });

    it('should handle run_integration_tests task successfully', async () => {
      const mockTask = {
        task_id: 'task_test-101',
        workflow_id: 'wf_test-123',
        agent_type: 'integration' as const,
        action: 'run_integration_tests' as const,
        status: 'pending' as const,
        priority: 50,
        payload: {
          environment: 'local' as const,
          timeout_ms: 60000,
          fail_fast: false
        },
        version: '1.0.0',
        timeout_ms: 120000,
        retry_count: 0,
        max_retries: 3,
        created_at: new Date().toISOString()
      };

      vi.spyOn(IntegrationTestRunnerService.prototype, 'runTests').mockResolvedValue(
        createMockIntegrationTestResult()
      );

      const result = await agent.executeTask(mockTask);

      expect(result.action).toBe('run_integration_tests');
      expect(result.result.success).toBe(true);
      expect(result.result.total_tests).toBe(10);
    });

    it('should throw error for unknown action', async () => {
      const mockTask = {
        task_id: 'task_test-999',
        workflow_id: 'wf_test-123',
        agent_type: 'integration' as const,
        action: 'unknown_action' as any,
        status: 'pending' as const,
        priority: 50,
        payload: {},
        version: '1.0.0',
        timeout_ms: 120000,
        retry_count: 0,
        max_retries: 3,
        created_at: new Date().toISOString()
      };

      await expect(agent.executeTask(mockTask)).rejects.toThrow();
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources', async () => {
      await expect(agent.cleanup()).resolves.not.toThrow();
    });
  });
});
