import Anthropic from '@anthropic-ai/sdk';
import pino from 'pino';
import { TestScenario, PageObject, TEST_GENERATION_PROMPT } from '../types';

const logger = pino({ name: 'test-generator' });

export interface TestGenerationOptions {
  requirements: string;
  appType?: string;
  baseUrl: string;
  anthropicApiKey: string;
}

export interface GeneratedTests {
  scenarios: TestScenario[];
  pageObjects: PageObject[];
}

/**
 * Generate E2E test scenarios using Claude
 */
export async function generateTestScenarios(
  options: TestGenerationOptions
): Promise<GeneratedTests> {
  const { requirements, appType = 'web application', baseUrl, anthropicApiKey } = options;

  logger.info('Generating test scenarios with Claude', {
    app_type: appType,
    base_url: baseUrl
  });

  try {
    const anthropic = new Anthropic({ apiKey: anthropicApiKey });

    // Build prompt
    const prompt = TEST_GENERATION_PROMPT
      .replace('{requirements}', requirements)
      .replace('{app_type}', appType)
      .replace('{base_url}', baseUrl);

    // Call Claude API
    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    // Extract JSON from response
    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    // Parse JSON response (Claude might wrap it in markdown code blocks)
    let jsonText = content.text.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```\n?/, '').replace(/\n?```$/, '');
    }

    const result = JSON.parse(jsonText);

    logger.info('Successfully generated test scenarios', {
      scenarios_count: result.scenarios?.length || 0,
      page_objects_count: result.pageObjects?.length || 0
    });

    return {
      scenarios: result.scenarios || [],
      pageObjects: result.page_objects || result.pageObjects || []
    };
  } catch (error) {
    logger.error('Failed to generate test scenarios', { error });
    throw new Error(`Test generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Convert test scenario to Playwright test code
 */
export function scenarioToPlaywrightCode(scenario: TestScenario, pageObjects: PageObject[]): string {
  const { name, description, steps } = scenario;

  // Generate imports
  const imports: string[] = [
    "import { test, expect } from '@playwright/test';"
  ];

  // Add page object imports if needed
  const usedPageObjects = new Set<string>();
  steps.forEach(step => {
    if (step.selector) {
      pageObjects.forEach(po => {
        if (Object.values(po.selectors).some(sel => sel === step.selector)) {
          usedPageObjects.add(po.name);
        }
      });
    }
  });

  usedPageObjects.forEach(po => {
    imports.push(`import { ${po}Page } from './pages/${po.toLowerCase()}.page';`);
  });

  // Generate test body
  const testSteps: string[] = [];

  steps.forEach((step) => {
    switch (step.action) {
      case 'navigate':
        testSteps.push(`  await page.goto('${step.value || '/'}');`);
        break;
      case 'click':
        testSteps.push(`  await page.click('${step.selector}');`);
        break;
      case 'fill':
        testSteps.push(`  await page.fill('${step.selector}', '${step.value}');`);
        break;
      case 'expect':
        if (step.assertion) {
          testSteps.push(`  await expect(page.locator('${step.selector}')).${step.assertion};`);
        }
        break;
      default:
        testSteps.push(`  // TODO: Implement action: ${step.action}`);
    }
  });

  // Build complete test
  const code = `${imports.join('\n')}

test.describe('${name}', () => {
  test('${description}', async ({ page }) => {
${testSteps.join('\n')}
  });
});
`;

  return code;
}

/**
 * Generate all test files from scenarios
 */
export function generateTestFiles(
  scenarios: TestScenario[],
  pageObjects: PageObject[]
): Map<string, string> {
  const files = new Map<string, string>();

  // Group scenarios by feature/area
  const grouped = new Map<string, TestScenario[]>();
  scenarios.forEach(scenario => {
    const feature = scenario.name.split(' - ')[0] || 'general';
    const existing = grouped.get(feature) || [];
    existing.push(scenario);
    grouped.set(feature, existing);
  });

  // Generate a test file for each feature
  grouped.forEach((featureScenarios, feature) => {
    const fileName = `${feature.toLowerCase().replace(/\s+/g, '-')}.spec.ts`;
    const imports = "import { test, expect } from '@playwright/test';\n\n";

    const tests = featureScenarios.map(scenario =>
      scenarioToPlaywrightCode(scenario, pageObjects)
    ).join('\n\n');

    files.set(fileName, imports + tests);
  });

  logger.info('Generated test files', { file_count: files.size });

  return files;
}
