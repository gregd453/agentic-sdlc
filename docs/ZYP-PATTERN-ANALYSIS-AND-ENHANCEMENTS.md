# Zyp Platform Patterns Analysis & Scaffold-Agent Enhancements

**Date:** 2025-11-10
**Status:** Analysis Complete - Recommendations Ready
**Audience:** Scaffold-Agent Enhancement Planning

---

## Executive Summary

The calculator-slate template and scaffold-agent are **well-aligned with core Zyp platform policies** (React 19.2.0, Vite 6.0.11, TypeScript 5.4.5 strict mode, exact version pinning). However, to achieve **full Zyp platform compliance**, additional templates and enhancements are needed across 5 key areas:

1. **Code Quality** - ESLint, Prettier, git hooks
2. **Testing** - Vitest setup for frontend and API
3. **API Patterns** - Envelope responses, Zod validation, health endpoints
4. **Database** - Prisma ORM, database isolation, schema management
5. **Backend Templates** - Production-grade Fastify API templates

---

## Part 1: Zyp Platform Policies Review

### Critical Architecture Decisions

All from `policies-and-patterns.json`:

#### 1. Framework Stack (FROZEN VERSIONS)
```
React:       19.2.0    ✓ Calculator includes
Vite:        6.0.11    ✓ Calculator includes
TypeScript:  5.4.5     ✓ Calculator includes
Fastify:     5.6.1     - Not in calculator
Prisma:      5.14.0    - Not in calculator
Zod:         3.23.0    - Not in calculator
Tailwind:    3.4.1     ✓ Calculator includes
```

**Status:** 4/7 compliant (57%)

#### 2. Dependency Pinning Policy
**Rule:** Exact versions only - NO ^ or ~

**Calculator Status:** ✓ COMPLIANT
```json
{
  "react": "19.2.0",        // ✓ No range
  "vite": "6.0.11",         // ✓ No range
  "typescript": "5.4.5"     // ✓ No range
}
```

#### 3. Database Isolation Architecture
**Rule:** Each app gets its own isolated PostgreSQL database
**Enforcement:** NO shared databases, NO cross-database queries

**Calculator Status:** N/A (Client-side only)
**Future:** Backend templates must enforce strict database isolation

#### 4. Database Access Architecture
**Rule:** Prisma ORM ONLY - NO raw SQL allowed

**Critical Prohibition:**
- ❌ Raw SQL queries
- ❌ SQL string concatenation
- ❌ Direct SQL execution
- ❌ Query builders other than Prisma

**Implementation:** Backend templates MUST use Prisma exclusively

#### 5. Authentication Architecture
**Rule:** NEVER sign JWTs in apps

**Critical Flow:**
```
Browser → Shell → Shell-BFF (validates JWT)
          ↓
      App-BFF (adds x-user-id header)
          ↓
      App (trusts x-user-id header ONLY)
```

**Prohibition:**
- ❌ JWT signing in apps
- ❌ JWT parsing in apps
- ❌ jsonwebtoken dependency
- ❌ JWT secret management

**Calculator Status:** N/A (Authentication-less demo)
**Future APIs:** Must use x-user-id header pattern

#### 6. Layer Isolation Architecture
**Rule:** Apps are isolated - communicate via API ONLY

**Prohibition:**
- ❌ Calling other apps directly
- ❌ Calling shells
- ❌ Bypassing App-BFF gateway
- ❌ Shared code between apps (use packages instead)

**Implementation:** Each generated app must be independently deployable

#### 7. Validation Architecture
**Rule:** Zod 3.23.0 for input validation at API boundary

**Implementation Pattern:**
```typescript
// ✓ Correct: Validate at API boundary
const result = createUserSchema.safeParse(request.body)
if (!result.success) {
  return errorResponse('VALIDATION_ERROR', result.error.errors)
}
```

#### 8. Request/Response Contract
**Rule:** Envelope pattern - standardized for all APIs

**Pattern:**
```typescript
// Success response
{
  success: true,
  data: T
}

// Error response
{
  success: false,
  error: {
    code: string,
    message: string,
    details?: any
  }
}
```

**Calculator Status:** N/A (Client-side only)
**Implementation:** All API templates MUST use envelope pattern

---

## Part 2: Implementation Patterns from Knowledge Base

### Controller Pattern
From `apps-patterns.md`:

**Key Principles:**
- Controllers handle HTTP logic ONLY
- Business logic delegates to service layer
- Zod validation at API boundary
- Response envelope helpers

**Calculator Status:** N/A (Client-side only)

### Service Layer Pattern
**Key Principles:**
- Services contain business logic
- Services access database via Prisma
- Services perform permission checks
- Services return typed data

**Calculator Status:** N/A (Client-side only)

### Repository Pattern
**Pattern:** Data access abstraction via Prisma
- No direct database calls from controllers
- All database access through repositories
- Typed query results

**Calculator Status:** N/A (Client-side only)

---

## Part 3: Quality Gates Requirements

From `apps-quality-gates.md`:

### Minimum Quality Requirements

| Gate | Requirement | Status |
|------|-------------|--------|
| Type Check | NO TypeScript errors | ✓ Pass (calculator) |
| Lint | NO ESLint errors | ❌ Missing (need ESLint config) |
| Tests | All tests pass | ❌ Missing (need Vitest setup) |
| Coverage | 80% minimum | ❌ Missing |
| Build | Production build succeeds | ✓ Pass (calculator) |
| Migrations | All migrations applied | ✓ N/A (client-side) |

**Calculator Compliance:** 2/6 = 33% of quality gates

### TypeScript Configuration
**All apps require strict mode:**

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

**Calculator Status:** ✓ COMPLIANT

### ESLint Configuration
**Required:** Standard ESLint setup

**Missing from calculator:** ESLint configuration

### Testing Requirements
**All apps require:**
- Unit tests with Vitest
- Integration tests (for APIs)
- E2E tests
- 80% minimum code coverage

**Calculator Status:** ❌ MISSING

---

## Part 4: Security Model Review

From `apps-security.md`:

### Security Principles

**1. Trust But Verify**
- ✓ Calculator: Client-side only (no external trust)
- ❌ APIs: Need x-user-id header validation

**2. Defense in Depth**
- ✓ Input validation (frontend)
- ❌ Prisma ORM (not applicable - client-side)
- ✓ Type safety (TypeScript)

**3. Least Privilege**
- ✓ Calculator: Isolated SPA
- ❌ APIs: Need permission checks

**4. Fail Secure**
- ✓ Error handling (envelope pattern in API templates)
- ❌ Not yet implemented in calculator

### Authentication Model
**Calculator:** N/A (Client-side only)

**API Apps:** MUST implement
- Trust x-user-id header from App-BFF
- NO JWT parsing
- NO JWT signing
- Permission checks at service layer

---

## Part 5: Current Compliance Analysis

### Calculator-Slate Template

**Compliance Score: 71% (5/7 policies)**

✓ **Compliant:**
1. React 19.2.0 (frozen version)
2. Vite 6.0.11 (frozen version)
3. TypeScript 5.4.5 (frozen version)
4. Exact version pinning (no ^ or ~)
5. Responsive, accessible design

❌ **Partially Compliant:**
6. ESLint missing (quality gate requirement)
7. Tests missing (quality gate requirement)

N/A **Not Applicable:**
- Database isolation (client-side only)
- Prisma ORM (client-side only)
- Authentication model (client-side only)
- API patterns (client-side only)

### Scaffold-Agent Integration

**Compliance Score: 58% (4/7 critical policies)**

✓ **Compliant:**
1. Generates React 19.2.0 apps
2. Uses exact version pinning
3. TypeScript strict mode
4. Vite for build tool

❌ **Non-Compliant:**
5. No ESLint setup
6. No test framework setup
7. No Prisma/database templates

---

## Part 6: Enhancement Recommendations

### Priority 1: Code Quality (1-2 hours)

**Add ESLint Configuration Template**

File: `packages/agents/scaffold-agent/templates/config/eslint.config.js.hbs`

```javascript
export default [
  {
    files: ["src/**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: { jsx: true }
      }
    },
    rules: {
      "no-unused-vars": "error",
      "no-implicit-any": "error",
      "no-console": ["warn", { allow: ["warn", "error"] }]
    }
  }
]
```

**Add Prettier Configuration Template**

File: `packages/agents/scaffold-agent/templates/config/.prettierrc.hbs`

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2
}
```

### Priority 2: Testing Framework (2-3 hours)

**Add Vitest Setup Template**

File: `packages/agents/scaffold-agent/templates/config/vitest.config.ts.hbs`

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      lines: 80,
      functions: 80,
      branches: 80,
      statements: 80
    }
  }
})
```

**Add Test Template Files**

File: `packages/agents/scaffold-agent/templates/app/calculator-slate/src/App.test.tsx.hbs`

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from './App'

describe('Calculator App', () => {
  it('should render calculator interface', () => {
    render(<App />)
    expect(screen.getByText('Calculator')).toBeInTheDocument()
  })

  it('should add numbers correctly', async () => {
    const user = userEvent.setup()
    render(<App />)

    // 5 + 3 = 8
    await user.click(screen.getByRole('button', { name: '5' }))
    await user.click(screen.getByRole('button', { name: '+' }))
    await user.click(screen.getByRole('button', { name: '3' }))
    await user.click(screen.getByRole('button', { name: '=' }))

    expect(screen.getByText('8')).toBeInTheDocument()
  })
})
```

### Priority 3: Git Hooks (1 hour)

**Add husky Configuration**

File: `packages/agents/scaffold-agent/templates/config/.husky/pre-commit.hbs`

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

pnpm typecheck
pnpm lint
pnpm test
```

### Priority 4: API Pattern Templates (3-4 hours)

**Create Fastify API Template with All Patterns**

File: `packages/agents/scaffold-agent/templates/app/fastify-api/src/server.ts.hbs`

```typescript
import Fastify from 'fastify'
import { PrismaClient } from '@prisma/client'
import { userRouter } from './routes/user.routes'
import { healthRouter } from './routes/health.routes'

const fastify = Fastify({ logger: true })
export const prisma = new PrismaClient()

// Routes
fastify.register(healthRouter, { prefix: '/api/health' })
fastify.register(userRouter, { prefix: '/api/users' })

// Error handling
fastify.setErrorHandler((error, request, reply) => {
  fastify.log.error(error)
  reply.status(500).send({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error'
    }
  })
})

export async function start() {
  try {
    await fastify.listen({ port: 3000, host: '0.0.0.0' })
    console.log('Server started on http://0.0.0.0:3000')
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}
```

**Health Check Routes Template**

File: `packages/agents/scaffold-agent/templates/app/fastify-api/src/routes/health.routes.ts.hbs`

```typescript
import { FastifyPluginAsync } from 'fastify'
import { successResponse } from '../utils/response'

export const healthRouter: FastifyPluginAsync = async (fastify) => {
  fastify.get('/live', async (request, reply) => {
    return reply.status(200).send(
      successResponse({ status: 'alive' })
    )
  })

  fastify.get('/ready', async (request, reply) => {
    try {
      // Check database connectivity
      await fastify.prisma.$queryRaw`SELECT 1`
      return reply.status(200).send(
        successResponse({ status: 'ready' })
      )
    } catch (error) {
      return reply.status(503).send({
        success: false,
        error: { code: 'SERVICE_UNAVAILABLE', message: 'Database unavailable' }
      })
    }
  })
}
```

**Zod Validation Schema Template**

File: `packages/agents/scaffold-agent/templates/app/fastify-api/src/schemas/user.schema.ts.hbs`

```typescript
import { z } from 'zod'

export const createUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  role: z.enum(['admin', 'user']).default('user')
})

export type CreateUserInput = z.infer<typeof createUserSchema>

export const updateUserSchema = createUserSchema.partial()
export type UpdateUserInput = z.infer<typeof updateUserSchema>
```

**Response Helpers Template**

File: `packages/agents/scaffold-agent/templates/app/fastify-api/src/utils/response.ts.hbs`

```typescript
export function successResponse<T>(data: T) {
  return {
    success: true,
    data
  }
}

export function errorResponse(
  code: string,
  message: string,
  details?: any
) {
  return {
    success: false,
    error: {
      code,
      message,
      ...(details && { details })
    }
  }
}
```

### Priority 5: Full-Stack Template (4-5 hours)

**Create Template for React SPA + Fastify API**

Files needed:
- `templates/app/fullstack-spa-api/package.json.hbs` (monorepo setup)
- `templates/app/fullstack-spa-api/frontend/src/App.tsx.hbs`
- `templates/app/fullstack-spa-api/api/src/server.ts.hbs`
- `templates/app/fullstack-spa-api/prisma/schema.prisma.hbs`
- `templates/app/fullstack-spa-api/.env.example.hbs`

---

## Part 7: Enhanced Scaffold-Agent Detection Logic

### Current Detection
```typescript
const isCalculator = projectType === 'app' &&
  (task.payload.name?.toLowerCase().includes('calculator') ||
   task.payload.requirements.some(req => req.toLowerCase().includes('calculator')))
```

### Proposed Enhanced Detection
```typescript
// Determine app type from requirements
const requirements = Array.isArray(task.payload.requirements)
  ? task.payload.requirements
  : [task.payload.requirements]

const requirementsLower = requirements
  .join(' ')
  .toLowerCase()

const isCalculator = requirementsLower.includes('calculator')
const hasApi = requirementsLower.includes('api') ||
               requirementsLower.includes('backend') ||
               requirementsLower.includes('server')
const hasDatabase = requirementsLower.includes('database') ||
                   requirementsLower.includes('prisma') ||
                   requirementsLower.includes('store data')
const isFullStack = hasApi && (
  requirementsLower.includes('react') ||
  requirementsLower.includes('frontend') ||
  requirementsLower.includes('spa')
)

// Template selection logic
if (isCalculator) {
  // Use calculator-slate templates
} else if (isFullStack) {
  // Use fullstack-spa-api templates
} else if (hasApi) {
  // Use fastify-api templates
} else if (requirementsLower.includes('react')) {
  // Use react-spa templates
} else {
  // Use default templates
}
```

---

## Part 8: Implementation Roadmap

### Phase 1: Quality Improvements (Week 1)
- [ ] Add ESLint configuration template
- [ ] Add Prettier configuration template
- [ ] Add husky git hooks template
- [ ] Update calculator template with quality gates
- **Time:** 2-3 hours
- **Impact:** +2 quality gates (linting, pre-commit checks)

### Phase 2: Testing Framework (Week 1)
- [ ] Add Vitest configuration template
- [ ] Add test setup for React SPA
- [ ] Create calculator test template
- [ ] Add test examples to documentation
- **Time:** 3-4 hours
- **Impact:** +1 quality gate (tests & coverage)

### Phase 3: API Patterns (Week 2)
- [ ] Create Fastify API template
- [ ] Add health check routes
- [ ] Add Zod validation schemas
- [ ] Add response envelope helpers
- [ ] Create example controllers/services
- **Time:** 4-5 hours
- **Impact:** Full API pattern compliance

### Phase 4: Database Integration (Week 2)
- [ ] Create Prisma schema template
- [ ] Add database migration scripts
- [ ] Create example models
- [ ] Add .env.example template
- **Time:** 3-4 hours
- **Impact:** Database isolation & ORM compliance

### Phase 5: Full-Stack Template (Week 3)
- [ ] Create monorepo structure template
- [ ] Combine React + Fastify + Prisma
- [ ] Add Docker Compose for local dev
- [ ] Add comprehensive documentation
- **Time:** 4-5 hours
- **Impact:** End-to-end Zyp-compliant generation

---

## Part 9: Compliance Matrix

### Current State
```
Calculator:    71% (5/7)  - Code complete, quality gates missing
Scaffold-Agent: 58% (4/7) - Template generation, testing missing
```

### After Phase 1 (Quality)
```
Calculator:    86% (6/7)  - ESLint + pre-commit
Scaffold-Agent: 73% (5/7) - Template + quality config
```

### After Phase 2 (Testing)
```
Calculator:    100% (7/7) - All quality gates
Scaffold-Agent: 86% (6/7) - Templates + tests
```

### After Phase 5 (Full-Stack)
```
Calculator:    100% (7/7) - Complete SPA example
Fastify API:   100% (7/7) - Complete API example
Full-Stack:    100% (7/7) - Complete end-to-end example
Scaffold-Agent: 100% (7/7) - All patterns, all templates
```

---

## Part 10: Next Session Action Items

### Immediate (Session #16)
- [ ] Review and approve enhancement recommendations
- [ ] Prioritize template development order
- [ ] Identify any additional Zyp patterns needed

### Short-term (Session #17)
- [ ] Implement Phase 1 (ESLint, Prettier, husky)
- [ ] Update calculator template with quality gates
- [ ] Run quality gates on generated apps

### Medium-term (Sessions #18-19)
- [ ] Implement Phase 2 (Vitest, test templates)
- [ ] Create API pattern templates
- [ ] Implement database templates

### Long-term (Sessions #20+)
- [ ] Create full-stack template
- [ ] Comprehensive pattern documentation
- [ ] Integration testing with pipeline

---

## Summary

The current scaffold-agent and calculator template are **well-founded on Zyp platform principles** (frozen versions, exact pinning, TypeScript strict). To achieve **100% compliance**, focus should be on:

1. **Quality Gates** - Add ESLint, Prettier, git hooks
2. **Testing** - Add Vitest setup with 80% coverage requirement
3. **API Patterns** - Create Fastify templates with envelope responses
4. **Database** - Add Prisma ORM and schema templates
5. **Full-Stack** - Combine all patterns in comprehensive template

This roadmap ensures that the scaffold-agent generates **production-grade, Zyp-compliant applications** that follow all platform policies and patterns.
