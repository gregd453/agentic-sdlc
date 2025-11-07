/**
 * Integration Example: Decision & Clarification with Orchestrator
 *
 * This example demonstrates how the Decision and Clarification engines
 * integrate with the orchestrator service for workflow management.
 */

import { DecisionEngine, DecisionRequest, DecisionCategory } from '../core/decisions';
import { ClarificationEngine, evaluateClarificationNeed } from '../core/clarify';
import { join } from 'path';

// Use absolute paths for policy and runs directories
const POLICY_PATH = join(__dirname, '../backlog/policy.yaml');
const RUNS_DIR = join(__dirname, '../runs');

/**
 * Example 1: Decision Flow in Workflow Transition
 *
 * When an agent proposes an action that impacts security or cost,
 * the orchestrator evaluates if a decision is required.
 */
async function exampleWorkflowDecision() {
  console.log('\n=== Example 1: Workflow Decision ===\n');

  // Agent proposes deploying new authentication system
  const request: DecisionRequest = {
    workflow_id: 'WF-2025-1107-001',
    item_id: 'BI-2025-00123',
    category: 'security_affecting',
    action: 'Deploy new OAuth2 authentication system with JWT tokens',
    confidence: 0.88,
    trace_id: 'T-123456',
    context: {
      estimated_cost_per_month: 150,
      breaking_changes: false,
      rollback_available: true,
    },
  };

  // Orchestrator evaluates the decision
  const engine = new DecisionEngine(POLICY_PATH, RUNS_DIR);
  const evaluation = engine.evaluate(request);

  console.log('Decision Evaluation Results:');
  console.log(`  Requires Human Approval: ${evaluation.requires_human_approval}`);
  console.log(`  Auto-Approved: ${evaluation.auto_approved}`);
  console.log(`  Should Escalate: ${evaluation.should_escalate}`);

  if (evaluation.requires_human_approval) {
    console.log('\n  ⚠️  Workflow paused - awaiting operator decision');
    console.log(`  Decision ID: ${evaluation.decision.decision_id}`);
    console.log(`  Options available: ${evaluation.decision.options.length}`);

    // In real implementation:
    // 1. Persist workflow state (paused at 'awaiting_decision')
    // 2. Send notification to operator via webhook/email
    // 3. CLI operator runs: cc-agentic decisions show --id DEC-2025-00001
    // 4. Operator makes decision interactively
    // 5. Orchestrator receives decision result and resumes workflow
  } else {
    console.log('\n  ✅ Decision auto-approved - workflow continues');
  }
}

/**
 * Example 2: Clarification Flow for Ambiguous Requirements
 *
 * When requirements are unclear, the orchestrator requests clarification
 * before proceeding with implementation.
 */
async function exampleRequirementClarification() {
  console.log('\n=== Example 2: Requirement Clarification ===\n');

  const requirements = 'Build a dashboard with some charts and maybe add filters';
  const acceptanceCriteria = ['Dashboard works'];
  const confidence = 0.62; // Low confidence due to ambiguity

  // Orchestrator evaluates if clarification is needed
  const evaluation = evaluateClarificationNeed(
    requirements,
    acceptanceCriteria,
    confidence
  );

  console.log('Clarification Evaluation Results:');
  console.log(`  Needs Clarification: ${evaluation.needs_clarification}`);
  console.log(`  Confidence: ${(evaluation.confidence * 100).toFixed(1)}%`);
  console.log(`  Ambiguities: ${evaluation.ambiguities.length}`);
  console.log(`  Missing Criteria: ${evaluation.missing_criteria.length}`);

  if (evaluation.needs_clarification) {
    console.log('\n  ⚠️  Workflow paused - clarification required');

    evaluation.ambiguities.forEach((amb, i) => {
      console.log(`    ${i + 1}. ${amb}`);
    });

    // In real implementation:
    // 1. Pause workflow at 'awaiting_clarification' state
    // 2. Create clarification request with generated questions
    // 3. Notify product owner / stakeholder
    // 4. Operator answers via CLI: cc-agentic clarify answer --id CLR-2025-00001
    // 5. Orchestrator receives answers and updates requirements
    // 6. Re-run confidence check, proceed if > threshold
  } else {
    console.log('\n  ✅ Requirements clear - workflow continues');
  }
}

/**
 * Example 3: Integration with State Machine
 *
 * Shows how decision/clarification fits into the workflow state machine.
 */
async function exampleStateMachineIntegration() {
  console.log('\n=== Example 3: State Machine Integration ===\n');

  // Workflow states with decision/clarification gates
  const workflowStates = {
    initiated: {
      next: ['requirements_clarification', 'planning'],
      gates: ['clarification_if_needed'],
    },
    requirements_clarification: {
      next: ['planning'],
      gates: [],
      blocking: true, // Blocks until clarification complete
    },
    planning: {
      next: ['awaiting_decision', 'implementation'],
      gates: ['decision_if_high_impact'],
    },
    awaiting_decision: {
      next: ['implementation', 'revised', 'aborted'],
      gates: [],
      blocking: true, // Blocks until operator decides
    },
    implementation: {
      next: ['testing'],
      gates: [],
    },
  };

  console.log('Workflow State Machine with Decision/Clarification Gates:');
  console.log(JSON.stringify(workflowStates, null, 2));

  console.log('\nExample Flow:');
  console.log('  1. initiated → [clarification gate] → requirements_clarification');
  console.log('  2. requirements_clarification → [answers provided] → planning');
  console.log('  3. planning → [decision gate] → awaiting_decision');
  console.log('  4. awaiting_decision → [operator approves] → implementation');
  console.log('  5. implementation → testing → ...');
}

/**
 * Example 4: Non-Interactive Mode (CI/CD)
 *
 * Shows how the system behaves in automated CI/CD pipelines.
 */
async function exampleNonInteractiveMode() {
  console.log('\n=== Example 4: Non-Interactive Mode (CI/CD) ===\n');

  const request: DecisionRequest = {
    workflow_id: 'WF-2025-1107-002',
    item_id: 'BI-2025-00124',
    category: 'technical_refactor',
    action: 'Refactor user service for better testability',
    confidence: 0.91, // High confidence
    trace_id: 'T-123457',
  };

  const engine = new DecisionEngine(POLICY_PATH, RUNS_DIR);
  const evaluation = engine.evaluate(request);

  if (evaluation.auto_approved) {
    console.log('✅ CI/CD Pipeline: Auto-approved - continuing deployment');
    console.log(`   Decision ID: ${evaluation.decision.decision_id}`);
    console.log('   Exit code: 0');
  } else {
    console.log('❌ CI/CD Pipeline: Human approval required');
    console.log('   Exit code: 10');
    console.log('   Action: Workflow paused, notification sent to operator');
    console.log('   Next: Operator must run decision CLI to approve/reject');
  }
}

/**
 * Run all examples
 */
async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  Agentic SDLC - Decision & Clarification Integration Examples  ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  await exampleWorkflowDecision();
  await exampleRequirementClarification();
  await exampleStateMachineIntegration();
  await exampleNonInteractiveMode();

  console.log('\n' + '='.repeat(70));
  console.log('Examples completed successfully!');
  console.log('='.repeat(70) + '\n');
}

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Error running examples:', error);
    process.exit(1);
  });
}

export {
  exampleWorkflowDecision,
  exampleRequirementClarification,
  exampleStateMachineIntegration,
  exampleNonInteractiveMode,
};
