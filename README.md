# CinemaSeat

A scalable, concurrent-safe movie ticket booking system built for the IEEE CS CUET Ultimate Hackathon.

**Live URL:** http://18.142.222.117:5173/

---

## What we built

A full-stack cinema ticketing platform that handles extreme concurrent demand without ever selling the same seat twice. Built in 8 hours by a team of 3.

**Core features:**
- Browse movies, showtimes, and theatres
- Real-time seat map with live status updates (WebSocket)
- Atomic seat holding — 100 concurrent requests for one seat, exactly 1 wins
- Payment integration with the provided gateway (async callback flow)
- OTP-based login and booking confirmation
- Automatic hold expiry — abandoned holds release to available
- QR code booking confirmation

**Wow features:**
- Live seat map updates via WebSocket — see seats change colour in real time as others book
- Hold countdown timer ticking down on your selected seat
- Live system metrics dashboard (active holds, bookings/60s, duplicate callbacks intercepted)
- Gateway degradation banner — graceful messaging when payment systems are slow
- Auto-fill OTP in development mode

---

## Architecture

```
React (Vite) ──HTTP/WS──▶ Express (Node.js) ──▶ PostgreSQL
                                │                    
                                ├──▶ Redis (holds, idempotency, sessions)
                                │                    
                                └──▶ Mock Gateway (payment + OTP)
```

**Key design decisions:**
- Seat holds enforced at PostgreSQL level using atomic `UPDATE ... WHERE status='available' RETURNING id`
- Redis used for TTL-based hold expiry and idempotency key storage
- Payment callbacks processed asynchronously after returning 200 immediately
- Duplicate callbacks deduplicated via `event_id` idempotency key in Redis
- WebSocket server attached to same HTTP server — no separate process needed

See `DECISIONS.md` for the three decisions we debated most.

---

## How to run locally

**Prerequisites:** Docker, Docker Compose

```bash
# 1. Clone the repository
git clone https://github.com/A-k-a-sh/cuet_micro_poridhi_hackathon
cd cuet_micro_poridhi_hackathon/cinemaseat

# 2. Pull the gateway image (do this first — large image)
docker pull asifmahmoud414/mock-gateway:latest

# 3. Start everything
docker compose up --build

# 4. Verify
curl http://localhost:3000/health
# → { "status": "ok" }
```

The database seeds automatically on first start. No manual steps required.

---

## The exact requests judges need

### Fetch seat map for a show

```bash
GET /api/shows/:show_id/seats

curl http://localhost:3000/api/shows/SHOW_ID/seats

# Response:
{
  "show_id": "uuid",
  "seat_map": {
    "A": [
      {
        "id": "show_seat_uuid",
        "seat_id": "seat_uuid",
        "label": "A1",
        "row": "A",
        "number": 1,
        "category": "vip",
        "status": "available",
        "held_until": null,
        "price": 375.00
      }
    ],
    "B": [ ... ]
  }
}
```

### Hold a seat

```bash
POST /api/bookings/hold
Authorization: Bearer {JWT_TOKEN}
Content-Type: application/json

{ "show_id": "SHOW_ID", "seat_id": "SEAT_ID" }

curl -X POST http://localhost:3000/api/bookings/hold \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT" \
  -d '{"show_id": "SHOW_ID", "seat_id": "SEAT_ID"}'

# Success (201):
{
  "booking_ref": "bk_a1b2c3d4e5f6g7h8",
  "show_seat_id": "uuid",
  "expires_at": "2026-08-08T11:10:00.000Z",
  "amount": 375.00,
  "ttl_seconds": 600
}

# Seat taken (409):
{
  "error": "Seat is no longer available",
  "code": "CONFLICT"
}
```

### Get a JWT token (for testing)

```bash
# Step 1: Send OTP
curl -X POST http://localhost:3000/api/auth/otp/send \
  -H "Content-Type: application/json" \
  -d '{"phone": "01700000000"}'
# → { "ref": "some-uuid", "message": "OTP sent..." }

# Step 2: Get OTP code (dev mode only)
curl http://localhost:3000/api/auth/otp/code/RETURNED_REF
# → { "code": "123456" }

# Step 3: Verify OTP
curl -X POST http://localhost:3000/api/auth/otp/verify \
  -H "Content-Type: application/json" \
  -d '{"ref": "RETURNED_REF", "code": "123456"}'
# → { "token": "eyJ...", "phone": "01700000000" }
```

---

## Environment variables

| Variable | Description | Default |
|---|---|---|
| `HOLD_TTL_SECONDS` | Seconds before an unpaid hold expires | 600 |
| `DATABASE_URL` | PostgreSQL connection string | — |
| `REDIS_URL` | Redis connection string | — |
| `JWT_SECRET` | JWT signing secret | — |
| `GATEWAY_URL` | Mock gateway base URL | http://gateway:9000 |
| `CALLBACK_BASE_URL` | Public URL of this server (for gateway callbacks) | — |
| `GATEWAY_SECRET` | HMAC secret for callback signature verification | z2p-2026-secret |

---

## CI/CD pipeline

GitHub Actions:
- **CI** runs on every push and pull request: server unit tests, client build, Docker image build
- **CD** runs on push to `main`: builds and pushes Docker images, deploys to Poridhi VM via SSH

Branch protection: `main` requires CI to pass before merging.

---

## Load test results

### Scenario A — One seat, 100 concurrent buyers

```
Requests sent:        100
Successful holds:     1   ✅
Cleanly rejected:     99  ✅
Oversell count:       0   ✅ (ZERO)
```

[Paste actual k6 output here]

### Scenario B — Abandoned hold

```
HOLD_TTL_SECONDS: 30
Seat held by User 1 at T+0s
Seat returned to available at T+~35s (sweeper interval)
User 2 successfully booked at T+36s ✅
```

[Paste actual k6 output here]

---

## What works

- [x] Movie and showtime browsing
- [x] Real-time seat map via WebSocket
- [x] Atomic seat holding (zero oversell)
- [x] Payment gateway integration (async callback)
- [x] Duplicate callback idempotency (event_id based)
- [x] Hold TTL expiry (background sweeper)
- [x] OTP login flow
- [x] OTP booking confirmation
- [x] QR code on confirmation
- [x] Webhook signature verification (HMAC-SHA256)
- [x] Gateway degradation banner
- [x] Live metrics dashboard
- [x] Docker Compose (single command)
- [x] GitHub Actions CI/CD
- [x] Deployed on Poridhi VM

## What we'd improve with more time

- Rate limiting per user (not just per IP)
- Booking history page
- Email/SMS notifications via real provider
- Seat map filtering by category
- Admin dashboard for theatre management
