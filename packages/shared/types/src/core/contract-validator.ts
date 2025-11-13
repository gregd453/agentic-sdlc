/**
 * Contract Validator - Phase 5
 *
 * Enforces message contracts at system boundaries.
 * Provides:
 * - Boundary validation (publication and consumption)
 * - Contract enforcement with clear error messages
 * - Integration with SchemaRegistry
 * - Fail-fast validation
 */

import { SchemaRegistry, ValidationResult } from './schema-registry';
import { VERSION } from './schemas';

/**
 * Validation boundary types
 */
export type ValidationBoundary = 'publication' | 'consumption' | 'persistence' | 'api';

/**
 * Contract violation error
 */
export class ContractViolationError extends Error {
  constructor(
    public readonly schemaName: string,
    public readonly boundary: ValidationBoundary,
    public readonly validationResult: ValidationResult,
    public readonly context?: Record<string, any>
  ) {
    super(`Contract violation at ${boundary}: ${schemaName} validation failed`);
    this.name = 'ContractViolationError';
  }

  /**
   * Get formatted error message for logging
   */
  toLogFormat(): Record<string, any> {
    return {
      error: 'CONTRACT_VIOLATION',
      schemaName: this.schemaName,
      boundary: this.boundary,
      errors: this.validationResult.errors,
      context: this.context
    };
  }
}

/**
 * Phase 5: ContractValidator
 * Validates messages against schemas at system boundaries
 */
export class ContractValidator {
  /**
   * Validate before publishing a message
   */
  static validatePublication<T = any>(
    schemaName: string,
    data: unknown,
    context?: Record<string, any>,
    version: string = VERSION
  ): T {
    const result = SchemaRegistry.validate<T>(schemaName, data, version);

    if (!result.success) {
      throw new ContractViolationError(schemaName, 'publication', result, context);
    }

    return result.data!;
  }

  /**
   * Validate after consuming a message
   */
  static validateConsumption<T = any>(
    schemaName: string,
    data: unknown,
    context?: Record<string, any>,
    version: string = VERSION
  ): T {
    const result = SchemaRegistry.validate<T>(schemaName, data, version);

    if (!result.success) {
      throw new ContractViolationError(schemaName, 'consumption', result, context);
    }

    return result.data!;
  }

  /**
   * Validate before persisting to database
   */
  static validatePersistence<T = any>(
    schemaName: string,
    data: unknown,
    context?: Record<string, any>,
    version: string = VERSION
  ): T {
    const result = SchemaRegistry.validate<T>(schemaName, data, version);

    if (!result.success) {
      throw new ContractViolationError(schemaName, 'persistence', result, context);
    }

    return result.data!;
  }

  /**
   * Validate at API boundary (request/response)
   */
  static validateAPI<T = any>(
    schemaName: string,
    data: unknown,
    context?: Record<string, any>,
    version: string = VERSION
  ): T {
    const result = SchemaRegistry.validate<T>(schemaName, data, version);

    if (!result.success) {
      throw new ContractViolationError(schemaName, 'api', result, context);
    }

    return result.data!;
  }

  /**
   * Safe validation that returns result without throwing
   */
  static validateSafe<T = any>(
    schemaName: string,
    data: unknown,
    version: string = VERSION
  ): ValidationResult<T> {
    return SchemaRegistry.validate<T>(schemaName, data, version);
  }

  /**
   * Validate with version compatibility check
   */
  static validateWithCompatibility<T = any>(
    schemaName: string,
    data: unknown,
    dataVersion: string,
    targetVersion: string = VERSION,
    context?: Record<string, any>
  ): T {
    // Check if versions are compatible
    const compatible = SchemaRegistry.isCompatible(schemaName, dataVersion, targetVersion);

    if (!compatible) {
      throw new ContractViolationError(
        schemaName,
        'consumption',
        {
          success: false,
          errors: [{
            path: [],
            message: `Incompatible versions: data version '${dataVersion}' is not compatible with '${targetVersion}'`,
            code: 'VERSION_INCOMPATIBLE'
          }]
        },
        context
      );
    }

    // Validate against target version
    return this.validateConsumption<T>(schemaName, data, context, targetVersion);
  }

  /**
   * Check if schema is deprecated and log warning
   */
  static checkDeprecation(
    schemaName: string,
    version: string = VERSION,
    logger?: { warn: (msg: string, data: any) => void }
  ): void {
    if (SchemaRegistry.isDeprecated(schemaName, version)) {
      const replacement = SchemaRegistry.getReplacement(schemaName, version);
      const message = replacement
        ? `Schema '${schemaName}' version '${version}' is deprecated. Use '${replacement}' instead.`
        : `Schema '${schemaName}' version '${version}' is deprecated.`;

      if (logger) {
        logger.warn(message, { schemaName, version, replacement });
      }
    }
  }
}
