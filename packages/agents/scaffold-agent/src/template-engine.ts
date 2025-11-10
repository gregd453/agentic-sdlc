import Handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';
import { TemplateError } from './types';

/**
 * Template engine for generating code from Handlebars templates
 */
export class TemplateEngine {
  private templates: Map<string, HandlebarsTemplateDelegate> = new Map();
  private templatesDir: string;

  constructor(templatesDir?: string) {
    this.templatesDir = templatesDir || path.join(__dirname, '../templates');
    this.registerHelpers();
  }

  /**
   * Register Handlebars helpers for common transformations
   */
  private registerHelpers(): void {
    // Convert to PascalCase
    Handlebars.registerHelper('pascalCase', (str: string) => {
      return str
        .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
        .replace(/^(.)/, (c) => c.toUpperCase());
    });

    // Convert to camelCase
    Handlebars.registerHelper('camelCase', (str: string) => {
      return str
        .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
        .replace(/^(.)/, (c) => c.toLowerCase());
    });

    // Convert to kebab-case
    Handlebars.registerHelper('kebabCase', (str: string) => {
      return str
        .replace(/([a-z])([A-Z])/g, '$1-$2')
        .replace(/[\s_]+/g, '-')
        .toLowerCase();
    });

    // Convert to snake_case
    Handlebars.registerHelper('snakeCase', (str: string) => {
      return str
        .replace(/([a-z])([A-Z])/g, '$1_$2')
        .replace(/[\s-]+/g, '_')
        .toLowerCase();
    });

    // Convert to UPPER_SNAKE_CASE
    Handlebars.registerHelper('constantCase', (str: string) => {
      return str
        .replace(/([a-z])([A-Z])/g, '$1_$2')
        .replace(/[\s-]+/g, '_')
        .toUpperCase();
    });

    // Map TypeScript types to Zod types
    Handlebars.registerHelper('zodType', (type: string) => {
      const mapping: Record<string, string> = {
        string: 'z.string()',
        number: 'z.number()',
        boolean: 'z.boolean()',
        object: 'z.object({})',
        array: 'z.array(z.unknown())',
        date: 'z.date()',
        any: 'z.unknown()'
      };
      return mapping[type.toLowerCase()] || 'z.unknown()';
    });

    // JSON stringify
    Handlebars.registerHelper('json', (context: any) => {
      return JSON.stringify(context, null, 2);
    });

    // Current year
    Handlebars.registerHelper('year', () => {
      return new Date().getFullYear();
    });
  }

  /**
   * Load a template from file or use inline template
   */
  private loadTemplate(name: string): HandlebarsTemplateDelegate {
    // Check cache first
    if (this.templates.has(name)) {
      return this.templates.get(name)!;
    }

    // Try multiple path strategies for template loading
    const possiblePaths = [
      path.join(this.templatesDir, `${name}.hbs`),
      path.join(this.templatesDir, name.replace(/\//g, path.sep) + '.hbs'),
      // For nested templates like app/react-spa/package.json
      path.join(this.templatesDir, name.replace(/\//g, path.sep)),
    ];

    for (const templatePath of possiblePaths) {
      if (fs.existsSync(templatePath)) {
        const templateSource = fs.readFileSync(templatePath, 'utf-8');
        const compiled = Handlebars.compile(templateSource);
        this.templates.set(name, compiled);
        return compiled;
      }
    }

    // Fall back to inline templates for common files
    const inlineTemplate = this.getInlineTemplate(name);
    if (inlineTemplate) {
      const compiled = Handlebars.compile(inlineTemplate);
      this.templates.set(name, compiled);
      return compiled;
    }

    // If still not found, log available templates for debugging
    console.warn(`Template not found: ${name}. Available templates in ${this.templatesDir}`);

    throw new TemplateError(`Template not found: ${name}`, name);
  }

  /**
   * Render a template with context
   */
  render(templateName: string, context: any): string {
    try {
      const template = this.loadTemplate(templateName);
      return template(context);
    } catch (error) {
      throw new TemplateError(
        `Failed to render template: ${templateName}`,
        templateName
      );
    }
  }

  /**
   * Get inline templates for common files
   */
  private getInlineTemplate(name: string): string | null {
    const templates: Record<string, string> = {
      package: `{
  "name": "{{kebabCase project_name}}",
  "version": "0.1.0",
  "description": "{{description}}",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsx watch src/index.ts",
    "test": "vitest",
    "test:coverage": "vitest run --coverage",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "typescript": "^5.4.0",
    "vitest": "^1.4.0",
    "tsx": "^4.7.1"
  },
  "engines": {
    "node": ">=20.0.0"
  }
}`,

      tsconfig: `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}`,

      readme: `# {{project_name}}

{{description}}

## Overview

{{#if components}}
### Components

{{#each components}}
- **{{name}}** ({{type}}): {{description}}
{{/each}}
{{/if}}

## Installation

\`\`\`bash
npm install
\`\`\`

## Development

\`\`\`bash
npm run dev
\`\`\`

## Testing

\`\`\`bash
npm test
\`\`\`

## Building

\`\`\`bash
npm run build
\`\`\`

---

Generated by Agentic SDLC Scaffold Agent on {{timestamp}}
`,

      types: `import { z } from 'zod';

{{#each contracts}}
// {{name}} Schema
export const {{pascalCase name}}Schema = z.object({
{{#each fields}}
  {{name}}: {{zodType type}}{{#unless required}}.optional(){{/unless}}{{#if description}} // {{description}}{{/if}}{{#unless @last}},{{/unless}}
{{/each}}
});

export type {{pascalCase name}} = z.infer<typeof {{pascalCase name}}Schema>;

{{/each}}
`,

      index: `{{#each components}}
// Export {{name}}
{{/each}}

export * from './types';
`,

      'component-service': `/**
 * {{component_name}} Service
 * {{description}}
 */
export class {{pascalCase component_name}}Service {
  constructor() {
    // Initialize service
  }

  /**
   * Main service method
   */
  async execute(): Promise<void> {
    // Implementation
  }
}
`,

      'component-controller': `/**
 * {{component_name}} Controller
 * {{description}}
 */
export class {{pascalCase component_name}}Controller {
  /**
   * Handle request
   */
  async handle(request: any): Promise<any> {
    // Implementation
    return { success: true };
  }
}
`,

      'component-model': `import { z } from 'zod';

/**
 * {{component_name}} Model
 * {{description}}
 */
export const {{pascalCase component_name}}Schema = z.object({
  id: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

export type {{pascalCase component_name}} = z.infer<typeof {{pascalCase component_name}}Schema>;
`,

      'component-handler': `/**
 * {{component_name}} Handler
 * {{description}}
 */
export async function {{camelCase component_name}}Handler(event: any): Promise<any> {
  // Implementation
  return { statusCode: 200, body: 'Success' };
}
`,

      test: `import { describe, it, expect } from 'vitest';

describe('{{pascalCase component_name}}', () => {
  it('should be defined', () => {
    // Test implementation
    expect(true).toBe(true);
  });

  it('should handle basic operations', async () => {
    // Test implementation
    expect(true).toBe(true);
  });
});
`
    };

    return templates[name] || null;
  }

  /**
   * Register a custom template
   */
  registerTemplate(name: string, templateSource: string): void {
    const compiled = Handlebars.compile(templateSource);
    this.templates.set(name, compiled);
  }

  /**
   * Clear template cache
   */
  clearCache(): void {
    this.templates.clear();
  }
}
