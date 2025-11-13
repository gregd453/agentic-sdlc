import { BaseAgent } from '@agentic-sdlc/base-agent';
import {
  IntegrationTask,
  IntegrationResult,
  IntegrationTaskSchema,
  IntegrationResultSchema,
  MergeBranchPayload,
  ResolveConflictPayload,
  UpdateDependenciesPayload,
  RunIntegrationTestsPayload
} from '@agentic-sdlc/shared-types';
import { GitService } from './services/git.service';
import { ConflictResolverService } from './services/conflict-resolver.service';
import { DependencyUpdaterService } from './services/dependency-updater.service';
import { IntegrationTestRunnerService } from './services/integration-test-runner.service';

/**
 * Integration Agent
 * Handles branch merging, AI-powered conflict resolution, dependency updates, and integration testing
 */
export class IntegrationAgent extends BaseAgent {
  private gitService: GitService;
  private conflictResolver: ConflictResolverService;
  private dependencyUpdater: DependencyUpdaterService;
  private testRunner: IntegrationTestRunnerService;

  constructor(messageBus: any, repoPath: string = process.cwd()) {
    super(
      {
        type: 'integration',
        version: '1.0.0',
        capabilities: [
          'branch_merging',
          'conflict_resolution',
          'dependency_updates',
          'integration_testing'
        ]
      },
      messageBus
    );

    this.gitService = new GitService(repoPath);
    this.conflictResolver = new ConflictResolverService(this.anthropic);
    this.dependencyUpdater = new DependencyUpdaterService(repoPath);
    this.testRunner = new IntegrationTestRunnerService(repoPath);
  }

  /**
   * Execute integration agent task
   */
  async executeTask(task: IntegrationTask): Promise<IntegrationResult> {
    const startTime = Date.now();
    const traceId = this.generateTraceId();

    // Validate task
    const validatedTask = IntegrationTaskSchema.parse(task);

    this.logger.info('Executing integration task', {
      action: validatedTask.action,
      trace_id: traceId
    });

    try {
      let result;

      switch (validatedTask.action) {
        case 'merge_branch':
          result = await this.handleMergeBranch(validatedTask.payload as MergeBranchPayload);
          break;

        case 'resolve_conflict':
          result = await this.handleResolveConflict(validatedTask.payload as ResolveConflictPayload);
          break;

        case 'update_dependencies':
          result = await this.handleUpdateDependencies(validatedTask.payload as UpdateDependenciesPayload);
          break;

        case 'run_integration_tests':
          result = await this.handleRunIntegrationTests(validatedTask.payload as RunIntegrationTestsPayload);
          break;

        default:
          throw new Error(`Unknown action: ${(validatedTask as any).action}`);
      }

      const duration = Date.now() - startTime;

      this.logger.info('Integration task completed', {
        action: validatedTask.action,
        duration_ms: duration,
        trace_id: traceId
      });

      return IntegrationResultSchema.parse({
        task_id: validatedTask.task_id,
        workflow_id: validatedTask.workflow_id,
        agent_type: 'integration',
        action: validatedTask.action,
        status: 'completed',
        result,
        timestamp: new Date().toISOString(),
        duration_ms: duration
      });

    } catch (error) {
      this.logger.error('Integration task failed', {
        action: validatedTask.action,
        error: error instanceof Error ? error.message : 'Unknown error',
        trace_id: traceId
      });

      throw error;
    }
  }

  /**
   * Handle branch merge task
   */
  private async handleMergeBranch(payload: MergeBranchPayload) {
    this.logger.info('Starting branch merge', {
      source: payload.source_branch,
      target: payload.target_branch,
      strategy: payload.strategy
    });

    // Create backup branch before merge
    const backupBranch = `backup/${payload.source_branch}-${Date.now()}`;
    await this.gitService.createBranch(backupBranch);

    try {
      // Run tests before merge if requested
      if (payload.run_tests_before_merge) {
        const testResult = await this.testRunner.runTests();
        if (!testResult.success) {
          throw new Error('Tests failed before merge');
        }
      }

      // Attempt merge
      const mergeResult = await this.gitService.mergeBranch(
        payload.source_branch,
        payload.target_branch,
        payload.strategy
      );

      // Handle conflicts if any
      if (mergeResult.conflicts.length > 0 && payload.auto_resolve_conflicts) {
        this.logger.info('Conflicts detected, attempting resolution', {
          count: mergeResult.conflicts.length
        });

        const resolvedConflicts = [];
        const unresolvedConflicts = [];

        for (const conflict of mergeResult.conflicts) {
          const resolution = await this.conflictResolver.resolveConflict(
            conflict,
            payload.conflict_strategy
          );

          if (resolution.confidence >= 85) {
            // Auto-apply high-confidence resolutions
            await this.gitService.applyResolution(
              conflict.file_path,
              resolution.resolved_content
            );
            resolvedConflicts.push({
              file_path: conflict.file_path,
              resolution: resolution.resolved_content,
              strategy_used: payload.conflict_strategy,
              confidence: resolution.confidence
            });
          } else {
            // Mark for manual review
            unresolvedConflicts.push(conflict);
          }
        }

        // If all conflicts resolved, commit
        if (unresolvedConflicts.length === 0) {
          await this.gitService.createCommit(
            `Merge ${payload.source_branch} into ${payload.target_branch} with AI-resolved conflicts`
          );

          return {
            success: true,
            merge_commit: await this.gitService.getCurrentCommitSha(),
            conflicts_resolved: resolvedConflicts.length,
            conflicts_remaining: 0,
            files_changed: mergeResult.files_changed,
            rollback_performed: false
          };
        } else {
          // Partial resolution
          return {
            success: false,
            conflicts_resolved: resolvedConflicts.length,
            conflicts_remaining: unresolvedConflicts.length,
            files_changed: mergeResult.files_changed,
            conflicts: unresolvedConflicts,
            rollback_performed: false
          };
        }
      }

      // No conflicts or auto-resolve disabled
      if (mergeResult.conflicts.length === 0) {
        // Delete source branch if requested
        if (payload.delete_source_after_merge) {
          await this.gitService.deleteBranch(payload.source_branch);
        }

        return {
          success: true,
          merge_commit: mergeResult.merge_commit,
          conflicts_resolved: 0,
          conflicts_remaining: 0,
          files_changed: mergeResult.files_changed,
          rollback_performed: false
        };
      }

      return {
        success: false,
        conflicts_resolved: 0,
        conflicts_remaining: mergeResult.conflicts.length,
        files_changed: mergeResult.files_changed,
        conflicts: mergeResult.conflicts,
        rollback_performed: false
      };

    } catch (error) {
      this.logger.error('Merge failed, rolling back', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      // Rollback to backup branch
      await this.gitService.resetToCommit(backupBranch);

      return {
        success: false,
        conflicts_resolved: 0,
        conflicts_remaining: 0,
        files_changed: 0,
        rollback_performed: true
      };
    }
  }

  /**
   * Handle conflict resolution task
   */
  private async handleResolveConflict(payload: ResolveConflictPayload) {
    this.logger.info('Resolving conflicts', {
      count: payload.conflicts.length,
      strategy: payload.strategy
    });

    const resolvedConflicts = [];
    const unresolvedConflicts = [];

    for (const conflict of payload.conflicts) {
      try {
        const resolution = await this.conflictResolver.resolveConflict(
          conflict,
          payload.strategy
        );

        if (resolution.confidence >= 70) {
          await this.gitService.applyResolution(
            conflict.file_path,
            resolution.resolved_content
          );

          resolvedConflicts.push({
            file_path: conflict.file_path,
            resolution: resolution.resolved_content,
            strategy_used: payload.strategy,
            confidence: resolution.confidence
          });
        } else {
          unresolvedConflicts.push(conflict);
        }
      } catch (error) {
        this.logger.error('Failed to resolve conflict', {
          file: conflict.file_path,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        unresolvedConflicts.push(conflict);
      }
    }

    // Commit resolved conflicts
    if (resolvedConflicts.length > 0 && unresolvedConflicts.length === 0) {
      await this.gitService.createCommit(
        payload.commit_message || 'Resolve conflicts using AI'
      );
    }

    return {
      success: unresolvedConflicts.length === 0,
      resolved_conflicts: resolvedConflicts,
      unresolved_conflicts: unresolvedConflicts
    };
  }

  /**
   * Handle dependency update task
   */
  private async handleUpdateDependencies(payload: UpdateDependenciesPayload) {
    this.logger.info('Updating dependencies', {
      package_manager: payload.package_manager,
      update_type: payload.update_type
    });

    // Get current commit SHA for potential rollback
    const beforeUpdateSha = await this.gitService.getCurrentCommitSha();

    try {
      // Perform updates
      const updates = await this.dependencyUpdater.updateDependencies(
        payload.package_manager,
        payload.update_type,
        payload.packages
      );

      // Run tests if requested
      if (payload.run_tests) {
        const testResult = await this.testRunner.runTests();

        if (!testResult.success) {
          // Rollback on test failure
          await this.gitService.resetToCommit(beforeUpdateSha);

          return {
            success: false,
            updates,
            tests_passed: false
          };
        }
      }

      // Create PR if requested
      let prUrl;
      if (payload.create_pull_request) {
        prUrl = await this.dependencyUpdater.createPullRequest(
          updates,
          payload.update_type
        );
      }

      return {
        success: true,
        updates,
        tests_passed: payload.run_tests,
        pull_request_url: prUrl
      };

    } catch (error) {
      this.logger.error('Dependency update failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      // Rollback to before update
      await this.gitService.resetToCommit(beforeUpdateSha);

      throw error;
    }
  }

  /**
   * Handle integration test execution task
   */
  private async handleRunIntegrationTests(payload: RunIntegrationTestsPayload) {
    this.logger.info('Running integration tests', {
      environment: payload.environment,
      test_suite: payload.test_suite
    });

    const result = await this.testRunner.runTests(
      payload.test_suite,
      payload.environment,
      {
        timeout: payload.timeout_ms,
        failFast: payload.fail_fast
      }
    );

    return result;
  }

  /**
   * Generate trace ID for request tracking
   */
  protected generateTraceId(): string {
    return `int-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Execute method required by BaseAgent
   * Wraps executeTask for compatibility
   */
  async execute(task: any): Promise<any> {
    const result = await this.executeTask(task);
    return {
      task_id: task.task_id || this.generateTraceId(),
      workflow_id: task.workflow_id || 'integration-workflow',
      status: result.result.success ? 'success' : 'failure',
      output: result,
      errors: result.result.success ? [] : ['Task execution failed']
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    this.logger.info('Cleaning up IntegrationAgent');
    await super.cleanup();
  }
}
