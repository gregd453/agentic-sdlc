import {
  MergeResult,
  ConflictResolutionResult,
  DependencyUpdateResult,
  IntegrationTestResult,
  GitConflict,
  ConflictStrategy
} from '../types';

/**
 * Mock factory for MergeResult
 */
export function createMockMergeResult(overrides?: Partial<MergeResult>): MergeResult {
  return {
    success: true,
    merge_commit: 'abc123',
    conflicts_resolved: 0,
    conflicts_remaining: 0,
    files_changed: 5,
    conflicts: [],
    rollback_performed: false,
    ...overrides
  };
}

/**
 * Mock factory for ConflictResolutionResult
 */
export function createMockConflictResolutionResult(
  overrides?: Partial<ConflictResolutionResult>
): ConflictResolutionResult {
  return {
    success: true,
    resolved_conflicts: [],
    unresolved_conflicts: [],
    ...overrides
  };
}

/**
 * Mock factory for single conflict resolution
 */
export function createMockResolvedConflict(overrides?: {
  file_path?: string;
  resolution?: string;
  strategy_used?: ConflictStrategy;
  confidence?: number;
}) {
  return {
    file_path: 'src/index.ts',
    resolution: 'const x = 2;',
    strategy_used: 'ai' as ConflictStrategy,
    confidence: 95,
    ...overrides
  };
}

/**
 * Mock factory for DependencyUpdateResult
 */
export function createMockDependencyUpdateResult(
  overrides?: Partial<DependencyUpdateResult>
): DependencyUpdateResult {
  return {
    success: true,
    updates: [],
    tests_passed: true,
    pull_request_url: undefined,
    ...overrides
  };
}

/**
 * Mock factory for single dependency update
 */
export function createMockDependencyUpdate(overrides?: {
  package_name?: string;
  from_version?: string;
  to_version?: string;
  update_type?: 'patch' | 'minor' | 'major';
}) {
  return {
    package_name: 'vitest',
    from_version: '1.0.0',
    to_version: '1.1.0',
    update_type: 'minor' as const,
    ...overrides
  };
}

/**
 * Mock factory for IntegrationTestResult
 */
export function createMockIntegrationTestResult(
  overrides?: Partial<IntegrationTestResult>
): IntegrationTestResult {
  return {
    success: true,
    total_tests: 10,
    passed: 10,
    failed: 0,
    skipped: 0,
    duration_ms: 5000,
    failed_tests: undefined,
    ...overrides
  };
}

/**
 * Mock factory for GitConflict
 */
export function createMockGitConflict(overrides?: Partial<GitConflict>): GitConflict {
  return {
    file_path: 'src/index.ts',
    conflict_markers: {
      ours: 'const x = 1;',
      theirs: 'const x = 2;'
    },
    conflict_type: 'content',
    context: undefined,
    ...overrides
  };
}
