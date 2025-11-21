#!/usr/bin/env node

/**
 * Test the Product Owner Agent with a real e-commerce scenario
 */

const axios = require('axios');
const fs = require('fs');

async function testEcommerce() {
  const envelope = {
    task_id: `ecommerce-${Date.now()}`,
    workflow_id: 'ecommerce-requirements',
    agent_type: 'product-owner',
    payload: {
      application_type: 'e-commerce',
      description: 'Multi-vendor marketplace for sustainable and eco-friendly products with focus on zero-waste lifestyle',
      industry: 'E-commerce / Sustainability',
      target_market: 'Environmentally conscious consumers aged 25-45, primarily urban professionals',
      key_features: 'Multi-vendor marketplace, product sustainability ratings, carbon footprint calculator, subscription boxes for zero-waste essentials, community forums, vendor verification system, impact tracking dashboard',
      constraints: 'Must comply with environmental certification standards, integrate with carbon offset APIs, support multiple payment methods including crypto, mobile-first responsive design'
    }
  };

  console.log('🛒 Testing Product Owner Agent with E-Commerce Scenario\n');
  console.log('=' .repeat(70));
  console.log('\n📋 Application Brief:');
  console.log('   Type:', envelope.payload.application_type);
  console.log('   Description:', envelope.payload.description);
  console.log('   Market:', envelope.payload.target_market);
  console.log('\n' + '=' .repeat(70));

  try {
    console.log('\n⏳ Generating requirements with Claude AI...\n');
    const startTime = Date.now();

    const response = await axios.post('http://localhost:3457/invoke', envelope);
    const elapsed = Date.now() - startTime;

    console.log(`✅ Requirements generated in ${(elapsed/1000).toFixed(1)} seconds\n`);

    const result = response.data.result;

    if (result.requirements) {
      const req = result.requirements;

      // Display application overview
      console.log('📱 Application Overview:');
      console.log('   Name:', req.application.name);
      console.log('   Type:', req.application.type);
      console.log('   Industry:', req.application.industry);
      console.log('   Target Users:', req.application.target_users.join(', '));

      // Display domains
      console.log('\n📦 Identified Domains:');
      console.log('   Total:', req.domains.length);

      req.domains.forEach((domain, idx) => {
        console.log(`\n   ${idx + 1}. ${domain.name}`);
        console.log(`      Context: ${domain.bounded_context}`);
        console.log(`      Description: ${domain.description}`);

        if (domain.capabilities) {
          console.log(`      Capabilities (${domain.capabilities.length}):`);
          domain.capabilities.forEach(cap => {
            const featureCount = cap.features ? cap.features.length : 0;
            console.log(`         • ${cap.name} [${cap.priority}] - ${featureCount} features`);
          });
        }

        if (domain.entities && domain.entities.length > 0) {
          console.log(`      Key Entities: ${domain.entities.slice(0, 3).join(', ')}`);
        }
      });

      // Display sample feature details
      console.log('\n🎯 Sample Feature Details:');
      for (const domain of req.domains.slice(0, 2)) {
        if (domain.capabilities && domain.capabilities[0] && domain.capabilities[0].features && domain.capabilities[0].features[0]) {
          const feature = domain.capabilities[0].features[0];
          console.log(`\n   Feature: ${feature.name}`);
          console.log(`   User Story: ${feature.user_story}`);
          console.log(`   Effort: ${feature.effort_estimate}`);
          if (feature.acceptance_criteria && feature.acceptance_criteria.length > 0) {
            console.log(`   Acceptance Criteria:`);
            feature.acceptance_criteria.slice(0, 3).forEach(ac => {
              console.log(`      ✓ ${ac}`);
            });
          }
          break;
        }
      }

      // Display non-functional requirements
      if (req.non_functional_requirements) {
        console.log('\n⚙️  Non-Functional Requirements:');
        const nfr = req.non_functional_requirements;
        if (nfr.performance && nfr.performance.length > 0) {
          console.log('   Performance:', nfr.performance[0]);
        }
        if (nfr.security && nfr.security.length > 0) {
          console.log('   Security:', nfr.security[0]);
        }
        if (nfr.scalability && nfr.scalability.length > 0) {
          console.log('   Scalability:', nfr.scalability[0]);
        }
      }

      // Display MVP scope
      if (req.mvp_scope) {
        console.log('\n🚀 MVP Scope:');
        console.log('   Timeline:', req.mvp_scope.timeline);
        if (req.mvp_scope.included_features) {
          console.log('   Included Features:', req.mvp_scope.included_features.length);
          req.mvp_scope.included_features.slice(0, 5).forEach(f => {
            console.log(`      • ${f}`);
          });
        }
        if (req.mvp_scope.excluded_features && req.mvp_scope.excluded_features.length > 0) {
          console.log('   Deferred to Later:', req.mvp_scope.excluded_features.length, 'features');
        }
      }

      // Display statistics
      console.log('\n📊 Requirements Statistics:');
      console.log('   Domains:', result.statistics.domains_count);
      console.log('   Total Capabilities:', result.statistics.total_capabilities);
      console.log('   Total Features:', result.statistics.total_features);
      console.log('   MVP Features:', result.statistics.mvp_features);
      console.log('   AI Model Used:', result.metadata.model_used);

      // Save to file
      const filename = `ecommerce-requirements-${Date.now()}.json`;
      fs.writeFileSync(filename, JSON.stringify(result, null, 2));
      console.log(`\n💾 Full requirements saved to: ${filename}`);

      // Show quality indicators
      console.log('\n✨ Quality Indicators:');
      const hasUserStories = req.domains.some(d =>
        d.capabilities?.some(c =>
          c.features?.some(f => f.user_story)
        )
      );
      const hasAcceptanceCriteria = req.domains.some(d =>
        d.capabilities?.some(c =>
          c.features?.some(f => f.acceptance_criteria && f.acceptance_criteria.length > 0)
        )
      );
      const hasDDDElements = req.domains.some(d => d.entities || d.aggregates);

      console.log(`   ✓ User Stories: ${hasUserStories ? 'Yes' : 'No'}`);
      console.log(`   ✓ Acceptance Criteria: ${hasAcceptanceCriteria ? 'Yes' : 'No'}`);
      console.log(`   ✓ DDD Elements: ${hasDDDElements ? 'Yes' : 'No'}`);
      console.log(`   ✓ Non-Functional Reqs: ${req.non_functional_requirements ? 'Yes' : 'No'}`);
      console.log(`   ✓ MVP Defined: ${req.mvp_scope ? 'Yes' : 'No'}`);

    }

    console.log('\n' + '=' .repeat(70));
    console.log('🎉 E-Commerce requirements successfully generated with AI!\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
    console.log('\n💡 Troubleshooting:');
    console.log('   1. Ensure agent is running: npm start');
    console.log('   2. Check API key is set: echo $ANTHROPIC_API_KEY');
    console.log('   3. Verify endpoint: curl http://localhost:3457/health');
  }
}

// Run the test
testEcommerce();