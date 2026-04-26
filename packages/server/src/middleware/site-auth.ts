import type { Request, Response, NextFunction } from "express";
import type { SiteStore } from "../services/site-store.js";
import type { SiteConfig } from "@kody/shared";

declare global {
  namespace Express {
    interface Request {
      siteConfig?: SiteConfig;
    }
  }
}

export function createSiteAuth(siteStore: SiteStore) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const siteId = req.headers["x-kody-site-id"] as string | undefined;

    if (!siteId) {
      console.warn(`[site-auth] 400 Missing x-kody-site-id header — ${req.method} ${req.path}`);
      res.status(400).json({ error: { message: "Missing x-kody-site-id header" } });
      return;
    }

    const config = siteStore.getSiteConfig(siteId);
    if (!config) {
      console.warn(`[site-auth] 404 Site not found: ${siteId}`);
      res.status(404).json({ error: { message: "Site not found" } });
      return;
    }

    const origin = req.headers.origin || req.headers.referer;
    if (origin) {
      const originUrl = new URL(origin).origin;
      const allowed = config.allowedOrigins.some((ao: string) => {
        try {
          return new URL(ao).origin === originUrl;
        } catch {
          return false;
        }
      });

      if (!allowed) {
        console.warn(`[site-auth] 403 Origin not allowed: ${originUrl} for site ${siteId} (allowed: ${config.allowedOrigins.join(", ")})`);
        res.status(403).json({ error: { message: "Origin not allowed" } });
        return;
      }
    }

    req.siteConfig = config;
    next();
  };
}
