/**
 * Smoke-test Stripe checkout + webhook (local).
 * Uses seeded consumer + first ALLOCATED reservation when available.
 */
import crypto from "node:crypto";
import Stripe from "stripe";

const API = process.env.API_URL || "http://localhost:5000/api/v1";
const SECRET = process.env.STRIPE_SECRET_KEY;
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const EMAIL = process.env.SEED_CONSUMER_EMAIL || "consumer@powermesh.com";
const PASSWORD = process.env.SEED_CONSUMER_PASSWORD || "Consumer@123";

if (!SECRET || !WEBHOOK_SECRET) {
  console.error("Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET");
  process.exit(1);
}

const stripe = new Stripe(SECRET);

async function waitForHealth(retries = 30) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch("http://localhost:5000/api/health");
      if (res.ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("API health check failed");
}

async function login() {
  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const json = await res.json();
  if (!res.ok || !json?.data?.accessToken) {
    throw new Error(`Login failed: ${JSON.stringify(json)}`);
  }
  return json.data.accessToken as string;
}

async function findPayableReservation(token: string) {
  const res = await fetch(`${API}/reservation/my-reservations?page=1&limit=50`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  const rows = json?.data ?? [];
  return rows.find((r: { status: string }) =>
    ["ALLOCATED", "PAYMENT_PENDING"].includes(r.status),
  ) as { id: string; status: string; totalAmount: string | number } | undefined;
}

async function initiate(token: string, reservationId: string, provider: "BKASH" | "STRIPE") {
  const res = await fetch(`${API}/payments/initiate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ reservationId, provider }),
  });
  const json = await res.json();
  return { status: res.status, json };
}

async function postStripeWebhook(session: Stripe.Checkout.Session) {
  const payload = JSON.stringify({
    id: `evt_test_${crypto.randomBytes(8).toString("hex")}`,
    object: "event",
    type: "checkout.session.completed",
    data: { object: session },
  });
  const header = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: WEBHOOK_SECRET!,
  });
  const res = await fetch("http://localhost:5000/api/v1/payments/webhook/stripe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Stripe-Signature": header,
    },
    body: payload,
  });
  const text = await res.text();
  return { status: res.status, text };
}

async function main() {
  console.log("1) Waiting for API…");
  await waitForHealth();
  console.log("   OK");

  console.log("2) Stripe API ping (balance)…");
  await stripe.balance.retrieve();
  console.log("   OK");

  console.log("3) Login as consumer…");
  const token = await login();
  console.log("   OK");

  console.log("4) Find payable reservation…");
  const reservation = await findPayableReservation(token);
  if (!reservation) {
    console.log("   SKIP — no ALLOCATED/PAYMENT_PENDING reservation; testing webhook signature only");
    const fakeSession = {
      id: "cs_test_fake",
      object: "checkout.session",
      payment_status: "paid",
      status: "complete",
      amount_total: 10000,
      currency: "bdt",
      payment_intent: "pi_test",
    } as Stripe.Checkout.Session;
    const wh = await postStripeWebhook(fakeSession);
    // Expect 404 payment not found OR 200 if handled — either proves signature + route work
    console.log(`   Webhook status=${wh.status} body=${wh.text.slice(0, 200)}`);
    if (wh.status === 400) {
      throw new Error("Webhook signature/route failed");
    }
    console.log("DONE (partial — no reservation to checkout)");
    return;
  }
  console.log(`   Found ${reservation.id} (${reservation.status})`);

  console.log("5) Initiate STRIPE checkout…");
  const stripeInit = await initiate(token, reservation.id, "STRIPE");
  if (stripeInit.status >= 400) {
    throw new Error(`Stripe initiate failed: ${JSON.stringify(stripeInit.json)}`);
  }
  const checkoutURL = stripeInit.json?.data?.checkoutURL as string;
  const sessionId = stripeInit.json?.data?.sessionId as string;
  const provider = stripeInit.json?.data?.provider as string;
  if (!checkoutURL || provider !== "STRIPE" || !sessionId) {
    throw new Error(`Unexpected initiate payload: ${JSON.stringify(stripeInit.json)}`);
  }
  console.log(`   OK provider=${provider} session=${sessionId}`);
  console.log(`   checkoutURL starts: ${checkoutURL.slice(0, 48)}…`);

  console.log("6) Simulate checkout.session.completed webhook…");
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const completed = {
    ...session,
    payment_status: "paid",
    status: "complete",
  } as Stripe.Checkout.Session;
  const wh = await postStripeWebhook(completed);
  console.log(`   status=${wh.status} body=${wh.text}`);
  if (wh.status !== 200) {
    throw new Error("Webhook failed");
  }

  console.log("7) Verify payment COMPLETED…");
  const payRes = await fetch(`${API}/payments/my-payments?page=1&limit=5&sortBy=updatedAt&sortOrder=desc`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const payJson = await payRes.json();
  const latest = (payJson?.data ?? [])[0];
  if (!latest || latest.gatewayStatus !== "COMPLETED" || latest.paymentMethod !== "STRIPE") {
    throw new Error(`Payment not completed: ${JSON.stringify(latest)}`);
  }
  console.log(`   OK payment ${latest.id} method=${latest.paymentMethod} status=${latest.gatewayStatus}`);

  console.log("DONE — Stripe initiate + webhook verified");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
