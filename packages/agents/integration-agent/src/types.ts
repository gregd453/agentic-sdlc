import { z } from 'zod';

// ============================================================================
// INTEGRATION AGENT TASK SCHEMAS
// ============================================================================

/**
 * Git merge strategy
 */
export const MergeStrategySchema = z.enum([
  'merge',      // Standard merge (creates merge commit)
  'squash',     // Squash all commits into one
  'rebase',     // Rebase feature branch onto target
  'fast-forward' // Fast-forward if possible
]);

/**
 * Conflict resolution strategy
 */
export const ConflictStrategySchema = z.enum([
  'ours',       // Keep our changes
  'theirs',     // Keep their changes
  'ai',         // Use AI to resolve intelligently
  'manual'      // Mark for manual resolution
]);

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
  conflict_type: z.enum(['content', 'rename', 'delete', 'type']),
  context: z.object({
    surrounding_lines: z.string().optional(),
    function_name: z.string().optional()
  }).optional()
});

/**
 * Branch merge task
 */
export const MergeBranchTaskSchema = z.object({
  action: z.literal('merge_branch'),
  source_branch: z.string(),
  target_branch: z.string(),
  strategy: MergeStrategySchema.default('merge'),
  auto_resolve_conflicts: z.boolean().default(false),
  conflict_strategy: ConflictStrategySchema.default('ai'),
  delete_source_after_merge: z.boolean().default(false),
  run_tests_before_merge: z.boolean().default(true)
});

/**
 * Conflict resolution task
 */
export const ResolveConflictTaskSchema = z.object({
  action: z.literal('resolve_conflict'),
  conflicts: z.array(GitConflictSchema),
  strategy: ConflictStrategySchema,
  target_branch: z.string(),
  commit_message: z.string().optional()
});

/**
 * Dependency update task
 */
export const UpdateDependenciesTaskSchema = z.object({
  action: z.literal('update_dependencies'),
  package_manager: z.enum(['npm', 'pnpm', 'yarn']),
  update_type: z.enum(['patch', 'minor', 'major', 'all']),
  packages: z.array(z.string()).optional(), // Specific packages to update
  create_pull_request: z.boolean().default(true),
  run_tests: z.boolean().default(true)
});

/**
 * Integration test execution task
 */
export const RunIntegrationTestsTaskSchema = z.object({
  action: z.literal('run_integration_tests'),
  test_suite: z.string().optional(),
  environment: z.enum(['local', 'staging', 'ci']),
  timeout_ms: z.number().default(600000),
  fail_fast: z.boolean().default(false)
});

/**
 * Combined integration agent task
 */
export const IntegrationAgentTaskSchema = z.discriminatedUnion('action', [
  MergeBranchTaskSchema,
  ResolveConflictTaskSchema,
  UpdateDependenciesTaskSchema,
  RunIntegrationTestsTaskSchema
]);

// ============================================================================
// RESULT SCHEMAS
// ============================================================================

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
  resolved_conflicts: z.array(z.object({
    file_path: z.string(),
    resolution: z.string(),
    strategy_used: ConflictStrategySchema,
    confidence: z.number().min(0).max(100)
  })),
  unresolved_conflicts: z.array(GitConflictSchema)
});

/**
 * Dependency update result
 */
export const DependencyUpdateResultSchema = z.object({
  success: z.boolean(),
  updates: z.array(z.object({
    package_name: z.string(),
    from_version: z.string(),
    to_version: z.string(),
    update_type: z.enum(['patch', 'minor', 'major'])
  })),
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
  failed_tests: z.array(z.object({
    name: z.string(),
    error: z.string()
  })).optional()
});

/**
 * Combined integration agent result
 */
export const IntegrationAgentResultSchema = z.object({
  action: z.string(),
  result: z.union([
    MergeResultSchema,
    ConflictResolutionResultSchema,
    DependencyUpdateResultSchema,
    IntegrationTestResultSchema
  ])
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type MergeStrategy = z.infer<typeof MergeStrategySchema>;
export type ConflictStrategy = z.infer<typeof ConflictStrategySchema>;
export type GitConflict = z.infer<typeof GitConflictSchema>;
export type MergeBranchTask = z.infer<typeof MergeBranchTaskSchema>;
export type ResolveConflictTask = z.infer<typeof ResolveConflictTaskSchema>;
export type UpdateDependenciesTask = z.infer<typeof UpdateDependenciesTaskSchema>;
export type RunIntegrationTestsTask = z.infer<typeof RunIntegrationTestsTaskSchema>;
export type IntegrationAgentTask = z.infer<typeof IntegrationAgentTaskSchema>;
export type MergeResult = z.infer<typeof MergeResultSchema>;
export type ConflictResolutionResult = z.infer<typeof ConflictResolutionResultSchema>;
export type DependencyUpdateResult = z.infer<typeof DependencyUpdateResultSchema>;
export type IntegrationTestResult = z.infer<typeof IntegrationTestResultSchema>;
export type IntegrationAgentResult = z.infer<typeof IntegrationAgentResultSchema>;
