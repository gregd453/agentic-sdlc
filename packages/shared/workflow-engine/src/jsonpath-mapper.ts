/**
 * JSONPath Output Mapper
 * Provides JSONPath expression support for complex nested object extraction
 * from workflow stage outputs during data flow mapping.
 *
 * Supports:
 * - Dot notation: data.user.name
 * - Array access: data[0].items[1].value
 * - Wildcards: data.*.name (not recommended for ambiguous fields)
 * - Expressions: data.items[?(@.status=='active')].id
 */

/**
 * JSONPath expression parser and executor
 */
export class JSONPathMapper {
  /**
   * Parse and extract value from nested object using JSONPath
   *
   * Examples:
   * - getValueByPath({ user: { name: 'John' } }, 'user.name') => 'John'
   * - getValueByPath({ items: [{ id: 1 }, { id: 2 }] }, 'items[0].id') => 1
   * - getValueByPath({ a: { b: { c: 'value' } } }, 'a.b.c') => 'value'
   */
  static getValueByPath(obj: any, path: string): any {
    if (!path || typeof path !== 'string') {
      return obj;
    }

    // Handle root reference
    if (path === '$' || path === 'root') {
      return obj;
    }

    try {
      // Normalize path - remove leading $ or root. if present
      let normalizedPath = path.replace(/^\$\./, '').replace(/^root\./, '');

      // Split path by dots and brackets
      const parts = this.parsePath(normalizedPath);

      let current = obj;
      for (const part of parts) {
        if (current === null || current === undefined) {
          return undefined;
        }

        if (part.type === 'property') {
          current = current[part.name];
        } else if (part.type === 'index') {
          current = current[part.index];
        } else if (part.type === 'filter') {
          // Basic filter support for simple equality checks
          current = this.applyFilter(current, part.filter);
        }
      }

      return current;
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Set value in nested object using JSONPath
   */
  static setValueByPath(obj: any, path: string, value: any): any {
    if (!path || typeof path !== 'string') {
      return obj;
    }

    try {
      // Clone to avoid mutation
      const result = JSON.parse(JSON.stringify(obj));

      // Normalize path
      let normalizedPath = path.replace(/^\$\./, '').replace(/^root\./, '');
      const parts = this.parsePath(normalizedPath);

      if (parts.length === 0) {
        return value;
      }

      // Navigate to parent
      let current = result;
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (part.type === 'property') {
          if (!(part.name in current)) {
            current[part.name] = {};
          }
          current = current[part.name];
        } else if (part.type === 'index') {
          if (!Array.isArray(current)) {
            current = [];
          }
          if (!(part.index in current)) {
            current[part.index] = {};
          }
          current = current[part.index];
        }
      }

      // Set final value
      const lastPart = parts[parts.length - 1];
      if (lastPart.type === 'property') {
        current[lastPart.name] = value;
      } else if (lastPart.type === 'index') {
        current[lastPart.index] = value;
      }

      return result;
    } catch (error) {
      return obj;
    }
  }

  /**
   * Parse JSONPath-like expression into parts
   * Returns array of { type, name/index/filter }
   */
  private static parsePath(path: string): Array<any> {
    const parts: Array<any> = [];
    let current = '';
    let inBracket = false;

    for (let i = 0; i < path.length; i++) {
      const char = path[i];

      if (char === '[') {
        if (current) {
          parts.push({ type: 'property', name: current });
          current = '';
        }
        inBracket = true;
      } else if (char === ']') {
        if (inBracket && current) {
          // Check if it's an array index or filter
          if (/^\d+$/.test(current)) {
            parts.push({ type: 'index', index: parseInt(current, 10) });
          } else if (current.includes('?')) {
            parts.push({ type: 'filter', filter: current });
          } else {
            // Property access via bracket notation
            parts.push({ type: 'property', name: current });
          }
          current = '';
        }
        inBracket = false;
      } else if (char === '.' && !inBracket) {
        if (current) {
          parts.push({ type: 'property', name: current });
          current = '';
        }
      } else {
        current += char;
      }
    }

    // Add remaining part
    if (current) {
      parts.push({ type: 'property', name: current });
    }

    return parts;
  }

  /**
   * Apply simple filter expressions
   * Supports: [?(@.field==value)] or [?(@.field=='value')]
   */
  private static applyFilter(arr: any, filter: string): any {
    if (!Array.isArray(arr)) {
      return arr;
    }

    // Extract filter expression: ?(@.field==value)
    const match = filter.match(/^\?\(\@\.(\w+)=='?([^']*?)'?\)/);
    if (!match) {
      return arr;
    }

    const [, field, value] = match;
    return arr.find((item: any) => item[field] === value);
  }

  /**
   * Validate JSONPath expression
   * Returns { valid: boolean, error?: string }
   */
  static validatePath(path: string): { valid: boolean; error?: string } {
    if (!path || typeof path !== 'string') {
      return { valid: false, error: 'Path must be a non-empty string' };
    }

    // Check for invalid characters
    if (/[{}]/.test(path)) {
      return { valid: false, error: 'Path contains invalid characters: {}' };
    }

    // Check for mismatched brackets
    let bracketCount = 0;
    for (const char of path) {
      if (char === '[') bracketCount++;
      if (char === ']') bracketCount--;
      if (bracketCount < 0) {
        return { valid: false, error: 'Mismatched brackets in path' };
      }
    }

    if (bracketCount !== 0) {
      return { valid: false, error: 'Unclosed brackets in path' };
    }

    return { valid: true };
  }

  /**
   * Apply output mapping to transform stage output
   * Maps complex nested objects using JSONPath expressions
   */
  static applyOutputMapping(
    stageOutput: any,
    outputMapping: Record<string, string>
  ): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [outputKey, inputPath] of Object.entries(outputMapping)) {
      // Validate path before extracting
      const validation = this.validatePath(inputPath);
      if (!validation.valid) {
        console.warn(`[JSONPathMapper] Invalid path for '${outputKey}': ${validation.error}`);
        result[outputKey] = null;
        continue;
      }

      // Extract value using JSONPath
      const value = this.getValueByPath(stageOutput, inputPath);
      result[outputKey] = value;
    }

    return result;
  }
}

/**
 * Error thrown during JSONPath operations
 */
export class JSONPathError extends Error {
  constructor(
    message: string,
    public readonly path?: string,
    public readonly value?: any
  ) {
    super(message);
    this.name = 'JSONPathError';
  }
}
