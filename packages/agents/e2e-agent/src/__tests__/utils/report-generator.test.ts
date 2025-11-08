import { describe, it, expect } from 'vitest';
import { generateE2EReport, formatE2EReportAsText } from '../../utils/report-generator';
import { TestExecutionResult } from '../../types';

describe('Report Generator', () => {
  describe('generateE2EReport', () => {
    it('should generate report with generation phase only', () => {
      const report = generateE2EReport(
        'task-123',
        'workflow-123',
        '/test/project',
        {
          scenarios_generated: 5,
          test_files_created: 2,
          page_objects_created: 3,
          generation_time_ms: 5000
        },
        undefined,
        {
          test_files: ['/test/file1.spec.ts', '/test/file2.spec.ts']
        }
      );

      expect(report.task_id).toBe('task-123');
      expect(report.workflow_id).toBe('workflow-123');
      expect(report.project_path).toBe('/test/project');
      expect(report.overall_status).toBe('passed');
      expect(report.generation.scenarios_generated).toBe(5);
      expect(report.generation.test_files_created).toBe(2);
      expect(report.generation.page_objects_created).toBe(3);
      expect(report.execution).toBeUndefined();
      expect(report.recommendations.length).toBeGreaterThan(0);
    });

    it('should generate report with execution phase (all passed)', () => {
      const results: TestExecutionResult[] = [
        {
          browser: 'chromium',
          total_tests: 10,
          passed: 10,
          failed: 0,
          skipped: 0,
          duration_ms: 5000
        }
      ];

      const report = generateE2EReport(
        'task-123',
        'workflow-123',
        '/test/project',
        {
          scenarios_generated: 5,
          test_files_created: 2,
          page_objects_created: 3,
          generation_time_ms: 5000
        },
        {
          browsers_tested: ['chromium'],
          results,
          total_duration_ms: 6000
        },
        {
          test_files: ['/test/file.spec.ts']
        }
      );

      expect(report.overall_status).toBe('passed');
      expect(report.execution).toBeDefined();
      expect(report.execution?.overall_pass_rate).toBe(100);
      expect(report.recommendations).toContain('✓ All tests passed successfully!');
    });

    it('should generate report with execution phase (some failed)', () => {
      const results: TestExecutionResult[] = [
        {
          browser: 'chromium',
          total_tests: 10,
          passed: 7,
          failed: 3,
          skipped: 0,
          duration_ms: 5000,
          failures: [
            { test_name: 'Test 1', error_message: 'Error 1' },
            { test_name: 'Test 2', error_message: 'Error 2' },
            { test_name: 'Test 3', error_message: 'Error 3' }
          ]
        }
      ];

      const report = generateE2EReport(
        'task-123',
        'workflow-123',
        '/test/project',
        {
          scenarios_generated: 5,
          test_files_created: 2,
          page_objects_created: 3,
          generation_time_ms: 5000
        },
        {
          browsers_tested: ['chromium'],
          results,
          total_duration_ms: 6000
        },
        {
          test_files: ['/test/file.spec.ts'],
          screenshots: ['/test/screenshot.png']
        }
      );

      expect(report.overall_status).toBe('partial');
      expect(report.execution?.overall_pass_rate).toBe(70);
      expect(report.recommendations.some(r => r.includes('Some tests passed, some failed'))).toBe(true);
    });

    it('should generate report with all tests failed', () => {
      const results: TestExecutionResult[] = [
        {
          browser: 'chromium',
          total_tests: 5,
          passed: 0,
          failed: 5,
          skipped: 0,
          duration_ms: 3000,
          failures: [{ test_name: 'Test 1', error_message: 'Failed' }]
        }
      ];

      const report = generateE2EReport(
        'task-123',
        'workflow-123',
        '/test/project',
        {
          scenarios_generated: 5,
          test_files_created: 1,
          page_objects_created: 1,
          generation_time_ms: 2000
        },
        {
          browsers_tested: ['chromium'],
          results,
          total_duration_ms: 4000
        },
        {
          test_files: ['/test/file.spec.ts']
        }
      );

      expect(report.overall_status).toBe('failed');
      expect(report.execution?.overall_pass_rate).toBe(0);
      expect(report.recommendations.some(r => r.includes('Tests failed'))).toBe(true);
    });

    it('should handle multiple browsers', () => {
      const results: TestExecutionResult[] = [
        {
          browser: 'chromium',
          total_tests: 10,
          passed: 10,
          failed: 0,
          skipped: 0,
          duration_ms: 5000
        },
        {
          browser: 'firefox',
          total_tests: 10,
          passed: 8,
          failed: 2,
          skipped: 0,
          duration_ms: 6000
        }
      ];

      const report = generateE2EReport(
        'task-123',
        'workflow-123',
        '/test/project',
        {
          scenarios_generated: 10,
          test_files_created: 2,
          page_objects_created: 2,
          generation_time_ms: 5000
        },
        {
          browsers_tested: ['chromium', 'firefox'],
          results,
          total_duration_ms: 12000
        },
        {
          test_files: ['/test/file.spec.ts']
        }
      );

      expect(report.execution?.browsers_tested).toEqual(['chromium', 'firefox']);
      expect(report.execution?.overall_pass_rate).toBe(90); // 18/20
      expect(report.recommendations.some(r => r.includes('Cross-browser'))).toBe(true);
    });
  });

  describe('formatE2EReportAsText', () => {
    it('should format report as text', () => {
      const results: TestExecutionResult[] = [
        {
          browser: 'chromium',
          total_tests: 5,
          passed: 5,
          failed: 0,
          skipped: 0,
          duration_ms: 3000
        }
      ];

      const report = generateE2EReport(
        'task-123',
        'workflow-123',
        '/test/project',
        {
          scenarios_generated: 3,
          test_files_created: 1,
          page_objects_created: 1,
          generation_time_ms: 2000
        },
        {
          browsers_tested: ['chromium'],
          results,
          total_duration_ms: 4000
        },
        {
          test_files: ['/test/file.spec.ts']
        }
      );

      const text = formatE2EReportAsText(report);

      expect(text).toContain('E2E TEST REPORT');
      expect(text).toContain('TEST GENERATION');
      expect(text).toContain('TEST EXECUTION');
      expect(text).toContain('ARTIFACTS');
      expect(text).toContain('RECOMMENDATIONS');
      expect(text).toContain('task-123');
      expect(text).toContain('chromium');
    });

    it('should handle report without execution', () => {
      const report = generateE2EReport(
        'task-123',
        'workflow-123',
        '/test/project',
        {
          scenarios_generated: 3,
          test_files_created: 1,
          page_objects_created: 1,
          generation_time_ms: 2000
        },
        undefined,
        {
          test_files: ['/test/file.spec.ts']
        }
      );

      const text = formatE2EReportAsText(report);

      expect(text).toContain('TEST GENERATION');
      expect(text).not.toContain('TEST EXECUTION');
      expect(text).toContain('ARTIFACTS');
    });
  });
});
