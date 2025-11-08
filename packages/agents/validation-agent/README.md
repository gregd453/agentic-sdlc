# @agentic-sdlc/validation-agent

Code validation agent with comprehensive quality gate enforcement for the Agentic SDLC platform.

## Features

- **TypeScript Compilation Validation** - Compile-time type checking
- **ESLint Integration** - Programmatic linting with detailed error reporting
- **Test Coverage Analysis** - Vitest coverage measurement with configurable thresholds
- **Security Scanning** - npm audit integration for vulnerability detection
- **Quality Gate Enforcement** - Policy-based validation from `policy.yaml`
- **Comprehensive Reporting** - Actionable validation reports with recommendations

## Installation

```bash
pnpm install @agentic-sdlc/validation-agent
```

## Usage

### As a Standalone Agent

```typescript
import { ValidationAgent } from '@agentic-sdlc/validation-agent';

const agent = new ValidationAgent();

// Initialize and connect to Redis
await agent.initialize();

// Agent will listen for tasks on Redis channel: agent:validation:tasks
// Results are published to: orchestrator:results
```

### Running the Agent

```bash
# From package directory
pnpm start

# Or via pnpm workspace
pnpm --filter @agentic-sdlc/validation-agent start
```

### Task Format

The validation agent expects tasks with the following context:

```typescript
{
  task_id: string;         // UUID
  workflow_id: string;     // UUID
  type: 'validation';
  name: string;
  description: string;
  requirements: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  context: {
    project_path: string;                    // Required: Path to project
    package_manager?: 'npm' | 'pnpm' | 'yarn'; // Default: 'pnpm'
    validation_types?: Array<                 // Default: all types
      'typescript' | 'eslint' | 'coverage' | 'security'
    >;
    policy_path?: string;                     // Optional: Custom policy file
    coverage_threshold?: number;              // Optional: Override default threshold
  };
}
```

## Validation Types

### TypeScript Validation

Runs `tsc --noEmit` to check for compilation errors.

**Passes when:**
- No compilation errors
- No type errors

**Output:**
- Error count and details
- File locations with line/column numbers
- Error codes

### ESLint Validation

Uses ESLint programmatic API for linting.

**Passes when:**
- No ESLint errors (warnings don't fail)

**Output:**
- Error and warning counts
- Fixable issue counts
- Detailed issue list with severity

### Coverage Validation

Runs Vitest with coverage and validates against threshold.

**Passes when:**
- Line coverage >= threshold (default 80%)

**Output:**
- Line, branch, function, statement coverage percentages
- Files below threshold
- Coverage details

### Security Validation

Runs `npm audit` to detect vulnerabilities.

**Passes when:**
- No critical vulnerabilities
- No high vulnerabilities

**Output:**
- Vulnerability counts by severity
- Package names and versions
- Fix availability
- Vulnerability IDs and URLs

## Quality Gates

Quality gates are defined in `ops/agentic/backlog/policy.yaml`:

```yaml
gates:
  coverage:
    metric: "line_coverage"
    operator: ">="
    threshold: 80
    description: "Minimum code coverage percentage"
    blocking: true

  security:
    metric: "critical_vulns"
    operator: "=="
    threshold: 0
    description: "Zero critical vulnerabilities allowed"
    blocking: true
```

### Gate Evaluation

- **Blocking gates**: Must pass for validation to succeed
- **Non-blocking gates**: Generate warnings but don't fail validation
- **Skipped gates**: Gates are skipped if corresponding validator wasn't run

## Validation Report

The agent generates comprehensive reports with:

- **Overall Status**: passed, failed, or warning
- **Validation Checks**: Individual check results
- **Quality Gates**: Gate evaluation results
- **Summary**: Counts and duration
- **Recommendations**: Actionable next steps

Example report output:

```
================================================================================
VALIDATION REPORT
================================================================================

Task ID:       41e33129-ed42-4e89-9c84-64edc3972799
Workflow ID:   6f295dd2-e17f-4ab1-bf12-ad00a9b5f60a
Overall Status: PASSED

--------------------------------------------------------------------------------
SUMMARY
--------------------------------------------------------------------------------
Total Checks:   4
Passed:         4
Failed:         0
Warnings:       0
Duration:       3500ms

--------------------------------------------------------------------------------
VALIDATION CHECKS
--------------------------------------------------------------------------------
✓ TYPESCRIPT: passed (1000ms)
✓ ESLINT: passed (500ms)
✓ COVERAGE: passed (2000ms)
✓ SECURITY: passed (1500ms)

--------------------------------------------------------------------------------
QUALITY GATES
--------------------------------------------------------------------------------
Overall: PASSED ✓
Evaluated: 2
Passed:    2
Failed:    0

--------------------------------------------------------------------------------
RECOMMENDATIONS
--------------------------------------------------------------------------------
1. All validation checks passed. Ready for next stage.
================================================================================
```

## API

### ValidationAgent

Main agent class extending `BaseAgent`.

```typescript
class ValidationAgent extends BaseAgent {
  constructor();
  async initialize(): Promise<void>;
  async execute(task: TaskAssignment): Promise<TaskResult>;
  async cleanup(): Promise<void>;
}
```

### Validators

Individual validator functions:

```typescript
// TypeScript validation
async function validateTypeScript(projectPath: string): Promise<ValidationCheckResult>

// ESLint validation
async function validateESLint(projectPath: string): Promise<ValidationCheckResult>

// Coverage validation
async function validateCoverage(
  projectPath: string,
  threshold?: number
): Promise<ValidationCheckResult>

// Security validation
async function validateSecurity(projectPath: string): Promise<ValidationCheckResult>

// Quality gates evaluation
function evaluateQualityGates(
  validationChecks: ValidationCheckResult[],
  policy: PolicyConfig
): QualityGateResult
```

### Utilities

```typescript
// Load policy configuration
async function loadPolicyConfig(policyPath?: string): Promise<PolicyConfig>

// Get default policy
function getDefaultPolicy(): PolicyConfig

// Generate validation report
function generateValidationReport(
  taskId: string,
  workflowId: string,
  projectPath: string,
  validationChecks: ValidationCheckResult[],
  qualityGates: QualityGateResult,
  startTime: number
): ValidationReport

// Format report as text
function formatReportAsText(report: ValidationReport): string
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
- 28 tests passing
- 62% overall coverage
- 90%+ coverage for core logic

## Configuration

Set environment variables:

```bash
# Redis configuration
REDIS_HOST=localhost
REDIS_PORT=6380

# Anthropic API (inherited from base-agent)
ANTHROPIC_API_KEY=your-api-key
```

## Integration with Orchestrator

The validation agent:

1. Subscribes to `agent:validation:tasks` Redis channel
2. Receives validation tasks from orchestrator
3. Executes validation checks based on task context
4. Evaluates quality gates against policy
5. Publishes results to `orchestrator:results` channel
6. Registers in `agents:registry` Redis hash

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
validation-agent/
├── src/
│   ├── validation-agent.ts    # Main agent class
│   ├── types.ts                # Zod schemas and types
│   ├── validators/             # Individual validators
│   │   ├── typescript-validator.ts
│   │   ├── eslint-validator.ts
│   │   ├── coverage-validator.ts
│   │   ├── security-validator.ts
│   │   └── quality-gates.ts
│   ├── utils/                  # Utilities
│   │   ├── policy-loader.ts
│   │   └── report-generator.ts
│   ├── index.ts                # Public exports
│   └── run-agent.ts            # Entry point
└── __tests__/                  # Unit tests
```

## License

MIT

## Contributing

See the main project CONTRIBUTING.md for guidelines.
