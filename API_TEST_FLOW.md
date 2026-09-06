# PowerMesh — API Test Flow

Complete step-by-step walkthrough of all **64 endpoints** under `/api/v1`. Run the steps in order — each step depends on the `data.id` captured from the previous step's response.

> **Prerequisites**
> - Start the server: `npm run dev` (auto-seeds demo users in development).
> - Base URL: `http://localhost:5000/api/v1`.
> - Replace `{{variable}}` placeholders with the captured values.
> - Every authenticated call needs `Authorization: Bearer <accessToken>` — capture the access token from the **login** response (`data.accessToken`) for each role.

---

## 0. Set up API variables

| Variable | Source |
|----------|--------|
| `{{consumerToken}}` | `data.accessToken` from Consumer login |
| `{{providerToken}}` | `data.accessToken` from Provider login |
| `{{operatorToken}}` | `data.accessToken` from Operator login |
| `{{adminToken}}` | `data.accessToken` from Admin login |
| `{{eventId}}` | `data.id` from event creation |
| `{{offerId}}` | `data.id` from offer creation |
| `{{requestId}}` | `data.id` from request creation |
| `{{reservationId}}` | `data.reservations[0].id` from allocation approval (or from manual reservation) |
| `{{paymentId}}` | `data.id` from payment initiation |
| `{{userId}}` | from `GET /api/v1/auth/me` (`data.id`) |
| `{{providerId}}` | `data.provider.id` (or `data.id`) from provider login / provider listing |

---

# Part A — Authentication & User Profile

## 1. Register a consumer (optional — alternative to seeded consumer)

`POST /api/v1/auth/register` — **public**
```json
{
  "firstName": "Rafiq",
  "lastName": "Ahmed",
  "email": "rafiq@example.com",
  "password": "Rafiq@12345",
  "consumer": {
    "contactPhone": "01711111111",
    "organizationName": "Rafiq Garments Ltd",
    "criticalLoadKw": 120,
    "address": "Gazipur, Dhaka",
    "contactPerson": "Rafiq Ahmed"
  }
}
```
> Sends a 6-digit OTP to the email. The account is created only after `verify-email`.

## 2. Verify consumer email

`POST /api/v1/auth/verify-email` — **public**
```json
{
  "email": "rafiq@example.com",
  "otp": "123456"
}
```
> Returns JWTs; capture `data.accessToken` → `{{consumerToken}}`.

## 3. Log in as each role

`POST /api/v1/auth/login` — **public**

**Operator**
```json
{ "email": "operator@powermesh.com", "password": "Operator@123" }
```
Capture `data.accessToken` → `{{operatorToken}}`.

**Provider**
```json
{ "email": "provider@powermesh.com", "password": "Provider@123" }
```
Capture `data.accessToken` → `{{providerToken}}`.

**Consumer**
```json
{ "email": "consumer@powermesh.com", "password": "Consumer@123" }
```
Capture `data.accessToken` → `{{consumerToken}}`.

**Admin**
```json
{ "email": "admin@powermesh.com", "password": "Admin@123" }
```
Capture `data.accessToken` → `{{adminToken}}`.

## 4. Get authenticated user profile

`GET /api/v1/auth/me` — **any role** (`Bearer {{consumerToken}}`)
> Capture `data.id` → `{{userId}}`.

## 5. Get / update own user profile

`GET /api/v1/users/me` — **any role**

`PATCH /api/v1/users/me` — **any role**
```json
{
  "firstName": "Rafiq",
  "lastName": "Ahmed",
  "imageUrl": "",
  "consumer": {
    "organizationName": "Rafiq Garments Ltd",
    "criticalLoadKw": 120,
    "address": "Gazipur, Dhaka",
    "contactPerson": "Rafiq Ahmed",
    "contactPhone": "01711111111"
  }
}
```

## 6. Google login (optional, requires GCP setup)

`POST /api/v1/auth/google-login` — **public**
```json
{
  "idToken": "YOUR_GOOGLE_ID_TOKEN"
}
```

## 7. Refresh token

`POST /api/v1/auth/refresh-token` — reads httpOnly cookie automatically; otherwise:
```json
{
  "refreshToken": "{{refreshToken}}"
}
```

## 8. Logout (do at the very end)

`POST /api/v1/auth/logout` — **any authenticated role**
> Clears the access/refresh cookies.

---

# Part B — Provider Onboarding

> The seeded provider (`provider@powermesh.com`) is already `APPROVED`. Steps 9–12 are for onboarding a **new** provider; skip them if you only use the seed.

## 9. Apply as provider

`POST /api/v1/provider/apply-as-provider` — **public**
```json
{
  "firstName": "Kamal",
  "lastName": "Hossain",
  "email": "kamal@example.com",
  "password": "Kamal@12345",
  "provider": {
    "companyName": "Kamal Power Solutions",
    "licenseNumber": "BERC-2026-0042",
    "resourceType": "GENERATOR",
    "capacityKw": 500,
    "address": "Savar EPZ, Dhaka",
    "contactPerson": "Kamal Hossain",
    "contactPhone": "01822222222",
    "bankAccountNumber": "1234567890123"
  }
}
```
> Sends a 6-digit OTP to the email; application data cached in Redis for 5 minutes.

## 10. Verify provider email

`POST /api/v1/provider/verify-email` — **public**
```json
{
  "email": "kamal@example.com",
  "otp": "654321"
}
```
> Creates the User + Provider record with status `PENDING_APPROVAL`.

## 11. Approve provider — Admin / Operator

`PATCH /api/v1/provider/approve-provider` — **Operator** token (`{{operatorToken}}`)
```json
{
  "providerId": "{{providerId}}"
}
```

## 12. List and inspect providers

`GET /api/v1/provider/all-providers` — **Admin / Operator**
> Query: `?page=1&limit=10&status=APPROVED`
> Capture a provider `data.id` → `{{providerId}}`.

`GET /api/v1/provider/:id` — **Admin / Operator**
> Path: `/api/v1/provider/{{providerId}}`

## 13. Reject provider (alternative — don't run on your test provider)

`PATCH /api/v1/provider/reject-provider` — **Admin / Operator**
```json
{
  "providerId": "{{providerId}}",
  "rejectionReason": "Incomplete license documentation"
}
```

---

# Part C — Outage Events

## 14. Operator creates an outage event

`POST /api/v1/event/create` — **Operator** token
```json
{
  "scheduledStart": "2026-09-08T09:00:00Z",
  "scheduledEnd": "2026-09-08T17:00:00Z",
  "totalCapacityKw": 500,
  "survivalQuotaKw": 200,
  "notes": "Test outage event"
}
```
Capture `data.id` → `{{eventId}}`.

## 15. Operator lists all events

`GET /api/v1/event/all` — **Admin / Operator**
> Query: `?page=1&limit=10&status=SCHEDULED&searchTerm=`

## 16. Operator lists own events

`GET /api/v1/event/my-events` — **Operator**

## 17. Provider / Consumer lists available events

`GET /api/v1/event/available` — **Consumer / Provider**

## 18. Get event detail

`GET /api/v1/event/:id` — **any role**
> Path: `/api/v1/event/{{eventId}}`

## 19. Operator updates an event

`PATCH /api/v1/event/update/:id` — **Operator** (only `SCHEDULED` events)
> Path: `/api/v1/event/update/{{eventId}}`
```json
{
  "notes": "Updated test outage event",
  "totalCapacityKw": 600
}
```

## 20. Operator changes event status

`PATCH /api/v1/event/status/:id` — **Operator**
> Path: `/api/v1/event/status/{{eventId}}`
```json
{
  "status": "CONFIRMED"
}
```
> Allowed transitions: `SCHEDULED → CONFIRMED → IN_PROGRESS → COMPLETED` (or `CANCELLED`).

## 21. Operator soft-deletes an event (alternative — destructive)

`PATCH /api/v1/event/soft-delete/:id` — **Operator** (blocked while the event has active offers/requests)

---

# Part D — Capacity Offers

## 22. Provider posts a capacity offer for the event

`POST /api/v1/offer/create` — **Provider** token
```json
{
  "eventId": "{{eventId}}",
  "capacityKw": 300,
  "pricePerKwh": 25,
  "deliveryStart": "2026-09-08T09:00:00Z",
  "deliveryEnd": "2026-09-08T17:00:00Z"
}
```
Capture `data.id` → `{{offerId}}`.

## 23. Provider lists own offers

`GET /api/v1/offer/my-offers` — **Provider**
> Query: `?status=AVAILABLE`

## 24. Admin / Operator lists all offers

`GET /api/v1/offer/all` — **Admin / Operator**
> Query: `?page=1&limit=10&status=AVAILABLE&eventId={{eventId}}&minCapacity=100&maxCapacity=500`

## 25. Consumer views offers for an event

`GET /api/v1/offer/event/:eventId` — **Admin / Operator / Consumer**
> Path: `/api/v1/offer/event/{{eventId}}`

## 26. Get offer detail

`GET /api/v1/offer/:id` — **Admin / Operator / Provider**
> Path: `/api/v1/offer/{{offerId}}`

## 27. Provider updates an offer

`PATCH /api/v1/offer/update/:id` — **Provider** (only `AVAILABLE` / `PARTIALLY_AVAILABLE` offers)
> Path: `/api/v1/offer/update/{{offerId}}`
```json
{
  "pricePerKwh": 24,
  "status": "AVAILABLE"
}
```

## 28. Provider soft-deletes an offer (alternative — destructive)

`PATCH /api/v1/offer/soft-delete/:id` — **Provider** (blocked while the offer has active reservations)

---

# Part E — Capacity Requests

## 29. Consumer creates a capacity request for the event

`POST /api/v1/request/create` — **Consumer** token
```json
{
  "eventId": "{{eventId}}",
  "requestedKw": 100,
  "maxPricePerKwh": 30,
  "priorityTier": "CRITICAL"
}
```
Capture `data.id` → `{{requestId}}`.

> Optional: create a second request to see ranking behavior.
```json
{
  "eventId": "{{eventId}}",
  "requestedKw": 80,
  "maxPricePerKwh": 20,
  "priorityTier": "LOW"
}
```
Capture `data.id` → `{{secondRequestId}}`.

## 30. Consumer lists own requests

`GET /api/v1/request/my-requests` — **Consumer**
> Query: `?status=PENDING&priorityTier=CRITICAL`

## 31. Admin / Operator lists all requests

`GET /api/v1/request/all` — **Admin / Operator**
> Query: `?page=1&limit=10&priorityTier=CRITICAL&eventId={{eventId}}`

## 32. Get requests for an event

`GET /api/v1/request/event/:eventId` — **Admin / Operator / Consumer**
> Path: `/api/v1/request/event/{{eventId}}`

## 33. Get request detail

`GET /api/v1/request/:id` — **Admin / Operator / Consumer (owner)**
> Path: `/api/v1/request/{{requestId}}`

## 34. Consumer updates a request

`PATCH /api/v1/request/update/:id` — **Consumer** (only `PENDING` requests)
> Path: `/api/v1/request/update/{{requestId}}`
```json
{
  "maxPricePerKwh": 28
}
```

## 35. Consumer cancels a request (alternative — destructive)

`PATCH /api/v1/request/cancel/:id` — **Consumer** (only `PENDING` requests)

## 36. Consumer soft-deletes a request (alternative — destructive)

`PATCH /api/v1/request/soft-delete/:id` — **Consumer** (only `PENDING` requests)

---

# Part F — Allocation

## 37. Operator previews the allocation plan

`POST /api/v1/admin/events/{{eventId}}/allocate` — **Operator** token
> Returns the proposed plan (matched requests, skipped requests, allocated kW) **without persisting anything**.

## 38. Operator approves the allocation → reservations created

`POST /api/v1/admin/events/{{eventId}}/approve-allocation` — **Operator** token
> Creates `ALLOCATED` reservations, marks requests `ALLOCATED`, updates offer/event capacity, writes an audit log.
> Capture `data.reservations[0].id` (or check via `GET /api/v1/reservation/all`) → `{{reservationId}}`.

---

# Part G — Reservations

## 39. Consumer creates a reservation manually (alternative to approval)

`POST /api/v1/reservation/create` — **Consumer** token
```json
{
  "offerId": "{{offerId}}",
  "requestId": "{{requestId}}"
}
```
Capture `data.id` → `{{reservationId}}`.

## 40. Consumer lists own reservations

`GET /api/v1/reservation/my-reservations` — **Consumer**
> Query: `?status=ALLOCATED`

## 41. Admin / Operator lists all reservations

`GET /api/v1/reservation/all` — **Admin / Operator**
> Query: `?page=1&limit=10&status=ALLOCATED&eventId={{eventId}}`

## 42. Provider lists reservations assigned to them

`GET /api/v1/reservation/provider/:providerId` — **Provider / Admin / Operator**
> Path: `/api/v1/reservation/provider/{{providerId}}`

## 43. Get reservation detail

`GET /api/v1/reservation/:id` — **any role**
> Path: `/api/v1/reservation/{{reservationId}}`

## 44. Consumer cancels a reservation (alternative — destructive)

`PATCH /api/v1/reservation/cancel/:id` — **Consumer**
> Releases offer capacity + cancels the linked request.

---

# Part H — Payments (bKash sandbox)

## 45. Consumer initiates payment for the reservation

`POST /api/v1/payments/initiate` — **Consumer** token
```json
{
  "reservationId": "{{reservationId}}"
}
```
> Returns `data.bkashURL`, `data.paymentID`, and the payment record (`gatewayStatus: PROCESSING`).
> Capture `data.id` → `{{paymentId}}`.

## 46. Complete payment at the bKash sandbox

1. Open `data.bkashURL` in a browser (bKash sandbox).
2. Complete the payment — bKash redirects the browser to the backend callback:
   `GET http://localhost:5000/api/v1/payments/callback?paymentID=...&status=success`
3. The callback executes the payment (`/tokenized/checkout/execute`), marks the payment `COMPLETED`, sets the reservation to `PAYMENT_COMPLETED`, and **redirects** to the frontend: `http://localhost:3000/my-payments?status=success`.
   > On `failure`/`cancel` the reservation is released back to `ALLOCATED` and the browser is redirected to `/my-payments?status=failure|cancel` instead.

## 47. Consumer lists own payments

`GET /api/v1/payments/my-payments` — **Consumer**
> Verify `gatewayStatus: COMPLETED` and `GET /api/v1/reservation/my-reservations` shows `status: PAYMENT_COMPLETED`.
> Query: `?gatewayStatus=COMPLETED&page=1&limit=10`

## 48. Admin / Operator lists all payments

`GET /api/v1/payments/all` — **Admin / Operator**
> Query: `?gatewayStatus=COMPLETED&searchTerm=`

## 49. Get payment detail

`GET /api/v1/payments/:id` — **any role**
> Path: `/api/v1/payments/{{paymentId}}`

---

# Part I — Delivery

## 50. Get delivery record for a reservation

`GET /api/v1/delivery/:reservationId` — **any role**
> Path: `/api/v1/delivery/{{reservationId}}`

## 51. Provider checks in

`POST /api/v1/delivery/:reservationId/provider-check-in` — **Provider** token
> Path: `/api/v1/delivery/{{reservationId}}/provider-check-in`
> Moves the reservation to `DELIVERY_PENDING`.

## 52. Provider reports delivered capacity

`POST /api/v1/delivery/:reservationId/provider-report` — **Provider** token
> Path: `/api/v1/delivery/{{reservationId}}/provider-report`
```json
{
  "actualDeliveredKw": 100
}
```

## 53. Consumer confirms delivery

`POST /api/v1/delivery/:reservationId/consumer-confirm` — **Consumer** token
> Path: `/api/v1/delivery/{{reservationId}}/consumer-confirm`
> No body required. If the provider reported full capacity, delivery is confirmed; if less was reported, a partial refund + incident is created automatically.

## 54. Consumer disputes delivery (alternative path)

`POST /api/v1/delivery/:reservationId/consumer-dispute` — **Consumer** token
> Path: `/api/v1/delivery/{{reservationId}}/consumer-dispute`
```json
{
  "disputeReason": "Provider delivered less than requested."
}
```

---

# Part J — Admin / Operator Operations

## 55. Admin dashboard overview

`GET /api/v1/admin/overview` — **Admin** token
> Aggregated dashboard counts.

## 56. Admin dashboard stats

`GET /api/v1/admin/dashboard-stats` — **Admin** token
> Extended stats: payments, revenue, refunds, incidents.

## 57. Admin lists users

`GET /api/v1/admin/users` — **Admin**
> Query: `?role=CONSUMER&status=ACTIVE&searchTerm=rafiq&page=1&limit=10`
> Capture a user `data.id` → `{{userId}}`.

## 58. Admin gets user detail

`GET /api/v1/admin/users/:id` — **Admin**
> Path: `/api/v1/admin/users/{{userId}}`

## 59. Admin blocks / unblocks a user

`PATCH /api/v1/admin/users/:id/block` — **Admin**
> Path: `/api/v1/admin/users/{{userId}}/block`
```json
{
  "isBlocked": true,
  "reason": "Payment dispute under review"
}
```
> Unblock with `{ "isBlocked": false }` after testing.

## 60. Admin soft-deletes a user (alternative — destructive)

`PATCH /api/v1/admin/users/:id/soft-delete` — **Admin**

## 61. Admin reads audit logs

`GET /api/v1/admin/audit-logs` — **Admin**
> Query: `?action=ALLOCATE&entityType=Reservation&page=1&limit=10`

## 62. Admin / Operator overrides reservation status

`PATCH /api/v1/admin/reservations/:id/status` — **Admin / Operator**
> Path: `/api/v1/admin/reservations/{{reservationId}}/status`
```json
{
  "status": "REFUNDED",
  "paymentStatus": "REFUNDED",
  "resolution": "Provider failure — automatic refund processed"
}
```
> `FAILED`/`REFUNDED` create a refund + incident and release capacity.
> Status options: `ALLOCATED`, `PAYMENT_PENDING`, `PAYMENT_COMPLETED`, `DELIVERY_PENDING`, `DELIVERY_CONFIRMED`, `DELIVERY_PARTIAL`, `FAILED`, `REFUNDED`, `CANCELLED`.

---

# Full endpoint index

| # | Method | Endpoint | Token |
|---|--------|----------|-------|
| 1 | POST | `/api/v1/auth/register` | public |
| 2 | POST | `/api/v1/auth/verify-email` | public |
| 3 | POST | `/api/v1/auth/login` | public |
| 4 | POST | `/api/v1/auth/google-login` | public |
| 5 | POST | `/api/v1/auth/refresh-token` | public |
| 6 | POST | `/api/v1/auth/logout` | any |
| 7 | GET | `/api/v1/auth/me` | any |
| 8 | GET | `/api/v1/users/me` | any |
| 9 | PATCH | `/api/v1/users/me` | any |
| 10 | POST | `/api/v1/provider/apply-as-provider` | public |
| 11 | POST | `/api/v1/provider/verify-email` | public |
| 12 | PATCH | `/api/v1/provider/approve-provider` | ADMIN, OPERATOR |
| 13 | PATCH | `/api/v1/provider/reject-provider` | ADMIN, OPERATOR |
| 14 | GET | `/api/v1/provider/all-providers` | ADMIN, OPERATOR |
| 15 | GET | `/api/v1/provider/:id` | ADMIN, OPERATOR |
| 16 | POST | `/api/v1/offer/create` | PROVIDER |
| 17 | GET | `/api/v1/offer/all` | ADMIN, OPERATOR |
| 18 | GET | `/api/v1/offer/my-offers` | PROVIDER |
| 19 | GET | `/api/v1/offer/event/:eventId` | ADMIN, OPERATOR, CONSUMER |
| 20 | GET | `/api/v1/offer/:id` | ADMIN, OPERATOR, PROVIDER |
| 21 | PATCH | `/api/v1/offer/update/:id` | PROVIDER |
| 22 | PATCH | `/api/v1/offer/soft-delete/:id` | PROVIDER |
| 23 | POST | `/api/v1/event/create` | OPERATOR |
| 24 | GET | `/api/v1/event/all` | ADMIN, OPERATOR |
| 25 | GET | `/api/v1/event/my-events` | OPERATOR |
| 26 | GET | `/api/v1/event/available` | CONSUMER, PROVIDER |
| 27 | GET | `/api/v1/event/:id` | any |
| 28 | PATCH | `/api/v1/event/update/:id` | OPERATOR |
| 29 | PATCH | `/api/v1/event/status/:id` | OPERATOR |
| 30 | PATCH | `/api/v1/event/soft-delete/:id` | OPERATOR |
| 31 | POST | `/api/v1/request/create` | CONSUMER |
| 32 | GET | `/api/v1/request/all` | ADMIN, OPERATOR |
| 33 | GET | `/api/v1/request/my-requests` | CONSUMER |
| 34 | GET | `/api/v1/request/event/:eventId` | ADMIN, OPERATOR, CONSUMER |
| 35 | GET | `/api/v1/request/:id` | ADMIN, OPERATOR, CONSUMER |
| 36 | PATCH | `/api/v1/request/update/:id` | CONSUMER |
| 37 | PATCH | `/api/v1/request/cancel/:id` | CONSUMER |
| 38 | PATCH | `/api/v1/request/soft-delete/:id` | CONSUMER |
| 39 | POST | `/api/v1/reservation/create` | CONSUMER |
| 40 | GET | `/api/v1/reservation/all` | ADMIN, OPERATOR |
| 41 | GET | `/api/v1/reservation/my-reservations` | CONSUMER |
| 42 | GET | `/api/v1/reservation/provider/:providerId` | PROVIDER, ADMIN, OPERATOR |
| 43 | GET | `/api/v1/reservation/:id` | any |
| 44 | PATCH | `/api/v1/reservation/cancel/:id` | CONSUMER |
| 45 | POST | `/api/v1/payments/initiate` | CONSUMER |
| 46 | GET | `/api/v1/payments/callback` | public (bKash redirect) |
| 47 | GET | `/api/v1/payments/my-payments` | CONSUMER |
| 48 | GET | `/api/v1/payments/all` | ADMIN, OPERATOR |
| 49 | GET | `/api/v1/payments/:id` | any |
| 50 | GET | `/api/v1/delivery/:reservationId` | any |
| 51 | POST | `/api/v1/delivery/:reservationId/provider-check-in` | PROVIDER |
| 52 | POST | `/api/v1/delivery/:reservationId/provider-report` | PROVIDER |
| 53 | POST | `/api/v1/delivery/:reservationId/consumer-confirm` | CONSUMER |
| 54 | POST | `/api/v1/delivery/:reservationId/consumer-dispute` | CONSUMER |
| 55 | GET | `/api/v1/admin/overview` | ADMIN |
| 56 | GET | `/api/v1/admin/dashboard-stats` | ADMIN |
| 57 | GET | `/api/v1/admin/users` | ADMIN |
| 58 | GET | `/api/v1/admin/users/:id` | ADMIN |
| 59 | PATCH | `/api/v1/admin/users/:id/block` | ADMIN |
| 60 | PATCH | `/api/v1/admin/users/:id/soft-delete` | ADMIN |
| 61 | GET | `/api/v1/admin/audit-logs` | ADMIN |
| 62 | POST | `/api/v1/admin/events/:id/allocate` | ADMIN, OPERATOR |
| 63 | POST | `/api/v1/admin/events/:id/approve-allocation` | ADMIN, OPERATOR |
| 64 | PATCH | `/api/v1/admin/reservations/:id/status` | ADMIN, OPERATOR |

---

# Expected happy-path summary

```
login (role) → event/create → offer/create → request/create → allocate (preview)
→ approve-allocation → reservation ALLOCATED → payments/initiate → bKash sandbox
→ payment COMPLETED → reservation PAYMENT_COMPLETED → provider-check-in
→ provider-report → consumer-confirm → reservation DELIVERY_CONFIRMED
```

> Where partial delivery occurs (`actualDeliveredKw < reserved`), a prorated refund + incident is created automatically on `consumer-confirm`. Disputed deliveries remain `DELIVERY_STATUS = DISPUTED` until an operator resolves them via `PATCH /api/v1/admin/reservations/:id/status`.