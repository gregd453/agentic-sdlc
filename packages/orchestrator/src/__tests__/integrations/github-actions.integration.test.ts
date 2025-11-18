import { describe, it, expect, beforeEach } from 'vitest';
import { GitHubActionsIntegration, GitHubWebhookPayload } from '../../integrations/github-actions.integration';

describe('GitHubActionsIntegration', () => {
  let integration: GitHubActionsIntegration;

  beforeEach(() => {
    integration = new GitHubActionsIntegration();
  });

  describe('parseWebhook', () => {
    it('should parse push event webhook', () => {
      const payload: GitHubWebhookPayload = {
        ref: 'refs/heads/main',
        repository: {
          name: 'test-repo',
          full_name: 'test-org/test-repo',
          html_url: 'https://github.com/test-org/test-repo'
        },
        sender: {
          login: 'octocat'
        },
        head_commit: {
          id: 'abc123',
          message: 'feat: add new feature',
          author: {
            name: 'Octocat',
            email: 'octocat@github.com'
          }
        }
      };

      const webhook = integration.parseWebhook('push', payload);

      expect(webhook.source).toBe('github');
      expect(webhook.event).toBe('push');
      expect(webhook.repository).toBe('test-org/test-repo');
      expect(webhook.branch).toBe('main');
      expect(webhook.commit_sha).toBe('abc123');
      expect(webhook.commit_message).toBe('feat: add new feature');
      expect(webhook.author).toBe('octocat');
    });

    it('should parse pull request event webhook', () => {
      const payload: GitHubWebhookPayload = {
        ref: 'refs/heads/feature-branch',
        repository: {
          name: 'test-repo',
          full_name: 'test-org/test-repo',
          html_url: 'https://github.com/test-org/test-repo'
        },
        sender: {
          login: 'octocat'
        },
        pull_request: {
          number: 42,
          title: 'Add awesome feature',
          head: {
            ref: 'feature-branch',
            sha: 'def456'
          },
          base: {
            ref: 'main'
          }
        }
      };

      const webhook = integration.parseWebhook('pull_request', payload);

      expect(webhook.branch).toBe('feature-branch');
      expect(webhook.commit_sha).toBe('def456');
      expect(webhook.commit_message).toBe('Add awesome feature');
    });

    it('should handle tag push', () => {
      const payload: GitHubWebhookPayload = {
        ref: 'refs/tags/v1.0.0',
        repository: {
          name: 'test-repo',
          full_name: 'test-org/test-repo',
          html_url: 'https://github.com/test-org/test-repo'
        },
        sender: {
          login: 'octocat'
        },
        head_commit: {
          id: 'tag123',
          message: 'Release v1.0.0',
          author: {
            name: 'Octocat',
            email: 'octocat@github.com'
          }
        }
      };

      const webhook = integration.parseWebhook('push', payload);

      expect(webhook.branch).toBe('v1.0.0');
    });
  });

  describe('shouldTriggerPipeline', () => {
    it('should trigger on push to main branch', () => {
      const payload: GitHubWebhookPayload = {
        ref: 'refs/heads/main',
        repository: {
          name: 'test-repo',
          full_name: 'test-org/test-repo',
          html_url: 'https://github.com/test-org/test-repo'
        },
        sender: {
          login: 'octocat'
        }
      };

      const shouldTrigger = integration.shouldTriggerPipeline('push', payload);

      expect(shouldTrigger).toBe(true);
    });

    it('should trigger on push to develop branch', () => {
      const payload: GitHubWebhookPayload = {
        ref: 'refs/heads/develop',
        repository: {
          name: 'test-repo',
          full_name: 'test-org/test-repo',
          html_url: 'https://github.com/test-org/test-repo'
        },
        sender: {
          login: 'octocat'
        }
      };

      const shouldTrigger = integration.shouldTriggerPipeline('push', payload);

      expect(shouldTrigger).toBe(true);
    });

    it('should not trigger on push to feature branch', () => {
      const payload: GitHubWebhookPayload = {
        ref: 'refs/heads/feature-branch',
        repository: {
          name: 'test-repo',
          full_name: 'test-org/test-repo',
          html_url: 'https://github.com/test-org/test-repo'
        },
        sender: {
          login: 'octocat'
        }
      };

      const shouldTrigger = integration.shouldTriggerPipeline('push', payload);

      expect(shouldTrigger).toBe(false);
    });

    it('should trigger on tag push', () => {
      const payload: GitHubWebhookPayload = {
        ref: 'refs/tags/v1.0.0',
        repository: {
          name: 'test-repo',
          full_name: 'test-org/test-repo',
          html_url: 'https://github.com/test-org/test-repo'
        },
        sender: {
          login: 'octocat'
        }
      };

      const shouldTrigger = integration.shouldTriggerPipeline('push', payload);

      expect(shouldTrigger).toBe(true);
    });

    it('should trigger on PR opened', () => {
      const payload = {
        action: 'opened',
        repository: {
          name: 'test-repo',
          full_name: 'test-org/test-repo',
          html_url: 'https://github.com/test-org/test-repo'
        },
        sender: {
          login: 'octocat'
        }
      } as any;

      const shouldTrigger = integration.shouldTriggerPipeline('pull_request', payload);

      expect(shouldTrigger).toBe(true);
    });

    it('should trigger on PR synchronize', () => {
      const payload = {
        action: 'synchronize',
        repository: {
          name: 'test-repo',
          full_name: 'test-org/test-repo',
          html_url: 'https://github.com/test-org/test-repo'
        },
        sender: {
          login: 'octocat'
        }
      } as any;

      const shouldTrigger = integration.shouldTriggerPipeline('pull_request', payload);

      expect(shouldTrigger).toBe(true);
    });

    it('should not trigger on PR closed', () => {
      const payload = {
        action: 'closed',
        repository: {
          name: 'test-repo',
          full_name: 'test-org/test-repo',
          html_url: 'https://github.com/test-org/test-repo'
        },
        sender: {
          login: 'octocat'
        }
      } as any;

      const shouldTrigger = integration.shouldTriggerPipeline('pull_request', payload);

      expect(shouldTrigger).toBe(false);
    });

    it('should always trigger on workflow_dispatch', () => {
      const payload: GitHubWebhookPayload = {
        ref: 'refs/heads/any-branch',
        repository: {
          name: 'test-repo',
          full_name: 'test-org/test-repo',
          html_url: 'https://github.com/test-org/test-repo'
        },
        sender: {
          login: 'octocat'
        }
      };

      const shouldTrigger = integration.shouldTriggerPipeline('workflow_dispatch', payload);

      expect(shouldTrigger).toBe(true);
    });
  });

  describe('mapWebhookToPipeline', () => {
    it('should create basic pipeline for feature branch', () => {
      const webhook = {
        source: 'github' as const,
        event: 'push',
        repository: 'test-org/test-repo',
        branch: 'feature-branch',
        commit_sha: 'abc123',
        commit_message: 'feat: add feature',
        author: 'octocat',
        timestamp: new Date().toISOString(),
        payload: {}
      };

      const pipeline = integration.mapWebhookToPipeline(webhook, 'workflow-123');

      expect(pipeline.name).toContain('test-org/test-repo');
      expect(pipeline.workflow_id).toBe('workflow-123');
      expect(pipeline.environment).toMatchObject({
        GIT_BRANCH: 'feature-branch',
        GIT_COMMIT: 'abc123',
        GIT_AUTHOR: 'octocat'
      });

      // Feature branch should have basic stages
      expect(pipeline.stages.length).toBeGreaterThan(0);
      expect(pipeline.stages.some(s => s.id === 'build')).toBe(true);
      expect(pipeline.stages.some(s => s.id === 'unit_test')).toBe(true);
    });

    it('should create comprehensive pipeline for main branch', () => {
      const webhook = {
        source: 'github' as const,
        event: 'push',
        repository: 'test-org/test-repo',
        branch: 'main',
        commit_sha: 'abc123',
        commit_message: 'feat: add feature',
        author: 'octocat',
        timestamp: new Date().toISOString(),
        payload: {}
      };

      const pipeline = integration.mapWebhookToPipeline(webhook, 'workflow-123');

      // Main branch should have all stages including E2E and deployment
      expect(pipeline.stages.some(s => s.id === 'build')).toBe(true);
      expect(pipeline.stages.some(s => s.id === 'unit_test')).toBe(true);
      expect(pipeline.stages.some(s => s.id === 'integration_test')).toBe(true);
      expect(pipeline.stages.some(s => s.id === AGENT_TYPES.E2E_TEST)).toBe(true);
      expect(pipeline.stages.some(s => s.id === 'security_scan')).toBe(true);
      expect(pipeline.stages.some(s => s.id === 'deploy')).toBe(true);
    });

    it('should include integration tests for pull requests', () => {
      const webhook = {
        source: 'github' as const,
        event: 'pull_request',
        repository: 'test-org/test-repo',
        branch: 'feature-branch',
        commit_sha: 'abc123',
        commit_message: 'feat: add feature',
        author: 'octocat',
        timestamp: new Date().toISOString(),
        payload: {}
      };

      const pipeline = integration.mapWebhookToPipeline(webhook, 'workflow-123');

      // PR should include integration tests
      expect(pipeline.stages.some(s => s.id === 'integration_test')).toBe(true);
    });

    it('should set up stage dependencies correctly', () => {
      const webhook = {
        source: 'github' as const,
        event: 'push',
        repository: 'test-org/test-repo',
        branch: 'main',
        commit_sha: 'abc123',
        commit_message: 'feat: add feature',
        author: 'octocat',
        timestamp: new Date().toISOString(),
        payload: {}
      };

      const pipeline = integration.mapWebhookToPipeline(webhook, 'workflow-123');

      // Unit test should depend on build
      const unitTest = pipeline.stages.find(s => s.id === 'unit_test');
      expect(unitTest?.dependencies).toContainEqual({
        stage_id: 'build',
        required: true,
        condition: WORKFLOW_STATUS.SUCCESS
      });

      // Deploy should depend on E2E and security
      const deploy = pipeline.stages.find(s => s.id === 'deploy');
      expect(deploy?.dependencies.length).toBeGreaterThan(1);
    });
  });

  describe('verifySignature', () => {
    it('should return true when no secret is configured', () => {
      const result = integration.verifySignature('payload', 'signature');

      expect(result).toBe(true);
    });

    it('should verify valid signature', () => {
      const secret = 'test-secret';
      const integration = new GitHubActionsIntegration({ webhookSecret: secret });

      const payload = 'test-payload';
      const crypto = require('crypto');
      const hmac = crypto.createHmac('sha256', secret);
      const signature = `sha256=${hmac.update(payload).digest('hex')}`;

      const result = integration.verifySignature(payload, signature);

      expect(result).toBe(true);
    });

    it('should reject invalid signature', () => {
      const integration = new GitHubActionsIntegration({ webhookSecret: 'test-secret' });

      const result = integration.verifySignature('payload', 'sha256=invalid');

      expect(result).toBe(false);
    });
  });
});
