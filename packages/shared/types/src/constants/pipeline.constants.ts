/**
 * Pipeline Constants - Single Source of Truth
 *
 * This file contains all standardized string literals used across the pipeline.
 * Using constants instead of string literals prevents typos and ensures consistency.
 *
 * @version 1.0.0
 * @session 37
 */

// ===== Redis Channels =====

/**
 * Redis pub/sub channels for agent communication
 */
export const REDIS_CHANNELS = {
  /** Channel for orchestrator to receive agent results */
  ORCHESTRATOR_RESULTS: 'orchestrator:results',

  /** Channel pattern for agent task subscriptions: agent:{type}:tasks */
  AGENT_TASKS: (agentType: string) => `agent:${agentType}:tasks`,

  /** Registry channel for agent registration/heartbeats */
  AGENT_REGISTRY: 'agent:registry',

  /** Events channel for workflow state changes */
  WORKFLOW_EVENTS: 'workflow:events',
} as const;

// ===== Agent Types =====

/**
 * All supported agent types in the system
 */
export const AGENT_TYPES = {
  SCAFFOLD: 'scaffold',
  VALIDATION: 'validation',
  E2E: 'e2e',
  E2E_TEST: 'e2e_test', // Alias for backward compatibility
  INTEGRATION: 'integration',
  DEPLOYMENT: 'deployment',
  MONITORING: 'monitoring',
  DEBUG: 'debug',
  BASE: 'base',
} as const;

export type AgentTypeConstant = typeof AGENT_TYPES[keyof typeof AGENT_TYPES];

// ===== Workflow Stages =====

/**
 * All workflow stages in the system
 * Must match StageEnum in packages/orchestrator/src/utils/stages.ts
 */
export const WORKFLOW_STAGES = {
  INITIALIZATION: 'initialization',
  SCAFFOLDING: 'scaffolding',
  DEPENDENCY_INSTALLATION: 'dependency_installation',
  IMPLEMENTATION: 'implementation',
  VALIDATION: 'validation',
  TESTING: 'testing',
  E2E_TESTING: 'e2e_testing',
  INTEGRATION: 'integration',
  DEPLOYMENT: 'deployment',
  MONITORING: 'monitoring',
  DEBUGGING: 'debugging',
  FIXING: 'fixing',
} as const;

export type WorkflowStageConstant = typeof WORKFLOW_STAGES[keyof typeof WORKFLOW_STAGES];

// ===== Workflow Types =====

/**
 * Types of workflows supported by the system
 */
export const WORKFLOW_TYPES = {
  APP: 'app',
  SERVICE: 'service',
  FEATURE: 'feature',
  CAPABILITY: 'capability',
  BUGFIX: 'bugfix',
} as const;

export type WorkflowTypeConstant = typeof WORKFLOW_TYPES[keyof typeof WORKFLOW_TYPES];

// ===== Task Status =====

/**
 * Possible task execution statuses
 */
export const TASK_STATUS = {
  PENDING: 'pending',
  QUEUED: 'queued',
  RUNNING: 'running',
  SUCCESS: 'success',
  FAILURE: 'failure',
  FAILED: 'failed', // Alias
  PARTIAL: 'partial',
  TIMEOUT: 'timeout',
  CANCELLED: 'cancelled',
  RETRYING: 'retrying',
  BLOCKED: 'blocked',
} as const;

export type TaskStatusConstant = typeof TASK_STATUS[keyof typeof TASK_STATUS];

// ===== Workflow Status =====

/**
 * Workflow execution statuses
 * IMPORTANT: Must match Prisma schema WorkflowStatus enum
 * Session #78: Added PAUSED status for pause/resume support
 */
export const WORKFLOW_STATUS = {
  INITIATED: 'initiated',
  RUNNING: 'running',
  PAUSED: 'paused',
  SCAFFOLDING: 'scaffolding',
  VALIDATING: 'validating',
  TESTING: 'testing',
  INTEGRATING: 'integrating',
  DEPLOYING: 'deploying',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const;

export type WorkflowStatus = typeof WORKFLOW_STATUS[keyof typeof WORKFLOW_STATUS];

// ===== Priority Levels =====

/**
 * Task and workflow priority levels
 */
export const PRIORITY_LEVELS = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
} as const;

export type PriorityLevel = typeof PRIORITY_LEVELS[keyof typeof PRIORITY_LEVELS];

// ===== Event Types =====

/**
 * System event types for pub/sub and state machine
 */
export const EVENT_TYPES = {
  TASK_ASSIGNED: 'TASK_ASSIGNED',
  TASK_STARTED: 'TASK_STARTED',
  TASK_COMPLETED: 'TASK_COMPLETED',
  TASK_FAILED: 'TASK_FAILED',
  STAGE_COMPLETE: 'STAGE_COMPLETE',
  STAGE_FAILED: 'STAGE_FAILED',
  WORKFLOW_CREATED: 'WORKFLOW_CREATED',
  WORKFLOW_STARTED: 'WORKFLOW_STARTED',
  WORKFLOW_COMPLETED: 'WORKFLOW_COMPLETED',
  WORKFLOW_FAILED: 'WORKFLOW_FAILED',
  AGENT_REGISTERED: 'AGENT_REGISTERED',
  AGENT_HEARTBEAT: 'AGENT_HEARTBEAT',
} as const;

export type EventType = typeof EVENT_TYPES[keyof typeof EVENT_TYPES];

// ===== Stage to Agent Mapping =====

/**
 * Maps workflow stages to responsible agent types
 * Used by orchestrator to determine which agent to dispatch tasks to
 */
export const STAGE_TO_AGENT_MAP: Record<string, AgentTypeConstant> = {
  [WORKFLOW_STAGES.INITIALIZATION]: AGENT_TYPES.SCAFFOLD,
  [WORKFLOW_STAGES.SCAFFOLDING]: AGENT_TYPES.SCAFFOLD,
  [WORKFLOW_STAGES.DEPENDENCY_INSTALLATION]: AGENT_TYPES.SCAFFOLD,
  [WORKFLOW_STAGES.IMPLEMENTATION]: AGENT_TYPES.SCAFFOLD,
  [WORKFLOW_STAGES.VALIDATION]: AGENT_TYPES.VALIDATION,
  [WORKFLOW_STAGES.TESTING]: AGENT_TYPES.E2E_TEST,
  [WORKFLOW_STAGES.E2E_TESTING]: AGENT_TYPES.E2E_TEST,
  [WORKFLOW_STAGES.INTEGRATION]: AGENT_TYPES.INTEGRATION,
  [WORKFLOW_STAGES.DEPLOYMENT]: AGENT_TYPES.DEPLOYMENT,
  [WORKFLOW_STAGES.MONITORING]: AGENT_TYPES.MONITORING,
  [WORKFLOW_STAGES.DEBUGGING]: AGENT_TYPES.DEBUG,
  [WORKFLOW_STAGES.FIXING]: AGENT_TYPES.DEBUG,
};

// ===== Stage Sequences by Workflow Type =====

/**
 * Defines the sequence of stages for each workflow type
 * Note: dependency_installation stage added between scaffolding and validation
 * to install npm dependencies before running type checking and tests
 */
export const STAGE_SEQUENCES: Record<WorkflowTypeConstant, readonly WorkflowStageConstant[]> = {
  [WORKFLOW_TYPES.APP]: [
    WORKFLOW_STAGES.INITIALIZATION,
    WORKFLOW_STAGES.SCAFFOLDING,
    WORKFLOW_STAGES.DEPENDENCY_INSTALLATION,
    WORKFLOW_STAGES.VALIDATION,
    WORKFLOW_STAGES.E2E_TESTING,
    WORKFLOW_STAGES.INTEGRATION,
    WORKFLOW_STAGES.DEPLOYMENT,
    WORKFLOW_STAGES.MONITORING,
  ],
  [WORKFLOW_TYPES.FEATURE]: [
    WORKFLOW_STAGES.INITIALIZATION,
    WORKFLOW_STAGES.SCAFFOLDING,
    WORKFLOW_STAGES.DEPENDENCY_INSTALLATION,
    WORKFLOW_STAGES.VALIDATION,
    WORKFLOW_STAGES.E2E_TESTING,
  ],
  [WORKFLOW_TYPES.BUGFIX]: [
    WORKFLOW_STAGES.INITIALIZATION,
    WORKFLOW_STAGES.VALIDATION,
    WORKFLOW_STAGES.E2E_TESTING,
  ],
  [WORKFLOW_TYPES.SERVICE]: [
    WORKFLOW_STAGES.INITIALIZATION,
    WORKFLOW_STAGES.SCAFFOLDING,
    WORKFLOW_STAGES.DEPENDENCY_INSTALLATION,
    WORKFLOW_STAGES.VALIDATION,
    WORKFLOW_STAGES.INTEGRATION,
    WORKFLOW_STAGES.DEPLOYMENT,
  ],
  [WORKFLOW_TYPES.CAPABILITY]: [
    WORKFLOW_STAGES.INITIALIZATION,
    WORKFLOW_STAGES.IMPLEMENTATION,
    WORKFLOW_STAGES.VALIDATION,
  ],
};

// ===== Timeouts & Durations =====

/**
 * Default timeouts for various operations (in milliseconds)
 */
export const TIMEOUTS = {
  /** Default task execution timeout */
  TASK_EXECUTION: 300000, // 5 minutes

  /** Agent heartbeat interval */
  AGENT_HEARTBEAT: 30000, // 30 seconds

  /** Workflow estimated durations by type */
  WORKFLOW_DURATION: {
    [WORKFLOW_TYPES.APP]: 1800000, // 30 minutes
    [WORKFLOW_TYPES.FEATURE]: 900000, // 15 minutes
    [WORKFLOW_TYPES.BUGFIX]: 600000, // 10 minutes
    [WORKFLOW_TYPES.SERVICE]: 1200000, // 20 minutes
    [WORKFLOW_TYPES.CAPABILITY]: 600000, // 10 minutes
  },

  /** Redis operation timeout */
  REDIS_OPERATION: 5000, // 5 seconds

  /** Database query timeout */
  DATABASE_QUERY: 10000, // 10 seconds
} as const;

// ===== Retry Configuration =====

/**
 * Default retry settings for tasks
 */
export const RETRY_DEFAULTS = {
  MAX_RETRIES: 3,
  INITIAL_DELAY_MS: 1000,
  MAX_DELAY_MS: 10000,
  BACKOFF_MULTIPLIER: 2,
} as const;

// ===== Error Categories =====

/**
 * Error categories for structured error handling
 */
export const ERROR_CATEGORIES = {
  VALIDATION: 'validation',
  EXECUTION: 'execution',
  TIMEOUT: 'timeout',
  RESOURCE: 'resource',
  DEPENDENCY: 'dependency',
  CONFIGURATION: 'configuration',
  NETWORK: 'network',
  UNKNOWN: 'unknown',
} as const;

export type ErrorCategory = typeof ERROR_CATEGORIES[keyof typeof ERROR_CATEGORIES];

// ===== Envelope Version =====

/**
 * Current version of the agent envelope format
 */
export const ENVELOPE_VERSION = '1.0.0' as const;

// ===== Validation Types =====

/**
 * Types of validation checks that can be performed
 */
export const VALIDATION_TYPES = {
  TYPESCRIPT: 'typescript',
  ESLINT: 'eslint',
  PRETTIER: 'prettier',
  UNIT_TEST: 'unit_test',
  INTEGRATION_TEST: 'integration_test',
  SECURITY_SCAN: 'security_scan',
  DEPENDENCY_CHECK: 'dependency_check',
} as const;

export type ValidationTypeConstant = typeof VALIDATION_TYPES[keyof typeof VALIDATION_TYPES];

// ===== Helper Functions =====

/**
 * Get agent type for a given workflow stage
 */
export function getAgentTypeForStage(stage: string): AgentTypeConstant {
  return STAGE_TO_AGENT_MAP[stage] || AGENT_TYPES.SCAFFOLD;
}

/**
 * Get stage sequence for a workflow type
 */
export function getStageSequence(workflowType: WorkflowTypeConstant): readonly WorkflowStageConstant[] {
  return STAGE_SEQUENCES[workflowType] || STAGE_SEQUENCES[WORKFLOW_TYPES.APP];
}

/**
 * Get Redis channel for agent tasks
 */
export function getAgentTaskChannel(agentType: AgentTypeConstant): string {
  return REDIS_CHANNELS.AGENT_TASKS(agentType);
}

/**
 * Check if a status indicates success
 */
export function isSuccessStatus(status: string): boolean {
  return status === TASK_STATUS.SUCCESS || status === WORKFLOW_STATUS.COMPLETED;
}

/**
 * Check if a status indicates failure
 */
export function isFailureStatus(status: string): boolean {
  return status === TASK_STATUS.FAILURE ||
         status === TASK_STATUS.FAILED ||
         status === WORKFLOW_STATUS.FAILED;
}

/**
 * Check if a status is terminal (workflow/task is done)
 * Terminal statuses: completed, failed, cancelled, paused (no new tasks)
 * Session #78: Added paused as terminal status
 */
export function isTerminalStatus(status: string | null | undefined): boolean {
  // Defensive: handle null/undefined
  if (!status) {
    return false;
  }

  const terminalStates = [
    TASK_STATUS.SUCCESS,
    TASK_STATUS.FAILED,
    TASK_STATUS.CANCELLED,
    WORKFLOW_STATUS.COMPLETED,
    WORKFLOW_STATUS.FAILED,
    WORKFLOW_STATUS.CANCELLED,
    WORKFLOW_STATUS.PAUSED,
  ];

  return terminalStates.includes(status as any);
}
