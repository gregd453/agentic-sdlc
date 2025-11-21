# Message Handling Comparison - Agent Results

**Issue:** Inconsistent message handling between WorkflowService and WorkflowStateMachine
**Root Cause:** Different expectations about message structure from redis-bus adapter

---

## Problem Summary

The `redis-bus.adapter.ts` **unwraps** messages before passing them to handlers:

```typescript
// redis-bus.adapter.ts:221
await Promise.all(
  Array.from(handlers).map(h =>
    h(parsedMessage).catch(e => // ← Passes UNWRAPPED message
      log.error('[PHASE-3] Stream handler error', { error: String(e) })
    )
  )
);
```

Where `parsedMessage` is the **AgentResult object itself**, extracted from envelope.

---

## How Each Component Handles Messages

### ✅ WorkflowService (CORRECT)

**File:** `packages/orchestrator/src/services/workflow.service.ts:549-552`

```typescript
private async handleAgentResult(result: any): Promise<void> {
  // The result IS the AgentResultSchema-compliant object (no payload wrapper)
  // redis-bus adapter already unwrapped the envelope and extracted the message
  const agentResult = result; // ✅ Correctly expects unwrapped message

  // ... validates agentResult directly
}
```

**Expectation:** Message = AgentResult (unwrapped)
**Works:** ✅ YES

---

### ❌ WorkflowStateMachine (INCORRECT)

**File:** `packages/orchestrator/src/state-machine/workflow-state-machine.ts:743-747`

```typescript
await this.messageBus.subscribe(REDIS_CHANNELS.ORCHESTRATOR_RESULTS, async (message: any) => {
  try {
    logger.info('[PHASE-4] State machine received agent result', {
      workflow_id: message.workflow_id,  // ❌ message IS the AgentResult
      agent_id: message.agent_id,
      message_id: message.id
    });

    // Extract payload
    const agentResult = message.payload; // ❌ WRONG - message doesn't have .payload
    if (!agentResult) {
      logger.warn('[PHASE-4] No payload in agent result message', { message_id: message.id });
      return; // ← This is where execution stops!
    }
```

**Expectation:** Message = `{payload: AgentResult}` (wrapped)
**Reality:** Message = `AgentResult` (unwrapped)
**Works:** ❌ NO - `message.payload` is undefined, triggers warning and returns early

---

## Redis Bus Adapter Message Flow

**File:** `packages/orchestrator/src/hexagonal/adapters/redis-bus.adapter.ts:168-221`

```typescript
// Parse stream message envelope structure
// Stream entries have format: {topic: string, payload: string}
// where payload = JSON.stringify({key: string, msg: AgentResult})

let parsedMessage: any;

// Path 1: String payload (standard path) - parse envelope then extract message
if (messageData.payload && typeof messageData.payload === 'string') {
  const envelope = JSON.parse(messageData.payload);
  parsedMessage = envelope.msg || envelope; // ← Extracts msg from envelope
  parseMethod = 'payload-string';
}

// ... other paths ...

// Invoke all handlers
const handlers = subscriptions.get(topic);
if (handlers) {
  await Promise.all(
    Array.from(handlers).map(h =>
      h(parsedMessage).catch(e => // ← Passes unwrapped AgentResult
        log.error('[PHASE-3] Stream handler error', { error: String(e) })
      )
    )
  );
}
```

**Message Structure at Each Layer:**

1. **Redis Stream Entry:**
   ```json
   {
     "topic": "agent:results",
     "payload": "{\"key\":\"workflow-id\",\"msg\":{...AgentResult...}}"
   }
   ```

2. **After JSON.parse(payload):**
   ```json
   {
     "key": "workflow-id",
     "msg": {...AgentResult...}
   }
   ```

3. **Extracted (parsedMessage):**
   ```json
   {...AgentResult...}  // ← This is what handlers receive
   ```

4. **Passed to Handler:**
   ```typescript
   handler(parsedMessage)  // handler receives AgentResult directly
   ```

---

## Fix Required

**Location:** `packages/orchestrator/src/state-machine/workflow-state-machine.ts:743-760`

**Change:**
```typescript
// ❌ BEFORE
const agentResult = message.payload;
if (!agentResult) {
  logger.warn('[PHASE-4] No payload in agent result message', { message_id: message.id });
  return;
}

const workflowId = agentResult.workflow_id;

// ✅ AFTER
// The message IS the AgentResult (redis-bus adapter unwraps it)
const agentResult = message;
if (!agentResult) {
  logger.warn('[PHASE-4] No agent result in message');
  return;
}

const workflowId = agentResult.workflow_id;
```

**Or even better - match WorkflowService pattern:**
```typescript
// ✅ RECOMMENDED (matches WorkflowService pattern)
// The message IS the AgentResultSchema-compliant object (no payload wrapper)
// redis-bus adapter already unwrapped the envelope and extracted the message
const agentResult = message;
const workflowId = agentResult.workflow_id;

if (!workflowId) {
  logger.warn('[PHASE-4] No workflow_id in agent result', {
    agent_id: agentResult.agent_id,
    has_workflow_id: !!agentResult.workflow_id
  });
  return;
}
```

---

## Why This Happened

**Historical Context:**

1. **Phase 2:** Removed callback-based AgentDispatcher
2. **Phase 3:** Wired message bus into orchestrator
3. **Phase 4:** Added state machine autonomous event handling

**The Mistake:**

When Phase 4 added state machine subscription, the code assumed messages would be wrapped:
```typescript
const agentResult = message.payload; // Assumed wrapped format
```

But the redis-bus adapter was already unwrapping messages for **all handlers** (consistent with WorkflowService).

**Why WorkflowService Works:**

WorkflowService was written **after** the redis-bus adapter unwrapping logic was in place, so it correctly expects unwrapped messages.

**Why StateMachine Fails:**

StateMachine subscription may have been written **before** understanding that redis-bus unwraps messages, or copied from old callback-based code that received wrapped messages.

---

## Testing the Fix

### Before Fix
```bash
# Submit workflow
curl -X POST http://localhost:3000/api/v1/workflows -H "Content-Type: application/json" \
  -d '{"type":"app","name":"test","description":"Test","requirements":"Test","priority":"medium"}'

# Check logs
grep "PHASE-4.*No payload" scripts/logs/orchestrator-out.log
# ❌ Result: Warning appears, workflow doesn't advance
```

### After Fix
```bash
# Submit workflow
curl -X POST http://localhost:3000/api/v1/workflows -H "Content-Type: application/json" \
  -d '{"type":"app","name":"test","description":"Test","requirements":"Test","priority":"medium"}'

# Check logs
grep "WORKFLOW-TRACE" scripts/logs/orchestrator-out.log
# ✅ Expected:
#   - Workflow created
#   - Task created and published
#   - Agent result received
#   - Sending STAGE_COMPLETE to state machine
#   - (Workflow should advance to next stage)
```

---

## Related Files

- `packages/orchestrator/src/hexagonal/adapters/redis-bus.adapter.ts` - Unwraps messages
- `packages/orchestrator/src/services/workflow.service.ts` - ✅ Correctly expects unwrapped
- `packages/orchestrator/src/state-machine/workflow-state-machine.ts` - ❌ Incorrectly expects wrapped

---

## Impact

**Current State:**
- ✅ Tasks dispatch correctly
- ✅ Agents receive and execute
- ✅ Results publish correctly
- ✅ Orchestrator receives results
- ✅ Schema validation passes
- ❌ State machine rejects result (no payload)
- ❌ Workflow doesn't advance

**After Fix:**
- ✅ State machine processes result
- ✅ STAGE_COMPLETE event fires
- ✅ Workflow advances to next stage
- ✅ **Complete pipeline working end-to-end**

---

**Priority:** HIGH - This is the last blocker for workflow advancement
**Estimated Fix Time:** 5 minutes
**Testing Time:** 5 minutes
**Total:** 10 minutes to working workflows
