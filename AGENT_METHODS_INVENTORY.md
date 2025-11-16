# Agent Methods Inventory - Session #67

## BaseAgent Common Methods (All Agents Inherit)

### Public Lifecycle
1. **initialize()** - Sets up agent, **subscribes to message bus**
   - Subscribes to `REDIS_CHANNELS.AGENT_TASKS(type)`
   - Creates consumer group `agent-{type}-group`
   - Registers handler callback via `messageBus.subscribe()`
   
2. **cleanup()** - Graceful shutdown, unsubscribes

3. **healthCheck()** - Returns health status

### Public Task Flow  
4. **receiveTask(message)** - Called by subscribe handler
   - Validates task
   - Calls execute()
   - Calls reportResult()

5. **reportResult(result, workflowStage)** - Publishes to orchestrator

### Abstract (Must Implement)
6. **execute(task): Promise<TaskResult>** - Agent-specific logic

### Protected
7. **validateTask(task)** - Schema validation
8. **generateTraceId()** - Tracing utilities

## Subscription Flow

```
initialize()
  └─> messageBus.subscribe(taskChannel, handler)
        └─> handler = async (message) => {
              └─> receiveTask(message)
                    └─> validateTask()
                    └─> execute()
                    └─> reportResult()
            }
```

## CRITICAL: Subscription Happens!

Agents ARE subscribing via `messageBus.subscribe()` in initialize().

**This means:**
- ✅ Agents call subscribe()
- ✅ Handler is registered
- ❌ BUT handlers are never invoked

**Conclusion:** The problem is NOT in agent code. The problem is in the MESSAGE BUS implementation - specifically the Redis Streams polling/consuming logic.

The message bus adapter is NOT delivering messages to the registered handlers!
