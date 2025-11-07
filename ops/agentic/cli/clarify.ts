/**
 * CLI Handler for Clarification Commands
 * Usage: cc agentic clarify <subcommand>
 */

import {
  ClarificationEngine,
  CreateClarificationInput,
  ClarificationRequest,
  ClarificationAnswer,
  evaluateClarificationNeed,
} from '../core/clarify';
import * as readline from 'readline';

/**
 * CLI Interface for interactive clarifications
 */
class ClarifyCLI {
  private rl: readline.Interface;
  private engine: ClarificationEngine;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    this.engine = new ClarificationEngine();
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
   * Display clarification request
   */
  private displayClarification(request: ClarificationRequest): void {
    console.log('\n' + '='.repeat(80));
    console.log('❓ CLARIFICATION REQUIRED');
    console.log('='.repeat(80));
    console.log(`Clarification ID: ${request.clarification_id}`);
    console.log(`Workflow: ${request.workflow_id}`);
    console.log(`Item: ${request.item_id}`);
    if (request.context) {
      console.log(`\n📝 Context:\n   ${request.context}`);
    }
    console.log(`\n📋 Questions (${request.questions.length}):`);
    console.log('='.repeat(80) + '\n');
  }

  /**
   * Interactive clarification flow
   */
  async interactiveClarification(
    request: ClarificationRequest,
    operator: string
  ): Promise<ClarificationRequest> {
    this.displayClarification(request);

    const answers: ClarificationAnswer[] = [];

    for (const question of request.questions) {
      console.log(`\n[${question.question_id}] ${question.question}`);
      console.log(`   Type: ${question.type}${question.required ? ' (required)' : ' (optional)'}`);

      if (question.type === 'multiple_choice' && question.options) {
        question.options.forEach((option, index) => {
          console.log(`   ${index + 1}. ${option}`);
        });
      }

      if (question.default_value) {
        console.log(`   Default: ${question.default_value}`);
      }

      let answer: string;

      if (question.type === 'yes_no') {
        answer = await this.prompt('   Answer (yes/no): ');
        while (!['yes', 'no', 'y', 'n'].includes(answer.toLowerCase())) {
          console.log('   Please answer yes or no');
          answer = await this.prompt('   Answer (yes/no): ');
        }
        answer = ['yes', 'y'].includes(answer.toLowerCase()) ? 'yes' : 'no';
      } else if (question.type === 'multiple_choice' && question.options) {
        const choice = await this.prompt(`   Select [1-${question.options.length}]: `);
        const choiceIndex = parseInt(choice, 10) - 1;
        if (choiceIndex >= 0 && choiceIndex < question.options.length) {
          answer = question.options[choiceIndex];
        } else {
          console.log('   Invalid choice, using default or skipping');
          answer = question.default_value || '';
        }
      } else {
        answer = await this.prompt('   Answer: ');
      }

      if (answer || !question.required) {
        answers.push({
          question_id: question.question_id,
          answer: answer || question.default_value || '',
        });
      } else if (question.required && !answer) {
        console.log('   ⚠️  This question is required. Please provide an answer.');
        // Loop back to ask again
        const retryAnswer = await this.prompt('   Answer: ');
        answers.push({
          question_id: question.question_id,
          answer: retryAnswer,
        });
      }
    }

    // Record answers
    const updated = this.engine.recordAnswers(request.clarification_id, answers, operator);

    console.log(`\n✅ Clarification completed`);
    console.log(`   Clarification ID: ${updated.clarification_id}`);
    console.log(`   Status: ${updated.status}`);
    console.log(`   Answered: ${updated.answers?.length || 0} questions\n`);

    return updated;
  }

  /**
   * Evaluate command - check if clarification is needed
   */
  async evaluate(opts: {
    requirements: string;
    acceptanceCriteria?: string;
    confidence: number;
  }): Promise<number> {
    try {
      const criteria = opts.acceptanceCriteria
        ? opts.acceptanceCriteria.split(',').map((s) => s.trim())
        : [];

      const evaluation = evaluateClarificationNeed(
        opts.requirements,
        criteria,
        opts.confidence
      );

      console.log('\n📊 Clarification Evaluation:');
      console.log(`   Needs Clarification: ${evaluation.needs_clarification ? 'YES' : 'NO'}`);
      console.log(`   Confidence: ${(evaluation.confidence * 100).toFixed(1)}%`);

      if (evaluation.ambiguities.length > 0) {
        console.log(`\n   ⚠️  Ambiguities (${evaluation.ambiguities.length}):`);
        evaluation.ambiguities.forEach((amb) => console.log(`      - ${amb}`));
      }

      if (evaluation.missing_criteria.length > 0) {
        console.log(`\n   ⚠️  Missing Criteria (${evaluation.missing_criteria.length}):`);
        evaluation.missing_criteria.forEach((miss) => console.log(`      - ${miss}`));
      }

      if (evaluation.conflicting_constraints.length > 0) {
        console.log(`\n   ⚠️  Conflicts (${evaluation.conflicting_constraints.length}):`);
        evaluation.conflicting_constraints.forEach((conf) => console.log(`      - ${conf}`));
      }

      console.log('');
      return evaluation.needs_clarification ? 1 : 0;
    } catch (error) {
      console.error('❌ Error evaluating clarification:', error);
      return 1;
    } finally {
      this.close();
    }
  }

  /**
   * Create command - create a clarification request
   */
  async create(opts: {
    workflowId: string;
    itemId: string;
    requirements: string;
    acceptanceCriteria?: string;
    confidence: number;
    operator: string;
    interactive?: boolean;
  }): Promise<number> {
    try {
      const criteria = opts.acceptanceCriteria
        ? opts.acceptanceCriteria.split(',').map((s) => s.trim())
        : [];

      // Evaluate need
      const evaluation = evaluateClarificationNeed(
        opts.requirements,
        criteria,
        opts.confidence
      );

      if (!evaluation.needs_clarification) {
        console.log('✅ No clarification needed (confidence sufficient)');
        return 0;
      }

      // Generate questions
      const questions = this.engine.generateQuestions(evaluation);

      if (questions.length === 0) {
        console.log('✅ No specific questions generated');
        return 0;
      }

      // Create request
      const input: CreateClarificationInput = {
        workflow_id: opts.workflowId,
        item_id: opts.itemId,
        context: `Requirements confidence: ${opts.confidence.toFixed(2)}`,
        questions,
        trace_id: `T-${Date.now()}`,
      };

      const request = this.engine.createRequest(input);

      console.log(`\n📝 Clarification request created:`);
      console.log(`   ID: ${request.clarification_id}`);
      console.log(`   Questions: ${request.questions.length}`);

      // Interactive mode
      if (opts.interactive) {
        await this.interactiveClarification(request, opts.operator);
      } else {
        console.log(`   Status: ${request.status}`);
        console.log(`   File: ops/agentic/runs/${new Date().toISOString().split('T')[0]}/${request.clarification_id}.json`);
        console.log(`\n   Run 'cc agentic clarify answer --id ${request.clarification_id}' to answer\n`);
      }

      return 0;
    } catch (error) {
      console.error('❌ Error creating clarification:', error);
      return 1;
    } finally {
      if (!opts.interactive) {
        this.close();
      }
    }
  }

  /**
   * Answer command - answer a clarification request
   */
  async answer(opts: { clarificationId: string; operator: string }): Promise<number> {
    try {
      const request = this.engine.getClarification(opts.clarificationId);

      if (!request) {
        console.log(`❌ Clarification not found: ${opts.clarificationId}`);
        return 1;
      }

      if (request.status !== 'pending') {
        console.log(`⚠️  Clarification already ${request.status}`);
        return 1;
      }

      await this.interactiveClarification(request, opts.operator);
      return 0;
    } catch (error) {
      console.error('❌ Error answering clarification:', error);
      return 1;
    } finally {
      this.close();
    }
  }

  /**
   * Show command - display a clarification by ID
   */
  async show(opts: { clarificationId: string }): Promise<number> {
    try {
      const request = this.engine.getClarification(opts.clarificationId);

      if (!request) {
        console.log(`❌ Clarification not found: ${opts.clarificationId}`);
        return 1;
      }

      console.log('\n📄 Clarification Details:');
      console.log(JSON.stringify(request, null, 2));
      console.log('');

      return 0;
    } catch (error) {
      console.error('❌ Error showing clarification:', error);
      return 1;
    } finally {
      this.close();
    }
  }
}

/**
 * Main CLI entry point
 */
export async function runClarifyCLI(command: string, args: any): Promise<number> {
  const cli = new ClarifyCLI();

  switch (command) {
    case 'evaluate':
      return cli.evaluate({
        requirements: args.requirements,
        acceptanceCriteria: args.acceptanceCriteria || args['acceptance-criteria'],
        confidence: parseFloat(args.confidence),
      });

    case 'create':
      return cli.create({
        workflowId: args.workflowId || args['workflow-id'],
        itemId: args.itemId || args['item-id'],
        requirements: args.requirements,
        acceptanceCriteria: args.acceptanceCriteria || args['acceptance-criteria'],
        confidence: parseFloat(args.confidence),
        operator: args.operator || process.env.USER || 'unknown',
        interactive: args.interactive,
      });

    case 'answer':
      return cli.answer({
        clarificationId: args.clarificationId || args['clarification-id'] || args.id,
        operator: args.operator || process.env.USER || 'unknown',
      });

    case 'show':
      return cli.show({
        clarificationId: args.clarificationId || args['clarification-id'] || args.id,
      });

    default:
      console.error(`Unknown command: ${command}`);
      console.log('\nAvailable commands:');
      console.log('  evaluate  - Evaluate if clarification is needed');
      console.log('  create    - Create a clarification request');
      console.log('  answer    - Answer a clarification request interactively');
      console.log('  show      - Show clarification details by ID');
      return 1;
  }
}

// Export for use as module
export { ClarifyCLI };
