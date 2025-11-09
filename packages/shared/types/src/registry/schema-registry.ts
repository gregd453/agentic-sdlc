import { z } from 'zod';

/**
 * Schema Registry for centralized type validation and version management
 */

interface SchemaEntry {
  schema: z.ZodSchema;
  version: string;
  description?: string;
  deprecated?: boolean;
  migrations?: Map<string, (data: any) => any>;
}

interface ValidationError {
  path: string;
  message: string;
  code?: string;
}

export class SchemaRegistry {
  private static schemas = new Map<string, SchemaEntry>();
  private static aliases = new Map<string, string>();
  private static validationCache = new Map<string, WeakMap<object, any>>();

  /**
   * Register a schema with the registry
   */
  static register(
    name: string,
    schema: z.ZodSchema,
    version = '1.0.0',
    description?: string
  ): void {
    const entry: SchemaEntry = {
      schema,
      version,
      description,
      deprecated: false,
      migrations: new Map(),
    };

    // Register with version
    const versionedKey = `${name}:${version}`;
    this.schemas.set(versionedKey, entry);

    // Register as latest (without version)
    const currentLatest = this.schemas.get(name);
    if (!currentLatest || this.compareVersions(version, currentLatest.version) > 0) {
      this.schemas.set(name, entry);
      this.aliases.set(name, version);
    }

    console.log(`✅ Registered schema: ${name} (v${version})`);
  }

  /**
   * Validate data against a schema
   */
  static validate<T>(name: string, data: unknown, version?: string): T {
    const key = version ? `${name}:${version}` : name;
    const entry = this.schemas.get(key);

    if (!entry) {
      throw new Error(`Schema "${key}" not found in registry`);
    }

    // Check cache for performance
    const cacheKey = `${key}:${entry.version}`;
    let cache = this.validationCache.get(cacheKey);
    if (!cache) {
      cache = new WeakMap();
      this.validationCache.set(cacheKey, cache);
    }

    // If data is an object and cached, return cached result
    if (typeof data === 'object' && data !== null) {
      const cached = cache.get(data as object);
      if (cached !== undefined) {
        return cached;
      }
    }

    try {
      const result = entry.schema.parse(data) as T;

      // Cache successful validation
      if (typeof data === 'object' && data !== null) {
        cache.set(data as object, result);
      }

      return result;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = this.formatZodErrors(error);
        throw new Error(
          `Validation failed for schema "${name}":\n${errors
            .map(e => `  - ${e.path}: ${e.message}`)
            .join('\n')}`
        );
      }
      throw error;
    }
  }

  /**
   * Safe validation that returns success/failure result
   */
  static safeParse<T>(
    name: string,
    data: unknown,
    version?: string
  ): { success: true; data: T } | { success: false; errors: ValidationError[] } {
    const key = version ? `${name}:${version}` : name;
    const entry = this.schemas.get(key);

    if (!entry) {
      return {
        success: false,
        errors: [{ path: '', message: `Schema "${key}" not found` }],
      };
    }

    const result = entry.schema.safeParse(data);

    if (result.success) {
      return { success: true, data: result.data as T };
    } else {
      return {
        success: false,
        errors: this.formatZodErrors(result.error),
      };
    }
  }

  /**
   * Migrate data from one schema version to another
   */
  static migrate<T>(
    name: string,
    data: unknown,
    fromVersion: string,
    toVersion: string
  ): T {
    const fromEntry = this.schemas.get(`${name}:${fromVersion}`);
    const toEntry = this.schemas.get(`${name}:${toVersion}`);

    if (!fromEntry) {
      throw new Error(`Source schema "${name}:${fromVersion}" not found`);
    }
    if (!toEntry) {
      throw new Error(`Target schema "${name}:${toVersion}" not found`);
    }

    let current = data;

    // Apply migrations in sequence
    const versions = this.getVersionPath(name, fromVersion, toVersion);
    for (let i = 0; i < versions.length - 1; i++) {
      const currentVersion = versions[i];
      const nextVersion = versions[i + 1];
      const entry = this.schemas.get(`${name}:${currentVersion}`);

      if (entry?.migrations?.has(nextVersion)) {
        const migration = entry.migrations.get(nextVersion)!;
        current = migration(current);
      }
    }

    // Validate against target schema
    return this.validate<T>(name, current, toVersion);
  }

  /**
   * Register a migration between versions
   */
  static registerMigration(
    name: string,
    fromVersion: string,
    toVersion: string,
    migration: (data: any) => any
  ): void {
    const key = `${name}:${fromVersion}`;
    const entry = this.schemas.get(key);

    if (!entry) {
      throw new Error(`Schema "${key}" not found`);
    }

    if (!entry.migrations) {
      entry.migrations = new Map();
    }

    entry.migrations.set(toVersion, migration);
  }

  /**
   * Get the latest version of a schema
   */
  static getVersion(name: string): string | undefined {
    return this.aliases.get(name);
  }

  /**
   * List all registered schemas
   */
  static list(): string[] {
    return Array.from(this.aliases.keys());
  }

  /**
   * Get detailed information about a schema
   */
  static describe(name: string): SchemaEntry | undefined {
    return this.schemas.get(name);
  }

  /**
   * Mark a schema version as deprecated
   */
  static deprecate(name: string, version: string, message?: string): void {
    const key = `${name}:${version}`;
    const entry = this.schemas.get(key);

    if (entry) {
      entry.deprecated = true;
      if (message) {
        entry.description = `[DEPRECATED] ${message}. ${entry.description || ''}`;
      }
    }
  }

  /**
   * Check if a schema exists
   */
  static has(name: string, version?: string): boolean {
    const key = version ? `${name}:${version}` : name;
    return this.schemas.has(key);
  }

  /**
   * Clear the registry (mainly for testing)
   */
  static clear(): void {
    this.schemas.clear();
    this.aliases.clear();
    this.validationCache.clear();
  }

  /**
   * Export registry state for debugging
   */
  static export(): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [key, entry] of this.schemas.entries()) {
      result[key] = {
        version: entry.version,
        description: entry.description,
        deprecated: entry.deprecated,
        hasMigrations: entry.migrations && entry.migrations.size > 0,
      };
    }

    return result;
  }

  /**
   * Format Zod errors for better readability
   */
  private static formatZodErrors(error: z.ZodError): ValidationError[] {
    return error.errors.map((err: z.ZodIssue) => ({
      path: err.path.join('.'),
      message: err.message,
      code: err.code,
    }));
  }

  /**
   * Compare semantic versions
   */
  private static compareVersions(a: string, b: string): number {
    const aParts = a.split('.').map(Number);
    const bParts = b.split('.').map(Number);

    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const aPart = aParts[i] || 0;
      const bPart = bParts[i] || 0;

      if (aPart > bPart) return 1;
      if (aPart < bPart) return -1;
    }

    return 0;
  }

  /**
   * Get version path for migrations
   */
  private static getVersionPath(name: string, from: string, to: string): string[] {
    // For now, simple direct path - could be enhanced with graph traversal
    return [from, to];
  }
}