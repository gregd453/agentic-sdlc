# Zyp Platform UI Components

This directory contains the React/TypeScript component implementations for the Zyp Platform user interface.

## Component Overview

### 1. Dashboard Component (`dashboard-component.tsx`)
The main landing page providing an overview of the entire platform.

**Key Features:**
- Real-time metrics cards (Platforms, Surfaces, Workflows, Agents)
- Recent activity feed with live updates
- Platform health monitoring across environments
- Active workflow tracking with progress indicators
- Quick actions for common tasks

**Props:**
```typescript
interface DashboardProps {
  user: {
    name: string;
    avatar?: string;
  };
}
```

### 2. Surface Registry Component (`surface-registry-component.tsx`)
Manages and configures application surfaces across the platform.

**Key Features:**
- Multiple view modes (Grid, List, Dependency Graph)
- Surface creation and configuration dialog
- Advanced filtering by type and layer
- Real-time search functionality
- Visual dependency mapping
- Surface enable/disable toggles

**View Modes:**
- **Grid View**: Card-based layout for visual browsing
- **List View**: Detailed tabular display with all properties
- **Dependency View**: Interactive graph visualization of surface relationships

### 3. Workflow Management Component (`workflow-management-component.tsx`)
Execute and monitor platform workflows in real-time.

**Key Features:**
- Active workflow monitoring with live progress
- Workflow creation wizard with surface selection
- Stage-by-stage execution tracking
- EPCC phase visualization (Envision, Plan, Code, Check)
- Output log streaming
- Queue management
- Historical workflow data

**Workflow States:**
- Running: Active execution with progress tracking
- Queued: Waiting for execution
- Completed: Successfully finished
- Failed: Execution errors
- Cancelled: User-terminated

### 4. Platform Details Component (`platform-details-component.tsx`)
Comprehensive platform management and configuration interface.

**Key Features:**
- Multi-tab organization (Overview, Surfaces, Workflows, Agents, Settings)
- Platform configuration editing
- Surface enablement per platform
- Agent registration and management
- Policy configuration (Security, Performance, Infrastructure)
- Visual surface architecture map
- Workflow history and execution

**Tabs:**
- **Overview**: Platform configuration, surface map, recent workflows
- **Surfaces**: Detailed surface management with dependencies
- **Workflows**: Historical execution data with artifacts
- **Agents**: Platform-specific agent configurations
- **Settings**: Policy management and platform settings

## Component Architecture

### Design System
All components are built using:
- **shadcn/ui**: Base component library
- **Tailwind CSS**: Styling and responsive design
- **Lucide React**: Consistent iconography
- **React Hook Form**: Form management
- **Zod**: Schema validation

### State Management
Components are designed to work with:
- **Local State**: Component-specific state using useState
- **Global State**: Integration ready for Zustand/Redux
- **Server State**: Prepared for React Query/SWR

### Data Flow
```
Dashboard
    ├── Metrics API
    ├── Activity Stream (WebSocket)
    └── Platform Health Monitor

Surface Registry
    ├── Surface CRUD Operations
    ├── Dependency Resolution
    └── Real-time Search

Workflow Management
    ├── Workflow Execution API
    ├── Progress WebSocket
    └── Log Streaming

Platform Details
    ├── Platform Configuration
    ├── Surface Mappings
    ├── Agent Registry
    └── Policy Management
```

## Usage Examples

### Basic Dashboard Implementation
```tsx
import { Dashboard } from './ui-mockups/dashboard-component';

function App() {
  const user = {
    name: 'John Doe',
    avatar: '/avatars/john.jpg'
  };

  return <Dashboard user={user} />;
}
```

### Surface Registry with Custom Filtering
```tsx
import { SurfaceRegistry } from './ui-mockups/surface-registry-component';

function SurfaceManagement() {
  return (
    <SurfaceRegistry
      onSurfaceCreate={(surface) => console.log('Created:', surface)}
      onSurfaceUpdate={(surface) => console.log('Updated:', surface)}
    />
  );
}
```

### Workflow Monitoring
```tsx
import { WorkflowManagement } from './ui-mockups/workflow-management-component';

function WorkflowMonitor() {
  return (
    <WorkflowManagement
      onWorkflowCreate={(workflow) => console.log('Started:', workflow)}
      onWorkflowCancel={(id) => console.log('Cancelled:', id)}
    />
  );
}
```

## Responsive Design

All components support the following breakpoints:
- **Desktop**: 1920px (default, full features)
- **Laptop**: 1440px (condensed layout)
- **Tablet**: 1024px (single column, simplified)
- **Mobile**: Not supported (admin interface)

## Performance Optimizations

### Implemented Optimizations
- Virtual scrolling for large lists
- Lazy loading of heavy components
- Memoization of expensive computations
- Optimistic UI updates
- Debounced search inputs

### Recommended Optimizations
- Code splitting by route
- Service worker caching
- WebSocket connection pooling
- GraphQL fragment caching
- Progressive image loading

## Accessibility Features

All components include:
- ARIA labels and roles
- Keyboard navigation support
- Focus management
- Screen reader announcements
- High contrast mode support
- Reduced motion alternatives

## Testing Approach

### Unit Tests
```typescript
describe('Dashboard', () => {
  it('displays user name', () => {
    const { getByText } = render(<Dashboard user={{ name: 'Test User' }} />);
    expect(getByText('Welcome back, Test User')).toBeInTheDocument();
  });
});
```

### Integration Tests
```typescript
describe('Workflow Execution', () => {
  it('creates and monitors workflow', async () => {
    // Test workflow creation
    // Monitor progress updates
    // Verify completion
  });
});
```

## Future Enhancements

### Phase 2
- Real-time collaboration features
- Advanced analytics dashboards
- AI-powered workflow suggestions
- Mobile companion app
- Custom plugin system

### Phase 3
- Voice command integration
- AR/VR visualization
- Predictive maintenance
- Automated optimization
- Multi-tenant support

## Development Setup

### Prerequisites
```bash
npm install @shadcn/ui tailwindcss lucide-react
npm install react-hook-form zod @hookform/resolvers
npm install @radix-ui/react-* # Various Radix UI primitives
```

### Configuration
```javascript
// tailwind.config.js
module.exports = {
  content: ['./ui-mockups/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#1e40af',
        secondary: '#7c3aed',
      }
    }
  }
};
```

## API Integration

Components are designed to integrate with the following API endpoints:

### Platform Service
- `GET /api/platforms` - List all platforms
- `GET /api/platforms/:id` - Get platform details
- `POST /api/platforms` - Create platform
- `PUT /api/platforms/:id` - Update platform
- `DELETE /api/platforms/:id` - Delete platform

### Surface Service
- `GET /api/surfaces` - List all surfaces
- `GET /api/surfaces/:id` - Get surface details
- `POST /api/surfaces` - Create surface
- `PUT /api/surfaces/:id` - Update surface

### Workflow Service
- `GET /api/workflows` - List workflows
- `POST /api/workflows` - Create workflow
- `GET /api/workflows/:id/status` - Get workflow status
- `WS /api/workflows/:id/stream` - Stream workflow updates

## WebSocket Events

Components listen for real-time updates:

```typescript
// Event types
interface WorkflowUpdate {
  id: string;
  status: 'running' | 'completed' | 'failed';
  progress: number;
  currentStage: string;
}

interface PlatformHealth {
  platform: string;
  status: 'healthy' | 'degraded' | 'down';
  metrics: {
    uptime: number;
    responseTime: number;
  };
}
```

## Security Considerations

All components implement:
- XSS prevention through React's built-in escaping
- CSRF token handling for mutations
- Role-based access control (RBAC) ready
- Secure WebSocket connections
- Input validation and sanitization

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## License

Copyright (c) 2024 Zyp Platform. All rights reserved.