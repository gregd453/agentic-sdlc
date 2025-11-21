# EPCC Implementation Plan: Strategic Agent Abstraction Layer

**Phase:** PLAN (Design & Strategy - No Code Implementation)
**Date:** 2025-11-15 (Session #68)
**Target:** Hardening agents layer with plug-and-play patterns, configuration management, and enhanced logging
**Status:** ✅ Plan Complete - Ready for CODE Phase

---

## 📋 Executive Summary

### What We're Building

A **strategic abstraction layer** above BaseAgent that enables:

1. **Agent Registry**: Dynamic agent discovery, instantiation, and lifecycle management
2. **Configuration Manager**: Externalized, externalized agent configuration with validation
3. **Workflow Engine**: Explicit workflow definitions with composable stages
4. **Logger Configuration Service**: Runtime log level management with per-module control
5. **Service Locator**: Pluggable service implementations for agents

### Why It's Needed

**Current State (98% Production Ready):**
- ✅ All agents building and operational
- ✅ Message bus reliable (Redis Streams with proper ACK)
- ✅ Distributed tracing end-to-end
- ⚠️ Agent configuration hardcoded (no runtime flexibility)
- ⚠️ Agent instantiation scattered (no registry)
- ⚠️ Logging not dynamically configurable (no log level control)
- ⚠️ Workflows not composable (hardcoded stage progression)

**Business Impact of Abstraction:**
- Reduce time-to-value for new agent types (50% faster implementation)
- Enable runtime configuration without redeploy (operational efficiency)
- Support multiple workflow variants (business agility)
- Dynamic logging control for production troubleshooting (reduce MTTR)
- Pluggable services for multi-environment deployments (cost optimization)

### Success Criteria

- [ ] **Agent Registry**: Can add new agent type without modifying orchestrator code
- [ ] **Configuration**: Agent capabilities externalized to YAML/JSON, validated at startup
- [ ] **Workflows**: Multiple workflow definitions supported, reusable stages
- [ ] **Logging**: Log levels adjustable per-module without restart (or minimal restart)
- [ ] **Services**: S3 storage optionally swappable with local filesystem
- [ ] **Backward Compatible**: All existing agents work unchanged
- [ ] **Tests Pass**: Vitest unit + integration + E2E pipeline tests all pass
- [ ] **Build Clean**: turbo run build + typecheck with no errors/warnings
- [ ] **Platform Ready**: Deployment via PM2 with health checks passing

### Non-Goals (What We're NOT Doing)

- Not replacing BaseAgent or changing its contract
- Not modifying AgentEnvelopeSchema v2.0.0 structure
- Not rewriting agents (they continue as-is)
- Not implementing full workflow DSL (just composition, not complex logic)
- Not migrating to alternative logging framework (extends Pino, doesn't replace)
- Not supporting distributed agent deployment (single-machine PM2 stays)

---

## 🏗️ Technical Approach

### Architecture Principles

**1. Non-Breaking Layering**
```
┌─────────────────────────────────────────────────┐
│   NEW: Abstraction Layer                        │
│   - Agent Registry                              │
│   - Configuration Manager                       │
│   - Workflow Engine                             │
│   - Logger Service                              │
│   - Service Locator                             │
└─────────────────────────────────────────────────┘
                       ▲
                    (uses)
                       │
┌─────────────────────────────────────────────────┐
│   EXISTING: BaseAgent + Concrete Agents         │
│   (ScaffoldAgent, ValidationAgent, etc.)        │
│   (NO CHANGES TO THIS LAYER)                    │
└─────────────────────────────────────────────────┘
```

**2. Configuration-Driven Architecture**
```
Agent Metadata YAML
  ├── name: "scaffold"
  ├── version: "1.0.0"
  ├── capabilities: [...]
  ├── services:
  │   └── template_engine: { type: "file", path: "..." }
  └── config_schema: { ... }
         ▼
   Agent Registry
      (lookup)
         ▼
   Agent Factory
      (instantiate)
         ▼
   Concrete Agent Instance
      + Configuration object
      + Service instances
      + Logger with configured levels
```

**3. Trace Context Preservation**
```
Orchestrator (trace_id, span_id)
  ├── publish(AgentEnvelope)
  │      └── envelope.trace = { trace_id, span_id, parent_span_id }
  │
  Agent (receives envelope)
  ├── extract trace from envelope.trace
  ├── store in currentTraceContext
  ├── include in ALL logs (via logger middleware)
  │
  Logger Middleware
  ├── check currentTraceContext
  ├── add trace fields to log entry
  ├── apply configured log level filter
  │
  Result (published back)
  ├── include trace_id in AgentResult
```

---

## 📝 Complete Task Breakdown

### Phase 1: Foundation (Shared Packages) - Est. 16 hours

**1.1 Create Agent Registry Package**
- **Task**: packages/shared/agent-registry
- **Files**:
  - src/agent-registry.ts (Registry class)
  - src/agent-metadata.ts (Types and interfaces)
  - src/agent-factory.ts (Factory pattern)
  - src/index.ts (Exports)
  - tests/agent-registry.test.ts (Unit tests)
- **Estimate**: 4 hours
- **Testing**: Unit tests for registry lookup, registration, validation
- **Dependencies**: None (foundational)
- **Acceptance Criteria**:
  - Registry can register agents
  - Registry can lookup agents by type
  - Registry validates agent metadata
  - All tests pass

**1.2 Create Configuration Manager Package**
- **Task**: packages/shared/config-manager
- **Files**:
  - src/config-manager.ts (Configuration loading & validation)
  - src/config-schema.ts (Zod schemas for validation)
  - src/default-configs.ts (Built-in defaults)
  - src/index.ts
  - tests/config-manager.test.ts
- **Estimate**: 4 hours
- **Testing**: Unit tests for loading, override hierarchy, validation
- **Dependencies**: Zod for validation
- **Acceptance Criteria**:
  - Load defaults from package
  - Override from environment variables
  - Override from config file
  - Validate against schema
  - All tests pass

**1.3 Create Logger Configuration Service**
- **Task**: packages/shared/logger-config
- **Files**:
  - src/logger-config.ts (Configuration service)
  - src/configurable-logger.ts (Logger factory with filtering)
  - src/log-level.ts (LogLevel enum & helpers)
  - src/index.ts
  - tests/logger-config.test.ts
  - tests/configurable-logger.test.ts
- **Estimate**: 3 hours
- **Testing**: Unit tests for level checking, module filtering
- **Dependencies**: Pino (existing)
- **Acceptance Criteria**:
  - Logger created with configured level
  - Module-level filtering works
  - Trace context automatically included
  - All tests pass

**1.4 Create Workflow Engine Package**
- **Task**: packages/shared/workflow-engine
- **Files**:
  - src/workflow-engine.ts (Engine class)
  - src/workflow-definition.ts (Types & interfaces)
  - src/workflow-validator.ts (YAML/JSON validation)
  - src/index.ts
  - tests/workflow-engine.test.ts
- **Estimate**: 3 hours
- **Testing**: Unit tests for workflow lookup, stage progression, routing
- **Dependencies**: YAML loader (js-yaml)
- **Acceptance Criteria**:
  - Register workflow definitions
  - Lookup next stage based on status
  - Validate workflow definitions
  - All tests pass

**1.5 Create Service Locator Package**
- **Task**: packages/shared/service-locator
- **Files**:
  - src/service-locator.ts (Registry & factory)
  - src/service-registry.ts (Types)
  - src/service-factories/ (Built-in implementations)
  - src/index.ts
  - tests/service-locator.test.ts
- **Estimate**: 2 hours
- **Testing**: Unit tests for service registration, creation, delegation
- **Dependencies**: None (abstraction only)
- **Acceptance Criteria**:
  - Register service factories
  - Create service instances
  - Support multiple implementations per interface
  - All tests pass

**1.6 Build and Type Check Phase 1**
- **Task**: Verify all Phase 1 packages compile and pass checks
- **Commands**:
  - turbo run build --filter=@agentic-sdlc/agent-registry
  - turbo run build --filter=@agentic-sdlc/config-manager
  - turbo run build --filter=@agentic-sdlc/logger-config
  - turbo run build --filter=@agentic-sdlc/workflow-engine
  - turbo run build --filter=@agentic-sdlc/service-locator
  - turbo run typecheck --filter=@agentic-sdlc/shared/*
- **Estimate**: 1 hour
- **Acceptance Criteria**:
  - Zero compilation errors across all packages
  - Zero type checking errors
  - All imports valid
  - Package exports correct

**1.7 Validate Phase 1 Completion and Update EPCC_PLAN.md**
- **Task**: Document completion of Phase 1 in EPCC_PLAN.md
- **Validation Checklist**:
  - [ ] All 5 packages created in packages/shared/
  - [ ] All source files present (src/*.ts, tests/*.test.ts)
  - [ ] All tests passing (turbo run test --filter=@agentic-sdlc/shared/*)
  - [ ] Coverage > 85% for all packages
  - [ ] Build succeeds for all packages
  - [ ] Type checking passes
  - [ ] No duplicate schemas or utilities
  - [ ] Proper exports via index.ts
  - [ ] Package.json dependencies correct
- **Documentation**:
  - Update EPCC_PLAN.md with: "## Phase 1: Foundation ✅ COMPLETED (Date)"
  - Document any deviations from plan
  - List actual files created
  - Note any blockers or changes made
  - Record actual time spent vs estimate
- **Estimate**: 0.5 hours
- **Acceptance Criteria**:
  - EPCC_PLAN.md updated with completion section
  - All validation checklist items marked complete
  - Any changes/deviations documented

---

### Phase 2: Integration with BaseAgent - Est. 8 hours

**2.1 Extend BaseAgent Constructor for DI**
- **Task**: packages/agents/base-agent/src/base-agent.ts
- **Changes**:
  - Add ConfigurationManager parameter
  - Add LoggerConfigService parameter
  - Add ServiceLocator parameter
  - Apply log level configuration from LoggerConfigService
  - Store service locator for agent use
- **Estimate**: 2 hours
- **Testing**: Unit tests for parameter handling, logger configuration
- **Dependencies**: Phase 1 packages
- **Constraints**: 
  - Don't change execute() signature
  - Don't modify AgentEnvelope handling
  - Don't change message bus subscription
- **Acceptance Criteria**:
  - BaseAgent accepts config parameters
  - Logger uses configured log levels
  - Services accessible to concrete agents
  - All existing tests still pass

**2.2 Update Concrete Agents to Use Service Locator**
- **Task**: Update all 5 agents (scaffold, validation, integration, deployment, e2e)
- **Changes per Agent**:
  - Replace direct service instantiation with ServiceLocator
  - Inject ServiceLocator from BaseAgent
  - Load service configuration from ConfigurationManager
  - Use logger from BaseAgent (already has configured levels)
- **Estimate**: 4 hours (0.8h per agent)
- **Testing**: Agent unit tests still pass with service mocking
- **Dependencies**: Phase 1 + 2.1
- **Files Modified**:
  - scaffold-agent.ts
  - validation-agent.ts
  - integration-agent.ts
  - deployment-agent.ts
  - e2e-agent.ts
- **Acceptance Criteria**:
  - Each agent requests services from locator
  - Configuration applied to each agent
  - All agent unit tests pass
  - E2E pipeline test passes

**2.3 Create Agent Configuration Files**
- **Task**: Add agent-config.yaml to each agent package
- **Files per Agent**:
  - packages/agents/{agent-name}/agent-config.yaml
- **Content**:
  - Agent metadata (name, version, capabilities)
  - Service definitions
  - Default configuration
- **Estimate**: 1.5 hours
- **Dependencies**: Phase 1 (ConfigurationManager)
- **Acceptance Criteria**:
  - Valid YAML format
  - Matches configuration schema
  - Includes all required fields

**2.4 Update Base Agent Tests**
- **Task**: packages/agents/base-agent/tests/base-agent.test.ts
- **Changes**:
  - Mock ConfigurationManager
  - Mock LoggerConfigService
  - Mock ServiceLocator
  - Test DI parameter handling
  - Test log level filtering
- **Estimate**: 0.5 hours
- **Testing**: All tests pass
- **Dependencies**: Phase 1 + 2.1
- **Acceptance Criteria**:
  - All new parameters tested
  - Log level filtering tested
  - Service locator usage tested

**2.5 Build and Type Check Phase 2**
- **Task**: Verify BaseAgent and all concrete agents compile
- **Commands**:
  - turbo run build --filter=@agentic-sdlc/base-agent
  - turbo run build --filter=@agentic-sdlc/scaffold-agent
  - turbo run build --filter=@agentic-sdlc/validation-agent
  - turbo run build --filter=@agentic-sdlc/integration-agent
  - turbo run build --filter=@agentic-sdlc/deployment-agent
  - turbo run build --filter=@agentic-sdlc/e2e-agent
  - turbo run typecheck --filter=@agentic-sdlc/agents/*
- **Estimate**: 1 hour
- **Acceptance Criteria**:
  - All agents compile without errors
  - Type checking passes
  - Tests pass for base-agent
  - All agent unit tests pass

**2.6 Validate Phase 2 Completion and Update EPCC_PLAN.md**
- **Task**: Document completion of Phase 2 in EPCC_PLAN.md
- **Validation Checklist**:
  - [ ] BaseAgent extended with 3 new parameters (ConfigManager, LoggerService, ServiceLocator)
  - [ ] All 5 concrete agents updated to use ServiceLocator
  - [ ] Agent configuration files created (5 files)
  - [ ] BaseAgent tests updated and passing
  - [ ] All concrete agent tests passing
  - [ ] No breaking changes to execute() signature
  - [ ] AgentEnvelope handling unchanged
  - [ ] Build successful for all agent packages
  - [ ] Type checking passes
- **Documentation**:
  - Update EPCC_PLAN.md with: "## Phase 2: BaseAgent Integration ✅ COMPLETED (Date)"
  - Document actual changes made vs planned
  - List all modified files with line counts
  - Note any unexpected issues encountered
  - Record actual time vs estimate
- **Estimate**: 0.5 hours
- **Acceptance Criteria**:
  - EPCC_PLAN.md updated with completion section
  - All validation items marked complete
  - Changes documented

---

### Phase 3: Orchestrator Integration - Est. 12 hours

**3.1 Update OrchestratorContainer for New Services**
- **Task**: packages/orchestrator/src/hexagonal/bootstrap.ts
- **Changes**:
  - Initialize ConfigurationManager
  - Initialize LoggerConfigService
  - Initialize ServiceLocator
  - Initialize AgentRegistry
  - Initialize WorkflowEngine
  - Wire into dependency graph
- **Estimate**: 3 hours
- **Testing**: Unit tests for container initialization
- **Dependencies**: Phase 1 + Phase 2
- **Files Modified**: bootstrap.ts
- **Acceptance Criteria**:
  - All services initialized without errors
  - Services accessible from container
  - Container tests pass

**3.2 Create Workflow Engine Integration**
- **Task**: Integrate WorkflowEngine into state machine
- **Changes**:
  - Load workflow definition at workflow creation
  - Query WorkflowEngine for next stage
  - Pass workflow definition ID to workflow context
  - Use stage definition for agent routing
- **Estimate**: 3 hours
- **Testing**: Integration tests with state machine
- **Dependencies**: Phase 1 + Phase 3.1
- **Files Modified**: 
  - workflow-state-machine.ts
  - workflow orchestrator service
- **Constraints**:
  - Don't change xstate state definitions
  - Keep backward compatible with existing workflows
  - Maintain trace context propagation
- **Acceptance Criteria**:
  - State machine queries workflow engine
  - Next stage computed correctly
  - Fallback to default workflow for existing code

**3.3 Create Agent Instantiation via Registry**
- **Task**: Replace hardcoded agent creation with registry lookup
- **Changes**:
  - Register all 5 agents with AgentRegistry at startup
  - Update orchestrator to use registry.getAgent()
  - Apply configuration to agents
  - Inject services via ServiceLocator
- **Estimate**: 3 hours
- **Testing**: Integration tests with registry
- **Dependencies**: Phase 1 + Phase 3.1
- **Files Modified**: 
  - orchestrator initialization
  - agent startup code
- **Acceptance Criteria**:
  - Agents instantiated via registry
  - Configuration applied
  - Services injected
  - All agents start successfully

**3.4 Create Example Configuration Files**
- **Task**: Example configurations in config/ directory
- **Files**:
  - config/agents.yaml (agent configurations)
  - config/workflows.yaml (workflow definitions)
  - config/logging.yaml (logging configuration)
  - config/services.yaml (service configurations)
- **Estimate**: 1 hour
- **Content**:
  - Default configuration for all agents
  - 2-3 workflow examples (default, quick-validation, etc.)
  - Logging configuration with module-level levels
  - Service configuration examples
- **Dependencies**: Phase 1
- **Acceptance Criteria**:
  - Valid YAML format
  - Documented examples
  - Loads without validation errors

**3.5 Update Orchestrator Tests**
- **Task**: Update orchestrator tests for new DI layer
- **Changes**:
  - Mock new services (ConfigManager, LoggerService, etc.)
  - Test container initialization
  - Test agent instantiation via registry
  - Test workflow engine integration
- **Estimate**: 2 hours
- **Testing**: All tests pass
- **Dependencies**: Phase 3.1-3.4
- **Acceptance Criteria**:
  - Container tests pass
  - Integration tests pass
  - Mocking works correctly

**3.6 Build and Type Check Phase 3**
- **Task**: Verify orchestrator package compiles with all new integrations
- **Commands**:
  - turbo run build --filter=@agentic-sdlc/orchestrator
  - turbo run typecheck --filter=@agentic-sdlc/orchestrator
  - turbo run test --filter=@agentic-sdlc/orchestrator
- **Estimate**: 1 hour
- **Acceptance Criteria**:
  - Orchestrator builds without errors
  - Type checking passes
  - All orchestrator tests pass
  - No warnings in build output

**3.7 Validate Phase 3 Completion and Update EPCC_PLAN.md**
- **Task**: Document completion of Phase 3 in EPCC_PLAN.md
- **Validation Checklist**:
  - [ ] OrchestratorContainer extended with 5 new services
  - [ ] All services initialized and wired correctly
  - [ ] WorkflowEngine integrated into state machine
  - [ ] Agent instantiation via registry working
  - [ ] Configuration files created (4 files)
  - [ ] Orchestrator tests updated and passing
  - [ ] Build successful
  - [ ] Type checking passes
  - [ ] No breaking changes to existing orchestrator APIs
  - [ ] Trace context propagation preserved
- **Documentation**:
  - Update EPCC_PLAN.md with: "## Phase 3: Orchestrator Integration ✅ COMPLETED (Date)"
  - Document actual implementation vs planned
  - List all files modified with impact assessment
  - Note integration points and dependencies
  - Record actual time vs estimate
- **Estimate**: 0.5 hours
- **Acceptance Criteria**:
  - EPCC_PLAN.md updated with completion section
  - All validation items marked complete
  - Implementation documented

---

### Phase 4: Agent Configuration & Metadata - Est. 10 hours

**4.1 Create Agent Metadata Loaders**
- **Task**: Utility to load agent configuration from agent packages
- **Files**:
  - packages/shared/agent-registry/src/agent-loader.ts
- **Functionality**:
  - Load agent-config.yaml from agent packages
  - Parse and validate metadata
  - Create factory functions for agents
  - Register with AgentRegistry
- **Estimate**: 2 hours
- **Testing**: Unit tests for loading and validation
- **Dependencies**: Phase 1
- **Acceptance Criteria**:
  - Load YAML from packages
  - Parse and validate
  - Create factories
  - Tests pass

**4.2 Add Metadata to Each Agent Package**
- **Task**: Create/update agent-config.yaml for each agent
- **Files per Agent**:
  - packages/agents/{agent-name}/agent-config.yaml
- **Content Template**:
```yaml
metadata:
  name: "{agent-name}"
  type: "{agent-type}"
  version: "1.0.0"
  description: "Agent for {purpose}"

capabilities:
  - capability1
  - capability2

config:
  required_fields:
    - field1
    - field2
  optional_fields:
    - field3: default_value

services:
  - name: "service_name"
    type: "ServiceType"
    config:
      property1: value1
```
- **Estimate**: 4 hours (0.8h per agent)
- **Testing**: Metadata validation tests
- **Dependencies**: Phase 1
- **Acceptance Criteria**:
  - All agents have metadata files
  - Valid YAML format
  - Matches schema
  - Loads without errors

**4.3 Create Metadata Export from Orchestrator API**
- **Task**: Add endpoint to orchestrator API for agent discovery
- **Endpoint**: GET /api/agents (returns all registered agents)
- **Response**:
```json
{
  "agents": [
    {
      "type": "scaffold",
      "name": "Scaffold Agent",
      "version": "1.0.0",
      "capabilities": [...],
      "config_schema": {...}
    }
  ]
}
```
- **Estimate**: 2 hours
- **Testing**: API endpoint tests
- **Dependencies**: Phase 3.3
- **Acceptance Criteria**:
  - Endpoint returns all agents
  - Response includes metadata
  - Tests pass

**4.4 Build and Type Check Phase 4**
- **Task**: Verify all Phase 4 components compile
- **Commands**:
  - turbo run build --filter=@agentic-sdlc/agent-registry
  - turbo run build --filter=@agentic-sdlc/orchestrator
  - turbo run typecheck --filter=@agentic-sdlc/agent-registry
  - turbo run typecheck --filter=@agentic-sdlc/orchestrator
- **Estimate**: 1 hour
- **Acceptance Criteria**:
  - All packages compile without errors
  - Type checking passes
  - Agent loader tests pass
  - API endpoint tests pass

**4.5 Validate Phase 4 Completion and Update EPCC_PLAN.md**
- **Task**: Document completion of Phase 4 in EPCC_PLAN.md
- **Validation Checklist**:
  - [ ] Agent metadata loaders created and tested
  - [ ] All 5 agent metadata files created
  - [ ] Metadata files valid YAML and pass schema validation
  - [ ] Orchestrator API endpoint created and tested
  - [ ] Agent discovery endpoint working
  - [ ] Build successful for all packages
  - [ ] Type checking passes
  - [ ] Tests passing (loader, metadata, API)
- **Documentation**:
  - Update EPCC_PLAN.md with: "## Phase 4: Configuration & Metadata ✅ COMPLETED (Date)"
  - Document metadata schema used
  - List all agent metadata files created
  - Document API endpoint behavior
  - Record actual time vs estimate
- **Estimate**: 0.5 hours
- **Acceptance Criteria**:
  - EPCC_PLAN.md updated with completion section
  - All validation items marked complete
  - Metadata structure documented

---

### Phase 5: Enhanced Logging - Est. 8 hours

**5.1 Create Log Level Middleware**
- **Task**: Middleware to apply log level filtering
- **Files**:
  - packages/shared/logger-config/src/log-level-middleware.ts
- **Functionality**:
  - Check module-level log configuration
  - Filter logs below configured level
  - Preserve trace context in filtered logs
  - Support dynamic level updates
- **Estimate**: 2 hours
- **Testing**: Unit tests for filtering logic
- **Dependencies**: Phase 1
- **Acceptance Criteria**:
  - Filters logs correctly
  - Preserves trace context
  - Tests pass

**5.2 Integrate Configurable Logger into BaseAgent**
- **Task**: Replace hardcoded pino logger with configurable version
- **Changes**: 
  - BaseAgent uses LoggerConfigService to create logger
  - Logger applies module-level filtering
  - Trace context automatically included
- **Estimate**: 2 hours
- **Testing**: BaseAgent tests verify logging
- **Dependencies**: Phase 2.1 + Phase 5.1
- **Files Modified**: base-agent.ts
- **Acceptance Criteria**:
  - Configurable logger used
  - Log levels respected
  - All tests pass

**5.3 Create Logging Configuration UI Documentation**
- **Task**: Document how to configure logging
- **Files**:
  - LOGGING_CONFIGURATION_GUIDE.md
- **Content**:
  - How to set global log level
  - How to set per-module level
  - How to enable/disable trace logging
  - Examples for common scenarios
  - Production vs development configuration
- **Estimate**: 1.5 hours
- **Documentation**: In project root
- **Acceptance Criteria**:
  - Clear examples
  - All configuration options documented
  - Common use cases covered

**5.4 Create Logging Tests**
- **Task**: Comprehensive tests for logging configuration
- **Tests**:
  - Log level filtering
  - Trace context inclusion
  - Module-level overrides
  - Configuration loading
  - Dynamic level updates
- **Estimate**: 1.5 hours
- **Testing**: Unit + integration tests
- **Dependencies**: Phase 5.1-5.3
- **Acceptance Criteria**:
  - All logging features tested
  - Tests pass
  - Coverage > 85%

**5.5 Build and Type Check Phase 5**
- **Task**: Verify logging components and BaseAgent compile with changes
- **Commands**:
  - turbo run build --filter=@agentic-sdlc/logger-config
  - turbo run build --filter=@agentic-sdlc/base-agent
  - turbo run typecheck --filter=@agentic-sdlc/logger-config
  - turbo run typecheck --filter=@agentic-sdlc/base-agent
  - turbo run test --filter=@agentic-sdlc/logger-config
  - turbo run test --filter=@agentic-sdlc/base-agent
- **Estimate**: 1 hour
- **Acceptance Criteria**:
  - All packages compile without errors
  - Type checking passes
  - All logging tests pass
  - All base-agent tests pass
  - Coverage meets targets

**5.6 Validate Phase 5 Completion and Update EPCC_PLAN.md**
- **Task**: Document completion of Phase 5 in EPCC_PLAN.md
- **Validation Checklist**:
  - [ ] Log level middleware created and tested
  - [ ] Configurable logger integrated into BaseAgent
  - [ ] Logging configuration guide created
  - [ ] All logging tests passing (85%+ coverage)
  - [ ] Trace context preserved in logs
  - [ ] Module-level filtering working
  - [ ] Build successful
  - [ ] Type checking passes
  - [ ] No performance regression
- **Documentation**:
  - Update EPCC_PLAN.md with: "## Phase 5: Enhanced Logging ✅ COMPLETED (Date)"
  - Document logging configuration options
  - List test coverage achieved
  - Record actual time vs estimate
- **Estimate**: 0.5 hours
- **Acceptance Criteria**:
  - EPCC_PLAN.md updated with completion section
  - All validation items marked complete
  - Logging capabilities documented

---

### Phase 6: Documentation & Hardening - Est. 8 hours

**6.1 Create API Documentation**
- **Task**: Document new configuration and registry APIs
- **Files**:
  - docs/agent-registry-api.md
  - docs/configuration-api.md
  - docs/workflow-engine-api.md
  - docs/service-locator-api.md
- **Estimate**: 2 hours
- **Content**:
  - API endpoints
  - Configuration schemas
  - Examples
  - Error handling

**6.2 Create Migration Guide for Existing Agents**
- **Task**: Guide for how agents adopt new abstraction layer
- **File**: docs/agent-migration-guide.md
- **Content**:
  - Step-by-step migration for new agent types
  - Configuration examples
  - Service injection patterns
  - Testing approach
- **Estimate**: 1.5 hours

**6.3 Update CLAUDE.md with New Patterns**
- **Task**: Add to CLAUDE.md Session #69 section
- **Content**:
  - Architecture rules for new abstraction layer
  - How to create new agents
  - Configuration management rules
  - Logging best practices
  - Workflow composition patterns
- **Estimate**: 1 hour

**6.4 Create Example: New Agent Type**
- **Task**: Implement dummy agent to demonstrate patterns
- **Files**:
  - packages/agents/example-agent/ (complete minimal agent)
- **Content**:
  - Extends BaseAgent properly
  - Uses service locator
  - Loads configuration
  - Tests included
  - Agent metadata file
- **Estimate**: 2 hours
- **Acceptance Criteria**:
  - Compiles
  - Tests pass
  - Can be registered and instantiated
  - Demonstrates all patterns

**6.5 Performance Testing**
- **Task**: Verify abstraction layer doesn't degrade performance
- **Tests**:
  - Agent startup time
  - Message latency
  - Configuration loading time
  - Service instantiation time
- **Estimate**: 1 hour
- **Acceptance Criteria**:
  - No significant performance regression
  - Startup time < 500ms per agent
  - Message latency unchanged

**6.6 Build and Type Check Phase 6**
- **Task**: Verify all Phase 6 documentation and example components
- **Commands**:
  - turbo run build --filter=@agentic-sdlc/example-agent
  - turbo run typecheck --filter=@agentic-sdlc/example-agent
  - turbo run test --filter=@agentic-sdlc/example-agent
  - Verify all documentation files exist and have valid markdown
- **Estimate**: 1 hour
- **Acceptance Criteria**:
  - Example agent builds without errors
  - Type checking passes
  - Example agent tests pass
  - All documentation files valid
  - No broken links in documentation

**6.7 Validate Phase 6 Completion and Update EPCC_PLAN.md**
- **Task**: Document completion of Phase 6 in EPCC_PLAN.md
- **Validation Checklist**:
  - [ ] All API documentation files created (4 files)
  - [ ] Migration guide created and comprehensive
  - [ ] CLAUDE.md updated with Session #69 patterns
  - [ ] Example agent created, tested, and demonstrates all patterns
  - [ ] Performance testing completed with results documented
  - [ ] Example agent builds without errors
  - [ ] Type checking passes
  - [ ] All tests pass
  - [ ] Documentation complete with examples
- **Documentation**:
  - Update EPCC_PLAN.md with: "## Phase 6: Documentation & Hardening ✅ COMPLETED (Date)"
  - Document API endpoints and configurations documented
  - List all documentation files created
  - Record performance test results
  - Document example agent capabilities
  - Record actual time vs estimate
- **Estimate**: 0.5 hours
- **Acceptance Criteria**:
  - EPCC_PLAN.md updated with completion section
  - All validation items marked complete
  - Documentation and examples comprehensive

---

### Phase 7: E2E Validation & Integration - Est. 10 hours

**7.1 Create Comprehensive E2E Pipeline Test**
- **Task**: Full workflow validation with new abstraction layer
- **Test Script**: Extension to run-pipeline-test.sh
- **Scenarios**:
  - Scaffold → Validate → Integration → Deployment → E2E
  - Using configuration from agents.yaml
  - With workflow definition from workflows.yaml
  - Verify trace context propagation
  - Verify log levels respected
- **Estimate**: 3 hours
- **Testing**: ./scripts/run-pipeline-test.sh "Abstraction Layer Integration"
- **Acceptance Criteria**:
  - All stages complete
  - No errors logged
  - Trace IDs correlated correctly

**7.2 Create Vitest Integration Tests**
- **Task**: Integration tests for abstraction layer components
- **Tests**:
  - Registry with multiple agents
  - Configuration manager with hierarchy
  - Workflow engine with conditional routing
  - Logger configuration with module levels
  - Service locator with multiple implementations
  - Full DI container initialization
- **Estimate**: 3 hours
- **Testing**: turbo run test --filter=@agentic-sdlc/*
- **Coverage**: > 85%
- **Acceptance Criteria**:
  - All tests pass
  - Coverage targets met
  - No flaky tests

**7.3 Create Multi-Workflow Test**
- **Task**: Test workflow selection and composition
- **Scenarios**:
  - Register multiple workflows
  - Create workflow with default
  - Create workflow with quick-validation
  - Verify correct stages executed
- **Estimate**: 2 hours
- **Testing**: E2E pipeline test with workflow parameter
- **Acceptance Criteria**:
  - Correct workflow selected
  - Correct stages executed
  - Stage progression correct

**7.4 Verify Backward Compatibility**
- **Task**: Ensure all existing agents still work
- **Tests**:
  - All 5 existing agents start without changes
  - Message bus subscription works
  - Results published correctly
  - Trace context propagated
  - Logging works
- **Estimate**: 2 hours
- **Testing**: E2E pipeline test with existing agents
- **Acceptance Criteria**:
  - All agents functional
  - No breaking changes
  - All tests pass

**7.5 Build and Type Check Phase 7**
- **Task**: Verify all Phase 7 tests compile and pass
- **Commands**:
  - turbo run test (all packages)
  - turbo run build (verify no regressions)
  - turbo run typecheck (verify types still valid)
  - ./scripts/run-pipeline-test.sh "Phase 7 E2E Validation"
- **Estimate**: 1.5 hours
- **Acceptance Criteria**:
  - All tests pass (unit, integration, E2E)
  - Build successful
  - Type checking passes
  - E2E pipeline completes successfully
  - All stages progress correctly

**7.6 Validate Phase 7 Completion and Update EPCC_PLAN.md**
- **Task**: Document completion of Phase 7 in EPCC_PLAN.md
- **Validation Checklist**:
  - [ ] E2E pipeline test created and passing
  - [ ] All integration tests created and passing (85%+ coverage)
  - [ ] Multi-workflow test passing
  - [ ] Backward compatibility verified
  - [ ] All existing agents functional
  - [ ] No breaking changes to existing APIs
  - [ ] Trace context propagation verified end-to-end
  - [ ] Build successful
  - [ ] Type checking passes
  - [ ] All tests passing (unit, integration, E2E)
- **Documentation**:
  - Update EPCC_PLAN.md with: "## Phase 7: E2E Validation & Integration ✅ COMPLETED (Date)"
  - Document E2E test scenarios executed
  - List test coverage percentages
  - Record backward compatibility validation results
  - Document any issues found and resolved
  - Record actual time vs estimate
- **Estimate**: 0.5 hours
- **Acceptance Criteria**:
  - EPCC_PLAN.md updated with completion section
  - All validation items marked complete
  - E2E results documented

---

### Phase 8: Build & Deployment Validation - Est. 6 hours

**8.1 Full Monorepo Build**
- **Task**: Verify all packages build
- **Commands**:
  - turbo run build
  - turbo run typecheck
  - turbo run lint
- **Estimate**: 1.5 hours
- **Acceptance Criteria**:
  - Zero errors
  - Zero warnings (or acceptable technical debt)
  - Build time < 2 minutes

**8.2 Deployment via PM2**
- **Task**: Verify all 7 services start and run
- **Services**: orchestrator + 5 agents + dashboard
- **Commands**:
  - ./scripts/env/start-dev.sh
  - pnpm pm2:status
  - ./scripts/env/check-health.sh
- **Estimate**: 1.5 hours
- **Acceptance Criteria**:
  - All 7 processes running
  - Health checks pass
  - No ERROR logs
  - Dashboard accessible on :3001

**8.3 Configuration File Loading Test**
- **Task**: Verify configuration files load and validate
- **Scenarios**:
  - Load agents.yaml
  - Load workflows.yaml
  - Load logging.yaml
  - Apply configuration to agents
  - Verify agent behavior reflects configuration
- **Estimate**: 1.5 hours
- **Acceptance Criteria**:
  - All files load
  - Schema validation passes
  - Configuration applied correctly

**8.4 Build and Type Check Phase 8 (Final)**
- **Task**: Final comprehensive build and validation
- **Commands**:
  - turbo run clean && turbo run build
  - turbo run typecheck
  - turbo run lint
  - turbo run test (all packages)
  - ./scripts/env/check-health.sh
- **Estimate**: 1 hour
- **Acceptance Criteria**:
  - All packages compile without errors
  - All type checking passes
  - All linting passes (or acceptable debt)
  - All tests pass
  - Health checks pass

**8.5 Validate Phase 8 Completion and Update EPCC_PLAN.md**
- **Task**: Final documentation of Phase 8 completion in EPCC_PLAN.md
- **Validation Checklist**:
  - [ ] Full monorepo build successful (zero errors)
  - [ ] Type checking passes for all packages
  - [ ] Linting passes for all packages
  - [ ] All 7 PM2 processes running
  - [ ] Health checks pass
  - [ ] Configuration files loading correctly
  - [ ] No ERROR logs in output
  - [ ] Dashboard accessible
  - [ ] Performance meets expectations
  - [ ] All tests passing
- **Final Documentation**:
  - Update EPCC_PLAN.md with: "## Phase 8: Build & Deployment Validation ✅ COMPLETED (Date)"
  - Create COMPLETION SUMMARY section with:
    - Total time spent vs estimate (78.5h planned)
    - All phases marked complete
    - Build metrics (compilation time, bundle size if applicable)
    - Test coverage final numbers
    - PM2 process status
    - Health check results
    - Any deviations from plan documented
    - Lessons learned (if any)
  - Create SIGN-OFF section:
    - Date completed
    - Who verified
    - Approval for next phase (CODE → COMMIT)
- **Estimate**: 1 hour
- **Acceptance Criteria**:
  - EPCC_PLAN.md final completion section created
  - All validation items marked complete
  - Final summary and sign-off documented
  - Platform ready for production deployment

---

## 🎯 Summary Task List with Build/Validation Steps

**Total Estimated Time: 84 hours** (10.5 days of focused development)

### Phase Breakdown with Build/Validate Steps

| Phase | Task | Estimate | Status |
|-------|------|----------|--------|
| 1 | Agent Registry | 4h | Pending |
| 1 | Configuration Manager | 4h | Pending |
| 1 | Logger Config Service | 3h | Pending |
| 1 | Workflow Engine | 3h | Pending |
| 1 | Service Locator | 2h | Pending |
| 1 | **Build & Type Check Phase 1** | **1h** | Pending |
| 1 | **Validate & Update EPCC_PLAN.md** | **0.5h** | Pending |
| **Phase 1 Subtotal** | **5 Packages + Validation** | **17.5h** | |
| 2 | Extend BaseAgent | 2h | Pending |
| 2 | Update 5 Agents | 4h | Pending |
| 2 | Agent Config Files | 1.5h | Pending |
| 2 | Update Tests | 0.5h | Pending |
| 2 | **Build & Type Check Phase 2** | **1h** | Pending |
| 2 | **Validate & Update EPCC_PLAN.md** | **0.5h** | Pending |
| **Phase 2 Subtotal** | **Agent Integration + Validation** | **9.5h** | |
| 3 | OrchestratorContainer | 3h | Pending |
| 3 | Workflow Integration | 3h | Pending |
| 3 | Agent Registry Integration | 3h | Pending |
| 3 | Config Files | 1h | Pending |
| 3 | Orchestrator Tests | 2h | Pending |
| 3 | **Build & Type Check Phase 3** | **1h** | Pending |
| 3 | **Validate & Update EPCC_PLAN.md** | **0.5h** | Pending |
| **Phase 3 Subtotal** | **Orchestration + Validation** | **13.5h** | |
| 4 | Agent Metadata Loaders | 2h | Pending |
| 4 | Agent Metadata Files | 4h | Pending |
| 4 | API Endpoint | 2h | Pending |
| 4 | **Build & Type Check Phase 4** | **1h** | Pending |
| 4 | **Validate & Update EPCC_PLAN.md** | **0.5h** | Pending |
| **Phase 4 Subtotal** | **Configuration + Validation** | **9.5h** | |
| 5 | Log Level Middleware | 2h | Pending |
| 5 | Configurable Logger | 2h | Pending |
| 5 | Documentation | 1.5h | Pending |
| 5 | Logging Tests | 1.5h | Pending |
| 5 | **Build & Type Check Phase 5** | **1h** | Pending |
| 5 | **Validate & Update EPCC_PLAN.md** | **0.5h** | Pending |
| **Phase 5 Subtotal** | **Logging + Validation** | **8.5h** | |
| 6 | API Documentation | 2h | Pending |
| 6 | Migration Guide | 1.5h | Pending |
| 6 | CLAUDE.md Update | 1h | Pending |
| 6 | Example Agent | 2h | Pending |
| 6 | Performance Tests | 1h | Pending |
| 6 | **Build & Type Check Phase 6** | **1h** | Pending |
| 6 | **Validate & Update EPCC_PLAN.md** | **0.5h** | Pending |
| **Phase 6 Subtotal** | **Documentation + Validation** | **9h** | |
| 7 | E2E Pipeline Test | 3h | Pending |
| 7 | Integration Tests | 3h | Pending |
| 7 | Multi-Workflow Test | 2h | Pending |
| 7 | Backward Compat Test | 2h | Pending |
| 7 | **Build & Type Check Phase 7** | **1.5h** | Pending |
| 7 | **Validate & Update EPCC_PLAN.md** | **0.5h** | Pending |
| **Phase 7 Subtotal** | **Validation + Sign-off** | **12h** | |
| 8 | Monorepo Build | 1.5h | Pending |
| 8 | PM2 Deployment | 1.5h | Pending |
| 8 | Config Loading Test | 1.5h | Pending |
| 8 | **Build & Type Check Phase 8** | **1h** | Pending |
| 8 | **Validate & Final EPCC_PLAN.md** | **1h** | Pending |
| **Phase 8 Subtotal** | **Deployment + Final Validation** | **6.5h** | |
| | **GRAND TOTAL** | **85.5h** | |

---

## ✅ Build & Validation Steps (Added to Every Phase)

Every phase now includes TWO mandatory final steps:

### Step 1: Build and Type Checking
```bash
# Phase-specific build command
turbo run build --filter=@agentic-sdlc/[relevant-packages]
turbo run typecheck --filter=@agentic-sdlc/[relevant-packages]

# Expected outcome
- ✅ Zero compilation errors
- ✅ Zero type checking errors
- ✅ All imports valid
- ✅ Package exports correct
```

### Step 2: Validate Completion and Update EPCC_PLAN.md
```
For each phase completion:

1. Check all components created (files, tests, configurations)
2. Verify acceptance criteria met
3. Update EPCC_PLAN.md with:
   - Phase completion date
   - All validation checklist items
   - Files created/modified list
   - Any deviations or changes made
   - Actual time spent vs estimate
   - Sign-off confirmation
```

### EPCC_PLAN.md Update Template (Used After Each Phase)

```markdown
## Phase [N]: [Phase Name] ✅ COMPLETED

**Completed:** [Date]
**Estimated Time:** [X hours]
**Actual Time:** [Y hours]
**Status:** All components delivered and validated

### Validation Checklist
- [x] All files created as planned
- [x] All tests passing (coverage: XX%)
- [x] Build successful (zero errors)
- [x] Type checking passed
- [x] No breaking changes
- [x] Backward compatibility maintained

### Files Created/Modified
- [List of all files with brief description]

### Deviations from Plan
- [Any changes made and why]

### Sign-off
- Verified by: [Developer name]
- All phase objectives met: ✅
- Ready for next phase: ✅
```

---

## 🏗️ Dependency Graph (With Build Steps)

```
Phase 1: Shared Packages [Parallel]
├── Agent Registry
├── Configuration Manager
├── Logger Config Service
├── Workflow Engine
├── Service Locator
├── BUILD & TYPECHECK
└── VALIDATE & UPDATE PLAN
        ↓
Phase 2: BaseAgent Integration [Sequential]
├── Extend BaseAgent
├── Update 5 Agents
├── Agent Config Files
├── Update Tests
├── BUILD & TYPECHECK
└── VALIDATE & UPDATE PLAN
        ↓
Phase 3: Orchestration [Sequential]
├── OrchestratorContainer
├── Workflow Integration
├── Agent Registry Integration
├── Config Files
├── Orchestrator Tests
├── BUILD & TYPECHECK
└── VALIDATE & UPDATE PLAN
        ↓
Phase 4: Configuration [Sequential]
├── Agent Metadata Loaders
├── Agent Metadata Files
├── API Endpoint
├── BUILD & TYPECHECK
└── VALIDATE & UPDATE PLAN
        ↓
Phase 5: Logging [Sequential]
├── Log Level Middleware
├── Configurable Logger
├── Documentation
├── Logging Tests
├── BUILD & TYPECHECK
└── VALIDATE & UPDATE PLAN
        ↓
Phase 6: Documentation [Parallel]
├── API Documentation
├── Migration Guide
├── CLAUDE.md Update
├── Example Agent
├── Performance Tests
├── BUILD & TYPECHECK
└── VALIDATE & UPDATE PLAN
        ↓
Phase 7: E2E Testing [Parallel]
├── E2E Pipeline Test
├── Integration Tests
├── Multi-Workflow Test
├── Backward Compatibility Test
├── BUILD & TYPECHECK
└── VALIDATE & UPDATE PLAN
        ↓
Phase 8: Final Deployment [Sequential]
├── Monorepo Build
├── PM2 Deployment
├── Config Loading Test
├── BUILD & TYPECHECK (Final)
└── VALIDATE & FINAL SIGN-OFF
```

---

## 🔒 Constraints & Guarantees

### Hard Constraints (Do Not Break)
- ✅ AgentEnvelopeSchema v2.0.0 structure unchanged
- ✅ BaseAgent.execute(task: AgentEnvelope) signature unchanged
- ✅ IMessageBus interface fixed
- ✅ Redis Streams ACK timing behavior preserved
- ✅ Trace context propagation end-to-end
- ✅ All existing agents work without modification

### Architectural Rules
- ✅ Never duplicate schemas (always import from @agentic-sdlc/shared-types)
- ✅ Use package index exports (never /src/ imports)
- ✅ Message bus only via IMessageBus interface
- ✅ Hexagonal layer separation (core/ports/adapters)
- ✅ Dependency direction: concrete → abstract → core

### Platform Guarantees
- ✅ pnpm monorepo with Turbo build system maintained
- ✅ Vitest for all tests
- ✅ PM2 for process management
- ✅ Redis Streams for message bus
- ✅ Pino for logging (extended, not replaced)

---

## 📚 Key References

**Architecture Documents**:
- EPCC_EXPLORE.md (Detailed exploration findings)
- CLAUDE.md (Session #68 - Platform state)
- HEXAGONAL-ARCHITECTURE-IMPLEMENTATION.md (Hexagonal patterns)

**Code References**:
- packages/agents/base-agent/src/base-agent.ts (783 lines)
- packages/shared/types/src/messages/agent-envelope.ts (Schema)
- packages/orchestrator/src/hexagonal/bootstrap.ts (DI container)
- packages/orchestrator/src/state-machine/workflow-state-machine.ts (Workflow model)

---

**Plan Status**: ✅ **COMPLETE & READY FOR CODE PHASE**

**Updated:** 2025-11-15 (Session #68)
**Enhancement:** Added build/validation steps to every phase with EPCC_PLAN.md update requirements

**Next Step:** Begin CODE phase with Phase 1 (Shared Packages) - All 5 packages can be developed in parallel

