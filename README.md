# PowerMesh — Load Shedding & Power Management Backend

**Node.js · Express 5 · TypeScript · PostgreSQL · Prisma 7 · Redis · bKash**

PowerMesh is a backend REST API for a load-shedding / power-management marketplace. It connects **consumers** (who need backup power during outages) with **providers** (who supply mobile/battery capacity) and **operators/admins** (who schedule outage events and run the allocation engine). The project ships with a complete API test-flow guide and a Postman collection.

---

## Table of Contents

- [Roles](#roles)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Demo Credentials](#demo-credentials)
- [API Overview](#api-overview)
- [Business Logic](#business-logic)
- [Project Structure](#project-structure)
- [Documentation](#documentation)

---

## Roles

| Role | Permissions (enforced via role middleware) |
|------|--------------------------------------------|
| **CONSUMER** | Register/verify, view events + offers, create capacity requests, create reservations, pay (bKash), confirm/dispute delivery |
| **PROVIDER** | Apply/verify, get approved, create/update/soft-delete offers, provider check-in + delivery report |
| **OPERATOR** | Create/update outage events, run allocation, resolve disputes, manage reservations/payments/requests |
| **ADMIN** | Everything operator + user management, blocking, audit logs, dashboard stats |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime / Framework | Node.js 20+, TypeScript, Express 5 (ESM) |
| Database / ORM | PostgreSQL + Prisma 7 (relations, `@@index`, `@@unique`, `$transaction`) |
| Validation | Zod (body validation on all mutating endpoints) |
| Auth | Email/Password (bcrypt) + Google OAuth2 (GCP), JWT access + refresh tokens in httpOnly cookies |
| Payments | bKash Tokenized Checkout (grant/refresh/create/execute/query, callback + idempotency keys) |
| Caching / State | Redis (OTP caching, pending registration, bKash token cache) |
| Email | Nodemailer + EJS templates (OTP emails) |
| Security | helmet, CORS, express-rate-limit |
| Linting / Formatting | Biome (via `lint`, `format`, `check` npm scripts) |
| Docs | Postman collection + `PowerMesh-mvp.html` spec + `API_TEST_FLOW.md` |

---

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL
- Redis
- Credentials for: bKash (sandbox), Google OAuth2 (GCP), SMTP

### Setup

```bash
# 1. Copy the env template and fill in real values
cp .env.example .env

# 2. Install dependencies
npm install

# 3. Create the database schema
npx prisma migrate dev

# 4. Generate the Prisma client
npx prisma generate

# 5. Run in development (tsx watch, auto-seeds demo users)
npm run dev
```

When `NODE_ENV=development`, the server auto-seeds one user per role so you can evaluate immediately.

### Build (production)

```bash
npm run build   # prisma generate + tsc -> emits to dist/
npm run dev     # recommended for local development
npm start       # node dist/src/server.js (after build)
```

---

## Environment Variables

All configuration is driven by environment variables. See `.env.example` for the full template. Key groups:

| Group | Variables |
|-------|-----------|
| Server | `NODE_ENV`, `PORT`, `FRONTEND_URL` |
| Database | `DATABASE_URL` |
| Auth | `BCRYPT_SALT_ROUNDS`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN` |
| Google OAuth2 | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| bKash | `BKASH_BASE_URL`, `BKASH_USERNAME`, `BKASH_PASSWORD`, `BKASH_APP_KEY`, `BKASH_APP_SECRET`, `BKASH_CALLBACK_URL` |
| Redis | `REDIS_USER`, `REDIS_PASSWORD`, `REDIS_HOST`, `REDIS_PORT` |
| SMTP | `SMTP_USER`, `EMAIL_SENDER`, `SMTP_PASSWORD` |
| Cloudinary (optional) | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` |
| Demo seed (dev only) | `SEED_ADMIN_*`, `SEED_PROVIDER_*`, `SEED_CONSUMER_*`, `SEED_OPERATOR_*` |

---

## Demo Credentials

Auto-seeded in development. Use these to log in via `POST /api/v1/auth/login` and obtain a Bearer token for protected routes.

| Role | Email | Password |
|------|-------|----------|
| **Admin** | `admin@powermesh.com` | `Admin@123` |
| **Operator** | `operator@powermesh.com` | `Operator@123` |
| **Provider** | `provider@powermesh.com` | `Provider@123` |
| **Consumer** | `consumer@powermesh.com` | `Consumer@123` |

---

## API Overview

All endpoints live under `/api/v1`. Full request/response examples are available in the Postman collection, `PowerMesh-mvp.html`, and a step-by-step walkthrough of every endpoint in [`API_TEST_FLOW.md`](./API_TEST_FLOW.md).

| Group | Base path | Endpoints |
|-------|-----------|-----------|
| Authentication | `/api/v1/auth` | register, verify-email, login, google-login, refresh-token, logout, me (7) |
| User profile | `/api/v1/users` | me (GET/PATCH), me/profile-picture (upload) (3) |
| Provider | `/api/v1/provider` | apply-as-provider, verify-email, approve-provider, reject-provider, all-providers, :id (6) |
| Offers | `/api/v1/offer` | create, all, my-offers, event/:id, :id, update, soft-delete (7) |
| Events | `/api/v1/event` | create, all, my-events, available, :id, update, status, soft-delete (8) |
| Requests | `/api/v1/request` | create, all, my-requests, event/:id, :id, update, cancel, soft-delete (8) |
| Reservations | `/api/v1/reservation` | create, all, my-reservations, provider/:id, :id, cancel (6) |
| Payments | `/api/v1/payments` | initiate, callback, my-payments, all, :id (5) |
| Delivery | `/api/v1/delivery` | :reservationId, provider-check-in, provider-report, consumer-confirm, consumer-dispute (5) |
| Admin | `/api/v1/admin` | overview, dashboard-stats, users, users/:id, block, soft-delete, audit-logs, allocate, approve-allocation, reservations/:id/status (10) |

### Response format

All endpoints return a consistent JSON envelope.

```jsonc
// Success
{ "success": true, "message": "Operation successful", "data": {}, "meta": {} }

// Error
{ "success": false, "message": "Something went wrong", "errors": [] }
```

---

## Business Logic

- **5-tier priority allocation engine** (`CRITICAL > HIGH > MEDIUM > LOW > FLEXIBLE`), greedy by price/start time, runs transactionally and writes an audit log.
- **bKash payment flow** with real gateway callbacks, idempotency keys, and `gatewayStatus` + `webhookStatus` tracking to prevent double-charges.
- **Delivery lifecycle**: provider check-in → provider report → consumer confirm (full / partial → prorated refund + incident) or dispute (operator resolution).
- **Soft deletes** (`deletedAt`) on all entities and **immutable audit logs** on critical actions.
- **Admin status override** for failure handling (`FAILED`/`REFUNDED` → refund + incident + capacity release).

---

## Project Structure

```
src/
  app.ts                 # Express app: helmet, CORS, rate-limit, routers
  server.ts              # Bootstrap: DB, Redis, SMTP, seeds, listen
  app/
    config/              # Env config
    lib/                 # prisma, redis, bkash, googleAuth, nodemailer
    middleware/          # checkAuth (JWT + role), validateRequest (Zod), globalErrorHandler, notFound
  modules/
    auth/ provider/ user/ offer/ event/
    capacity-request/ reservation/ payment/ delivery/ admin/
  utils/                 # catchAsync, sendResponse, appError, jwt
prisma/
  schema/                # Prisma schema (models + enums)
  migrations/            # Migrations
PowerMesh-Server.postman_collection.json   # Complete Postman collection
PowerMesh-mvp.html                         # Business model & MVP specification
API_TEST_FLOW.md                           # Step-by-step walkthrough of all API endpoints
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [`API_TEST_FLOW.md`](./API_TEST_FLOW.md) | Complete test flow: log in as each role and walk through all 64 endpoints with sample request/response bodies. |
| `PowerMesh-mvp.html` | Business model, MVP scope, API surface, tech stack, and roadmap. |
| `PowerMesh-Server.postman_collection.json` | Ready-to-import Postman collection with environment variables. |
