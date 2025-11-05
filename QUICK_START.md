# 🚀 Quick Start Guide - Self-Building Agentic SDLC

## Current Status
- ✅ Sprint 1 Complete: Orchestrator foundation built
- ✅ Git repository initialized
- ⏳ Sprint 2 Ready: Agent Framework (TASK-006 ready to start)
- ❌ Services not running
- ❌ Anthropic API key not configured

## Immediate Next Steps

### 1️⃣ Configure Your Anthropic API Key

Run this command and follow the prompts:
```bash
./scripts/setup-anthropic.sh
```

You'll need your Anthropic API key from: https://console.anthropic.com/api-keys

### 2️⃣ Start the System

```bash
./start.sh
```

This will:
- Start PostgreSQL and Redis
- Run database migrations
- Start the orchestrator
- Open at http://localhost:3000

### 3️⃣ Begin Sprint 2 - Create Base Agent

**TASK-006: Base Agent Framework** needs to be implemented manually first.
This is the bootstrap step that enables all other automation.

Create the base agent structure:
```bash
# Create agent directory
mkdir -p packages/agents/base-agent/src

# Switch to feature branch
git checkout -b feat/task-006-base-agent

# You'll implement:
# - Abstract BaseAgent class
# - Anthropic Claude integration
# - Event communication with orchestrator
# - Error handling and retry logic
```

### 4️⃣ After Base Agent is Complete

Once TASK-006 is done, the system can start building itself:

```bash
# Execute the Scaffold Agent task
./scripts/backlog-manager.sh execute TASK-007

# Then execute remaining Sprint 2 tasks
./scripts/backlog-manager.sh execute-sprint
```

## 📊 Sprint 2 Goals

| Task | Story Points | Status | Description |
|------|--------------|--------|-------------|
| TASK-006 | 8 | Ready | Base Agent Framework (Manual) |
| TASK-007 | 13 | Blocked | Scaffold Agent (Semi-automated) |
| TASK-008 | 8 | Blocked | Validation Agent (Automated) |
| TASK-009 | 13 | Blocked | E2E Test Agent (Automated) |

**Total:** 42 story points
**Sprint Duration:** 7 days

## 🎯 Success Criteria

By end of Sprint 2:
- All 4 core agents operational
- System can generate code autonomously
- Validation and testing automated
- Foundation for self-building complete

## 🔧 Key Commands

```bash
# System Control
./start.sh                                # Start everything
./status.sh                               # Check status
./run.sh logs                            # View logs

# Backlog Management
./scripts/backlog-manager.sh sprint      # View current sprint
./scripts/backlog-manager.sh execute <ID> # Execute a task
./scripts/backlog-manager.sh progress    # Check progress

# API Testing
./test-api.sh                            # Test all endpoints
curl http://localhost:3000/api/v1/health # Quick health check
```

## 🚦 Ready Checklist

Before starting Sprint 2:
- [ ] Anthropic API key configured
- [ ] System started (./start.sh)
- [ ] Orchestrator accessible at http://localhost:3000
- [ ] Git repository on develop branch
- [ ] Ready to implement TASK-006 manually

## 💡 Pro Tips

1. **Keep logs open** in a separate terminal: `./run.sh logs`
2. **Test frequently** with: `pnpm test`
3. **Commit often** with conventional commits
4. **Monitor workflows** at: http://localhost:3000/api/v1/workflows

---

**Let's build an AI system that builds itself! 🤖**