# Pipeline Test Cases

This document defines reproducible test cases for the Agentic SDLC pipeline. Use the test runner to execute these cases repeatedly.

## Quick Start

```bash
# List available tests
./scripts/run-pipeline-test.sh --list

# Run a specific test
./scripts/run-pipeline-test.sh "Simple Calculator"

# Run all tests
./scripts/run-pipeline-test.sh --all

# Run with detailed output
./scripts/run-pipeline-test.sh "Simple Calculator" --verbose
```

## Test Execution Flow

1. **Environment Check** - Verify all services running
2. **Workflow Submission** - POST to `/api/v1/workflows`
3. **Progress Monitoring** - Poll `/api/v1/workflows/{id}` until completion
4. **Results Capture** - Save to `.test-results/`
5. **Validation** - Check generated artifacts

## Test Cases

### Slate Nightfall Calculator

Generate a professional calculator with Slate Nightfall dark theme.

**Expected Result:** React SPA with calculator UI, dark theme styling, full functionality, history panel

**Features Generated:**
- Dark Slate Nightfall design system (slate background, sky blue accents)
- 4x5 calculator button grid
- Calculator display with expression tracking
- Calculation history (last 5 calculations)
- Full keyboard support (0-9, +/-/*/÷, Enter=equals, Escape=clear, Backspace=delete)
- Responsive design (mobile-friendly)
- Tailwind CSS styling with custom colors
- React hooks for state management (useState, useCallback, useEffect)

```json
{
  "type": "app",
  "name": "calculator-slate-nightfall",
  "description": "Professional calculator with Slate Nightfall theme",
  "priority": "high",
  "requirements": "Create a React calculator app with Slate Nightfall design system: dark slate background (#0f172a), sky blue accents (#38bdf8), number buttons (0-9), operation buttons (+, -, *, /), equals and clear buttons, decimal support, calculation display with current expression, history panel showing last 5 calculations, full keyboard support (numbers 0-9, operations +−×÷, Enter for equals, Escape for clear, Backspace for delete), responsive design with Tailwind CSS, use React hooks for state management."
}
```

### Hello World API

Generate a hello-world API with Express/Fastify backend.

**Expected Result:** Backend API with health check endpoints, request logging

```json
{
  "type": "app",
  "name": "hello-world-api",
  "description": "Build a hello-world REST API",
  "priority": "high",
  "requirements": "Create a Node.js API server with: GET /api/health endpoint returning {status: 'ok'}, GET /api/hello endpoint returning {message: 'Hello World'}, structured logging with timestamps, graceful error handling. Use TypeScript."
}
```

### React Dashboard

Generate a dashboard with data visualization components.

**Expected Result:** React app with multiple pages, routing, data display

```json
{
  "type": "app",
  "name": "react-dashboard",
  "description": "Build a React dashboard with data visualization",
  "priority": "medium",
  "requirements": "Create a React dashboard with: multiple pages/routes using React Router, mock data with 3 different data sources, display metrics in cards, chart component for trend visualization, responsive grid layout. Use Tailwind CSS styling."
}
```

### Form Application

Generate a form-based CRUD application.

**Expected Result:** React app with form validation, data management

```json
{
  "type": "app",
  "name": "form-app",
  "description": "Build a form application with CRUD operations",
  "priority": "medium",
  "requirements": "Create a React form application with: form component with validation (name, email, phone), create/read/update/delete operations using mock local storage, list view of stored entries, error messages for validation failures, success notifications on save. Use Tailwind CSS."
}
```

### Todo List

Generate a todo management application.

**Expected Result:** React app with todo list, add/edit/delete functionality

```json
{
  "type": "app",
  "name": "todo-app",
  "description": "Build a todo list application",
  "priority": "low",
  "requirements": "Create a React todo application with: add new todos, mark as complete/incomplete, delete todos, persistent storage using localStorage, filter by status (all/active/completed), search functionality. Use Tailwind CSS dark theme."
}
```

### Fullstack Notes App

Generate a full-stack application with backend and frontend.

**Expected Result:** React frontend + Node API backend + database integration

```json
{
  "type": "app",
  "name": "notes-fullstack",
  "description": "Build a full-stack notes application",
  "priority": "high",
  "requirements": "Create a full-stack notes app with: React frontend, Node.js API backend (Fastify), SQLite database, create/read/update/delete notes, search notes by title/content, timestamps on creation/update. Use Tailwind CSS for styling, Zod for validation."
}
```

### Performance Test

Generate an app with performance considerations.

**Expected Result:** Large app with optimized bundling, lazy loading

```json
{
  "type": "app",
  "name": "perf-test-app",
  "description": "Build a performance-optimized application",
  "priority": "medium",
  "requirements": "Create a React app with: 5+ pages with lazy loading, images with responsive srcset, code splitting by route, performance optimizations (memoization, useMemo), lighthouse score target >80. Measure bundle size and report optimization metrics."
}
```

### Component Library

Generate a reusable component library.

**Expected Result:** Storybook showcase with multiple components

```json
{
  "type": "app",
  "name": "component-lib",
  "description": "Build a component library with Storybook",
  "priority": "low",
  "requirements": "Create a component library with: Button, Input, Card, Modal components, TypeScript definitions for all components, Storybook stories for each component showing variants (size, state, disabled), unit tests for components, TailwindCSS styling applied to all."
}
```

## Test Execution History

### Session #15 - Pipeline Testing Framework

| Test | Status | Duration | Generated App | Errors |
|------|--------|----------|----------------|--------|
| Simple Calculator | ⏳ Pending | - | - | - |
| Hello World API | ⏳ Pending | - | - | - |
| React Dashboard | ⏳ Pending | - | - | - |
| Form Application | ⏳ Pending | - | - | - |
| Todo List | ⏳ Pending | - | - | - |
| Fullstack Notes | ⏳ Pending | - | - | - |
| Performance Test | ⏳ Pending | - | - | - |
| Component Library | ⏳ Pending | - | - | - |

## Debugging Failed Tests

### Check Environment Health

```bash
./scripts/env/check-health.sh --verbose
```

### View Test Logs

```bash
# View orchestrator logs
tail -f scripts/logs/orchestrator.log

# View scaffold agent logs
tail -f scripts/logs/scaffold-agent.log

# View test execution logs
tail -f scripts/logs/test-*.log
```

### Manual Workflow Submission

```bash
# Submit a workflow manually
curl -X POST http://localhost:3000/api/v1/workflows \
  -H "Content-Type: application/json" \
  -d '{
    "type": "app",
    "name": "test-app",
    "description": "Test workflow",
    "priority": "high",
    "requirements": "Create a React hello world app"
  }'

# Monitor status
curl http://localhost:3000/api/v1/workflows/{workflow_id}
```

### Reset Environment for Clean Test

```bash
# Full reset (WARNING: deletes data and generated apps!)
./scripts/env/reset-dev.sh --force

# Then start fresh
./scripts/env/start-dev.sh
```

## Pipeline Metrics

### Performance Baselines

- **Cold Start:** 8-12 seconds (first workflow of session)
- **Warm Start:** 3-5 seconds (subsequent workflows)
- **Generation:** 4-8 seconds (scaffold agent processing)
- **Total Time:** 15-25 seconds per app

### Quality Gates

- Code generation: Must complete without errors
- File creation: All template files created successfully
- Dependencies: package.json valid, no conflicts
- Build: `npm run build` completes (if included)

## Known Issues

### Issue: Workflow Stuck in "Scaffolding" Stage

**Symptom:** Workflow stays at 0% progress indefinitely

**Root Cause:** Scaffold agent not receiving tasks from Redis

**Solution:**
```bash
# 1. Check agent is running
pgrep -f "scaffold-agent" || echo "Not running"

# 2. Check Redis connection
docker exec agentic-sdlc-redis redis-cli KEYS "*agent*"

# 3. Restart agent
./scripts/env/stop-dev.sh
./scripts/env/start-dev.sh
```

### Issue: Node Module Conflicts

**Symptom:** `npm ERR! peer dep missing`

**Solution:**
```bash
# Use legacy peer deps flag
npm install --legacy-peer-deps

# Or reset environment
./scripts/env/reset-dev.sh --force
./scripts/env/start-dev.sh
```

## Adding New Test Cases

1. Add test case section to this file with JSON payload
2. Run test: `./scripts/run-pipeline-test.sh "Test Name"`
3. Results saved to `.test-results/test-name-result.json`
4. Update execution history table with results

## Contributing

When adding new test cases:
- Use descriptive names (e.g., "Simple Calculator" not "test1")
- Include clear requirements in the payload
- Document expected results
- Note priority (high/medium/low)
- Update execution history after running
