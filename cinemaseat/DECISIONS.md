# Architectural Decisions (DECISIONS.md)

This document records the major architectural decisions and trade-offs considered during the design and development of CinemaSeat.

## 1. Concurrency Control for Seat Holding: Redis Atomic Locks vs DB Row Locking
- **Options Considered:**
  1. PostgreSQL `SELECT ... FOR UPDATE` (Pessimistic DB Locks).
  2. Redis Atomic Locks (`SET key val NX EX ttl` / Lua scripts).
- **Decision:** Redis Atomic Locks.
- **Why:** Redis operates in-memory and can sustain extremely high throughput during concurrent bursts (e.g., 100+ requests hitting the exact same seat within milliseconds) without exhausting PostgreSQL connection pools.
- **Trade-off:** Requires syncing Redis lock state with PostgreSQL for permanent booking confirmations.

## 2. Payment Gateway Integration: Asynchronous Fire-and-Forget vs Inline Await
- **Options Considered:**
  1. Await `/charge` response inline before responding to the user.
  2. Fire `/charge` asynchronously, return `202 Accepted` / `PENDING` to the user, and process updates via gateway webhooks/callbacks.
- **Decision:** Asynchronous Fire-and-Forget with Webhook Callback Handler.
- **Why:** The payment gateway has variable network latency (2–15s delays) and can time out. Blocking HTTP threads waiting for gateway callbacks leads to thread pool starvation under load.
- **Trade-off:** Frontend must handle asynchronous status polling or WebSocket updates to notify user when payment completes.

## 3. Idempotent Callback Processing: Unique Event Deduplication
- **Options Considered:**
  1. Process callbacks directly without tracking idempotency keys.
  2. Track processed `event_id` and `payment_id` state transitions in Redis / PostgreSQL with atomic status updates.
- **Decision:** Idempotency Key Tracking with Strict State Machine (`PENDING -> SUCCEEDED / FAILED / REFUNDED`).
- **Why:** The gateway retries callbacks and emits 8% duplicate callbacks. Duplicate processing would cause double confirmations or double-counting.
- **Trade-off:** Small storage overhead for idempotency keys and state checks on every incoming callback.
