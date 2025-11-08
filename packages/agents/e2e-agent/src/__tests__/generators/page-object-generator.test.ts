import { describe, it, expect } from 'vitest';
import { generatePageObjectTemplate, generatePageObjectsIndex } from '../../generators/page-object-generator';
import { PageObject } from '../../types';

describe('Page Object Generator', () => {
  describe('generatePageObjectTemplate', () => {
    it('should generate basic page object code', () => {
      const pageObject: PageObject = {
        name: 'Login',
        url: '/login',
        selectors: {
          usernameInput: '#username',
          passwordInput: '#password',
          submitButton: '#submit'
        },
        methods: []
      };

      const code = generatePageObjectTemplate(pageObject);

      expect(code).toContain('export class LoginPage');
      expect(code).toContain('readonly page: Page');
      expect(code).toContain('readonly usernameInput = this.page.locator(\'#username\')');
      expect(code).toContain('readonly passwordInput = this.page.locator(\'#password\')');
      expect(code).toContain('readonly submitButton = this.page.locator(\'#submit\')');
      expect(code).toContain('await this.page.goto(\'/login\')');
    });

    it('should generate methods', () => {
      const pageObject: PageObject = {
        name: 'Login',
        url: '/login',
        selectors: {},
        methods: [
          {
            name: 'login',
            description: 'Perform login with credentials',
            parameters: ['username', 'password']
          }
        ]
      };

      const code = generatePageObjectTemplate(pageObject);

      expect(code).toContain('async login(username: string, password: string)');
      expect(code).toContain('Perform login with credentials');
    });

    it('should handle methods without parameters', () => {
      const pageObject: PageObject = {
        name: 'Dashboard',
        url: '/dashboard',
        selectors: {},
        methods: [
          {
            name: 'waitForLoad',
            description: 'Wait for dashboard to load'
          }
        ]
      };

      const code = generatePageObjectTemplate(pageObject);

      expect(code).toContain('async waitForLoad()');
      expect(code).toContain('Wait for dashboard to load');
    });

    it('should include imports', () => {
      const pageObject: PageObject = {
        name: 'Test',
        url: '/',
        selectors: {},
        methods: []
      };

      const code = generatePageObjectTemplate(pageObject);

      expect(code).toContain("import { Page, Locator } from '@playwright/test'");
    });

    it('should include goto method', () => {
      const pageObject: PageObject = {
        name: 'About',
        url: '/about',
        selectors: {},
        methods: []
      };

      const code = generatePageObjectTemplate(pageObject);

      expect(code).toContain('async goto()');
      expect(code).toContain('Navigate to this page');
    });
  });

  describe('generatePageObjectsIndex', () => {
    it('should generate index with exports', () => {
      const pageObjects: PageObject[] = [
        { name: 'Login', url: '/login', selectors: {}, methods: [] },
        { name: 'Dashboard', url: '/dashboard', selectors: {}, methods: [] }
      ];

      const index = generatePageObjectsIndex(pageObjects);

      expect(index).toContain("export { LoginPage } from './login.page'");
      expect(index).toContain("export { DashboardPage } from './dashboard.page'");
    });

    it('should handle empty page objects list', () => {
      const index = generatePageObjectsIndex([]);

      expect(index).toContain('Page Object Models');
      expect(index).toContain('Auto-generated');
    });

    it('should handle single page object', () => {
      const pageObjects: PageObject[] = [
        { name: 'Home', url: '/', selectors: {}, methods: [] }
      ];

      const index = generatePageObjectsIndex(pageObjects);

      expect(index).toContain("export { HomePage } from './home.page'");
    });
  });
});
