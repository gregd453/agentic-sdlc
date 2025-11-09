/**
 * Integration Agent Types
 * Re-exported from @agentic-sdlc/shared-types for backward compatibility
 *
 * @deprecated Import directly from '@agentic-sdlc/shared-types' instead
 */

export {
  // Enums
  MergeStrategyEnum,
  ConflictStrategyEnum,
  IntegrationActionEnum,
  PackageManagerEnum,
  UpdateTypeEnum,
  TestEnvironmentEnum,
  ConflictTypeEnum,

  // Schemas
  GitConflictSchema,
  ResolvedConflictSchema,
  DependencyUpdateSchema,
  FailedTestSchema,
  MergeBranchPayloadSchema,
  ResolveConflictPayloadSchema,
  UpdateDependenciesPayloadSchema,
  RunIntegrationTestsPayloadSchema,
  IntegrationTaskSchema,
  MergeResultSchema,
  ConflictResolutionResultSchema,
  DependencyUpdateResultSchema,
  IntegrationTestResultSchema,
  IntegrationResultSchema,

  // Types
  type MergeStrategy,
  type ConflictStrategy,
  type IntegrationAction,
  type PackageManager,
  type UpdateType,
  type TestEnvironment,
  type ConflictType,
  type GitConflict,
  type ResolvedConflict,
  type DependencyUpdate,
  type FailedTest,
  type MergeBranchPayload,
  type ResolveConflictPayload,
  type UpdateDependenciesPayload,
  type RunIntegrationTestsPayload,
  type IntegrationTask,
  type MergeResult,
  type ConflictResolutionResult,
  type DependencyUpdateResult,
  type IntegrationTestResult,
  type IntegrationResult,

  // Type Guards
  isIntegrationTask,
  isIntegrationResult,

  // Factory Functions
  createMergeBranchTask,
  createUpdateDependenciesTask,
  createRunIntegrationTestsTask,
} from '@agentic-sdlc/shared-types';

import {
  IntegrationTaskSchema,
  IntegrationResultSchema,
  MergeBranchPayload,
  ResolveConflictPayload,
  UpdateDependenciesPayload,
  RunIntegrationTestsPayload
} from '@agentic-sdlc/shared-types';

// Legacy type aliases for backward compatibility
export type IntegrationAgentTask = import('@agentic-sdlc/shared-types').IntegrationTask;
export type IntegrationAgentResult = import('@agentic-sdlc/shared-types').IntegrationResult;
export const IntegrationAgentTaskSchema = IntegrationTaskSchema;
export const IntegrationAgentResultSchema = IntegrationResultSchema;

// Legacy task type aliases
export type MergeBranchTask = MergeBranchPayload;
export type ResolveConflictTask = ResolveConflictPayload;
export type UpdateDependenciesTask = UpdateDependenciesPayload;
export type RunIntegrationTestsTask = RunIntegrationTestsPayload;
