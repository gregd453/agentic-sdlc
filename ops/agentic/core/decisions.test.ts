/**
 * Unit Tests for Decision Engine
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DecisionEngine, DecisionRequest, DecisionCategory } from './decisions';
import { rmSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const TEST_POLICY_PATH = join(__dirname, '../backlog/policy.yaml');
const TEST_RUNS_DIR = join(__dirname, '../runs-test');

describe('DecisionEngine', () => {
  let engine: DecisionEngine;

  beforeEach(() => {
    // Create test runs directory
    if (!existsSync(TEST_RUNS_DIR)) {
      mkdirSync(TEST_RUNS_DIR, { recursive: true });
    }
    engine = new DecisionEngine(TEST_POLICY_PATH, TEST_RUNS_DIR);
  });

  afterEach(() => {
    // Clean up test runs directory
    if (existsSync(TEST_RUNS_DIR)) {
      rmSync(TEST_RUNS_DIR, { recursive: true, force: true });
    }
  });

  describe('evaluate', () => {
    it('should auto-approve technical refactor with high confidence', () => {
      const request: DecisionRequest = {
        workflow_id: 'WF-2025-1107-001',
        item_id: 'BI-2025-00001',
        category: 'technical_refactor',
        action: 'Refactor user service',
        confidence: 0.90,
        trace_id: 'T-001',
      };

      const evaluation = engine.evaluate(request);

      expect(evaluation.auto_approved).toBe(true);
      expect(evaluation.requires_human_approval).toBe(false);
      expect(evaluation.decision.status).toBe('approved');
      expect(evaluation.decision.operator).toBe('system');
    });

    it('should require human approval for security affecting changes', () => {
      const request: DecisionRequest = {
        workflow_id: 'WF-2025-1107-002',
        item_id: 'BI-2025-00002',
        category: 'security_affecting',
        action: 'Update authentication system',
        confidence: 0.95,
        trace_id: 'T-002',
      };

      const evaluation = engine.evaluate(request);

      expect(evaluation.auto_approved).toBe(false);
      expect(evaluation.requires_human_approval).toBe(true);
      expect(evaluation.decision.status).toBe('pending');
    });

    it('should require human approval for cost impacting changes', () => {
      const request: DecisionRequest = {
        workflow_id: 'WF-2025-1107-003',
        item_id: 'BI-2025-00003',
        category: 'cost_impacting',
        action: 'Add new database cluster',
        confidence: 0.94,
        trace_id: 'T-003',
      };

      const evaluation = engine.evaluate(request);

      expect(evaluation.auto_approved).toBe(false);
      expect(evaluation.requires_human_approval).toBe(true);
      expect(evaluation.decision.status).toBe('pending');
    });

    it('should require approval when confidence below threshold', () => {
      const request: DecisionRequest = {
        workflow_id: 'WF-2025-1107-004',
        item_id: 'BI-2025-00004',
        category: 'technical_refactor',
        action: 'Refactor payment service',
        confidence: 0.70, // Below threshold of 0.85
        trace_id: 'T-004',
      };

      const evaluation = engine.evaluate(request);

      expect(evaluation.auto_approved).toBe(false);
      expect(evaluation.requires_human_approval).toBe(true);
      expect(evaluation.decision.confidence).toBe(0.70);
    });

    it('should suggest escalation for very low confidence', () => {
      const request: DecisionRequest = {
        workflow_id: 'WF-2025-1107-005',
        item_id: 'BI-2025-00005',
        category: 'architectural_change',
        action: 'Redesign data layer',
        confidence: 0.65, // Very low confidence
        trace_id: 'T-005',
      };

      const evaluation = engine.evaluate(request);

      expect(evaluation.should_escalate).toBe(true);
      expect(evaluation.escalation_route).toBeDefined();
      expect(evaluation.escalation_route).toContain('@company.com');
    });

    it('should create decision with correct structure', () => {
      const request: DecisionRequest = {
        workflow_id: 'WF-2025-1107-006',
        item_id: 'BI-2025-00006',
        category: 'data_migration',
        action: 'Migrate user data to new schema',
        confidence: 0.88,
        trace_id: 'T-006',
      };

      const evaluation = engine.evaluate(request);

      expect(evaluation.decision.decision_id).toMatch(/^DEC-\d{4}-\d{5}$/);
      expect(evaluation.decision.schema_version).toBe('1.0.0');
      expect(evaluation.decision.workflow_id).toBe(request.workflow_id);
      expect(evaluation.decision.item_id).toBe(request.item_id);
      expect(evaluation.decision.category).toBe(request.category);
      expect(evaluation.decision.confidence).toBe(request.confidence);
      expect(evaluation.decision.options).toHaveLength(4); // approve, revise, escalate, abort
      expect(evaluation.decision.timestamp).toBeDefined();
    });

    it('should include appropriate risks for security category', () => {
      const request: DecisionRequest = {
        workflow_id: 'WF-2025-1107-007',
        item_id: 'BI-2025-00007',
        category: 'security_affecting',
        action: 'Update OAuth configuration',
        confidence: 0.92,
        trace_id: 'T-007',
      };

      const evaluation = engine.evaluate(request);

      const approveOption = evaluation.decision.options.find((o) => o.option_id === 'approve');
      expect(approveOption).toBeDefined();
      expect(approveOption?.risks).toContain('Security vulnerability may be introduced');
    });

    it('should include appropriate risks for cost category', () => {
      const request: DecisionRequest = {
        workflow_id: 'WF-2025-1107-008',
        item_id: 'BI-2025-00008',
        category: 'cost_impacting',
        action: 'Scale up infrastructure',
        confidence: 0.93,
        trace_id: 'T-008',
      };

      const evaluation = engine.evaluate(request);

      const approveOption = evaluation.decision.options.find((o) => o.option_id === 'approve');
      expect(approveOption).toBeDefined();
      expect(approveOption?.risks).toContain('Increased infrastructure costs');
    });

    it('should throw error for unknown category', () => {
      const request: DecisionRequest = {
        workflow_id: 'WF-2025-1107-009',
        item_id: 'BI-2025-00009',
        category: 'unknown_category' as DecisionCategory,
        action: 'Do something',
        confidence: 0.90,
        trace_id: 'T-009',
      };

      expect(() => engine.evaluate(request)).toThrow('Unknown decision category');
    });
  });

  describe('recordDecision', () => {
    it('should record operator approval', () => {
      const request: DecisionRequest = {
        workflow_id: 'WF-2025-1107-010',
        item_id: 'BI-2025-00010',
        category: 'cost_impacting',
        action: 'Add caching layer',
        confidence: 0.85,
        trace_id: 'T-010',
      };

      const evaluation = engine.evaluate(request);
      const recorded = engine.recordDecision(
        evaluation.decision,
        'approve',
        'user@example.com',
        'Improves performance significantly'
      );

      expect(recorded.status).toBe('approved');
      expect(recorded.selected_option).toBe('approve');
      expect(recorded.operator).toBe('user@example.com');
      expect(recorded.rationale).toBe('Improves performance significantly');
      expect(recorded.decided_at).toBeDefined();
    });

    it('should record operator revision request', () => {
      const request: DecisionRequest = {
        workflow_id: 'WF-2025-1107-011',
        item_id: 'BI-2025-00011',
        category: 'architectural_change',
        action: 'Redesign API layer',
        confidence: 0.87,
        trace_id: 'T-011',
      };

      const evaluation = engine.evaluate(request);
      const recorded = engine.recordDecision(
        evaluation.decision,
        'revise',
        'architect@example.com',
        'Need more details on migration path'
      );

      expect(recorded.status).toBe('revised');
      expect(recorded.selected_option).toBe('revise');
      expect(recorded.operator).toBe('architect@example.com');
    });

    it('should record escalation', () => {
      const request: DecisionRequest = {
        workflow_id: 'WF-2025-1107-012',
        item_id: 'BI-2025-00012',
        category: 'security_affecting',
        action: 'Update encryption algorithm',
        confidence: 0.75,
        trace_id: 'T-012',
      };

      const evaluation = engine.evaluate(request);
      const recorded = engine.recordDecision(
        evaluation.decision,
        'escalate',
        'dev@example.com',
        'Requires security team review'
      );

      expect(recorded.status).toBe('escalated');
      expect(recorded.selected_option).toBe('escalate');
    });

    it('should record abort', () => {
      const request: DecisionRequest = {
        workflow_id: 'WF-2025-1107-013',
        item_id: 'BI-2025-00013',
        category: 'data_migration',
        action: 'Drop old tables',
        confidence: 0.60,
        trace_id: 'T-013',
      };

      const evaluation = engine.evaluate(request);
      const recorded = engine.recordDecision(
        evaluation.decision,
        'abort',
        'dba@example.com',
        'Too risky without backup plan'
      );

      expect(recorded.status).toBe('aborted');
      expect(recorded.selected_option).toBe('abort');
    });

    it('should persist decision to disk', () => {
      const request: DecisionRequest = {
        workflow_id: 'WF-2025-1107-014',
        item_id: 'BI-2025-00014',
        category: 'technical_refactor',
        action: 'Update dependencies',
        confidence: 0.88,
        trace_id: 'T-014',
      };

      const evaluation = engine.evaluate(request);
      const recorded = engine.recordDecision(
        evaluation.decision,
        'approve',
        'dev@example.com'
      );

      // Should be able to retrieve it
      const retrieved = engine.getDecision(recorded.decision_id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.decision_id).toBe(recorded.decision_id);
      expect(retrieved?.status).toBe('approved');
    });
  });

  describe('getDecision', () => {
    it('should retrieve persisted decision', () => {
      const request: DecisionRequest = {
        workflow_id: 'WF-2025-1107-015',
        item_id: 'BI-2025-00015',
        category: 'cost_impacting',
        action: 'Upgrade database tier',
        confidence: 0.92,
        trace_id: 'T-015',
      };

      const evaluation = engine.evaluate(request);
      const recorded = engine.recordDecision(evaluation.decision, 'approve', 'ops@example.com');

      const retrieved = engine.getDecision(recorded.decision_id);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.decision_id).toBe(recorded.decision_id);
      expect(retrieved?.workflow_id).toBe(request.workflow_id);
      expect(retrieved?.status).toBe('approved');
    });

    it('should return null for non-existent decision', () => {
      const retrieved = engine.getDecision('DEC-2025-99999');
      expect(retrieved).toBeNull();
    });

    it('should return null for invalid decision ID format', () => {
      const retrieved = engine.getDecision('invalid-id');
      expect(retrieved).toBeNull();
    });
  });

  describe('getPolicySummary', () => {
    it('should return policy thresholds', () => {
      const summary = engine.getPolicySummary();

      expect(summary).toBeDefined();
      expect(summary.technical_refactor).toBeDefined();
      expect(summary.technical_refactor.auto_min_confidence).toBe(0.85);
      expect(summary.technical_refactor.human_required).toBe(false);

      expect(summary.security_affecting).toBeDefined();
      expect(summary.security_affecting.auto_min_confidence).toBe(1.0);
      expect(summary.security_affecting.human_required).toBe(true);

      expect(summary.cost_impacting).toBeDefined();
      expect(summary.cost_impacting.auto_min_confidence).toBe(0.92);
      expect(summary.cost_impacting.human_required).toBe(true);
    });
  });

  describe('policy reload', () => {
    it('should reload policy without error', () => {
      expect(() => engine.reloadPolicy()).not.toThrow();
    });
  });
});
