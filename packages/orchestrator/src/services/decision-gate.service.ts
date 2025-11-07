/**
 * Decision Gate Service
 * Integrates Phase 10 Decision & Clarification Flow with Orchestrator
 */

import { logger } from '../utils/logger';

// Import types from Phase 10 (ops/agentic)
export interface DecisionRequest {
  workflow_id: string;
  item_id: string;
  category: 'technical_refactor' | 'cost_impacting' | 'security_affecting' | 'architectural_change' | 'data_migration';
  action: string;
  confidence: number;
  context?: Record<string, unknown>;
  trace_id?: string;
}

export interface DecisionEvaluation {
  requires_human_approval: boolean;
  auto_approved: boolean;
  should_escalate: boolean;
  escalation_route?: string;
  decision: {
    decision_id: string;
    status: string;
    workflow_id: string;
    category: string;
    confidence: number;
  };
}

export interface ClarificationEvaluation {
  needs_clarification: boolean;
  confidence: number;
  ambiguities: string[];
  missing_criteria: string[];
  conflicting_constraints: string[];
}

/**
 * Decision Gate Service
 * Provides decision and clarification evaluation for workflows
 */
export class DecisionGateService {
  /**
   * Evaluate if a workflow action requires a decision
   */
  async evaluateDecision(request: DecisionRequest): Promise<DecisionEvaluation> {
    logger.info('Evaluating decision gate', {
      workflow_id: request.workflow_id,
      category: request.category,
      confidence: request.confidence,
    });

    // In production, this would call the Phase 10 decision engine
    // For now, implement basic logic inline
    const policyThresholds = {
      technical_refactor: { auto_min_confidence: 0.85, human_required: false },
      cost_impacting: { auto_min_confidence: 0.92, human_required: true },
      security_affecting: { auto_min_confidence: 1.0, human_required: true },
      architectural_change: { auto_min_confidence: 0.90, human_required: true },
      data_migration: { auto_min_confidence: 0.95, human_required: true },
    };

    const threshold = policyThresholds[request.category];
    const requires_human_approval =
      threshold.human_required || request.confidence < threshold.auto_min_confidence;
    const auto_approved =
      !threshold.human_required && request.confidence >= threshold.auto_min_confidence;
    const should_escalate = request.confidence < 0.80;

    const decision_id = `DEC-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 100000)).padStart(5, '0')}`;

    const evaluation: DecisionEvaluation = {
      requires_human_approval,
      auto_approved,
      should_escalate,
      escalation_route: should_escalate ? 'platform-arch@company.com' : undefined,
      decision: {
        decision_id,
        status: auto_approved ? 'approved' : 'pending',
        workflow_id: request.workflow_id,
        category: request.category,
        confidence: request.confidence,
      },
    };

    logger.info('Decision evaluation complete', {
      decision_id,
      requires_human_approval,
      auto_approved,
      should_escalate,
    });

    return evaluation;
  }

  /**
   * Evaluate if workflow requirements need clarification
   */
  async evaluateClarification(
    workflow_id: string,
    requirements: string,
    acceptanceCriteria: string[],
    confidence: number
  ): Promise<ClarificationEvaluation> {
    logger.info('Evaluating clarification need', {
      workflow_id,
      confidence,
      requirements_length: requirements.length,
      criteria_count: acceptanceCriteria.length,
    });

    const ambiguities: string[] = [];
    const missing_criteria: string[] = [];
    const conflicting_constraints: string[] = [];

    // Detect ambiguous terms
    const ambiguousTerms = ['maybe', 'probably', 'might', 'could', 'some', 'few', 'several'];
    ambiguousTerms.forEach((term) => {
      if (requirements.toLowerCase().includes(term)) {
        ambiguities.push(`Ambiguous term detected: "${term}"`);
      }
    });

    // Check for missing acceptance criteria
    if (!acceptanceCriteria || acceptanceCriteria.length === 0) {
      missing_criteria.push('No acceptance criteria provided');
    }

    // Check for vague requirements
    if (!requirements || requirements.trim().length < 20) {
      missing_criteria.push('Requirements too brief or missing');
    }

    const needs_clarification =
      confidence < 0.70 ||
      ambiguities.length > 0 ||
      missing_criteria.length > 0 ||
      conflicting_constraints.length > 0;

    logger.info('Clarification evaluation complete', {
      workflow_id,
      needs_clarification,
      ambiguities_count: ambiguities.length,
      missing_criteria_count: missing_criteria.length,
    });

    return {
      needs_clarification,
      confidence,
      ambiguities,
      missing_criteria,
      conflicting_constraints,
    };
  }

  /**
   * Determine if a stage requires a decision gate
   */
  shouldEvaluateDecision(stage: string, workflowType: string): boolean {
    // Decision gates for stages that might be high-impact
    const decisionGateStages = [
      'scaffolding',      // Architectural decisions
      'deployment',       // Cost/security impact
      'integration',      // Breaking changes possible
      'migration',        // Data safety
    ];

    return decisionGateStages.includes(stage);
  }

  /**
   * Determine if a stage requires clarification
   */
  shouldEvaluateClarification(stage: string): boolean {
    // Clarification needed at the start
    const clarificationStages = ['initialization', 'requirements_analysis'];
    return clarificationStages.includes(stage);
  }

  /**
   * Get decision category based on stage and workflow type
   */
  getDecisionCategory(
    stage: string,
    workflowType: string
  ): DecisionRequest['category'] {
    if (stage === 'scaffolding') {
      return 'architectural_change';
    }
    if (stage === 'deployment') {
      return workflowType === 'app' ? 'cost_impacting' : 'technical_refactor';
    }
    if (stage === 'integration') {
      return 'architectural_change';
    }
    if (stage === 'migration') {
      return 'data_migration';
    }
    return 'technical_refactor';
  }
}
