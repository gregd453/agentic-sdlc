# Iterative Implementation Plan
## Zyp-Compliant Hello World App Generation

**Goal:** Evolve the existing scaffold-agent to generate hello world apps that strictly comply with Zyp platform policies

**Current State:**
- ✅ Scaffold-agent generates React SPAs successfully
- ⚠️ Uses React 18.2 with version ranges (^)
- ❌ No backend generation capability
- ❌ Not compliant with Zyp frozen versions

---

## Iteration 1: Frontend Compliance (Day 1)
**Goal:** Update existing React templates to match Zyp policies

### Tasks
1. **Update React SPA templates** [2 hours]
   ```bash
   cd packages/agents/scaffold-agent/templates/app
   ```
   - Modify `react-spa/package.json.hbs`:
     - React: `^18.2.0` → `19.2.0` (exact)
     - Vite: `^5.2.0` → `6.0.11` (exact)
     - TypeScript: `^5.2.2` → `5.4.5` (exact)
     - Remove all ^ and ~ prefixes

   - Update other templates for compatibility with React 19

2. **Test frontend generation** [1 hour]
   ```bash
   # Start infrastructure
   docker-compose up -d postgres redis

   # Start orchestrator & agent
   pnpm --filter @agentic-sdlc/orchestrator dev
   cd packages/agents/scaffold-agent && node dist/run-agent.js

   # Generate test app
   curl -X POST http://localhost:3000/api/v1/workflows \
     -H "Content-Type: application/json" \
     -d '{"type":"app","name":"test-zyp-frontend","requirements":"React 19.2.0 app"}'
   ```

3. **Validate compliance** [30 min]
   - Check generated package.json has exact versions
   - Verify app builds with new versions
   - Ensure no TypeScript errors

### Success Criteria
- ✅ Generated React app uses exact versions
- ✅ React 19.2.0, Vite 6.0.11, TypeScript 5.4.5
- ✅ App builds and runs successfully

### Deliverable
- `/tmp/agentic-sdlc-output/*/test-zyp-frontend/` with compliant React app

---

## Iteration 2: Basic Backend Templates (Day 1-2)
**Goal:** Add Fastify backend generation capability

### Tasks
1. **Create backend template structure** [2 hours]
   ```bash
   mkdir -p packages/agents/scaffold-agent/templates/backend/fastify-api
   ```
   Create templates:
   - `package.json.hbs`
   - `tsconfig.json.hbs`
   - `src/server.ts.hbs`
   - `src/types/envelope.ts.hbs`
   - `.env.example.hbs`

2. **Implement Fastify server template** [2 hours]
   - Basic Fastify 5.6.1 setup
   - Health check endpoint
   - CORS configuration
   - Envelope pattern types
   - Graceful shutdown

3. **Add backend generation logic** [2 hours]
   ```typescript
   // In scaffold-agent.ts
   if (task.type === 'backend' || task.type === 'fullstack') {
     await this.generateBackend(task);
   }
   ```

4. **Test backend generation** [1 hour]
   ```bash
   curl -X POST http://localhost:3000/api/v1/workflows \
     -H "Content-Type: application/json" \
     -d '{"type":"backend","name":"test-backend","requirements":"Fastify API"}'
   ```

### Success Criteria
- ✅ Backend generates with Fastify 5.6.1 (exact version)
- ✅ Server starts on port 3000
- ✅ Health endpoint returns envelope format
- ✅ TypeScript compiles without errors

### Deliverable
- Standalone Fastify backend in `/tmp/agentic-sdlc-output/*/test-backend/`

---

## Iteration 3: Database Integration (Day 2-3)
**Goal:** Add Prisma ORM and PostgreSQL setup

### Tasks
1. **Create Prisma templates** [2 hours]
   - `prisma/schema.prisma.hbs`
   - `src/lib/prisma.ts.hbs`
   - `docker-compose.yml.hbs`
   - Migration setup scripts

2. **Add HelloMessage model** [1 hour]
   ```prisma
   model HelloMessage {
     id        String   @id @default(uuid())
     message   String
     count     Int      @default(0)
     createdAt DateTime @default(now())
     updatedAt DateTime @updatedAt
   }
   ```

3. **Create service layer** [2 hours]
   - `src/services/hello.service.ts.hbs`
   - CRUD operations using Prisma
   - No raw SQL

4. **Add Zod validation** [1 hour]
   - `src/schemas/hello.schema.ts.hbs`
   - Request/response validation
   - Zod 3.23.0 exact version

5. **Test database integration** [1 hour]
   ```bash
   cd /tmp/agentic-sdlc-output/*/test-backend/
   docker-compose up -d
   npm run db:migrate
   npm run dev
   ```

### Success Criteria
- ✅ Prisma 5.14.0 connects to PostgreSQL
- ✅ Migrations run successfully
- ✅ CRUD operations work through Prisma
- ✅ Zod validates all inputs
- ✅ NO raw SQL in codebase

### Deliverable
- Backend with working database layer

---

## Iteration 4: Full-Stack Integration (Day 3-4)
**Goal:** Generate complete full-stack hello world app

### Tasks
1. **Create full-stack template type** [2 hours]
   ```typescript
   // New template structure
   templates/
   ├── fullstack/
   │   ├── frontend/  (React templates)
   │   ├── backend/   (Fastify templates)
   │   └── root/      (docker-compose, README)
   ```

2. **Add API client to frontend** [2 hours]
   - `src/api/client.ts.hbs`
   - Typed API calls
   - Error handling with envelope pattern
   - Environment configuration

3. **Implement full-stack generation** [3 hours]
   ```typescript
   async generateFullStack(task: ScaffoldTask) {
     await this.generateBackend(task);
     await this.generateFrontend(task);
     await this.generateIntegration(task);
   }
   ```

4. **Create integration test** [2 hours]
   ```bash
   # Generate full-stack app
   curl -X POST http://localhost:3000/api/v1/workflows \
     -H "Content-Type: application/json" \
     -d '{
       "type":"fullstack",
       "name":"hello-world-zyp",
       "requirements":"Full-stack hello world with React and Fastify"
     }'
   ```

5. **End-to-end validation** [1 hour]
   - Start PostgreSQL
   - Run migrations
   - Start backend
   - Start frontend
   - Verify API communication

### Success Criteria
- ✅ Complete full-stack app generated
- ✅ Frontend calls backend API
- ✅ Data persists in PostgreSQL
- ✅ All Zyp policies followed

### Deliverable
- Working full-stack hello world at `/tmp/agentic-sdlc-output/*/hello-world-zyp/`

---

## Iteration 5: Authentication Stub (Day 4)
**Goal:** Add auth pattern compliance (no JWT signing)

### Tasks
1. **Add auth middleware template** [2 hours]
   - `src/middleware/auth.ts.hbs`
   - Trust `x-user-id` header
   - Return sessionPayload (not JWT)

2. **Create auth service stub** [1 hour]
   - `src/services/auth.service.ts.hbs`
   - Session payload creation
   - NO jsonwebtoken dependency

3. **Add protected route example** [1 hour]
   - Protected hello endpoint
   - User context in service layer

### Success Criteria
- ✅ Auth pattern without JWT signing
- ✅ sessionPayload returned for Shell-BFF
- ✅ Protected routes work with x-user-id

---

## Iteration 6: Production Polish (Day 5)
**Goal:** Add production-ready features

### Tasks
1. **Add comprehensive tests** [3 hours]
   - Unit test templates
   - Integration test setup
   - Coverage configuration

2. **Enhanced error handling** [2 hours]
   - Global error handler
   - Structured logging
   - Request ID tracking

3. **Performance optimizations** [1 hour]
   - Connection pooling config
   - Build optimizations
   - Environment-specific configs

4. **Documentation generation** [1 hour]
   - API documentation
   - Setup instructions
   - Architecture diagram

### Success Criteria
- ✅ Tests included and passing
- ✅ Production-ready configuration
- ✅ Comprehensive documentation

---

## Implementation Schedule

### Week 1
- **Monday**: Iteration 1 (Frontend Compliance)
- **Tuesday**: Iteration 2 (Backend Templates)
- **Wednesday**: Iteration 3 (Database Integration)
- **Thursday**: Iteration 4 (Full-Stack Integration)
- **Friday**: Iteration 5 & 6 (Auth & Polish)

### Daily Routine
1. **Morning** (2 hours): Implementation
2. **Midday** (1 hour): Testing & Validation
3. **Afternoon** (2 hours): Refinement & Documentation
4. **End of Day** (30 min): Commit & Summary

---

## Testing Protocol

### For Each Iteration
1. **Unit Test**: Component works in isolation
2. **Integration Test**: Component integrates with system
3. **Compliance Test**: Follows Zyp policies
4. **End-to-End Test**: Full workflow succeeds

### Validation Checklist
```bash
# After each iteration
✓ No version ranges (^, ~) in package.json
✓ Exact versions match Zyp requirements
✓ TypeScript compiles without errors
✓ No raw SQL queries
✓ No JWT signing in app
✓ Envelope pattern used
✓ Zod validation at boundaries
✓ Database isolation maintained
```

---

## Quick Start Commands

### Setup
```bash
# Clone and setup
cd /Users/Greg/Projects/apps/zyp/agent-sdlc
pnpm install
docker-compose up -d postgres redis
```

### Run System
```bash
# Terminal 1: Orchestrator
pnpm --filter @agentic-sdlc/orchestrator dev

# Terminal 2: Scaffold Agent
cd packages/agents/scaffold-agent
pnpm build  # If needed
node dist/run-agent.js
```

### Generate Apps
```bash
# Iteration 1: Frontend only
./scripts/test-iteration-1.sh

# Iteration 2: Backend only
./scripts/test-iteration-2.sh

# Iteration 3: Backend with DB
./scripts/test-iteration-3.sh

# Iteration 4: Full-stack
./scripts/test-iteration-4.sh

# Final: Production-ready
./scripts/test-final.sh
```

### Verify Results
```bash
# Check generated files
ls -la /tmp/agentic-sdlc-output/

# Test generated app
cd /tmp/agentic-sdlc-output/[workflow-id]/[app-name]
npm install
npm run dev
```

---

## Risk Mitigation

### Potential Issues
1. **Version Conflicts**
   - Solution: Test each version upgrade individually
   - Fallback: Use compatibility layers

2. **Template Complexity**
   - Solution: Start simple, iterate
   - Fallback: Manual template adjustments

3. **Integration Failures**
   - Solution: Comprehensive error handling
   - Fallback: Step-by-step debugging

### Rollback Plan
- Git branch for each iteration
- Tag working versions
- Keep original templates as backup

---

## Success Metrics

### Iteration Success
- ✅ Each iteration produces working output
- ✅ No regression from previous iteration
- ✅ Compliance with Zyp policies increases

### Overall Success
- ✅ Full-stack app generated in < 1 minute
- ✅ 100% policy compliance
- ✅ Zero manual intervention required
- ✅ App runs successfully first time
- ✅ All tests pass

### Completion Criteria
1. **Working Example**: Hello world app runs
2. **Policy Compliance**: All Zyp rules followed
3. **Reproducible**: Can generate multiple apps
4. **Documented**: Clear instructions provided
5. **Tested**: Validation suite passes

---

## Next Steps After Success

1. **Expand Templates**
   - Next.js apps
   - Microservices
   - GraphQL APIs
   - Event-driven systems

2. **Add Features**
   - CI/CD pipelines
   - Monitoring setup
   - Security scanning
   - Performance testing

3. **Enhance Intelligence**
   - Better requirement parsing
   - Architecture recommendations
   - Code quality analysis
   - Dependency optimization

---

## Appendix: Test Scripts

### test-iteration-1.sh
```bash
#!/bin/bash
echo "Testing Iteration 1: Frontend Compliance"
curl -X POST http://localhost:3000/api/v1/workflows \
  -H "Content-Type: application/json" \
  -d '{
    "type": "app",
    "name": "test-frontend-zyp",
    "description": "Test React 19.2.0 with exact versions",
    "requirements": "Simple React app with Zyp compliance"
  }'
```

### test-iteration-4.sh
```bash
#!/bin/bash
echo "Testing Iteration 4: Full-Stack Integration"
curl -X POST http://localhost:3000/api/v1/workflows \
  -H "Content-Type: application/json" \
  -d '{
    "type": "fullstack",
    "name": "hello-world-zyp",
    "description": "Full-stack hello world app",
    "requirements": "React frontend, Fastify backend, PostgreSQL database, full Zyp compliance"
  }'
```

---

**Document Version:** 1.0.0
**Created:** 2025-11-09
**Status:** Ready for Implementation