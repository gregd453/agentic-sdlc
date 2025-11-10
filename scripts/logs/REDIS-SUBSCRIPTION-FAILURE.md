REDIS-SUBSCRIPTION-FAILURE.md


Yep—good sleuthing. If subscribe() itself is erroring right away (and keeps erroring on every retry), that almost always means one of these is true:

The usual culprits (ranked)
	1.	ACL / permissions (NOPERM)
	•	The Redis user you connect with doesn’t have +subscribe allowed.
	•	Common on managed services where the default user is restricted.
	•	Symptom: immediate error on SUBSCRIBE (no silent drops).
	2.	Wrong endpoint / proxy that doesn’t support Pub/Sub
	•	e.g., connecting to a Data API/HTTP proxy (ElastiCache Serverless Data API, some “serverless” Redis proxies) that don’t implement Pub/Sub over that endpoint.
	•	Works for GET/SET, but SUBSCRIBE fails immediately with “unknown command” or similar.
	3.	TLS / auth mismatch causes connect→resubscribe loop
	•	If the client can connect but auth/handshake fails, it may auto-retry and re-issue SUBSCRIBE, triggering your callback repeatedly.
	4.	Cluster / Sentinel mis-config + library config
	•	Using a cluster endpoint but a single-node client config (or vice-versa), or missing redis:// vs rediss://.
	•	ioredis will keep reconnecting and re-subscribing → repeated errors.
	5.	Using a non-dedicated connection for subscriber
	•	In Node-Redis v4 and ioredis, a connection in subscriber mode can only do sub/unsub/ping/quit. If you reuse it for normal commands, you can get “only (P)SUBSCRIBE allowed…” errors.

⸻

Fast validations you can do in 5 minutes

A. Prove Pub/Sub works at the server

redis-cli -u rediss://:<PASSWORD>@<HOST>:<PORT> SUBSCRIBE orchestrator:results

	•	If this fails here, it’s server-side (ACL or endpoint).
	•	If this succeeds, the issue is in client config or code.

B. Check ACL for your user

# As an admin-capable connection:
ACL WHOAMI
ACL GETUSER <your-user>
# Look for categories/commands: should include +@pubsub or +subscribe +psubscribe

C. Confirm endpoint type & transport
	•	Are you using a TCP Redis endpoint (supports Pub/Sub), not a REST/Data API?
	•	Should be redis:// (plain) or rediss:// (TLS). Managed services often require TLS.
	•	If TLS is required, make sure your client uses rediss:// or tls: {}.

D. Try a minimal clean subscriber in isolation
	•	Run this tiny script with your exact URL—no retries, no extra options—so you see the raw error.

Node-Redis v4 (official):

import { createClient } from 'redis';

const url = process.env.REDIS_URL; // e.g. rediss://:pwd@host:port
const sub = createClient({ url });
sub.on('error', (e) => console.error('SUB error:', e));

await sub.connect();
await sub.subscribe('orchestrator:results', (msg) => {
  console.log('got:', msg);
});

ioredis:

import Redis from 'ioredis';

const sub = new Redis(process.env.REDIS_URL, {
  lazyConnect: true, // so connect() throws if bad
});
sub.on('error', (e) => console.error('SUB error:', e));

await sub.connect();
await sub.subscribe('orchestrator:results', (err, count) => {
  if (err) {
    console.error('subscribe failed:', err);
  } else {
    console.log('subscribed:', count);
  }
});

If these minimal scripts still error immediately, copy the exact error message—it will usually be one of: NOPERM, ERR unknown command 'subscribe', WRONGPASS, handshake/TLS error, or “Command not allowed”.

⸻

Quick fixes by root cause
	•	NOPERM / ACL
Grant pub/sub:

ACL SETUSER <user> on >"<password>" ~* +@pubsub

or explicitly +subscribe +psubscribe +publish +punsubscribe +unsubscribe.

	•	Wrong endpoint / proxy
Switch to the native Redis TCP endpoint. Data APIs (HTTP/REST/Serverless “Data API”) usually do not support Pub/Sub.
	•	TLS mismatch
Use rediss:// (or tls: {} in ioredis). Some providers require SNI; ensure name/servername matches the host.
	•	Cluster config
With ioredis cluster:

new Redis.Cluster([{ host, port }], { dnsLookup: (address, cb) => cb(null, address), redisOptions: { tls: {} } })

Make sure you’re not pointing a single-node client at a cluster config (or the other way around).

	•	Dedicated subscriber connection
In Node-Redis v4:

const client = createClient({ url });
await client.connect();
const sub = client.duplicate();
await sub.connect();
await sub.subscribe('orchestrator:results', listener);

Use client for normal commands, sub only for subscribe.

⸻

Hardening tips (so this doesn’t flap forever)
	•	Fail-fast logging: log the first error stack from subscribe() and the connection’s error event; include the URL scheme (redis vs rediss) and isCluster flag (but redact secrets).
	•	Disable noisy retries until fixed: temporarily set a small backoff and cap attempts so you don’t drown logs.
	•	Health checks: before subscribing, run PING and ACL WHOAMI, log user/role.
	•	Feature flag Pub/Sub vs Streams: consider Redis Streams + consumer groups if you need durability; Pub/Sub drops messages when disconnected.

⸻

A crisp “next 10 minutes” plan
	1.	Run redis-cli ... SUBSCRIBE orchestrator:results.
	2.	If it errors, run ACL GETUSER (or check provider docs) → fix NOPERM or switch endpoints.
	3.	If CLI works, run the minimal Node script above—capture the exact error text.
	4.	Update your orchestrator to use a dedicated subscriber connection, correct rediss:// if needed, and retry.

If you paste the exact error string it prints after your rebuild (NOPERM, unknown command, WRONGPASS, etc.), I can pinpoint the one-line fix.
