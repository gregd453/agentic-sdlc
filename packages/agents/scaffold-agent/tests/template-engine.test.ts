import { describe, it, expect, beforeEach } from 'vitest';
import { TemplateEngine } from '../src/template-engine';

describe('TemplateEngine', () => {
  let engine: TemplateEngine;

  beforeEach(() => {
    engine = new TemplateEngine();
  });

  describe('Handlebars helpers', () => {
    it('should convert to PascalCase', () => {
      engine.registerTemplate('test-pascal', '{{pascalCase "hello-world"}}');
      const rendered = engine.render('test-pascal', {});
      expect(rendered).toBe('HelloWorld');
    });

    it('should convert to camelCase', () => {
      engine.registerTemplate('test-camel', '{{camelCase "hello-world"}}');
      const result = engine.render('test-camel', {});
      expect(result).toBe('helloWorld');
    });

    it('should convert to kebab-case', () => {
      engine.registerTemplate('test-kebab', '{{kebabCase "HelloWorld"}}');
      const result = engine.render('test-kebab', {});
      expect(result).toBe('hello-world');
    });

    it('should convert to snake_case', () => {
      engine.registerTemplate('test-snake', '{{snakeCase "HelloWorld"}}');
      const result = engine.render('test-snake', {});
      expect(result).toBe('hello_world');
    });

    it('should convert to CONSTANT_CASE', () => {
      engine.registerTemplate('test-constant', '{{constantCase "helloWorld"}}');
      const result = engine.render('test-constant', {});
      expect(result).toBe('HELLO_WORLD');
    });

    it('should map TypeScript types to Zod types', () => {
      engine.registerTemplate('test-zod', '{{zodType "string"}}');
      const result = engine.render('test-zod', {});
      expect(result).toBe('z.string()');
    });

    it('should return current year', () => {
      engine.registerTemplate('test-year', '{{year}}');
      const result = engine.render('test-year', {});
      expect(result).toBe(new Date().getFullYear().toString());
    });
  });

  describe('Template rendering', () => {
    it('should render package.json template', () => {
      const context = {
        project_name: 'TestProject',
        description: 'A test project'
      };

      const result = engine.render('package', context);

      expect(result).toContain('"name": "test-project"');
      expect(result).toContain('"description": "A test project"');
      expect(result).toContain('"zod"');
    });

    it('should render tsconfig.json template', () => {
      const context = {};
      const result = engine.render('tsconfig', context);

      expect(result).toContain('"target": "ES2022"');
      expect(result).toContain('"strict": true');
      expect(result).toContain('"outDir": "./dist"');
    });

    it('should render README template', () => {
      const context = {
        project_name: 'TestProject',
        description: 'A test project',
        components: [
          { name: 'TestComponent', type: 'service', description: 'Test service' }
        ],
        timestamp: new Date().toISOString()
      };

      const result = engine.render('readme', context);

      expect(result).toContain('# TestProject');
      expect(result).toContain('A test project');
      expect(result).toContain('TestComponent');
    });

    it('should render types template with contracts', () => {
      const context = {
        contracts: [
          {
            name: 'User',
            fields: [
              { name: 'id', type: 'string', required: true, description: 'User ID' },
              { name: 'email', type: 'string', required: true },
              { name: 'age', type: 'number', required: false }
            ]
          }
        ]
      };

      const result = engine.render('types', context);

      expect(result).toContain('UserSchema');
      expect(result).toContain('z.object');
      expect(result).toContain('id: z.string()');
      expect(result).toContain('age: z.number().optional()');
    });

    it('should render service component template', () => {
      const context = {
        component_name: 'UserService',
        description: 'Handles user operations'
      };

      const result = engine.render('component-service', context);

      expect(result).toContain('UserServiceService');
      expect(result).toContain('Handles user operations');
      expect(result).toContain('async execute()');
    });

    it('should render test template', () => {
      const context = {
        component_name: 'UserService'
      };

      const result = engine.render('test', context);

      expect(result).toContain('describe');
      expect(result).toContain('UserService');
      expect(result).toContain('it(');
    });
  });

  describe('Custom templates', () => {
    it('should register and render custom template', () => {
      const customTemplate = 'Hello {{name}}!';
      engine.registerTemplate('custom', customTemplate);

      const result = engine.render('custom', { name: 'World' });
      expect(result).toBe('Hello World!');
    });

    it('should override existing template', () => {
      const customTemplate = 'Custom: {{project_name}}';
      engine.registerTemplate('package', customTemplate);

      const result = engine.render('package', { project_name: 'Test' });
      expect(result).toBe('Custom: Test');
    });
  });

  describe('Error handling', () => {
    it('should throw error for missing template', () => {
      expect(() => {
        engine.render('non-existent-template', {});
      }).toThrow();
    });
  });

  describe('Cache management', () => {
    it('should cache compiled templates', () => {
      engine.registerTemplate('cached', 'Value: {{value}}');

      const result1 = engine.render('cached', { value: 'first' });
      const result2 = engine.render('cached', { value: 'second' });

      expect(result1).toBe('Value: first');
      expect(result2).toBe('Value: second');
    });

    it('should clear cache', () => {
      engine.registerTemplate('to-clear', 'Test');
      engine.render('to-clear', {});

      engine.clearCache();

      expect(() => {
        engine.render('to-clear', {});
      }).toThrow();
    });
  });
});
