import type { CookieOptions } from "express";

import config from "../app/config";

/**
 * Cross-site SPA (e.g. Vercel) → API (Render) needs SameSite=None; Secure.
 * SameSite=Lax cookies are stored for the API host but are NOT sent on
 * cross-site XHR/fetch, so /users/me appears as 401 after a "successful" login.
 *
 * Prefer NODE_ENV=production, but also treat an https FRONTEND_URL as cross-site
 * so a mis-set NODE_ENV on the host cannot leave cookies as Lax.
 */
export const useCrossSiteAuthCookies = (): boolean => {
  if (process.env.COOKIE_SAME_SITE === "none") {
    return true;
  }
  if (process.env.COOKIE_SAME_SITE === "lax") {
    return false;
  }
  if (config.node_env === "production") {
    return true;
  }
  return /^https:\/\//i.test(config.frontend_url ?? "");
};

/**
 * Auth cookies are set on the API host and sent back via credentials: "include".
 */
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

const clearCrossSite = useCrossSiteAuthCookies();

export const clearAuthCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: clearCrossSite,
  sameSite: clearCrossSite ? "none" : "lax",
  path: "/",
};
