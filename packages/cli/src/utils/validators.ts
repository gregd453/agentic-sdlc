/**
 * Input validation utilities
 */

export interface ValidationError {
  field: string
  message: string
}

export class Validator {
  /**
   * Validate required field
   */
  static required(value: unknown, field: string): ValidationError | null {
    if (value === null || value === undefined || value === '') {
      return { field, message: `${field} is required` }
    }
    return null
  }

  /**
   * Validate string format
   */
  static string(value: unknown, field: string): ValidationError | null {
    if (typeof value !== 'string') {
      return { field, message: `${field} must be a string` }
    }
    return null
  }

  /**
   * Validate number format
   */
  static number(value: unknown, field: string): ValidationError | null {
    if (typeof value !== 'number' || isNaN(value)) {
      return { field, message: `${field} must be a number` }
    }
    return null
  }

  /**
   * Validate email format
   */
  static email(value: unknown, field: string): ValidationError | null {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (typeof value !== 'string' || !emailRegex.test(value)) {
      return { field, message: `${field} must be a valid email` }
    }
    return null
  }

  /**
   * Validate URL format
   */
  static url(value: unknown, field: string): ValidationError | null {
    try {
      if (typeof value !== 'string') {
        return { field, message: `${field} must be a string` }
      }
      new URL(value)
      return null
    } catch {
      return { field, message: `${field} must be a valid URL` }
    }
  }

  /**
   * Validate enum
   */
  static enum(value: unknown, field: string, allowed: string[]): ValidationError | null {
    if (!allowed.includes(String(value))) {
      return {
        field,
        message: `${field} must be one of: ${allowed.join(', ')}`,
      }
    }
    return null
  }

  /**
   * Validate minimum length
   */
  static minLength(value: unknown, field: string, min: number): ValidationError | null {
    if (typeof value !== 'string' || value.length < min) {
      return { field, message: `${field} must be at least ${min} characters` }
    }
    return null
  }

  /**
   * Validate maximum length
   */
  static maxLength(value: unknown, field: string, max: number): ValidationError | null {
    if (typeof value !== 'string' || value.length > max) {
      return { field, message: `${field} must be at most ${max} characters` }
    }
    return null
  }

  /**
   * Validate pattern match
   */
  static pattern(value: unknown, field: string, pattern: RegExp): ValidationError | null {
    if (typeof value !== 'string' || !pattern.test(value)) {
      return { field, message: `${field} format is invalid` }
    }
    return null
  }

  /**
   * Validate port number
   */
  static port(value: unknown, field: string): ValidationError | null {
    const num = Number(value)
    if (isNaN(num) || num < 1 || num > 65535) {
      return { field, message: `${field} must be a valid port (1-65535)` }
    }
    return null
  }

  /**
   * Validate timeout value
   */
  static timeout(value: unknown, field: string, min: number = 1000, max: number = 600000): ValidationError | null {
    const num = Number(value)
    if (isNaN(num) || num < min || num > max) {
      return {
        field,
        message: `${field} must be between ${min}ms and ${max}ms`,
      }
    }
    return null
  }

  /**
   * Run multiple validations
   */
  static validate(fields: Record<string, unknown>, rules: Record<string, Array<(v: unknown) => ValidationError | null>>): ValidationError[] {
    const errors: ValidationError[] = []

    for (const [field, validators] of Object.entries(rules)) {
      const value = fields[field]
      for (const validator of validators) {
        const error = validator(value)
        if (error) {
          errors.push(error)
          break // Stop on first error for this field
        }
      }
    }

    return errors
  }
}

export class ValidationResult {
  constructor(
    public valid: boolean,
    public errors: ValidationError[] = []
  ) {}

  toString(): string {
    if (this.valid) {
      return 'Validation passed'
    }

    return this.errors.map(e => `${e.field}: ${e.message}`).join('\n')
  }
}

/**
 * Validate command options
 */
export function validateCommandOptions(options: Record<string, unknown>): ValidationResult {
  const rules: Record<string, Array<(v: unknown) => ValidationError | null>> = {
    timeout: [
      (v) => (v !== undefined ? Validator.timeout(v, 'timeout') : null),
    ],
    lines: [
      (v) => (v !== undefined ? Validator.number(v, 'lines') : null),
    ],
    tier: [
      (v) => (v !== undefined ? Validator.number(v, 'tier') : null),
    ],
  }

  const errors = Validator.validate(options, rules)
  return new ValidationResult(errors.length === 0, errors)
}

/**
 * Validate environment variables
 */
export function validateEnvironment(): ValidationResult {
  const required = ['NODE_ENV']
  const errors: ValidationError[] = []

  for (const varName of required) {
    if (!process.env[varName]) {
      errors.push({
        field: varName,
        message: `Environment variable ${varName} is not set`,
      })
    }
  }

  return new ValidationResult(errors.length === 0, errors)
}
