/**
 * Schema Registry - Phase 5
 *
 * Centralized schema management with version control and validation.
 * Provides:
 * - Schema registration and lookup by name and version
 * - Backward compatibility checking
 * - Schema validation utilities
 * - Contract enforcement
 */

import { z, ZodSchema } from 'zod';
import {
  WorkflowSchema,
  AgentTaskSchema,
  AgentResultSchema,
  PipelineStageSchema,
  EventSchema,
  VERSION
} from './schemas';

/**
 * Schema metadata for tracking versions and compatibility
 */
export interface SchemaMetadata {
  name: string;
  version: string;
  schema: ZodSchema;
  description?: string;
  compatibleWith?: string[]; // List of compatible versions
  deprecated?: boolean;
  deprecatedSince?: string;
  replacedBy?: string;
}

/**
 * Validation result with detailed error information
 */
export interface ValidationResult<T = any> {
  success: boolean;
  data?: T;
  errors?: ValidationError[];
}

export interface ValidationError {
  path: string[];
  message: string;
  code: string;
}

/**
 * Phase 5: SchemaRegistry
 * Central registry for all schemas with version management
 */
export class SchemaRegistry {
  private static schemas = new Map<string, Map<string, SchemaMetadata>>();
  private static initialized = false;

  /**
   * Initialize registry with core schemas
   */
  static initialize(): void {
    if (this.initialized) return;

    // Register core schemas at current version
    this.register({
      name: 'Workflow',
      version: VERSION,
      schema: WorkflowSchema,
      description: 'Core workflow schema with state management'
    });

    this.register({
      name: 'AgentTask',
      version: VERSION,
      schema: AgentTaskSchema,
      description: 'Agent task assignment schema'
    });

    this.register({
      name: 'AgentResult',
      version: VERSION,
      schema: AgentResultSchema,
      description: 'Agent result schema with metrics and artifacts'
    });

    this.register({
      name: 'PipelineStage',
      version: VERSION,
      schema: PipelineStageSchema,
      description: 'Pipeline stage configuration schema'
    });

    this.register({
      name: 'Event',
      version: VERSION,
      schema: EventSchema,
      description: 'System event schema'
    });

    this.initialized = true;
  }

  /**
   * Register a schema with version information
   */
  static register(metadata: SchemaMetadata): void {
    if (!this.schemas.has(metadata.name)) {
      this.schemas.set(metadata.name, new Map());
    }

    const versions = this.schemas.get(metadata.name)!;
    versions.set(metadata.version, metadata);
  }

  /**
   * Get schema by name and version (defaults to current version)
   */
  static getSchema(name: string, version: string = VERSION): ZodSchema | null {
    const versions = this.schemas.get(name);
    if (!versions) return null;

    const metadata = versions.get(version);
    return metadata?.schema || null;
  }

  /**
   * Get all versions of a schema
   */
  static getVersions(name: string): string[] {
    const versions = this.schemas.get(name);
    if (!versions) return [];

    return Array.from(versions.keys());
  }

  /**
   * Check if a schema version is compatible with another
   */
  static isCompatible(name: string, sourceVersion: string, targetVersion: string): boolean {
    if (sourceVersion === targetVersion) return true;

    const versions = this.schemas.get(name);
    if (!versions) return false;

    const sourceMetadata = versions.get(sourceVersion);
    if (!sourceMetadata) return false;

    return sourceMetadata.compatibleWith?.includes(targetVersion) || false;
  }

  /**
   * Validate data against a schema
   */
  static validate<T = any>(name: string, data: unknown, version: string = VERSION): ValidationResult<T> {
    const schema = this.getSchema(name, version);
    if (!schema) {
      return {
        success: false,
        errors: [{
          path: [],
          message: `Schema '${name}' version '${version}' not found`,
          code: 'SCHEMA_NOT_FOUND'
        }]
      };
    }

    const result = schema.safeParse(data);
    if (result.success) {
      return {
        success: true,
        data: result.data as T
      };
    }

    return {
      success: false,
      errors: result.error.errors.map(err => ({
        path: err.path.map(String),
        message: err.message,
        code: err.code
      }))
    };
  }

  /**
   * Get metadata for a schema
   */
  static getMetadata(name: string, version: string = VERSION): SchemaMetadata | null {
    const versions = this.schemas.get(name);
    if (!versions) return null;

    return versions.get(version) || null;
  }

  /**
   * List all registered schemas
   */
  static listSchemas(): string[] {
    return Array.from(this.schemas.keys());
  }

  /**
   * Check if a schema is deprecated
   */
  static isDeprecated(name: string, version: string = VERSION): boolean {
    const metadata = this.getMetadata(name, version);
    return metadata?.deprecated || false;
  }

  /**
   * Get replacement schema for deprecated schema
   */
  static getReplacement(name: string, version: string = VERSION): string | null {
    const metadata = this.getMetadata(name, version);
    return metadata?.replacedBy || null;
  }
}

// Auto-initialize on import
SchemaRegistry.initialize();
