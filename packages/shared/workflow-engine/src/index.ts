/**
 * @agentic-sdlc/workflow-engine
 * Workflow definition and execution engine for composable stage-based workflows
 */

export {
  WorkflowEngine,
  WorkflowEngineError,
  createWorkflowEngine
} from './workflow-engine';

export {
  WorkflowLoader,
  WorkflowLoaderError,
  createWorkflowLoader
} from './workflow-loader';

export type {
  WorkflowDefinition,
  WorkflowContext,
  StageConfig,
  StageResult,
  StageOutcome,
  WorkflowResult,
  DataFlow
} from './workflow-schema';

export {
  validateWorkflowDefinition,
  validateStageConfig,
  DEFAULT_WORKFLOW_CONFIG,
  WorkflowSchemaError,
  StageOutcomeSchema,
  StageConfigSchema,
  WorkflowDefinitionSchema,
  WorkflowContextSchema,
  StageResultSchema,
  WorkflowResultSchema
} from './workflow-schema';

export {
  JSONPathMapper,
  JSONPathError
} from './jsonpath-mapper';
