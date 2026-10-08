/**
 * Runtime probe: production login cookies + /auth/me with/without cookie jar.
 * Writes NDJSON debug lines for session a75d46.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logPath = path.resolve(__dirname, "../../debug-a75d46.log");
const API = "https://power-mesh-server.onrender.com/api/v1";
const ORIGIN = process.env.PROBE_ORIGIN || "https://power-mesh-next.vercel.app";
const email = process.env.PROBE_EMAIL || "consumer@powermesh.com";
const password = process.env.PROBE_PASSWORD || "Consumer@123";

function log(hypothesisId, location, message, data) {
  const line = JSON.stringify({
    sessionId: "a75d46",
    runId: "prod-probe",
    hypothesisId,
    location,
    message,
    data,
    timestamp: Date.now(),
  });
  fs.appendFileSync(logPath, `${line}\n`);
  console.log(line);
}

function parseSetCookies(headers) {
  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie();
  }
  const single = headers.get("set-cookie");
  return single ? [single] : [];
}

function cookieHeaderFromSetCookies(setCookies) {
  return setCookies
    .map((c) => c.split(";")[0])
    .filter(Boolean)
    .join("; ");
}

const loginRes = await fetch(`${API}/auth/login`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Origin: ORIGIN,
  },
  body: JSON.stringify({ email, password }),
});

const loginHeaders = Object.fromEntries(loginRes.headers.entries());
const setCookies = parseSetCookies(loginRes.headers);
const loginJson = await loginRes.json().catch((e) => ({ parseError: String(e) }));

log("H1", "probe-prod-auth.mjs:login", "login response", {
  status: loginRes.status,
  origin: ORIGIN,
  cookieModeHeader: loginHeaders["x-powermesh-cookie-mode"] ?? null,
  acao: loginHeaders["access-control-allow-origin"],
  acac: loginHeaders["access-control-allow-credentials"],
  corp: loginHeaders["cross-origin-resource-policy"],
  vary: loginHeaders.vary,
  setCookieCount: setCookies.length,
  setCookiesSanitized: setCookies.map((c) =>
    c
      .replace(/accessToken=[^;]+/i, "accessToken=REDACTED")
      .replace(/refreshToken=[^;]+/i, "refreshToken=REDACTED"),
  ),
  hasAccessCookie: setCookies.some((c) => /^accessToken=/i.test(c)),
  hasRefreshCookie: setCookies.some((c) => /^refreshToken=/i.test(c)),
  sameSiteNone: setCookies.some((c) => /SameSite=None/i.test(c)),
  secureFlag: setCookies.some((c) => /;\s*Secure/i.test(c)),
  loginSuccess: Boolean(loginJson?.success),
  hasBodyTokens: Boolean(loginJson?.data?.accessToken && loginJson?.data?.refreshToken),
  deployLive: loginHeaders["x-powermesh-cookie-mode"] === "none-secure",
});

const cookieHeader = cookieHeaderFromSetCookies(setCookies);

// Client calls GET /users/me (not /auth/me) after login.
const mePath = "/users/me";

const meNoCookie = await fetch(`${API}${mePath}`, {
  headers: { Origin: ORIGIN },
});
const meNoCookieJson = await meNoCookie.json().catch(() => ({}));
log("H2", "probe-prod-auth.mjs:me-no-cookie", "users/me without Cookie header", {
  status: meNoCookie.status,
  success: meNoCookieJson?.success,
  message: meNoCookieJson?.message,
});

const meWithCookie = await fetch(`${API}${mePath}`, {
  headers: {
    Origin: ORIGIN,
    Cookie: cookieHeader,
  },
});
const meWithCookieJson = await meWithCookie.json().catch(() => ({}));
log("H3", "probe-prod-auth.mjs:me-with-cookie", "users/me with Cookie from Set-Cookie", {
  status: meWithCookie.status,
  success: meWithCookieJson?.success,
  message: meWithCookieJson?.message,
  sentCookieNames: cookieHeader
    .split(";")
    .map((p) => p.trim().split("=")[0])
    .filter(Boolean),
});

const meWithBearer = await fetch(`${API}${mePath}`, {
  headers: {
    Origin: ORIGIN,
    Authorization: `Bearer ${loginJson?.data?.accessToken || ""}`,
  },
});
const meWithBearerJson = await meWithBearer.json().catch(() => ({}));
log("H4", "probe-prod-auth.mjs:me-bearer", "users/me with Authorization bearer only", {
  status: meWithBearer.status,
  success: meWithBearerJson?.success,
  message: meWithBearerJson?.message,
  hadToken: Boolean(loginJson?.data?.accessToken),
});

const optionsRes = await fetch(`${API}${mePath}`, {
  method: "OPTIONS",
  headers: {
    Origin: ORIGIN,
    "Access-Control-Request-Method": "GET",
    "Access-Control-Request-Headers": "content-type",
  },
});
log("H5", "probe-prod-auth.mjs:options", "CORS preflight for users/me", {
  status: optionsRes.status,
  acao: optionsRes.headers.get("access-control-allow-origin"),
  acac: optionsRes.headers.get("access-control-allow-credentials"),
  acam: optionsRes.headers.get("access-control-allow-methods"),
  acah: optionsRes.headers.get("access-control-allow-headers"),
  corp: optionsRes.headers.get("cross-origin-resource-policy"),
});

console.log("Wrote", logPath);
