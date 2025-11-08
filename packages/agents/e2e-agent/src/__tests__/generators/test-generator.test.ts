import { describe, it, expect } from 'vitest';
import { scenarioToPlaywrightCode, generateTestFiles } from '../../generators/test-generator';
import { TestScenario, PageObject } from '../../types';

describe('Test Generator', () => {
  describe('scenarioToPlaywrightCode', () => {
    it('should generate basic test code', () => {
      const scenario: TestScenario = {
        name: 'Login Test',
        description: 'User can log in successfully',
        steps: [
          { action: 'navigate', value: '/login' },
          { action: 'fill', selector: '#username', value: 'testuser' },
          { action: 'fill', selector: '#password', value: 'password123' },
          { action: 'click', selector: '#submit' },
          { action: 'expect', selector: '.welcome', assertion: 'toBeVisible()' }
        ],
        priority: 'critical'
      };

      const code = scenarioToPlaywrightCode(scenario, []);

      expect(code).toContain('test.describe(\'Login Test\'');
      expect(code).toContain('User can log in successfully');
      expect(code).toContain('await page.goto(\'/login\')');
      expect(code).toContain('await page.fill(\'#username\', \'testuser\')');
      expect(code).toContain('await page.fill(\'#password\', \'password123\')');
      expect(code).toContain('await page.click(\'#submit\')');
      expect(code).toContain('await expect(page.locator(\'.welcome\')).toBeVisible()');
    });

    it('should handle navigate action', () => {
      const scenario: TestScenario = {
        name: 'Navigation Test',
        description: 'Navigate to page',
        steps: [
          { action: 'navigate', value: '/about' }
        ],
        priority: 'medium'
      };

      const code = scenarioToPlaywrightCode(scenario, []);
      expect(code).toContain('await page.goto(\'/about\')');
    });

    it('should handle click action', () => {
      const scenario: TestScenario = {
        name: 'Click Test',
        description: 'Click button',
        steps: [
          { action: 'click', selector: '#button' }
        ],
        priority: 'medium'
      };

      const code = scenarioToPlaywrightCode(scenario, []);
      expect(code).toContain('await page.click(\'#button\')');
    });

    it('should handle fill action', () => {
      const scenario: TestScenario = {
        name: 'Fill Test',
        description: 'Fill input',
        steps: [
          { action: 'fill', selector: '#input', value: 'test value' }
        ],
        priority: 'medium'
      };

      const code = scenarioToPlaywrightCode(scenario, []);
      expect(code).toContain('await page.fill(\'#input\', \'test value\')');
    });

    it('should handle expect action', () => {
      const scenario: TestScenario = {
        name: 'Assertion Test',
        description: 'Check element',
        steps: [
          { action: 'expect', selector: '.element', assertion: 'toHaveText(\'Hello\')' }
        ],
        priority: 'medium'
      };

      const code = scenarioToPlaywrightCode(scenario, []);
      expect(code).toContain('await expect(page.locator(\'.element\')).toHaveText(\'Hello\')');
    });
  });

  describe('generateTestFiles', () => {
    it('should generate test files from scenarios', () => {
      const scenarios: TestScenario[] = [
        {
          name: 'Login - Success',
          description: 'User logs in successfully',
          steps: [{ action: 'navigate', value: '/login' }],
          priority: 'critical'
        },
        {
          name: 'Login - Invalid credentials',
          description: 'User sees error with invalid credentials',
          steps: [{ action: 'navigate', value: '/login' }],
          priority: 'high'
        },
        {
          name: 'Dashboard - View stats',
          description: 'User views dashboard stats',
          steps: [{ action: 'navigate', value: '/dashboard' }],
          priority: 'medium'
        }
      ];

      const files = generateTestFiles(scenarios, []);

      // Should group by feature (based on scenario name prefix)
      expect(files.size).toBeGreaterThan(0);
      expect(Array.from(files.keys()).some(name => name.includes('login'))).toBe(true);
    });

    it('should group scenarios by feature', () => {
      const scenarios: TestScenario[] = [
        {
          name: 'Auth - Login',
          description: 'Login test',
          steps: [],
          priority: 'critical'
        },
        {
          name: 'Auth - Logout',
          description: 'Logout test',
          steps: [],
          priority: 'high'
        }
      ];

      const files = generateTestFiles(scenarios, []);

      // Should create one file for "Auth" feature
      const fileNames = Array.from(files.keys());
      expect(fileNames.length).toBe(1);
      expect(fileNames[0]).toContain('auth');
    });

    it('should include Playwright imports in generated files', () => {
      const scenarios: TestScenario[] = [
        {
          name: 'Test',
          description: 'Test',
          steps: [],
          priority: 'medium'
        }
      ];

      const files = generateTestFiles(scenarios, []);
      const fileContent = Array.from(files.values())[0];

      expect(fileContent).toContain("import { test, expect } from '@playwright/test'");
    });
  });
});
