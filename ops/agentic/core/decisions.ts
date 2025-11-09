/**
 * Decision Engine - Core decision evaluation and negotiation
 * Implements policy-based decision making for security/cost-impacting actions
 */

import { z } from 'zod';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { parse as parseYaml } from 'yaml';

// Zod Schemas for Type Safety
export const DecisionCategorySchema = z.enum([
  'technical_refactor',
  'cost_impacting',
  'security_affecting',
  'architectural_change',
  'data_migration',
]);

export const DecisionOptionSchema = z.object({
  option_id: z.string(),
  label: z.string(),
  description: z.string(),
  risks: z.array(z.string()),
  estimated_time: z.string(),
  estimated_cost: z.string(),
});

export const DecisionStatusSchema = z.enum([
  'pending',
  'approved',
  'rejected',
  'escalated',
  'revised',
  'aborted',
]);

export const DecisionResultSchema = z.object({
  decision_id: z.string(),
  schema_version: z.string(),
  workflow_id: z.string(),
  item_id: z.string(),
  category: DecisionCategorySchema,
  action: z.string(),
  confidence: z.number().min(0).max(1),
  options: z.array(DecisionOptionSchema),
  recommendation: z.string(),
  status: DecisionStatusSchema,
  selected_option: z.string().optional(),
  operator: z.string().optional(),
  rationale: z.string().optional(),
  timestamp: z.string().datetime(),
  decided_at: z.string().datetime().optional(),
  trace_id: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const PolicyThresholdSchema = z.object({
  auto_min_confidence: z.number().min(0).max(1),
  human_required: z.boolean(),
  description: z.string(),
});

export const EscalationRuleSchema = z.object({
  route: z.string(),
  description: z.string(),
}).passthrough(); // Allow additional fields like 'under', 'over_amount', 'categories'

export const PolicySchema = z.object({
  decisions: z.object({
    thresholds: z.record(PolicyThresholdSchema),
    escalation: z.record(EscalationRuleSchema),
    timeout: z.object({
      interactive_seconds: z.number(),
      non_interactive_fail_immediately: z.boolean(),
    }),
  }),
  gates: z.record(z.unknown()),
  release: z.record(z.unknown()),
  clarifications: z.record(z.unknown()).optional(),
  cost: z.record(z.unknown()).optional(),
  observability: z.record(z.unknown()).optional(),
  security: z.record(z.unknown()).optional(),
  error_handling: z.record(z.unknown()).optional(),
});

// Type Exports
export type DecisionCategory = z.infer<typeof DecisionCategorySchema>;
export type DecisionOption = z.infer<typeof DecisionOptionSchema>;
export type DecisionStatus = z.infer<typeof DecisionStatusSchema>;
export type DecisionResult = z.infer<typeof DecisionResultSchema>;
export type PolicyThreshold = z.infer<typeof PolicyThresholdSchema>;
export type EscalationRule = z.infer<typeof EscalationRuleSchema>;
export type Policy = z.infer<typeof PolicySchema>;

// Decision Request Input
export interface DecisionRequest {
  workflow_id: string;
  item_id: string;
  category: DecisionCategory;
  action: string;
  confidence: number;
  context?: Record<string, unknown>;
  trace_id?: string;
}

// Decision Evaluation Result
export interface DecisionEvaluation {
  requires_human_approval: boolean;
  auto_approved: boolean;
  should_escalate: boolean;
  escalation_route?: string;
  decision: DecisionResult;
}

/**
 * Decision Engine Class
 */
export class DecisionEngine {
  private policy: Policy;
  private policyPath: string;
  private runsDir: string;

  constructor(policyPath?: string, runsDir?: string) {
    this.policyPath = policyPath || join(process.cwd(), 'ops/agentic/backlog/policy.yaml');
    this.runsDir = runsDir || join(process.cwd(), 'ops/agentic/runs');
    this.policy = this.loadPolicy();
    this.ensureRunsDirectory();
  }

  /**
   * Load and validate policy from YAML
   */
  private loadPolicy(): Policy {
    try {
      const yamlContent = readFileSync(this.policyPath, 'utf-8');
      const parsed = parseYaml(yamlContent);
      return PolicySchema.parse(parsed);
    } catch (error) {
      throw new Error(`Failed to load policy from ${this.policyPath}: ${error}`);
    }
  }

  /**
   * Reload policy (useful for testing or runtime updates)
   */
  public reloadPolicy(): void {
    this.policy = this.loadPolicy();
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
   * Generate unique decision ID
   */
  private generateDecisionId(): string {
    const year = new Date().getFullYear();
    const counter = String(Math.floor(Math.random() * 100000)).padStart(5, '0');
    return `DEC-${year}-${counter}`;
  }

  /**
   * Create decision options based on category
   */
  private createDecisionOptions(category: DecisionCategory, action: string): DecisionOption[] {
    const baseOptions: DecisionOption[] = [
      {
        option_id: 'approve',
        label: 'Approve',
        description: 'Proceed with the proposed action',
        risks: ['Implementation may have unforeseen consequences'],
        estimated_time: '0h',
        estimated_cost: '$0',
      },
      {
        option_id: 'revise',
        label: 'Revise',
        description: 'Request modifications to the proposal',
        risks: ['Delays workflow progress'],
        estimated_time: '2h',
        estimated_cost: 'low',
      },
      {
        option_id: 'escalate',
        label: 'Escalate',
        description: 'Escalate decision to appropriate stakeholders',
        risks: ['Significant delay in workflow'],
        estimated_time: '1d',
        estimated_cost: 'medium',
      },
      {
        option_id: 'abort',
        label: 'Abort',
        description: 'Cancel this action and fail the workflow',
        risks: ['Workflow will be terminated'],
        estimated_time: '0h',
        estimated_cost: '$0',
      },
    ];

    // Customize risks based on category
    if (category === 'security_affecting') {
      baseOptions[0].risks.push('Security vulnerability may be introduced');
    } else if (category === 'cost_impacting') {
      baseOptions[0].risks.push('Increased infrastructure costs');
    } else if (category === 'data_migration') {
      baseOptions[0].risks.push('Data loss or corruption possible');
    }

    return baseOptions;
  }

  /**
   * Evaluate a decision request against policy
   */
  public evaluate(request: DecisionRequest): DecisionEvaluation {
    const threshold = this.policy.decisions.thresholds[request.category];

    if (!threshold) {
      throw new Error(`Unknown decision category: ${request.category}`);
    }

    const decision_id = this.generateDecisionId();
    const options = this.createDecisionOptions(request.category, request.action);

    // Create decision result
    const decision: DecisionResult = {
      decision_id,
      schema_version: '1.0.0',
      workflow_id: request.workflow_id,
      item_id: request.item_id,
      category: request.category,
      action: request.action,
      confidence: request.confidence,
      options,
      recommendation: 'approve',
      status: 'pending',
      timestamp: new Date().toISOString(),
      trace_id: request.trace_id,
      metadata: request.context,
    };

    // Determine if human approval is required
    const requires_human_approval =
      threshold.human_required ||
      request.confidence < threshold.auto_min_confidence;

    // Check for auto-approval
    const auto_approved =
      !threshold.human_required &&
      request.confidence >= threshold.auto_min_confidence;

    // Check for escalation (low confidence)
    const should_escalate = request.confidence < 0.80;
    const escalation_route = should_escalate
      ? this.getEscalationRoute(request.category, request.confidence)
      : undefined;

    // If auto-approved, mark as approved
    if (auto_approved) {
      decision.status = 'approved';
      decision.selected_option = 'approve';
      decision.decided_at = new Date().toISOString();
      decision.operator = 'system';
      decision.rationale = `Auto-approved: confidence ${request.confidence.toFixed(2)} >= threshold ${threshold.auto_min_confidence}`;
    }

    return {
      requires_human_approval,
      auto_approved,
      should_escalate,
      escalation_route,
      decision,
    };
  }

  /**
   * Get escalation route based on category and confidence
   */
  private getEscalationRoute(category: DecisionCategory, confidence: number): string | undefined {
    const escalationRules = this.policy.decisions.escalation;

    if (confidence < 0.80 && escalationRules.low_confidence) {
      return escalationRules.low_confidence.route as string;
    }

    if (category === 'security_affecting' && escalationRules.security_critical) {
      return escalationRules.security_critical.route as string;
    }

    return undefined;
  }

  /**
   * Record operator decision
   */
  public recordDecision(
    decision: DecisionResult,
    selected_option: string,
    operator: string,
    rationale?: string
  ): DecisionResult {
    const updated: DecisionResult = {
      ...decision,
      status: this.mapOptionToStatus(selected_option),
      selected_option,
      operator,
      rationale,
      decided_at: new Date().toISOString(),
    };

    // Persist to disk
    this.persistDecision(updated);

    return updated;
  }

  /**
   * Map selected option to status
   */
  private mapOptionToStatus(option_id: string): DecisionStatus {
    switch (option_id) {
      case 'approve':
        return 'approved';
      case 'revise':
        return 'revised';
      case 'escalate':
        return 'escalated';
      case 'abort':
        return 'aborted';
      default:
        return 'pending';
    }
  }

  /**
   * Persist decision to disk
   */
  private persistDecision(decision: DecisionResult): void {
    const today = new Date().toISOString().split('T')[0];
    const todayDir = join(this.runsDir, today);
    const filePath = join(todayDir, `${decision.decision_id}.json`);

    writeFileSync(filePath, JSON.stringify(decision, null, 2), 'utf-8');
  }

  /**
   * Get decision by ID
   */
  public getDecision(decision_id: string): DecisionResult | null {
    try {
      // Extract date from decision_id (DEC-YYYY-NNNNN)
      const match = decision_id.match(/^DEC-(\d{4})-\d{5}$/);
      if (!match) {
        return null;
      }

      // Search in recent days (last 30 days)
      const today = new Date();
      for (let i = 0; i < 30; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const filePath = join(this.runsDir, dateStr, `${decision_id}.json`);

        try {
          const content = readFileSync(filePath, 'utf-8');
          return DecisionResultSchema.parse(JSON.parse(content));
        } catch {
          // File doesn't exist, continue
          continue;
        }
      }

      return null;
    } catch (error) {
      console.error(`Error loading decision ${decision_id}:`, error);
      return null;
    }
  }

  /**
   * Get policy summary (for CLI display)
   */
  public getPolicySummary(): Record<string, PolicyThreshold> {
    return this.policy.decisions.thresholds;
  }
}

/**
 * Create a decision evaluation (convenience function)
 */
export function evaluateDecision(request: DecisionRequest): DecisionEvaluation {
  const engine = new DecisionEngine();
  return engine.evaluate(request);
}

/**
 * Record a decision (convenience function)
 */
export function recordOperatorDecision(
  decision: DecisionResult,
  selected_option: string,
  operator: string,
  rationale?: string
): DecisionResult {
  const engine = new DecisionEngine();
  return engine.recordDecision(decision, selected_option, operator, rationale);
}
