import * as fs from 'fs-extra';
import * as yaml from 'js-yaml';
import * as path from 'path';
import { PolicyConfig, PolicyConfigSchema } from '../types';

/**
 * Load and parse policy configuration from YAML file
 */
export async function loadPolicyConfig(
  policyPath?: string
): Promise<PolicyConfig> {
  const defaultPolicyPath = path.join(
    process.cwd(),
    'ops/agentic/backlog/policy.yaml'
  );

  const filePath = policyPath || defaultPolicyPath;

  try {
    // Check if file exists
    const exists = await fs.pathExists(filePath);
    if (!exists) {
      throw new Error(`Policy file not found at: ${filePath}`);
    }

    // Read and parse YAML
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const parsed = yaml.load(fileContent);

    // Validate against schema
    return PolicyConfigSchema.parse(parsed);
  } catch (error) {
    throw new Error(
      `Failed to load policy config: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get default policy if no policy file is available
 */
export function getDefaultPolicy(): PolicyConfig {
  return {
    gates: {
      coverage: {
        metric: 'line_coverage',
        operator: '>=',
        threshold: 80,
        description: 'Minimum code coverage percentage',
        blocking: true
      },
      security: {
        metric: 'critical_vulns',
        operator: '==',
        threshold: 0,
        description: 'Zero critical vulnerabilities allowed',
        blocking: true
      }
    },
    observability: {
      logging: {
        level: LOG_LEVEL.INFO,
        structured: true
      }
    }
  };
}
