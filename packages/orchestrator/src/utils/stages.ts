import { z } from 'zod';

/**
 * Single source of truth for workflow stages
 * Prevents string mismatches and ensures enum-based validation
 *
 * Note: 'dependency_installation' stage added (Session #69) to install npm dependencies
 * between scaffolding and validation stages. This ensures TypeScript and other validation
 * tools have access to required modules before running checks.
 */
export const StageEnum = z.enum([
  'initialization',
  'scaffolding',
  'dependency_installation',
  'validation',
  'e2e_testing',
  'integration',
  'deployment',
  'monitoring'
]);

export type Stage = z.infer<typeof StageEnum>;

/**
 * Validation function - enforces stage is from enum
 */
export function validateStage(stage: unknown): Stage {
  const result = StageEnum.safeParse(stage);
  if (!result.success) {
    throw new Error(`Invalid stage: ${stage}. Expected one of: ${StageEnum.options.join(', ')}`);
  }
  return result.data;
}

/**
 * Get all stages for a workflow type
 * Note: dependency_installation stage added between scaffolding and validation (Session #69)
 */
export function getStagesForType(workflowType: string): Stage[] {
  const stages: Record<string, Stage[]> = {
    app: ['initialization', 'scaffolding', 'dependency_installation', 'validation', 'e2e_testing', 'integration', 'deployment', 'monitoring'],
    feature: ['initialization', 'scaffolding', 'dependency_installation', 'validation', 'e2e_testing'],
    bugfix: ['initialization', 'validation', 'e2e_testing'],
    service: ['initialization', 'scaffolding', 'dependency_installation', 'validation', 'integration', 'deployment'],
    default: ['initialization', 'scaffolding', 'dependency_installation', 'validation', 'e2e_testing', 'integration', 'deployment', 'monitoring']
  };

  return stages[workflowType] || stages.default;
}

/**
 * Get next stage in sequence
 * Table-driven approach for clarity and testability
 */
export function getNextStage(currentStage: Stage, workflowType: string): Stage | null {
  const stages = getStagesForType(workflowType);
  const currentIndex = stages.indexOf(currentStage);

  if (currentIndex === -1) {
    throw new Error(`Stage "${currentStage}" not found in stages array for type "${workflowType}"`);
  }

  const nextIndex = currentIndex + 1;
  return nextIndex < stages.length ? stages[nextIndex] : null;
}

/**
 * Get stage at index
 * Helper for diagnostics and testing
 */
export function getStageAtIndex(index: number, workflowType: string): Stage | undefined {
  const stages = getStagesForType(workflowType);
  return stages[index];
}

/**
 * Get stage index
 * Returns -1 if not found
 */
export function getStageIndex(stage: Stage, workflowType: string): number {
  const stages = getStagesForType(workflowType);
  return stages.indexOf(stage);
}
