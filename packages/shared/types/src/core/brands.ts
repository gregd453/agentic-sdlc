/**
 * Type branding for compile-time safety
 * Prevents mixing different ID types at compile time
 */

// Branded types for IDs
export type WorkflowId = string & { __brand: 'WorkflowId' };
export type AgentId = string & { __brand: 'AgentId' };
export type TaskId = string & { __brand: 'TaskId' };
export type PipelineId = string & { __brand: 'PipelineId' };
export type StageId = string & { __brand: 'StageId' };

// Helper functions to create branded types
export const toWorkflowId = (id: string): WorkflowId => id as WorkflowId;
export const toAgentId = (id: string): AgentId => id as AgentId;
export const toTaskId = (id: string): TaskId => id as TaskId;
export const toPipelineId = (id: string): PipelineId => id as PipelineId;
export const toStageId = (id: string): StageId => id as StageId;

// Validation helpers
export const isWorkflowId = (id: unknown): id is WorkflowId => {
  return typeof id === 'string' && id.length > 0;
};

export const isAgentId = (id: unknown): id is AgentId => {
  return typeof id === 'string' && id.length > 0;
};

export const isTaskId = (id: unknown): id is TaskId => {
  return typeof id === 'string' && id.length > 0;
};

// ID generation helpers
export const generateWorkflowId = (): WorkflowId => {
  return toWorkflowId(`wf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
};

export const generateTaskId = (): TaskId => {
  return toTaskId(`task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
};

export const generateAgentId = (type: string): AgentId => {
  return toAgentId(`${type}_agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
};