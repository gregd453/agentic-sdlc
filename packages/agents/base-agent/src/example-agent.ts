import type { IMessageBus } from '@agentic-sdlc/orchestrator';
import { BaseAgent } from './base-agent';
import { TaskAssignment, TaskResult } from './types';

/**
 * Example agent implementation showing how to extend BaseAgent
 * This agent analyzes requirements and generates a structured response
 *
 * Phase 3: Updated to require messageBus parameter
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

  async execute(task: TaskAssignment): Promise<TaskResult> {
    const startTime = Date.now();

    this.logger.info('Executing example task', {
      task_id: task.task_id,
      type: task.type,
      name: task.name
    });

    try {
      // Example: Analyze requirements using Claude
      const systemPrompt = `You are an AI agent that analyzes requirements and generates structured responses.
Your task is to analyze the given requirements and provide a clear, actionable response.`;

      const prompt = `Task: ${task.name}
Description: ${task.description}
Requirements: ${task.requirements}

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

      return {
        task_id: task.task_id,
        workflow_id: task.workflow_id,
        status: 'success',
        output: {
          analysis: analysisResult,
          processed_at: new Date().toISOString(),
          agent_id: this.agentId
        },
        metrics: {
          duration_ms: duration,
          tokens_used: response.length / 4, // Rough estimate
          api_calls: 1
        }
      };

    } catch (error) {
      this.logger.error('Task execution failed', {
        task_id: task.task_id,
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        task_id: task.task_id,
        workflow_id: task.workflow_id,
        status: 'failure',
        output: {},
        errors: [error instanceof Error ? error.message : 'Unknown error occurred'],
        metrics: {
          duration_ms: Date.now() - startTime
        }
      };
    }
  }
}