/**
 * Clarification Engine - Handles ambiguous or incomplete requirements
 * Implements interactive clarification flow for requirement refinement
 */

import { z } from 'zod';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

// Zod Schemas
export const QuestionTypeSchema = z.enum([
  'open_text',
  'multiple_choice',
  'yes_no',
  'numeric',
]);

export const ClarificationQuestionSchema = z.object({
  question_id: z.string(),
  question: z.string(),
  type: QuestionTypeSchema,
  options: z.array(z.string()).optional(),
  default_value: z.string().optional(),
  required: z.boolean().default(true),
});

export const ClarificationAnswerSchema = z.object({
  question_id: z.string(),
  answer: z.string(),
  confidence: z.number().min(0).max(1).optional(),
});

export const ClarificationStatusSchema = z.enum([
  'pending',
  'answered',
  'skipped',
  'escalated',
]);

export const ClarificationRequestSchema = z.object({
  clarification_id: z.string(),
  schema_version: z.string(),
  workflow_id: z.string(),
  item_id: z.string(),
  context: z.string().optional(),
  questions: z.array(ClarificationQuestionSchema),
  status: ClarificationStatusSchema,
  answers: z.array(ClarificationAnswerSchema).optional(),
  operator: z.string().optional(),
  timestamp: z.string().datetime(),
  answered_at: z.string().datetime().optional(),
  trace_id: z.string().optional(),
});

// Type Exports
export type QuestionType = z.infer<typeof QuestionTypeSchema>;
export type ClarificationQuestion = z.infer<typeof ClarificationQuestionSchema>;
export type ClarificationAnswer = z.infer<typeof ClarificationAnswerSchema>;
export type ClarificationStatus = z.infer<typeof ClarificationStatusSchema>;
export type ClarificationRequest = z.infer<typeof ClarificationRequestSchema>;

// Clarification Input
export interface CreateClarificationInput {
  workflow_id: string;
  item_id: string;
  context?: string;
  questions: Omit<ClarificationQuestion, 'question_id'>[];
  trace_id?: string;
}

// Clarification Evaluation
export interface ClarificationEvaluation {
  needs_clarification: boolean;
  confidence: number;
  ambiguities: string[];
  missing_criteria: string[];
  conflicting_constraints: string[];
}

/**
 * Clarification Engine Class
 */
export class ClarificationEngine {
  private runsDir: string;
  private clarificationRound: Map<string, number> = new Map();
  private maxRounds: number = 3;

  constructor(runsDir?: string) {
    this.runsDir = runsDir || join(process.cwd(), 'ops/agentic/runs');
    this.ensureRunsDirectory();
  }

  /**
   * Ensure runs directory exists
   */
  private ensureRunsDirectory(): void {
    const today = new Date().toISOString().split('T')[0];
    const todayDir = join(this.runsDir, today);
    mkdirSync(todayDir, { recursive: true });
  }

  /**
   * Generate unique clarification ID
   */
  private generateClarificationId(): string {
    const year = new Date().getFullYear();
    const counter = String(Math.floor(Math.random() * 100000)).padStart(5, '0');
    return `CLR-${year}-${counter}`;
  }

  /**
   * Generate unique question ID
   */
  private generateQuestionId(index: number): string {
    return `Q${String(index + 1).padStart(3, '0')}`;
  }

  /**
   * Create a clarification request
   */
  public createRequest(input: CreateClarificationInput): ClarificationRequest {
    const clarification_id = this.generateClarificationId();

    // Add question IDs
    const questions: ClarificationQuestion[] = input.questions.map((q, index) => ({
      ...q,
      question_id: this.generateQuestionId(index),
    }));

    const request: ClarificationRequest = {
      clarification_id,
      schema_version: '1.0.0',
      workflow_id: input.workflow_id,
      item_id: input.item_id,
      context: input.context,
      questions,
      status: 'pending',
      timestamp: new Date().toISOString(),
      trace_id: input.trace_id,
    };

    // Persist to disk
    this.persistClarification(request);

    return request;
  }

  /**
   * Record answers to a clarification request
   */
  public recordAnswers(
    clarification_id: string,
    answers: ClarificationAnswer[],
    operator: string
  ): ClarificationRequest {
    const request = this.getClarification(clarification_id);
    if (!request) {
      throw new Error(`Clarification ${clarification_id} not found`);
    }

    // Validate all required questions are answered
    const requiredQuestions = request.questions.filter((q) => q.required);
    const answeredQuestionIds = new Set(answers.map((a) => a.question_id));

    const missingRequired = requiredQuestions.filter(
      (q) => !answeredQuestionIds.has(q.question_id)
    );

    if (missingRequired.length > 0) {
      throw new Error(
        `Missing required answers for questions: ${missingRequired.map((q) => q.question_id).join(', ')}`
      );
    }

    // Update request with answers
    const updated: ClarificationRequest = {
      ...request,
      answers,
      operator,
      status: 'answered',
      answered_at: new Date().toISOString(),
    };

    // Persist updated request
    this.persistClarification(updated);

    return updated;
  }

  /**
   * Skip clarification (non-blocking questions)
   */
  public skipClarification(clarification_id: string, operator: string): ClarificationRequest {
    const request = this.getClarification(clarification_id);
    if (!request) {
      throw new Error(`Clarification ${clarification_id} not found`);
    }

    const updated: ClarificationRequest = {
      ...request,
      operator,
      status: 'skipped',
      answered_at: new Date().toISOString(),
    };

    this.persistClarification(updated);

    return updated;
  }

  /**
   * Escalate clarification (too complex or multiple rounds)
   */
  public escalateClarification(
    clarification_id: string,
    operator: string
  ): ClarificationRequest {
    const request = this.getClarification(clarification_id);
    if (!request) {
      throw new Error(`Clarification ${clarification_id} not found`);
    }

    const updated: ClarificationRequest = {
      ...request,
      operator,
      status: 'escalated',
      answered_at: new Date().toISOString(),
    };

    this.persistClarification(updated);

    return updated;
  }

  /**
   * Evaluate if clarification is needed
   */
  public evaluateNeed(
    requirements: string,
    acceptanceCriteria: string[],
    confidence: number
  ): ClarificationEvaluation {
    const ambiguities: string[] = [];
    const missing_criteria: string[] = [];
    const conflicting_constraints: string[] = [];

    // Check for ambiguity (low confidence threshold from policy: 0.70)
    const needs_clarification = confidence < 0.70;

    // Detect ambiguous language
    const ambiguousTerms = [
      'maybe',
      'probably',
      'might',
      'could',
      'some',
      'few',
      'several',
      'various',
    ];
    ambiguousTerms.forEach((term) => {
      if (requirements.toLowerCase().includes(term)) {
        ambiguities.push(`Ambiguous term detected: "${term}"`);
      }
    });

    // Check for missing acceptance criteria
    if (!acceptanceCriteria || acceptanceCriteria.length === 0) {
      missing_criteria.push('No acceptance criteria provided');
    }

    // Check for empty or vague requirements
    if (!requirements || requirements.trim().length < 20) {
      missing_criteria.push('Requirements too brief or missing');
    }

    // Simple conflict detection (contradictory terms)
    const conflicts = [
      ['fast', 'comprehensive'],
      ['simple', 'feature-rich'],
      ['minimal', 'extensive'],
    ];
    conflicts.forEach(([term1, term2]) => {
      if (
        requirements.toLowerCase().includes(term1) &&
        requirements.toLowerCase().includes(term2)
      ) {
        conflicting_constraints.push(`Potentially conflicting: "${term1}" and "${term2}"`);
      }
    });

    return {
      needs_clarification:
        needs_clarification ||
        ambiguities.length > 0 ||
        missing_criteria.length > 0 ||
        conflicting_constraints.length > 0,
      confidence,
      ambiguities,
      missing_criteria,
      conflicting_constraints,
    };
  }

  /**
   * Generate clarification questions based on evaluation
   */
  public generateQuestions(evaluation: ClarificationEvaluation): Omit<
    ClarificationQuestion,
    'question_id'
  >[] {
    const questions: Omit<ClarificationQuestion, 'question_id'>[] = [];

    // Questions for ambiguities
    evaluation.ambiguities.forEach((ambiguity) => {
      questions.push({
        question: `Please clarify: ${ambiguity}`,
        type: 'open_text',
        required: true,
      });
    });

    // Questions for missing criteria
    if (evaluation.missing_criteria.includes('No acceptance criteria provided')) {
      questions.push({
        question: 'What are the acceptance criteria for this feature?',
        type: 'open_text',
        required: true,
      });
    }

    if (evaluation.missing_criteria.includes('Requirements too brief or missing')) {
      questions.push({
        question: 'Please provide detailed requirements for this task',
        type: 'open_text',
        required: true,
      });
    }

    // Questions for conflicts
    evaluation.conflicting_constraints.forEach((conflict) => {
      questions.push({
        question: `Detected potential conflict: ${conflict}. How should we prioritize?`,
        type: 'multiple_choice',
        options: ['Prioritize first term', 'Prioritize second term', 'Balance both'],
        required: true,
      });
    });

    return questions;
  }

  /**
   * Check if max clarification rounds reached
   */
  public hasReachedMaxRounds(workflow_id: string): boolean {
    const rounds = this.clarificationRound.get(workflow_id) || 0;
    return rounds >= this.maxRounds;
  }

  /**
   * Increment clarification round
   */
  public incrementRound(workflow_id: string): number {
    const current = this.clarificationRound.get(workflow_id) || 0;
    const next = current + 1;
    this.clarificationRound.set(workflow_id, next);
    return next;
  }

  /**
   * Persist clarification to disk
   */
  private persistClarification(request: ClarificationRequest): void {
    const today = new Date().toISOString().split('T')[0];
    const todayDir = join(this.runsDir, today);
    const filePath = join(todayDir, `${request.clarification_id}.json`);

    writeFileSync(filePath, JSON.stringify(request, null, 2), 'utf-8');
  }

  /**
   * Get clarification by ID
   */
  public getClarification(clarification_id: string): ClarificationRequest | null {
    try {
      // Search in recent days (last 30 days)
      const today = new Date();
      for (let i = 0; i < 30; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const filePath = join(this.runsDir, dateStr, `${clarification_id}.json`);

        try {
          const content = readFileSync(filePath, 'utf-8');
          return ClarificationRequestSchema.parse(JSON.parse(content));
        } catch {
          continue;
        }
      }

      return null;
    } catch (error) {
      console.error(`Error loading clarification ${clarification_id}:`, error);
      return null;
    }
  }
}

/**
 * Evaluate if clarification is needed (convenience function)
 */
export function evaluateClarificationNeed(
  requirements: string,
  acceptanceCriteria: string[],
  confidence: number
): ClarificationEvaluation {
  const engine = new ClarificationEngine();
  return engine.evaluateNeed(requirements, acceptanceCriteria, confidence);
}

/**
 * Create clarification request (convenience function)
 */
export function createClarificationRequest(
  input: CreateClarificationInput
): ClarificationRequest {
  const engine = new ClarificationEngine();
  return engine.createRequest(input);
}
