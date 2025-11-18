import { z } from 'zod';
import { VersionValidator, VersionCompatibilityResult } from './version-validator';

/**
 * Contract definition for agent communication
 */
export interface AgentContract<TInput = any, TOutput = any> {
  /**
   * Contract identifier (e.g., 'scaffold-agent', 'validation-agent')
   */
  name: string;

  /**
   * Current contract version (semver)
   */
  version: string;

  /**
   * Supported schema versions for backward compatibility
   */
  supported_versions: string[];

  /**
   * Input schema (task/request format)
   */
  input_schema: z.ZodSchema<TInput>;

  /**
   * Output schema (result/response format)
   */
  output_schema: z.ZodSchema<TOutput>;

  /**
   * Optional migration functions for version upgrades
   */
  migrations?: Map<string, (data: any) => any>;

  /**
   * Breaking changes documentation
   */
  breaking_changes?: Map<string, string[]>;
}

/**
 * Contract validation result
 */
export interface ContractValidationResult {
  valid: boolean;
  contract_name: string;
  errors: ContractValidationError[];
  warnings: string[];
  version_compatibility?: VersionCompatibilityResult;
}

/**
 * Contract validation error
 */
export interface ContractValidationError {
  type: 'schema' | 'version' | 'migration' | 'breaking_change';
  field?: string;
  message: string;
  severity: LOG_LEVEL.ERROR | 'warning';
}

/**
 * Contract Validator
 * Validates agent messages against defined contracts with version compatibility
 */
export class ContractValidator {
  private versionValidator: VersionValidator;

  constructor(versionValidator?: VersionValidator) {
    this.versionValidator = versionValidator || new VersionValidator();
  }

  /**
   * Validate input data against contract
   */
  validateInput<T>(
    contract: AgentContract<T>,
    data: unknown,
    dataVersion?: string
  ): ContractValidationResult {
    const errors: ContractValidationError[] = [];
    const warnings: string[] = [];

    // Check version compatibility if provided
    let versionCompatibility: VersionCompatibilityResult | undefined;
    if (dataVersion) {
      versionCompatibility = this.versionValidator.isCompatible(
        contract.version,
        dataVersion
      );

      if (!versionCompatibility.compatible) {
        errors.push({
          type: 'version',
          message: versionCompatibility.reason || 'Version incompatible',
          severity: LOG_LEVEL.ERROR
        });

        return {
          valid: false,
          contract_name: contract.name,
          errors,
          warnings,
          version_compatibility: versionCompatibility
        };
      }

      if (versionCompatibility.breaking_changes) {
        warnings.push(...versionCompatibility.breaking_changes);
      }
    }

    // Apply migration if needed
    let processedData = data;
    if (dataVersion && dataVersion !== contract.version) {
      const migrationResult = this.applyMigration(
        contract,
        data,
        dataVersion,
        contract.version
      );

      if (!migrationResult.success) {
        errors.push({
          type: 'migration',
          message: migrationResult.error || 'Migration failed',
          severity: LOG_LEVEL.ERROR
        });

        return {
          valid: false,
          contract_name: contract.name,
          errors,
          warnings,
          version_compatibility: versionCompatibility
        };
      }

      processedData = migrationResult.data;
      if (migrationResult.warnings) {
        warnings.push(...migrationResult.warnings);
      }
    }

    // Validate against schema
    const schemaResult = contract.input_schema.safeParse(processedData);

    if (!schemaResult.success) {
      for (const issue of schemaResult.error.issues) {
        errors.push({
          type: 'schema',
          field: issue.path.join('.'),
          message: issue.message,
          severity: LOG_LEVEL.ERROR
        });
      }

      return {
        valid: false,
        contract_name: contract.name,
        errors,
        warnings,
        version_compatibility: versionCompatibility
      };
    }

    return {
      valid: true,
      contract_name: contract.name,
      errors: [],
      warnings,
      version_compatibility: versionCompatibility
    };
  }

  /**
   * Validate output data against contract
   */
  validateOutput<T>(
    contract: AgentContract<any, T>,
    data: unknown,
    dataVersion?: string
  ): ContractValidationResult {
    const errors: ContractValidationError[] = [];
    const warnings: string[] = [];

    // Check version compatibility if provided
    let versionCompatibility: VersionCompatibilityResult | undefined;
    if (dataVersion) {
      versionCompatibility = this.versionValidator.isCompatible(
        contract.version,
        dataVersion
      );

      if (!versionCompatibility.compatible) {
        errors.push({
          type: 'version',
          message: versionCompatibility.reason || 'Version incompatible',
          severity: LOG_LEVEL.ERROR
        });

        return {
          valid: false,
          contract_name: contract.name,
          errors,
          warnings,
          version_compatibility: versionCompatibility
        };
      }
    }

    // Validate against schema
    const schemaResult = contract.output_schema.safeParse(data);

    if (!schemaResult.success) {
      for (const issue of schemaResult.error.issues) {
        errors.push({
          type: 'schema',
          field: issue.path.join('.'),
          message: issue.message,
          severity: LOG_LEVEL.ERROR
        });
      }

      return {
        valid: false,
        contract_name: contract.name,
        errors,
        warnings,
        version_compatibility: versionCompatibility
      };
    }

    return {
      valid: true,
      contract_name: contract.name,
      errors: [],
      warnings,
      version_compatibility: versionCompatibility
    };
  }

  /**
   * Check backward compatibility between contract versions
   */
  checkBackwardCompatibility(
    oldContract: AgentContract,
    newContract: AgentContract
  ): ContractValidationResult {
    const errors: ContractValidationError[] = [];
    const warnings: string[] = [];

    // Contracts must have same name
    if (oldContract.name !== newContract.name) {
      errors.push({
        type: 'schema',
        message: `Contract names don't match: ${oldContract.name} vs ${newContract.name}`,
        severity: LOG_LEVEL.ERROR
      });
    }

    // Check version compatibility
    const versionCompatibility = this.versionValidator.isCompatible(
      newContract.version,
      oldContract.version
    );

    if (!versionCompatibility.compatible) {
      errors.push({
        type: 'version',
        message: versionCompatibility.reason || 'Versions incompatible',
        severity: LOG_LEVEL.ERROR
      });
    }

    // Check if new version supports old version
    const supportsOldVersion = newContract.supported_versions.includes(
      oldContract.version
    );

    if (!supportsOldVersion) {
      warnings.push(
        `New contract v${newContract.version} does not explicitly support old version v${oldContract.version}`
      );
    }

    // Check for breaking changes documentation
    if (newContract.breaking_changes?.has(oldContract.version)) {
      const changes = newContract.breaking_changes.get(oldContract.version) || [];
      for (const change of changes) {
        errors.push({
          type: 'breaking_change',
          message: change,
          severity: 'warning'
        });
      }
    }

    return {
      valid: errors.filter(e => e.severity === LOG_LEVEL.ERROR).length === 0,
      contract_name: newContract.name,
      errors,
      warnings,
      version_compatibility: versionCompatibility
    };
  }

  /**
   * Apply migration from one version to another
   */
  private applyMigration(
    contract: AgentContract,
    data: any,
    fromVersion: string,
    toVersion: string
  ): { success: boolean; data?: any; error?: string; warnings?: string[] } {
    const warnings: string[] = [];

    // No migration needed if versions are the same
    if (fromVersion === toVersion) {
      return { success: true, data };
    }

    // Check if migration function exists
    const migrationKey = `${fromVersion}->${toVersion}`;
    const migrationFn = contract.migrations?.get(migrationKey);

    if (!migrationFn) {
      // No explicit migration - try to validate as-is
      warnings.push(
        `No migration function found for ${migrationKey}, attempting direct validation`
      );
      return { success: true, data, warnings };
    }

    try {
      const migratedData = migrationFn(data);
      warnings.push(`Successfully migrated from ${fromVersion} to ${toVersion}`);
      return { success: true, data: migratedData, warnings };
    } catch (error) {
      return {
        success: false,
        error: `Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Validate contract definition itself
   */
  validateContractDefinition(contract: AgentContract): ContractValidationResult {
    const errors: ContractValidationError[] = [];
    const warnings: string[] = [];

    // Check required fields
    if (!contract.name) {
      errors.push({
        type: 'schema',
        field: 'name',
        message: 'Contract name is required',
        severity: LOG_LEVEL.ERROR
      });
    }

    if (!contract.version) {
      errors.push({
        type: 'schema',
        field: 'version',
        message: 'Contract version is required',
        severity: LOG_LEVEL.ERROR
      });
    } else {
      // Validate version format
      const versionResult = this.versionValidator.isCompatible(
        contract.version,
        contract.version
      );
      if (!versionResult.compatible) {
        errors.push({
          type: 'version',
          field: 'version',
          message: 'Invalid version format (must be semver)',
          severity: LOG_LEVEL.ERROR
        });
      }
    }

    if (!contract.input_schema) {
      errors.push({
        type: 'schema',
        field: 'input_schema',
        message: 'Input schema is required',
        severity: LOG_LEVEL.ERROR
      });
    }

    if (!contract.output_schema) {
      errors.push({
        type: 'schema',
        field: 'output_schema',
        message: 'Output schema is required',
        severity: LOG_LEVEL.ERROR
      });
    }

    // Check supported versions
    if (!contract.supported_versions || contract.supported_versions.length === 0) {
      warnings.push('No supported versions specified - contract may have compatibility issues');
    } else {
      // Current version should be in supported versions
      if (!contract.supported_versions.includes(contract.version)) {
        warnings.push(`Current version ${contract.version} not in supported_versions list`);
      }
    }

    return {
      valid: errors.length === 0,
      contract_name: contract.name,
      errors,
      warnings
    };
  }

  /**
   * Test contract with sample data
   */
  testContract<TInput, TOutput>(
    contract: AgentContract<TInput, TOutput>,
    sampleInput: unknown,
    sampleOutput: unknown
  ): {
    input_valid: boolean;
    output_valid: boolean;
    input_result: ContractValidationResult;
    output_result: ContractValidationResult;
  } {
    const inputResult = this.validateInput(contract, sampleInput);
    const outputResult = this.validateOutput(contract, sampleOutput);

    return {
      input_valid: inputResult.valid,
      output_valid: outputResult.valid,
      input_result: inputResult,
      output_result: outputResult
    };
  }
}
