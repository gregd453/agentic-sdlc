import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs-extra';
import * as path from 'path';
import { loadPolicyConfig, getDefaultPolicy } from '../../utils/policy-loader';

describe('policy-loader', () => {
  const testDir = path.join(__dirname, '../fixtures/policy-test');

  beforeEach(async () => {
    await fs.ensureDir(testDir);
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  describe('loadPolicyConfig', () => {
    it('should load valid policy configuration', async () => {
      const policyPath = path.join(testDir, 'policy.yaml');
      const policyContent = `
gates:
  coverage:
    metric: "line_coverage"
    operator: ">="
    threshold: 80
    description: "Minimum code coverage"
    blocking: true
  security:
    metric: "critical_vulns"
    operator: "=="
    threshold: 0
    description: "No critical vulnerabilities"
    blocking: true
observability:
  logging:
    level: "info"
    structured: true
`;

      await fs.writeFile(policyPath, policyContent);

      const policy = await loadPolicyConfig(policyPath);

      expect(policy).toBeDefined();
      expect(policy.gates).toBeDefined();
      expect(policy.gates!.coverage).toBeDefined();
      expect(policy.gates!.coverage.threshold).toBe(80);
      expect(policy.gates!.security).toBeDefined();
      expect(policy.observability).toBeDefined();
    });

    it('should throw error if file does not exist', async () => {
      const nonExistentPath = path.join(testDir, 'nonexistent.yaml');

      await expect(loadPolicyConfig(nonExistentPath)).rejects.toThrow(
        /Policy file not found/
      );
    });

    it('should throw error for invalid YAML', async () => {
      const policyPath = path.join(testDir, 'invalid.yaml');
      await fs.writeFile(policyPath, 'invalid: yaml: content:');

      await expect(loadPolicyConfig(policyPath)).rejects.toThrow();
    });

    it('should handle empty policy file', async () => {
      const policyPath = path.join(testDir, 'empty.yaml');
      await fs.writeFile(policyPath, '{}');

      const policy = await loadPolicyConfig(policyPath);

      expect(policy).toBeDefined();
    });
  });

  describe('getDefaultPolicy', () => {
    it('should return default policy configuration', () => {
      const policy = getDefaultPolicy();

      expect(policy).toBeDefined();
      expect(policy.gates).toBeDefined();
      expect(policy.gates!.coverage).toBeDefined();
      expect(policy.gates!.coverage.threshold).toBe(80);
      expect(policy.gates!.security).toBeDefined();
      expect(policy.gates!.security.threshold).toBe(0);
    });

    it('should have coverage gate with blocking=true', () => {
      const policy = getDefaultPolicy();

      expect(policy.gates!.coverage.blocking).toBe(true);
    });

    it('should have security gate with blocking=true', () => {
      const policy = getDefaultPolicy();

      expect(policy.gates!.security.blocking).toBe(true);
    });
  });
});
