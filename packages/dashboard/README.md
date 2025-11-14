# Agentic SDLC Dashboard

React-based monitoring dashboard for the Agentic SDLC system.

## Features

- **Real-time Workflow Monitoring** - Live updates of workflow status and progress
- **Agent Performance Analytics** - Track agent execution metrics and success rates
- **Distributed Trace Visualization** - View request flows across the system
- **Filterable Workflow List** - Search and filter workflows by status, type, priority
- **Auto-refresh** - Automatic data updates (5-10 second intervals)

## Tech Stack

- React 18 + TypeScript
- Vite (dev server + build tool)
- TailwindCSS (styling)
- React Router (routing)
- React Query (data fetching)
- Recharts (charts)
- Playwright (E2E testing)

## Development

### Local Development

```bash
# Install dependencies
pnpm install

# Start dev server (requires orchestrator on port 3000)
pnpm dev

# Visit http://localhost:3001
```

### Docker Development

The dashboard is included in the docker-compose setup and starts automatically:

```bash
# Start all services including dashboard
./scripts/env/start-dev.sh

# Dashboard will be available at http://localhost:3001
```

### Build

```bash
# Type check
pnpm typecheck

# Production build
pnpm build

# Preview production build
pnpm preview
```

## Testing

### E2E Tests (Playwright)

```bash
# Run E2E tests (headless)
pnpm test:e2e

# Run with UI
pnpm test:e2e:ui

# Run headed (see browser)
pnpm test:e2e:headed

# Debug mode
pnpm test:e2e:debug
```

The E2E tests cover:
- Dashboard overview page loading
- Workflows list with filtering
- Navigation between pages
- 404 handling
- Active link highlighting

## API Integration

The dashboard connects to the orchestrator API on `http://localhost:3000`:

- `GET /api/v1/workflows` - List workflows
- `GET /api/v1/workflows/:id` - Get workflow details
- `GET /api/v1/workflows/:id/timeline` - Get workflow timeline
- `GET /api/v1/stats/overview` - Get dashboard stats
- `GET /api/v1/stats/agents` - Get agent performance
- `GET /api/v1/traces/:traceId` - Get trace details

Vite proxy configuration automatically forwards `/api` requests to the orchestrator.

## Project Structure

```
src/
├── api/           - API client functions
├── components/    - React components
│   ├── Layout/    - Layout components
│   ├── Common/    - Reusable components (badges, spinners, etc)
│   ├── Workflows/ - Workflow-specific components
│   ├── Traces/    - Trace visualization components
│   └── Charts/    - Chart components
├── pages/         - Page components (routes)
├── hooks/         - Custom React hooks
├── types/         - TypeScript type definitions
└── utils/         - Utility functions

e2e/               - Playwright E2E tests
```

## Environment Variables

No environment variables required. The dashboard uses:
- Port: `3001` (configurable in vite.config.ts)
- API Proxy: `/api` → `http://localhost:3000`

## Deployment

### Production Build

```bash
pnpm build
```

Output will be in `dist/` directory. Serve with any static file server.

### Docker

The Dockerfile is configured for development with hot reload:

```bash
docker build -t agentic-dashboard .
docker run -p 3001:3001 agentic-dashboard
```

## Contributing

1. All components should be TypeScript
2. Use TailwindCSS for styling
3. Add E2E tests for new pages
4. Keep components small and focused
5. Use React Query for data fetching

## License

Internal use only.
