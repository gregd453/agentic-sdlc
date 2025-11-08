# @agentic-sdlc/e2e-agent

End-to-end test generation and execution agent with Claude-powered test generation and Playwright integration.

## Features

- **Claude-Powered Test Generation** - Generate comprehensive Playwright tests from requirements
- **Page Object Model** - Automatic generation of maintainable page objects
- **Multi-Browser Support** - Test across Chromium, Firefox, and WebKit
- **Screenshot/Video Capture** - Automatic capture on test failures
- **Artifact Storage** - Local or S3 storage for test artifacts
- **Detailed Reporting** - Comprehensive HTML and JSON reports

## Installation

```bash
pnpm install @agentic-sdlc/e2e-agent
```

## Usage

### As a Standalone Agent

```typescript
import { E2EAgent } from '@agentic-sdlc/e2e-agent';

const agent = new E2EAgent();

// Initialize and connect to Redis
await agent.initialize();

// Agent will listen for tasks on Redis channel: agent:e2e:tasks
// Results are published to: orchestrator:results
```

### Running the Agent

```bash
# From package directory
pnpm start

# Or via pnpm workspace
pnpm --filter @agentic-sdlc/e2e-agent start
```

### Task Format

The E2E agent expects tasks with the following context:

```typescript
{
  task_id: string;
  workflow_id: string;
  type: 'e2e';
  name: string;
  description: string;
  requirements: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  context: {
    project_path: string;                    // Required: Path to project
    base_url?: string;                       // Optional: App URL for test execution
    test_output_path?: string;               // Optional: Where to save tests
    browsers?: Array<'chromium' | 'firefox' | 'webkit'>; // Default: ['chromium']
    parallel?: boolean;                      // Default: true
    headless?: boolean;                      // Default: true
    screenshot_on_failure?: boolean;         // Default: true
    video_on_failure?: boolean;              // Default: false
    artifact_storage?: 'local' | 's3';       // Default: 'local'
    s3_bucket?: string;                      // Required if artifact_storage='s3'
    test_timeout_ms?: number;                // Default: 30000
    requirements?: string;                   // Test scenarios to generate
  };
}
```

## Test Generation

### Claude Integration

The agent uses Claude (Haiku model) to generate intelligent test scenarios based on requirements.

**Example Requirements:**
```
Generate E2E tests for a user login flow including:
- Successful login with valid credentials
- Error handling for invalid credentials
- Password reset functionality
- Remember me checkbox
```

**Generated Output:**
- Playwright test files (`.spec.ts`)
- Page Object Model classes (`.page.ts`)
- Test configuration (`playwright.config.ts`)

### Test Scenarios

Generated tests follow best practices:

```typescript
import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/login.page';

test.describe('Login Flow', () => {
  test('should login successfully with valid credentials', async ({ page }) => {
    const loginPage = new LoginPage(page);

    await loginPage.goto();
    await loginPage.login('testuser', 'password123');

    await expect(page.locator('.welcome-message')).toBeVisible();
  });
});
```

### Page Object Model

Generated page objects follow the POM pattern:

```typescript
import { Page, Locator } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.usernameInput = page.locator('#username');
    this.passwordInput = page.locator('#password');
    this.submitButton = page.locator('#submit');
  }

  async goto() {
    await this.page.goto('/login');
  }

  async login(username: string, password: string) {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }
}
```

## Test Execution

### Multi-Browser Testing

Tests can run across multiple browsers:

```typescript
{
  browsers: ['chromium', 'firefox', 'webkit']
}
```

### Parallel Execution

Tests run in parallel for faster execution:

```typescript
{
  parallel: true  // Default
}
```

### Failure Capture

Automatically capture screenshots and videos on failure:

```typescript
{
  screenshot_on_failure: true,  // Default: true
  video_on_failure: false       // Default: false (videos are large)
}
```

## Artifact Storage

### Local Storage

By default, artifacts are stored locally:

```typescript
{
  artifact_storage: 'local',
  test_output_path: './e2e-tests'
}
```

**Artifact Structure:**
```
e2e-tests/
├── login.spec.ts
├── dashboard.spec.ts
├── pages/
│   ├── login.page.ts
│   ├── dashboard.page.ts
│   └── index.ts
└── playwright.config.ts

artifacts/
├── screenshots/
│   └── test-failure-001.png
├── videos/
│   └── test-failure-001.webm
└── reports/
    └── index.html
```

### S3 Storage (Future)

S3 storage support is planned:

```typescript
{
  artifact_storage: 's3',
  s3_bucket: 'my-test-artifacts'
}
```

## Reporting

### E2E Test Report

The agent generates comprehensive reports:

```
================================================================================
E2E TEST REPORT
================================================================================

Task ID:        41e33129-ed42-4e89-9c84-64edc3972799
Workflow ID:    6f295dd2-e17f-4ab1-bf12-ad00a9b5f60a
Overall Status: PASSED

--------------------------------------------------------------------------------
TEST GENERATION
--------------------------------------------------------------------------------
Scenarios Generated:   5
Test Files Created:    2
Page Objects Created:  3
Generation Time:       3500ms

--------------------------------------------------------------------------------
TEST EXECUTION
--------------------------------------------------------------------------------
Browsers Tested: chromium, firefox
Pass Rate:       100.00%
Total Duration:  15000ms

Results by Browser:
  ✓ chromium  - 5/5 passed (0 failed, 0 skipped)
  ✓ firefox   - 5/5 passed (0 failed, 0 skipped)

--------------------------------------------------------------------------------
ARTIFACTS
--------------------------------------------------------------------------------
Test Files:  2
Screenshots: 0
Videos:      0
HTML Report: /path/to/playwright-report/index.html

--------------------------------------------------------------------------------
RECOMMENDATIONS
--------------------------------------------------------------------------------
1. ✓ All tests passed successfully!
2. Consider adding more edge case scenarios for better coverage.
3. Generated 2 test file(s) with 5 scenario(s).
4. Created 3 page object(s) for maintainable tests.
================================================================================
```

### HTML Report

Playwright generates detailed HTML reports with:
- Test results summary
- Screenshots and videos
- Test traces for debugging
- Performance metrics

## API

### E2EAgent

Main agent class extending `BaseAgent`.

```typescript
class E2EAgent extends BaseAgent {
  constructor();
  async initialize(): Promise<void>;
  async execute(task: TaskAssignment): Promise<TaskResult>;
  async cleanup(): Promise<void>;
}
```

### Test Generator

```typescript
// Generate test scenarios using Claude
async function generateTestScenarios(options: {
  requirements: string;
  appType?: string;
  baseUrl: string;
  anthropicApiKey: string;
}): Promise<{ scenarios: TestScenario[]; pageObjects: PageObject[] }>

// Convert scenarios to Playwright code
function scenarioToPlaywrightCode(
  scenario: TestScenario,
  pageObjects: PageObject[]
): string

// Generate all test files
function generateTestFiles(
  scenarios: TestScenario[],
  pageObjects: PageObject[]
): Map<string, string>
```

### Page Object Generator

```typescript
// Generate Page Object code using Claude
async function generatePageObjectCode(
  pageObject: PageObject,
  anthropicApiKey: string
): Promise<string>

// Generate Page Object using template
function generatePageObjectTemplate(
  pageObject: PageObject
): string

// Generate all page object files
async function generatePageObjectFiles(
  pageObjects: PageObject[],
  anthropicApiKey: string,
  useAI?: boolean
): Promise<Map<string, string>>
```

### Playwright Runner

```typescript
// Run Playwright tests
async function runPlaywrightTests(options: {
  project_path: string;
  test_path: string;
  browsers: string[];
  parallel?: boolean;
  headless?: boolean;
  screenshot_on_failure?: boolean;
  video_on_failure?: boolean;
  timeout_ms?: number;
}): Promise<PlaywrightRunResult>
```

## Testing

```bash
# Run tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Run tests in watch mode
pnpm test --watch
```

**Test Coverage:**
- 20+ tests passing
- 85%+ overall coverage

## Configuration

Set environment variables:

```bash
# Redis configuration
REDIS_HOST=localhost
REDIS_PORT=6380

# Anthropic API (for test generation)
ANTHROPIC_API_KEY=your-api-key

# Playwright (optional)
PLAYWRIGHT_BROWSERS=chromium,firefox,webkit
```

## Integration with Orchestrator

The E2E agent:

1. Subscribes to `agent:e2e:tasks` Redis channel
2. Receives test generation/execution tasks from orchestrator
3. Generates tests using Claude API
4. Executes tests with Playwright (if base_url provided)
5. Captures artifacts (screenshots, videos, reports)
6. Publishes results to `orchestrator:results` channel
7. Registers in `agents:registry` Redis hash

## Development

```bash
# Build
pnpm build

# Type check
pnpm typecheck

# Lint
pnpm lint

# Format
pnpm format
```

## Architecture

```
e2e-agent/
├── src/
│   ├── e2e-agent.ts            # Main agent class
│   ├── types.ts                # Zod schemas and types
│   ├── generators/             # Test generation
│   │   ├── test-generator.ts
│   │   └── page-object-generator.ts
│   ├── runners/                # Test execution
│   │   └── playwright-runner.ts
│   ├── utils/                  # Utilities
│   │   ├── artifact-storage.ts
│   │   └── report-generator.ts
│   ├── index.ts                # Public exports
│   └── run-agent.ts            # Entry point
└── __tests__/                  # Unit tests
```

## Best Practices

1. **Descriptive Requirements** - Provide clear, detailed test requirements for better generation
2. **Page Objects** - Use generated page objects for maintainable tests
3. **Selective Browser Testing** - Test critical flows on all browsers, others on Chrome only
4. **Screenshot on Failure** - Always enable for debugging
5. **Video Sparingly** - Videos are large, use only for critical tests
6. **Parallel Execution** - Enable for faster test runs
7. **Timeout Configuration** - Adjust timeout based on app complexity

## Limitations

- Requires ANTHROPIC_API_KEY for test generation
- S3 storage not yet implemented (local only)
- Playwright must be installed in target project
- Tests must be manually reviewed after generation

## License

MIT

## Contributing

See the main project CONTRIBUTING.md for guidelines.
