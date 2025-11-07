/**
 * CLI Handler for Decision Commands
 * Usage: cc agentic decisions <subcommand>
 */

import {
  DecisionEngine,
  DecisionRequest,
  DecisionResult,
  evaluateDecision,
  recordOperatorDecision,
} from '../core/decisions';
import * as readline from 'readline';

/**
 * CLI Interface for interactive prompts
 */
class DecisionCLI {
  private rl: readline.Interface;
  private engine: DecisionEngine;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    this.engine = new DecisionEngine();
  }

  /**
   * Close readline interface
   */
  close(): void {
    this.rl.close();
  }

  /**
   * Prompt user for input
   */
  private prompt(question: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(question, (answer) => {
        resolve(answer.trim());
      });
    });
  }

  /**
   * Display decision prompt to operator
   */
  private displayDecision(decision: DecisionResult): void {
    console.log('\n' + '='.repeat(80));
    console.log('🔔 DECISION REQUIRED');
    console.log('='.repeat(80));
    console.log(`Decision ID: ${decision.decision_id}`);
    console.log(`Workflow: ${decision.workflow_id}`);
    console.log(`Item: ${decision.item_id}`);
    console.log(`Category: ${decision.category}`);
    console.log(`Confidence: ${(decision.confidence * 100).toFixed(1)}%`);
    console.log('\n📋 Action:');
    console.log(`  ${decision.action}`);
    console.log('\n⚠️  Options:');
    decision.options.forEach((option, index) => {
      console.log(`\n  [${index + 1}] ${option.label}`);
      console.log(`      ${option.description}`);
      console.log(`      Risks: ${option.risks.join(', ')}`);
      console.log(`      Time: ${option.estimated_time}, Cost: ${option.estimated_cost}`);
    });
    console.log('\n💡 Recommendation:', decision.recommendation);
    console.log('='.repeat(80) + '\n');
  }

  /**
   * Interactive decision flow
   */
  async interactiveDecision(decision: DecisionResult, operator: string): Promise<DecisionResult> {
    this.displayDecision(decision);

    // Get operator choice
    const choice = await this.prompt(
      `Select option [1-${decision.options.length}] or 'q' to quit: `
    );

    if (choice.toLowerCase() === 'q') {
      console.log('Decision aborted by operator');
      process.exit(0);
    }

    const optionIndex = parseInt(choice, 10) - 1;
    if (isNaN(optionIndex) || optionIndex < 0 || optionIndex >= decision.options.length) {
      console.log('❌ Invalid option. Please try again.');
      return this.interactiveDecision(decision, operator);
    }

    const selected_option = decision.options[optionIndex].option_id;

    // Get rationale
    const rationale = await this.prompt('Enter rationale (optional): ');

    // Record decision
    const recorded = this.engine.recordDecision(
      decision,
      selected_option,
      operator,
      rationale || undefined
    );

    console.log(`\n✅ Decision recorded: ${recorded.status}`);
    console.log(`   Decision ID: ${recorded.decision_id}`);
    console.log(`   Selected: ${selected_option}`);
    console.log(`   File: ops/agentic/runs/${new Date().toISOString().split('T')[0]}/${recorded.decision_id}.json\n`);

    return recorded;
  }

  /**
   * Evaluate command - evaluate a decision request
   */
  async evaluate(opts: {
    workflowId: string;
    itemId: string;
    category: string;
    action: string;
    confidence: number;
    operator: string;
    nonInteractive?: boolean;
  }): Promise<number> {
    try {
      const request: DecisionRequest = {
        workflow_id: opts.workflowId,
        item_id: opts.itemId,
        category: opts.category as any,
        action: opts.action,
        confidence: opts.confidence,
        trace_id: `T-${Date.now()}`,
      };

      const evaluation = this.engine.evaluate(request);

      console.log('\n📊 Decision Evaluation:');
      console.log(`   Requires Human Approval: ${evaluation.requires_human_approval ? 'YES' : 'NO'}`);
      console.log(`   Auto-Approved: ${evaluation.auto_approved ? 'YES' : 'NO'}`);
      console.log(`   Should Escalate: ${evaluation.should_escalate ? 'YES' : 'NO'}`);
      if (evaluation.escalation_route) {
        console.log(`   Escalation Route: ${evaluation.escalation_route}`);
      }

      // If auto-approved, we're done
      if (evaluation.auto_approved) {
        console.log(`\n✅ Auto-approved (confidence ${opts.confidence.toFixed(2)} >= threshold)`);
        console.log(`   Decision ID: ${evaluation.decision.decision_id}`);
        return 0;
      }

      // If non-interactive mode and approval required, fail
      if (opts.nonInteractive && evaluation.requires_human_approval) {
        console.log('\n❌ Human approval required but running in non-interactive mode');
        console.log('   Exit code: 10');
        return 10;
      }

      // Interactive approval flow
      if (evaluation.requires_human_approval) {
        await this.interactiveDecision(evaluation.decision, opts.operator);
      }

      return 0;
    } catch (error) {
      console.error('❌ Error evaluating decision:', error);
      return 1;
    } finally {
      this.close();
    }
  }

  /**
   * Show command - display a decision by ID
   */
  async show(opts: { decisionId: string }): Promise<number> {
    try {
      const decision = this.engine.getDecision(opts.decisionId);

      if (!decision) {
        console.log(`❌ Decision not found: ${opts.decisionId}`);
        return 1;
      }

      console.log('\n📄 Decision Details:');
      console.log(JSON.stringify(decision, null, 2));
      console.log('');

      return 0;
    } catch (error) {
      console.error('❌ Error showing decision:', error);
      return 1;
    } finally {
      this.close();
    }
  }

  /**
   * Policy command - show decision policy summary
   */
  async policy(): Promise<number> {
    try {
      const summary = this.engine.getPolicySummary();

      console.log('\n📋 Decision Policy Thresholds:\n');
      console.log('Category                 | Auto Threshold | Human Required');
      console.log('-'.repeat(70));

      Object.entries(summary).forEach(([category, threshold]) => {
        const autoThreshold = (threshold.auto_min_confidence * 100).toFixed(0) + '%';
        const humanRequired = threshold.human_required ? 'YES' : 'NO';
        console.log(
          `${category.padEnd(24)} | ${autoThreshold.padEnd(14)} | ${humanRequired}`
        );
      });

      console.log('');
      return 0;
    } catch (error) {
      console.error('❌ Error loading policy:', error);
      return 1;
    } finally {
      this.close();
    }
  }
}

/**
 * Main CLI entry point
 */
export async function runDecisionsCLI(command: string, args: any): Promise<number> {
  const cli = new DecisionCLI();

  switch (command) {
    case 'evaluate':
      return cli.evaluate({
        workflowId: args.workflowId || args['workflow-id'],
        itemId: args.itemId || args['item-id'],
        category: args.category,
        action: args.action,
        confidence: parseFloat(args.confidence),
        operator: args.operator || process.env.USER || 'unknown',
        nonInteractive: args.nonInteractive || args['non-interactive'],
      });

    case 'show':
      return cli.show({
        decisionId: args.decisionId || args['decision-id'],
      });

    case 'policy':
      return cli.policy();

    default:
      console.error(`Unknown command: ${command}`);
      console.log('\nAvailable commands:');
      console.log('  evaluate  - Evaluate a decision request');
      console.log('  show      - Show decision details by ID');
      console.log('  policy    - Display decision policy thresholds');
      return 1;
  }
}

// Export for use as module
export { DecisionCLI };
