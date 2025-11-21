# STRATEGIC ARCHITECTURE - Layered Platform with Surface Abstractions

**Version:** 1.0.0 | **Date:** 2025-11-16 | **Status:** Strategic Vision Document

---

## Executive Summary

This document describes a **layered platform architecture with surface abstractions** that enables:

- **Multiple independent platforms** (Web Apps, Data Pipelines, Mobile Apps, Infrastructure)
- **Each platform** with its own workflow definitions, agent types, and execution semantics
- **Multiple surfaces** (REST API, GitHub Webhooks, CLI, Dashboard) for triggering and visualizing workflows
- **Clear separation of concerns** between core orchestration (hexagonal), platform-specific logic, and surface presentations
- **Reusable mock testing** using a single GenericMockAgent registered multiple times across platforms

**Current State:** Single platform with hard-coded workflow types (app, feature, bugfix)

**Vision:** Enterprise-grade multi-platform SDLC automation where each team/domain has its own platform definition and surfaces

---

## Conceptual Layers (Bottom to Top)

```
┌────────────────────────────────────────────────────────────────┐
│ SURFACE LAYER (API/UX Presentations)                           │
│ ├─ REST API Surface           (/api/v1/platforms/{id}/...)     │
│ ├─ GitHub Webhook Surface     (GitHub events → workflows)      │
│ ├─ CLI Surface                (orchestrator-cli create-workflow)│
│ ├─ Dashboard Surface          (Real-time visualization)        │
│ └─ Mobile API Surface         (Mobile app integration)         │
└────────────────────────────────────────────────────────────────┘
                 ↓ (SurfaceRouterService)
┌────────────────────────────────────────────────────────────────┐
│ PLATFORM ORCHESTRATION LAYER (Workflow Engines)                │
│ ├─ App Platform Workflow Engine (web, mobile code generation)  │
│ ├─ Data Pipeline Platform Workflow Engine (ETL, ML, analytics) │
│ ├─ Infrastructure Platform Workflow Engine (Terraform, K8s)    │
│ └─ Enterprise Platform Workflow Engine (Governance, compliance) │
└────────────────────────────────────────────────────────────────┘
                 ↓ (WorkflowEngine, state machine)
┌────────────────────────────────────────────────────────────────┐
│ AGENT LAYER (Specialized Executors)                            │
│ ├─ App Agents (scaffold, validate, test-web, deploy-web)      │
│ ├─ Data Agents (ingest, transform, validate-data, load)       │
│ ├─ Mobile Agents (scaffold-mobile, build-ios, build-android)  │
│ └─ Infrastructure Agents (provision, configure, monitor)      │
└────────────────────────────────────────────────────────────────┘
                 ↓ (Redis Streams + Consumer Groups)
┌────────────────────────────────────────────────────────────────┐
│ HEXAGONAL CORE LAYER (Ports & Adapters)                        │
│ ├─ IMessageBus (Port)         → RedisStreamsAdapter            │
│ ├─ IKVStore (Port)            → RedisKVAdapter                 │
│ ├─ IPersistence (Port)        → PostgresAdapter                │
│ └─ Event Envelopes, Retry Logic, Idempotency, Tracing         │
└────────────────────────────────────────────────────────────────┘
                 ↓
┌────────────────────────────────────────────────────────────────┐
│ INFRASTRUCTURE LAYER (External Services)                       │
│ ├─ Redis 7+ (Message Bus, State Store, Consumer Groups)        │
│ ├─ PostgreSQL 16+ (Workflows, Traces, Tasks, Platforms)        │
│ ├─ Claude API (Code Generation, Intelligence, Routing)         │
│ ├─ AWS Services (ECS, ECR, Lambda, CloudFormation)             │
│ ├─ GitHub/GitLab (SCM, Webhooks, PR Management, Auth)          │
│ └─ Monitoring (CloudWatch, Datadog, New Relic)                 │
└────────────────────────────────────────────────────────────────┘
```

---

## Platform Concept

### Definition

A **Platform** is a self-contained workflow execution domain with:
1. **Workflow Definitions** - Set of reusable workflow templates (YAML/JSON)
2. **Agent Types** - Specialized executors for that platform's stages
3. **Surface Bindings** - Which surfaces trigger workflows on this platform
4. **Layer Classification** - Conceptual layer (APPLICATION, DATA, INFRASTRUCTURE)
5. **Configuration** - Platform-specific settings and constraints

### Platform 1: Web Applications (APPLICATION Layer)
- **Workflows:** react-app (6 stages), vue-app (6 stages), nextjs-app (7 stages)
- **Agents:** web-init, web-ui-generator, web-api-generator, web-validator, web-e2e-tester, web-deployer, error-notifier
- **Surfaces:** REST API, GitHub Webhook, Dashboard
- **Progress:** 14-17% per stage
- **Duration:** 3-5 minutes

### Platform 2: Data Pipelines (DATA Layer)
- **Workflows:** etl-pipeline (5 stages), analytics-pipeline (6 stages), ml-training-pipeline (7 stages)
- **Agents:** data-ingester, data-transformer, data-aggregator, data-validator, data-loader, data-preparer, feature-engineer, ml-trainer, model-validator, model-evaluator, model-deployer, pipeline-monitor
- **Surfaces:** REST API, Kafka Events, Data Catalog, CLI
- **Progress:** 14-20% per stage
- **Duration:** 5-30 minutes

### Platform 3: Mobile Applications (APPLICATION Layer)
- **Workflows:** ios-app (7 stages), android-app (7 stages), react-native-app (7 stages)
- **Agents:** mobile-init, mobile-scaffold, ios-ui-generator, android-ui-generator, rn-ui-generator, mobile-api-generator, mobile-validator, ios-builder, android-builder, rn-builder, ios-deployer, android-deployer, rn-deployer
- **Surfaces:** REST API, App Store Connect Webhook, Mobile Dashboard, CLI
- **Progress:** 14% per stage
- **Duration:** 5-15 minutes

### Platform 4: Infrastructure as Code (INFRASTRUCTURE Layer)
- **Workflows:** terraform-module (5 stages), kubernetes-deployment (6 stages), aws-cloudformation-stack (7 stages)
- **Agents:** iac-planner, iac-validator, iac-provisioner, iac-tester, iac-monitor, k8s-planner, k8s-validator, docker-builder, registry-pusher, k8s-deployer, k8s-monitor, cfn-designer, cfn-validator, cfn-creator, cfn-tester, cfn-updater, cfn-deployer, cfn-monitor
- **Surfaces:** REST API, CloudFormation Webhook, GitHub Webhook, IaC Dashboard, CLI
- **Progress:** 14-20% per stage
- **Duration:** 2-10 minutes

---

## Surface Concept

### Surface Types

#### 1. REST API Surface
- **Endpoint:** `POST /api/v1/platforms/{platform_id}/workflows`
- **WebSocket:** Real-time updates via `wss://api.example.com/api/v1/workflows/{workflow_id}/stream`
- **Response:** Full workflow response with trace_id, status, progress
- **Users:** Dashboard, third-party tools, automation systems

#### 2. GitHub Webhook Surface
- **Trigger:** GitHub push, pull_request, workflow_dispatch events
- **Auto-detect:** Repository name pattern → Platform, package.json → workflow type
- **GitHub Status:** Commit status, PR checks, PR comments
- **Users:** Development teams, CI/CD pipelines

#### 3. CLI Surface
- **Command:** `orchestrator-cli [platform] [command] [options]`
- **Examples:**
  - `orchestrator-cli web-apps create-workflow react-app --name "My App"`
  - `orchestrator-cli data-pipelines watch etl-pipeline-123`
  - `orchestrator-cli mobile-apps list-workflows`
- **Users:** DevOps, platform operators, developers

#### 4. Dashboard Surface
- **Features:** Visual workflow builder, real-time progress, artifact browser
- **Platform-specific:** Different layouts per platform layer
- **Real-time:** WebSocket updates, live logs, trace timeline
- **Users:** All users, monitoring, troubleshooting

#### 5. Mobile API Surface
- **Endpoints:** Mobile-optimized REST endpoints
- **Features:** Push notifications, smaller payloads, polling support
- **Users:** Mobile apps, lightweight clients

---

## Testing Strategy

### Multi-Platform Mock Testing

**Objective:** Test two complete workflows across two platforms in parallel using one GenericMockAgent class registered multiple times.

**Setup:**
```
GenericMockAgent: Single class, registered 11 times
  Platform 1 (Web Apps):    web-init, web-ui-gen, web-api-gen, web-validator, web-tester, web-deployer (6)
  Platform 2 (Data):        data-ingest, data-transform, data-validate, data-load, monitor (5)

Platforms: web-apps (6 agents, 16.7% per stage), data-pipelines (5 agents, 20% per stage)
Execution: Both workflows run in parallel with independent traces and progress
Total time: ~10-15 seconds (mock delays only)
```

**Verification:**
- ✓ Each workflow completes with correct status
- ✓ Stages executed in correct order per platform
- ✓ Progress calculated correctly per platform (adaptive to stage count)
- ✓ Traces independent per workflow
- ✓ Logging shows both workflows
- ✓ Database records both workflows correctly
- ✓ Dashboard shows different progress rates per platform

---

## Directory Structure

```
packages/orchestrator/src/
├── hexagonal/              ← Core (unchanged)
│   ├── core/
│   ├── ports/
│   ├── adapters/
│   ├── persistence/
│   └── bootstrap.ts
│
├── platforms/              ← NEW: Platform definitions
│   ├── web-apps/
│   │   ├── workflows/
│   │   │   ├── react-app.yaml
│   │   │   ├── vue-app.yaml
│   │   │   └── nextjs-app.yaml
│   │   ├── agents/
│   │   └── config.ts
│   ├── data-pipelines/
│   │   ├── workflows/
│   │   │   ├── etl-pipeline.yaml
│   │   │   ├── analytics-pipeline.yaml
│   │   │   └── ml-training-pipeline.yaml
│   │   ├── agents/
│   │   └── config.ts
│   ├── mobile-apps/
│   │   ├── workflows/
│   │   ├── agents/
│   │   └── config.ts
│   └── infrastructure/
│       ├── workflows/
│       ├── agents/
│       └── config.ts
│
├── surfaces/               ← NEW: Surface adapters
│   ├── rest-api.surface.ts
│   ├── github-webhook.surface.ts
│   ├── cli.surface.ts
│   ├── dashboard-ws.surface.ts
│   └── mobile-api.surface.ts
│
├── services/               ← Enhanced services
│   ├── workflow.service.ts (platform-aware)
│   ├── platform.service.ts (NEW)
│   ├── surface-router.service.ts (NEW)
│   └── workflow-engine.service.ts (NEW)
│
└── api/routes/
    ├── platforms.routes.ts (NEW)
    ├── surfaces.routes.ts (NEW)
    └── workflows.routes.ts (updated)
```

---

## Database Schema

### New Tables

**Platform**
```
id              UUID
name            String (unique)
layer           String (APPLICATION|DATA|INFRASTRUCTURE|ENTERPRISE)
description     String
config          JSON (timeout_ms, max_parallel_stages, retry_strategy)
created_at      DateTime
updated_at      DateTime
```

**WorkflowDefinition**
```
id              UUID
platform_id     UUID (foreign key)
name            String (react-app, etl-pipeline, etc.)
version         String
description     String
definition      JSON (complete WorkflowDefinitionSchema)
created_at      DateTime
updated_at      DateTime
(unique: platform_id + name)
```

**PlatformSurface**
```
id              UUID
platform_id     UUID (foreign key)
surface_type    String (REST|WEBHOOK|CLI|DASHBOARD|MOBILE_API)
config          JSON (surface-specific config)
enabled         Boolean
created_at      DateTime
updated_at      DateTime
(unique: platform_id + surface_type)
```

### Modified Tables

**Workflow (Updated)**
```
+ platform_id              UUID (foreign key)
+ workflow_definition_id   UUID
+ surface_id               UUID (optional)
+ input_data               JSON
+ layer                    String (inherited from platform)
- type                     (enum removed: app|feature|bugfix)
```

**Agent (Updated)**
```
+ platform_id              UUID (optional, NULL = global agent)
```

---

## Implementation Roadmap

### Phase 1: Core Platform Infrastructure (Weeks 1-2)
- Create Platform, WorkflowDefinition, PlatformSurface tables
- Implement PlatformLoader and PlatformRegistry
- Update Workflow schema with platform_id, workflow_definition_id
- Create "legacy-platform" for backward compatibility

### Phase 2: Surface Abstraction (Weeks 2-3)
- Implement SurfaceRouter
- Create REST, GitHub Webhook, CLI surface adapters
- Update API routes for platform endpoints
- Maintain backward compatibility with existing API

### Phase 3: Workflow Engine Integration (Weeks 3-4)
- Update WorkflowStateMachineService for definition-driven stages
- Use WorkflowEngine to compute next stage (definition-driven, not hard-coded)
- Implement adaptive progress calculation per platform
- Add support for conditional routing (on_success, on_failure)

### Phase 4: Platform-Specific Agents (Weeks 4-5)
- Update AgentRegistry for platform-scoped agents
- Implement agent lookup with platform context
- Enable both global and platform-specific agents

### Phase 5: Dashboard & Monitoring (Weeks 5-6)
- Create PlatformsPage, update WorkflowsPage
- Add SurfaceIndicator, PlatformSelector components
- Create platform-specific workflow builders
- Update API client with platform endpoints

### Phase 6: Testing Infrastructure (Weeks 6-7)
- Create GenericMockAgent class
- Implement multi-platform test setup
- Create comprehensive test suite for parallel execution

### Phase 7: Documentation & Graduation (Weeks 7-8)
- Create platform definition templates
- Create surface adapter templates
- Document platform onboarding
- Update architecture documentation

---

## Key Benefits

✅ **Multiple independent platforms** with different domains
✅ **Multiple surfaces** for different user types and workflows
✅ **Reusable mock testing** with single GenericMockAgent (11+ registrations)
✅ **Clear separation of concerns** between layers
✅ **Backward compatible** with existing workflows via legacy platform
✅ **Enterprise-grade flexibility** for multi-team SDLC automation
✅ **Dynamic workflow definitions** (YAML, no code changes to add new workflows)
✅ **Adaptive progress** (automatically scales to stage count)
✅ **Platform-scoped agents** (flexibility in agent management)
✅ **Production-ready** multi-tenant architecture

---

## Summary

**Workflows** define what to automate (stages, sequencing).
**Platforms** define domains (web apps, data, mobile, infrastructure).
**Surfaces** define how users interact (REST, webhooks, CLI, dashboard).

This **Layered Platform Architecture with Surface Abstractions** separates these concerns cleanly while reusing the hexagonal core infrastructure for all platforms and surfaces.
