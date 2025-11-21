/**
 * Product Owner Lambda Agent
 *
 * Generates application requirements using Domain-Driven Design principles:
 * - Domains: Bounded contexts representing major business areas
 * - Capabilities: Business capabilities within each domain
 * - Features: Specific implementable features for each capability
 *
 * Uses Anthropic Claude for intelligent requirement generation
 */

const Redis = require('ioredis');
const Anthropic = require('@anthropic-ai/sdk');

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || 'your-key-here'
});

/**
 * Requirements Schema
 */
const requirementsSchema = {
  application: {
    name: 'string',
    description: 'string',
    type: 'string', // web, mobile, api, microservice, etc.
    industry: 'string',
    target_users: ['string']
  },
  domains: [
    {
      name: 'string',
      description: 'string',
      bounded_context: 'string',
      capabilities: [
        {
          name: 'string',
          description: 'string',
          business_value: 'string',
          priority: 'string', // critical, high, medium, low
          features: [
            {
              name: 'string',
              description: 'string',
              user_story: 'string',
              acceptance_criteria: ['string'],
              technical_considerations: ['string'],
              effort_estimate: 'string', // small, medium, large, x-large
              dependencies: ['string']
            }
          ]
        }
      ],
      entities: ['string'], // Core domain entities
      value_objects: ['string'],
      aggregates: ['string']
    }
  ],
  non_functional_requirements: {
    performance: ['string'],
    security: ['string'],
    scalability: ['string'],
    usability: ['string'],
    compliance: ['string']
  },
  technical_constraints: ['string'],
  assumptions: ['string'],
  risks: ['string'],
  success_metrics: ['string'],
  mvp_scope: {
    included_features: ['string'],
    excluded_features: ['string'],
    timeline: 'string'
  }
};

/**
 * Generate requirements using Claude
 */
async function generateRequirements(input) {
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
Ensure all output is practical, actionable, and follows software engineering best practices.`;

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

Format as JSON matching the requirements schema.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022', // Updated to latest model
      max_tokens: 4000,
      temperature: 0.7,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: userPrompt
      }]
    });

    // Parse Claude's response
    const content = response.content[0].text;

    // Extract JSON from response (Claude sometimes includes explanation text)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No valid JSON found in response');
    }

    const requirements = JSON.parse(jsonMatch[0]);
    return requirements;
  } catch (error) {
    console.error('Error generating requirements:', error);
    // Return a fallback template if Claude fails
    return generateFallbackRequirements(input);
  }
}

/**
 * Fallback requirements generator (without AI)
 */
function generateFallbackRequirements(input) {
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
              },
              {
                name: 'Password Reset',
                description: 'Allow users to reset forgotten passwords',
                user_story: 'As a user, I want to reset my password if I forget it',
                acceptance_criteria: [
                  'Email verification required',
                  'Temporary reset link expires in 24 hours',
                  'Old password invalidated after reset'
                ],
                technical_considerations: ['Email service integration'],
                effort_estimate: 'small',
                dependencies: ['User Login']
              }
            ]
          },
          {
            name: 'Profile Management',
            description: 'User profile creation and updates',
            business_value: 'Personalized user experience',
            priority: 'high',
            features: [
              {
                name: 'Profile Creation',
                description: 'Create and edit user profiles',
                user_story: 'As a user, I want to create my profile to personalize my experience',
                acceptance_criteria: [
                  'Required fields validation',
                  'Profile photo upload',
                  'Email verification'
                ],
                technical_considerations: ['File storage for photos'],
                effort_estimate: 'medium',
                dependencies: ['User Login']
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

/**
 * Lambda handler
 */
exports.handler = async (event, context) => {
  console.log('Product Owner Agent received request:', JSON.stringify(event, null, 2));

  // Parse the AgentEnvelope
  const envelope = typeof event.body === 'string' ? JSON.parse(event.body) : event;
  const { task_id, workflow_id, payload } = envelope;

  try {
    // Generate requirements based on payload
    const requirements = await generateRequirements(payload);

    // Enhance with metadata
    const result = {
      task_id,
      workflow_id,
      status: 'completed',
      result: {
        requirements,
        metadata: {
          generated_at: new Date().toISOString(),
          generator: 'product-owner-agent',
          version: '1.0.0',
          model_used: process.env.ANTHROPIC_API_KEY ? 'claude-3-sonnet' : 'fallback-template'
        },
        statistics: {
          domains_count: requirements.domains.length,
          total_capabilities: requirements.domains.reduce((acc, d) => acc + d.capabilities.length, 0),
          total_features: requirements.domains.reduce((acc, d) =>
            acc + d.capabilities.reduce((acc2, c) => acc2 + c.features.length, 0), 0
          ),
          mvp_features: requirements.mvp_scope.included_features.length
        }
      }
    };

    // Publish to Redis if configured
    if (process.env.REDIS_URL) {
      try {
        const redis = new Redis(process.env.REDIS_URL);
        await redis.publish(`workflow:${workflow_id}:results`, JSON.stringify(result));
        await redis.publish(`requirements:generated`, JSON.stringify(result));
        await redis.quit();
        console.log('Published requirements to Redis');
      } catch (error) {
        console.error('Redis publish failed:', error);
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result)
    };

  } catch (error) {
    console.error('Error processing request:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task_id,
        status: 'failed',
        error: error.message
      })
    };
  }
};

/**
 * Local development server
 */
if (require.main === module) {
  const express = require('express');
  const app = express();
  app.use(express.json());

  app.post('/invoke', async (req, res) => {
    const mockContext = {
      requestId: 'local-' + Date.now(),
      functionName: 'product-owner-agent'
    };

    try {
      const result = await exports.handler(req.body, mockContext);
      res.status(result.statusCode).json(JSON.parse(result.body));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/health', (req, res) => {
    res.json({ status: 'healthy', agent: 'product-owner', model: process.env.ANTHROPIC_API_KEY ? 'claude' : 'template' });
  });

  const PORT = process.env.PORT || 3457;
  app.listen(PORT, () => {
    console.log(`Product Owner Agent running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`Invoke endpoint: http://localhost:${PORT}/invoke`);
  });
}