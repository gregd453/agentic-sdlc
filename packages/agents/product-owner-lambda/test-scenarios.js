/**
 * Test scenarios for Product Owner Agent
 *
 * These represent different types of applications that need requirements
 */

const testScenarios = [
  {
    name: 'E-Commerce Platform',
    input: {
      application_type: 'e-commerce',
      description: 'Online marketplace for handmade crafts and artisan products',
      industry: 'Retail',
      target_market: 'Craft enthusiasts and artisans',
      key_features: 'Product catalog, shopping cart, payment processing, seller dashboard, reviews',
      constraints: 'Must support multiple currencies, mobile-first design'
    }
  },
  {
    name: 'Healthcare Patient Portal',
    input: {
      application_type: 'healthcare-portal',
      description: 'Patient portal for scheduling appointments and accessing medical records',
      industry: 'Healthcare',
      target_market: 'Patients and healthcare providers',
      key_features: 'Appointment scheduling, medical records access, prescription refills, secure messaging',
      constraints: 'HIPAA compliance required, must integrate with existing EHR systems'
    }
  },
  {
    name: 'SaaS Project Management Tool',
    input: {
      application_type: 'project-management',
      description: 'Collaborative project management tool for remote teams',
      industry: 'Software',
      target_market: 'Small to medium businesses with remote teams',
      key_features: 'Task management, Gantt charts, time tracking, team collaboration, reporting',
      constraints: 'Must support real-time collaboration, integrate with Slack and GitHub'
    }
  },
  {
    name: 'FinTech Mobile Banking',
    input: {
      application_type: 'mobile-banking',
      description: 'Digital-only banking app for millennials',
      industry: 'Financial Services',
      target_market: 'Tech-savvy millennials and Gen Z',
      key_features: 'Account management, money transfers, bill pay, budgeting tools, investment options',
      constraints: 'PCI DSS compliance, biometric authentication required, must support iOS and Android'
    }
  },
  {
    name: 'Educational Learning Platform',
    input: {
      application_type: 'edtech-platform',
      description: 'Online learning platform for professional certifications',
      industry: 'Education',
      target_market: 'Working professionals seeking career advancement',
      key_features: 'Course catalog, video streaming, quizzes, progress tracking, certificates',
      constraints: 'Must support offline content download, SCORM compliance'
    }
  }
];

/**
 * Expected output structure
 */
const expectedStructure = {
  application: {
    required: ['name', 'description', 'type', 'industry', 'target_users'],
    types: {
      name: 'string',
      description: 'string',
      type: 'string',
      industry: 'string',
      target_users: 'array'
    }
  },
  domains: {
    required: ['name', 'description', 'bounded_context', 'capabilities'],
    minCount: 2,
    maxCount: 10
  },
  capabilities: {
    required: ['name', 'description', 'business_value', 'priority', 'features'],
    priorities: ['critical', 'high', 'medium', 'low']
  },
  features: {
    required: ['name', 'description', 'user_story', 'acceptance_criteria'],
    effortSizes: ['small', 'medium', 'large', 'x-large']
  }
};

/**
 * Validate output structure
 */
function validateOutput(output) {
  const errors = [];

  // Check top-level structure
  if (!output.requirements) {
    errors.push('Missing requirements object');
    return errors;
  }

  const req = output.requirements;

  // Validate application section
  if (!req.application) {
    errors.push('Missing application section');
  } else {
    expectedStructure.application.required.forEach(field => {
      if (!req.application[field]) {
        errors.push(`Missing application.${field}`);
      }
    });
  }

  // Validate domains
  if (!req.domains || !Array.isArray(req.domains)) {
    errors.push('Missing or invalid domains array');
  } else {
    if (req.domains.length < expectedStructure.domains.minCount) {
      errors.push(`Too few domains (${req.domains.length} < ${expectedStructure.domains.minCount})`);
    }
    if (req.domains.length > expectedStructure.domains.maxCount) {
      errors.push(`Too many domains (${req.domains.length} > ${expectedStructure.domains.maxCount})`);
    }

    req.domains.forEach((domain, i) => {
      // Check domain fields
      expectedStructure.domains.required.forEach(field => {
        if (!domain[field]) {
          errors.push(`Missing domains[${i}].${field}`);
        }
      });

      // Check capabilities
      if (domain.capabilities && Array.isArray(domain.capabilities)) {
        domain.capabilities.forEach((cap, j) => {
          expectedStructure.capabilities.required.forEach(field => {
            if (!cap[field]) {
              errors.push(`Missing domains[${i}].capabilities[${j}].${field}`);
            }
          });

          // Validate priority
          if (cap.priority && !expectedStructure.capabilities.priorities.includes(cap.priority)) {
            errors.push(`Invalid priority: ${cap.priority}`);
          }

          // Check features
          if (cap.features && Array.isArray(cap.features)) {
            cap.features.forEach((feat, k) => {
              expectedStructure.features.required.forEach(field => {
                if (!feat[field]) {
                  errors.push(`Missing domains[${i}].capabilities[${j}].features[${k}].${field}`);
                }
              });

              // Validate effort estimate
              if (feat.effort_estimate && !expectedStructure.features.effortSizes.includes(feat.effort_estimate)) {
                errors.push(`Invalid effort_estimate: ${feat.effort_estimate}`);
              }
            });
          }
        });
      }
    });
  }

  // Check non-functional requirements
  if (!req.non_functional_requirements) {
    errors.push('Missing non_functional_requirements');
  }

  // Check MVP scope
  if (!req.mvp_scope) {
    errors.push('Missing mvp_scope');
  }

  return errors;
}

/**
 * Test the agent with various scenarios
 */
async function runTests() {
  const axios = require('axios');
  const baseUrl = 'http://localhost:3457';

  console.log('🧪 Testing Product Owner Agent\n');
  console.log('=' .repeat(60));

  // Check if server is running
  try {
    const health = await axios.get(`${baseUrl}/health`);
    console.log('✅ Agent is healthy:', health.data);
    console.log('=' .repeat(60));
  } catch (error) {
    console.log('❌ Agent not running. Start it with: npm start');
    return;
  }

  // Test each scenario
  for (const scenario of testScenarios) {
    console.log(`\n📋 Testing: ${scenario.name}`);
    console.log('-' .repeat(40));

    const envelope = {
      task_id: `test-${Date.now()}`,
      workflow_id: 'test-workflow',
      agent_type: 'product-owner',
      payload: scenario.input
    };

    try {
      console.log('📤 Sending request...');
      const start = Date.now();
      const response = await axios.post(`${baseUrl}/invoke`, envelope);
      const elapsed = Date.now() - start;

      console.log(`⏱️  Response time: ${elapsed}ms`);

      const result = response.data.result;

      // Validate structure
      const errors = validateOutput(result);
      if (errors.length === 0) {
        console.log('✅ Valid structure');
      } else {
        console.log('⚠️  Validation errors:', errors.slice(0, 3).join(', '));
      }

      // Show statistics
      if (result.statistics) {
        console.log('📊 Statistics:');
        console.log(`   - Domains: ${result.statistics.domains_count}`);
        console.log(`   - Capabilities: ${result.statistics.total_capabilities}`);
        console.log(`   - Features: ${result.statistics.total_features}`);
        console.log(`   - MVP Features: ${result.statistics.mvp_features}`);
      }

      // Show sample output
      if (result.requirements && result.requirements.domains && result.requirements.domains[0]) {
        const firstDomain = result.requirements.domains[0];
        console.log('\n📦 Sample Domain:', firstDomain.name);
        console.log(`   Context: ${firstDomain.bounded_context}`);
        console.log(`   Capabilities: ${firstDomain.capabilities.map(c => c.name).join(', ')}`);

        if (firstDomain.capabilities[0] && firstDomain.capabilities[0].features[0]) {
          const firstFeature = firstDomain.capabilities[0].features[0];
          console.log('\n🎯 Sample Feature:', firstFeature.name);
          console.log(`   Story: ${firstFeature.user_story}`);
          console.log(`   Effort: ${firstFeature.effort_estimate}`);
        }
      }

    } catch (error) {
      console.log('❌ Error:', error.message);
      if (error.response && error.response.data) {
        console.log('   Response:', error.response.data);
      }
    }
  }

  console.log('\n' + '=' .repeat(60));
  console.log('🏁 Testing complete!\n');
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { testScenarios, validateOutput };