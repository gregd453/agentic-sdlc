REDIS-PLAYBOOK.md

You’re down to a classic Redis Pub/Sub “message fell on the floor” problem. Treat it as an ordering + wiring issue first, then as durability.

Here’s a tight checklist to find it fast and a couple of safe hardening moves.

⸻

0) Sanity: are we on the same Redis + channel?
	•	Confirm envs match exactly for publisher & subscriber:
	•	REDIS_HOST, PORT, TLS, PASSWORD
	•	Confirm the channel string is identical (no prefix/suffix differences, no trailing spaces, no env interpolation mistakes):
	•	Expected: agent:scaffold:tasks
	•	Search both codepaths for publish( / subscribe( usage and print the resolved string at runtime.

⸻

1) Verify Redis sees the channel & messages

From the Redis container:

docker exec -it <redis> redis-cli
> PUBSUB CHANNELS
> PUBSUB NUMSUB agent:scaffold:tasks
# in a second shell
> SUBSCRIBE agent:scaffold:tasks
# then publish from your app or:
> PUBLISH agent:scaffold:tasks '{"ping":"pong"}'

	•	If NUMSUB shows 0 while your agent “subscribes,” your subscriber isn’t actually subscribed (wrong client mode / wrong code path).
	•	If SUBSCRIBE receives messages from manual PUBLISH, Redis transport is fine—issue is on your app client usage.

⸻

2) Node Redis client pitfalls (most common causes)

A) Using one client for both publish and subscribe
	•	node-redis v4 and ioredis put a connection into subscriber mode after subscribe; it can’t be used for normal commands.
	•	Ensure you create two clients:
	•	pub = createClient()
	•	sub = createClient()

B) Wrong API signature for v4
	•	node-redis v4:

const sub = client.duplicate();
await sub.connect();
await sub.subscribe('agent:scaffold:tasks', (message, channel) => {
  // message is a string
});

Don’t mix v3-style sub.on('message', ...) unless you used sub.subscribe() without a callback and then sub.on('message'). Pick one style.

	•	ioredis:

const sub = new Redis(url);
sub.on('message', (channel, message) => { /* ... */ });
await sub.subscribe('agent:scaffold:tasks');



C) Subscribing after publishing (race)

Pub/Sub is ephemeral: if you publish before any subscriber is active, the message is lost.

Quick test barrier

Emit a “ready” event from the subscriber once subscribe() resolves, and await it before publishing:

// bus.ts
export async function waitForSubscriber(sub, channel, timeoutMs = 5000) {
  const start = Date.now();
  // Option A: track a boolean when subscribe resolves
  let ready = false;
  await sub.subscribe(channel, () => { ready = true; });
  while (!ready && Date.now() - start < timeoutMs) {
    await new Promise(r => setTimeout(r, 25));
  }
  if (!ready) throw new Error('Subscriber not ready');
}

In tests, call await waitForSubscriber(sub, 'agent:scaffold:tasks') before orchestrator publishes.

D) JSON payload issues

Always JSON.stringify on publish and handle errors on parse:

await pub.publish('agent:scaffold:tasks', JSON.stringify(envelope));

In subscriber:

let payload: unknown;
try { payload = JSON.parse(message); }
catch (e) { logger.error({ e, message }, 'Invalid JSON'); return; }

E) Connection lifecycle
	•	Don’t reuse a client after quit() / disconnect().
	•	In tests with rapid restarts, ensure await client.connect() completes (add logs for ready).

⸻

3) Add explicit logs at critical points

Add one-line logs with resolved channel and client id:
	•	Publisher: after connect, before publish, after publish
	•	Subscriber: after connect, after subscribe resolve, inside message handler

Example:

logger.info({ channel, url }, 'Subscribing…');
// after subscribe resolves:
logger.info({ channel }, 'Subscribed');
// on message:
logger.info({ channel, size: message?.length }, 'Received message');


⸻

4) If timing is the issue (tests especially), you have two options

Short-term (keep Pub/Sub)
	•	Implement a startup barrier: tests wait until NUMSUB(agent:scaffold:tasks) >= 1 before publishing.
	•	Add retry publish (e.g., publish up to 10x with 100ms backoff until you’ve observed at least one subscriber via PUBSUB NUMSUB—only in tests/dev).

Long-term (recommended): switch this bus to Redis Streams

Pub/Sub drops messages when no one is listening. Streams give you durability + consumer groups:
	•	Publisher:

await redis.xAdd('agent:scaffold:tasks', '*', { data: JSON.stringify(envelope) });


	•	Subscriber (consumer group scaffolders):

await redis.xGroupCreate('agent:scaffold:tasks', 'scaffolders', '0', { MKSTREAM: true });
const res = await redis.xReadGroup('GROUP', 'scaffolders', 'agent-1', 'BLOCK', 5000, 'STREAMS', 'agent:scaffold:tasks', '>');
// Acknowledge after processing:
await redis.xAck('agent:scaffold:tasks', 'scaffolders', messageId);



Benefits: no races, exactly-once-ish with idempotency keys, can replay, great for CI.

⸻

5) Quick checklist you can run now
	1.	Same channel & instance? Log the exact values on both sides.
	2.	Separate clients? One for publish, one for subscribe.
	3.	Correct API style? v4 callback form or v3 event form—don’t mix.
	4.	Barrier in tests? Ensure subscriber is “ready” before first publish.
	5.	Redis CLI: PUBSUB NUMSUB agent:scaffold:tasks shows ≥ 1 when subscriber is up.
	6.	Manual publish: From redis-cli, publish a test JSON. Does the agent log it?
	7.	If still flaky: add a temporary skipLibCheck-like equivalent → for bus, use Streams for the E2E path.

⸻

Minimal patch you can try immediately (node-redis v4 style)

Publisher

const pub = createClient({ url: REDIS_URL });
await pub.connect();
await pub.publish('agent:scaffold:tasks', JSON.stringify(envelope));

Subscriber

const sub = createClient({ url: REDIS_URL });
await sub.connect();
await sub.subscribe('agent:scaffold:tasks', (message, channel) => {
  logger.info({ channel }, 'Message received');
  handle(JSON.parse(message));
});
logger.info('Subscribed to agent:scaffold:tasks');

If that works with redis-cli verification but your test still times out, it’s a race—add the startup barrier or move to Streams for the test path.

⸻

Bottom line
	•	Most likely: subscriber not actually subscribed yet (race) or wrong client/API usage.
	•	Prove with PUBSUB NUMSUB, fix with a ready barrier, and strongly consider Redis Streams for durable, test-friendly delivery.
	