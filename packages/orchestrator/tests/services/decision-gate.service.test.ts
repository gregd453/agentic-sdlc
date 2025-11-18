import { describe, it, expect, beforeEach } from 'vitest';
import { DecisionGateService, DecisionRequest, DecisionEvaluation, ClarificationEvaluation } from '../../src/services/decision-gate.service';

/**
 * Decision Gate Service Tests
 *
 * Tests the Phase 10 Decision & Clarification Flow integration:
 * 1. Decision evaluation with policy thresholds
 * 2. Clarification evaluation for ambiguous requirements
 * 3. Stage-based decision gate routing
 * 4. Category determination for different workflow types
 */

describe('DecisionGateService', () => {
  let service: DecisionGateService;

  beforeEach(() => {
    service = new DecisionGateService();
  });

  describe('Decision Evaluation', () => {
    it('should auto-approve technical refactors with high confidence', async () => {
      const request: DecisionRequest = {
        workflow_id: 'workflow-123',
        item_id: 'item-1',
        category: 'technical_refactor',
        action: 'Refactor authentication module',
        confidence: 0.90
      };

      const result = await service.evaluateDecision(request);

      expect(result.auto_approved).toBe(true);
      expect(result.requires_human_approval).toBe(false);
      expect(result.should_escalate).toBe(false);
      expect(result.decision.status).toBe('approved');
      expect(result.decision.confidence).toBe(0.90);
    });

    it('should require human approval for technical refactors with low confidence', async () => {
      const request: DecisionRequest = {
        workflow_id: 'workflow-123',
        item_id: 'item-1',
        category: 'technical_refactor',
        action: 'Refactor authentication module',
        confidence: 0.75  // Below 0.85 threshold
      };

      const result = await service.evaluateDecision(request);

      expect(result.auto_approved).toBe(false);
      expect(result.requires_human_approval).toBe(true);
      expect(result.should_escalate).toBe(true);  // Below 0.80 escalation threshold
      expect(result.escalation_route).toBe('platform-arch@company.com');
      expect(result.decision.status).toBe('pending');
    });

    it('should always require human approval for cost impacting changes', async () => {
      const request: DecisionRequest = {
        workflow_id: 'workflow-123',
        item_id: 'item-1',
        category: 'cost_impacting',
        action: 'Add new EC2 instances',
        confidence: 0.95
      };

      const result = await service.evaluateDecision(request);

      expect(result.auto_approved).toBe(false);
      expect(result.requires_human_approval).toBe(true);
      expect(result.should_escalate).toBe(false);  // High confidence, no escalation needed
      expect(result.decision.status).toBe('pending');
    });

    it('should always require human approval for security affecting changes', async () => {
      const request: DecisionRequest = {
        workflow_id: 'workflow-123',
        item_id: 'item-1',
        category: 'security_affecting',
        action: 'Change authentication mechanism',
        confidence: 0.95
      };

      const result = await service.evaluateDecision(request);

      expect(result.auto_approved).toBe(false);
      expect(result.requires_human_approval).toBe(true);
      expect(result.decision.status).toBe('pending');
    });

    it('should always require human approval for architectural changes', async () => {
      const request: DecisionRequest = {
        workflow_id: 'workflow-123',
        item_id: 'item-1',
        category: 'architectural_change',
        action: 'Migrate to microservices',
        confidence: 0.95
      };

      const result = await service.evaluateDecision(request);

      expect(result.auto_approved).toBe(false);
      expect(result.requires_human_approval).toBe(true);
      expect(result.decision.status).toBe('pending');
    });

    it('should always require human approval for data migrations', async () => {
      const request: DecisionRequest = {
        workflow_id: 'workflow-123',
        item_id: 'item-1',
        category: 'data_migration',
        action: 'Migrate user data to new schema',
        confidence: 0.97
      };

      const result = await service.evaluateDecision(request);

      expect(result.auto_approved).toBe(false);
      expect(result.requires_human_approval).toBe(true);
      expect(result.decision.status).toBe('pending');
    });

    it('should escalate decisions with very low confidence', async () => {
      const request: DecisionRequest = {
        workflow_id: 'workflow-123',
        item_id: 'item-1',
        category: 'technical_refactor',
        action: 'Complex refactoring',
        confidence: 0.65  // Below 0.80 escalation threshold
      };

      const result = await service.evaluateDecision(request);

      expect(result.should_escalate).toBe(true);
      expect(result.escalation_route).toBe('platform-arch@company.com');
      expect(result.requires_human_approval).toBe(true);
    });

    it('should not escalate decisions at 80% confidence threshold', async () => {
      const request: DecisionRequest = {
        workflow_id: 'workflow-123',
        item_id: 'item-1',
        category: 'technical_refactor',
        action: 'Refactoring',
        confidence: 0.80  // Exactly at threshold
      };

      const result = await service.evaluateDecision(request);

      expect(result.should_escalate).toBe(false);
      expect(result.escalation_route).toBeUndefined();
    });

    it('should generate unique decision IDs', async () => {
      const request: DecisionRequest = {
        workflow_id: 'workflow-123',
        item_id: 'item-1',
        category: 'technical_refactor',
        action: 'Refactoring',
        confidence: 0.90
      };

      const result1 = await service.evaluateDecision(request);
      const result2 = await service.evaluateDecision(request);

      expect(result1.decision.decision_id).toBeDefined();
      expect(result2.decision.decision_id).toBeDefined();
      expect(result1.decision.decision_id).toMatch(/^DEC-\d{4}-\d{5}$/);
    });

    it('should include workflow context in decision', async () => {
      const request: DecisionRequest = {
        workflow_id: 'workflow-123',
        item_id: 'item-1',
        category: 'architectural_change',
        action: 'Add new service',
        confidence: 0.92,
        context: {
          service_name: 'payment-service',
          estimated_cost: '$500/month'
        },
        trace_id: 'trace-456'
      };

      const result = await service.evaluateDecision(request);

      expect(result.decision.workflow_id).toBe('workflow-123');
      expect(result.decision.category).toBe('architectural_change');
      expect(result.decision.confidence).toBe(0.92);
    });
  });

  describe('Clarification Evaluation', () => {
    it('should require clarification when requirements are ambiguous', async () => {
      const requirements = 'Maybe we could add some authentication features';
      const acceptanceCriteria = ['Users can log in'];

      const result = await service.evaluateClarification(
        'workflow-123',
        requirements,
        acceptanceCriteria,
        0.85
      );

      expect(result.needs_clarification).toBe(true);
      expect(result.ambiguities.length).toBeGreaterThan(0);
      expect(result.ambiguities.some(a => a.includes('maybe'))).toBe(true);
      expect(result.ambiguities.some(a => a.includes('could'))).toBe(true);
      expect(result.ambiguities.some(a => a.includes('some'))).toBe(true);
    });

    it('should detect multiple ambiguous terms', async () => {
      const requirements = 'Probably we might need several features with a few improvements';
      const acceptanceCriteria = ['Feature works'];

      const result = await service.evaluateClarification(
        'workflow-123',
        requirements,
        acceptanceCriteria,
        0.85
      );

      expect(result.needs_clarification).toBe(true);
      expect(result.ambiguities.length).toBeGreaterThanOrEqual(4); // probably, might, several, few
    });

    it('should require clarification when acceptance criteria are missing', async () => {
      const requirements = 'Build a new authentication system';
      const acceptanceCriteria: string[] = [];

      const result = await service.evaluateClarification(
        'workflow-123',
        requirements,
        acceptanceCriteria,
        0.85
      );

      expect(result.needs_clarification).toBe(true);
      expect(result.missing_criteria).toContain('No acceptance criteria provided');
    });

    it('should require clarification when requirements are too brief', async () => {
      const requirements = 'Add auth';  // Very brief
      const acceptanceCriteria = ['Users can log in'];

      const result = await service.evaluateClarification(
        'workflow-123',
        requirements,
        acceptanceCriteria,
        0.85
      );

      expect(result.needs_clarification).toBe(true);
      expect(result.missing_criteria).toContain('Requirements too brief or missing');
    });

    it('should require clarification when confidence is low', async () => {
      const requirements = 'Build a comprehensive authentication system with OAuth2 support';
      const acceptanceCriteria = ['Users can log in', 'Supports OAuth2', 'Secure token storage'];

      const result = await service.evaluateClarification(
        'workflow-123',
        requirements,
        acceptanceCriteria,
        0.60  // Below 0.70 threshold
      );

      expect(result.needs_clarification).toBe(true);
      expect(result.confidence).toBe(0.60);
    });

    it('should not require clarification for clear, detailed requirements', async () => {
      const requirements = 'Build a comprehensive authentication system with OAuth2 support, JWT tokens, and secure password hashing';
      const acceptanceCriteria = [
        'Users can register with email/password',
        'Users can log in with OAuth2 (Google, GitHub)',
        'JWT tokens are issued upon successful login',
        'Passwords are hashed with bcrypt',
        'Token refresh mechanism is implemented'
      ];

      const result = await service.evaluateClarification(
        'workflow-123',
        requirements,
        acceptanceCriteria,
        0.90
      );

      expect(result.needs_clarification).toBe(false);
      expect(result.ambiguities).toHaveLength(0);
      expect(result.missing_criteria).toHaveLength(0);
      expect(result.confidence).toBe(0.90);
    });

    it('should be case-insensitive when detecting ambiguous terms', async () => {
      const requirements = 'MAYBE we COULD add SEVERAL features';
      const acceptanceCriteria = ['Feature works'];

      const result = await service.evaluateClarification(
        'workflow-123',
        requirements,
        acceptanceCriteria,
        0.85
      );

      expect(result.needs_clarification).toBe(true);
      expect(result.ambiguities.length).toBeGreaterThan(0);
    });

    it('should return all evaluation components', async () => {
      const requirements = 'Build auth system';
      const acceptanceCriteria: string[] = [];

      const result = await service.evaluateClarification(
        'workflow-123',
        requirements,
        acceptanceCriteria,
        0.50
      );

      expect(result).toHaveProperty('needs_clarification');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('ambiguities');
      expect(result).toHaveProperty('missing_criteria');
      expect(result).toHaveProperty('conflicting_constraints');
      expect(Array.isArray(result.ambiguities)).toBe(true);
      expect(Array.isArray(result.missing_criteria)).toBe(true);
      expect(Array.isArray(result.conflicting_constraints)).toBe(true);
    });
  });

  describe('Stage Decision Routing', () => {
    it('should evaluate decision gate for scaffolding stage', () => {
      const result = service.shouldEvaluateDecision('scaffolding', 'app');
      expect(result).toBe(true);
    });

    it('should evaluate decision gate for deployment stage', () => {
      const result = service.shouldEvaluateDecision('deployment', 'app');
      expect(result).toBe(true);
    });

    it('should evaluate decision gate for integration stage', () => {
      const result = service.shouldEvaluateDecision('integration', 'app');
      expect(result).toBe(true);
    });

    it('should evaluate decision gate for migration stage', () => {
      const result = service.shouldEvaluateDecision('migration', 'app');
      expect(result).toBe(true);
    });

    it('should not evaluate decision gate for validation stage', () => {
      const result = service.shouldEvaluateDecision('validation', 'app');
      expect(result).toBe(false);
    });

    it('should not evaluate decision gate for testing stage', () => {
      const result = service.shouldEvaluateDecision('testing', 'app');
      expect(result).toBe(false);
    });

    it('should evaluate clarification for initialization stage', () => {
      const result = service.shouldEvaluateClarification('initialization');
      expect(result).toBe(true);
    });

    it('should evaluate clarification for requirements_analysis stage', () => {
      const result = service.shouldEvaluateClarification('requirements_analysis');
      expect(result).toBe(true);
    });

    it('should not evaluate clarification for scaffolding stage', () => {
      const result = service.shouldEvaluateClarification('scaffolding');
      expect(result).toBe(false);
    });

    it('should not evaluate clarification for deployment stage', () => {
      const result = service.shouldEvaluateClarification('deployment');
      expect(result).toBe(false);
    });
  });

  describe('Decision Category Determination', () => {
    it('should categorize scaffolding as architectural change', () => {
      const category = service.getDecisionCategory('scaffolding', 'app');
      expect(category).toBe('architectural_change');
    });

    it('should categorize app deployment as cost impacting', () => {
      const category = service.getDecisionCategory('deployment', 'app');
      expect(category).toBe('cost_impacting');
    });

    it('should categorize non-app deployment as technical refactor', () => {
      const category = service.getDecisionCategory('deployment', 'feature');
      expect(category).toBe('technical_refactor');
    });

    it('should categorize integration as architectural change', () => {
      const category = service.getDecisionCategory('integration', 'app');
      expect(category).toBe('architectural_change');
    });

    it('should categorize migration as data migration', () => {
      const category = service.getDecisionCategory('migration', 'app');
      expect(category).toBe('data_migration');
    });

    it('should default to technical refactor for unknown stages', () => {
      const category = service.getDecisionCategory('unknown-stage', 'app');
      expect(category).toBe('technical_refactor');
    });

    it('should default to technical refactor for validation stage', () => {
      const category = service.getDecisionCategory('validation', 'app');
      expect(category).toBe('technical_refactor');
    });
  });

  describe('Policy Thresholds', () => {
    it('should respect technical_refactor threshold (85%)', async () => {
      const highConfidence = await service.evaluateDecision({
        workflow_id: 'workflow-123',
        item_id: 'item-1',
        category: 'technical_refactor',
        action: 'Refactor',
        confidence: 0.85  // Exactly at threshold
      });

      expect(highConfidence.auto_approved).toBe(true);

      const lowConfidence = await service.evaluateDecision({
        workflow_id: 'workflow-123',
        item_id: 'item-1',
        category: 'technical_refactor',
        action: 'Refactor',
        confidence: 0.84  // Below threshold
      });

      expect(lowConfidence.auto_approved).toBe(false);
    });

    it('should respect cost_impacting threshold (92%)', async () => {
      const highConfidence = await service.evaluateDecision({
        workflow_id: 'workflow-123',
        item_id: 'item-1',
        category: 'cost_impacting',
        action: 'Add resources',
        confidence: 0.93
      });

      // Still requires human approval even at high confidence
      expect(highConfidence.requires_human_approval).toBe(true);
      expect(highConfidence.auto_approved).toBe(false);
    });

    it('should respect security_affecting threshold (100%)', async () => {
      const perfectConfidence = await service.evaluateDecision({
        workflow_id: 'workflow-123',
        item_id: 'item-1',
        category: 'security_affecting',
        action: 'Update security',
        confidence: 1.0
      });

      // Even at 100% confidence, requires human approval
      expect(perfectConfidence.requires_human_approval).toBe(true);
      expect(perfectConfidence.auto_approved).toBe(false);
    });

    it('should respect architectural_change threshold (90%)', async () => {
      const highConfidence = await service.evaluateDecision({
        workflow_id: 'workflow-123',
        item_id: 'item-1',
        category: 'architectural_change',
        action: 'Change architecture',
        confidence: 0.95
      });

      // Always requires human approval
      expect(highConfidence.requires_human_approval).toBe(true);
      expect(highConfidence.auto_approved).toBe(false);
    });

    it('should respect data_migration threshold (95%)', async () => {
      const highConfidence = await service.evaluateDecision({
        workflow_id: 'workflow-123',
        item_id: 'item-1',
        category: 'data_migration',
        action: 'Migrate data',
        confidence: 0.97
      });

      // Always requires human approval
      expect(highConfidence.requires_human_approval).toBe(true);
      expect(highConfidence.auto_approved).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero confidence', async () => {
      const result = await service.evaluateDecision({
        workflow_id: 'workflow-123',
        item_id: 'item-1',
        category: 'technical_refactor',
        action: 'Refactor',
        confidence: 0
      });

      expect(result.auto_approved).toBe(false);
      expect(result.requires_human_approval).toBe(true);
      expect(result.should_escalate).toBe(true);
    });

    it('should handle perfect confidence', async () => {
      const result = await service.evaluateDecision({
        workflow_id: 'workflow-123',
        item_id: 'item-1',
        category: 'technical_refactor',
        action: 'Refactor',
        confidence: 1.0
      });

      expect(result.auto_approved).toBe(true);
      expect(result.requires_human_approval).toBe(false);
      expect(result.should_escalate).toBe(false);
    });

    it('should handle empty requirements string', async () => {
      const result = await service.evaluateClarification(
        'workflow-123',
        '',
        ['Some criteria'],
        0.90
      );

      expect(result.needs_clarification).toBe(true);
      expect(result.missing_criteria).toContain('Requirements too brief or missing');
    });

    it('should handle whitespace-only requirements', async () => {
      const result = await service.evaluateClarification(
        'workflow-123',
        '   ',
        ['Some criteria'],
        0.90
      );

      expect(result.needs_clarification).toBe(true);
      expect(result.missing_criteria).toContain('Requirements too brief or missing');
    });
  });
});
