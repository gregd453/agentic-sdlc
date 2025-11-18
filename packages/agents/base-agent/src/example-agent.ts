import type { IMessageBus } from '@agentic-sdlc/orchestrator';
import { BaseAgent } from './base-agent';
import { AgentEnvelope, TaskResult } from './types';

/**
 * Example agent implementation showing how to extend BaseAgent
 * This agent analyzes requirements and generates a structured response
 *
 * SESSION #65: Updated to use AgentEnvelope v2.0.0
 */
export class ExampleAgent extends BaseAgent {
  constructor(messageBus: IMessageBus) {
    super(
      {
        type: 'example',
        version: '1.0.0',
        capabilities: ['analyze', 'generate', 'validate']
      },
      messageBus
    );
  }

  async execute(task: AgentEnvelope): Promise<TaskResult> {
    const startTime = Date.now();

    // SESSION #65: Extract task data from payload (AgentEnvelope v2.0.0)
    const taskData = task.payload as any;

    this.logger.info('Executing example task', {
      task_id: task.task_id,
      agent_type: task.agent_type,
      payload: taskData
    });

    try {
      // Example: Analyze requirements using Claude
      const systemPrompt = `You are an AI agent that analyzes requirements and generates structured responses.
Your task is to analyze the given requirements and provide a clear, actionable response.`;

      const prompt = `Task: ${taskData.name || 'Untitled'}
Description: ${taskData.description || 'No description'}
Requirements: ${Array.isArray(taskData.requirements) ? taskData.requirements.join(', ') : taskData.requirements || 'None'}

Please analyze these requirements and provide:
1. A summary of the main objectives
2. Key components or features identified
3. Any potential challenges or considerations
4. Suggested next steps

Format your response as JSON.`;

      const response = await this.callClaude(prompt, systemPrompt);

      // Parse Claude's response
      let analysisResult;
      try {
        analysisResult = JSON.parse(response);
      } catch {
        // If not valid JSON, wrap in object
        analysisResult = { analysis: response };
      }

      const duration = Date.now() - startTime;

      this.logger.info('Task completed successfully', {
        task_id: task.task_id,
        duration_ms: duration
      });

      // SESSION #65: Return result using canonical schema structure
      return {
        message_id: task.message_id,
        task_id: task.task_id,
        workflow_id: task.workflow_id,
        agent_id: this.agentId,
        status: WORKFLOW_STATUS.SUCCESS,
        result: {
          data: {
            analysis: analysisResult,
            processed_at: new Date().toISOString(),
            agent_id: this.agentId
          },
          metrics: {
            duration_ms: duration,
            resource_usage: {
              tokens_used: response.length / 4, // Rough estimate
              api_calls: 1
            }
          }
        },
        metadata: {
          completed_at: new Date().toISOString(),
          trace_id: task.trace.trace_id
        }
      };

    } catch (error) {
      this.logger.error('Task execution failed', {
        task_id: task.task_id,
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        message_id: task.message_id,
        task_id: task.task_id,
        workflow_id: task.workflow_id,
        agent_id: this.agentId,
        status: 'failure',
        result: {
          data: {},
          metrics: {
            duration_ms: Date.now() - startTime
          }
        },
        errors: [{
          code: 'TASK_EXECUTION_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error occurred',
          recoverable: true
        }],
        metadata: {
          completed_at: new Date().toISOString(),
          trace_id: task.trace.trace_id
        }
      };
    }
  }
}