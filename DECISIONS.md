# Decisions

Three decisions we genuinely debated during the hackathon.

---

## Decision 1: PostgreSQL atomic UPDATE vs Redis distributed lock for seat holds

**The problem:** 100 users can try to hold the same seat at the same millisecond. We need exactly one to succeed.

**Options we considered:**

**Option A: Redis-based distributed lock (Redlock)**
Use Redis `SET NX EX` to acquire a lock per seat before updating the database. Hold the lock during the DB write, release it after.

**Option B: PostgreSQL atomic UPDATE with WHERE clause**
`UPDATE show_seats SET status='held' WHERE seat_id=$1 AND status='available' RETURNING id`
If 0 rows returned, the seat was already taken. PostgreSQL's MVCC guarantees atomicity.

**What we chose:** Option B — PostgreSQL atomic UPDATE.

**Why:** The database is already the source of truth for seat state. Adding Redis as a second lock layer introduces a failure mode: if Redis is unavailable but PostgreSQL is fine, all holds fail. With Option B, PostgreSQL handles the serialization natively. The query is a single round-trip and inherently atomic — no lock acquisition, no lock release, no TTL management for the lock itself. Fewer moving parts, fewer failure modes.

**What we gave up:** Redis-based locking would work across multiple application instances more explicitly. However, PostgreSQL row-level locking already achieves this — any node hitting the same row gets serialized by the database. We'd only need Redlock if we were doing something that PostgreSQL couldn't serialize, which we aren't.

---

## Decision 2: Monorepo modular monolith vs microservices

**The problem:** The system has clearly separable concerns — catalogue, booking, payment, notifications. Microservices feel like the "right" architecture for a high-traffic booking system.

**Options we considered:**

**Option A: Microservices**
Separate services for each module, communicate via HTTP or message queue, deploy independently.

**Option B: Modular monolith**
Single Node.js process, strict module boundaries, no cross-module imports, but deployed as one unit.

**What we chose:** Option B — modular monolith.

**Why:** 8 hours. Microservices in 8 hours means spending 2 of them on service discovery, inter-service auth, network debugging, and Docker Compose complexity — time that should go to correctness and features. The modular structure means we could split services later: the booking module doesn't import from payment, payment doesn't import from catalogue. The boundaries are clean. We chose to pay the cost of splitting later rather than now.

**What we gave up:** True fault isolation. If the notification module throws, it takes the whole process. We mitigated this with try/catch at every WebSocket operation and async processing of callbacks. The gateway integration (always async, always returns 200) means the payment path can never crash the main process from outside.

---

## Decision 3: Synchronous OTP verification vs async OTP callback

**The problem:** The gateway delivers OTP codes via callback, not synchronously. We had to decide whether to build a full OTP callback flow or simplify.

**Options we considered:**

**Option A: Full async OTP callback**
Gateway POSTs OTP code to our `/webhooks/otp` endpoint. We store in Redis. Frontend polls to retrieve. User sees code auto-filled.

**Option B: Skip OTP callback, verify directly**
User types OTP, client sends to server, server calls `/otp/verify` on gateway directly. Simpler but misses the callback flow.

**What we chose:** Option A — full async OTP callback.

**Why:** The gateway spec explicitly shows `callback_url` as a parameter for `/otp/send`. Not implementing this means the flow would break with the real gateway in production. More importantly, it turns the OTP delivery itself into a wow demo moment — the code appears automatically in the input field, showing judges that our system correctly handles async delivery. The implementation cost was low (one new endpoint, Redis key, 20 lines of frontend polling).

**What we gave up:** Simplicity in the happy path. If the OTP callback is delayed (10% of the time per spec), the auto-fill doesn't appear and the user must type manually. We handle this gracefully — the input is always visible and editable regardless of whether auto-fill fires.
