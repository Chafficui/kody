/**
 * CORS helpers for the public widget APIs.
 *
 * The admin API is intentionally NOT covered here. The admin SPA is
 * same-origin (it lives under `/admin/`) and uses bearer auth, not
 * cookies, so a reflected-Origin CSRF gadget cannot form. We do NOT
 * want to add CORS headers on admin routes — emitting
 * `Access-Control-Allow-Origin: *` would let any malicious page read
 * the admin JSON, and reflecting the request Origin would expose the
 * SPA to the same CSRF shape we're trying to avoid.
 *
 * The public APIs (`/api/chat`, `/api/tickets`, `/api/sessions`,
 * `/api/feedback`) are called from the embedded widget, which runs
 * on the customer's page. The widget sends requests cross-origin and
 * the browser blocks the response unless the server emits the right
 * CORS headers — so we validate Origin against the per-site
 * `allowedOrigins` allowlist (the same one `siteAuth` enforces) and
 * then echo it back as `Access-Control-Allow-Origin`.
 */

import type { Request, Response, NextFunction } from "express";
import type { SiteStore } from "../services/site-store.js";

/** Preflight headers shared by all public endpoints. */
function setPreflightHeaders(res: Response): void {
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, X-Kody-Site-Id, X-Session-Id, Idempotency-Key",
  );
  res.setHeader("Access-Control-Max-Age", "86400");
}

function setAllowOrigin(res: Response, origin: string): void {
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Origin", origin);
}

function originMatchesAllowlist(
  origin: string,
  allowedOrigins: string[],
): boolean {
  let originUrl: string;
  try {
    originUrl = new URL(origin).origin;
  } catch {
    return false;
  }
  return allowedOrigins.some((ao) => {
    try {
      return new URL(ao).origin === originUrl;
    } catch {
      return false;
    }
  });
}

/**
 * CORS for the public widget APIs that authenticate via the
 * `X-Kody-Site-Id` header (chat, tickets, sessions, feedback).
 *
 * - If no Origin header is present, no CORS headers are emitted and
 *   the request flows through (server-to-server calls).
 * - If Origin is present and matches the site's allowlist, the
 *   validated origin is echoed as `Access-Control-Allow-Origin`. We
 *   intentionally do NOT set `Access-Control-Allow-Credentials` —
 *   credentialed CORS + reflected origin + cookie auth is a CSRF
 *   gadget, and the widget never needs to send cookies anyway.
 * - If Origin is present but disallowed, respond 403 (same shape as
 *   `siteAuth`) so the browser surfaces a clear failure.
 * - For OPTIONS, emit the preflight headers and return 204.
 */
export function createPublicCorsForSiteHeader(siteStore: SiteStore) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const origin = req.headers.origin;
    if (!origin) {
      next();
      return;
    }
    const siteId = req.headers["x-kody-site-id"] as string | undefined;
    if (!siteId) {
      // No site id = the route is not a public widget API. Skip and let
      // the global OPTIONS short-circuit / route 401 handle it.
      next();
      return;
    }
    const config = siteStore.getSiteConfig(siteId);
    if (!config) {
      next();
      return;
    }
    if (!originMatchesAllowlist(origin, config.allowedOrigins)) {
      res
        .status(403)
        .json({ error: { message: "Origin not allowed" } });
      return;
    }
    if (req.method === "OPTIONS") {
      setPreflightHeaders(res);
      setAllowOrigin(res, origin);
      res.status(204).end();
      return;
    }
    setAllowOrigin(res, origin);
    next();
  };
}

/**
 * CORS for `/api/config/:siteId`. The site id comes from the URL
 * instead of a header, so we extract it from `req.path` (the segment
 * after `/api/config`).
 *
 * Only the top-level `/api/config/:siteId` is a public widget API;
 * the other admin routes under `/api/config` are bearer-auth and
 * intentionally do not get CORS headers. We match the path shape
 * `/:siteId` with no further segments to scope the middleware
 * correctly.
 */
export function createPublicCorsForConfigRoute(siteStore: SiteStore) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Strip the mount prefix. With `app.use("/api/config", ...)` the
    // sub-router sees `req.path` as `/<siteId>` for the GET handler.
    const segments = req.path.split("/").filter(Boolean);
    if (segments.length !== 1) {
      next();
      return;
    }
    const siteId = segments[0];
    const origin = req.headers.origin;
    if (!origin) {
      next();
      return;
    }
    const config = siteStore.getSiteConfig(siteId);
    if (!config) {
      next();
      return;
    }
    if (!originMatchesAllowlist(origin, config.allowedOrigins)) {
      res
        .status(403)
        .json({ error: { message: "Origin not allowed" } });
      return;
    }
    if (req.method === "OPTIONS") {
      setPreflightHeaders(res);
      setAllowOrigin(res, origin);
      res.status(204).end();
      return;
    }
    setAllowOrigin(res, origin);
    next();
  };
}

/**
 * CORS for `/widget.js`. The widget script is meant to be embeddable
 * from any site that has been configured, so we just echo the request
 * origin back. We do NOT use `*` because credentialed CORS forbids it
 * and we want a deterministic value the browser can cache.
 */
export function createWidgetCors() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const origin = req.headers.origin;
    if (origin) {
      if (req.method === "OPTIONS") {
        setPreflightHeaders(res);
        setAllowOrigin(res, origin);
        res.status(204).end();
        return;
      }
      setAllowOrigin(res, origin);
    }
    next();
  };
}
