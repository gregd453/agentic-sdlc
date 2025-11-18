import { PipelineDefinition, PipelineWebhook, PipelineExecution, PipelineStage } from '../types/pipeline.types';
import { logger } from '../utils/logger';
import { metrics } from '../utils/metrics';
import crypto from 'crypto';

/**
 * GitHub Actions webhook event types
 */
export type GitHubEvent =
  | 'push'
  | 'pull_request'
  | 'workflow_dispatch'
  | 'release'
  | AGENT_TYPES.DEPLOYMENT;

/**
 * GitHub webhook payload
 */
export interface GitHubWebhookPayload {
  ref: string;
  repository: {
    name: string;
    full_name: string;
    html_url: string;
  };
  sender: {
    login: string;
  };
  head_commit?: {
    id: string;
    message: string;
    author: {
      name: string;
      email: string;
    };
  };
  pull_request?: {
    number: number;
    title: string;
    head: {
      ref: string;
      sha: string;
    };
    base: {
      ref: string;
    };
  };
}

/**
 * GitHub Actions integration service
 */
export class GitHubActionsIntegration {
  private webhookSecret?: string;

  constructor(options?: { webhookSecret?: string }) {
    this.webhookSecret = options?.webhookSecret || process.env.GITHUB_WEBHOOK_SECRET;
  }

  /**
   * Verify GitHub webhook signature
   */
  verifySignature(payload: string, signature: string): boolean {
    if (!this.webhookSecret) {
      logger.warn('GitHub webhook secret not configured, skipping signature verification');
      return true; // Allow in development without secret
    }

    try {
      const hmac = crypto.createHmac('sha256', this.webhookSecret);
      const digest = `sha256=${hmac.update(payload).digest('hex')}`;

      // Constant-time comparison to prevent timing attacks
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(digest)
      );
    } catch (error) {
      logger.error('Failed to verify GitHub webhook signature', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Parse GitHub webhook to PipelineWebhook
   */
  parseWebhook(
    event: GitHubEvent,
    payload: GitHubWebhookPayload
  ): PipelineWebhook {
    const branch = this.extractBranch(event, payload);
    const commitSha = this.extractCommitSha(event, payload);
    const commitMessage = this.extractCommitMessage(event, payload);
    const author = this.extractAuthor(event, payload);

    const webhook: PipelineWebhook = {
      source: 'github',
      event,
      repository: payload.repository.full_name,
      branch,
      commit_sha: commitSha,
      commit_message: commitMessage,
      author,
      timestamp: new Date().toISOString(),
      payload: payload as unknown as Record<string, unknown>
    };

    logger.info('Parsed GitHub webhook', {
      event,
      repository: webhook.repository,
      branch: webhook.branch,
      commit_sha: webhook.commit_sha
    });

    metrics.increment('github.webhook.parsed', {
      event
    });

    return webhook;
  }

  /**
   * Determine if webhook should trigger pipeline
   */
  shouldTriggerPipeline(event: GitHubEvent, payload: GitHubWebhookPayload): boolean {
    switch (event) {
      case 'push':
        // Only trigger on main/develop branches or tags
        return this.isMainBranch(payload.ref) || this.isTag(payload.ref);

      case 'pull_request':
        // Trigger on PR open, sync, reopened
        const action = (payload as any).action;
        return ['opened', 'synchronize', 'reopened'].includes(action);

      case 'workflow_dispatch':
        // Manual triggers always run
        return true;

      case 'release':
        // Trigger on release published
        const releaseAction = (payload as any).action;
        return releaseAction === 'published';

      case AGENT_TYPES.DEPLOYMENT:
        // Trigger on deployment created
        const deploymentAction = (payload as any).action;
        return deploymentAction === 'created';

      default:
        return false;
    }
  }

  /**
   * Map GitHub webhook to pipeline definition
   */
  mapWebhookToPipeline(
    webhook: PipelineWebhook,
    workflowId: string
  ): PipelineDefinition {
    // Determine pipeline stages based on branch and event
    const stages = this.determinePipelineStages(webhook);

    const pipeline: PipelineDefinition = {
      id: crypto.randomUUID(),
      name: `${webhook.repository} - ${webhook.branch}`,
      description: `Pipeline triggered by ${webhook.event}`,
      version: '1.0.0',
      workflow_id: workflowId,
      stages,
      execution_mode: 'sequential',
      environment: {
        GIT_BRANCH: webhook.branch,
        GIT_COMMIT: webhook.commit_sha,
        GIT_AUTHOR: webhook.author,
        GITHUB_REPOSITORY: webhook.repository
      },
      metadata: {
        github_event: webhook.event,
        github_payload: webhook.payload
      }
    };

    return pipeline;
  }

  /**
   * Determine pipeline stages based on context
   */
  private determinePipelineStages(webhook: PipelineWebhook): PipelineStage[] {
    const isProduction = this.isMainBranch(`refs/heads/${webhook.branch}`);
    const isPullRequest = webhook.event === 'pull_request';

    // Base stages for all pipelines
    const stages: PipelineStage[] = [
      {
        id: 'build',
        name: 'Build',
        description: 'Compile and build artifacts',
        agent_type: AGENT_TYPES.SCAFFOLD,
        action: 'build',
        parameters: {},
        dependencies: [],
        quality_gates: [],
        timeout_ms: 600000,
        artifacts: [],
        continue_on_failure: false
      },
      {
        id: 'unit_test',
        name: 'Unit Tests',
        description: 'Run unit tests',
        agent_type: AGENT_TYPES.VALIDATION,
        action: 'test',
        parameters: {
          test_type: 'unit'
        },
        dependencies: [{ stage_id: 'build', required: true, condition: WORKFLOW_STATUS.SUCCESS }],
        quality_gates: [
          {
            name: 'coverage',
            metric: 'line_coverage',
            operator: '>=',
            threshold: 80,
            blocking: true,
            description: 'Minimum 80% code coverage'
          }
        ],
        timeout_ms: 300000,
        artifacts: [],
        continue_on_failure: false
      },
      {
        id: 'lint',
        name: 'Linting',
        description: 'Run code quality checks',
        agent_type: AGENT_TYPES.VALIDATION,
        action: 'lint',
        parameters: {},
        dependencies: [{ stage_id: 'build', required: true, condition: WORKFLOW_STATUS.SUCCESS }],
        quality_gates: [],
        timeout_ms: 120000,
        artifacts: [],
        continue_on_failure: false
      }
    ];

    // Add integration tests for PR and production
    if (isPullRequest || isProduction) {
      stages.push({
        id: 'integration_test',
        name: 'Integration Tests',
        description: 'Run integration tests',
        agent_type: AGENT_TYPES.INTEGRATION,
        action: 'test',
        parameters: {
          test_type: AGENT_TYPES.INTEGRATION
        },
        dependencies: [
          { stage_id: 'unit_test', required: true, condition: WORKFLOW_STATUS.SUCCESS }
        ],
        quality_gates: [],
        timeout_ms: 600000,
        artifacts: [],
        continue_on_failure: false
      });
    }

    // Add E2E tests for production
    if (isProduction) {
      stages.push({
        id: AGENT_TYPES.E2E_TEST,
        name: 'E2E Tests',
        description: 'Run end-to-end tests',
        agent_type: AGENT_TYPES.E2E_TEST,
        action: 'test',
        parameters: {
          browsers: ['chromium', 'firefox']
        } as Record<string, unknown>,
        dependencies: [
          { stage_id: 'integration_test', required: true, condition: WORKFLOW_STATUS.SUCCESS }
        ],
        quality_gates: [],
        timeout_ms: 900000,
        artifacts: [],
        continue_on_failure: false
      });

      // Add security scan
      stages.push({
        id: 'security_scan',
        name: 'Security Scan',
        description: 'Run security vulnerability scan',
        agent_type: AGENT_TYPES.VALIDATION,
        action: 'security_scan',
        parameters: {} as Record<string, unknown>,
        dependencies: [
          { stage_id: 'build', required: true, condition: WORKFLOW_STATUS.SUCCESS }
        ],
        quality_gates: [
          {
            name: 'security',
            metric: 'critical_vulns',
            operator: '==',
            threshold: 0,
            blocking: true,
            description: 'Zero critical vulnerabilities'
          }
        ],
        timeout_ms: 300000,
        artifacts: [],
        continue_on_failure: false
      });

      // Add deployment stage
      stages.push({
        id: 'deploy',
        name: 'Deploy to Production',
        description: 'Deploy to production environment',
        agent_type: AGENT_TYPES.DEPLOYMENT,
        action: 'deploy',
        parameters: {
          environment: 'production',
          strategy: 'blue-green'
        } as Record<string, unknown>,
        dependencies: [
          { stage_id: AGENT_TYPES.E2E_TEST, required: true, condition: WORKFLOW_STATUS.SUCCESS },
          { stage_id: 'security_scan', required: true, condition: WORKFLOW_STATUS.SUCCESS }
        ],
        quality_gates: [],
        timeout_ms: 1200000,
        artifacts: [],
        continue_on_failure: false
      });
    }

    return stages;
  }

  /**
   * Extract branch from webhook payload
   */
  private extractBranch(event: GitHubEvent, payload: GitHubWebhookPayload): string {
    if (event === 'pull_request' && payload.pull_request) {
      return payload.pull_request.head.ref;
    }

    if (payload.ref) {
      return payload.ref.replace('refs/heads/', '').replace('refs/tags/', '');
    }

    return 'unknown';
  }

  /**
   * Extract commit SHA from webhook payload
   */
  private extractCommitSha(event: GitHubEvent, payload: GitHubWebhookPayload): string {
    if (event === 'pull_request' && payload.pull_request) {
      return payload.pull_request.head.sha;
    }

    if (payload.head_commit) {
      return payload.head_commit.id;
    }

    return 'unknown';
  }

  /**
   * Extract commit message from webhook payload
   */
  private extractCommitMessage(event: GitHubEvent, payload: GitHubWebhookPayload): string | undefined {
    if (event === 'pull_request' && payload.pull_request) {
      return payload.pull_request.title;
    }

    return payload.head_commit?.message;
  }

  /**
   * Extract author from webhook payload
   */
  private extractAuthor(_event: GitHubEvent, payload: GitHubWebhookPayload): string {
    if (payload.sender) {
      return payload.sender.login;
    }

    if (payload.head_commit?.author) {
      return payload.head_commit.author.name;
    }

    return 'unknown';
  }

  /**
   * Check if ref is a main branch
   */
  private isMainBranch(ref: string): boolean {
    const branch = ref.replace('refs/heads/', '');
    return ['main', 'master', 'production', 'develop'].includes(branch);
  }

  /**
   * Check if ref is a tag
   */
  private isTag(ref: string): boolean {
    return ref.startsWith('refs/tags/');
  }

  /**
   * Report pipeline status back to GitHub
   */
  async reportStatus(
    execution: PipelineExecution,
    _githubToken?: string
  ): Promise<void> {
    // This would use GitHub's Commit Status API
    // or Checks API to report pipeline status
    // For now, just log

    logger.info('Reporting pipeline status to GitHub', {
      execution_id: execution.id,
      status: execution.status,
      commit_sha: execution.commit_sha
    });

    // TODO: Implement GitHub API call to create/update status
    // https://docs.github.com/en/rest/commits/statuses
    // Will use _githubToken when implemented
  }
}
