/**
 * Plan Coordinator
 *
 * Coordinates the Planning phase of the SDLC pipeline.
 * Receives project requirements and produces a detailed plan.
 *
 * Input: PlanInput (requirements, constraints, project metadata)
 * Output: PlanOutput (plan document, architecture diagram, risk assessment)
 *
 * Session #38: Example orchestrator implementation
 */

import { Envelope } from '../core/event-envelope';
import { BaseOrchestrator, OrchestratorOptions, OrchestratorOutput } from './base-orchestrator';

export interface PlanInput {
  projectId: string;
  requirements: string;
  projectType: 'app' | 'feature' | 'bugfix';
  constraints?: {
    timeframe?: string;
    budget?: string;
    technologies?: string[];
  };
}

export interface PlanOutput extends OrchestratorOutput {
  projectId: string;
  plan: {
    phases: string[];
    estimatedDuration: string;
    riskAssessment: string;
    recommendedTech: string[];
  };
  architecture: {
    layers: string[];
    components: string[];
    dataFlow: string;
  };
}

/**
 * Orchestrates the planning phase
 */
export class PlanCoordinator extends BaseOrchestrator<PlanInput, PlanOutput> {
  constructor(opts: OrchestratorOptions) {
    super(opts);
    this.log = this.log;
  }

  /**
   * Handle planning for a project
   */
  async handle(input: PlanInput, envelope: Envelope<PlanInput>): Promise<Partial<PlanOutput>> {
    const { projectId, requirements, projectType, constraints } = input;
    const corrId = envelope.corrId || envelope.id;

    this.log.info('Planning phase started', {
      projectId,
      projectType,
      corrId,
    });

    // Simulate AI-powered planning
    // In real implementation, this would call Claude API via AIApiPort
    const plan = this.generatePlan(requirements, projectType, constraints);
    const architecture = this.generateArchitecture(requirements, constraints?.technologies);

    this.log.info('Planning phase completed', {
      projectId,
      corrId,
      planPhases: plan.phases.length,
      architectureComponents: architecture.components.length,
    });

    return {
      projectId,
      plan,
      architecture,
    };
  }

  /**
   * Generate a plan based on requirements
   * (In production, this would integrate with Claude API)
   */
  private generatePlan(
    requirements: string,
    projectType: 'app' | 'feature' | 'bugfix',
    constraints?: any
  ) {
    // Simplified implementation
    const phases = this.getPhasesForType(projectType);

    return {
      phases,
      estimatedDuration: constraints?.timeframe ?? '4 weeks',
      riskAssessment: 'Low complexity project with clear requirements',
      recommendedTech: constraints?.technologies ?? ['TypeScript', 'React', 'Node.js'],
    };
  }

  /**
   * Generate architecture recommendations
   */
  private generateArchitecture(requirements: string, technologies?: string[]) {
    const techs = technologies ?? ['TypeScript', 'React', 'Node.js'];

    return {
      layers: ['Presentation', 'Business Logic', 'Data Access', 'Integration'],
      components: this.getComponentsForTechs(techs),
      dataFlow: 'Request → Validation → Processing → Response',
    };
  }

  /**
   * Get standard phases for project type
   */
  private getPhasesForType(projectType: string): string[] {
    const standardPhases = ['Planning', 'Design', 'Implementation', 'Testing', 'Deployment'];

    switch (projectType) {
      case 'feature':
        return ['Planning', 'Implementation', 'Testing', 'Deployment'];
      case 'bugfix':
        return ['Planning', 'Implementation', 'Testing', 'Deployment'];
      default:
        return standardPhases;
    }
  }

  /**
   * Map technologies to recommended components
   */
  private getComponentsForTechs(techs: string[]): string[] {
    const techToComponent: Record<string, string[]> = {
      'TypeScript': ['Type Safety', 'Build Pipeline'],
      'React': ['Component Library', 'State Management', 'Routing'],
      'Node.js': ['API Server', 'Middleware Stack', 'Database Integration'],
      'PostgreSQL': ['Data Schema', 'Migrations', 'Indexes'],
      'Redis': ['Cache Layer', 'Session Storage', 'Pub/Sub'],
    };

    const components = new Set<string>();
    for (const tech of techs) {
      const techComponents = techToComponent[tech] ?? [];
      techComponents.forEach((c) => components.add(c));
    }

    return Array.from(components);
  }
}
