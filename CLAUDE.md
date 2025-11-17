# CLAUDE.md - AI Assistant Guide for Agentic SDLC

**Status:** ✅ Phase 7B Complete (100%) | **Updated:** 2025-11-17 | **Version:** 54.0

**📚 Key Resources:** [Runbook](./AGENTIC_SDLC_RUNBOOK.md) | [Logging](./LOGGING_LEVELS.md) | [Strategy](./STRATEGIC-ARCHITECTURE.md) | [Behavior Metadata](./packages/agents/generic-mock-agent/BEHAVIOR_METADATA_GUIDE.md)

---

## 🏗️ Architecture Rules (CRITICAL)

### Core Principles
1. ✅ **Schema:** AgentEnvelopeSchema v2.0.0 from @agentic-sdlc/shared-types (ALL validation)
2. ✅ **Imports:** Use package index, NEVER /src/ paths
3. ✅ **Message Bus:** redis-bus.adapter.ts handles ALL wrapping/unwrapping
4. ✅ **Envelopes:** buildAgentEnvelope() in orchestrator is canonical producer
5. ✅ **DI:** Use OrchestratorContainer
6. ✅ **No Duplication:** Never copy schemas/validators between packages

**Critical Files (Never Duplicate):**
- `packages/shared/types/src/messages/agent-envelope.ts` - Schema
- `packages/orchestrator/src/hexagonal/adapters/redis-bus.adapter.ts` - Bus
- `packages/agents/base-agent/src/base-agent.ts` - Validation

---

## 🚀 Quick Start

```bash
# Everything via ./dev script
./dev start              # Start all services
./dev stop               # Stop all services
./dev restart            # Restart all services
./dev status             # Show service status
./dev health             # Health checks
./dev logs               # Show logs
./dev dashboard          # Open dashboard (localhost:3001)
./dev api                # Open API (localhost:3000)
```

---

## ✅ Current Status

**Phase 7B COMPLETE (45 hours, ON TIME)**
- ✅ 27+ CLI commands fully implemented
- ✅ 7 core services (API, DB, Config, Test, Deploy, Metrics, Advanced)
- ✅ 2,050+ lines of production code
- ✅ 121+ test cases, 0 TypeScript errors
- ✅ All 21 packages building successfully
- ✅ 99%+ production ready

**Recent Additions (Session #77):**
- ✅ Mock Agent Behavior Metadata System - Flexible test scenario creation
- ✅ Logging Levels Definition - 6 tiers, environment configs, module-specific
- ✅ Comprehensive Documentation - 3,000+ lines across 9 docs

**System Status:**
- ✅ AgentEnvelope v2.0.0 schema validation
- ✅ Redis Streams message bus with ACK
- ✅ Definition-driven workflow routing
- ✅ Platform-scoped agent registry
- ✅ 130+ integration tests
- ✅ Dashboard platform-aware
- ✅ Structured logging (Pino) integrated

---

## 📚 Key Documentation

- **LOGGING_LEVELS.md** - Log level hierarchy, environments, modules
- **LOGGING_IMPLEMENTATION.md** - How-to guide with 5 patterns
- **AGENTIC_SDLC_RUNBOOK.md** - Operational guide
- **STRATEGIC-ARCHITECTURE.md** - Multi-platform strategy
- **Behavior Metadata Guide** - Mock agent test scenarios

---

## 🎯 Optional Polish Items (Low Priority)

**Platform is production-ready. These are enhancements only:**

1. Remove DEBUG console.log statements (30 min)
2. File-based log rotation (1-2 hours)
3. E2E test templates for React (1-2 hours)
4. Dashboard performance pages (2-3 hours)

---