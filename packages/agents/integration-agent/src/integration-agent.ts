import { BaseAgent } from '@agentic-sdlc/base-agent';
import {
  IntegrationAgentTask,
  IntegrationAgentResult,
  IntegrationAgentTaskSchema,
  IntegrationAgentResultSchema,
  MergeBranchTask,
  ResolveConflictTask,
  UpdateDependenciesTask,
  RunIntegrationTestsTask
} from './types';
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

  constructor(repoPath: string = process.cwd()) {
    super({
      type: 'integration',
      version: '1.0.0',
      capabilities: [
        'branch_merging',
        'conflict_resolution',
        'dependency_updates',
        'integration_testing'
      ]
    });

    this.gitService = new GitService(repoPath);
    this.conflictResolver = new ConflictResolverService(this.anthropic);
    this.dependencyUpdater = new DependencyUpdaterService(repoPath);
    this.testRunner = new IntegrationTestRunnerService(repoPath);
  }

  /**
   * Execute integration agent task
   */
  async executeTask(task: IntegrationAgentTask): Promise<IntegrationAgentResult> {
    const startTime = Date.now();
    const traceId = this.generateTraceId();

    // Validate task
    const validatedTask = IntegrationAgentTaskSchema.parse(task);

    this.logger.info('Executing integration task', {
      action: validatedTask.action,
      trace_id: traceId
    });

    try {
      let result;

      switch (validatedTask.action) {
        case 'merge_branch':
          result = await this.handleMergeBranch(validatedTask);
          break;

        case 'resolve_conflict':
          result = await this.handleResolveConflict(validatedTask);
          break;

        case 'update_dependencies':
          result = await this.handleUpdateDependencies(validatedTask);
          break;

        case 'run_integration_tests':
          result = await this.handleRunIntegrationTests(validatedTask);
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

      return IntegrationAgentResultSchema.parse({
        action: validatedTask.action,
        result
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
  private async handleMergeBranch(task: MergeBranchTask) {
    this.logger.info('Starting branch merge', {
      source: task.source_branch,
      target: task.target_branch,
      strategy: task.strategy
    });

    // Create backup branch before merge
    const backupBranch = `backup/${task.source_branch}-${Date.now()}`;
    await this.gitService.createBranch(backupBranch);

    try {
      // Run tests before merge if requested
      if (task.run_tests_before_merge) {
        const testResult = await this.testRunner.runTests();
        if (!testResult.success) {
          throw new Error('Tests failed before merge');
        }
      }

      // Attempt merge
      const mergeResult = await this.gitService.mergeBranch(
        task.source_branch,
        task.target_branch,
        task.strategy
      );

      // Handle conflicts if any
      if (mergeResult.conflicts.length > 0 && task.auto_resolve_conflicts) {
        this.logger.info('Conflicts detected, attempting resolution', {
          count: mergeResult.conflicts.length
        });

        const resolvedConflicts = [];
        const unresolvedConflicts = [];

        for (const conflict of mergeResult.conflicts) {
          const resolution = await this.conflictResolver.resolveConflict(
            conflict,
            task.conflict_strategy
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
              strategy_used: task.conflict_strategy,
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
            `Merge ${task.source_branch} into ${task.target_branch} with AI-resolved conflicts`
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
        if (task.delete_source_after_merge) {
          await this.gitService.deleteBranch(task.source_branch);
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
  private async handleResolveConflict(task: ResolveConflictTask) {
    this.logger.info('Resolving conflicts', {
      count: task.conflicts.length,
      strategy: task.strategy
    });

    const resolvedConflicts = [];
    const unresolvedConflicts = [];

    for (const conflict of task.conflicts) {
      try {
        const resolution = await this.conflictResolver.resolveConflict(
          conflict,
          task.strategy
        );

        if (resolution.confidence >= 70) {
          await this.gitService.applyResolution(
            conflict.file_path,
            resolution.resolved_content
          );

          resolvedConflicts.push({
            file_path: conflict.file_path,
            resolution: resolution.resolved_content,
            strategy_used: task.strategy,
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
        task.commit_message || 'Resolve conflicts using AI'
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
  private async handleUpdateDependencies(task: UpdateDependenciesTask) {
    this.logger.info('Updating dependencies', {
      package_manager: task.package_manager,
      update_type: task.update_type
    });

    // Get current commit SHA for potential rollback
    const beforeUpdateSha = await this.gitService.getCurrentCommitSha();

    try {
      // Perform updates
      const updates = await this.dependencyUpdater.updateDependencies(
        task.package_manager,
        task.update_type,
        task.packages
      );

      // Run tests if requested
      if (task.run_tests) {
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
      if (task.create_pull_request) {
        prUrl = await this.dependencyUpdater.createPullRequest(
          updates,
          task.update_type
        );
      }

      return {
        success: true,
        updates,
        tests_passed: task.run_tests,
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
  private async handleRunIntegrationTests(task: RunIntegrationTestsTask) {
    this.logger.info('Running integration tests', {
      environment: task.environment,
      test_suite: task.test_suite
    });

    const result = await this.testRunner.runTests(
      task.test_suite,
      task.environment,
      {
        timeout: task.timeout_ms,
        failFast: task.fail_fast
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
