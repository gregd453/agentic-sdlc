import { z } from 'zod';
import { AgentTaskSchema, AgentResultSchema } from '../core/schemas';

/**
 * Integration Agent specific schemas
 * Handles Git merging, conflict resolution, dependency updates, and integration testing
 */

// ===== Enums =====

/**
 * Git merge strategy
 */
export const MergeStrategyEnum = z.enum([
  'merge',      // Standard merge (creates merge commit)
  'squash',     // Squash all commits into one
  'rebase',     // Rebase feature branch onto target
  'fast-forward' // Fast-forward if possible
]);

/**
 * Conflict resolution strategy
 */
export const ConflictStrategyEnum = z.enum([
  'ours',       // Keep our changes
  'theirs',     // Keep their changes
  'ai',         // Use AI to resolve intelligently
  'manual'      // Mark for manual resolution
]);

/**
 * Integration action types
 */
export const IntegrationActionEnum = z.enum([
  'merge_branch',
  'resolve_conflict',
  'update_dependencies',
  'run_integration_tests'
]);

/**
 * Package manager types
 */
export const PackageManagerEnum = z.enum(['npm', 'pnpm', 'yarn']);

/**
 * Dependency update types
 */
export const UpdateTypeEnum = z.enum(['patch', 'minor', 'major', 'all']);

/**
 * Test environment types
 */
export const TestEnvironmentEnum = z.enum(['local', 'staging', 'ci']);

/**
 * Conflict types
 */
export const ConflictTypeEnum = z.enum(['content', 'rename', 'delete', 'type']);

// ===== Supporting Schemas =====

/**
 * Git conflict information
 */
export const GitConflictSchema = z.object({
  file_path: z.string(),
  conflict_markers: z.object({
    ours: z.string(),
    theirs: z.string(),
    base: z.string().optional()
  }),
  conflict_type: ConflictTypeEnum,
  context: z.object({
    surrounding_lines: z.string().optional(),
    function_name: z.string().optional()
  }).optional()
});

/**
 * Resolved conflict information
 */
export const ResolvedConflictSchema = z.object({
  file_path: z.string(),
  resolution: z.string(),
  strategy_used: ConflictStrategyEnum,
  confidence: z.number().min(0).max(100)
});

/**
 * Dependency update information
 */
export const DependencyUpdateSchema = z.object({
  package_name: z.string(),
  from_version: z.string(),
  to_version: z.string(),
  update_type: UpdateTypeEnum
});

/**
 * Failed test information
 */
export const FailedTestSchema = z.object({
  name: z.string(),
  error: z.string()
});

// ===== Task Schemas =====

/**
 * Branch merge task payload
 */
export const MergeBranchPayloadSchema = z.object({
  source_branch: z.string(),
  target_branch: z.string(),
  strategy: MergeStrategyEnum.default('merge'),
  auto_resolve_conflicts: z.boolean().default(false),
  conflict_strategy: ConflictStrategyEnum.default('ai'),
  delete_source_after_merge: z.boolean().default(false),
  run_tests_before_merge: z.boolean().default(true)
});

/**
 * Conflict resolution task payload
 */
export const ResolveConflictPayloadSchema = z.object({
  conflicts: z.array(GitConflictSchema),
  strategy: ConflictStrategyEnum,
  target_branch: z.string(),
  commit_message: z.string().optional()
});

/**
 * Dependency update task payload
 */
export const UpdateDependenciesPayloadSchema = z.object({
  package_manager: PackageManagerEnum,
  update_type: UpdateTypeEnum,
  packages: z.array(z.string()).optional(), // Specific packages to update
  create_pull_request: z.boolean().default(true),
  run_tests: z.boolean().default(true)
});

/**
 * Integration test execution task payload
 */
export const RunIntegrationTestsPayloadSchema = z.object({
  test_suite: z.string().optional(),
  environment: TestEnvironmentEnum,
  timeout_ms: z.number().default(600000),
  fail_fast: z.boolean().default(false)
});

// ===== Integration Task Schema =====

/**
 * Main Integration Agent Task Schema
 * Extends the base AgentTaskSchema with integration-specific fields
 */
export const IntegrationTaskSchema = AgentTaskSchema.extend({
  agent_type: z.literal(AGENT_TYPES.INTEGRATION),
  action: IntegrationActionEnum,
  payload: z.union([
    MergeBranchPayloadSchema,
    ResolveConflictPayloadSchema,
    UpdateDependenciesPayloadSchema,
    RunIntegrationTestsPayloadSchema
  ])
});

// ===== Result Schemas =====

/**
 * Merge result
 */
export const MergeResultSchema = z.object({
  success: z.boolean(),
  merge_commit: z.string().optional(),
  conflicts_resolved: z.number(),
  conflicts_remaining: z.number(),
  files_changed: z.number(),
  conflicts: z.array(GitConflictSchema).optional(),
  rollback_performed: z.boolean().default(false)
});

/**
 * Conflict resolution result
 */
export const ConflictResolutionResultSchema = z.object({
  success: z.boolean(),
  resolved_conflicts: z.array(ResolvedConflictSchema),
  unresolved_conflicts: z.array(GitConflictSchema)
});

/**
 * Dependency update result
 */
export const DependencyUpdateResultSchema = z.object({
  success: z.boolean(),
  updates: z.array(DependencyUpdateSchema),
  tests_passed: z.boolean(),
  pull_request_url: z.string().optional()
});

/**
 * Integration test result
 */
export const IntegrationTestResultSchema = z.object({
  success: z.boolean(),
  total_tests: z.number(),
  passed: z.number(),
  failed: z.number(),
  skipped: z.number(),
  duration_ms: z.number(),
  failed_tests: z.array(FailedTestSchema).optional()
});

// ===== Integration Result Schema =====

/**
 * Main Integration Agent Result Schema
 * Extends the base AgentResultSchema with integration-specific results
 */
export const IntegrationResultSchema = AgentResultSchema.extend({
  agent_type: z.literal(AGENT_TYPES.INTEGRATION),
  action: IntegrationActionEnum,
  result: z.union([
    MergeResultSchema,
    ConflictResolutionResultSchema,
    DependencyUpdateResultSchema,
    IntegrationTestResultSchema
  ])
});

// ===== Type Exports =====
export type MergeStrategy = z.infer<typeof MergeStrategyEnum>;
export type ConflictStrategy = z.infer<typeof ConflictStrategyEnum>;
export type IntegrationAction = z.infer<typeof IntegrationActionEnum>;
export type PackageManager = z.infer<typeof PackageManagerEnum>;
export type UpdateType = z.infer<typeof UpdateTypeEnum>;
export type TestEnvironment = z.infer<typeof TestEnvironmentEnum>;
export type ConflictType = z.infer<typeof ConflictTypeEnum>;

export type GitConflict = z.infer<typeof GitConflictSchema>;
export type ResolvedConflict = z.infer<typeof ResolvedConflictSchema>;
export type DependencyUpdate = z.infer<typeof DependencyUpdateSchema>;
export type FailedTest = z.infer<typeof FailedTestSchema>;

export type MergeBranchPayload = z.infer<typeof MergeBranchPayloadSchema>;
export type ResolveConflictPayload = z.infer<typeof ResolveConflictPayloadSchema>;
export type UpdateDependenciesPayload = z.infer<typeof UpdateDependenciesPayloadSchema>;
export type RunIntegrationTestsPayload = z.infer<typeof RunIntegrationTestsPayloadSchema>;

export type IntegrationTask = z.infer<typeof IntegrationTaskSchema>;
export type MergeResult = z.infer<typeof MergeResultSchema>;
export type ConflictResolutionResult = z.infer<typeof ConflictResolutionResultSchema>;
export type DependencyUpdateResult = z.infer<typeof DependencyUpdateResultSchema>;
export type IntegrationTestResult = z.infer<typeof IntegrationTestResultSchema>;
export type IntegrationResult = z.infer<typeof IntegrationResultSchema>;

// ===== Type Guards =====
export function isIntegrationTask(task: unknown): task is IntegrationTask {
  return IntegrationTaskSchema.safeParse(task).success;
}

export function isIntegrationResult(result: unknown): result is IntegrationResult {
  return IntegrationResultSchema.safeParse(result).success;
}

// ===== Factory Functions =====

/**
 * Create a merge branch task
 */
export function createMergeBranchTask(
  workflowId: string,
  sourceBranch: string,
  targetBranch: string,
  options?: Partial<MergeBranchPayload>
): IntegrationTask {
  const now = new Date().toISOString();
  return {
    task_id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` as any,
    workflow_id: workflowId as any,
    agent_type: AGENT_TYPES.INTEGRATION,
    action: 'merge_branch',
    status: TASK_STATUS.PENDING,
    priority: 50,
    payload: {
      source_branch: sourceBranch,
      target_branch: targetBranch,
      strategy: 'merge',
      auto_resolve_conflicts: false,
      conflict_strategy: 'ai',
      delete_source_after_merge: false,
      run_tests_before_merge: true,
      ...options
    },
    version: '1.0.0',
    timeout_ms: 300000,
    retry_count: 0,
    max_retries: 3,
    created_at: now,
  };
}

/**
 * Create an update dependencies task
 */
export function createUpdateDependenciesTask(
  workflowId: string,
  packageManager: PackageManager,
  updateType: UpdateType,
  options?: Partial<UpdateDependenciesPayload>
): IntegrationTask {
  const now = new Date().toISOString();
  return {
    task_id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` as any,
    workflow_id: workflowId as any,
    agent_type: AGENT_TYPES.INTEGRATION,
    action: 'update_dependencies',
    status: TASK_STATUS.PENDING,
    priority: 50,
    payload: {
      package_manager: packageManager,
      update_type: updateType,
      create_pull_request: true,
      run_tests: true,
      ...options
    },
    version: '1.0.0',
    timeout_ms: 600000,
    retry_count: 0,
    max_retries: 3,
    created_at: now,
  };
}

/**
 * Create a run integration tests task
 */
export function createRunIntegrationTestsTask(
  workflowId: string,
  environment: TestEnvironment,
  options?: Partial<RunIntegrationTestsPayload>
): IntegrationTask {
  const now = new Date().toISOString();
  return {
    task_id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` as any,
    workflow_id: workflowId as any,
    agent_type: AGENT_TYPES.INTEGRATION,
    action: 'run_integration_tests',
    status: TASK_STATUS.PENDING,
    priority: 50,
    payload: {
      environment,
      timeout_ms: 600000,
      fail_fast: false,
      ...options
    },
    version: '1.0.0',
    timeout_ms: 600000,
    retry_count: 0,
    max_retries: 3,
    created_at: now,
  };
}
