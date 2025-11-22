/**
 * Product Owner Lambda Agent
 *
 * Generates application requirements using Domain-Driven Design principles:
 * - Domains: Bounded contexts representing major business areas
 * - Capabilities: Business capabilities within each domain
 * - Features: Specific implementable features for each capability
 *
 * Extends BaseAgent to use shared LLM functionality
 */

import { BaseAgent } from '@agentic-sdlc/base-agent';
import type { IMessageBus } from '@agentic-sdlc/orchestrator';
import {
  AgentEnvelope,
  TaskResult,
  AgentCapabilities
} from '@agentic-sdlc/base-agent';
import { randomUUID } from 'crypto';

/**
 * Requirements Schema Interface
 */
interface Requirements {
  application: {
    name: string;
    description: string;
    type: string;
    industry: string;
    target_users: string[];
  };
  domains: Domain[];
  non_functional_requirements: {
    performance: string[];
    security: string[];
    scalability: string[];
    usability: string[];
    compliance: string[];
  };
  technical_constraints: string[];
  assumptions: string[];
  risks: string[];
  success_metrics: string[];
  mvp_scope: {
    included_features: string[];
    excluded_features: string[];
    timeline: string;
  };
}

interface Domain {
  name: string;
  description: string;
  bounded_context: string;
  capabilities: Capability[];
  entities: string[];
  value_objects: string[];
  aggregates: string[];
}

interface Capability {
  name: string;
  description: string;
  business_value: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  features: Feature[];
}

interface Feature {
  name: string;
  description: string;
  user_story: string;
  acceptance_criteria: string[];
  technical_considerations: string[];
  effort_estimate: 'small' | 'medium' | 'large' | 'x-large';
  dependencies: string[];
}

interface RequirementsInput {
  application_type: string;
  description: string;
  industry?: string;
  target_market?: string;
  key_features?: string;
  constraints?: string;
}

export class ProductOwnerAgent extends BaseAgent {
  constructor(messageBus: IMessageBus, platformId?: string) {
    const capabilities: AgentCapabilities = {
      type: 'product-owner',
      version: '1.0.0',
      capabilities: [
        'requirements-generation',
        'ddd-design',
        'user-story-creation',
        'mvp-scoping'
      ]
    };

    super(capabilities, messageBus, undefined, undefined, undefined, platformId);
  }

  async execute(task: AgentEnvelope): Promise<TaskResult> {
    const startTime = Date.now();
    const { task_id, workflow_id, payload } = task;

    this.logger.info('Product Owner Agent executing requirements generation', {
      task_id,
      workflow_id,
      input: payload
    });

    try {
      // Extract input from payload
      const input = payload as unknown as RequirementsInput;

      // Generate requirements using BaseAgent's LLM
      const requirements = await this.generateRequirements(input);

      // Calculate statistics
      const statistics = {
        domains_count: requirements.domains.length,
        total_capabilities: requirements.domains.reduce((acc, d) => acc + d.capabilities.length, 0),
        total_features: requirements.domains.reduce((acc, d) =>
          acc + d.capabilities.reduce((acc2, c) => acc2 + c.features.length, 0), 0
        ),
        mvp_features: requirements.mvp_scope.included_features.length
      };

      const duration = Date.now() - startTime;

      this.logger.info('Requirements generated successfully', {
        task_id,
        workflow_id,
        statistics,
        duration_ms: duration
      });

      return {
        message_id: randomUUID(),
        task_id,
        workflow_id,
        agent_id: this.agentId,
        status: 'success',
        result: {
          data: {
            requirements,
            metadata: {
              generated_at: new Date().toISOString(),
              generator: 'product-owner-agent',
              version: '1.0.0',
              model_used: 'claude-haiku-4-5'
            },
            statistics
          },
          metrics: {
            duration_ms: duration
          }
        },
        metadata: {
          completed_at: new Date().toISOString(),
          trace_id: task.trace.trace_id
        }
      };

    } catch (error) {
      const duration = Date.now() - startTime;

      this.logger.error('Requirements generation failed', {
        task_id,
        workflow_id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });

      // Fallback to template-based generation
      try {
        const fallbackRequirements = this.generateFallbackRequirements(payload as unknown as RequirementsInput);

        return {
          message_id: randomUUID(),
          task_id,
          workflow_id,
          agent_id: this.agentId,
          status: 'success',
          result: {
            data: {
              requirements: fallbackRequirements,
              metadata: {
                generated_at: new Date().toISOString(),
                generator: 'product-owner-agent',
                version: '1.0.0',
                model_used: 'fallback-template'
              },
              statistics: {
                domains_count: fallbackRequirements.domains.length,
                total_capabilities: fallbackRequirements.domains.reduce((acc, d) => acc + d.capabilities.length, 0),
                total_features: 2,
                mvp_features: 2
              }
            },
            metrics: {
              duration_ms: duration
            }
          },
          metadata: {
            completed_at: new Date().toISOString(),
            trace_id: task.trace.trace_id
          }
        };
      } catch (fallbackError) {
        return {
          message_id: randomUUID(),
          task_id,
          workflow_id,
          agent_id: this.agentId,
          status: 'failure',
          result: {
            data: {},
            metrics: {
              duration_ms: duration
            }
          },
          errors: [{
            code: 'REQUIREMENTS_GENERATION_FAILED',
            message: error instanceof Error ? error.message : String(error),
            recoverable: false
          }],
          metadata: {
            completed_at: new Date().toISOString(),
            trace_id: task.trace.trace_id
          }
        };
      }
    }
  }

  /**
   * Generate requirements using Claude via BaseAgent's callClaude method
   */
  private async generateRequirements(input: RequirementsInput): Promise<Requirements> {
    const {
      application_type,
      description,
      industry,
      target_market,
      key_features,
      constraints
    } = input;

    const systemPrompt = `You are an expert Product Owner and Domain-Driven Design practitioner.
Generate comprehensive application requirements following DDD principles.
Focus on identifying bounded contexts, business capabilities, and implementable features.
Ensure all output is practical, actionable, and follows software engineering best practices.

IMPORTANT: Respond ONLY with valid JSON. Do not include any markdown formatting, code blocks, or explanatory text.`;

    const userPrompt = `Generate detailed requirements for:
Application Type: ${application_type}
Description: ${description}
Industry: ${industry || 'General'}
Target Market: ${target_market || 'General users'}
Key Features Requested: ${key_features || 'Standard features for this application type'}
Constraints: ${constraints || 'None specified'}

Please provide:
1. Identify 3-5 distinct domains (bounded contexts)
2. For each domain, identify 2-4 business capabilities
3. For each capability, define 2-5 specific features
4. Include user stories and acceptance criteria
5. Consider technical constraints and dependencies
6. Define MVP scope
7. Include non-functional requirements

Respond with ONLY a JSON object (no markdown, no code blocks) matching this structure:
{
  "application": {
    "name": "string",
    "description": "string",
    "type": "string",
    "industry": "string",
    "target_users": ["string"]
  },
  "domains": [
    {
      "name": "string",
      "description": "string",
      "bounded_context": "string",
      "capabilities": [
        {
          "name": "string",
          "description": "string",
          "business_value": "string",
          "priority": "critical|high|medium|low",
          "features": [
            {
              "name": "string",
              "description": "string",
              "user_story": "string",
              "acceptance_criteria": ["string"],
              "technical_considerations": ["string"],
              "effort_estimate": "small|medium|large|x-large",
              "dependencies": ["string"]
            }
          ]
        }
      ],
      "entities": ["string"],
      "value_objects": ["string"],
      "aggregates": ["string"]
    }
  ],
  "non_functional_requirements": {
    "performance": ["string"],
    "security": ["string"],
    "scalability": ["string"],
    "usability": ["string"],
    "compliance": ["string"]
  },
  "technical_constraints": ["string"],
  "assumptions": ["string"],
  "risks": ["string"],
  "success_metrics": ["string"],
  "mvp_scope": {
    "included_features": ["string"],
    "excluded_features": ["string"],
    "timeline": "string"
  }
}`;

    // Use BaseAgent's callClaude method with circuit breaker and retry logic
    const response = await this.callClaude(userPrompt, systemPrompt, 4000);

    // Parse the JSON response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No valid JSON found in Claude response');
    }

    const requirements = JSON.parse(jsonMatch[0]) as Requirements;
    return requirements;
  }

  /**
   * Fallback requirements generator (without AI)
   */
  private generateFallbackRequirements(input: RequirementsInput): Requirements {
    const { application_type, description, industry } = input;

    return {
      application: {
        name: `${application_type} Application`,
        description: description || 'Application requirements',
        type: application_type,
        industry: industry || 'General',
        target_users: ['End Users', 'Administrators']
      },
      domains: [
        {
          name: 'User Management',
          description: 'Handles user authentication, authorization, and profile management',
          bounded_context: 'UserContext',
          capabilities: [
            {
              name: 'Authentication',
              description: 'User login and session management',
              business_value: 'Secure access control',
              priority: 'critical',
              features: [
                {
                  name: 'User Login',
                  description: 'Allow users to authenticate with credentials',
                  user_story: 'As a user, I want to log in securely so that I can access my account',
                  acceptance_criteria: [
                    'Users can login with email and password',
                    'Failed login attempts are logged',
                    'Session tokens expire after inactivity'
                  ],
                  technical_considerations: ['JWT tokens', 'Password hashing with bcrypt'],
                  effort_estimate: 'medium',
                  dependencies: ['Database setup']
                }
              ]
            }
          ],
          entities: ['User', 'Profile', 'Session'],
          value_objects: ['Email', 'Password', 'UserId'],
          aggregates: ['UserAggregate']
        },
        {
          name: 'Core Business',
          description: `Main ${application_type} functionality`,
          bounded_context: 'CoreContext',
          capabilities: [
            {
              name: 'Core Features',
              description: 'Primary business functionality',
              business_value: 'Main value proposition',
              priority: 'critical',
              features: [
                {
                  name: 'Primary Function',
                  description: `Main ${application_type} feature`,
                  user_story: `As a user, I want to use the core ${application_type} functionality`,
                  acceptance_criteria: ['Feature works as expected'],
                  technical_considerations: ['Performance optimization'],
                  effort_estimate: 'large',
                  dependencies: ['User Management']
                }
              ]
            }
          ],
          entities: ['BusinessEntity'],
          value_objects: ['BusinessValue'],
          aggregates: ['BusinessAggregate']
        }
      ],
      non_functional_requirements: {
        performance: ['Page load time < 2 seconds', 'API response time < 200ms'],
        security: ['HTTPS encryption', 'OWASP top 10 compliance'],
        scalability: ['Support 10,000 concurrent users', 'Horizontal scaling capability'],
        usability: ['Mobile responsive', 'WCAG 2.1 AA compliance'],
        compliance: ['GDPR compliance', 'SOC 2 Type II']
      },
      technical_constraints: [
        'Must run on AWS infrastructure',
        'PostgreSQL database',
        'React frontend framework'
      ],
      assumptions: [
        'Users have modern web browsers',
        'Internet connectivity available'
      ],
      risks: [
        'Third-party API dependencies',
        'Scalability bottlenecks'
      ],
      success_metrics: [
        'User adoption rate > 80%',
        'System uptime > 99.9%',
        'User satisfaction score > 4.5/5'
      ],
      mvp_scope: {
        included_features: ['User Management', 'Core Features'],
        excluded_features: ['Advanced Analytics', 'Third-party Integrations'],
        timeline: '3 months'
      }
    };
  }
}
