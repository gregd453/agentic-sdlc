# E2E Testing Guide

## Quick Start

Run E2E tests with auto-starting services:

```bash
./scripts/dev/cli e2e-test --start-services
```

## Command Syntax

```bash
./scripts/dev/cli e2e-test [options] [test-file]
```

## Options

| Option | Description |
|--------|-------------|
| `--start-services` | Automatically start shell and all frontend apps before running tests |
| `--headed` | Run tests with visible browser (useful for debugging) |
| `--ui` | Run in interactive UI mode (Playwright Test UI) |
| `--debug` | Run in debug mode with Playwright Inspector |
| `--report` | Show HTML test report after tests complete |
| `[test-file]` | Optional specific test file to run (e.g., `shell-health.spec.ts`) |

## Common Usage Patterns

### Run All Tests

```bash
# Quick: Assumes services are already running
./scripts/dev/cli e2e-test

# Safe: Auto-starts all required services
./scripts/dev/cli e2e-test --start-services
```

### Debug Specific Test

```bash
# Run with visible browser for visual debugging
./scripts/dev/cli e2e-test --headed shell-health.spec.ts

# Run in interactive UI mode
./scripts/dev/cli e2e-test --ui shell-health.spec.ts

# Run with Playwright Inspector (step-by-step debugging)
./scripts/dev/cli e2e-test --debug shell-health.spec.ts
```

### View Results

```bash
# Run tests and open HTML report afterward
./scripts/dev/cli e2e-test --start-services --report

# Just open the last report (if tests were run before)
./scripts/dev/cli e2e-test --report
```

### Run Specific Test Files

```bash
# Health checks only
./scripts/dev/cli e2e-test shell-health.spec.ts

# Demo user navigation tests only
./scripts/dev/cli e2e-test shell-navigation.demo.spec.ts

# Admin user navigation tests only
./scripts/dev/cli e2e-test shell-navigation.admin.spec.ts
```

## Prerequisites

1. **Node.js & pnpm**: Required for all commands
2. **Playwright**: Automatically installed on first run
3. **Services**: Either already running OR use `--start-services` flag

## Testing the Shell

### Health Checks
```bash
./scripts/dev/cli e2e-test shell-health.spec.ts
```
Verifies:
- Shell loads without errors
- Navigation components are visible
- All federated apps can be loaded

### Demo User Tests
```bash
./scripts/dev/cli e2e-test shell-navigation.demo.spec.ts
```
Verifies:
- Demo user can log in
- Can navigate to all user-accessible pages
- Cannot access admin-only pages

### Admin User Tests
```bash
./scripts/dev/cli e2e-test shell-navigation.admin.spec.ts
```
Verifies:
- Admin user can log in
- Can access all pages (user + admin)
- Can perform admin operations

## Troubleshooting

### Tests fail with "Shell is not accessible"

**Solution 1: Auto-start services**
```bash
./scripts/dev/cli e2e-test --start-services
```

**Solution 2: Manually start services**

In separate terminals:
```bash
# Terminal 1: Start shell
pnpm dev --filter=@zyp/zyp-rspack-1

# Terminal 2: Start all frontends
pnpm dev --filter='@zyp/*frontend'

# Terminal 3: Run tests
./scripts/dev/cli e2e-test
```

### Tests fail with "Login failed"

The login selectors need to match your actual shell UI. Edit `tests/e2e/fixtures/auth.ts`:

```typescript
async function loginUser(page: Page, credentials) {
  // Update these selectors to match your shell
  await page.locator('input[name="email"]').fill(credentials.email);
  await page.locator('input[name="password"]').fill(credentials.password);
  await page.locator('button[type="submit"]').click();
}
```

Run test with `--headed` to see what selectors exist:
```bash
./scripts/dev/cli e2e-test --headed --start-services
```

### Playwright browsers not found

Browsers are auto-installed on first run. If that fails:

```bash
cd tests/e2e
npx playwright install chromium firefox webkit
```

### Ports already in use

Kill existing services or use Docker:

```bash
# Kill processes on specific port
lsof -i :3050 | awk 'NR!=1 {print $2}' | xargs kill -9

# Or use different ports by starting manually with custom config
```

## Log Files

The script creates timestamped log files in `scripts/logs/`:

```
dev-e2e-test-20251027-100844.log
```

Check logs for detailed output:
```bash
tail -f scripts/logs/dev-e2e-test-*.log
```

## Integration with Dev CLI

The command is fully integrated with the `dev` CLI tool:

```bash
# Show all dev commands
./scripts/dev/cli help

# Show e2e-test specific help
./scripts/dev/cli help | grep -A 15 "Testing:"
```

## Advanced Options

### Run with Specific Browser

The config supports multiple browsers. Modify `tests/e2e/playwright.config.ts`:

```bash
# Run only Chrome tests (default runs all)
cd tests/e2e && npx playwright test --project=chromium
```

### Run with Specific Reporter

Results go to `tests/e2e/reports/`:

```
reports/html/          # HTML report (visual)
reports/junit/         # JUnit XML (CI/CD)
```

### Environment Variables

```bash
# Set test timeout
PLAYWRIGHT_TEST_TIMEOUT=60000 ./scripts/dev/cli e2e-test

# Enable debug output
DEBUG=pw:api ./scripts/dev/cli e2e-test

# Set custom base URL (if not localhost:3050)
PLAYWRIGHT_TEST_BASE_URL=http://localhost:3050 ./scripts/dev/cli e2e-test
```

## Performance Tips

1. **Use `--start-services` flag**: Cleaner service startup than manual management
2. **Run health checks first**: Fast way to verify setup before full test suite
3. **Increase timeout for slow machines**: Edit `tests/e2e/playwright.config.ts`
4. **Use `--headed` only for debugging**: Headless mode is much faster

## Next Steps

- Fix login selectors if needed (see troubleshooting)
- Run full test suite: `./scripts/dev/cli e2e-test --start-services`
- View results: `./scripts/dev/cli e2e-test --report`
- Debug failures: `./scripts/dev/cli e2e-test --headed --start-services`

## Additional Resources

- [Playwright Documentation](https://playwright.dev)
- [tests/e2e/README.md](../../tests/e2e/README.md) - Detailed test documentation
- [tests/e2e/playwright.config.ts](../../tests/e2e/playwright.config.ts) - Configuration
- [tests/e2e/fixtures/auth.ts](../../tests/e2e/fixtures/auth.ts) - Authentication setup
