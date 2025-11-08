/**
 * Integration Agent - Entry Point
 * Handles branch merging, AI-powered conflict resolution, dependency updates, and integration testing
 */

export { IntegrationAgent } from './integration-agent';
export * from './types';
export { GitService } from './services/git.service';
export { ConflictResolverService } from './services/conflict-resolver.service';
export { DependencyUpdaterService } from './services/dependency-updater.service';
export { IntegrationTestRunnerService } from './services/integration-test-runner.service';
