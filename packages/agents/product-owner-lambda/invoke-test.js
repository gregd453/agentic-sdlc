#!/usr/bin/env node

/**
 * Quick invocation test for Product Owner Agent
 */

const axios = require('axios');

async function invokeProductOwner() {
  const envelope = {
    task_id: `test-${Date.now()}`,
    workflow_id: 'requirements-workflow',
    agent_type: 'product-owner',
    payload: {
      application_type: 'project-management',
      description: 'Agile project management tool for distributed teams',
      industry: 'Software Development',
      target_market: 'Software development teams, scrum masters, product owners',
      key_features: 'Sprint planning, backlog management, burndown charts, team collaboration, integrations',
      constraints: 'Must integrate with GitHub and Slack, support real-time updates'
    }
  };

  try {
    console.log('🚀 Invoking Product Owner Agent...\n');
    console.log('Input:', JSON.stringify(envelope.payload, null, 2));
    console.log('\n' + '='.repeat(60) + '\n');

    const response = await axios.post('http://localhost:3457/invoke', envelope);
    const result = response.data.result;

    console.log('✅ Requirements Generated!\n');

    // Display summary
    if (result.requirements) {
      const req = result.requirements;

      console.log('📱 Application:', req.application.name);
      console.log('   Type:', req.application.type);
      console.log('   Industry:', req.application.industry);
      console.log('\n📦 Domains:');

      req.domains.forEach(domain => {
        console.log(`\n   ${domain.name} (${domain.bounded_context})`);
        console.log(`   └─ ${domain.description}`);

        domain.capabilities.forEach(cap => {
          console.log(`      📌 ${cap.name} [${cap.priority}]`);
          cap.features.forEach(feat => {
            console.log(`         • ${feat.name} (${feat.effort_estimate})`);
          });
        });
      });

      console.log('\n🎯 MVP Scope:');
      console.log('   Timeline:', req.mvp_scope.timeline);
      console.log('   Included:', req.mvp_scope.included_features.join(', '));

      console.log('\n📊 Statistics:');
      console.log('   Domains:', result.statistics.domains_count);
      console.log('   Capabilities:', result.statistics.total_capabilities);
      console.log('   Features:', result.statistics.total_features);
    }

    // Save to file
    const fs = require('fs');
    const filename = `requirements-${Date.now()}.json`;
    fs.writeFileSync(filename, JSON.stringify(result, null, 2));
    console.log(`\n💾 Full requirements saved to: ${filename}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    console.log('\n🔧 Make sure the agent is running: npm start');
  }
}

// Run the test
invokeProductOwner();