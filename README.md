# PowerMesh — Load Shedding & Power Management Backend

**Node.js + Express 5 + TypeScript + PostgreSQL + Prisma + Redis + bKash**

PowerMesh is a backend-only REST API for a load-shedding / power-management marketplace. It connects **consumers** (who need backup power during outages) with **providers** (who supply mobile/battery capacity) and **operators/admins** (who schedule outage events and run the allocation engine). No frontend is required — everything is demonstrated via the included Postman collection.

---

## 🧩 Roles

| Role | Permissions (enforced via role middleware) |
|------|--------------------------------------------|
| **CONSUMER** | Register/verify, view events + offers, create capacity requests, create reservations, pay (bKash), confirm/dispute delivery |
| **PROVIDER** | Apply/verify, get approved, create/update/soft-delete offers, provider check-in + delivery report |
| **OPERATOR** | Create/update outage events, run allocation, resolve disputes, manage reservations/payments/requests |
| **ADMIN** | Everything operator + user management, blocking, audit logs, dashboard stats |

---

## ⚙️ Tech Stack

- **Runtime/Framework:** Node.js, TypeScript, Express.js (ESM)
- **Database/ORM:** PostgreSQL + Prisma 7 (relations, `@@index`, `@@unique`, `$transaction`)
- **Validation:** Zod (body validation on all mutating endpoints)
- **Auth:** Email/Password (bcrypt) + Google OAuth2 (GCP), JWT access + refresh tokens in httpOnly cookies
- **Payments:** bKash Tokenized Checkout (grant/refresh/create/execute/query, callback + idempotency keys)
- **Caching/State:** Redis (OTP caching, pending registration, bKash token cache)
- **Email:** Nodemailer + EJS templates (OTP emails)
- **Security:** helmet, CORS, express-rate-limit
- **Docs:** Postman collection (`PowerMesh-Server.postman_collection.json`) + `PowerMesh-mvp.html` spec

---

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- PostgreSQL, Redis, and credentials for bKash (sandbox), Google OAuth2 (GCP), SMTP

### Setup
```bash
# 1. Copy env template and fill in real values
cp .env.example .env

# 2. Install dependencies
npm install

# 3. Create database schema
npx prisma migrate dev

# 4. Generate the Prisma client
npx prisma generate

# 5. Run in development (tsx watch)
npm run dev
```

In `NODE_ENV=development`, the server auto-seeds one user per role so you can evaluate immediately.

### Build (type-check only validation)
```bash
npm run build        # prisma generate + tsc -> emits to dist/
npm run dev          # recommended for running locally
```

---

## 🔑 Demo Credentials (auto-seeded in development)

| Role | Email | Password |
|------|-------|----------|
| **Admin** | `admin@powermesh.com` | `Admin@123` |
| **Provider** | `provider@powermesh.com` | `Provider@123` |
| **Consumer** | `consumer@powermesh.com` | `Consumer@123` |

Use these to log in via `POST /api/v1/auth/login` and obtain a Bearer token for protected routes.

---

## 📌 API Surface (64 endpoints, all under `/api/v1`)

| Group | Base path | Endpoints |
|-------|-----------|-----------|
| Authentication | `/api/v1/auth` | register, verify-email, login, google-login, refresh-token, logout, me (7) |
| User profile | `/api/v1/users` | me (GET/PATCH) (2) |
| Provider | `/api/v1/provider` | apply-as-provider, verify-email, approve-provider, reject-provider, all-providers, :id (6) |
| Offers | `/api/v1/offer` | create, all, my-offers, event/:id, :id, update, soft-delete (7) |
| Events | `/api/v1/event` | create, all, my-events, available, :id, update, status, soft-delete (8) |
| Requests | `/api/v1/request` | create, all, my-requests, event/:id, :id, update, cancel, soft-delete (8) |
| Reservations | `/api/v1/reservation` | create, all, my-reservations, provider/:id, :id, cancel (6) |
| Payments | `/api/v1/payments` | initiate, callback, my-payments, all, :id (5) |
| Delivery | `/api/v1/delivery` | :reservationId, provider-check-in, provider-report, consumer-confirm, consumer-dispute (5) |
| Admin | `/api/v1/admin` | overview, dashboard-stats, users, users/:id, block, soft-delete, audit-logs, allocate, approve-allocation, reservations/:id/status (10) |

> Full request/response examples are in the Postman collection and `PowerMesh-mvp.html`.

### Response format
```jsonc
// Success
{ "success": true, "message": "Operation successful", "data": {}, "meta": {} }

// Error
{ "success": false, "message": "Something went wrong", "errors": [] }
```

---

## ⚡ Business Logic Highlights

- **5-tier priority allocation engine** (`CRITICAL > HIGH > MEDIUM > LOW > FLEXIBLE`), greedy by price/start time, runs transactionally and writes an audit log.
- **bKash payment flow** with real gateway callbacks, idempotency keys, and `gatewayStatus` + `webhookStatus` tracking to prevent double-charges.
- **Delivery lifecycle**: provider check-in → provider report → consumer confirm (full / partial → prorated refund + incident) or dispute (operator resolution).
- **Soft deletes** (`deletedAt`) on all entities and **immutable audit logs** on critical actions.
- **Admin status override** for failure handling (`FAILED`/`REFUNDED` → refund + incident + capacity release).

---

## 🗂 Project Structure

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
PowerMesh-Server.postman_collection.json
PowerMesh-mvp.html
```

---

## 📦 Submission Checklist

- [x] 20+ meaningful commits (`feat:`, `fix:`, `docs:`)
- [x] 64 real, database-backed endpoints, versioned `/api/v1`
- [x] Consistent success/error JSON responses
- [x] Zod validation on all mutating endpoints
- [x] Email/Password + Google Social login, 3+ roles with RBAC
- [x] Demo admin credentials (see above)
- [x] Real bKash payment integration with status tracking
- [x] PostgreSQL + Prisma: relationships, constraints, indexing, transactions
- [x] Pagination, filtering, sorting, and search on list endpoints
- [x] Soft deletes + audit logs
- [x] Redis caching, rate limiting, helmet security headers

---

**Assignment:** PowerMesh MVP — Bangladesh Load-Shedding Marketplace
