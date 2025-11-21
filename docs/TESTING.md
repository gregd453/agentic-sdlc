# Simple Testing Guide

## Quick Test
```bash
./TEST.sh
```

That's it. It tells you if everything works.

---

## What It Checks
1. **CLI** - Can we run the `agentic-sdlc` command?
2. **Orchestrator** - Is the API responding?
3. **Dashboard** - Is the UI running?
4. **Agents** - Are the worker processes online?

---

## If Everything Is Green ✅
You're good to go. Everything works.

## If Something Is Red ❌
Stop and restart:
```bash
./scripts/env/stop-dev.sh
./scripts/env/start-dev.sh
./TEST.sh
```

---

## Using the CLI
Once tests pass, try these:

```bash
# Check status
agentic-sdlc status

# Check health
agentic-sdlc health

# View logs
agentic-sdlc logs

# Get help
agentic-sdlc help
```

---

## That's All
Run the test. If it passes, you're ready to work.
