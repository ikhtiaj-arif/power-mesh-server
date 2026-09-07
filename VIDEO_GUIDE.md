# PowerMesh Backend — 5–7 Minute Video Guide

**Goal:** Walk through the system architecture, design flow, and a live API demo in one take.
**Live URL:** https://power-mesh-server.onrender.com
**Postman collection:** `PowerMesh-Server.postman_collection.json`
**Full walkthrough:** `API_TEST_FLOW.md`

> How to switch the Postman collection to the live server: Collection → Variables →
> `baseUrl` = `https://power-mesh-server.onrender.com/api/v1` and
> `serverRoot` = `https://power-mesh-server.onrender.com`.
> Note that the free Render instance spins down after inactivity — the first request may
> take 30–60s to wake it.

---

## Timing & Segment Plan (total ≈ 6:30)

| Min | Segment | Content |
|-----|---------|---------|
| 0:00–0:30 | 1. Intro | What PowerMesh is + roles |
| 0:30–1:30 | 2. Architecture | Request pipeline, tech stack, deployment |
| 1:30–2:45 | 3. Database design | ERD: 14 tables, enums, cardinality |
| 2:45–4:00 | 4. Business flows | Outage lifecycle end-to-end |
| 4:00–6:15 | 5. Live API demo | Real requests against the live URL |
| 6:15–6:30 | 6. Wrap-up | What's in the repo + how to run locally |

---

## Segment 1 — Intro (0:00–0:30)

> *"PowerMesh is a load-shedding and power-management marketplace. During an outage,
> consumers who need backup power are matched with providers who supply mobile or battery
> capacity, and operators schedule outage events and run the allocation engine."*

Key talking points:
- This is the **backend only** — a REST API, no frontend.
- Three core roles: **Consumer** (buys backup capacity), **Provider** (sells capacity),
  **Operator/Admin** (schedules outages, allocates resources, resolves disputes).

---

## Segment 2 — Architecture (0:30–1:30)

Show this flow while narrating:

```
Browser / Postman
  │  HTTP (JSON)
  ▼
Express 5 app (TypeScript, ESM)
  ├─ helmet (security headers)
  ├─ cors (FRONTEND_URL, credentials)
  ├─ express-rate-limit (global 200/15min, auth/payment 30/15min)
  ├─ json + urlencoded + cookieParser
  ├─ /api/health  ← keep-alive + monitoring
  ├─ /api/v1/{auth, provider, user, offer, event, request,
  │            reservation, payment, delivery, admin}
  │    └─ Router → middleware (auth + role, Zod validateRequest)
  │                    → Controller (catchAsync)
  │                    → Service  (business logic)
  │                    → Prisma Client (pg adapter)
  │
  ▼
External services:
  ├─ PostgreSQL on Neon   (Prisma 7 ORM, migrations in prisma/migrations)
  ├─ Redis                (OTP cache, pending registrations, bKash token cache)
  ├─ bKash Tokenized Checkout (payment gateway, idempotency keys)
  └─ SMTP (Gmail)         (OTP / welcome emails via EJS templates)
```

Narration points:
- **Layered module pattern** (per domain folder):
  `*.routes.ts` (guard: `auth(UserRole.X)` + `validateRequest(zodSchema)`) →
  `*.controller.ts` (HTTP layer, `catchAsync` + `sendResponse`) →
  `*.service.ts` (business logic) → Prisma.
- **Consistent response envelope**: success `{success, message, data, meta}`,
  errors via `globalErrorHandler` + `AppError`.
- **Security**: JWT access+refresh in httpOnly cookies, bcrypt hashing, helmet, CORS, rate limit.
- **Deployment**: Render (free) + Neon Postgres + Redis Cloud; GitHub Action `keep-alive.yml`
  pings `/api/health` every 10 min to reduce free-tier sleep.

---

## Segment 3 — Database Design (1:30–2:45)

Use the exported ERD (`DrawSQL-ERD.json`, viewable at the DrawSQL link in README).

Narration points:
- **14 tables**, all `id` = UUID PK; every table has `createdAt`/`updatedAt`, critical ones have
  soft-delete `deletedAt`.
- **1:1 "profile" pattern**: a `User` (auth + role) has at most one
  `Provider` / `Consumer` / `Operator` (each `userId` unique).
- **Core hub = `Reservations`** — it bridges Offer + Request + Consumer + Provider and fans out to
  one `Payment`, one `Delivery`, one `Rating`, many `Incidents`/`Refunds`.
- **Polymorphism via named relations** for ratings: `consumer_ratings` and `provider_ratings`.
- **Enums** (from `prisma/schema/enums.prisma`): roles, statuses, `PriorityTier`
  (`CRITICAL > HIGH > MEDIUM > LOW > FLEXIBLE`), payment/delivery/incident/audit states —
  status is enforced at the DB level, not just in app code.
- **Unique / index strategy**: compound uniques (`@@unique([providerId, eventId, deliveryStart, deliveryEnd])`,
  one active request per consumer per event, one reservation per offer+request), plus covering
  indexes on the hot query paths (`eventId+status`, `consumerId+status`, etc.).

---

## Segment 4 — Business Flows (2:45–4:00)

Trace one full outage lifecycle on the ERD:

1. **Operator** creates an `OutageEvent` (scheduled window, total capacity, survival quota).
2. **Provider** creates a `CapacityOffer` against that event (kW, price, delivery window).
3. **Consumer** creates a `CapacityRequest` (kW needed, max price, priority tier).
4. **Allocation engine** (admin) matches requests to offers **greedily by tier and price** inside a
   `$transaction`, tags reservations `ALLOCATED`, decrements `reservedKw`, writes an `AuditLog`.
5. **Consumer** creates a `Reservation` and **initiates payment** (bKash) → idempotency key +
   webhook handling prevents double charges; `PaymentMethod`, `gatewayStatus`, `webhookStatus`.
6. **Delivery phase**: provider check-in → provider report (actual kW) → consumer confirm
   (full → completed; partial → prorated `Refund` + `Incident`; dispute → operator `IncidentStatus.RESOLVED`).
7. **After delivery**: consumer leaves a `Rating`; failures handled by admin status override
   (FAILED/REFUNDED → refund + capacity release + incident).

---

## Segment 5 — Live API Demo (4:00–6:15)

> Deployed URL: `https://power-mesh-server.onrender.com`
> Postman: set `baseUrl`/`serverRoot` to the live URL, or run cURL.
> Reminder: first request wakes the free instance (~30–60s).

### 5.1 Health check (proves the server is live) — 15s

```bash
curl -L https://power-mesh-server.onrender.com/api/health
```

Expect `{ "status": "ok", "timestamp": "..." }`. Show this on screen as *“the server is alive.”*

### 5.2 Login as Operator — 30s

```bash
curl -L -c cookies.txt -X POST https://power-mesh-server.onrender.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"operator@powermesh.com","password":"Operator@123"}'
```

Expect `success: true`, access token issued (cookie or body depending on implementation).
Show the Bearer token being saved to the Postman `accessToken` variable.

### 5.3 Create an outage event (operator action) — 30s

```bash
curl -L -X POST https://power-mesh-server.onrender.com/api/v1/event/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {{accessToken}}" \
  -d '{
    "scheduledStart": "<now+1h ISO>",
    "scheduledEnd": "<now+6h ISO>",
    "totalCapacityKw": 1000,
    "survivalQuotaKw": 200
  }'
```

### 5.4 Provider login + create offer — 45s

```bash
curl -L -X POST https://power-mesh-server.onrender.com/api/v1/auth/login \
  -d '{"email":"provider@powermesh.com","password":"Provider@123"}' \
  -H "Content-Type: application/json"
```

Then `POST /api/v1/offer/create` with `{ eventId, capacityKw, pricePerKwh, deliveryStart, deliveryEnd }`.

### 5.5 Consumer login + create request — 45s

```bash
curl -L -X POST https://power-mesh-server.onrender.com/api/v1/auth/login \
  -d '{"email":"consumer@powermesh.com","password":"Consumer@123"}' \
  -H "Content-Type: application/json"
```

Then `POST /api/v1/request/create` with `{ eventId, requestedKw, maxPricePerKwh, priorityTier }`.

### 5.6 Run allocation (admin) — 30s

```bash
curl -L -X POST https://power-mesh-server.onrender.com/api/v1/admin/allocate \
  -H "Content-Type: application/json" -H "Authorization: Bearer {{accessToken_admin}}"
```

Expect reservations to be created, offers' `reservedKw` to increase, audit log written.

### 5.7 Money shot — payments + delivery (narrate only) — 30s

If time allows, briefly show `POST /api/v1/payments/initiate` (bKash) and the delivery
check-in/confirm endpoints; otherwise narrate them and point at `API_TEST_FLOW.md` which
walks through all 64 endpoints with sample bodies.

### 5.8 Postman tip — 15s

- `Authorization` tab is pre-configured as Bearer `{{accessToken}}` at collection level.
- Set `baseUrl` once; every request picks it up. Switch local ↔ deployed by editing one variable.

---

## Segment 6 — Wrap-up (6:15–6:30)

Summarize:
- **What was proven live**: health endpoint, real auth, event/offer/request creation, allocation.
- **Repo highlights**: Prisma schema (models + enums), migrations, `API_TEST_FLOW.md`,
  `PowerMesh-Server.postman_collection.json`, `DrawSQL-ERD.json`, CI keep-alive.
- **Run locally**: `cp .env.example .env` → `npm install` → `npx prisma migrate dev`
  → `npm run dev` (auto-seeds the 4 demo users). Build: `npm run build` + `npm start`.

---

## Presenter Cheat Sheet

- **Demo credentials** (seeded in dev and prod via `RUN_SEEDS=true`):
  Admin `admin@powermesh.com` / `Admin@123` · Operator `operator@powermesh.com` / `Operator@123`
  Provider `provider@powermesh.com` / `Provider@123` · Consumer `consumer@powermesh.com` / `Consumer@123`
- **Don't forget** the first live request wakes the free Render instance.
- Keep the ERD (DrawSQL) open side-by-side during Segments 3–4 to connect tables to flows.
- Reference `API_TEST_FLOW.md` if a demo endpoint needs an exact request body.