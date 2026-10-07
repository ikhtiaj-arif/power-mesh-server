# Deployment (power-mesh-server)

Pair this API with the Next app using matching origins and `ISR_SERVICE_TOKEN`.

## Env templates

| Stage | File |
| --- | --- |
| Local | [`.env.example`](../.env.example) → `.env` |
| Production | [`.env.production.example`](../.env.production.example) → host dashboard |

Cross-app checklist (CORS, bKash, ISR, cookies): see the sibling client doc [`power-mesh-client/docs/DEPLOYMENT.md`](../../power-mesh-client/docs/DEPLOYMENT.md) when both clones share a parent folder.

## Production commands

```bash
npx prisma migrate deploy
npx prisma generate
npm run build
npm start
```

### Render notes

- Use **Node 20+** (`NODE_VERSION=20` or `.nvmrc`). Stripe v23 will not install cleanly on older Node.
- Build command should install deps from the lockfile, e.g. `npm ci && npx prisma migrate deploy && npm run build`.
- If logs show `Could not resolve "stripe"` / `ERR_MODULE_NOT_FOUND`, **clear the Render build cache** once and redeploy (stale `node_modules` from before the Stripe dependency was added).

## Must-match with Next.js

| Express | Next |
| --- | --- |
| `FRONTEND_URL` | `NEXT_PUBLIC_APP_URL` |
| public API origin used by Next | `API_URL` |
| `ISR_SERVICE_TOKEN` | `ISR_SERVICE_TOKEN` |
| `BKASH_CALLBACK_URL` | API only (`…/api/v1/payments/callback`) |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | API only; webhook `POST …/api/v1/payments/webhook/stripe` |
