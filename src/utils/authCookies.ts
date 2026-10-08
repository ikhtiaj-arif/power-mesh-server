import type { CookieOptions } from "express";

import config from "../app/config";

/**
 * Cross-site SPA (e.g. Vercel) → API (Render) needs SameSite=None; Secure.
 * SameSite=Lax cookies are NOT sent on cross-site XHR/fetch, so /users/me
 * returns 401 after a successful login.
 */
export const useCrossSiteAuthCookies = (): boolean => {
  if (process.env.COOKIE_SAME_SITE === "none") {
    return true;
  }
  if (process.env.COOKIE_SAME_SITE === "lax") {
    return false;
  }
  // Explicit production, or any https frontend (cross-origin SPA hosting).
  if ((config.node_env ?? "").toLowerCase() === "production") {
    return true;
  }
  return /^https:\/\//i.test(config.frontend_url ?? "");
};

export const authCookieOptions = (maxAgeMs: number): CookieOptions => {
  const crossSite = useCrossSiteAuthCookies();

  return {
    httpOnly: true,
    secure: crossSite,
    sameSite: crossSite ? "none" : "lax",
    path: "/",
    maxAge: maxAgeMs,
  };
};

export const clearAuthCookieOptions = (): CookieOptions => {
  const crossSite = useCrossSiteAuthCookies();
  return {
    httpOnly: true,
    secure: crossSite,
    sameSite: crossSite ? "none" : "lax",
    path: "/",
  };
};
