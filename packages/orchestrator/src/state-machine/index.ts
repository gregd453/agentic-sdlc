/**
 * State Machine Module Exports
 *
 * Central export point for state machine utilities
 */

export { WorkflowStateMachineService, createWorkflowStateMachine } from './workflow-state-machine';
export type { WorkflowContext, WorkflowEvent } from './workflow-state-machine';

// Alias for backward compatibility with test files
export { WorkflowStateMachineService as StateMachine };
