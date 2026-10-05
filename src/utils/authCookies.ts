import type { CookieOptions } from "express";

import config from "../app/config";

/**
 * Auth cookies are consumed by the Next same-origin BFF / browser on
 * FRONTEND_URL. SameSite=None requires Secure, and browsers drop
 * SameSite=None + Secure=false, which is why Postman works and Chrome does not.
 *
 * Local HTTP needs Lax + Secure=false. Production HTTPS can use None + Secure
 * when the API is cross-site; when the BFF owns the cookies it rewrites them.
 */
export const authCookieOptions = (maxAgeMs: number): CookieOptions => {
  const isProduction = config.node_env === "production";

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/",
    maxAge: maxAgeMs,
  };
};

export const clearAuthCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: config.node_env === "production",
  sameSite: config.node_env === "production" ? "none" : "lax",
  path: "/",
};
