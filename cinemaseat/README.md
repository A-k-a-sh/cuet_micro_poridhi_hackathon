# CinemaSeat

> **Build a movie booking system that stays calm when Brand New Day drops, and never sells the same seat twice.**

## Overview
CinemaSeat is a high-concurrency movie ticket booking platform built to withstand intense traffic bursts without double-booking seats.

## Tech Stack
- **Backend:** Node.js, Express (ES Modules)
- **Database:** PostgreSQL (Persistent storage)
- **Cache & Locks:** Redis (Atomic distributed locks / seat holds)
- **Frontend:** React, Vite, Tailwind CSS, Framer Motion
- **Real-time:** WebSocket (`ws`)
- **Gateway:** Mock Gateway (`asifmahmoud414/mock-gateway:latest`)
- **DevOps:** Docker, Docker Compose, GitHub Actions, k6

## Key Judging Endpoints
- **Health Check:** `GET /health` (Returns HTTP 200 in <1s even when gateway is down)
- **Seat Hold Request:** `POST /api/holds`
- **Seat Map Fetch:** `GET /api/shows/:showId/seats`

## Local Setup & Run
```bash
docker compose up --build
```

Access services:
- **Server:** `http://localhost:3000`
- **Client:** `http://localhost:5173`
- **Gateway:** `http://localhost:9000`
