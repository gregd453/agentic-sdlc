import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs-extra';
import {
  ValidationCheckResult,
  TypeScriptValidationDetails
} from '../types';

const execAsync = promisify(exec);

/**
 * Validate TypeScript compilation
 */
export async function validateTypeScript(
  projectPath: string
): Promise<ValidationCheckResult> {
  const startTime = Date.now();

  try {
    // Check if tsconfig.json exists
    const tsconfigPath = path.join(projectPath, 'tsconfig.json');
    const hasTsConfig = await fs.pathExists(tsconfigPath);

    if (!hasTsConfig) {
      return {
        type: 'typescript',
        status: 'skipped',
        duration_ms: Date.now() - startTime,
        warnings: ['No tsconfig.json found, skipping TypeScript validation']
      };
    }

    // Run TypeScript compiler in check mode
    try {
      await execAsync(
        'npx tsc --noEmit --pretty false',
        {
          cwd: projectPath,
          maxBuffer: 10 * 1024 * 1024, // 10MB buffer
          timeout: 120000 // 2 minute timeout to prevent runaway processes
        }
      );

      // If no errors, compilation succeeded
      return {
        type: 'typescript',
        status: 'passed',
        duration_ms: Date.now() - startTime,
        details: {
          compilation_errors: 0,
          type_errors: 0,
          files_checked: 0, // We don't have exact count without parsing
          error_list: []
        } as TypeScriptValidationDetails
      };
    } catch (error: any) {
      // TypeScript errors are returned in stderr
      const output = error.stdout || error.stderr || '';
      const errors = parseTypeScriptErrors(output);

      return {
        type: 'typescript',
        status: WORKFLOW_STATUS.FAILED,
        duration_ms: Date.now() - startTime,
        errors: errors.map(e => `${e.file}:${e.line}:${e.column} - ${e.message}`),
        details: {
          compilation_errors: errors.length,
          type_errors: errors.length,
          files_checked: new Set(errors.map(e => e.file)).size,
          error_list: errors
        } as TypeScriptValidationDetails
      };
    }
  } catch (error) {
    return {
      type: 'typescript',
      status: WORKFLOW_STATUS.FAILED,
      duration_ms: Date.now() - startTime,
      errors: [`TypeScript validation failed: ${error instanceof Error ? error.message : String(error)}`]
    };
  }
}

/**
 * Parse TypeScript compiler errors from output
 */
function parseTypeScriptErrors(output: string): Array<{
  file: string;
  line: number;
  column: number;
  message: string;
  code?: string;
}> {
  const errors: Array<{
    file: string;
    line: number;
    column: number;
    message: string;
    code?: string;
  }> = [];

  // TypeScript error format: filename(line,column): error TS####: message
  const errorPattern = /^(.+?)\((\d+),(\d+)\):\s+error\s+(TS\d+):\s+(.+)$/gm;
  let match;

  while ((match = errorPattern.exec(output)) !== null) {
    errors.push({
      file: match[1],
      line: parseInt(match[2], 10),
      column: parseInt(match[3], 10),
      code: match[4],
      message: match[5]
    });
  }

  return errors;
}
