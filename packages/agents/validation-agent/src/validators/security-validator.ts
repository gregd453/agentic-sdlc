import * as path from 'path';
import * as fs from 'fs-extra';
import { exec } from 'child_process';
import { promisify } from 'util';
import {
  ValidationCheckResult,
  SecurityValidationDetails
} from '../types';

const execAsync = promisify(exec);

interface NpmAuditVulnerability {
  severity: TASK_PRIORITY.CRITICAL | TASK_PRIORITY.HIGH | 'moderate' | TASK_PRIORITY.MEDIUM | TASK_PRIORITY.LOW | LOG_LEVEL.INFO;
  via: Array<{
    title: string;
    url?: string;
  }>;
  fixAvailable: boolean | { name: string; version: string };
}

interface NpmAuditReport {
  vulnerabilities: Record<string, NpmAuditVulnerability>;
  metadata: {
    vulnerabilities: {
      critical: number;
      high: number;
      moderate: number;
      low: number;
      info: number;
      total: number;
    };
  };
}

/**
 * Validate security with npm audit
 */
export async function validateSecurity(
  projectPath: string
): Promise<ValidationCheckResult> {
  const startTime = Date.now();

  try {
    // Check if package.json exists
    const packageJsonPath = path.join(projectPath, 'package.json');
    const hasPackageJson = await fs.pathExists(packageJsonPath);

    if (!hasPackageJson) {
      return {
        type: 'security',
        status: 'skipped',
        duration_ms: Date.now() - startTime,
        warnings: ['No package.json found, skipping security validation']
      };
    }

    // Check if node_modules exists
    const nodeModulesPath = path.join(projectPath, 'node_modules');
    const hasNodeModules = await fs.pathExists(nodeModulesPath);

    if (!hasNodeModules) {
      return {
        type: 'security',
        status: 'skipped',
        duration_ms: Date.now() - startTime,
        warnings: ['No node_modules found. Run npm/pnpm install first.']
      };
    }

    // Run npm audit with JSON output
    try {
      const { stdout } = await execAsync(
        'npm audit --json',
        {
          cwd: projectPath,
          maxBuffer: 10 * 1024 * 1024, // 10MB buffer
          timeout: 120000 // 2 minute timeout to prevent runaway processes
        }
      );

      const auditReport: NpmAuditReport = JSON.parse(stdout);
      return processAuditReport(auditReport, Date.now() - startTime);
    } catch (error: any) {
      // npm audit returns exit code 1 when vulnerabilities are found
      // Parse the JSON output even in error case
      if (error.stdout) {
        try {
          const auditReport: NpmAuditReport = JSON.parse(error.stdout);
          return processAuditReport(auditReport, Date.now() - startTime);
        } catch (parseError) {
          // Fall through to error handling below
        }
      }

      return {
        type: 'security',
        status: WORKFLOW_STATUS.FAILED,
        duration_ms: Date.now() - startTime,
        errors: [`Security audit failed: ${error.message}`]
      };
    }
  } catch (error) {
    return {
      type: 'security',
      status: WORKFLOW_STATUS.FAILED,
      duration_ms: Date.now() - startTime,
      errors: [`Security validation failed: ${error instanceof Error ? error.message : String(error)}`]
    };
  }
}

/**
 * Process npm audit report
 */
function processAuditReport(
  report: NpmAuditReport,
  duration: number
): ValidationCheckResult {
  const meta = report.metadata.vulnerabilities;

  const criticalCount = meta.critical || 0;
  const highCount = meta.high || 0;
  const mediumCount = meta.moderate || 0;
  const lowCount = meta.low || 0;
  const totalCount = meta.total || 0;

  // Extract vulnerability details
  const vulnerabilities: Array<{
    id: string;
    severity: TASK_PRIORITY.CRITICAL | TASK_PRIORITY.HIGH | TASK_PRIORITY.MEDIUM | TASK_PRIORITY.LOW;
    package: string;
    title: string;
    description?: string;
    url?: string;
    fixAvailable: boolean;
  }> = [];

  for (const [packageName, vuln] of Object.entries(report.vulnerabilities)) {
    // Skip info severity
    if (vuln.severity === LOG_LEVEL.INFO) continue;

    const via = Array.isArray(vuln.via) ? vuln.via[0] : vuln.via;
    const title = typeof via === 'object' ? via.title : String(via);
    const url = typeof via === 'object' ? via.url : undefined;

    // Map 'moderate' to TASK_PRIORITY.MEDIUM
    const severity: TASK_PRIORITY.CRITICAL | TASK_PRIORITY.HIGH | TASK_PRIORITY.MEDIUM | TASK_PRIORITY.LOW =
      vuln.severity === 'moderate' ? TASK_PRIORITY.MEDIUM :
      vuln.severity as TASK_PRIORITY.CRITICAL | TASK_PRIORITY.HIGH | TASK_PRIORITY.MEDIUM | TASK_PRIORITY.LOW;

    vulnerabilities.push({
      id: `${packageName}-${vuln.severity}`,
      severity,
      package: packageName,
      title,
      url,
      fixAvailable: Boolean(vuln.fixAvailable)
    });
  }

  const details: SecurityValidationDetails = {
    critical_vulnerabilities: criticalCount,
    high_vulnerabilities: highCount,
    medium_vulnerabilities: mediumCount,
    low_vulnerabilities: lowCount,
    total_vulnerabilities: totalCount,
    vulnerabilities: vulnerabilities.slice(0, 50) // Limit to 50
  };

  // Determine status - fail if critical or high vulnerabilities
  const status = criticalCount > 0 || highCount > 0 ? WORKFLOW_STATUS.FAILED :
                 mediumCount > 0 ? 'warning' : 'passed';

  const errors = criticalCount > 0 || highCount > 0
    ? [`Found ${criticalCount} critical and ${highCount} high severity vulnerabilities`]
    : undefined;

  const warnings = mediumCount > 0 || lowCount > 0
    ? [`Found ${mediumCount} medium and ${lowCount} low severity vulnerabilities`]
    : undefined;

  return {
    type: 'security',
    status,
    duration_ms: duration,
    errors,
    warnings,
    details
  };
}
