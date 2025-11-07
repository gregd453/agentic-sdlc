/**
 * Unit Tests for Clarification Engine
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ClarificationEngine, CreateClarificationInput } from './clarify';
import { rmSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const TEST_RUNS_DIR = join(__dirname, '../runs-test');

describe('ClarificationEngine', () => {
  let engine: ClarificationEngine;

  beforeEach(() => {
    // Create test runs directory
    if (!existsSync(TEST_RUNS_DIR)) {
      mkdirSync(TEST_RUNS_DIR, { recursive: true });
    }
    engine = new ClarificationEngine(TEST_RUNS_DIR);
  });

  afterEach(() => {
    // Clean up test runs directory
    if (existsSync(TEST_RUNS_DIR)) {
      rmSync(TEST_RUNS_DIR, { recursive: true, force: true });
    }
  });

  describe('createRequest', () => {
    it('should create clarification request with questions', () => {
      const input: CreateClarificationInput = {
        workflow_id: 'WF-2025-1107-001',
        item_id: 'BI-2025-00001',
        context: 'Requirements are vague',
        questions: [
          {
            question: 'What is the target user persona?',
            type: 'open_text',
            required: true,
          },
          {
            question: 'Should this be accessible on mobile?',
            type: 'yes_no',
            required: true,
          },
        ],
        trace_id: 'T-001',
      };

      const request = engine.createRequest(input);

      expect(request.clarification_id).toMatch(/^CLR-\d{4}-\d{5}$/);
      expect(request.schema_version).toBe('1.0.0');
      expect(request.workflow_id).toBe(input.workflow_id);
      expect(request.item_id).toBe(input.item_id);
      expect(request.context).toBe(input.context);
      expect(request.questions).toHaveLength(2);
      expect(request.questions[0].question_id).toMatch(/^Q\d{3}$/);
      expect(request.status).toBe('pending');
      expect(request.timestamp).toBeDefined();
    });

    it('should auto-generate question IDs', () => {
      const input: CreateClarificationInput = {
        workflow_id: 'WF-2025-1107-002',
        item_id: 'BI-2025-00002',
        questions: [
          { question: 'Question 1', type: 'open_text' },
          { question: 'Question 2', type: 'yes_no' },
          { question: 'Question 3', type: 'numeric' },
        ],
        trace_id: 'T-002',
      };

      const request = engine.createRequest(input);

      expect(request.questions[0].question_id).toBe('Q001');
      expect(request.questions[1].question_id).toBe('Q002');
      expect(request.questions[2].question_id).toBe('Q003');
    });

    it('should persist request to disk', () => {
      const input: CreateClarificationInput = {
        workflow_id: 'WF-2025-1107-003',
        item_id: 'BI-2025-00003',
        questions: [{ question: 'Test question', type: 'open_text' }],
        trace_id: 'T-003',
      };

      const request = engine.createRequest(input);

      // Should be retrievable
      const retrieved = engine.getClarification(request.clarification_id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.clarification_id).toBe(request.clarification_id);
    });
  });

  describe('recordAnswers', () => {
    it('should record answers to clarification request', () => {
      const input: CreateClarificationInput = {
        workflow_id: 'WF-2025-1107-004',
        item_id: 'BI-2025-00004',
        questions: [
          { question: 'What is the priority?', type: 'open_text', required: true },
          { question: 'Include analytics?', type: 'yes_no', required: true },
        ],
        trace_id: 'T-004',
      };

      const request = engine.createRequest(input);

      const answers = [
        { question_id: 'Q001', answer: 'High priority' },
        { question_id: 'Q002', answer: 'yes' },
      ];

      const updated = engine.recordAnswers(request.clarification_id, answers, 'user@example.com');

      expect(updated.status).toBe('answered');
      expect(updated.answers).toHaveLength(2);
      expect(updated.operator).toBe('user@example.com');
      expect(updated.answered_at).toBeDefined();
    });

    it('should throw error if required questions are not answered', () => {
      const input: CreateClarificationInput = {
        workflow_id: 'WF-2025-1107-005',
        item_id: 'BI-2025-00005',
        questions: [
          { question: 'Required question', type: 'open_text', required: true },
          { question: 'Optional question', type: 'open_text', required: false },
        ],
        trace_id: 'T-005',
      };

      const request = engine.createRequest(input);

      const answers = [
        { question_id: 'Q002', answer: 'Optional answer' }, // Only answering optional
      ];

      expect(() =>
        engine.recordAnswers(request.clarification_id, answers, 'user@example.com')
      ).toThrow('Missing required answers');
    });

    it('should throw error for non-existent clarification', () => {
      const answers = [{ question_id: 'Q001', answer: 'Test' }];

      expect(() =>
        engine.recordAnswers('CLR-2025-99999', answers, 'user@example.com')
      ).toThrow('Clarification CLR-2025-99999 not found');
    });
  });

  describe('skipClarification', () => {
    it('should mark clarification as skipped', () => {
      const input: CreateClarificationInput = {
        workflow_id: 'WF-2025-1107-006',
        item_id: 'BI-2025-00006',
        questions: [{ question: 'Optional question', type: 'open_text', required: false }],
        trace_id: 'T-006',
      };

      const request = engine.createRequest(input);
      const updated = engine.skipClarification(request.clarification_id, 'user@example.com');

      expect(updated.status).toBe('skipped');
      expect(updated.operator).toBe('user@example.com');
      expect(updated.answered_at).toBeDefined();
    });
  });

  describe('escalateClarification', () => {
    it('should mark clarification as escalated', () => {
      const input: CreateClarificationInput = {
        workflow_id: 'WF-2025-1107-007',
        item_id: 'BI-2025-00007',
        questions: [{ question: 'Complex question', type: 'open_text', required: true }],
        trace_id: 'T-007',
      };

      const request = engine.createRequest(input);
      const updated = engine.escalateClarification(
        request.clarification_id,
        'user@example.com'
      );

      expect(updated.status).toBe('escalated');
      expect(updated.operator).toBe('user@example.com');
      expect(updated.answered_at).toBeDefined();
    });
  });

  describe('evaluateNeed', () => {
    it('should detect low confidence as needing clarification', () => {
      const evaluation = engine.evaluateNeed(
        'Build a dashboard with some charts',
        ['User can view data'],
        0.65 // Below 0.70 threshold
      );

      expect(evaluation.needs_clarification).toBe(true);
      expect(evaluation.confidence).toBe(0.65);
    });

    it('should not need clarification for high confidence', () => {
      const evaluation = engine.evaluateNeed(
        'Build a user dashboard with revenue charts showing daily, weekly, and monthly trends',
        ['Dashboard displays revenue data', 'Charts are interactive', 'Data updates hourly'],
        0.85
      );

      expect(evaluation.needs_clarification).toBe(false);
    });

    it('should detect ambiguous terms', () => {
      const evaluation = engine.evaluateNeed(
        'Build a dashboard that might include some charts and probably has a few filters',
        ['User can view data'],
        0.75
      );

      expect(evaluation.needs_clarification).toBe(true);
      expect(evaluation.ambiguities.length).toBeGreaterThan(0);
      expect(evaluation.ambiguities.some((a) => a.includes('might'))).toBe(true);
      expect(evaluation.ambiguities.some((a) => a.includes('some'))).toBe(true);
      expect(evaluation.ambiguities.some((a) => a.includes('probably'))).toBe(true);
      expect(evaluation.ambiguities.some((a) => a.includes('few'))).toBe(true);
    });

    it('should detect missing acceptance criteria', () => {
      const evaluation = engine.evaluateNeed(
        'Build a dashboard with charts',
        [], // No acceptance criteria
        0.75
      );

      expect(evaluation.needs_clarification).toBe(true);
      expect(evaluation.missing_criteria).toContain('No acceptance criteria provided');
    });

    it('should detect vague requirements', () => {
      const evaluation = engine.evaluateNeed(
        'Do something', // Very brief
        ['User is happy'],
        0.75
      );

      expect(evaluation.needs_clarification).toBe(true);
      expect(evaluation.missing_criteria).toContain('Requirements too brief or missing');
    });

    it('should detect conflicting constraints', () => {
      const evaluation = engine.evaluateNeed(
        'Build a fast and comprehensive reporting system with minimal features but extensive customization',
        ['System is fast', 'System has many features'],
        0.75
      );

      expect(evaluation.needs_clarification).toBe(true);
      expect(evaluation.conflicting_constraints.length).toBeGreaterThan(0);
    });
  });

  describe('generateQuestions', () => {
    it('should generate questions for ambiguities', () => {
      const evaluation = engine.evaluateNeed(
        'Maybe add some features',
        ['Feature works'],
        0.65
      );

      const questions = engine.generateQuestions(evaluation);

      expect(questions.length).toBeGreaterThan(0);
      expect(questions.some((q) => q.question.includes('clarify'))).toBe(true);
    });

    it('should generate question for missing acceptance criteria', () => {
      const evaluation = engine.evaluateNeed('Build a feature', [], 0.75);

      const questions = engine.generateQuestions(evaluation);

      expect(questions.some((q) => q.question.includes('acceptance criteria'))).toBe(true);
    });

    it('should generate question for brief requirements', () => {
      const evaluation = engine.evaluateNeed('Do it', ['Done'], 0.75);

      const questions = engine.generateQuestions(evaluation);

      expect(questions.some((q) => q.question.includes('detailed requirements'))).toBe(true);
    });

    it('should generate multiple choice for conflicts', () => {
      const evaluation = engine.evaluateNeed(
        'Build a fast comprehensive system',
        ['Works well'],
        0.75
      );

      const questions = engine.generateQuestions(evaluation);

      const conflictQuestion = questions.find((q) => q.type === 'multiple_choice');
      expect(conflictQuestion).toBeDefined();
      expect(conflictQuestion?.options).toBeDefined();
      expect(conflictQuestion?.options?.length).toBeGreaterThan(0);
    });
  });

  describe('clarification rounds', () => {
    it('should track clarification rounds per workflow', () => {
      const workflow_id = 'WF-2025-1107-008';

      expect(engine.hasReachedMaxRounds(workflow_id)).toBe(false);

      engine.incrementRound(workflow_id);
      expect(engine.hasReachedMaxRounds(workflow_id)).toBe(false);

      engine.incrementRound(workflow_id);
      expect(engine.hasReachedMaxRounds(workflow_id)).toBe(false);

      engine.incrementRound(workflow_id);
      expect(engine.hasReachedMaxRounds(workflow_id)).toBe(true);
    });

    it('should return incremented round number', () => {
      const workflow_id = 'WF-2025-1107-009';

      const round1 = engine.incrementRound(workflow_id);
      expect(round1).toBe(1);

      const round2 = engine.incrementRound(workflow_id);
      expect(round2).toBe(2);

      const round3 = engine.incrementRound(workflow_id);
      expect(round3).toBe(3);
    });
  });

  describe('getClarification', () => {
    it('should retrieve persisted clarification', () => {
      const input: CreateClarificationInput = {
        workflow_id: 'WF-2025-1107-010',
        item_id: 'BI-2025-00010',
        questions: [{ question: 'Test', type: 'open_text' }],
        trace_id: 'T-010',
      };

      const request = engine.createRequest(input);
      const retrieved = engine.getClarification(request.clarification_id);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.clarification_id).toBe(request.clarification_id);
      expect(retrieved?.workflow_id).toBe(input.workflow_id);
    });

    it('should return null for non-existent clarification', () => {
      const retrieved = engine.getClarification('CLR-2025-99999');
      expect(retrieved).toBeNull();
    });

    it('should return null for invalid clarification ID', () => {
      const retrieved = engine.getClarification('invalid-id');
      expect(retrieved).toBeNull();
    });
  });
});
