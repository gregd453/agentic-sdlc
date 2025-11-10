# Hello World App Generation Approach
Based on Zyp Platform Policies and Patterns

## Executive Summary

This document defines the approach for generating a hello world application that strictly adheres to the Zyp platform's architectural policies. The generated app will demonstrate the complete stack: React frontend, Fastify API, and Prisma ORM with PostgreSQL.

## Core Architecture Requirements

### 1. Technology Stack (FROZEN VERSIONS)
```json
{
  "frontend": {
    "react": "19.2.0",
    "vite": "6.0.11",
    "typescript": "5.4.5"
  },
  "backend": {
    "fastify": "5.6.1",
    "prisma": "5.14.0",
    "zod": "3.23.0",
    "typescript": "5.4.5"
  },
  "database": {
    "postgresql": "16.x"
  }
}
```

### 2. Critical Architectural Constraints

#### Database Isolation
- ✅ Each app gets its own PostgreSQL database
- ❌ NO shared databases between apps
- ❌ NO cross-database queries
- ❌ NO raw SQL - Prisma ORM only

#### Authentication
- ✅ Apps receive `x-user-id` header from authenticated requests
- ✅ Return `sessionPayload` to Shell-BFF for JWT signing
- ❌ NO JWT signing in apps
- ❌ NO jsonwebtoken dependency

#### API Design
- ✅ Zod validation at all API boundaries
- ✅ Envelope pattern: `{ success: true, data: T } | { success: false, error: {...} }`
- ✅ Fastify for all APIs
- ❌ NO direct app-to-app communication

## Hello World App Structure

### Project Layout
```
hello-world-app/
├── frontend/                    # React + Vite SPA
│   ├── src/
│   │   ├── App.tsx             # Main React component
│   │   ├── main.tsx            # Entry point
│   │   ├── api/                # API client
│   │   │   └── client.ts       # Typed API calls
│   │   └── types/              # Shared types
│   │       └── index.ts
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── package.json            # Exact versions only
│
├── backend/                     # Fastify API
│   ├── src/
│   │   ├── server.ts           # Fastify server setup
│   │   ├── routes/             # API routes
│   │   │   └── hello.ts        # Hello endpoint
│   │   ├── schemas/            # Zod schemas
│   │   │   └── hello.schema.ts
│   │   ├── services/           # Business logic
│   │   │   └── hello.service.ts
│   │   └── types/              # TypeScript types
│   │       └── envelope.ts     # Response envelope
│   ├── prisma/
│   │   ├── schema.prisma       # Database schema
│   │   └── migrations/         # Database migrations
│   ├── tsconfig.json
│   └── package.json            # Exact versions only
│
├── docker-compose.yml          # PostgreSQL for local dev
└── README.md                   # Setup instructions
```

## Template Components

### 1. Frontend Templates

#### package.json (Frontend)
```json
{
  "name": "@hello-world/frontend",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "19.2.0",
    "react-dom": "19.2.0"
  },
  "devDependencies": {
    "@types/react": "19.2.0",
    "@types/react-dom": "19.2.0",
    "@vitejs/plugin-react": "4.3.4",
    "typescript": "5.4.5",
    "vite": "6.0.11"
  }
}
```

#### App.tsx
```tsx
import { useState, useEffect } from 'react';
import { apiClient } from './api/client';

function App() {
  const [message, setMessage] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient.getHello()
      .then(response => {
        if (response.success) {
          setMessage(response.data.message);
        } else {
          setError(response.error.message);
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="app">
      <h1>Hello World App</h1>
      <p>{message}</p>
    </div>
  );
}

export default App;
```

### 2. Backend Templates

#### package.json (Backend)
```json
{
  "name": "@hello-world/backend",
  "version": "1.0.0",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "db:migrate": "prisma migrate dev",
    "db:generate": "prisma generate"
  },
  "dependencies": {
    "@prisma/client": "5.14.0",
    "fastify": "5.6.1",
    "@fastify/cors": "10.0.1",
    "zod": "3.23.0"
  },
  "devDependencies": {
    "prisma": "5.14.0",
    "typescript": "5.4.5",
    "tsx": "4.20.0",
    "@types/node": "20.11.24"
  }
}
```

#### server.ts
```typescript
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { helloRoutes } from './routes/hello';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function buildServer() {
  const fastify = Fastify({
    logger: true
  });

  await fastify.register(cors, {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173'
  });

  // Register routes
  await fastify.register(helloRoutes, { prefix: '/api' });

  // Graceful shutdown
  const closeHandlers = async () => {
    await prisma.$disconnect();
    await fastify.close();
  };

  process.on('SIGINT', closeHandlers);
  process.on('SIGTERM', closeHandlers);

  return fastify;
}

async function start() {
  const server = await buildServer();

  try {
    await server.listen({
      port: 3000,
      host: '0.0.0.0'
    });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

start();
```

#### hello.schema.ts (Zod Validation)
```typescript
import { z } from 'zod';

export const HelloResponseSchema = z.object({
  message: z.string(),
  timestamp: z.string().datetime(),
  count: z.number().int().positive()
});

export type HelloResponse = z.infer<typeof HelloResponseSchema>;

export const HelloCreateSchema = z.object({
  name: z.string().min(1).max(100)
});

export type HelloCreate = z.infer<typeof HelloCreateSchema>;
```

#### envelope.ts (Response Pattern)
```typescript
export type SuccessEnvelope<T> = {
  success: true;
  data: T;
};

export type ErrorEnvelope = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export type ApiEnvelope<T> = SuccessEnvelope<T> | ErrorEnvelope;
```

#### schema.prisma
```prisma
generator client {
  provider = "prisma-client-js"
  binaryTargets = ["native"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model HelloMessage {
  id        String   @id @default(uuid())
  message   String
  count     Int      @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("hello_messages")
}
```

## Generation Process

### Phase 1: Project Scaffolding
1. Create directory structure
2. Generate package.json files with exact versions
3. Set up TypeScript configurations
4. Create Docker Compose for PostgreSQL

### Phase 2: Backend Generation
1. Generate Fastify server with proper setup
2. Create Prisma schema and initial migration
3. Implement Zod schemas for validation
4. Create service layer with business logic
5. Set up routes with envelope pattern

### Phase 3: Frontend Generation
1. Generate React components
2. Create API client with typed requests
3. Set up Vite configuration
4. Implement error handling

### Phase 4: Integration
1. Configure CORS properly
2. Set up environment variables
3. Create README with setup instructions
4. Add development scripts

## Template Variables

The scaffold-agent should support these variables:
```typescript
interface HelloWorldConfig {
  appName: string;          // e.g., "hello-world"
  appDescription: string;   // e.g., "A simple hello world app"
  port: number;            // API port (default: 3000)
  frontendPort: number;    // Frontend port (default: 5173)
  databaseName: string;    // PostgreSQL database name
  features: {
    includeAuth: boolean;  // Add auth middleware stub
    includeCRUD: boolean;  // Add full CRUD operations
    includeTests: boolean; // Add test setup
  };
}
```

## Implementation Checklist

### Required Components
- [ ] React 19.2.0 frontend with Vite 6.0.11
- [ ] Fastify 5.6.1 API server
- [ ] Prisma 5.14.0 with PostgreSQL
- [ ] Zod 3.23.0 validation at API boundaries
- [ ] Envelope pattern for all responses
- [ ] Exact version pinning (no ^ or ~)
- [ ] TypeScript 5.4.5 for type safety
- [ ] Isolated PostgreSQL database
- [ ] CORS configuration
- [ ] Error handling

### Prohibited Patterns
- [ ] NO JWT signing in app
- [ ] NO raw SQL queries
- [ ] NO direct app-to-app calls
- [ ] NO shared databases
- [ ] NO version ranges in package.json

## Testing the Generated App

### Validation Criteria
1. **Build Success**: Both frontend and backend build without errors
2. **Type Safety**: No TypeScript errors
3. **API Contract**: All endpoints follow envelope pattern
4. **Database**: Prisma migrations run successfully
5. **Runtime**: App starts and responds to requests
6. **Isolation**: App runs independently

### Test Commands
```bash
# Backend
cd backend
npm install
npm run db:migrate
npm run build
npm run dev

# Frontend
cd frontend
npm install
npm run build
npm run dev

# Verify
curl http://localhost:3000/api/hello
# Should return: { "success": true, "data": { ... } }
```

## Next Steps

1. **Enhance scaffold-agent** to use these templates
2. **Create Handlebars templates** for each file type
3. **Add validation** to ensure compliance with policies
4. **Implement generation** logic in scaffold-agent
5. **Test end-to-end** workflow through orchestrator

## Success Criteria

The hello world app generation is successful when:
- ✅ App follows all architectural policies
- ✅ Uses exact frozen versions
- ✅ Implements envelope pattern
- ✅ Uses Prisma for all database operations
- ✅ Validates with Zod at boundaries
- ✅ Runs independently with isolated database
- ✅ Frontend communicates with backend via API
- ✅ No security violations (no JWT signing, no raw SQL)
- ✅ Builds and runs without errors